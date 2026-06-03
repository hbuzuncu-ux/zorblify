/**
 * PEER REVIEW — rival_defs.js
 * 5 kurgusal rakip kurum tanımları ve başlangıç state üreticisi.
 * Saf veri — hiçbir oyun state'ine bağımlılık yok.
 * GDD v3.0 §6.1 Kurgusal Rakip Kurumlar referansı.
 */

'use strict';

import { randInt, pickRandom } from '../utils/math.js';

// ─── RAKİP KURUM TANIMLAMALARI ────────────────────────────────────────────────

/**
 * Her kurumun sabit özellikleri.
 * rivals.js bu tanımları kullanarak haftalık AI davranışını hesaplar.
 */
export const RIVAL_DEFS = {

  VIT: {
    id:          'VIT',
    label:       'Vance Institute of Technology',
    short:       'VIT',
    color:       '#3b82f6',
    strengths:   ['physics', 'chemistry'],
    strategy:    'fast',           // hızlı çalışır, çok ekipman
    nobelHistory: 3,               // geçmişte kazandığı Nobel sayısı
    yearlyNobelRange: [30, 60],    // yılda ürettiği Nobel puanı aralığı
    description: 'Fizik ve kimyada güçlü, hızlı araştırma stratejisi izler. Ekipman yatırımı yüksek.',
    startingPrestige: 320,
    aggressiveness:   0.75,        // 0-1, ne kadar saldırgan davranır
    riskTolerance:    0.70,        // 0-1, riskli projelere girme ihtimali
  },

  NAS: {
    id:          'NAS',
    label:       'Northfield Academy of Sciences',
    short:       'NAS',
    color:       '#4ade80',
    strengths:   ['medicine', 'biology'],
    strategy:    'precise',        // yavaş ama kusursuz
    nobelHistory: 7,
    yearlyNobelRange: [25, 50],
    description: 'Tıp ve biyolojide derin uzmanlaşma. Yüksek kalite, düşük hız.',
    startingPrestige: 450,
    aggressiveness:   0.40,
    riskTolerance:    0.30,
  },

  SRC: {
    id:          'SRC',
    label:       'Solaris Research Consortium',
    short:       'SRC',
    color:       '#a78bfa',
    strengths:   ['physics', 'chemistry', 'medicine', 'biology', 'economics'],
    strategy:    'parallel',       // birden fazla alanda eş zamanlı proje
    nobelHistory: 1,
    yearlyNobelRange: [20, 40],
    description: 'Devlet destekli, her alanda aktif. Odaksız ama geniş kapsamlı.',
    startingPrestige: 280,
    aggressiveness:   0.55,
    riskTolerance:    0.50,
  },

  CBA: {
    id:          'CBA',
    label:       'Crestline Bio-Analytics',
    short:       'CBA',
    color:       '#fb923c',
    strengths:   ['chemistry', 'economics'],
    strategy:    'patent',         // Nobel'den çok patent ve ticari gelir peşinde
    nobelHistory: 0,
    yearlyNobelRange: [10, 20],
    description: 'Patent odaklı, ticari çıkar öncelikli. Nobel umursamaz ama fonları bol.',
    startingPrestige: 180,
    aggressiveness:   0.35,
    riskTolerance:    0.60,
  },

  OEL: {
    id:          'OEL',
    label:       'Oakhaven Environmental Lab',
    short:       'OEL',
    color:       '#2dd4bf',
    strengths:   ['climate', 'peace'],
    strategy:    'niche',          // niş alanlarda odaklanmış, tehlikeli rakip
    nobelHistory: 0,
    yearlyNobelRange: [40, 70],
    description: 'İklim ve barış araştırmalarında niş lider. Kendi alanında Nobel\'e en yakın.',
    startingPrestige: 220,
    aggressiveness:   0.60,
    riskTolerance:    0.65,
  },
};

// ─── STRATEJI PROFILLERI ──────────────────────────────────────────────────────

/**
 * Strateji tiplerine göre AI davranış parametreleri.
 * rivals.js bu profilleri haftalık karar almada kullanır.
 */
export const STRATEGY_PROFILES = {
  fast: {
    maxActiveProjects:  3,
    preferredTypes:     ['applied', 'basic'],
    budgetBoostOnRace:  1.4,    // yarışta bütçe %40 artırır
    transferAggression: 0.70,   // araştırmacı transfer isteği
    publishThreshold:   65,     // bu kalitenin altında yayımlamaz
  },
  precise: {
    maxActiveProjects:  2,
    preferredTypes:     ['basic', 'field'],
    budgetBoostOnRace:  1.1,
    transferAggression: 0.35,
    publishThreshold:   80,     // yüksek kalite eşiği
  },
  parallel: {
    maxActiveProjects:  4,
    preferredTypes:     ['basic', 'applied', 'collab'],
    budgetBoostOnRace:  1.2,
    transferAggression: 0.55,
    publishThreshold:   60,
  },
  patent: {
    maxActiveProjects:  3,
    preferredTypes:     ['applied', 'meta_analysis'],
    budgetBoostOnRace:  1.0,    // yarışa girmez
    transferAggression: 0.25,
    publishThreshold:   55,
  },
  niche: {
    maxActiveProjects:  2,
    preferredTypes:     ['field', 'basic'],
    budgetBoostOnRace:  1.5,    // kendi alanında agresif
    transferAggression: 0.60,
    publishThreshold:   70,
  },
};

// ─── PROJE BAŞLIK HAVUZU (RAKİPLER İÇİN) ────────────────────────────────────

/**
 * Rakip kurumların başlattığı projelerde kullanılacak başlık havuzu.
 * Her alan için 3 başlık — oyuncunun project_defs.js havuzundan ayrı.
 */
const RIVAL_PROJECT_TITLES = {
  physics:   ['Kuantum Hesaplama Algoritması', 'Topografik Yalıtkan Araştırması', 'Plazma Fiziği Modeli'],
  chemistry: ['Katalizör Sentez Optimizasyonu', 'Biyopolimer Reaksiyon Kinetiği', 'Elektrokimyasal Depolama'],
  medicine:  ['Nörodejeneratif Hastalık Belirteçleri', 'İmmünoterapi Protokolü', 'Klinik Genomik Çalışma'],
  biology:   ['Epigenetik Saat Mekanizması', 'Mikrobiyom Çeşitlilik Analizi', 'CRISPR Hedefleme Doğruluğu'],
  economics: ['Dijital Piyasa Dinamikleri', 'Kurumsal Yönetim Etkisi', 'Finansal Ağ Kırılganlığı'],
  climate:   ['Karbon Tutum Kapasitesi', 'Okyanus Isı İçeriği Değişimi', 'Permafrost Sera Gazı Salımı'],
  peace:     ['Barış Süreci Sağlamlığı', 'Çatışma Sonrası Ekonomik Toparlanma', 'Silahsızlanma Uyum Analizi'],
};

// ─── BAŞLANGIÇ STATE ÜRETİCİ ─────────────────────────────────────────────────

/**
 * Oyun başında tüm rakiplerin initial state'ini üretir.
 * state.js'teki rivals objesine yazılır.
 *
 * @returns {Object}  { VIT: {...}, NAS: {...}, SRC: {...}, CBA: {...}, OEL: {...} }
 */
export function generateRivalStates() {
  const states = {};

  for (const [id, def] of Object.entries(RIVAL_DEFS)) {
    states[id] = {
      id,
      label:          def.label,
      short:          def.short,
      color:          def.color,
      strategy:       def.strategy,
      strengths:      def.strengths,
      aggressiveness: def.aggressiveness,
      riskTolerance:  def.riskTolerance,
      yearlyNobelRange: def.yearlyNobelRange,

      // Dinamik state
      prestige:        def.startingPrestige,
      nobelScore:      def.nobelHistory * 80,  // geçmiş Nobel başarısı puan olarak
      activeProjects:  generateStartingProjects(id, def),
      publications:    [],
      nobelWins:       def.nobelHistory,

      // AI karar takibi
      lastProjectWeek: 0,
      targetField:     pickRandom(def.strengths),
    };
  }

  return states;
}

/**
 * Rakibin başlangıç projelerini üretir.
 * Her rakip 1-2 aktif projeyle başlar.
 *
 * @param {string} id
 * @param {Object} def
 * @returns {Object[]}
 */
function generateStartingProjects(id, def) {
  const profile    = STRATEGY_PROFILES[def.strategy];
  const count      = randInt(1, Math.min(2, profile.maxActiveProjects));
  const projects   = [];
  const usedFields = new Set();

  for (let i = 0; i < count; i++) {
    // Güçlü alanlardan seç, tekrar etmesin
    const availableFields = def.strengths.filter(f => !usedFields.has(f));
    if (availableFields.length === 0) break;

    const field = pickRandom(availableFields);
    usedFields.add(field);

    const type  = pickRandom(profile.preferredTypes);
    const title = pickRandom(RIVAL_PROJECT_TITLES[field] ?? ['Araştırma Projesi']);

    // Proje rastgele bir fazda başlar (rakipler zaten araştırıyor)
    const phases      = ['hypothesis', 'literature', 'design', 'datacollect', 'analysis', 'writing'];
    const startPhase  = phases[randInt(0, 3)];  // ilk 4 fazdan birinde

    projects.push({
      id:       `rival_${id}_proj_${i}`,
      label:    title,
      type,
      field,
      phase:    startPhase,
      progress: randInt(10, 60),   // 0-100 genel ilerleme
    });
  }

  return projects;
}

// ─── YARDIMCILAR ─────────────────────────────────────────────────────────────

/**
 * Rakibin belirli bir alandaki etkinlik skoru (0-100).
 * Güçlü alanda 70-90, zayıf alanda 20-50.
 *
 * @param {string} rivalId
 * @param {string} field
 * @returns {number}
 */
export function getRivalFieldStrength(rivalId, field) {
  const def = RIVAL_DEFS[rivalId];
  if (!def) return 30;
  return def.strengths.includes(field)
    ? randInt(70, 90)
    : randInt(20, 50);
}

/**
 * Rakibin UI'da gösterilecek kısa durum özeti.
 *
 * @param {Object} rivalState  — rivals.js'teki canlı state
 * @returns {string}
 */
export function getRivalStatusSummary(rivalState) {
  const proj = rivalState.activeProjects?.length ?? 0;
  const score = Math.round(rivalState.nobelScore ?? 0);
  return `${proj} aktif proje · Nobel: ${score}`;
}

/**
 * Tüm rakiplerin Nobel skoruna göre sıralı listesini döner.
 * Oyuncunun skoru da dahil edilir.
 *
 * @param {Object} rivals   — state.rivals
 * @param {Object} labScores — state.lab.nobelScores (alan bazlı)
 * @returns {Array<{ id, label, short, color, nobelScore, isPlayer }>}
 */
export function getNobelRanking(rivals, labScores) {
  const playerTotal = Object.values(labScores ?? {})
    .reduce((s, v) => s + v, 0);

  const entries = Object.values(rivals).map(r => ({
    id:         r.id,
    label:      r.label,
    short:      r.short,
    color:      r.color,
    nobelScore: Math.round(r.nobelScore ?? 0),
    isPlayer:   false,
  }));

  entries.push({
    id:         'PLAYER',
    label:      'Laboratuvarınız',
    short:      'SİZ',
    color:      '#f0c060',
    nobelScore: Math.round(playerTotal),
    isPlayer:   true,
  });

  return entries.sort((a, b) => b.nobelScore - a.nobelScore);
}
