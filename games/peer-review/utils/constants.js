/**
 * PEER REVIEW — constants.js
 * Tüm oyun sabitleri. Hiçbir magic number başka dosyada bulunmamalı.
 * GDD v3.0 referansıyla üretilmiştir.
 */

'use strict';

// ─── ZAMAN ───────────────────────────────────────────────────────────────────

export const TIME = {
  WEEKS_PER_MONTH: 4,
  MONTHS_PER_YEAR: 12,
  WEEKS_PER_YEAR: 52,
  AUTO_ADVANCE_MS: 3000,   // otomatik modda hafta başına ms
  MAX_GAME_YEARS: 30,       // 30 yılda Nobel gelmezse oyun biter
};

// ─── ARAŞTIRMACI — TEMEL ÖZELLİKLER ─────────────────────────────────────────

// Oyuncu görür
export const RESEARCHER_STATS = ['AN', 'CR', 'LB', 'WR', 'TW', 'AM', 'RS', 'RP'];

// Oyuncu görmez
export const HIDDEN_STATS = ['ET', 'LY'];

// Tüm stat ID → okunabilir isim
export const STAT_NAMES = {
  AN: 'Analitik Zekâ',
  CR: 'Yaratıcılık',
  LB: 'Lab Becerisi',
  WR: 'Yazarlık',
  TW: 'Ekip Uyumu',
  AM: 'Hırs',
  RS: 'Dayanıklılık',
  RP: 'İtibar',
  ET: 'Etik Puanı',
  LY: 'Sadakat',
};

// ─── KARİYER EVRESİ ──────────────────────────────────────────────────────────

export const CAREER_STAGES = {
  junior:   { label: 'Junior',    yearsMin: 0,  yearsMax: 3,  xpMult: 1.5, salaryMult: 1.0, color: '#4ade80' },
  mid:      { label: 'Mid-Level', yearsMin: 3,  yearsMax: 7,  xpMult: 1.0, salaryMult: 1.8, color: '#3b82f6' },
  senior:   { label: 'Senior',    yearsMin: 7,  yearsMax: 12, xpMult: 0.5, salaryMult: 2.8, color: '#a78bfa' },
  emeritus: { label: 'Emeritus',  yearsMin: 12, yearsMax: 99, xpMult: 0.1, salaryMult: 0.3, color: '#f0c060' },
};

export const CAREER_BASE_SALARY = {
  junior: 800,
  mid: 1500,
  senior: 2800,
  emeritus: 400,
};

// ─── KİŞİLİK TİPLERİ ─────────────────────────────────────────────────────────

export const PERSONALITY_TYPES = {
  GEN: { label: 'Dahî',           color: '#a78bfa', breakthroughMult: 3.0 },
  MET: { label: 'Metodist',       color: '#3b82f6', errorRisk: 0.0 },
  LED: { label: 'Lider',          color: '#4ade80', teamBoostMult: 1.2 },
  AMB: { label: 'Hırslı Genç',    color: '#fb923c', burnoutAccel: 2.0 },
  PER: { label: 'Mükemmeliyetçi', color: '#f0c060', qualityBoost: 1.15 },
  MNT: { label: 'Mentör',         color: '#2dd4bf', mentorXpMult: 1.5 },
  PLY: { label: 'Politeknisyen',  color: '#8888aa', versatilityBonus: 1.05 },
  CAR: { label: 'Kariyer',        color: '#fb923c', journalBonus: 1.2 },
};

// ─── PROJE FAZ SİSTEMİ ───────────────────────────────────────────────────────

// Her fazda dominant istatistik(ler) ve ağırlıkları
export const PHASE_SKILLS = {
  hypothesis:  [{ id: 'CR', w: 0.6 }, { id: 'AN', w: 0.4 }],
  literature:  [{ id: 'AN', w: 0.5 }, { id: 'RP', w: 0.5 }],
  design:      [{ id: 'LB', w: 0.6 }, { id: 'AN', w: 0.4 }],
  datacollect: [{ id: 'LB', w: 1.0 }],
  analysis:    [{ id: 'AN', w: 1.0 }],
  writing:     [{ id: 'WR', w: 0.7 }, { id: 'AN', w: 0.3 }],
  peerreview:  [{ id: 'WR', w: 0.5 }, { id: 'RP', w: 0.5 }],
  revision:    [{ id: 'WR', w: 0.6 }, { id: 'RS', w: 0.4 }],
  publication: [{ id: 'RP', w: 1.0 }],
};

export const PHASE_LABELS = {
  hypothesis:  'Hipotez',
  literature:  'Literatür Taraması',
  design:      'Araştırma Tasarımı',
  datacollect: 'Veri Toplama',
  analysis:    'Veri Analizi',
  writing:     'Makale Yazımı',
  peerreview:  'Hakemli Değerlendirme',
  revision:    'Revizyon',
  publication: 'Yayın',
};

// Faz başına kazanılan base XP
export const PHASE_BASE_XP = {
  hypothesis: 20, literature: 15, design: 20,
  datacollect: 40, analysis: 35, writing: 30,
  peerreview: 25, revision: 20, publication: 50,
};

// Proje kalite hesabında faz ağırlıkları (toplam = 1.0)
export const PHASE_QUALITY_WEIGHTS = {
  hypothesis: 0.15, literature: 0.05, design: 0.15,
  datacollect: 0.25, analysis: 0.15, writing: 0.15,
  peerreview: 0.05, revision: 0.05,
};

// Proje tipi başına faz süresi aralıkları (hafta) [min, max]
export const PROJECT_PHASE_DURATIONS = {
  basic:         { hypothesis:[1,2], literature:[1,3], design:[1,2], datacollect:[2,6], analysis:[1,3], writing:[1,3], peerreview:[1,5], revision:[0,3], publication:[1,1] },
  applied:       { hypothesis:[1,1], literature:[1,2], design:[1,2], datacollect:[1,4], analysis:[1,2], writing:[1,2], peerreview:[1,3], revision:[0,2], publication:[1,1] },
  meta_analysis: { hypothesis:[0,1], literature:[1,2], design:[0,1], datacollect:[0,1], analysis:[1,2], writing:[1,2], peerreview:[1,2], revision:[0,1], publication:[1,1] },
  collab:        { hypothesis:[1,2], literature:[1,2], design:[1,2], datacollect:[1,4], analysis:[1,3], writing:[1,2], peerreview:[1,4], revision:[0,2], publication:[1,1] },
  field:         { hypothesis:[1,2], literature:[1,2], design:[1,2], datacollect:[2,5], analysis:[1,3], writing:[1,2], peerreview:[1,4], revision:[0,2], publication:[1,1] },
};

// ─── PROJE TİPLERİ ───────────────────────────────────────────────────────────

export const PROJECT_TYPES = {
  basic: {
    label: 'Temel Araştırma',
    costPerWeek: [50, 150],
    prestigeMult: 2.0,
    nobelCoeff: 0.8,
    retractionRiskMod: -0.02,
    patentChance: 0,
  },
  applied: {
    label: 'Uygulamalı Araştırma',
    costPerWeek: [200, 500],
    prestigeMult: 1.0,
    nobelCoeff: 0.3,
    industryConflictRisk: 0.15,
    patentChance: 0.6,
    patentValue: [500, 5000],
  },
  meta_analysis: {
    label: 'Meta-Analiz',
    costPerWeek: [20, 50],
    prestigeMult: 0.8,
    nobelCoeff: 0.0,
    citationBoostPct: 0.20,
    citationBoostWeeks: 12,
  },
  collab: {
    label: 'İşbirliği Projesi',
    costPerWeek: [0, 0],   // %50 partner karşılar — economy.js hesaplar
    prestigeMult: 1.5,
    nobelCoeff: 0.6,
    stealRisk: 0.10,
  },
  field: {
    label: 'Saha Araştırması',
    costPerWeek: [400, 800],
    prestigeMult: 2.5,
    nobelCoeff: 1.0,
    dataLossRisk: 0.08,
  },
};

// ─── ARAŞTIRMA ALANLARI ───────────────────────────────────────────────────────

export const FIELDS = {
  physics:   { label: 'Fizik',   color: '#3b82f6', nobelCategory: 'Physics' },
  chemistry: { label: 'Kimya',   color: '#a78bfa', nobelCategory: 'Chemistry' },
  medicine:  { label: 'Tıp',     color: '#4ade80', nobelCategory: 'Medicine' },
  biology:   { label: 'Biyoloji',color: '#2dd4bf', nobelCategory: 'Medicine' },
  economics: { label: 'Ekonomi', color: '#f0c060', nobelCategory: 'Economics' },
  climate:   { label: 'İklim',   color: '#2dd4bf', nobelCategory: 'Peace' },
  peace:     { label: 'Barış',   color: '#4ade80', nobelCategory: 'Peace' },
};

export const FIELD_SALARY_MULT = {
  physics: 1.0, chemistry: 1.0, medicine: 1.3,
  biology: 1.1, economics: 1.4, climate: 0.9, peace: 0.8,
};

// ─── DERGİ SİSTEMİ ───────────────────────────────────────────────────────────

export const JOURNAL_TIERS = {
  ELITE: {
    label: 'Elit',
    ifRange: [40, 70],
    reviewWeeks: [4, 5],
    acceptFormula: (q) => q > 85 ? 0.35 : 0.05,
    color: '#f0c060',
  },
  HIGH: {
    label: 'Yüksek',
    ifRange: [15, 39],
    reviewWeeks: [2, 3],
    acceptFormula: (q) => q > 70 ? 0.60 : 0.20,
    color: '#a78bfa',
  },
  MID: {
    label: 'Orta',
    ifRange: [5, 14],
    reviewWeeks: [1, 2],
    acceptFormula: (q) => q > 50 ? 0.80 : 0.45,
    color: '#3b82f6',
  },
  LOCAL: {
    label: 'Lokal',
    ifRange: [1, 4],
    reviewWeeks: [1, 1],
    acceptFormula: (q) => q > 30 ? 0.95 : 0.70,
    color: '#8888aa',
  },
};

// ─── EKIPMAN KATALOĞU ─────────────────────────────────────────────────────────

export const EQUIPMENT_CATALOG = {
  basic_microscope:      { label: 'Temel Mikroskop',        cost: 500,   maintenance: 20,  lifespan: 60, phaseBonus: { datacollect: 1.1 }, fieldBonus: { biology: 1.1 } },
  fluorescence_scope:    { label: 'Floresan Mikroskop',     cost: 1500,  maintenance: 60,  lifespan: 48, phaseBonus: { datacollect: 1.2 }, fieldBonus: { biology: 1.2, chemistry: 1.1 } },
  advanced_sequencer:    { label: 'Gelişmiş Sekanslayıcı',  cost: 3000,  maintenance: 150, lifespan: 48, phaseBonus: { datacollect: 1.4, analysis: 1.2 }, fieldBonus: { biology: 1.3, chemistry: 1.2 } },
  hpc_cluster:           { label: 'HPC Kümesi',             cost: 5000,  maintenance: 200, lifespan: 36, phaseBonus: { analysis: 1.5 }, fieldBonus: { physics: 1.3, economics: 1.2 } },
  data_analysis_suite:   { label: 'Veri Analiz Paketi',     cost: 800,   maintenance: 30,  lifespan: 24, phaseBonus: { analysis: 1.2, writing: 1.1 }, fieldBonus: {} },
  field_kit:             { label: 'Saha Araştırma Kiti',    cost: 1200,  maintenance: 50,  lifespan: 36, phaseBonus: { datacollect: 1.3 }, fieldBonus: { climate: 1.3, peace: 1.1 } },
  mass_spectrometer:     { label: 'Kütle Spektrometresi',   cost: 4000,  maintenance: 180, lifespan: 60, phaseBonus: { datacollect: 1.35, analysis: 1.15 }, fieldBonus: { chemistry: 1.4, biology: 1.2 } },
  particle_detector:     { label: 'Parçacık Dedektörü',     cost: 8000,  maintenance: 300, lifespan: 48, phaseBonus: { datacollect: 1.5 }, fieldBonus: { physics: 1.5 } },
  statistical_software:  { label: 'İstatistik Yazılımı',    cost: 300,   maintenance: 15,  lifespan: 24, phaseBonus: { analysis: 1.15, writing: 1.05 }, fieldBonus: { economics: 1.2 } },
  reference_manager:     { label: 'Referans Yöneticisi',    cost: 100,   maintenance: 5,   lifespan: 36, phaseBonus: { literature: 1.2, writing: 1.1 }, fieldBonus: {} },
  cell_culture_lab:      { label: 'Hücre Kültürü Ünitesi',  cost: 2500,  maintenance: 100, lifespan: 48, phaseBonus: { datacollect: 1.25 }, fieldBonus: { medicine: 1.3, biology: 1.2 } },
  mri_access:            { label: 'MRI Erişim Anlaşması',   cost: 6000,  maintenance: 250, lifespan: 24, phaseBonus: { datacollect: 1.4 }, fieldBonus: { medicine: 1.4 } },
  climate_sensors:       { label: 'İklim Sensör Ağı',       cost: 2000,  maintenance: 80,  lifespan: 60, phaseBonus: { datacollect: 1.3 }, fieldBonus: { climate: 1.4 } },
  behavioral_lab:        { label: 'Davranış Araştırma Odası',cost: 1800, maintenance: 70,  lifespan: 48, phaseBonus: { datacollect: 1.2, design: 1.15 }, fieldBonus: { peace: 1.2, economics: 1.1 } },
  writing_station:       { label: 'Gelişmiş Yazım İstasyonu',cost: 400,  maintenance: 10,  lifespan: 36, phaseBonus: { writing: 1.2, revision: 1.15 }, fieldBonus: {} },
};

// ─── MORAL SİSTEMİ ────────────────────────────────────────────────────────────

export const MORALE = {
  MAX: 100,
  MIN: 0,
  BURNOUT_THRESHOLD: 20,
  HIGH_THRESHOLD: 80,
  MID_THRESHOLD: 60,
  LOW_THRESHOLD: 40,

  // workloadEffect eşikleri (saat/hafta)
  OVERWORK_MILD: 40,
  OVERWORK_MODERATE: 50,
  OVERWORK_SEVERE: 60,

  // moraleModifier çarpanları
  MODIFIER: {
    high: 1.20,    // morale >= 80
    mid: 1.00,     // morale >= 60
    low: 0.85,     // morale >= 40
    critical: 0.65,// morale >= 20
    burnout: 0.40, // morale < 20
  },
};

// ─── EKİP UYUMU ───────────────────────────────────────────────────────────────

export const TEAM = {
  BONUS_MIN: 0.80,
  BONUS_MAX: 1.20,
};

// ─── GELİŞİM SİSTEMİ ─────────────────────────────────────────────────────────

export const XP = {
  PER_LEVEL: 100,         // her 100 XP'de dominant stat +1
  BREAKTHROUGH_CHANCE: 0.02,    // %2 per proje tamamlama
  BREAKTHROUGH_AMOUNT: 5,       // +5 tek seferde
  STAT_MAX: 100,
};

// ─── EKONOMİ ─────────────────────────────────────────────────────────────────

export const ECONOMY = {
  STARTING_BUDGET: 5000,
  BASE_FUNDING_PER_PRESTIGE: 3,   // prestige başına aylık +3
  BASE_FUNDING_MIN: 500,          // prestij 0'da aylık minimum fon
  PATENT_INCOME_MONTHS: 24,       // patent kaç ay gelir sağlar
};

// Hibe tanımları
export const GRANT_DEFS = {
  national_science: {
    label: 'Ulusal Bilim Vakfı',
    amountRange: [2000, 5000],
    durationMonths: 24,
    applicationWeeks: 3,
    baseAcceptRate: 0.50,
    condition: 'national_benefit',
  },
  global_research: {
    label: 'Küresel Araştırma Fonu',
    amountRange: [5000, 15000],
    durationMonths: 36,
    applicationWeeks: 5,
    baseAcceptRate: 0.30,
    condition: 'international_collab',
  },
  independent_tech: {
    label: 'Bağımsız Teknoloji Vakfı',
    amountRange: [1000, 8000],
    durationMonths: 12,
    applicationWeeks: 2,
    baseAcceptRate: 0.55,
    condition: 'field_specific',
  },
  industrial_rnd: {
    label: 'Endüstriyel Ar-Ge Ortaklığı',
    amountRange: [8000, 20000],
    durationMonths: 24,
    applicationWeeks: 4,
    baseAcceptRate: 0.40,
    condition: 'patent_share_40',
    patentSharePct: 0.40,
  },
  emergency_science: {
    label: 'Acil Bilim Fonu',
    amountRange: [1000, 3000],
    durationMonths: 6,
    applicationWeeks: 1,
    baseAcceptRate: 0.70,
    condition: 'crisis_event',
  },
};

// ─── NOBEL SİSTEMİ ────────────────────────────────────────────────────────────

export const NOBEL = {
  SIGNAL_THRESHOLD: 200,
  LONGLIST_THRESHOLD: 400,
  SHORTLIST_THRESHOLD: 600,
  WIN_THRESHOLD: 700,
  LONGLIST_SIZE: 50,
  SHORTLIST_SIZE: 6,
  RECENCY_DECAY: 0.85,          // eski makalelerin puanı her yıl 0.85x azalır
  RETRACTION_PENALTY: 50,       // retraction başına Nobel puan kaybı
  COLLAB_BONUS_PER: 15,         // her uluslararası işbirliği başına puan
  FIELD_LEADERSHIP_MULT: 30,    // alan liderliği çarpanı
  RANDOMNESS_RANGE: [0.90, 1.10], // kazan/kaybet rastlantı faktörü
};

// ─── RETRACTION SİSTEMİ ──────────────────────────────────────────────────────

export const RETRACTION = {
  BASE_RISK: 0.05,
  ETHIC_RISK_MAX: 0.15,   // ET < 40 ise ekstra risk
  IF_RISK_MAX: 0.10,       // yüksek IF = daha fazla göz
  PRESTIGE_HIT: 30,
  RESEARCHER_RP_HIT: 20,
};

// ─── RAKİP KURUMLAR ───────────────────────────────────────────────────────────

export const RIVAL_DEFS = {
  VIT: {
    label: 'Vance Institute of Technology',
    short: 'VIT',
    strengths: ['physics', 'chemistry'],
    strategy: 'fast',
    nobelHistory: 3,
    yearlyNobelRange: [30, 60],
    color: '#3b82f6',
  },
  NAS: {
    label: 'Northfield Academy of Sciences',
    short: 'NAS',
    strengths: ['medicine', 'biology'],
    strategy: 'precise',
    nobelHistory: 7,
    yearlyNobelRange: [25, 50],
    color: '#4ade80',
  },
  SRC: {
    label: 'Solaris Research Consortium',
    short: 'SRC',
    strengths: ['physics', 'chemistry', 'medicine', 'biology', 'economics'],
    strategy: 'parallel',
    nobelHistory: 1,
    yearlyNobelRange: [20, 40],
    color: '#a78bfa',
  },
  CBA: {
    label: 'Crestline Bio-Analytics',
    short: 'CBA',
    strengths: ['chemistry', 'economics'],
    strategy: 'patent',
    nobelHistory: 0,
    yearlyNobelRange: [10, 20],
    color: '#fb923c',
  },
  OEL: {
    label: 'Oakhaven Environmental Lab',
    short: 'OEL',
    strengths: ['climate', 'peace'],
    strategy: 'niche',
    nobelHistory: 0,
    yearlyNobelRange: [40, 70],
    color: '#2dd4bf',
  },
};

// ─── EVENT SİSTEMİ ────────────────────────────────────────────────────────────

export const EVENTS = {
  BASE_WEEKLY_CHANCE: 0.30,
  CATEGORY_WEIGHTS: {
    world: 0.15,
    institution: 0.20,
    research: 0.35,
    personal: 0.30,
  },
  BURNOUT_LEAVE_CHANCE: 0.40,     // burnout'ta her hafta izin talebi ihtimali
};

// ─── LAB SEVİYELERİ ──────────────────────────────────────────────────────────

export const LAB_LEVELS = {
  1: { label: 'Başlangıç Laboratuvarı', maxResearchers: 3,  maxProjects: 2, facilityExpense: 200 },
  2: { label: 'Gelişen Araştırma Merkezi', maxResearchers: 5,  maxProjects: 3, facilityExpense: 400 },
  3: { label: 'Bölgesel Araştırma Enstitüsü', maxResearchers: 8,  maxProjects: 4, facilityExpense: 700 },
  4: { label: 'Ulusal Araştırma Merkezi', maxResearchers: 12, maxProjects: 6, facilityExpense: 1200 },
  5: { label: 'Dünya Sınıfı Araştırma Enstitüsü', maxResearchers: 20, maxProjects: 10, facilityExpense: 2000 },
};

// ─── DENGE PARAMETRELERİ (reference) ─────────────────────────────────────────

export const BALANCE = {
  // Nobel 15. yılda kazanmak için hedef ~700 puan
  // Yıl 1-3:   5-15 puan/yıl
  // Yıl 4-7:   20-40 puan/yıl
  // Yıl 8-12:  50-80 puan/yıl
  // Yıl 13-20: 60-100 puan/yıl
  TRANSFER_PERIOD_MONTH: 1,       // Ocak = araştırmacı transfer dönemi
  RIVAL_OFFER_MIN_MULT: 1.20,     // rakip en az mevcut maaşın 1.2x'ini teklif eder
  PRESTIGE_EQUIP_BONUS_MAX: 0.30, // ekipman prestij bonusu maksimum %30
};

// ─── UI / GÖRSEL ──────────────────────────────────────────────────────────────

export const COLORS = {
  analytics:    '#3b82f6',
  medicine:     '#4ade80',
  prestige:     '#a78bfa',
  warning:      '#fb923c',
  gold:         '#fbbf24',
  danger:       '#f87171',
  climate:      '#2dd4bf',
  bgDark:       '#07070f',
  surface:      '#0d0d1c',
  surface2:     '#12122a',
  text:         '#f0f0ff',
  textMuted:    '#8888aa',
  border:       'rgba(255,255,255,0.07)',
};
