/**
 * PEER REVIEW — events.js
 * Event motoru iş mantığı.
 * Haftalık tetikleme, kategori seçimi, araştırmacı hedefleme,
 * event effect uygulama.
 * GDD v3.0 §8.1 Event Motoru tam implementasyonu.
 */

'use strict';

import {
  EVENTS,
  GRANT_DEFS,
  FIELDS,
} from '../utils/constants.js';
import {
  chance,
  weightedRandom,
  pickRandom,
  randInt,
  clamp,
} from '../utils/math.js';
import {
  getState,
  queueEvent,
  recordEvent,
  changeBudget,
  changePrestige,
  addNotification,
  addResearcher,
} from '../core/state.js';
import { EventBus } from '../core/game.js';
import {
  EVENT_POOLS,
  getEligibleEvents,
} from '../data/event_pools.js';
import {
  generateResearcher,
} from '../data/researcher_defs.js';

// ─── SİSTEM KAYDI ────────────────────────────────────────────────────────────

/**
 * Event sistemini EventBus'a bağlar.
 * game.js'in 'events:request' event'ini dinler.
 * Oyun başında bir kez çağrılır.
 */
export function registerEventSystem() {
  // game.js her hafta 'events:request' emit eder
  // events.js üretilen event'i 'events:generated' ile geri bildirir
  EventBus.on('events:request', ({ state, categoryWeights }) => {
    const event = generateWeeklyEvent(state, categoryWeights);
    if (event) {
      EventBus.emit('events:generated', { event });
    }
  });

  // Tüm event kararları bu sistemden geçer
  EventBus.on('event:resolved', ({ event, choiceId }) => {
    applyEventEffect(event, choiceId);
    recordEvent(event.id, choiceId);
  });

  // Rakip Nobel kazandığında özel effect
  EventBus.on('rival:nobel_won', ({ rivalId, field }) => {
    handleRivalNobelEffect(rivalId, field);
  });
}

// ─── EVENT ÜRETİCİ ───────────────────────────────────────────────────────────

/**
 * Bu hafta tetiklenecek event'i üretir.
 * GDD v3.0 §8.1 weeklyEventCheck formülü.
 *
 * @param {Object} state
 * @param {Object} categoryWeights  — { world, institution, research, personal }
 * @returns {Object|null}  event nesnesi veya null
 */
function generateWeeklyEvent(state, categoryWeights) {
  // Temel tetikleme şansı: %30
  if (!chance(EVENTS.BASE_WEEKLY_CHANCE)) return null;

  // Kategori seç
  const category = weightedRandom(categoryWeights);

  // Koşulu sağlayan event'leri filtrele
  const eligible = getEligibleEvents(category, state);
  if (eligible.length === 0) return null;

  // Ağırlıklı seçim — weight alanına göre
  const selected = weightedRandom(
    eligible.map(e => ({ ...e, weight: e.weight ?? 1 }))
  );

  // Daha önce bu event son 20 haftada tetiklendi mi? (tekrar önleme)
  const recentIds = (state.events.history ?? [])
    .slice(-20)
    .map(h => h.id);
  if (recentIds.includes(selected.id)) return null;

  // Araştırmacı hedefli event ise hedef belirle
  return resolveEventTarget(selected, state);
}

/**
 * Araştırmacı hedefli event'ler için hedef araştırmacıyı belirler.
 * {{name}} placeholder'ını gerçek isimle değiştirir.
 *
 * @param {Object} event
 * @param {Object} state
 * @returns {Object}  hedef bilgisi eklenmiş event
 */
function resolveEventTarget(event, state) {
  if (!event.researcherTarget) return event;

  let candidates = [...state.researchers];
  if (candidates.length === 0) return null;

  // Hedef filtresi
  if (event.researcherTarget === 'lowMorale') {
    candidates = candidates.filter(r => r.morale < 40 && !r.isBurnout);
  } else if (event.researcherTarget === 'highRP') {
    candidates = candidates.filter(r => r.RP >= 60);
  } else if (event.researcherTarget === 'senior') {
    candidates = candidates.filter(r => r.careerStage === 'senior');
  } else if (event.researcherTarget === 'emeritus') {
    candidates = candidates.filter(r => r.careerStage === 'emeritus');
  }
  // researcherTarget === true → herhangi biri

  if (candidates.length === 0) return null;

  const target = pickRandom(candidates);

  return {
    ...event,
    researcherId:  target.id,
    description:   event.description.replace('{{name}}', target.name),
    label:         event.label.replace('{{name}}', target.name),
  };
}

// ─── EFFECT UYGULAYICI ───────────────────────────────────────────────────────

/**
 * Oyuncunun seçtiği kararın effect'ini uygular.
 *
 * @param {Object} event
 * @param {string} choiceId
 */
function applyEventEffect(event, choiceId) {
  const state  = getState();
  const choice = event.choices?.find(c => c.id === choiceId);
  if (!choice?.effect) return;

  const effect = choice.effect;
  const type   = effect.type;

  // Araştırmacı bul (hedefli event'ler için)
  const researcher = event.researcherId
    ? state.researchers.find(r => r.id === event.researcherId)
    : null;

  switch (type) {

    // ── Genel ──────────────────────────────────────────────────────────────
    case 'none':
      break;

    case 'prestige_gain':
      changePrestige(effect.amount ?? 0);
      if (effect.extraCandidate) {
        addNotification('Yeni araştırmacı başvurusu geldi!', 'info', 4);
      }
      if (effect.collabBoost) {
        // İşbirliği projelerinde bu haftadan itibaren bonus — Hafta 7'de genişler
      }
      break;

    case 'prestige_hit':
      changePrestige(effect.amount ?? 0);
      if (effect.fieldBoostRandom) {
        const field = pickRandom(Object.keys(FIELDS));
        EventBus.emit('economy:field_boost', { field, weeks: 8 });
      }
      break;

    case 'budget_gain':
      changeBudget(effect.amount ?? 0);
      addNotification(`Bütçeye +${effect.amount?.toLocaleString()} eklendi.`, 'success', 4);
      break;

    case 'budget_random': {
      const delta = Math.round(state.lab.budget * (effect.pct ?? 0));
      changeBudget(delta);
      addNotification(
        delta >= 0
          ? `Bütçe artışı: +${delta.toLocaleString()}`
          : `Bütçe kesintisi: ${delta.toLocaleString()}`,
        delta >= 0 ? 'success' : 'warning', 4
      );
      break;
    }

    // ── Hibe ───────────────────────────────────────────────────────────────
    case 'open_grant': {
      const grantDef = GRANT_DEFS[effect.grantId];
      if (grantDef) {
        addNotification(
          `"${grantDef.label}" başvurusu açıldı. Hibeler sekmesinden başvurabilirsiniz.`,
          'info', 6
        );
        EventBus.emit('economy:grant_available', { grantId: effect.grantId });
      }
      break;
    }

    case 'grant_cancelled_and_apply':
      if (state.lab.grants.length > 0) {
        const cancelled = state.lab.grants.shift();
        addNotification(`"${cancelled.label}" hibesi iptal edildi!`, 'danger', 5);
      }
      EventBus.emit('economy:grant_available', { grantId: 'emergency_science' });
      break;

    // ── Alan boost ─────────────────────────────────────────────────────────
    case 'field_boost':
      EventBus.emit('economy:field_boost', {
        field: effect.field,
        mult:  effect.mult ?? 1.0,
        weeks: effect.weeks ?? 8,
      });
      addNotification(
        `${FIELDS[effect.field]?.label ?? effect.field} alanı ${effect.weeks} hafta boyunca güçlendi.`,
        'success', 5
      );
      break;

    // ── Maliyet kesintisi ──────────────────────────────────────────────────
    case 'cost_cut':
      for (const r of state.researchers) {
        r.hoursPerWeek = Math.max(32, Math.round(r.hoursPerWeek * (1 - (effect.pct ?? 0.2))));
      }
      addNotification('Çalışma saatleri azaltıldı — maliyetler düşüyor.', 'warning', 4);
      break;

    // ── Lab yükseltme ──────────────────────────────────────────────────────
    case 'lab_upgrade':
      if (state.lab.level < 5) {
        // Gecikme event'i kuyruğa ekle
        queueEvent({
          id:          `lab_upgrade_complete_${state.time.totalWeeks + (effect.disruption ?? 4)}`,
          category:    'institution',
          label:       'Lab Yükseltme Tamamlandı',
          description: 'İnşaat tamamlandı! Laboratuvar kapasitesi genişledi.',
          choices: [{
            id: 'celebrate', label: 'Harika!',
            effect: { type: 'apply_lab_upgrade' },
          }],
        });
        addNotification('Lab yükseltme başladı. 4 hafta sonra tamamlanacak.', 'info', 5);
      }
      break;

    case 'apply_lab_upgrade':
      if (state.lab.level < 5) {
        state.lab.level++;
        addNotification(`Lab seviyesi ${state.lab.level}'e yükseldi!`, 'success', 6);
        EventBus.emit('lab:level_up', { level: state.lab.level });
      }
      break;

    // ── Ekipman ────────────────────────────────────────────────────────────
    case 'equipment_boost': {
      if (state.lab.equipment.length > 0) {
        const target = pickRandom(state.lab.equipment);
        // Yaşı azalt — verimlilik artar
        target.age = Math.max(0, Math.round(target.age * (1 - (effect.pct ?? 0.2))));
        addNotification('Ekipman verimliliği arttı!', 'success', 4);
      }
      break;
    }

    case 'free_equipment': {
      // Rastgele düşük maliyetli ekipman ver
      const freeOptions = ['basic_microscope', 'data_analysis_suite', 'reference_manager', 'statistical_software', 'field_kit'];
      const notOwned    = freeOptions.filter(id => !state.lab.equipment.some(e => e.id === id));
      if (notOwned.length > 0) {
        const equipId = pickRandom(notOwned);
        state.lab.equipment.push({ id: equipId, age: 0 });
        addNotification('Ücretsiz ekipman eklendi!', 'success', 5);
        EventBus.emit('economy:equipment_purchased', { equipmentId: equipId });
      }
      break;
    }

    case 'equipment_damage': {
      if (state.lab.equipment.length > 0) {
        const damaged = pickRandom(state.lab.equipment);
        damaged.age   = Math.round(damaged.age * 1.5);
        addNotification('Ekipman hasar gördü!', 'danger', 5);
      }
      break;
    }

    case 'emergency_repair': {
      const repairCost = Math.round(state.lab.budget * (effect.costPct ?? 0.10));
      changeBudget(-repairCost);
      if (state.lab.equipment.length > 0) {
        const eq  = pickRandom(state.lab.equipment);
        eq.age    = Math.floor(eq.age * 0.5);
      }
      addNotification(`Acil onarım yapıldı: -${repairCost.toLocaleString()}`, 'warning', 4);
      break;
    }

    // ── Proje etkileri ─────────────────────────────────────────────────────
    case 'project_quality_boost': {
      const activeProjects = state.projects.active;
      if (activeProjects.length > 0) {
        const proj = pickRandom(activeProjects);
        const phase = proj.phase;
        const old   = proj.phaseQualities[phase] ?? 0;
        proj.phaseQualities[phase] = clamp(old + (effect.amount ?? 20), 0, 100);
        if (effect.extraWeeks) proj.phaseDurations[phase] = (proj.phaseDurations[phase] ?? 1) + effect.extraWeeks;
        addNotification(`"${proj.label}" projesinde kalite artışı!`, 'success', 4);
      }
      break;
    }

    case 'project_pause': {
      const activeProjects = state.projects.active;
      if (activeProjects.length > 0) {
        const proj = pickRandom(activeProjects);
        proj.phaseDurations[proj.phase] = (proj.phaseDurations[proj.phase] ?? 1) + (effect.weeks ?? 2);
        addNotification(`"${proj.label}" projesi ${effect.weeks ?? 2} hafta yavaşlıyor.`, 'warning', 4);
      }
      break;
    }

    case 'phase_restart': {
      const proj = state.projects.active.find(p => p.phase === effect.phase);
      if (proj) {
        proj.phaseWeek = 0;
        delete proj.phaseQualities[effect.phase];
        addNotification(`"${proj.label}" — ${effect.phase} fazı sıfırlandı.`, 'warning', 5);
      }
      break;
    }

    case 'data_recovery_attempt': {
      const proj = state.projects.active.find(p => p.phase === 'datacollect');
      if (proj) {
        if (chance(0.5)) {
          addNotification(`Veri kurtarma başarılı!`, 'success', 4);
        } else {
          proj.phaseWeek = Math.max(0, proj.phaseWeek - (effect.weeksLost ?? 3));
          addNotification(`Veri kurtarma başarısız — ${effect.weeksLost} hafta kayıp.`, 'danger', 5);
        }
      }
      break;
    }

    case 'rush_publication': {
      const proj = state.projects.active.find(
        p => p.phase === 'writing' || p.phase === 'peerreview'
      );
      if (proj) {
        proj.phaseDurations[proj.phase] = 1;
        addNotification(`"${proj.label}" yayın süreci hızlandırıldı.`, 'info', 4);
      }
      break;
    }

    case 'forced_revision': {
      const proj = state.projects.active.find(
        p => p.phase === 'peerreview' || p.phase === 'revision'
      );
      if (proj) {
        proj.phase    = 'revision';
        proj.phaseWeek = 0;
        proj.phaseDurations['revision'] = (proj.phaseDurations['revision'] ?? 1) + (effect.weeks ?? 3);
        if (effect.qualityBoost && proj.phaseQualities['writing']) {
          proj.phaseQualities['writing'] = clamp(
            proj.phaseQualities['writing'] + effect.qualityBoost, 0, 100
          );
        }
        addNotification(`Kapsamlı revizyon başladı: +${effect.weeks} hafta.`, 'warning', 4);
      }
      break;
    }

    case 'appeal_review': {
      if (chance(0.4)) {
        addNotification('İtiraz başarılı — süreç devam ediyor.', 'success', 4);
      } else {
        const proj = state.projects.active.find(p => p.phase === 'peerreview');
        if (proj) proj.phaseDurations['peerreview'] = (proj.phaseDurations['peerreview'] ?? 1) + (effect.failWeeks ?? 5);
        addNotification(`İtiraz reddedildi — +${effect.failWeeks} hafta ek süre.`, 'danger', 5);
      }
      break;
    }

    case 'secondary_publication': {
      // Basitleştirilmiş: Nobel ve prestij doğrudan ekle
      changePrestige(10);
      addNotification('İkincil yayın süreci başladı.', 'info', 4);
      break;
    }

    case 'special_issue_invite': {
      const proj = state.projects.active.find(
        p => p.phase === 'writing' || p.phase === 'peerreview'
      );
      if (proj) {
        proj._ifBonus = (proj._ifBonus ?? 0) + (effect.ifBonus ?? 10);
        addNotification('Özel sayı daveti kabul edildi — IF bonusu eklendi!', 'success', 4);
      }
      break;
    }

    case 'method_upgrade': {
      if (state.projects.active.length > 0) {
        const proj = pickRandom(state.projects.active);
        proj.phaseDurations[proj.phase] = (proj.phaseDurations[proj.phase] ?? 1) + (effect.delay ?? 2);
        proj._speedBoost = (proj._speedBoost ?? 1.0) + (effect.speedBoost ?? 0.2);
        addNotification('Yeni yöntem benimsendi — yakında hızlanacak.', 'info', 4);
      }
      break;
    }

    // ── Citation ───────────────────────────────────────────────────────────
    case 'citation_burst': {
      if (state.lab.publications.length > 0) {
        const pub = pickRandom(state.lab.publications.filter(p => !p.retracted));
        if (pub) {
          pub.citations += effect.amount ?? 40;
          state.stats.totalCitations += effect.amount ?? 40;
          addNotification(`Citation patlaması: +"${effect.amount}" alıntı.`, 'success', 4);
        }
      }
      break;
    }

    case 'media_boost': {
      changePrestige(effect.prestige ?? 10);
      if (state.lab.publications.length > 0) {
        const pub = pickRandom(state.lab.publications.filter(p => !p.retracted));
        if (pub) pub.citations += effect.citations ?? 20;
      }
      addNotification('Medya ilgisi prestij ve citation kazandırdı!', 'success', 4);
      break;
    }

    // ── Etik ───────────────────────────────────────────────────────────────
    case 'ethics_boost': {
      for (const r of state.researchers) {
        r.ET = clamp((r.ET ?? 50) + (effect.amount ?? 10), 0, 100);
      }
      addNotification('Etik puanlar yükseldi.', 'info', 3);
      break;
    }

    case 'ethics_risk': {
      // Retraction riskini artır — _manipulated flag ekle
      if (state.projects.active.length > 0) {
        const proj = pickRandom(state.projects.active);
        if (!proj._manipulatedPhases.includes(proj.phase)) {
          proj._manipulatedPhases.push(proj.phase);
        }
        addNotification('Etik risk yükseldi.', 'danger', 5);
      }
      break;
    }

    case 'prestige_risk': {
      if (chance(0.5)) {
        changePrestige(-(effect.loss ?? 10));
        addNotification(`Prestij riski gerçekleşti: -${effect.loss ?? 10}`, 'warning', 4);
      }
      break;
    }

    case 'plagiarism_defense': {
      if (chance(effect.successPct ?? 0.7)) {
        changePrestige(5);
        addNotification('İntihal iddiasından beraat edildi! +5 prestij.', 'success', 5);
      } else {
        changePrestige(-25);
        addNotification('İntihal iddiası kanıtlandı! -25 prestij.', 'danger', 6);
      }
      break;
    }

    case 'replication_attempt': {
      if (chance(0.7)) {
        changePrestige(effect.successPrestige ?? 20);
        addNotification('Tekrar deneyi başarılı — bulgular teyit edildi!', 'success', 5);
      } else {
        changePrestige(effect.failPrestige ?? -5);
        addNotification('Tekrar deneyi başarısız — bulgular teyit edilemedi.', 'warning', 4);
      }
      break;
    }

    case 'audit_risk': {
      if (chance(0.6)) {
        changePrestige(effect.successPrestige ?? 5);
        addNotification('Denetim başarıyla tamamlandı.', 'success', 4);
      } else {
        changePrestige(effect.failPrestige ?? -15);
        addNotification('Denetim başarısız — prestij kaybı.', 'danger', 5);
      }
      break;
    }

    case 'conditional_donation': {
      if (state.lab.prestige >= (effect.minPrestige ?? 200)) {
        changeBudget(effect.amount ?? 3000);
        addNotification(`Büyük bağış alındı: +${effect.amount?.toLocaleString()}!`, 'success', 6);
      } else {
        addNotification('Bağışçı etkilenmedi — prestij yetersiz.', 'info', 4);
      }
      break;
    }

    // ── Araştırmacı personal effects ──────────────────────────────────────
    case 'leave': {
      if (researcher) {
        researcher.isOnLeave     = true;
        researcher.leaveWeeksLeft = effect.weeks ?? 4;
        researcher.morale = clamp((researcher.morale ?? 50) + (effect.moraleBoost ?? 0), 0, 100);
        if (effect.teamMoraleBoost) {
          for (const r of state.researchers) {
            if (r.id !== researcher.id) r.morale = clamp(r.morale + effect.teamMoraleBoost, 0, 100);
          }
        }
        addNotification(`${researcher.name} izne ayrıldı.`, 'info', 4);
      }
      break;
    }

    case 'morale_hit': {
      if (researcher) {
        researcher.morale = clamp((researcher.morale ?? 50) + (effect.amount ?? -10), 0, 100);
      }
      break;
    }

    case 'team_morale_boost': {
      for (const r of state.researchers) {
        r.morale = clamp(r.morale + (effect.amount ?? 10), 0, 100);
      }
      addNotification('Ekip morali yükseldi!', 'success', 4);
      break;
    }

    case 'burnout_support': {
      if (researcher) {
        researcher.morale    = clamp((researcher.morale ?? 0) + (effect.moraleBoost ?? 20), 0, 100);
        researcher.isBurnout = researcher.morale < 20;
        addNotification(`${researcher.name} destek aldı.`, 'info', 4);
      }
      break;
    }

    case 'family_support': {
      if (researcher) {
        researcher.morale = clamp((researcher.morale ?? 50) + (effect.moraleBoost ?? 10), 0, 100);
        addNotification(`${researcher.name}'e destek verildi.`, 'info', 4);
      }
      break;
    }

    case 'conference': {
      if (researcher) {
        researcher.isOnLeave      = true;
        researcher.leaveWeeksLeft = effect.weeks ?? 2;
        researcher.RP = clamp((researcher.RP ?? 50) + (effect.rpGain ?? 25), 0, 100);
        addNotification(`${researcher.name} konferansa gitti. RP +${effect.rpGain}`, 'success', 4);
      }
      break;
    }

    case 'salary_match': {
      if (researcher) {
        researcher.salary = Math.round(researcher.salary * (effect.mult ?? 2.0));
        addNotification(`${researcher.name} maaşı eşitlendi — kaldı.`, 'success', 4);
      }
      break;
    }

    case 'salary_counter': {
      if (researcher) {
        const newSalary = Math.round(researcher.salary * (effect.mult ?? 1.3));
        researcher.salary = newSalary;
        if (chance(0.6 + (researcher.LY ?? 50) / 200)) {
          addNotification(`${researcher.name} karşı teklifi kabul etti.`, 'success', 4);
        } else {
          state.researchers = state.researchers.filter(r => r.id !== researcher.id);
          state.stats.totalResearchersLost++;
          addNotification(`${researcher.name} teklifi reddedip ayrıldı.`, 'danger', 5);
          EventBus.emit('researcher:left', { researcher });
        }
      }
      break;
    }

    case 'researcher_leaves': {
      if (researcher) {
        state.researchers = state.researchers.filter(r => r.id !== researcher.id);
        state.stats.totalResearchersLost++;
        addNotification(`${researcher.name} kurumdan ayrıldı.`, 'danger', 5);
        EventBus.emit('researcher:left', { researcher });
      }
      break;
    }

    case 'book_writing': {
      if (researcher) {
        researcher.isOnLeave      = true;
        researcher.leaveWeeksLeft = effect.weeks ?? 12;
        researcher.RP = clamp((researcher.RP ?? 50) + (effect.rpGain ?? 40), 0, 100);
        addNotification(`${researcher.name} kitap yazımına başladı. RP +${effect.rpGain}`, 'info', 4);
      }
      break;
    }

    case 'teaching': {
      if (researcher) {
        // Ders verme: haftalık verim düşer — phaseWeek ilerleme yavaşlar
        researcher._teachingWeeks    = effect.weeks ?? 8;
        researcher._teachingProdPct  = effect.productionPct ?? 0.5;
        researcher.RP = clamp((researcher.RP ?? 50) + (effect.rpGain ?? 15), 0, 100);
        addNotification(`${researcher.name} ders veriyor. RP +${effect.rpGain}`, 'info', 4);
      }
      break;
    }

    case 'sabbatical': {
      if (researcher) {
        researcher.isOnLeave      = true;
        researcher.leaveWeeksLeft = effect.weeks ?? 12;
        researcher._sabbaticalBoost = effect.statBoost ?? 10;
        addNotification(`${researcher.name} sabbatical iznine çıktı.`, 'info', 4);
      }
      break;
    }

    case 'hire_junior': {
      const junior = generateResearcher({ careerStage: 'junior' });
      addResearcher(junior);
      addNotification(`${junior.name} ekibe katıldı!`, 'success', 5);
      break;
    }

    case 'mentorship': {
      const junior = state.researchers.find(r => r.careerStage === 'junior');
      if (junior) {
        junior._mentorXpBoost  = effect.xpMultBoost ?? 1.5;
        junior._mentorWeeks    = effect.weeks ?? 12;
        addNotification('Mentörlük ilişkisi kuruldu.', 'success', 4);
      }
      break;
    }

    case 'emeritus_transition': {
      if (researcher) {
        researcher.careerStage = 'emeritus';
        researcher.hoursPerWeek = 20;
        addNotification(`${researcher.name} Onursal Araştırmacı statüsüne geçti.`, 'info', 4);
      }
      break;
    }

    case 'retention_offer': {
      if (researcher) {
        researcher.salary = Math.round(researcher.salary * (effect.mult ?? 1.5));
        addNotification(`${researcher.name} için kalış teklifi yapıldı.`, 'info', 4);
      }
      break;
    }

    case 'extra_candidates': {
      // İşe alma havuzuna ek aday bildirgesi — left.js next hire cycle'da kullanır
      EventBus.emit('researchers:extra_candidates', {
        field:       effect.field ?? null,
        careerStage: effect.careerStage ?? null,
        count:       effect.count ?? 1,
      });
      addNotification('Yeni araştırmacı adayları mevcut!', 'info', 4);
      break;
    }

    case 'freeze_collab': {
      // İşbirliği projelerini dondur
      for (const proj of state.projects.active) {
        if (proj.type === 'collab') {
          proj.phaseDurations[proj.phase] = (proj.phaseDurations[proj.phase] ?? 1) + (effect.weeks ?? 8);
        }
      }
      addNotification(`Uluslararası işbirlikleri ${effect.weeks} hafta donduruldu.`, 'warning', 5);
      break;
    }

    case 'start_collab_project': {
      EventBus.emit('projects:start_collab_suggested');
      addNotification('İşbirliği proje fırsatı açıldı — Yeni Proje modalından başlatın.', 'info', 5);
      break;
    }

    case 'pause_and_prestige': {
      // Kısa duraklama sonrası prestij
      changePrestige(effect.prestige ?? 10);
      addNotification(`+${effect.prestige} prestij kazanıldı.`, 'success', 4);
      break;
    }

    case 'loyalty_hit': {
      if (researcher) {
        researcher.LY = clamp((researcher.LY ?? 50) - (effect.loyaltyHit ?? 10), 0, 100);
      }
      break;
    }

    default:
      // Bilinmeyen effect — sessizce geç
      break;
  }
}

// ─── RAKIP NOBEL ETKİSİ ──────────────────────────────────────────────────────

/**
 * Rakip Nobel kazandığında o alandaki fonlar artar.
 * @param {string} rivalId
 * @param {string} field
 */
function handleRivalNobelEffect(rivalId, field) {
  EventBus.emit('economy:field_boost', { field, mult: 1.5, weeks: 12 });
  addNotification(
    `${FIELDS[field]?.label ?? field} alanındaki fonlar arttı — fırsatı değerlendirin.`,
    'info', 5
  );
}
