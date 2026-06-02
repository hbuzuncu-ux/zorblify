/**
 * PEER REVIEW — math.js
 * Saf matematik yardımcıları. Hiçbir oyun state'ine bağımlılık yok.
 * Tüm fonksiyonlar pure function — aynı girdi her zaman aynı çıktı.
 */

'use strict';

// ─── TEMEL ───────────────────────────────────────────────────────────────────

/**
 * Değeri [min, max] aralığına sıkıştırır.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * İki sayı arasında rastgele tam sayı döner (dahil).
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * İki sayı arasında rastgele ondalık döner.
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function randFloat(min, max) {
  return Math.random() * (max - min) + min;
}

/**
 * Bir dizinin aritmetik ortalaması.
 * Boş dizi için 0 döner.
 * @param {number[]} arr
 * @returns {number}
 */
export function mean(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((sum, v) => sum + v, 0) / arr.length;
}

/**
 * Bir dizinin maksimum değeri.
 * Boş dizi için 0 döner.
 * @param {number[]} arr
 * @returns {number}
 */
export function max(arr) {
  if (arr.length === 0) return 0;
  return Math.max(...arr);
}

/**
 * Bir dizinin minimum değeri.
 * Boş dizi için 0 döner.
 * @param {number[]} arr
 * @returns {number}
 */
export function min(arr) {
  if (arr.length === 0) return 0;
  return Math.min(...arr);
}

// ─── AĞIRLIKLI RASGELELİK ────────────────────────────────────────────────────

/**
 * Ağırlıklı rastgele seçim — nesne veya dizi destekler.
 *
 * Nesne kullanımı (key döner):
 *   weightedRandom({ world: 0.15, institution: 0.20, research: 0.35, personal: 0.30 })
 *   → 'research'
 *
 * Dizi kullanımı (eleman döner, her elemanın .weight alanı olmalı):
 *   weightedRandom([{ id: 'a', weight: 2 }, { id: 'b', weight: 1 }])
 *   → { id: 'a', weight: 2 }  (%66 ihtimalle)
 *
 * @param {Object|Array} options
 * @returns {string|any}
 */
export function weightedRandom(options) {
  // Dizi formatı
  if (Array.isArray(options)) {
    const total = options.reduce((sum, item) => sum + (item.weight ?? 1), 0);
    let r = Math.random() * total;
    for (const item of options) {
      r -= (item.weight ?? 1);
      if (r <= 0) return item;
    }
    return options[options.length - 1];
  }

  // Nesne formatı { key: weight }
  const entries = Object.entries(options);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = Math.random() * total;
  for (const [key, weight] of entries) {
    r -= weight;
    if (r <= 0) return key;
  }
  return entries[entries.length - 1][0];
}

/**
 * Bir diziden rastgele eleman seçer (uniform).
 * @param {Array} arr
 * @returns {any}
 */
export function pickRandom(arr) {
  if (arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Belirli bir ihtimalle true döner.
 * @param {number} chance  0.0 - 1.0 arası
 * @returns {boolean}
 */
export function chance(p) {
  return Math.random() < p;
}

// ─── ARAŞTIRMACI FORMÜLLERI ───────────────────────────────────────────────────

/**
 * Araştırmacının belirli bir proje fazındaki temel yetenek puanı.
 * PHASE_SKILLS sabitinden ağırlıklı ortalama alır.
 *
 * @param {Object} researcher  — stat alanları olan nesne (AN, CR, LB ...)
 * @param {Array}  phaseSkills — [{ id: 'CR', w: 0.6 }, { id: 'AN', w: 0.4 }]
 * @returns {number}  0-100 arası
 */
export function calcBaseSkill(researcher, phaseSkills) {
  return phaseSkills.reduce((sum, { id, w }) => sum + researcher[id] * w, 0);
}

/**
 * Ekip uyumu çarpanı.
 * Formül: 0.8 + (avgTeamwork / 100) * 0.4 * compatibility
 * Aralık: 0.8 - 1.2
 *
 * @param {Object}   researcher
 * @param {Object[]} team        — aynı projedeki diğer araştırmacılar
 * @returns {number}
 */
export function calcTeamBonus(researcher, team) {
  if (!team || team.length === 0) return 1.0;
  const avgTeamwork = mean(team.map(r => r.TW));
  const compatibility = calcCompatibility(researcher, team);
  return clamp(0.8 + (avgTeamwork / 100) * 0.4 * compatibility, 0.8, 1.2);
}

/**
 * Araştırmacının ekiple uyum katsayısı (0.5 - 1.5).
 * Kişilik tipi GEN ekip uyumunu düşürür, LED artırır.
 *
 * @param {Object}   researcher
 * @param {Object[]} team
 * @returns {number}
 */
function calcCompatibility(researcher, team) {
  let base = 1.0;
  if (researcher.personality === 'GEN') base -= 0.3;
  if (researcher.personality === 'LED') base += 0.2;
  if (researcher.personality === 'MNT') base += 0.15;
  // Ekipte başka bir GEN varsa çatışma
  const otherGenius = team.filter(r => r.personality === 'GEN').length;
  base -= otherGenius * 0.15;
  return clamp(base, 0.5, 1.5);
}

/**
 * Moral çarpanı — GDD v3 §3.3 tablosuna göre.
 *
 * @param {number} morale  0-100
 * @returns {number}
 */
export function calcMoraleModifier(morale) {
  if (morale >= 80) return 1.20;
  if (morale >= 60) return 1.00;
  if (morale >= 40) return 0.85;
  if (morale >= 20) return 0.65;
  return 0.40;  // burnout
}

/**
 * Haftalık iş yükünün morale etkisi.
 * Formül: GDD v3 §3.4 workloadEffect
 *
 * @param {number} hours  haftalık çalışma saati
 * @returns {number}  morale değişimi (negatif veya 0)
 */
export function calcWorkloadEffect(hours) {
  if (hours <= 40) return 0;
  if (hours <= 50) return -2;
  if (hours <= 60) return -5;
  return -10;
}

/**
 * Araştırmacının kariyer evresi.
 * @param {number} yearsExp
 * @returns {'junior'|'mid'|'senior'|'emeritus'}
 */
export function getCareerStage(yearsExp) {
  if (yearsExp < 3)  return 'junior';
  if (yearsExp < 7)  return 'mid';
  if (yearsExp < 12) return 'senior';
  return 'emeritus';
}

/**
 * XP kazanım çarpanı — kıdemli araştırmacılar daha az öğrenir.
 * @param {number} yearsExp
 * @returns {number}
 */
export function getSeniorityXpMult(yearsExp) {
  const stage = getCareerStage(yearsExp);
  const mults = { junior: 1.5, mid: 1.0, senior: 0.5, emeritus: 0.1 };
  return mults[stage];
}

// ─── PROJE FORMÜLLERI ─────────────────────────────────────────────────────────

/**
 * Ekipman verimlilik katsayısı — yaşa göre düşer.
 * @param {number} age       kaç ay kullanıldı
 * @param {number} lifespan  toplam ömür (ay)
 * @returns {number}  0.3 - 1.0
 */
export function calcEquipmentEfficiency(age, lifespan) {
  const ratio = age / lifespan;
  if (ratio < 0.5) return 1.00;
  if (ratio < 0.8) return 0.85;
  if (ratio < 1.0) return 0.65;
  return 0.30;
}

/**
 * Proje toplam kalitesi — zayıf halka prensibi.
 * Her fazın kalitesi, PHASE_QUALITY_WEIGHTS ile ağırlıklandırılır.
 *
 * @param {Object} phaseQualities  { hypothesis: 72, literature: 85, ... }
 * @param {Object} weights         PHASE_QUALITY_WEIGHTS sabiti
 * @returns {number}  0-100
 */
export function calcProjectQuality(phaseQualities, weights) {
  return Object.entries(weights).reduce((sum, [phase, w]) => {
    const q = phaseQualities[phase] ?? 0;
    return sum + q * w;
  }, 0);
}

// ─── EKONOMİ FORMÜLLERI ───────────────────────────────────────────────────────

/**
 * Devlet temel fonu — prestije göre artar.
 * @param {number} prestige  0-1000
 * @returns {number}  aylık fon miktarı
 */
export function calcBaseFunding(prestige) {
  return 500 + prestige * 3;
}

/**
 * Araştırmacı maaşı.
 * @param {Object} researcher  — careerStage, field, RP, LY alanları
 * @param {Object} CAREER_BASE_SALARY
 * @param {Object} FIELD_SALARY_MULT
 * @returns {number}
 */
export function calcResearcherSalary(researcher, CAREER_BASE_SALARY, FIELD_SALARY_MULT) {
  const base       = CAREER_BASE_SALARY[researcher.careerStage] ?? 800;
  const fieldMult  = FIELD_SALARY_MULT[researcher.field] ?? 1.0;
  const repAdd     = researcher.RP * 10;
  const loyalDisc  = researcher.LY > 70 ? 0.9 : 1.0;
  return Math.round((base * fieldMult + repAdd) * loyalDisc);
}

/**
 * Hibe kabul oranı.
 * @param {number} prestige
 * @param {number} fieldMatch        0-1
 * @param {number} pastGrantCount    geçmiş kabul edilen hibe sayısı
 * @param {number} baseAcceptRate    hibenin temel kabul oranı
 * @returns {number}  0.05 - 0.90
 */
export function calcGrantAcceptRate(prestige, fieldMatch, pastGrantCount, baseAcceptRate) {
  const prestigeFactor    = clamp(prestige / 1000, 0, 1);
  const trackRecordFactor = clamp(pastGrantCount / 10, 0, 1);
  return clamp(
    baseAcceptRate + prestigeFactor * 0.2 + fieldMatch * 0.1 + trackRecordFactor * 0.1,
    0.05,
    0.90
  );
}

// ─── NOBEL FORMÜLLERI ─────────────────────────────────────────────────────────

/**
 * Yıllık citation hesabı — yayınlanan her makale için.
 * @param {Object} paper    — quality, impactFactor alanları
 * @param {number} fieldActivity  alanda aktif araştırmacı sayısı
 * @param {number} rivalCount     aynı alanda rakip yayın sayısı
 * @returns {number}
 */
export function calcYearlyCitations(paper, fieldActivity, rivalCount) {
  const qualityBase  = paper.quality * 0.3;
  const ifBase       = paper.impactFactor * 2;
  const fieldBonus   = fieldActivity * 0.5;
  const rivalBonus   = rivalCount * 0.2;
  const raw          = qualityBase + ifBase + fieldBonus + rivalBonus;
  return Math.round(raw * randFloat(0.8, 1.2));
}

/**
 * Gerçek Impact Factor hesabı.
 * @param {number} baseIF     derginin temel IF değeri
 * @param {number} minIF      minimum IF
 * @param {number} quality    makale kalitesi 0-100
 * @param {number} authorRP   yazarın itibar puanı
 * @returns {number}
 */
export function calcImpactFactor(baseIF, minIF, quality, authorRP) {
  const qualityBonus     = (quality - 70) * 0.1;
  const reputationBonus  = authorRP * 0.05;
  return Math.max(minIF, baseIF + qualityBonus + reputationBonus);
}

// ─── YARDIMCI ────────────────────────────────────────────────────────────────

/**
 * Sayıyı okunabilir formata çevirir: 1500 → "1.5K", 1200000 → "1.2M"
 * @param {number} n
 * @returns {string}
 */
export function formatNumber(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return String(Math.round(n));
}

/**
 * Oyun zamanını okunabilir stringe çevirir.
 * @param {number} year
 * @param {number} month  1-12
 * @param {number} week   1-4
 * @returns {string}  "Yıl 3, Ay 7, Hafta 2"
 */
export function formatGameTime(year, month, week) {
  return `Yıl ${year}, Ay ${month}, Hafta ${week}`;
}

/**
 * Ay sayısından okunabilir süre: 14 → "1 yıl 2 ay"
 * @param {number} months
 * @returns {string}
 */
export function formatDuration(months) {
  if (months < 12) return `${months} ay`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m > 0 ? `${y} yıl ${m} ay` : `${y} yıl`;
}
