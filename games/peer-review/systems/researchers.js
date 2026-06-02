/**
 * PEER REVIEW — researchers.js
 * Araştırmacı sistemi — haftalık tick, moral hesabı,
 * XP/gelişim, burnout yönetimi, transfer dönemi.
 * GDD v3.0 §3 Araştırmacı Sistemi tam implementasyonu.
 */

'use strict';

import {
  MORALE, XP, CAREER_STAGES, PERSONALITY_TYPES,
  PHASE_SKILLS, EVENTS, BALANCE,
} from '../utils/constants.js';
import {
  clamp, chance, randInt, mean,
  calcBaseSkill, calcTeamBonus, calcMoraleModifier,
  calcWorkloadEffect, getCareerStage, getSeniorityXpMult,
} from '../utils/math.js';
import {
  getState, updateResearcher, removeResearcher,
  addNotification, queueEvent,
} from '../core/state.js';
import { EventBus } from '../core/game.js';

// ─── SİSTEM KAYDI ────────────────────────────────────────────────────────────

/**
 * Araştırmacı sistemini EventBus'a bağlar.
 * game.js'in emit ettiği 'systems:tick' event'ini dinler.
 * Oyun başlarken bir kez çağrılır.
 */
export function registerResearcherSystem() {
  EventBus.on('systems:tick', ({ state }) => {
    tickAllResearchers(state);
  });

  EventBus.on('researchers:transfer_period', ({ state }) => {
    runTransferPeriod(state);
  });

  EventBus.on('event:resolved', ({ event, choiceId }) => {
    handleResearcherEventChoice(event, choiceId);
  });
}

// ─── HAFTALIK TICK ────────────────────────────────────────────────────────────

/**
 * Tüm araştırmacıları haftalık günceller.
 * Sıra önemli: önce izin/burnout → sonra moral → sonra XP → sonra gelişim.
 *
 * @param {Object} state
 */
function tickAllResearchers(state) {
  for (const researcher of state.researchers) {
    // İzindeyse sayacı azalt, tick'i atla
    if (researcher.isOnLeave) {
      tickLeave(researcher);
      continue;
    }

    // Burnout tick'i ayrı
    if (researcher.isBurnout) {
      tickBurnout(researcher, state);
      continue;
    }

    // Normal haftalık tick
    tickMorale(researcher, state);
    checkBurnoutEntry(researcher);
  }
}

// ─── MORAL SİSTEMİ ───────────────────────────────────────────────────────────

/**
 * Araştırmacının haftalık moral değişimi.
 * GDD v3 §3.4 formülü.
 *
 * @param {Object} researcher
 * @param {Object} state
 */
function tickMorale(researcher, state) {
  let delta = 0;

  // 1. İş yükü etkisi
  delta += calcWorkloadEffect(researcher.hoursPerWeek);

  // 2. Maaş etkisi — piyasa oranına göre
  delta += calcSalaryEffect(researcher, state);

  // 3. Ekip etkisi — aynı projedeki araştırmacılar
  delta += calcTeamMoraleEffect(researcher, state);

  // 4. Hırs katkısı (AM yüksekse biraz daha dayanır)
  const ambitionBuffer = (researcher.AM - 50) * 0.02;  // -1 ile +1 arası
  delta += ambitionBuffer;

  // 5. Dayanıklılık tamponu (RS yüksekse moral daha yavaş düşer)
  if (delta < 0) {
    const resilience = researcher.RS / 100;
    delta *= (1 - resilience * 0.4);  // RS:100 ise negatif etkiyi %40 azaltır
  }

  researcher.morale = clamp(
    Math.round(researcher.morale + delta),
    MORALE.MIN,
    MORALE.MAX
  );
}

/**
 * Maaş tatminsizliğinin moral etkisi.
 * Piyasa oranının altındaysa morale düşer.
 */
function calcSalaryEffect(researcher, state) {
  // Basit piyasa oranı: aynı kariyer evresindeki araştırmacıların ortalama maaşı
  const peers = state.researchers.filter(
    r => r.id !== researcher.id && r.careerStage === researcher.careerStage
  );
  const marketRate = peers.length > 0
    ? mean(peers.map(r => r.salary))
    : getDefaultMarketRate(researcher.careerStage);

  const ratio = researcher.salary / marketRate;
  if (ratio >= 1.2) return 3;     // iyi maaş: +3
  if (ratio >= 1.0) return 1;     // adil maaş: +1
  if (ratio >= 0.8) return -1;    // düşük maaş: -1
  return -4;                       // çok düşük: -4
}

/**
 * Ekip dinamiğinin moral etkisi.
 */
function calcTeamMoraleEffect(researcher, state) {
  if (!researcher.assignedProjectId) return 0;

  const project = state.projects.active.find(p => p.id === researcher.assignedProjectId);
  if (!project) return 0;

  const teammates = state.researchers.filter(
    r => r.id !== researcher.id && project.teamIds.includes(r.id)
  );
  if (teammates.length === 0) return 0;

  const avgTeamwork = mean(teammates.map(r => r.TW));
  const effect = (avgTeamwork - 50) * 0.04;  // -2 ile +2 arası

  // Lider varsa ekip morali bonusu
  const hasLeader = teammates.some(r => r.personality === 'LED');
  return effect + (hasLeader ? 1.5 : 0);
}

// ─── BURNOUT ─────────────────────────────────────────────────────────────────

/**
 * Burnout başlangıç kontrolü.
 * morale < 20 → burnout flag'i set et.
 */
function checkBurnoutEntry(researcher) {
  if (researcher.morale < MORALE.BURNOUT_THRESHOLD && !researcher.isBurnout) {
    researcher.isBurnout = true;
    EventBus.emit('researcher:burnout', { researcher });
    addNotification(
      `${researcher.name} tükenmişlik yaşıyor.`,
      'warning'
    );
  }
}

/**
 * Burnout'taki araştırmacının haftalık tick'i.
 * %40 ihtimalle izin talebi event'i üretilir.
 */
function tickBurnout(researcher, state) {
  // Burnout'ta moral daha da düşebilir
  researcher.morale = clamp(researcher.morale - 2, 0, MORALE.BURNOUT_THRESHOLD);

  // İzin talebi event'i
  if (chance(EVENTS.BURNOUT_LEAVE_CHANCE)) {
    const eventId = `burnout_leave_${researcher.id}_${state.time.totalWeeks}`;

    // Aynı event zaten pending'deyse tekrar ekleme
    const alreadyPending = state.events.pending.some(e => e.id === eventId);
    if (!alreadyPending) {
      queueEvent({
        id: eventId,
        category: 'personal',
        label: 'Tükenmişlik İzin Talebi',
        description: `${researcher.name} ciddi tükenmişlik yaşıyor ve dinlenme izni talep ediyor. Reddetmeniz durumunda kurumu terk edebilir.`,
        researcherId: researcher.id,
        choices: [
          {
            id: 'grant_leave',
            label: '4 Hafta İzin Ver',
            description: 'Araştırmacı dinlenecek, moral toparlanacak.',
            effect: { type: 'leave', weeks: 4, moraleBoost: 30 },
          },
          {
            id: 'grant_short_leave',
            label: '2 Hafta İzin Ver',
            description: 'Kısa mola, risk devam eder.',
            effect: { type: 'leave', weeks: 2, moraleBoost: 15 },
          },
          {
            id: 'deny_leave',
            label: 'İzin Verme',
            description: `Sadakat düşükse (LY < 50) ${researcher.name} istifa edebilir.`,
            effect: { type: 'deny_leave' },
          },
        ],
      });
    }
  }
}

/**
 * İzindeki araştırmacının sayacını azaltır.
 * İzin bitince burnout'tan çıkar.
 */
function tickLeave(researcher) {
  researcher.leaveWeeksLeft--;
  if (researcher.leaveWeeksLeft <= 0) {
    researcher.isOnLeave    = false;
    researcher.leaveWeeksLeft = 0;
    researcher.isBurnout    = false;
    addNotification(`${researcher.name} izinden döndü.`, 'info', 3);
    EventBus.emit('researcher:returned', { researcher });
  }
}

// ─── GELİŞİM SİSTEMİ ─────────────────────────────────────────────────────────

/**
 * Proje aşaması tamamlandığında XP ve stat artışı hesaplar.
 * GDD v3 §3.5 formülü.
 *
 * @param {Object} researcher
 * @param {string} phase       — tamamlanan faz
 * @param {number} quality     — faz kalitesi (0-100)
 * @param {Object} PHASE_BASE_XP
 */
export function awardPhaseXP(researcher, phase, quality, PHASE_BASE_XP) {
  const baseXP      = PHASE_BASE_XP[phase] ?? 20;
  const qualityMult = quality / 100;
  const seniorMult  = getSeniorityXpMult(researcher.yearsExp);
  const xpGained    = Math.round(baseXP * qualityMult * seniorMult);

  researcher.xp += xpGained;

  // Her 100 XP'de dominant stat +1
  const levelsGained = Math.floor(researcher.xp / XP.PER_LEVEL);
  if (levelsGained > 0) {
    researcher.xp = researcher.xp % XP.PER_LEVEL;
    applyStatIncrease(researcher, phase, levelsGained);
  }

  return xpGained;
}

/**
 * Proje tamamlandığında Breakthrough şansı kontrolü.
 * %2 ihtimalle dominant stat +5.
 *
 * @param {Object} researcher
 * @param {string} phase
 */
export function checkBreakthrough(researcher, phase) {
  // Sadece Dahî ve Mükemmeliyetçi'de Breakthrough şansı yüksek
  let breakthroughChance = XP.BREAKTHROUGH_CHANCE;
  if (researcher.personality === 'GEN') breakthroughChance *= 3;
  if (researcher.personality === 'PER') breakthroughChance *= 1.5;

  if (chance(breakthroughChance)) {
    applyStatIncrease(researcher, phase, 1, XP.BREAKTHROUGH_AMOUNT);
    EventBus.emit('researcher:breakthrough', { researcher, phase });
    addNotification(
      `${researcher.name} önemli bir ilerleme kaydetti! (+${XP.BREAKTHROUGH_AMOUNT} stat)`,
      'success'
    );
    return true;
  }
  return false;
}

/**
 * Stat artışını uygular.
 * Dominant faz statını artırır.
 *
 * @param {Object} researcher
 * @param {string} phase
 * @param {number} levels      — kaç level atlandı
 * @param {number} [amount=1]  — her level başına artış miktarı
 */
function applyStatIncrease(researcher, phase, levels, amount = 1) {
  const phaseSkills = PHASE_SKILLS[phase];
  if (!phaseSkills || phaseSkills.length === 0) return;

  // En yüksek ağırlıklı stat artar
  const dominant = phaseSkills.reduce((a, b) => a.w >= b.w ? a : b);
  const statId   = dominant.id;

  const oldVal = researcher[statId];
  researcher[statId] = clamp(oldVal + levels * amount, 0, XP.STAT_MAX);

  // Kariyer yılı güncelle (gelişim zamanla gelir)
  researcher.yearsExp += 0.02 * levels;  // yaklaşık

  // Kariyer evresi yükseldiyse güncelle
  const newStage = getCareerStage(Math.floor(researcher.yearsExp));
  if (newStage !== researcher.careerStage) {
    researcher.careerStage = newStage;
    addNotification(
      `${researcher.name} ${CAREER_STAGES[newStage].label} seviyesine yükseldi!`,
      'success'
    );
    EventBus.emit('researcher:promoted', { researcher, newStage });
  }
}

// ─── ÜRETİM HESABI ───────────────────────────────────────────────────────────

/**
 * Araştırmacının belirli bir faz için haftalık üretim katkısı.
 * GDD v3 §3.3 weeklyOutput formülü.
 *
 * @param {Object} researcher
 * @param {string} phase
 * @param {Object[]} team         — aynı projedeki diğer araştırmacılar
 * @param {Object}  labEquipment  — lab'ın ekipman listesi
 * @param {number}  labPrestige
 * @returns {number}  0-100+ arası ham üretim değeri
 */
export function calcWeeklyOutput(researcher, phase, team, labEquipment, labPrestige) {
  if (researcher.isOnLeave || researcher.isBurnout) {
    return researcher.isBurnout
      ? calcMoraleModifier(researcher.morale) * 20  // burnout'ta minimum
      : 0;
  }

  const phaseSkillDef = PHASE_SKILLS[phase] ?? PHASE_SKILLS.analysis;

  const base      = calcBaseSkill(researcher, phaseSkillDef);
  const teamMult  = calcTeamBonus(researcher, team);
  const moralMult = calcMoraleModifier(researcher.morale);
  const equipMult = calcEquipmentBonusForPhase(labEquipment, phase, researcher.field);
  const prestMult = calcPrestigeModifier(labPrestige);

  return base * teamMult * moralMult * equipMult * prestMult;
}

/**
 * Ekipmanın belirli faz ve alan için bonusu.
 * @param {Object[]} labEquipment  — { id, age }
 * @param {string}   phase
 * @param {string}   field
 * @returns {number}  1.0 - 1.8 arası
 */
function calcEquipmentBonusForPhase(labEquipment, phase, field) {
  // equipment_defs.js henüz yüklü değil — dinamik import yerine
  // EventBus üzerinden economy.js'ten alınır (Hafta 4).
  // Şimdilik varsayılan 1.0 döner.
  return 1.0;
}

/**
 * Lab prestijinin üretim çarpanı.
 * Prestij 0'da: 0.85, 500'de: 1.0, 1000'de: 1.15
 *
 * @param {number} prestige  0-1000
 * @returns {number}
 */
function calcPrestigeModifier(prestige) {
  return 0.85 + (prestige / 1000) * 0.30;
}

// ─── TRANSFER DÖNEMİ ─────────────────────────────────────────────────────────

/**
 * Ocak ayında rakipler araştırmacı teklifleri yapar.
 * GDD v3 §6.4 Araştırmacı Transfer Sistemi.
 *
 * @param {Object} state
 */
function runTransferPeriod(state) {
  for (const researcher of state.researchers) {
    // Sadece %30 ihtimalle rakip ilgi gösterir
    if (!chance(0.30)) continue;

    // Kariyer araştırmacısı her zaman teklif alır
    const alwaysTarget = researcher.personality === 'CAR';
    if (!alwaysTarget && !chance(0.3)) continue;

    const stayScore  = calcStayScore(researcher, state.lab);
    const leaveScore = calcLeaveScore(researcher, state.lab.prestige);

    if (leaveScore > stayScore) {
      const offerSalary = Math.round(researcher.salary * (1.2 + Math.random() * 0.4));

      queueEvent({
        id:            `transfer_${researcher.id}_${state.time.year}`,
        category:      'personal',
        label:         'Rakip Kurum Teklifi',
        description:   `${researcher.name}, rakip bir kurumdan ${offerSalary.toLocaleString()} maaş teklifi aldı. Mevcut maaşın ${((offerSalary / researcher.salary - 1) * 100).toFixed(0)}% üzerinde.`,
        researcherId:  researcher.id,
        offerSalary,
        choices: [
          {
            id: 'match_offer',
            label: `Maaşı ${offerSalary.toLocaleString()}'ye Çıkar`,
            description: 'Araştırmacı kalır, bütçe yüklenir.',
            effect: { type: 'raise', salary: offerSalary },
          },
          {
            id: 'counter_offer',
            label: 'Daha Düşük Zam Teklif Et',
            description: 'Araştırmacı kabul edebilir veya gidebilir — LY belirleyici.',
            effect: { type: 'counter', salary: Math.round(researcher.salary * 1.1) },
          },
          {
            id: 'let_go',
            label: 'Gitmesine İzin Ver',
            description: 'Araştırmacıyı kaybedersiniz.',
            effect: { type: 'leave' },
          },
        ],
      });
    }
  }
}

/**
 * Araştırmacının kalma skoru.
 * GDD v3 §6.4 computeStayScore formülü.
 */
function calcStayScore(researcher, lab) {
  const marketRate    = getDefaultMarketRate(researcher.careerStage);
  const salaryRatio   = researcher.salary / marketRate;
  const mentorBonus   = hasMentorRelation(researcher, lab) ? 15 : 0;

  return (
    researcher.LY   * 0.40
    + researcher.morale * 0.30
    + mentorBonus   * 0.20
    + (salaryRatio * 50) * 0.10
  );
}

/**
 * Araştırmacının gitme skoru.
 * Prestige düşükse rakip daha cazip görünür.
 */
function calcLeaveScore(researcher, labPrestige) {
  const baseDesire = 100 - researcher.LY;
  const prestigeFactor = Math.max(0, 50 - labPrestige * 0.05);
  const careerFactor   = researcher.personality === 'CAR' ? 20 : 0;
  return baseDesire * 0.5 + prestigeFactor + careerFactor;
}

/**
 * Araştırmacının labda mentörü var mı?
 */
function hasMentorRelation(researcher, lab) {
  // state.researchers içinde MNT kişiliğinde biri varsa mentör var sayılır
  // (Gerçek implementasyon Hafta 2 event sistemiyle genişler)
  return false;
}

// ─── EVENT KARARLARINI UYGULA ─────────────────────────────────────────────────

/**
 * Araştırmacı event'inin seçilen kararını uygular.
 *
 * @param {Object} event
 * @param {string} choiceId
 */
function handleResearcherEventChoice(event, choiceId) {
  const state = getState();

  // Burnout izin kararı
  if (event.id.startsWith('burnout_leave_')) {
    const researcher = state.researchers.find(r => r.id === event.researcherId);
    if (!researcher) return;

    const choice = event.choices.find(c => c.id === choiceId);
    if (!choice) return;

    if (choice.effect.type === 'leave') {
      researcher.isOnLeave      = true;
      researcher.leaveWeeksLeft = choice.effect.weeks;
      researcher.morale = clamp(researcher.morale + choice.effect.moraleBoost, 0, 100);
      addNotification(`${researcher.name} izne ayrıldı.`, 'info', 4);
    } else if (choice.effect.type === 'deny_leave') {
      // LY < 50 ise istifa riski
      if (researcher.LY < 50 && chance(0.6)) {
        EventBus.emit('researcher:leaving', { researcher });
        removeResearcher(researcher.id);
        addNotification(`${researcher.name} istifa etti.`, 'danger', 6);
      } else {
        researcher.morale = clamp(researcher.morale - 10, 0, 100);
        addNotification(`${researcher.name} devam ediyor ama morali bozuldu.`, 'warning', 4);
      }
    }
  }

  // Transfer teklifi kararı
  if (event.id.startsWith('transfer_')) {
    const researcher = state.researchers.find(r => r.id === event.researcherId);
    if (!researcher) return;

    const choice = event.choices.find(c => c.id === choiceId);
    if (!choice) return;

    if (choice.effect.type === 'raise') {
      researcher.salary = choice.effect.salary;
      researcher.morale = clamp(researcher.morale + 10, 0, 100);
      addNotification(`${researcher.name} maaş zammıyla kaldı.`, 'success', 4);
    } else if (choice.effect.type === 'counter') {
      researcher.salary = choice.effect.salary;
      // LY yüksekse kabul eder
      if (researcher.LY >= 50 || chance(0.4)) {
        addNotification(`${researcher.name} karşı teklifi kabul etti.`, 'success', 4);
      } else {
        EventBus.emit('researcher:leaving', { researcher });
        removeResearcher(researcher.id);
        addNotification(`${researcher.name} teklifi reddedip gitti.`, 'danger', 6);
      }
    } else if (choice.effect.type === 'leave') {
      EventBus.emit('researcher:left', { researcher });
      removeResearcher(researcher.id);
      addNotification(`${researcher.name} kurumdan ayrıldı.`, 'danger', 6);
    }
  }
}

// ─── YARDIMCILAR ─────────────────────────────────────────────────────────────

/**
 * Kariyer evresine göre varsayılan piyasa maaşı.
 */
function getDefaultMarketRate(stage) {
  const rates = { junior: 900, mid: 1600, senior: 3000, emeritus: 500 };
  return rates[stage] ?? 1000;
}
