/**
 * PEER REVIEW — projects.js
 * Proje sistemi iş mantığı.
 * Faz motoru, haftalık ilerleme, kalite hesabı,
 * dergi gönderimi, yayın, retraction, yarış dinamiği.
 * GDD v3.0 §4 Proje Sistemi tam implementasyonu.
 */

'use strict';

import {
  PHASE_SKILLS,
  PHASE_BASE_XP,
  PHASE_LABELS,
  PROJECT_TYPES,
  RETRACTION,
  LAB_LEVELS,
} from '../utils/constants.js';
import {
  clamp,
  chance,
  randInt,
  mean,
  calcBaseSkill,
  calcTeamBonus,
  calcMoraleModifier,
} from '../utils/math.js';
import {
  getState,
  addProject,
  completeProject,
  changeBudget,
  changePrestige,
  addNotification,
  queueEvent,
} from '../core/state.js';
import { EventBus } from '../core/game.js';
import {
  generateProject,
  getPhaseInfo,
  getLowerTier,
  getJournalOptions,
  submitToJournal,
  createPublication,
  calcFinalProjectQuality,
} from '../data/project_defs.js';
import {
  awardPhaseXP,
  checkBreakthrough,
} from './researchers.js';

// ─── SİSTEM KAYDI ────────────────────────────────────────────────────────────

/**
 * Proje sistemini EventBus'a bağlar.
 * Oyun başında bir kez çağrılır.
 */
export function registerProjectSystem() {
  EventBus.on('systems:tick', ({ state }) => {
    tickAllProjects(state);
  });

  EventBus.on('game:month_end', ({ state }) => {
    tickCitations(state);
  });

  EventBus.on('event:resolved', ({ event, choiceId }) => {
    handleProjectEventChoice(event, choiceId);
  });
}

// ─── HAFTALIK TICK ────────────────────────────────────────────────────────────

/**
 * Tüm aktif projeleri haftalık günceller.
 * Slice kullanıyoruz — tick sırasında dizi değişebilir.
 *
 * @param {Object} state
 */
function tickAllProjects(state) {
  for (const project of [...state.projects.active]) {
    tickProject(project, state);
  }
}

/**
 * Tek proje için haftalık tick.
 * Sıra: maliyet düş → ekip üretimi hesapla → faz ilerlet → faz bitiş kontrolü.
 *
 * @param {Object} project
 * @param {Object} state
 */
function tickProject(project, state) {
  const team = state.researchers.filter(r => project.teamIds.includes(r.id));

  // Ekip yoksa ilerleme yok
  if (team.length === 0) {
    if (!project.riskFlags.includes('no_team')) {
      project.riskFlags.push('no_team');
      addNotification(`"${project.label}" projesinde ekip yok — ilerleme durdu.`, 'warning');
    }
    return;
  }

  // Ekip var, no_team flag'ini temizle
  project.riskFlags = project.riskFlags.filter(f => f !== 'no_team');

  // Haftalık maliyet
  changeBudget(-project.costPerWeek);

  // Faz ilerle
  project.phaseWeek++;

  // Faz bitiş kontrolü
  const phaseDuration = project.phaseDurations[project.phase] ?? 1;
  if (project.phaseWeek >= phaseDuration) {
    completeCurrentPhase(project, team, state);
  }

  // Yarış kontrolü — sadece veri toplama fazında
  if (project.phase === 'datacollect') {
    checkRaceCondition(project, state);
  }
}

// ─── FAZ TAMAMLAMA ───────────────────────────────────────────────────────────

/**
 * Mevcut fazı tamamlar.
 * Kalite hesaplar, XP dağıtır, sonraki faza geçer veya projeyi bitirir.
 *
 * @param {Object}   project
 * @param {Object[]} team
 * @param {Object}   state
 */
function completeCurrentPhase(project, team, state) {
  const completedPhase = project.phase;
  const quality        = calcPhaseQuality(project, team, state);

  // Kaliteyi kaydet
  project.phaseQualities[completedPhase] = quality;
  project.phaseWeek = 0;

  // Ekip XP kazanır
  for (const researcher of team) {
    awardPhaseXP(researcher, completedPhase, quality, PHASE_BASE_XP);
  }

  // Sonraki fazı belirle
  const { next, isLast } = getPhaseInfo(project);

  EventBus.emit('project:phase_complete', {
    project,
    phase:   completedPhase,
    quality,
    next,
  });

  addNotification(
    `"${project.label}" — ${PHASE_LABELS[completedPhase] ?? completedPhase} tamamlandı. Kalite: ${Math.round(quality)}`,
    quality >= 70 ? 'success' : 'info',
    4
  );

  if (isLast) {
    // Son faz bitti — dergi seçimine gönder
    handleProjectComplete(project, state);
  } else {
    // Sonraki faza geç
    project.phase      = next;
    project.phaseIndex = project.phaseOrder.indexOf(next);
  }
}

// ─── FAZ KALİTESİ ────────────────────────────────────────────────────────────

/**
 * Bir fazın kalite puanını hesaplar.
 * GDD v3 §4.2 phaseQuality formülü:
 * baseSkill × teamBonus × moraleModifier × equipmentBonus
 *
 * @param {Object}   project
 * @param {Object[]} team
 * @param {Object}   state
 * @returns {number}  0-100
 */
function calcPhaseQuality(project, team, state) {
  if (team.length === 0) return 10;

  const phaseSkillDef = PHASE_SKILLS[project.phase] ?? PHASE_SKILLS.analysis;

  // Her araştırmacının beceri puanını hesapla, ortalama al
  const skillScores = team.map(r => calcBaseSkill(r, phaseSkillDef));
  const avgSkill    = mean(skillScores);

  // Ekip uyumu çarpanı
  const teamMult = team.length > 1
    ? calcTeamBonus(team[0], team.slice(1))
    : 1.0;

  // Moral çarpanı — ekip ortalaması
  const avgMorale  = mean(team.map(r => r.morale));
  const moraleMult = calcMoraleModifier(avgMorale);

  // Ekipman bonusu — Hafta 4'te economy.js tamamlandığında genişler
  const equipMult = 1.0;

  let quality = avgSkill * teamMult * moraleMult * equipMult;

  // ── Kişilik bonus/malus ──────────────────────────────────────────────────

  // Dahî: %5 ihtimalle Breakthrough → kalite 1.5x
  const genius = team.find(r => r.personality === 'GEN');
  if (genius && chance(0.05)) {
    quality = Math.min(100, quality * 1.5);
    EventBus.emit('project:breakthrough', { project, researcher: genius });
    addNotification(`${genius.name} çığır açan bir buluş yaptı!`, 'success', 5);
  }

  // Mükemmeliyetçi: sabit %15 kalite bonusu
  const perfectionist = team.find(r => r.personality === 'PER');
  if (perfectionist) {
    quality = Math.min(100, quality * 1.15);
  }

  // Metodist: hata riski sıfır (kalite hiçbir zaman 30'un altına düşmez)
  const methodist = team.find(r => r.personality === 'MET');
  if (methodist) {
    quality = Math.max(30, quality);
  }

  // ── Etik riski ──────────────────────────────────────────────────────────
  // ET < 40 araştırmacı varsa veri manipülasyonu ihtimali
  for (const r of team) {
    if (r.ET < 40 && chance((40 - r.ET) / 200)) {
      quality = Math.min(100, quality * 1.3);   // kısa vadede iyi görünür
      r._manipulated = true;
      if (!project._manipulatedPhases.includes(project.phase)) {
        project._manipulatedPhases.push(project.phase);
      }
    }
  }

  return clamp(quality, 0, 100);
}

// ─── PROJE TAMAMLAMA ─────────────────────────────────────────────────────────

/**
 * Tüm fazlar bitti — dergi seçim event'i kuyruğa eklenir.
 * Oyuncu hangi dergiye göndereceğini seçer.
 *
 * @param {Object} project
 * @param {Object} state
 */
function handleProjectComplete(project, state) {
  const finalQuality = calcFinalProjectQuality(project.phaseQualities);
  const journalOpts  = getJournalOptions(project.field, finalQuality);

  queueEvent({
    id:             `journal_select_${project.id}`,
    category:       'research',
    label:          'Dergi Seçimi',
    description:    `"${project.label}" tüm aşamaları tamamladı. Kalite skoru: ${Math.round(finalQuality)}. Hangi dergiye göndermek istiyorsunuz?`,
    projectId:      project.id,
    journalOptions: journalOpts,
    choices:        journalOpts.map(opt => ({
      id:          `submit_${opt.journal.id}_${opt.tier}`,
      label:       `${opt.tierLabel}: ${opt.journal.label}`,
      description: `IF ~${opt.baseIF} | Kabul şansı: %${opt.acceptChance} | Süre: ${opt.reviewWeeks} hafta`,
      effect: {
        type:    'submit_journal',
        journal: opt.journal,
        tier:    opt.tier,
      },
    })),
  });

  EventBus.emit('project:ready_for_submission', { project, quality: finalQuality });
}

// ─── DERGİ GÖNDERİMİ ─────────────────────────────────────────────────────────

/**
 * Seçilen dergiye gönderim yapar.
 * Kabul → yayın oluştur. Red → karar event'i.
 *
 * @param {Object} project
 * @param {Object} journal
 * @param {string} tierId
 * @param {Object} state
 */
function submitProject(project, journal, tierId, state) {
  // Baş yazar: WR + RP toplamı en yüksek araştırmacı
  const team = state.researchers.filter(r => project.teamIds.includes(r.id));
  const firstAuthor = team.length > 0
    ? [...team].sort((a, b) => (b.WR + b.RP) - (a.WR + a.RP))[0]
    : null;
  const authorRP = firstAuthor?.RP ?? 50;

  const quality = calcFinalProjectQuality(project.phaseQualities);
  const { accepted, reviewWeeks, impactFactor } = submitToJournal(journal, tierId, quality, authorRP);

  if (accepted) {
    const publication = createPublication({
      project,
      journal,
      tierId,
      impactFactor,
      currentYear:   state.time.year,
      firstAuthorId: firstAuthor?.id ?? null,
    });

    // Retraction riski kontrolü — manipüle edilmiş veri var mı?
    const retractionOccurred = checkRetractionRisk(publication, team);

    if (!retractionOccurred) {
      // Projeyi tamamlandı olarak işaretle, yayını state'e ekle
      completeProject(project.id, publication);
      applyPublicationEffects(publication, state);

      // Breaktrough XP kontrolü (proje tamamlandığında)
      if (firstAuthor) {
        checkBreakthrough(firstAuthor, 'publication');
      }

      EventBus.emit('project:published', { project, publication });
      addNotification(
        `"${project.label}" ${journal.label}'da yayımlandı! IF: ${impactFactor}`,
        'success', 6
      );
    }

  } else {
    // Red — oyuncuya karar seçenekleri sun
    const lowerTier = getLowerTier(tierId);

    const choices = [
      {
        id:    'revise_resubmit',
        label: 'Revize Et ve Tekrar Gönder',
        description: `+${reviewWeeks} hafta revizyon. Kalite artabilir.`,
        effect: { type: 'revise', weeks: reviewWeeks, qualityBoost: randInt(5, 15) },
      },
    ];

    if (lowerTier) {
      choices.push({
        id:    'submit_lower',
        label: 'Bir Alt Dergiye Gönder',
        description: 'Daha düşük impact factor ama kabul şansı yüksek.',
        effect: { type: 'submit_lower', currentTier: tierId },
      });
    }

    choices.push({
      id:    'abandon',
      label: 'Projeyi Rafa Kaldır',
      description: 'Proje tamamlanmadan kapanır.',
      effect: { type: 'abandon' },
    });

    queueEvent({
      id:          `rejection_${project.id}_${state.time.totalWeeks}`,
      category:    'research',
      label:       'Makale Reddedildi',
      description: `"${project.label}", ${journal.label} tarafından reddedildi. Ne yapılsın?`,
      projectId:   project.id,
      rejectedJournal: { journal, tierId },
      choices,
    });

    EventBus.emit('project:rejected', { project, journal });
    addNotification(
      `"${project.label}" reddedildi. Karar bekleniyor.`,
      'warning', 5
    );
  }
}

// ─── RETRACTION ──────────────────────────────────────────────────────────────

/**
 * Yayın sonrası retraction riski kontrolü.
 * GDD v3 §7.3 formülü.
 *
 * @param {Object}   publication
 * @param {Object[]} team
 * @returns {boolean}  retraction gerçekleşti mi
 */
function checkRetractionRisk(publication, team) {
  if (!publication._manipulated) return false;

  const manipulators = team.filter(r => r._manipulated);
  if (manipulators.length === 0) return false;

  const avgET       = mean(manipulators.map(r => r.ET));
  const ethicFactor = clamp((40 - avgET) / 40, 0, 1) * RETRACTION.ETHIC_RISK_MAX;
  const ifFactor    = (publication.impactFactor / 70) * RETRACTION.IF_RISK_MAX;
  const totalRisk   = RETRACTION.BASE_RISK + ethicFactor + ifFactor;

  if (chance(totalRisk)) {
    triggerRetraction(publication, manipulators[0]);
    return true;
  }

  return false;
}

/**
 * Retraction'ı uygular — prestij, RP ve Nobel puanı cezası.
 *
 * @param {Object} publication
 * @param {Object} researcher   — manipülasyonu yapan araştırmacı
 */
function triggerRetraction(publication, researcher) {
  const state = getState();

  publication.retracted = true;
  state.lab.retractions.push({
    paperId: publication.id,
    field:   publication.field,
    year:    state.time.year,
  });

  changePrestige(-RETRACTION.PRESTIGE_HIT);
  researcher.RP = clamp(researcher.RP - RETRACTION.RESEARCHER_RP_HIT, 0, 100);

  // Nobel puanı cezası
  if (state.lab.nobelScores[publication.field]) {
    state.lab.nobelScores[publication.field] = Math.max(
      0,
      state.lab.nobelScores[publication.field] - 50
    );
  }

  EventBus.emit('retraction:occurred', { publication, researcher });
  addNotification(
    `Skandal: "${publication.label}" geri çekildi! Prestij -${RETRACTION.PRESTIGE_HIT}`,
    'danger', 8
  );
}

// ─── YAYIN ETKİLERİ ───────────────────────────────────────────────────────────

/**
 * Başarılı yayının lab'a etkileri.
 * Prestij artışı, Nobel puanı birikimi.
 *
 * @param {Object} publication
 * @param {Object} state
 */
function applyPublicationEffects(publication, state) {
  // Tamamlanan projeden tip tanımını bul
  const completedProject = state.projects.completed.find(p => p.id === publication.projectId);
  const typeDef = completedProject
    ? (PROJECT_TYPES[completedProject.type] ?? PROJECT_TYPES.basic)
    : PROJECT_TYPES.basic;

  // Prestij artışı
  const prestigeGain = Math.round(
    (publication.quality / 100)
    * (publication.impactFactor / 10)
    * typeDef.prestigeMult
    * 5
  );
  changePrestige(prestigeGain);

  // Nobel puanı birikimi
  const field = publication.field;
  if (!state.lab.nobelScores[field]) state.lab.nobelScores[field] = 0;

  const nobelPoints = Math.round(
    (publication.impactFactor * 2
    + (publication.isOriginal ? 20 : 0)
    + publication.quality * 0.3)
    * typeDef.nobelCoeff
  );
  state.lab.nobelScores[field] += nobelPoints;

  EventBus.emit('lab:prestige_changed',  { delta: prestigeGain, total: state.lab.prestige });
  EventBus.emit('nobel:score_updated',   { field, score: state.lab.nobelScores[field] });
}

// ─── CITATION TICK ────────────────────────────────────────────────────────────

/**
 * Her ay tüm yayınlar için citation hesabı.
 * @param {Object} state
 */
function tickCitations(state) {
  for (const pub of state.lab.publications) {
    if (pub.retracted) continue;

    const age           = state.time.year - pub.year;
    const fieldActivity = state.researchers.filter(r => r.field === pub.field).length;

    // Yaşa göre citation azalır
    const decayFactor   = Math.pow(0.92, age);
    const base          = pub.quality * 0.3 + pub.impactFactor * 2 + fieldActivity * 0.5;
    const newCitations  = Math.max(0, Math.round(base * decayFactor * (0.8 + Math.random() * 0.4)));

    pub.citations += newCitations;
    pub.citationHistory.push({ year: state.time.year, count: newCitations });
    state.stats.totalCitations += newCitations;
  }
}

// ─── YARIŞ DİNAMİĞİ ──────────────────────────────────────────────────────────

/**
 * Aynı alanda rakip proje varsa yarış başlatır.
 * @param {Object} project
 * @param {Object} state
 */
function checkRaceCondition(project, state) {
  if (project.isRacing) return;

  const competingRivals = Object.entries(state.rivals).filter(([, rival]) =>
    rival.activeProjects?.some(p => p.field === project.field && p.phase === 'datacollect')
  );

  if (competingRivals.length === 0) return;

  project.isRacing = true;
  if (!project.riskFlags.includes('racing')) project.riskFlags.push('racing');

  const rivalLabel = competingRivals[0][1].label ?? competingRivals[0][0];
  EventBus.emit('project:racing', { project, rival: competingRivals[0][1] });
  addNotification(
    `⚡ ${rivalLabel} aynı alanda veri topluyor — yarış başladı!`,
    'warning', 5
  );
}

// ─── EVENT KARARLARINI UYGULA ─────────────────────────────────────────────────

/**
 * Proje event kararlarını uygular.
 *
 * @param {Object} event
 * @param {string} choiceId
 */
function handleProjectEventChoice(event, choiceId) {
  const state  = getState();
  const choice = event.choices?.find(c => c.id === choiceId);
  if (!choice?.effect) return;

  // ── Dergi seçim kararı ───────────────────────────────────────────────────
  if (event.id.startsWith('journal_select_')) {
    const project = state.projects.active.find(p => p.id === event.projectId);
    if (!project) return;

    const { journal, tier } = choice.effect;
    if (journal && tier) {
      submitProject(project, journal, tier, state);
    }
    return;
  }

  // ── Red sonrası karar ────────────────────────────────────────────────────
  if (event.id.startsWith('rejection_')) {
    const project = state.projects.active.find(p => p.id === event.projectId);
    if (!project) return;

    const effectType = choice.effect.type;

    if (effectType === 'revise') {
      // Revizyon fazına dön
      project.phase     = 'revision';
      project.phaseIndex = project.phaseOrder.indexOf('revision');
      project.phaseWeek = 0;
      project.phaseDurations['revision'] = choice.effect.weeks;

      // Yazım kalitesi biraz artar
      if (project.phaseQualities['writing'] !== undefined) {
        project.phaseQualities['writing'] = clamp(
          project.phaseQualities['writing'] + (choice.effect.qualityBoost ?? 10),
          0, 100
        );
      }
      addNotification(`"${project.label}" revizyon sürecine girdi.`, 'info', 4);

    } else if (effectType === 'submit_lower') {
      const lowerTier = getLowerTier(choice.effect.currentTier);
      if (!lowerTier) return;

      const quality  = calcFinalProjectQuality(project.phaseQualities);
      const opts     = getJournalOptions(project.field, quality);
      const lowerOpt = opts.find(o => o.tier === lowerTier);
      if (lowerOpt) {
        submitProject(project, lowerOpt.journal, lowerTier, state);
      }

    } else if (effectType === 'abandon') {
      completeProject(project.id, null);
      EventBus.emit('project:failed', { project });
      addNotification(`"${project.label}" rafa kaldırıldı.`, 'info', 4);
    }
  }
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

/**
 * Yeni proje başlatır.
 * UI tarafından çağrılır.
 *
 * @param {Object} options  — { type, field, label? }
 * @returns {Object|null}   — oluşturulan proje veya null (kapasite doluysa)
 */
export function startNewProject(options) {
  const state   = getState();
  const maxProj = LAB_LEVELS[state.lab.level]?.maxProjects ?? 2;

  if (state.projects.active.length >= maxProj) {
    addNotification('Maksimum proje kapasitesine ulaşıldı.', 'warning');
    return null;
  }

  const project = generateProject({
    type:      options.type,
    field:     options.field,
    startWeek: state.time.totalWeeks,
    label:     options.label ?? null,
    partnerId: options.partnerId ?? null,
  });

  addProject(project);
  EventBus.emit('project:started', { project });
  addNotification(`"${project.label}" projesi başlatıldı.`, 'success', 4);
  return project;
}

/**
 * Araştırmacıyı projeye atar.
 *
 * @param {string} projectId
 * @param {string} researcherId
 * @returns {boolean}  başarılı mı
 */
export function assignResearcher(projectId, researcherId) {
  const state      = getState();
  const project    = state.projects.active.find(p => p.id === projectId);
  const researcher = state.researchers.find(r => r.id === researcherId);

  if (!project || !researcher) return false;
  if (project.teamIds.includes(researcherId)) return false;

  // Araştırmacının eski projesinden çıkar
  if (researcher.assignedProjectId && researcher.assignedProjectId !== projectId) {
    const oldProject = state.projects.active.find(p => p.id === researcher.assignedProjectId);
    if (oldProject) {
      oldProject.teamIds = oldProject.teamIds.filter(id => id !== researcherId);
    }
  }

  project.teamIds.push(researcherId);
  researcher.assignedProjectId = projectId;

  EventBus.emit('project:researcher_assigned', { project, researcher });
  return true;
}

/**
 * Araştırmacıyı projeden çıkarır.
 *
 * @param {string} projectId
 * @param {string} researcherId
 */
export function unassignResearcher(projectId, researcherId) {
  const state      = getState();
  const project    = state.projects.active.find(p => p.id === projectId);
  const researcher = state.researchers.find(r => r.id === researcherId);

  if (!project || !researcher) return;

  project.teamIds              = project.teamIds.filter(id => id !== researcherId);
  researcher.assignedProjectId = null;

  EventBus.emit('project:researcher_unassigned', { project, researcher });
}
