/**
 * PEER REVIEW — project_defs.js
 * Proje şablonları, dergi kataloğu, alan tanımları.
 * Saf veri + üretici fonksiyonlar — hiçbir oyun state'ine bağımlılık yok.
 * GDD v3.0 §4 Proje Sistemi referansı.
 */

'use strict';

import {
  PROJECT_TYPES,
  PROJECT_PHASE_DURATIONS,
  FIELDS,
  JOURNAL_TIERS,
  PHASE_QUALITY_WEIGHTS,
} from '../utils/constants.js';
import { randInt, clamp, pickRandom } from '../utils/math.js';

// ─── DERGI KATALOĞU ───────────────────────────────────────────────────────────
// Her alan için 4 tier × 1-2 dergi.
// Tamamen kurgusal isimler — telif hakkı riski yok.

export const JOURNAL_CATALOG = {
  physics: {
    ELITE: [
      { id: 'prl',  label: 'Physical Review Letters',        baseIF: 55, minIF: 40 },
      { id: 'npj',  label: 'Nature Physics Journal',         baseIF: 62, minIF: 45 },
    ],
    HIGH: [
      { id: 'ejp',  label: 'European Journal of Physics',    baseIF: 22, minIF: 15 },
      { id: 'apj',  label: 'Applied Physics Journal',        baseIF: 18, minIF: 15 },
    ],
    MID: [
      { id: 'ijp',  label: 'International Journal of Physics', baseIF: 9, minIF: 5 },
      { id: 'qpr',  label: 'Quantum Physics Review',         baseIF: 7,  minIF: 5 },
    ],
    LOCAL: [
      { id: 'rjp',  label: 'Regional Journal of Physics',    baseIF: 2,  minIF: 1 },
    ],
  },

  chemistry: {
    ELITE: [
      { id: 'jacs', label: 'Journal of Advanced Chemical Sciences', baseIF: 58, minIF: 42 },
      { id: 'ncs',  label: 'Nature Chemistry Studies',       baseIF: 65, minIF: 48 },
    ],
    HIGH: [
      { id: 'ejc',  label: 'European Journal of Chemistry',  baseIF: 25, minIF: 16 },
      { id: 'acr',  label: 'Analytical Chemistry Reports',   baseIF: 20, minIF: 15 },
    ],
    MID: [
      { id: 'ijc',  label: 'International Chemistry Journal',baseIF: 10, minIF: 5 },
      { id: 'csr',  label: 'Chemistry & Society Review',     baseIF: 7,  minIF: 5 },
    ],
    LOCAL: [
      { id: 'rjc',  label: 'Regional Chemistry Review',      baseIF: 2,  minIF: 1 },
    ],
  },

  medicine: {
    ELITE: [
      { id: 'glm',  label: 'Global Lancet Medicine',         baseIF: 68, minIF: 50 },
      { id: 'nmj',  label: 'New Medicine Journal',           baseIF: 60, minIF: 44 },
    ],
    HIGH: [
      { id: 'ejm',  label: 'European Journal of Medicine',   baseIF: 28, minIF: 16 },
      { id: 'cmi',  label: 'Clinical Medicine International',baseIF: 22, minIF: 15 },
    ],
    MID: [
      { id: 'ijm',  label: 'International Medical Journal',  baseIF: 11, minIF: 5 },
      { id: 'bmq',  label: 'Biomedical Quarterly',           baseIF: 8,  minIF: 5 },
    ],
    LOCAL: [
      { id: 'rjm',  label: 'Regional Medical Review',        baseIF: 3,  minIF: 1 },
    ],
  },

  biology: {
    ELITE: [
      { id: 'nbr',  label: 'Nature Biology Research',        baseIF: 60, minIF: 43 },
      { id: 'cbj',  label: 'Cell Biology Journal',           baseIF: 55, minIF: 40 },
    ],
    HIGH: [
      { id: 'ejb',  label: 'European Journal of Biology',    baseIF: 24, minIF: 15 },
      { id: 'mbb',  label: 'Molecular Biology Bulletin',     baseIF: 19, minIF: 15 },
    ],
    MID: [
      { id: 'ijb',  label: 'International Biology Journal',  baseIF: 9,  minIF: 5 },
      { id: 'bsr',  label: 'Biology & Society Review',       baseIF: 6,  minIF: 5 },
    ],
    LOCAL: [
      { id: 'rjb',  label: 'Regional Biology Review',        baseIF: 2,  minIF: 1 },
    ],
  },

  economics: {
    ELITE: [
      { id: 'qje',  label: 'Quarterly Journal of Economics', baseIF: 52, minIF: 40 },
      { id: 'rej',  label: 'Review of Economic Studies',     baseIF: 48, minIF: 40 },
    ],
    HIGH: [
      { id: 'eje',  label: 'European Economic Journal',      baseIF: 20, minIF: 15 },
      { id: 'wde',  label: 'World Development & Economics',  baseIF: 17, minIF: 15 },
    ],
    MID: [
      { id: 'ije',  label: 'International Economics Journal',baseIF: 8,  minIF: 5 },
      { id: 'ber',  label: 'Behavioral Economics Review',    baseIF: 6,  minIF: 5 },
    ],
    LOCAL: [
      { id: 'rje',  label: 'Regional Economics Review',      baseIF: 2,  minIF: 1 },
    ],
  },

  climate: {
    ELITE: [
      { id: 'gce',  label: 'Global Climate & Environment',   baseIF: 50, minIF: 40 },
      { id: 'ncc',  label: 'Nature Climate Change Studies',  baseIF: 58, minIF: 42 },
    ],
    HIGH: [
      { id: 'ejcs', label: 'European Journal of Climate Science', baseIF: 21, minIF: 15 },
      { id: 'ecr',  label: 'Environmental Change Reports',   baseIF: 16, minIF: 15 },
    ],
    MID: [
      { id: 'ijcs', label: 'International Climate Science Journal', baseIF: 8, minIF: 5 },
    ],
    LOCAL: [
      { id: 'rjcs', label: 'Regional Climate Science Review',baseIF: 2,  minIF: 1 },
    ],
  },

  peace: {
    ELITE: [
      { id: 'ips',  label: 'International Peace Studies',    baseIF: 42, minIF: 40 },
      { id: 'gcs',  label: 'Global Conflict & Society',      baseIF: 45, minIF: 40 },
    ],
    HIGH: [
      { id: 'jcs',  label: 'Journal of Conflict Studies',    baseIF: 18, minIF: 15 },
      { id: 'hsr',  label: 'Human Security Review',          baseIF: 15, minIF: 15 },
    ],
    MID: [
      { id: 'ijps', label: 'International Peace & Justice Journal', baseIF: 7, minIF: 5 },
    ],
    LOCAL: [
      { id: 'rjps', label: 'Regional Peace Studies Review',  baseIF: 2,  minIF: 1 },
    ],
  },
};

// Tier sırası — gönderim seçeneklerinde kullanılır
export const TIER_ORDER = ['ELITE', 'HIGH', 'MID', 'LOCAL'];

// ─── PROJE BAŞLIK HAVUZU ──────────────────────────────────────────────────────
// Her alan × tip kombinasyonu için 3-4 başlık.
// generateProject() buradan rastgele seçer.

const PROJECT_TITLES = {
  physics: {
    basic:         ['Kuantum Dolanıklık Dinamikleri', 'Karanlık Madde Dedeksiyon Yöntemleri', 'Parçacık Çarpışma Simetrisi', 'Süperiletkenlik Mekanizmaları'],
    applied:       ['Füzyon Reaktör Optimizasyonu', 'Kuantum Bilgisayar Bileşen Tasarımı', 'Plazma Hapsetme Verimliliği'],
    meta_analysis: ['Kuantum Mekaniği Sistematik Derleme', 'Parçacık Fiziği Bulgularının Meta-Analizi'],
    collab:        ['Uluslararası Yüksek Enerji Fiziği Projesi', 'Çok Merkezli Parçacık Çarpışma Çalışması'],
    field:         ['Kozmik Işın Saha Ölçümleri', 'Kutupsal Manyetosfer Gözlemleri'],
  },
  chemistry: {
    basic:         ['Protein Katlama Termodinamiği', 'Katalitik Reaksiyon Kinetiği', 'Yeni Organometalik Bileşik Sentezi', 'Elektrokimyasal Yüzey Analizi'],
    applied:       ['Biyoyakıt Katalizör Geliştirme', 'Hedefe Yönelik İlaç Sentezi', 'Nanometre Ölçekli Malzeme Üretimi'],
    meta_analysis: ['Organik Sentez Yöntemleri Meta-Analizi', 'Polimer Kimyası Sistematik Derleme'],
    collab:        ['Uluslararası Nanomalzeme Araştırma Projesi', 'Çok Merkezli İlaç Etkileşim Çalışması'],
    field:         ['Doğal Bileşik Biyoprospeksiyon', 'Derin Deniz Kimyasal Çeşitlilik Araştırması'],
  },
  medicine: {
    basic:         ['Bağışıklık Sistemi Modülasyon Mekanizmaları', 'Nöroplastisite ve Öğrenme İlişkisi', 'Genetik Hastalık Biyobelirteçleri', 'Kök Hücre Farklılaşma Yolakları'],
    applied:       ['Yeni Nesil Antiviral Ajan Geliştirme', 'Hedefe Yönelik Onkoloji Tedavisi', 'Yapay Organ Biyouyumluluk Prototipi'],
    meta_analysis: ['Kardiyovasküler Risk Faktörleri Meta-Analizi', 'Antibiyotik Direnci Sistematik Derleme'],
    collab:        ['Çok Merkezli Randomize Kontrollü Çalışma', 'Uluslararası Bulaşıcı Hastalık Araştırması'],
    field:         ['Toplum Tabanlı Kanser Tarama Çalışması', 'Endemik Hastalık Epidemiyoloji Araştırması'],
  },
  biology: {
    basic:         ['Epigenetik Düzenleme ve Çevre Etkileşimi', 'Evrimsel Adaptasyon Genomik Analizi', 'Hücre Döngüsü Kontrol Noktası Mekanizmaları', 'Mikrobiyom-Konak Etkileşim Dinamikleri'],
    applied:       ['CRISPR Tabanlı Gen Düzenleme Uygulaması', 'Biyobozunur Biyoplastik Geliştirme', 'Dayanıklı Tarım Bitkisi Islahı'],
    meta_analysis: ['Küresel Biyoçeşitlilik Kaybı Meta-Analizi', 'Ekosistem Servis Değerleme Sistematik Derleme'],
    collab:        ['Uluslararası Biyom Haritalama Projesi', 'Çok Merkezli Kanser Genomiks Çalışması'],
    field:         ['Tropikal Orman Biyoçeşitlilik Envanteri', 'Mercan Resifi Ekosistem İzleme'],
  },
  economics: {
    basic:         ['Davranışsal İktisat ve Karar Önyargıları', 'Gelir Eşitsizliği ve Sosyal Hareketlilik', 'Piyasa Mikro Yapısı Dinamikleri', 'Kurumsal Ekonomi ve Büyüme İlişkisi'],
    applied:       ['Dijital Para Biriminin Makroekonomik Etkileri', 'Yeşil Ekonomiye Geçiş Maliyet Analizi', 'İşgücü Piyasası Esneklik Modellemesi'],
    meta_analysis: ['Finansal Kriz Öncü Göstergeleri Meta-Analizi', 'Koşullu Yardım Programları Etkinlik Derleme'],
    collab:        ['G20 Ülkeleri Ticaret Politikası Araştırması', 'Uluslararası Kalkınma Ekonomisi Projesi'],
    field:         ['Gelişmekte Olan Piyasalarda Mikro Finansman Saha Çalışması', 'Kırsal Girişimcilik Ekonomisi Araştırması'],
  },
  climate: {
    basic:         ['İklim Geri Besleme Döngüleri ve Eşik Noktaları', 'Okyanus-Atmosfer Isı Transferi', 'Buzul Dinamikleri ve Deniz Seviyesi', 'Karbon Döngüsü Modelleme'],
    applied:       ['Doğrudan Hava Karbon Yakalama Teknolojisi', 'Offshore Rüzgar Enerjisi Optimizasyonu', 'İklim Uyum Altyapısı Tasarımı'],
    meta_analysis: ['Sera Gazı Azaltım Politikaları Meta-Analizi', 'İklim Değişikliği Sağlık Etkileri Sistematik Derleme'],
    collab:        ['IPCC Bölgesel İklim Projeksiyonu Projesi', 'Çok Merkezli Okyanus Asitlenmesi İzleme'],
    field:         ['Arktika Permafrost Çözülme Saha Araştırması', 'Muson Sistemi Değişim Gözlem Çalışması'],
  },
  peace: {
    basic:         ['Çatışma Sonrası Toplumsal Uzlaşma Mekanizmaları', 'Ekonomik Kalkınma ve Şiddet Azalması İlişkisi', 'Barış Anlaşması Sürdürülebilirlik Faktörleri', 'Silahlı Grup Demobilizasyon Psikolojisi'],
    applied:       ['Yerel Arabuluculuk Kapasite Geliştirme Programı', 'Çatışma Hassasiyetli Kalkınma Müdahalesi', 'Toplumsal Güven Yeniden İnşa Modeli'],
    meta_analysis: ['Barış Operasyonları Etkinliği Meta-Analizi', 'Çatışma Önleme Erken Uyarı Sistemleri Derleme'],
    collab:        ['BM Sürdürülebilir Barış Araştırma Girişimi', 'Uluslararası İnsan Hakları İzleme Projesi'],
    field:         ['Aktif Çatışma Bölgelerinde Sivil Koruma Saha Araştırması', 'Mülteci Topluluk Entegrasyonu Saha Çalışması'],
  },
};

// ─── PROJE NESNE ÜRETİCİ ─────────────────────────────────────────────────────

let _projectIdCounter = 1;

/**
 * Yeni proje nesnesi üretir.
 *
 * @param {Object} options
 * @param {string}      options.type        — 'basic' | 'applied' | 'meta_analysis' | 'collab' | 'field'
 * @param {string}      options.field       — 'physics' | 'chemistry' | ... (FIELDS sabiti)
 * @param {number}      options.startWeek   — oyunun mevcut toplam haftası
 * @param {string|null} options.label       — null ise havuzdan rastgele seçilir
 * @param {string|null} options.partnerId   — işbirliği projesi için rakip ID
 * @returns {Object}
 */
export function generateProject({ type, field, startWeek, label = null, partnerId = null }) {
  const id        = `p_${Date.now()}_${_projectIdCounter++}`;
  const typeDef   = PROJECT_TYPES[type];
  const phaseDurs = PROJECT_PHASE_DURATIONS[type];
  const titlePool = PROJECT_TITLES[field]?.[type] ?? ['Araştırma Projesi'];

  if (!typeDef)   throw new Error(`Bilinmeyen proje tipi: ${type}`);
  if (!phaseDurs) throw new Error(`Bilinmeyen faz yapısı: ${type}`);

  // Her faz için bağımsız süre belirle
  const phaseDurations = {};
  for (const [phase, [min, max]] of Object.entries(phaseDurs)) {
    phaseDurations[phase] = randInt(min, max);
  }

  // Toplam tahmini hafta
  const totalWeeks = Object.values(phaseDurations).reduce((s, w) => s + w, 0);

  // Haftalık maliyet
  let costPerWeek = 0;
  if (type !== 'collab') {
    const [costMin, costMax] = typeDef.costPerWeek;
    costPerWeek = randInt(costMin, costMax);
  }

  // Fazların sırası
  const phaseOrder = Object.keys(phaseDurs);

  return {
    id,
    label:              label ?? pickRandom(titlePool),
    type,
    field,

    // Faz takibi
    phase:              phaseOrder[0],      // başlangıç fazı: 'hypothesis'
    phaseIndex:         0,                  // phaseOrder içindeki indeks
    phaseWeek:          0,                  // mevcut fazda geçen hafta
    phaseOrder,                             // ['hypothesis','literature',...]
    phaseDurations,                         // { hypothesis: 2, literature: 1, ... }
    phaseQualities:     {},                 // tamamlanan fazların kalite puanları

    // Ekip
    teamIds:            [],

    // İlerleme
    costPerWeek,
    startWeek,
    estimatedEndWeek:   startWeek + totalWeeks,

    // Risk ve özel durumlar
    riskFlags:          [],                 // string[]
    isRacing:           false,
    partnerId,
    _manipulatedPhases: [],                 // etik ihlali olan fazlar
  };
}

// ─── DERGI SEÇİM API'Sİ ──────────────────────────────────────────────────────

/**
 * Proje kalitesine göre sıralanmış dergi seçenekleri döner.
 * Oyuncu dergi seçim event'inde bu listeyi görür.
 *
 * @param {string} field    — araştırma alanı
 * @param {number} quality  — 0-100
 * @returns {Array<{
 *   journal: Object,
 *   tier: string,
 *   tierLabel: string,
 *   tierColor: string,
 *   acceptChance: number,   — 0-100 tam sayı yüzde
 *   reviewWeeks: number,
 *   baseIF: number
 * }>}
 */
export function getJournalOptions(field, quality) {
  const fieldCatalog = JOURNAL_CATALOG[field] ?? JOURNAL_CATALOG.medicine;
  const options = [];

  for (const tierId of TIER_ORDER) {
    const tierDef  = JOURNAL_TIERS[tierId];
    const journals = fieldCatalog[tierId];
    if (!journals || journals.length === 0) continue;

    const journal      = pickRandom(journals);
    const acceptChance = tierDef.acceptFormula(quality);
    const reviewWeeks  = randInt(...tierDef.reviewWeeks);

    options.push({
      journal,
      tier:        tierId,
      tierLabel:   tierDef.label,
      tierColor:   tierDef.color,
      acceptChance: Math.round(acceptChance * 100),
      reviewWeeks,
      baseIF:      journal.baseIF,
    });
  }

  // Kaliteye göre sırala: yüksek kalite → elit öne; düşük kalite → lokal öne
  return options.sort((a, b) => {
    if (quality >= 85) return b.baseIF - a.baseIF;
    if (quality >= 60) return b.acceptChance - a.acceptChance;
    return a.baseIF - b.baseIF;
  });
}

/**
 * Belirli bir dergiye gönderim kararı (kabul/ret + IF hesabı).
 *
 * @param {Object} journal    — JOURNAL_CATALOG elemanı
 * @param {string} tierId     — 'ELITE' | 'HIGH' | 'MID' | 'LOCAL'
 * @param {number} quality    — 0-100
 * @param {number} authorRP   — baş yazarın itibar puanı
 * @returns {{ accepted: boolean, reviewWeeks: number, impactFactor: number }}
 */
export function submitToJournal(journal, tierId, quality, authorRP) {
  const tierDef    = JOURNAL_TIERS[tierId];
  const baseChance = tierDef.acceptFormula(quality);

  // Her 10 RP %1 kabul şansı ekler, max %10
  const rpBonus    = clamp(authorRP / 1000, 0, 0.10);
  const finalChance = clamp(baseChance + rpBonus, 0.02, 0.95);

  const accepted    = Math.random() < finalChance;
  const reviewWeeks = randInt(...tierDef.reviewWeeks);

  // Impact Factor hesabı
  const qualityBonus    = (quality - 70) * 0.1;
  const reputationBonus = authorRP * 0.05;
  const rawIF           = journal.baseIF + qualityBonus + reputationBonus;
  const impactFactor    = Math.round(Math.max(journal.minIF, rawIF) * 10) / 10;

  return { accepted, reviewWeeks, impactFactor };
}

// ─── YAYIN NESNE ÜRETİCİ ─────────────────────────────────────────────────────

/**
 * Kabul edilen projeden yayın nesnesi üretir.
 *
 * @param {Object} params
 * @param {Object} params.project
 * @param {Object} params.journal
 * @param {string} params.tierId
 * @param {number} params.impactFactor
 * @param {number} params.currentYear
 * @param {string|null} params.firstAuthorId
 * @returns {Object}
 */
export function createPublication({ project, journal, tierId, impactFactor, currentYear, firstAuthorId }) {
  const quality = calcFinalProjectQuality(project.phaseQualities);

  return {
    id:             `pub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    projectId:      project.id,
    label:          project.label,
    field:          project.field,
    journalId:      journal.id,
    journalLabel:   journal.label,
    tier:           tierId,
    impactFactor,
    quality,
    year:           currentYear,
    citations:      0,
    citationHistory: [],          // [{ year: number, count: number }]
    firstAuthorId:  firstAuthorId ?? null,
    coAuthorIds:    project.teamIds.filter(id => id !== firstAuthorId),
    isOriginal:     project.type === 'basic' || project.type === 'field',
    retracted:      false,
    _manipulated:   project._manipulatedPhases.length > 0,
  };
}

// ─── KALİTE HESAPLAMALARI ────────────────────────────────────────────────────

/**
 * Proje toplam kalitesi — ağırlıklı faz ortalaması.
 * GDD v3 §4.2 "zayıf halka prensibi":
 * kötü bir faz tüm projeyi aşağı çeker.
 *
 * @param {Object} phaseQualities  — { hypothesis: 72, datacollect: 85, ... }
 * @returns {number}  0-100
 */
export function calcFinalProjectQuality(phaseQualities) {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const [phase, weight] of Object.entries(PHASE_QUALITY_WEIGHTS)) {
    const q = phaseQualities[phase];
    if (q === undefined) continue;
    weightedSum += q * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return 0;
  return Math.round((weightedSum / totalWeight) * 100) / 100;
}

// ─── FAZ BİLGİ YARDIMCILARI ──────────────────────────────────────────────────

/**
 * Projenin mevcut fazına ilişkin bilgileri döner.
 *
 * @param {Object} project
 * @returns {{
 *   current: string,
 *   next: string|null,
 *   isLast: boolean,
 *   index: number,
 *   total: number
 * }}
 */
export function getPhaseInfo(project) {
  const order = project.phaseOrder;
  const idx   = order.indexOf(project.phase);

  return {
    current: project.phase,
    next:    idx < order.length - 1 ? order[idx + 1] : null,
    isLast:  idx === order.length - 1,
    index:   idx,
    total:   order.length,
  };
}

/**
 * Projenin genel ilerleme yüzdesi (0-100).
 * Tamamlanan fazlar + mevcut fazın kısmi ilerlemesi.
 *
 * @param {Object} project
 * @returns {number}
 */
export function getProjectProgress(project) {
  const { index, total } = getPhaseInfo(project);
  if (total === 0) return 0;

  const phaseDur     = project.phaseDurations[project.phase] || 1;
  const phasePartial = project.phaseWeek / phaseDur;

  return Math.min(100, Math.round(((index + phasePartial) / total) * 100));
}

/**
 * Proje tipi Türkçe etiketi.
 * @param {string} type
 * @returns {string}
 */
export function getProjectTypeLabel(type) {
  return PROJECT_TYPES[type]?.label ?? type;
}

/**
 * Bir alt tier ID'yi döner.
 * ELITE → HIGH → MID → LOCAL → null
 *
 * @param {string} tierId
 * @returns {string|null}
 */
export function getLowerTier(tierId) {
  const idx = TIER_ORDER.indexOf(tierId);
  if (idx === -1 || idx === TIER_ORDER.length - 1) return null;
  return TIER_ORDER[idx + 1];
}
