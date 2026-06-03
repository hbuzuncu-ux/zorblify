/**
 * PEER REVIEW — equipment_defs.js
 * Ekipman kataloğu, faz/alan bonus hesaplamaları,
 * ekipman yönetim yardımcıları.
 * GDD v3.0 §5.5 Ekipman Sistemi referansı.
 * Saf veri + hesaplama — hiçbir oyun state'ine bağımlılık yok.
 */

'use strict';

import { EQUIPMENT_CATALOG } from '../utils/constants.js';
import { clamp, calcEquipmentEfficiency } from '../utils/math.js';

// ─── GENİŞLETİLMİŞ EKIPMAN KATALOĞU ─────────────────────────────────────────
// constants.js'teki EQUIPMENT_CATALOG temel sabitleri tutar (cost, maintenance,
// lifespan, phaseBonus, fieldBonus). Burada UI etiketleri, açıklamalar,
// ön koşullar ve kategori bilgisi eklenir.

export const EQUIPMENT_DEFS = {
  basic_microscope: {
    ...EQUIPMENT_CATALOG.basic_microscope,
    label:       'Temel Mikroskop',
    description: 'Standart ışık mikroskobu. Biyoloji ve kimya projelerinde veri toplama verimliliğini artırır.',
    category:    'laboratory',
    labLevelReq: 1,
    icon:        '🔬',
  },

  fluorescence_scope: {
    ...EQUIPMENT_CATALOG.fluorescence_scope,
    label:       'Floresan Mikroskop',
    description: 'Hücre içi yapıları görüntülemek için floresan boyama tekniği. Biyoloji ve kimya projelerinde gelişmiş veri toplama.',
    category:    'laboratory',
    labLevelReq: 2,
    icon:        '🔬',
    prerequisite: 'basic_microscope',
  },

  advanced_sequencer: {
    ...EQUIPMENT_CATALOG.advanced_sequencer,
    label:       'Gelişmiş DNA Sekanslayıcı',
    description: 'Yüksek verimli yeni nesil dizileme platformu. Biyoloji ve kimya projelerinde veri toplama ve analizde güçlü artış.',
    category:    'laboratory',
    labLevelReq: 3,
    icon:        '🧬',
    prerequisite: 'fluorescence_scope',
  },

  hpc_cluster: {
    ...EQUIPMENT_CATALOG.hpc_cluster,
    label:       'Yüksek Performanslı Bilişim Kümesi',
    description: 'Paralel işlem kapasiteli sunucu kümesi. Fizik ve ekonomi projelerinde büyük veri analizini hızlandırır.',
    category:    'computing',
    labLevelReq: 3,
    icon:        '🖥️',
  },

  data_analysis_suite: {
    ...EQUIPMENT_CATALOG.data_analysis_suite,
    label:       'Veri Analiz Yazılım Paketi',
    description: 'İstatistiksel analiz ve görselleştirme araçları. Tüm alanlarda analiz ve yazım fazlarına destek sağlar.',
    category:    'software',
    labLevelReq: 1,
    icon:        '📊',
  },

  field_kit: {
    ...EQUIPMENT_CATALOG.field_kit,
    label:       'Saha Araştırma Kiti',
    description: 'Portatif sensörler, örnekleme ekipmanları ve saha kayıt sistemleri. İklim ve barış araştırmalarında saha verisi toplamayı güçlendirir.',
    category:    'field',
    labLevelReq: 1,
    icon:        '🎒',
  },

  mass_spectrometer: {
    ...EQUIPMENT_CATALOG.mass_spectrometer,
    label:       'Kütle Spektrometresi',
    description: 'Moleküler ağırlık ve yapı analizi. Kimya ve biyoloji projelerinde hassas veri toplama ve analiz kapasitesi.',
    category:    'laboratory',
    labLevelReq: 3,
    icon:        '⚗️',
  },

  particle_detector: {
    ...EQUIPMENT_CATALOG.particle_detector,
    label:       'Parçacık Dedektörü',
    description: 'Yüksek enerjili parçacık izleme sistemi. Fizik projelerinde veri toplamada rakipsiz performans.',
    category:    'laboratory',
    labLevelReq: 4,
    icon:        '⚛️',
  },

  statistical_software: {
    ...EQUIPMENT_CATALOG.statistical_software,
    label:       'Gelişmiş İstatistik Yazılımı',
    description: 'Ekonometrik modelleme ve meta-analiz araçları. Ekonomi projelerinde analiz ve yazım verimliliğini artırır.',
    category:    'software',
    labLevelReq: 1,
    icon:        '📈',
  },

  reference_manager: {
    ...EQUIPMENT_CATALOG.reference_manager,
    label:       'Referans Yönetim Sistemi',
    description: 'Otomatik kaynak tarama ve alıntı yönetimi. Tüm projelerde literatür taraması ve yazım fazlarını hızlandırır.',
    category:    'software',
    labLevelReq: 1,
    icon:        '📚',
  },

  cell_culture_lab: {
    ...EQUIPMENT_CATALOG.cell_culture_lab,
    label:       'Hücre Kültürü Ünitesi',
    description: 'Steril hücre yetiştirme ve izleme ortamı. Tıp ve biyoloji projelerinde deneysel veri kalitesini yükseltir.',
    category:    'laboratory',
    labLevelReq: 2,
    icon:        '🧫',
  },

  mri_access: {
    ...EQUIPMENT_CATALOG.mri_access,
    label:       'MRI Erişim Anlaşması',
    description: 'Üniversite hastanesiyle ortak MRI kullanım protokolü. Tıp projelerinde görüntüleme verisi toplamada güçlü avantaj.',
    category:    'access',
    labLevelReq: 3,
    icon:        '🏥',
  },

  climate_sensors: {
    ...EQUIPMENT_CATALOG.climate_sensors,
    label:       'İklim Sensör Ağı',
    description: 'Dağıtık atmosferik ve çevresel ölçüm sensörleri. İklim araştırmalarında uzun dönemli veri toplamanın temel altyapısı.',
    category:    'field',
    labLevelReq: 2,
    icon:        '🌡️',
  },

  behavioral_lab: {
    ...EQUIPMENT_CATALOG.behavioral_lab,
    label:       'Davranış Araştırma Odası',
    description: 'Kontrollü gözlem ve deney ortamı. Barış ve ekonomi projelerinde araştırma tasarımı ile veri toplama kalitesini artırır.',
    category:    'laboratory',
    labLevelReq: 2,
    icon:        '🧠',
  },

  writing_station: {
    ...EQUIPMENT_CATALOG.writing_station,
    label:       'Gelişmiş Yazım İstasyonu',
    description: 'Akademik yazım asistanı, gramer denetleyici ve şablon kütüphanesi. Tüm projelerde yazım ve revizyon fazlarını hızlandırır.',
    category:    'software',
    labLevelReq: 1,
    icon:        '✍️',
  },
};

// ─── KATEGORİ ETİKETLERİ ─────────────────────────────────────────────────────

export const EQUIPMENT_CATEGORIES = {
  laboratory: { label: 'Laboratuvar',  color: '#4ade80' },
  computing:  { label: 'Bilişim',      color: '#3b82f6' },
  software:   { label: 'Yazılım',      color: '#a78bfa' },
  field:      { label: 'Saha',         color: '#2dd4bf' },
  access:     { label: 'Erişim',       color: '#f0c060' },
};

// ─── BONUS HESAPLAMALARI ──────────────────────────────────────────────────────

/**
 * Lab'daki ekipmanların belirli bir faz ve alan için toplam bonus çarpanı.
 * Birden fazla ekipman aynı faz/alan için bonus veriyorsa en yüksek alınır
 * (çarpanlar üst üste binmez — GDD §5.5).
 *
 * @param {Array<{id: string, age: number}>} labEquipment  — lab'da sahip olunan ekipmanlar
 * @param {string} phase   — proje fazı
 * @param {string} field   — araştırma alanı
 * @returns {number}  1.0 - 1.8 arası çarpan
 */
export function calcEquipmentBonus(labEquipment, phase, field) {
  if (!labEquipment || labEquipment.length === 0) return 1.0;

  let bestBonus = 1.0;

  for (const owned of labEquipment) {
    const def = EQUIPMENT_DEFS[owned.id];
    if (!def) continue;

    // Ekipman verimliliği — yaşa göre düşer
    const efficiency = calcEquipmentEfficiency(owned.age, def.lifespan);

    // Faz bonusu
    const phaseBonus = def.phaseBonus?.[phase] ?? 1.0;
    // Alan bonusu
    const fieldBonus = def.fieldBonus?.[field] ?? 1.0;

    // İkisinin bileşik bonusu — her ikisi de varsa çarpar
    const combined = ((phaseBonus - 1) + (fieldBonus - 1)) * efficiency + 1;

    if (combined > bestBonus) bestBonus = combined;
  }

  return clamp(bestBonus, 1.0, 1.8);
}

/**
 * Tek bir ekipmanın aylık bakım maliyeti.
 * Ekipman eskidikçe arıza ihtimali yükselir, bakım maliyeti %20 artar.
 *
 * @param {{ id: string, age: number }} owned
 * @returns {number}
 */
export function calcMaintenanceCost(owned) {
  const def = EQUIPMENT_DEFS[owned.id];
  if (!def) return 0;

  const ageRatio = owned.age / def.lifespan;
  const ageMult  = ageRatio > 0.7 ? 1.2 : 1.0;
  return Math.round(def.maintenance * ageMult);
}

/**
 * Ekipmanın mevcut durumu.
 *
 * @param {{ id: string, age: number }} owned
 * @returns {'new'|'good'|'aging'|'worn'|'broken'}
 */
export function getEquipmentCondition(owned) {
  const def      = EQUIPMENT_DEFS[owned.id];
  if (!def) return 'broken';
  const ratio    = owned.age / def.lifespan;
  if (ratio < 0.25) return 'new';
  if (ratio < 0.50) return 'good';
  if (ratio < 0.75) return 'aging';
  if (ratio < 1.00) return 'worn';
  return 'broken';
}

export const CONDITION_LABELS = {
  new:    { label: 'Yeni',      color: '#4ade80' },
  good:   { label: 'İyi',       color: '#a78bfa' },
  aging:  { label: 'Eskiyor',   color: '#f0c060' },
  worn:   { label: 'Yıpranmış', color: '#fb923c' },
  broken: { label: 'Arızalı',   color: '#f87171' },
};

// ─── SATIN ALMA YARDIMCILARI ──────────────────────────────────────────────────

/**
 * Lab'ın satın alabileceği ekipmanları döner.
 * Ön koşul ve lab seviyesi kontrolü yapılır.
 *
 * @param {Array<{id: string, age: number}>} labEquipment  — sahip olunanlar
 * @param {number} labLevel   — 1-5
 * @param {number} budget     — mevcut bütçe
 * @returns {Array<{ id, def, canAfford, prerequisiteMet }>}
 */
export function getAvailableEquipment(labEquipment, labLevel, budget) {
  const ownedIds = new Set(labEquipment.map(e => e.id));

  return Object.entries(EQUIPMENT_DEFS)
    .filter(([id]) => !ownedIds.has(id))  // sahip olunmayanlar
    .map(([id, def]) => {
      const prerequisiteMet = !def.prerequisite || ownedIds.has(def.prerequisite);
      const levelMet        = labLevel >= (def.labLevelReq ?? 1);
      const canAfford       = budget >= def.cost;

      return {
        id,
        def,
        canAfford,
        prerequisiteMet,
        levelMet,
        available: prerequisiteMet && levelMet,
      };
    })
    .sort((a, b) => {
      // Önce mevcut seviyeye uygun olanlar, sonra maliyet sırası
      if (a.available !== b.available) return a.available ? -1 : 1;
      return a.def.cost - b.def.cost;
    });
}

/**
 * Ekipmanı satın alır — yeni owned nesnesi döner.
 * Bütçe düşümü state.js tarafından yapılır; bu fonksiyon sadece
 * owned nesnesini üretir.
 *
 * @param {string} equipmentId
 * @returns {{ id: string, age: number }}
 */
export function createOwnedEquipment(equipmentId) {
  return { id: equipmentId, age: 0 };
}

// ─── BAKIM TICK ───────────────────────────────────────────────────────────────

/**
 * Tüm ekipmanların yaşını 1 ay artırır.
 * Arızalanan ekipmanlar için event listesi döner.
 * economy.js tarafından her ay çağrılır.
 *
 * @param {Array<{id: string, age: number}>} labEquipment
 * @returns {string[]}  arızalanan ekipman ID'leri
 */
export function tickEquipmentAge(labEquipment) {
  const broken = [];

  for (const owned of labEquipment) {
    owned.age++;
    const def = EQUIPMENT_DEFS[owned.id];
    if (!def) continue;

    // Ömrünü dolduranlar arızalanır
    if (owned.age >= def.lifespan) {
      broken.push(owned.id);
    }
  }

  return broken;
}

/**
 * Tüm sahip olunan ekipmanların aylık toplam bakım maliyeti.
 *
 * @param {Array<{id: string, age: number}>} labEquipment
 * @returns {number}
 */
export function calcTotalMaintenanceCost(labEquipment) {
  return labEquipment.reduce((sum, owned) => sum + calcMaintenanceCost(owned), 0);
}

// ─── UI YARDIMCILARI ──────────────────────────────────────────────────────────

/**
 * Ekipmanın hangi fazlara bonus verdiğini okunabilir liste olarak döner.
 *
 * @param {string} equipmentId
 * @returns {string[]}  ['Veri Toplama +40%', 'Analiz +20%']
 */
export function getEquipmentBonusSummary(equipmentId) {
  const def = EQUIPMENT_DEFS[equipmentId];
  if (!def) return [];

  const PHASE_TR = {
    hypothesis: 'Hipotez', literature: 'Literatür', design: 'Tasarım',
    datacollect: 'Veri Toplama', analysis: 'Analiz', writing: 'Yazım',
    peerreview: 'Hakem Değ.', revision: 'Revizyon', publication: 'Yayın',
  };
  const FIELD_TR = {
    physics: 'Fizik', chemistry: 'Kimya', medicine: 'Tıp',
    biology: 'Biyoloji', economics: 'Ekonomi', climate: 'İklim', peace: 'Barış',
  };

  const lines = [];

  if (def.phaseBonus) {
    for (const [phase, mult] of Object.entries(def.phaseBonus)) {
      const pct = Math.round((mult - 1) * 100);
      lines.push(`${PHASE_TR[phase] ?? phase} +${pct}%`);
    }
  }
  if (def.fieldBonus) {
    for (const [field, mult] of Object.entries(def.fieldBonus)) {
      const pct = Math.round((mult - 1) * 100);
      lines.push(`${FIELD_TR[field] ?? field} alanı +${pct}%`);
    }
  }

  return lines;
}
