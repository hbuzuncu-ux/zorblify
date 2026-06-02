/**
 * PEER REVIEW — researcher_defs.js
 * Araştırmacı şablonları, isim havuzu ve prosedürel üretici.
 * GDD v3.0 §3.6 Kişilik Tipleri + §3.7 Araştırmacı Yaşam Döngüsü
 */

'use strict';

import { CAREER_STAGES, PERSONALITY_TYPES, FIELDS } from '../utils/constants.js';
import { randInt, clamp, pickRandom, chance } from '../utils/math.js';

// ─── İSİM HAVUZU ─────────────────────────────────────────────────────────────

const FIRST_NAMES = {
  // Kuzey Amerika
  en: ['James', 'Sarah', 'Michael', 'Emily', 'Robert', 'Jessica', 'David', 'Ashley',
       'Daniel', 'Megan', 'Christopher', 'Lauren', 'Matthew', 'Rachel', 'Andrew', 'Stephanie'],
  // Batı Avrupa
  eu: ['Lucas', 'Sophie', 'Liam', 'Emma', 'Noah', 'Olivia', 'Ethan', 'Isabella',
       'Leon', 'Clara', 'Felix', 'Marie', 'Henri', 'Elise', 'Marco', 'Giulia'],
  // Doğu Asya
  ea: ['Wei', 'Mei', 'Jae', 'Yuna', 'Hiroshi', 'Aiko', 'Chen', 'Lin',
       'Kenji', 'Sakura', 'Dong', 'Ji-ho', 'Takeshi', 'Yuki', 'Hao', 'Fen'],
  // Güney Asya
  sa: ['Arjun', 'Priya', 'Rohan', 'Ananya', 'Vikram', 'Neha', 'Aditya', 'Shreya',
       'Rahul', 'Kavya', 'Siddharth', 'Divya', 'Karan', 'Pooja', 'Nikhil', 'Isha'],
  // Orta Doğu / Akdeniz
  me: ['Omar', 'Layla', 'Hassan', 'Fatima', 'Tariq', 'Nour', 'Yusuf', 'Amira',
       'Mehmet', 'Zeynep', 'Karim', 'Yasmin', 'Ibrahim', 'Leila', 'Khalid', 'Rania'],
  // Latin Amerika
  la: ['Carlos', 'Sofia', 'Diego', 'Valentina', 'Andres', 'Camila', 'Miguel', 'Lucia',
       'Rafael', 'Isabella', 'Javier', 'Natalia', 'Eduardo', 'Gabriela', 'Pablo', 'Ana'],
  // Afrika
  af: ['Kofi', 'Amara', 'Kwame', 'Aisha', 'Chidi', 'Zara', 'Emeka', 'Fatou',
       'Seun', 'Nia', 'Tunde', 'Adaeze', 'Malik', 'Chioma', 'Olu', 'Sade'],
};

const LAST_NAMES = {
  en: ['Anderson', 'Thompson', 'Harrison', 'Mitchell', 'Campbell', 'Parker',
       'Bennett', 'Collins', 'Stewart', 'Morris', 'Rogers', 'Reed'],
  eu: ['Müller', 'Dubois', 'Rossi', 'García', 'Schmidt', 'Bernard',
       'Fischer', 'Martin', 'Weber', 'Bauer', 'Hoffmann', 'Richter'],
  ea: ['Kim', 'Zhang', 'Tanaka', 'Wang', 'Park', 'Li', 'Yamamoto',
       'Chen', 'Lee', 'Liu', 'Suzuki', 'Nakamura'],
  sa: ['Sharma', 'Patel', 'Singh', 'Kumar', 'Gupta', 'Verma',
       'Mishra', 'Rao', 'Nair', 'Joshi', 'Reddy', 'Mehta'],
  me: ['Al-Rashid', 'Yıldız', 'Hassan', 'Kaya', 'Al-Farsi', 'Demir',
       'Mansour', 'Şahin', 'Al-Amin', 'Çelik', 'Karimi', 'Öztürk'],
  la: ['Hernández', 'Rodríguez', 'González', 'López', 'Martínez', 'Pérez',
       'Torres', 'Flores', 'Rivera', 'Vargas', 'Castro', 'Morales'],
  af: ['Okafor', 'Mensah', 'Diallo', 'Abebe', 'Nwosu', 'Boateng',
       'Adeyemi', 'Kamara', 'Sesay', 'Osei', 'Traore', 'Conteh'],
};

// ─── KİŞİLİK TİPİ ŞABLONLARI ─────────────────────────────────────────────────

/**
 * Her kişilik tipi için temel stat aralıkları.
 * GDD v3 §3.6'daki profil tanımlarına göre.
 * format: { statId: [min, max] }
 * Tanımlanmayan statlar [40, 70] aralığında random üretilir.
 */
const PERSONALITY_STAT_PROFILES = {
  GEN: {
    // Dahî: CR yüksek, TW düşük
    CR: [82, 97], AN: [70, 90], TW: [15, 35],
    AM: [60, 85], RS: [40, 65], LB: [50, 75],
    WR: [45, 70], RP: [30, 60],
    _hidden: { ET: [50, 85], LY: [40, 70] },
  },
  MET: {
    // Metodist: LB ve AN yüksek, breakthrough az
    LB: [78, 95], AN: [72, 90], CR: [30, 55],
    WR: [55, 75], TW: [50, 70], AM: [55, 75],
    RS: [65, 85], RP: [45, 70],
    _hidden: { ET: [70, 95], LY: [55, 80] },
  },
  LED: {
    // Lider: TW ve RP yüksek, kendi output düşük
    TW: [83, 97], RP: [68, 88], AM: [55, 75],
    AN: [50, 70], CR: [45, 65], LB: [40, 62],
    WR: [55, 75], RS: [60, 80],
    _hidden: { ET: [65, 90], LY: [60, 85] },
  },
  AMB: {
    // Hırslı Genç: AM çok yüksek, RS düşük (burnout riski)
    AM: [88, 99], CR: [55, 80], AN: [50, 75],
    LB: [45, 70], WR: [40, 65], TW: [40, 65],
    RS: [20, 38], RP: [20, 45],
    _hidden: { ET: [45, 75], LY: [35, 60] },
  },
  PER: {
    // Mükemmeliyetçi: WR yüksek, AM düşük (proje bitmez)
    WR: [88, 99], AN: [70, 88], CR: [55, 75],
    LB: [60, 80], TW: [45, 65], RS: [55, 75],
    AM: [15, 30], RP: [55, 78],
    _hidden: { ET: [75, 95], LY: [50, 75] },
  },
  MNT: {
    // Mentör: TW yüksek, hepsi orta
    TW: [78, 93], RS: [65, 85], RP: [55, 78],
    AN: [52, 68], CR: [48, 65], LB: [50, 68],
    WR: [55, 72], AM: [40, 60],
    _hidden: { ET: [70, 92], LY: [65, 88] },
  },
  PLY: {
    // Politeknisyen: hepsi orta
    AN: [52, 68], CR: [50, 66], LB: [52, 68],
    WR: [50, 65], TW: [52, 68], AM: [50, 66],
    RS: [52, 68], RP: [48, 65],
    _hidden: { ET: [55, 80], LY: [50, 75] },
  },
  CAR: {
    // Kariyer: RP yüksek, LY düşük
    RP: [82, 97], WR: [65, 85], AN: [60, 80],
    TW: [55, 75], CR: [50, 70], LB: [50, 70],
    AM: [70, 88], RS: [55, 75],
    _hidden: { ET: [40, 68], LY: [15, 35] },
  },
};

// ─── ARAŞTIRMACI ÜRETİCİ ─────────────────────────────────────────────────────

let _idCounter = 1;

/**
 * Belirtilen kişilik tipi ve kariyer evresine göre araştırmacı üretir.
 * Tüm statlar PERSONALITY_STAT_PROFILES'dan türetilir.
 *
 * @param {Object} options
 * @param {string} [options.personality]   — belirtilmezse random
 * @param {string} [options.careerStage]   — belirtilmezse random (junior/mid ağırlıklı)
 * @param {string} [options.field]         — belirtilmezse random
 * @param {string} [options.culture]       — isim kültürü, belirtilmezse random
 * @returns {Object}  araştırmacı nesnesi
 */
export function generateResearcher({
  personality = null,
  careerStage = null,
  field = null,
  culture = null,
} = {}) {
  const id          = `r_${Date.now()}_${_idCounter++}`;
  const pType       = personality ?? pickRandom(Object.keys(PERSONALITY_STAT_PROFILES));
  const stage       = careerStage ?? weightedCareerStage();
  const resField    = field ?? pickRandom(Object.keys(FIELDS));
  const cult        = culture ?? pickRandom(Object.keys(FIRST_NAMES));
  const profile     = PERSONALITY_STAT_PROFILES[pType];
  const stageData   = CAREER_STAGES[stage];

  // Statları profil aralıklarından üret
  const stats = {};
  const visibleStats = ['AN', 'CR', 'LB', 'WR', 'TW', 'AM', 'RS', 'RP'];
  for (const stat of visibleStats) {
    const range = profile[stat] ?? [40, 70];
    stats[stat] = randInt(range[0], range[1]);
  }

  // Gizli statlar
  const hiddenRange = profile._hidden ?? {};
  const ET = randInt(...(hiddenRange.ET ?? [40, 80]));
  const LY = randInt(...(hiddenRange.LY ?? [40, 80]));

  // Kariyer evresine göre deneyim yılı
  const yearsExp = randInt(stageData.yearsMin, Math.max(stageData.yearsMin, stageData.yearsMax - 1));

  // İsim
  const firstName = pickRandom(FIRST_NAMES[cult]);
  const lastName  = pickRandom(LAST_NAMES[cult]);

  // Junior araştırmacılar doktora öğrencisi olabilir
  const isPhD = stage === 'junior' && chance(0.4);

  // Başlangıç maaşı — piyasa oranına göre biraz dalgalı
  const baseSalary  = calcBaseSalary(stage, resField, stats.RP);
  const salary      = Math.round(baseSalary * (0.9 + Math.random() * 0.2));

  return {
    id,
    name:              `${isPhD ? 'Dr. ' : ''}${firstName} ${lastName}`,
    firstName,
    lastName,
    culture:           cult,
    personality:       pType,
    field:             resField,
    careerStage:       stage,
    yearsExp,
    salary,
    hoursPerWeek:      40,
    morale:            randInt(65, 85),   // başlangıçta iyi moral
    xp:                0,
    assignedProjectId: null,
    isBurnout:         false,
    isOnLeave:         false,
    leaveWeeksLeft:    0,
    // Görünür statlar
    AN: stats.AN, CR: stats.CR, LB: stats.LB, WR: stats.WR,
    TW: stats.TW, AM: stats.AM, RS: stats.RS, RP: stats.RP,
    // Gizli statlar
    ET, LY,
    // Runtime (save'e yazılmaz)
    _manipulated: false,
  };
}

/**
 * İşe alma ekranı için N adet aday üretir.
 * Çeşitlilik için kariyer evresi ve kişilik tipi dağılımı kontrol edilir.
 *
 * @param {number} count       — kaç aday gösterilsin (varsayılan 4)
 * @param {string|null} field  — belirli bir alana odaklan
 * @returns {Object[]}
 */
export function generateCandidates(count = 4, field = null) {
  const candidates = [];
  const usedPersonalities = new Set();

  for (let i = 0; i < count; i++) {
    // Kişilik çeşitliliği — aynı tip tekrar gelmesin (8'den fazla istenmediği sürece)
    let personality = null;
    if (usedPersonalities.size < Object.keys(PERSONALITY_STAT_PROFILES).length) {
      const remaining = Object.keys(PERSONALITY_STAT_PROFILES)
        .filter(p => !usedPersonalities.has(p));
      personality = pickRandom(remaining);
      usedPersonalities.add(personality);
    }

    // İlk aday junior, ikincisi mid, sonrakiler random
    let careerStage = null;
    if (i === 0) careerStage = 'junior';
    else if (i === 1) careerStage = 'mid';

    candidates.push(generateResearcher({ personality, careerStage, field }));
  }

  return candidates;
}

// ─── ÖN TANIMLI BAŞLANGIÇ ARAŞTIRMACILARI ────────────────────────────────────

/**
 * Oyun başında oyuncuya verilen 2 araştırmacı.
 * Dengeli bir başlangıç sağlamak için sabit kişilik tipleri kullanılır.
 * Statlar random ama kariyer evresi junior/mid garantili.
 *
 * @returns {Object[]}  2 elemanlı dizi
 */
export function generateStartingResearchers() {
  return [
    generateResearcher({ personality: 'MET', careerStage: 'junior' }),
    generateResearcher({ personality: 'PLY', careerStage: 'mid' }),
  ];
}

// ─── ARAŞTIRMACI BİLGİ YARDIMCILARI ──────────────────────────────────────────

/**
 * Araştırmacının okunabilir kariyer unvanı.
 * @param {Object} researcher
 * @returns {string}
 */
export function getResearcherTitle(researcher) {
  const titles = {
    junior:   'Araştırma Görevlisi',
    mid:      'Kıdemli Araştırmacı',
    senior:   'Baş Araştırmacı',
    emeritus: 'Onursal Araştırmacı',
  };
  return titles[researcher.careerStage] ?? 'Araştırmacı';
}

/**
 * Araştırmacının dominant özelliğini döner (en yüksek görünür stat).
 * @param {Object} researcher
 * @returns {{ id: string, label: string, value: number }}
 */
export function getDominantStat(researcher) {
  const visible = ['AN', 'CR', 'LB', 'WR', 'TW', 'AM', 'RS', 'RP'];
  const statLabels = {
    AN: 'Analitik', CR: 'Yaratıcı', LB: 'Lab', WR: 'Yazar',
    TW: 'Ekip', AM: 'Hırslı', RS: 'Dayanıklı', RP: 'İtibar',
  };
  let best = { id: 'AN', value: 0 };
  for (const id of visible) {
    if (researcher[id] > best.value) best = { id, value: researcher[id] };
  }
  return { id: best.id, label: statLabels[best.id], value: best.value };
}

/**
 * Araştırmacının mevcut durumunu döner.
 * @param {Object} researcher
 * @returns {'active'|'burnout'|'leave'|'idle'}
 */
export function getResearcherStatus(researcher) {
  if (researcher.isBurnout)  return 'burnout';
  if (researcher.isOnLeave)  return 'leave';
  if (researcher.assignedProjectId) return 'active';
  return 'idle';
}

/**
 * İki araştırmacının uyum skoru (0-100).
 * UI'da "Bu araştırmacıyı bu projeye ata" kararında gösterilir.
 *
 * @param {Object} r1
 * @param {Object} r2
 * @returns {number}
 */
export function getCompatibilityScore(r1, r2) {
  let score = 50;

  // Lider + herkes iyi geçinir
  if (r1.personality === 'LED' || r2.personality === 'LED') score += 15;

  // İki Dahî çatışır
  if (r1.personality === 'GEN' && r2.personality === 'GEN') score -= 25;

  // Mentör + Junior iyi çalışır
  if (
    (r1.personality === 'MNT' && r2.careerStage === 'junior') ||
    (r2.personality === 'MNT' && r1.careerStage === 'junior')
  ) score += 20;

  // Hırslı Genç + Mükemmeliyetçi çatışır (hız vs kalite)
  if (
    (r1.personality === 'AMB' && r2.personality === 'PER') ||
    (r1.personality === 'PER' && r2.personality === 'AMB')
  ) score -= 20;

  // Aynı alan bonusu
  if (r1.field === r2.field) score += 10;

  // Ekip uyumu ortalaması
  score += (r1.TW + r2.TW) / 2 * 0.2 - 10;

  return clamp(Math.round(score), 0, 100);
}

// ─── İÇ YARDIMCILAR ──────────────────────────────────────────────────────────

/**
 * Junior/mid ağırlıklı kariyer evresi seçimi.
 * İşe alma havuzunda senior nadir, emeritus neredeyse yok.
 */
function weightedCareerStage() {
  const r = Math.random();
  if (r < 0.45) return 'junior';
  if (r < 0.80) return 'mid';
  if (r < 0.97) return 'senior';
  return 'emeritus';
}

/**
 * Kariyer evresi, alan ve RP'ye göre temel maaş.
 */
function calcBaseSalary(stage, field, rp) {
  const BASE = { junior: 800, mid: 1500, senior: 2800, emeritus: 400 };
  const FIELD_MULT = {
    physics: 1.0, chemistry: 1.0, medicine: 1.3,
    biology: 1.1, economics: 1.4, climate: 0.9, peace: 0.8,
  };
  return Math.round(BASE[stage] * (FIELD_MULT[field] ?? 1.0) + rp * 10);
}
