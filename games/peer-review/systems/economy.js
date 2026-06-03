/**
 * PEER REVIEW — economy.js
 * Ekonomi sistemi iş mantığı.
 * Aylık bütçe döngüsü, maaş hesabı, ekipman bakım,
 * fon yönetimi, patent geliri, ekonomi event'leri.
 * GDD v3.0 §5 Ekonomi Sistemi tam implementasyonu.
 */

'use strict';

import {
  ECONOMY,
  GRANT_DEFS,
  LAB_LEVELS,
  CAREER_BASE_SALARY,
  FIELD_SALARY_MULT,
} from '../utils/constants.js';
import {
  calcBaseFunding,
  calcResearcherSalary,
  calcGrantAcceptRate,
} from '../utils/math.js';
import {
  getState,
  changeBudget,
  addNotification,
  queueEvent,
} from '../core/state.js';
import { EventBus } from '../core/game.js';
import {
  calcTotalMaintenanceCost,
  tickEquipmentAge,
  createOwnedEquipment,
  EQUIPMENT_DEFS,
} from '../data/equipment_defs.js';

// ─── SİSTEM KAYDI ────────────────────────────────────────────────────────────

/**
 * Ekonomi sistemini EventBus'a bağlar.
 * Oyun başında bir kez çağrılır.
 */
export function registerEconomySystem() {
  EventBus.on('game:month_end', ({ state }) => {
    tickMonthlyEconomy(state);
  });

  EventBus.on('game:year_end', ({ state }) => {
    tickYearlyEconomy(state);
  });

  EventBus.on('event:resolved', ({ event, choiceId }) => {
    handleEconomyEventChoice(event, choiceId);
  });
}

// ─── AYLIK BÜTÇE DÖNGÜSÜ ─────────────────────────────────────────────────────

/**
 * Her ay sonu çalışır.
 * Gelir - Gider hesabı yapılır, bütçe güncellenir.
 * GDD v3.0 §5.1 monthlyBudgetTick formülü.
 *
 * @param {Object} state
 */
function tickMonthlyEconomy(state) {
  const income   = calcMonthlyIncome(state);
  const expenses = calcMonthlyExpenses(state);
  const delta    = income - expenses;

  changeBudget(delta);

  // Ekipman yaşlarını artır, arızalananları tespit et
  const brokenEquipment = tickEquipmentAge(state.lab.equipment);
  for (const id of brokenEquipment) {
    handleEquipmentBreakdown(id, state);
  }

  // Patent sürelerini güncelle
  tickPatents(state);

  // Hibe sürelerini güncelle
  tickGrants(state);

  // Bütçe uyarıları
  checkBudgetWarnings(state, expenses);

  EventBus.emit('economy:month_tick', { income, expenses, delta, budget: state.lab.budget });
}

// ─── GELİR HESABI ────────────────────────────────────────────────────────────

/**
 * Aylık toplam gelir.
 * GDD v3.0 §5.2 calculateMonthlyIncome formülü.
 *
 * @param {Object} state
 * @returns {number}
 */
function calcMonthlyIncome(state) {
  const base        = calcBaseFunding(state.lab.prestige);
  const grantIncome = calcActiveGrantIncome(state.lab.grants);
  const patentInc   = calcPatentIncome(state.lab.patents);
  const uniSupport  = calcUniversitySupport(state.lab.prestige);

  return base + grantIncome + patentInc + uniSupport;
}

/**
 * Devlet temel fonu — prestige'e göre artar.
 * 0 prestige → 500/ay, 1000 prestige → 3500/ay
 * (calcBaseFunding math.js'te: 500 + prestige * 3)
 */

/**
 * Aktif hibelerin aylık geliri.
 * @param {Object[]} grants
 * @returns {number}
 */
function calcActiveGrantIncome(grants) {
  return grants
    .filter(g => g.monthsLeft > 0)
    .reduce((sum, g) => sum + g.monthlyAmount, 0);
}

/**
 * Patent geliri — her patent 24 ay boyunca gelir sağlar.
 * GDD v3.0 §5.2 patentIncome formülü.
 *
 * @param {Object[]} patents
 * @returns {number}
 */
function calcPatentIncome(patents) {
  return patents
    .filter(p => p.age < ECONOMY.PATENT_INCOME_MONTHS)
    .reduce((sum, p) => sum + p.monthlyRevenue, 0);
}

/**
 * Üniversite desteği — prestige'e göre artar.
 * @param {number} prestige
 * @returns {number}
 */
function calcUniversitySupport(prestige) {
  // Prestige 0'da 0, 500'de 500, 1000'de 1500
  return Math.round(prestige * 1.5);
}

// ─── GİDER HESABI ────────────────────────────────────────────────────────────

/**
 * Aylık toplam gider.
 * GDD v3.0 §5.3 calculateMonthlyExpenses formülü.
 *
 * @param {Object} state
 * @returns {number}
 */
function calcMonthlyExpenses(state) {
  const salaries   = calcTotalSalaryExpense(state.researchers);
  const equipment  = calcTotalMaintenanceCost(state.lab.equipment);
  const facility   = LAB_LEVELS[state.lab.level]?.facilityExpense ?? 200;
  const pubCosts   = calcPublicationExpenses(state.lab.publications, state.time.year);

  return salaries + equipment + facility + pubCosts;
}

/**
 * Tüm araştırmacıların aylık maaş toplamı.
 * @param {Object[]} researchers
 * @returns {number}
 */
function calcTotalSalaryExpense(researchers) {
  return researchers.reduce((sum, r) => {
    return sum + calcResearcherSalary(r, CAREER_BASE_SALARY, FIELD_SALARY_MULT);
  }, 0);
}

/**
 * Yayın ücretleri — son 3 ayda kabul edilen makaleler için open access ücreti.
 * @param {Object[]} publications
 * @param {number}   currentYear
 * @returns {number}
 */
function calcPublicationExpenses(publications, currentYear) {
  // Yüksek IF dergiler daha pahalı
  return publications
    .filter(p => p.year === currentYear && !p.retracted)
    .reduce((sum, p) => {
      const fee = p.impactFactor >= 40 ? 500
                : p.impactFactor >= 15 ? 300
                : p.impactFactor >= 5  ? 150
                : 50;
      return sum + fee;
    }, 0);
}

// ─── PATENT YÖNETİMİ ─────────────────────────────────────────────────────────

/**
 * Patentlerin yaşını artırır, süresi dolanlara bildirim gönderir.
 * @param {Object} state
 */
function tickPatents(state) {
  for (const patent of state.lab.patents) {
    patent.age = (patent.age ?? 0) + 1;
    if (patent.age === ECONOMY.PATENT_INCOME_MONTHS) {
      addNotification(
        `"${patent.label}" patentinin gelir süresi doldu.`,
        'info', 4
      );
    }
  }
}

/**
 * Yeni patent oluşturur (applied araştırma tamamlandığında çağrılır).
 *
 * @param {Object} project
 * @param {number} currentYear
 * @returns {Object}  patent nesnesi
 */
export function createPatent(project, currentYear) {
  // Proje kalitesi ve tipine göre aylık gelir hesabı
  const quality        = project.phaseQualities
    ? Object.values(project.phaseQualities).reduce((s, q) => s + q, 0) /
      Object.values(project.phaseQualities).length
    : 50;
  const monthlyRevenue = Math.round(quality * 10 + Math.random() * 500);

  return {
    id:            `pat_${Date.now()}`,
    projectId:     project.id,
    label:         project.label,
    field:         project.field,
    monthlyRevenue,
    age:           0,
    maxAge:        ECONOMY.PATENT_INCOME_MONTHS,
    year:          currentYear,
  };
}

// ─── HİBE YÖNETİMİ ───────────────────────────────────────────────────────────

/**
 * Aktif hibelerin kalan sürelerini azaltır.
 * @param {Object} state
 */
function tickGrants(state) {
  for (const grant of state.lab.grants) {
    if (grant.monthsLeft > 0) {
      grant.monthsLeft--;
      if (grant.monthsLeft === 0) {
        addNotification(
          `"${grant.label}" hibesi sona erdi.`,
          'info', 4
        );
        EventBus.emit('economy:grant_expired', { grant });
      }
    }
  }
  // Süresi dolmuş hibeleri temizle
  state.lab.grants = state.lab.grants.filter(g => g.monthsLeft > 0);
}

/**
 * Hibe başvurusu yapar — event kuyruğuna ekler.
 * Sonuç N hafta sonra event olarak gelir.
 *
 * @param {string} grantId   — GRANT_DEFS key'i
 * @param {Object} state
 */
export function applyForGrant(grantId, state) {
  const grantDef = GRANT_DEFS[grantId];
  if (!grantDef) return;

  // Aynı hibe için bekleyen başvuru var mı?
  const alreadyApplied = state.events.pending.some(
    e => e.id.startsWith(`grant_result_${grantId}`)
  );
  if (alreadyApplied) {
    addNotification(`"${grantDef.label}" için zaten başvuru yapıldı.`, 'warning', 3);
    return;
  }

  // Başvuru maliyeti (küçük işlem ücreti)
  const applicationFee = 50;
  if (state.lab.budget < applicationFee) {
    addNotification('Hibe başvurusu için yeterli bütçe yok.', 'warning', 3);
    return;
  }
  changeBudget(-applicationFee);

  // Kabul oranı hesabı
  const acceptRate = calcGrantAcceptRate(
    state.lab.prestige,
    1.0,                              // fieldMatch: basitleştirilmiş, Hafta 6'da geliştirilir
    state.lab.acceptedGrantsCount,
    grantDef.baseAcceptRate
  );

  // N hafta sonra sonuç event'i
  const resultWeek = state.time.totalWeeks + grantDef.applicationWeeks * 4;

  queueEvent({
    id:          `grant_result_${grantId}_${state.time.totalWeeks}`,
    category:    'institution',
    label:       'Hibe Başvurusu Sonucu',
    description: Math.random() < acceptRate
      ? `"${grantDef.label}" başvurunuz kabul edildi! Aylık ${randomInRange(grantDef.amountRange)} destek alacaksınız.`
      : `"${grantDef.label}" başvurunuz reddedildi.`,
    grantId,
    accepted:    Math.random() < acceptRate,
    amountRange: grantDef.amountRange,
    duration:    grantDef.durationMonths,
    choices: [{
      id:    'acknowledge',
      label: 'Tamam',
      effect: { type: 'grant_result', grantId },
    }],
  });

  addNotification(`"${grantDef.label}" başvurusu yapıldı.`, 'info', 3);
}

// ─── EKİPMAN SATIN ALMA ───────────────────────────────────────────────────────

/**
 * Ekipman satın alır.
 * Bütçe kontrolü yapar, state'e ekler.
 *
 * @param {string} equipmentId
 * @returns {boolean}  başarılı mı
 */
export function purchaseEquipment(equipmentId) {
  const state = getState();
  const def   = EQUIPMENT_DEFS[equipmentId];
  if (!def) return false;

  if (state.lab.budget < def.cost) {
    addNotification(`"${def.label}" için bütçe yetersiz.`, 'warning', 3);
    return false;
  }

  // Zaten sahip mi?
  if (state.lab.equipment.some(e => e.id === equipmentId)) {
    addNotification(`"${def.label}" zaten mevcut.`, 'warning', 3);
    return false;
  }

  changeBudget(-def.cost);
  state.lab.equipment.push(createOwnedEquipment(equipmentId));

  EventBus.emit('economy:equipment_purchased', { equipmentId, def });
  addNotification(`"${def.label}" satın alındı.`, 'success', 4);
  return true;
}

// ─── EKİPMAN ARIZASI ─────────────────────────────────────────────────────────

/**
 * Arızalanan ekipmanı işler.
 * Onarım event'i kuyruğa eklenir.
 *
 * @param {string} equipmentId
 * @param {Object} state
 */
function handleEquipmentBreakdown(equipmentId, state) {
  const def = EQUIPMENT_DEFS[equipmentId];
  if (!def) return;

  const repairCost = Math.round(def.cost * 0.3);

  queueEvent({
    id:          `equip_breakdown_${equipmentId}_${state.time.totalWeeks}`,
    category:    'institution',
    label:       'Ekipman Arızası',
    description: `"${def.label}" ömrünü tamamladı ve arıza yaptı. Ne yapılsın?`,
    equipmentId,
    choices: [
      {
        id:    'repair',
        label: `Onar (${repairCost.toLocaleString()})`,
        description: 'Ekipman eski verimliliğine döner, ömrü uzar.',
        effect: { type: 'repair_equipment', equipmentId, cost: repairCost },
      },
      {
        id:    'replace',
        label: `Yeni Al (${def.cost.toLocaleString()})`,
        description: 'Sıfırdan yeni ekipman, tam verimlilik.',
        effect: { type: 'replace_equipment', equipmentId, cost: def.cost },
      },
      {
        id:    'remove',
        label: 'Kaldır',
        description: 'Ekipman kullanımdan çıkar, bonus kaybolur.',
        effect: { type: 'remove_equipment', equipmentId },
      },
    ],
  });

  addNotification(`"${def.label}" arıza yaptı! Karar gerekiyor.`, 'danger', 6);
}

// ─── YILLIK EKONOMİ ───────────────────────────────────────────────────────────

/**
 * Yıl sonu ekonomi özeti.
 * @param {Object} state
 */
function tickYearlyEconomy(state) {
  const income   = calcMonthlyIncome(state) * 12;   // yaklaşık yıllık
  const expenses = calcMonthlyExpenses(state) * 12;

  EventBus.emit('economy:year_summary', {
    year:     state.time.year,
    income,
    expenses,
    balance:  income - expenses,
    budget:   state.lab.budget,
    prestige: state.lab.prestige,
  });
}

// ─── BÜTÇE UYARILARI ─────────────────────────────────────────────────────────

/**
 * Bütçe kritik seviyelerde uyarı ve event üretir.
 *
 * @param {Object} state
 * @param {number} monthlyExpenses
 */
function checkBudgetWarnings(state, monthlyExpenses) {
  const budget = state.lab.budget;

  // Kritik: 2 aylık gideri karşılayamıyor
  if (budget < 0) {
    EventBus.emit('budget:bankrupt', { budget });
    addNotification('Bütçe sıfırın altına düştü! Acil önlem gerekiyor.', 'danger', 0);
    return;
  }

  if (budget < monthlyExpenses * 2) {
    EventBus.emit('budget:critical', { budget, monthlyExpenses });
    addNotification(
      `Bütçe kritik seviyede: ${budget.toLocaleString()}. Giderler: ${monthlyExpenses.toLocaleString()}/ay`,
      'danger', 6
    );
    return;
  }

  if (budget < monthlyExpenses * 4) {
    EventBus.emit('budget:low', { budget });
    addNotification(
      `Bütçe düşük: ${budget.toLocaleString()}. Yaklaşık ${Math.floor(budget / monthlyExpenses)} ay yeterli.`,
      'warning', 5
    );
  }
}

// ─── EVENT KARARLARINI UYGULA ─────────────────────────────────────────────────

/**
 * Ekonomi event kararlarını uygular.
 *
 * @param {Object} event
 * @param {string} choiceId
 */
function handleEconomyEventChoice(event, choiceId) {
  const state  = getState();
  const choice = event.choices?.find(c => c.id === choiceId);
  if (!choice?.effect) return;

  const effectType = choice.effect.type;

  // ── Hibe sonucu ─────────────────────────────────────────────────────────
  if (effectType === 'grant_result') {
    if (event.accepted) {
      const amount = randomInRange(event.amountRange);
      const grant  = {
        id:            `grant_${event.grantId}_${state.time.totalWeeks}`,
        label:         GRANT_DEFS[event.grantId]?.label ?? event.grantId,
        monthlyAmount: amount,
        monthsLeft:    event.duration,
      };
      state.lab.grants.push(grant);
      state.lab.acceptedGrantsCount = (state.lab.acceptedGrantsCount ?? 0) + 1;
      addNotification(
        `Hibe aktif: ${grant.label} — ${amount.toLocaleString()}/ay, ${event.duration} ay`,
        'success', 6
      );
      EventBus.emit('economy:grant_accepted', { grant });
    }
    return;
  }

  // ── Ekipman onarım / değiştirme ─────────────────────────────────────────
  if (effectType === 'repair_equipment') {
    const { equipmentId, cost } = choice.effect;
    if (state.lab.budget < cost) {
      addNotification('Onarım için bütçe yetersiz.', 'warning', 3);
      return;
    }
    changeBudget(-cost);
    const owned = state.lab.equipment.find(e => e.id === equipmentId);
    if (owned) {
      owned.age = Math.floor(owned.age * 0.4);  // yaşı %40'a düşür
    }
    addNotification(`"${EQUIPMENT_DEFS[equipmentId]?.label}" onarıldı.`, 'success', 4);
    return;
  }

  if (effectType === 'replace_equipment') {
    const { equipmentId, cost } = choice.effect;
    if (state.lab.budget < cost) {
      addNotification('Yenileme için bütçe yetersiz.', 'warning', 3);
      return;
    }
    changeBudget(-cost);
    // Eskisini kaldır, yenisini ekle
    state.lab.equipment = state.lab.equipment.filter(e => e.id !== equipmentId);
    state.lab.equipment.push(createOwnedEquipment(equipmentId));
    addNotification(`"${EQUIPMENT_DEFS[equipmentId]?.label}" yenilendi.`, 'success', 4);
    return;
  }

  if (effectType === 'remove_equipment') {
    const { equipmentId } = choice.effect;
    state.lab.equipment = state.lab.equipment.filter(e => e.id !== equipmentId);
    addNotification(`"${EQUIPMENT_DEFS[equipmentId]?.label}" kullanımdan kaldırıldı.`, 'info', 4);
    return;
  }

  // ── Bütçe krizi kararları ────────────────────────────────────────────────
  if (effectType === 'emergency_cut') {
    // Araştırmacı saatlerini azalt
    for (const r of state.researchers) {
      r.hoursPerWeek = Math.max(30, r.hoursPerWeek - 8);
    }
    addNotification('Acil tasarruf: çalışma saatleri azaltıldı.', 'warning', 5);
    return;
  }

  if (effectType === 'sell_equipment') {
    const { equipmentId } = choice.effect;
    const def = EQUIPMENT_DEFS[equipmentId];
    if (!def) return;
    const salePrice = Math.round(def.cost * 0.4);
    state.lab.equipment = state.lab.equipment.filter(e => e.id !== equipmentId);
    changeBudget(salePrice);
    addNotification(
      `"${def.label}" satıldı: +${salePrice.toLocaleString()}`,
      'info', 4
    );
    return;
  }
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

/**
 * Mevcut ayın gelir/gider özetini döner.
 * UI'da bütçe paneli için kullanılır.
 *
 * @returns {{
 *   income:   { base, grants, patents, university, total },
 *   expenses: { salaries, equipment, facility, publications, total },
 *   delta:    number,
 *   runway:   number   (kaç ay dayanır)
 * }}
 */
export function getBudgetSummary() {
  const state = getState();

  const base       = calcBaseFunding(state.lab.prestige);
  const grants     = calcActiveGrantIncome(state.lab.grants);
  const patents    = calcPatentIncome(state.lab.patents);
  const university = calcUniversitySupport(state.lab.prestige);
  const totalInc   = base + grants + patents + university;

  const salaries    = calcTotalSalaryExpense(state.researchers);
  const equipment   = calcTotalMaintenanceCost(state.lab.equipment);
  const facility    = LAB_LEVELS[state.lab.level]?.facilityExpense ?? 200;
  const pubCosts    = calcPublicationExpenses(state.lab.publications, state.time.year);
  const totalExp    = salaries + equipment + facility + pubCosts;

  const delta  = totalInc - totalExp;
  const runway = totalExp > 0
    ? Math.floor(state.lab.budget / totalExp)
    : 999;

  return {
    income: {
      base, grants, patents, university,
      total: totalInc,
    },
    expenses: {
      salaries, equipment, facility, publications: pubCosts,
      total: totalExp,
    },
    delta,
    runway,
  };
}

/**
 * Mevcut hibe başvuru seçeneklerini döner.
 * UI'da hibe paneli için kullanılır.
 *
 * @returns {Array<{ id, def, acceptRate, alreadyApplied }>}
 */
export function getGrantOptions() {
  const state = getState();

  return Object.entries(GRANT_DEFS).map(([id, def]) => {
    const alreadyApplied = state.events.pending.some(
      e => e.id.startsWith(`grant_result_${id}`)
    );
    const alreadyActive = state.lab.grants.some(
      g => g.id.includes(id)
    );
    const acceptRate = calcGrantAcceptRate(
      state.lab.prestige,
      1.0,
      state.lab.acceptedGrantsCount ?? 0,
      def.baseAcceptRate
    );

    return {
      id,
      def,
      acceptRate: Math.round(acceptRate * 100),
      alreadyApplied,
      alreadyActive,
    };
  });
}

// ─── İÇ YARDIMCILAR ──────────────────────────────────────────────────────────

/**
 * [min, max] aralığından rastgele tam sayı döner.
 * @param {number[]} range  — [min, max]
 * @returns {number}
 */
function randomInRange([min, max]) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
