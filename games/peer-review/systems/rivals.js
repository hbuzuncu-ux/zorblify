/**
 * PEER REVIEW — rivals.js
 * Rakip AI sistemi iş mantığı.
 * Haftalık tick, alan değerlendirme, proje başlatma/hızlandırma,
 * Nobel puan birikimi, araştırmacı transfer dönemi.
 * GDD v3.0 §6.2 Rakip AI Davranış Motoru tam implementasyonu.
 */

'use strict';

import {
  RIVAL_DEFS,
  STRATEGY_PROFILES,
  generateRivalStates,
  getRivalFieldStrength,
} from '../data/rival_defs.js';
import {
  FIELDS,
  PROJECT_TYPES,
  NOBEL,
  BALANCE,
} from '../utils/constants.js';
import {
  randInt,
  pickRandom,
  chance,
} from '../utils/math.js';
import {
  getState,
  addNotification,
  queueEvent,
} from '../core/state.js';
import { EventBus } from '../core/game.js';

// ─── SİSTEM KAYDI ────────────────────────────────────────────────────────────

/**
 * Rakip sistemini EventBus'a bağlar.
 * Oyun başında bir kez çağrılır.
 */
export function registerRivalSystem() {
  EventBus.on('systems:tick', ({ state }) => {
    tickAllRivals(state);
  });

  EventBus.on('game:year_end', ({ state }) => {
    updateRivalNobelScores(state);
  });

  EventBus.on('researchers:transfer_period', ({ state }) => {
    runRivalTransferOffers(state);
  });
}

/**
 * Rakip state'lerini oyun başında başlatır.
 * startGame() tarafından çağrılır.
 *
 * @param {Object} state
 */
export function initRivals(state) {
  if (Object.keys(state.rivals).length === 0) {
    const rivalStates = generateRivalStates();
    Object.assign(state.rivals, rivalStates);
  }
}

// ─── HAFTALIK TICK ────────────────────────────────────────────────────────────

/**
 * Tüm rakipleri haftalık günceller.
 * GDD v3.0 §6.2 rivalWeeklyTick sırası korunur.
 *
 * @param {Object} state
 */
function tickAllRivals(state) {
  for (const rival of Object.values(state.rivals)) {
    tickRival(rival, state);
  }
}

/**
 * Tek rakip için haftalık tick.
 * 1. Alan değerlendirme
 * 2. Proje kararı
 * 3. Mevcut projeleri ilerlet
 * 4. Yarış durumunda bütçe artır
 *
 * @param {Object} rival
 * @param {Object} state
 */
function tickRival(rival, state) {
  const def     = RIVAL_DEFS[rival.id];
  const profile = STRATEGY_PROFILES[rival.strategy];

  // ── 1. Yeni proje başlatma kararı ───────────────────────────────────────
  const canStartNew = rival.activeProjects.length < profile.maxActiveProjects;
  // Her 4-8 haftada bir yeni proje değerlendirmesi
  const decisionInterval = randInt(4, 8);
  const shouldEvaluate   = (state.time.totalWeeks - rival.lastProjectWeek) >= decisionInterval;

  if (canStartNew && shouldEvaluate) {
    const bestField = evaluateBestField(rival, state, profile);
    if (bestField) {
      startRivalProject(rival, bestField, profile, state);
      rival.lastProjectWeek = state.time.totalWeeks;
    }
  }

  // ── 2. Mevcut projeleri ilerlet ──────────────────────────────────────────
  for (const project of rival.activeProjects) {
    advanceRivalProject(project, rival, state);
  }

  // ── 3. Tamamlanan projeleri yayımla ─────────────────────────────────────
  const completed = rival.activeProjects.filter(p => p.progress >= 100);
  for (const project of completed) {
    publishRivalProject(project, rival, state);
  }
  rival.activeProjects = rival.activeProjects.filter(p => p.progress < 100);

  // ── 4. Yarış varsa bütçe artır ───────────────────────────────────────────
  for (const project of rival.activeProjects) {
    if (isRacingWithPlayer(project, state)) {
      project._budgetBoost = profile.budgetBoostOnRace;
    }
  }
}

// ─── ALAN DEĞERLENDİRME ──────────────────────────────────────────────────────

/**
 * Rakibin hangi alanda yeni proje başlatacağını belirler.
 * Güçlü alan + az rekabet + Nobel fırsatı kombinasyonu.
 *
 * @param {Object} rival
 * @param {Object} state
 * @param {Object} profile
 * @returns {string|null}  alan ID'si veya null
 */
function evaluateBestField(rival, state, profile) {
  const candidates = rival.strengths.map(field => ({
    field,
    score: calcFieldOpportunityScore(rival, field, state),
  }));

  // Skor 40'ın altındaysa hiç başlatma
  const viable = candidates.filter(c => c.score >= 40);
  if (viable.length === 0) return null;

  // En yüksek skoru seç (küçük rastlantı faktörü)
  const best = viable.sort((a, b) => {
    const scoreA = b.score * (0.85 + Math.random() * 0.30);
    const scoreB = a.score * (0.85 + Math.random() * 0.30);
    return scoreA - scoreB;
  })[0];

  return best?.field ?? null;
}

/**
 * Bir alan için fırsat skoru hesaplar.
 * Yüksek skor → bu alanda proje başlat.
 *
 * @param {Object} rival
 * @param {string} field
 * @param {Object} state
 * @returns {number}  0-100
 */
function calcFieldOpportunityScore(rival, field, state) {
  let score = 0;

  // Güçlü alan bonusu
  const fieldStrength = getRivalFieldStrength(rival.id, field);
  score += fieldStrength * 0.4;

  // Oyuncunun bu alanda aktif projesi yoksa fırsat
  const playerActive = state.projects.active.filter(p => p.field === field).length;
  score += Math.max(0, 20 - playerActive * 10);

  // Nobel skoru bu alanda düşükse potansiyel büyük
  const currentNobelScore = state.lab.nobelScores[field] ?? 0;
  if (currentNobelScore < NOBEL.SIGNAL_THRESHOLD) score += 20;

  // Rakibin bu alanda zaten aktif projesi varsa azalt
  const rivalActiveInField = rival.activeProjects.filter(p => p.field === field).length;
  score -= rivalActiveInField * 15;

  return Math.max(0, Math.min(100, score));
}

// ─── RAKİP PROJE YÖNETİMİ ────────────────────────────────────────────────────

/**
 * Rakip yeni proje başlatır.
 *
 * @param {Object} rival
 * @param {string} field
 * @param {Object} profile
 * @param {Object} state
 */
function startRivalProject(rival, field, profile, state) {
  const type  = pickRandom(profile.preferredTypes);
  const id    = `rival_${rival.id}_${Date.now()}`;
  const label = pickRandom(getRivalProjectTitles(field));

  rival.activeProjects.push({
    id,
    label,
    type,
    field,
    phase:        'hypothesis',
    progress:     0,
    _budgetBoost: 1.0,
  });

  // Oyuncu aynı alanda çalışıyorsa yarış uyarısı
  const playerInField = state.projects.active.some(p => p.field === field);
  if (playerInField) {
    addNotification(
      `${rival.short} ${FIELDS[field]?.label ?? field} alanında yeni araştırma başlattı.`,
      'warning', 4
    );
  }

  EventBus.emit('rival:project_started', { rival, field, type });
}

/**
 * Rakip projeyi haftalık ilerletir.
 * İlerleme hızı: alan gücü × bütçe boost × küçük rastlantı.
 *
 * @param {Object} project
 * @param {Object} rival
 * @param {Object} state
 */
function advanceRivalProject(project, rival, state) {
  const fieldStrength = getRivalFieldStrength(rival.id, project.field);
  const baseProgress  = fieldStrength * 0.15;  // haftalık ilerleme
  const boost         = project._budgetBoost ?? 1.0;
  const noise         = 0.8 + Math.random() * 0.4;

  project.progress = Math.min(100, project.progress + baseProgress * boost * noise);

  // Faz güncelle (görsel için)
  project.phase = getPhaseFromProgress(project.progress);
}

/**
 * Rakip proje tamamlandığında yayımlar.
 * Nobel puanı birikir, oyuncuya bildirim gider.
 *
 * @param {Object} project
 * @param {Object} rival
 * @param {Object} state
 */
function publishRivalProject(project, rival, state) {
  const def    = RIVAL_DEFS[rival.id];
  const typeDef = PROJECT_TYPES[project.type] ?? PROJECT_TYPES.basic;

  // Sahte IF hesabı (rakipler için basitleştirilmiş)
  const if_  = randInt(5, 45);
  const qual  = randInt(55, 90);

  // Nobel puanı birikimi
  const points = Math.round((if_ * 2 + qual * 0.3) * typeDef.nobelCoeff);
  rival.nobelScore = (rival.nobelScore ?? 0) + points;

  rival.publications = rival.publications ?? [];
  rival.publications.push({
    id:           `rpub_${Date.now()}`,
    field:        project.field,
    year:         state.time.year,
    impactFactor: if_,
    quality:      qual,
  });

  EventBus.emit('rival:published', { rival, project, points });
  EventBus.emit('rival:nobel_score_updated', {
    rivalId: rival.id,
    score:   rival.nobelScore,
  });

  // Oyuncu aynı alandaysa bildir
  const playerInField = state.projects.active.some(p => p.field === project.field);
  if (playerInField) {
    addNotification(
      `${rival.short} "${project.label}" yayımladı. (IF: ${if_})`,
      'info', 4
    );
  }
}

// ─── NOBEL PUAN GÜNCELLEMESİ ─────────────────────────────────────────────────

/**
 * Yıl sonu tüm rakiplerin Nobel puanını günceller.
 * Yıllık aralık + prestige bonusu.
 * GDD v3.0 §11 Denge Parametreleri referansı.
 *
 * @param {Object} state
 */
function updateRivalNobelScores(state) {
  for (const rival of Object.values(state.rivals)) {
    const def        = RIVAL_DEFS[rival.id];
    const [min, max] = def.yearlyNobelRange;
    const yearlyGain = randInt(min, max);

    // Prestij bonusu: yüksek prestijli rakip daha hızlı büyür
    const prestigeBonus = Math.round(rival.prestige * 0.02);
    rival.nobelScore    = (rival.nobelScore ?? 0) + yearlyGain + prestigeBonus;

    EventBus.emit('rival:nobel_score_updated', {
      rivalId: rival.id,
      score:   rival.nobelScore,
      yearly:  yearlyGain,
    });
  }

  // Nobel adaylık kontrolü — oyuncu için
  checkNobelMilestones(state);
}

/**
 * Oyuncunun Nobel eşiklerini geçip geçmediğini kontrol eder.
 * GDD v3.0 §7.2 Nobel Adaylık Süreci.
 *
 * @param {Object} state
 */
function checkNobelMilestones(state) {
  const totalScore = Object.values(state.lab.nobelScores ?? {})
    .reduce((s, v) => s + v, 0);

  const nobel = state.nobel;

  if (!nobel.hasSignal && totalScore >= NOBEL.SIGNAL_THRESHOLD) {
    nobel.hasSignal = true;
    queueEvent({
      id:          'nobel_signal',
      category:    'world',
      label:       'Nobel Sinyali',
      description: `Araştırmanız uluslararası akademik çevrelerin dikkatini çekiyor. Nobel komitesinin radarına girdiniz. (Toplam skor: ${Math.round(totalScore)})`,
      choices: [{ id: 'acknowledge', label: 'Heyecan verici!', effect: { type: 'none' } }],
    });
    addNotification('Nobel komitesi sizi fark etti!', 'success', 8);
    EventBus.emit('nobel:signal', { score: totalScore });
  }

  if (!nobel.onLongList && totalScore >= NOBEL.LONGLIST_THRESHOLD) {
    nobel.onLongList = true;
    queueEvent({
      id:          'nobel_longlist',
      category:    'world',
      label:       'Nobel Uzun Listesi',
      description: `Laboratuvarınız Nobel uzun listesine girdi! En iyi 50 kurum arasındasınız. (Skor: ${Math.round(totalScore)})`,
      choices: [{ id: 'acknowledge', label: 'Harika haber!', effect: { type: 'none' } }],
    });
    addNotification('Nobel uzun listesine girdiniz!', 'success', 8);
    EventBus.emit('nobel:longlist', { score: totalScore });
  }

  if (!nobel.onShortList && totalScore >= NOBEL.SHORTLIST_THRESHOLD) {
    // Kısa liste sıralaması — rakiplere göre pozisyon belirle
    const ranking = getRankingPosition(totalScore, state.rivals);
    if (ranking <= NOBEL.SHORTLIST_SIZE) {
      nobel.onShortList       = true;
      nobel.shortListPosition = ranking;
      queueEvent({
        id:          'nobel_shortlist',
        category:    'world',
        label:       'Nobel Kısa Listesi',
        description: `İnanılmaz! Laboratuvarınız Nobel kısa listesinde ${ranking}. sıraya yerleşti. Yalnızca 6 finalist arasındasınız.`,
        choices: [{ id: 'acknowledge', label: 'Tarihi an!', effect: { type: 'none' } }],
      });
      addNotification(`Nobel kısa listesi: ${ranking}. sıra!`, 'success', 0);
      EventBus.emit('nobel:shortlist', { score: totalScore, position: ranking });
    }
  }

  // Nobel kazanma kontrolü
  if (!nobel.won && totalScore >= NOBEL.WIN_THRESHOLD && state.time.year >= 8) {
    checkNobelWin(totalScore, state);
  }
}

/**
 * Nobel kazanma kararı.
 * En yüksek puan kazanır — küçük rastlantı faktörü var.
 * GDD v3.0 §7.2 nobelDecision formülü.
 *
 * @param {number} playerScore
 * @param {Object} state
 */
function checkNobelWin(playerScore, state) {
  // Tüm adaylar: oyuncu + rakipler
  const candidates = [
    { id: 'PLAYER', score: playerScore * (0.9 + Math.random() * 0.2), isPlayer: true },
    ...Object.values(state.rivals).map(r => ({
      id:    r.id,
      score: (r.nobelScore ?? 0) * (0.9 + Math.random() * 0.2),
      isPlayer: false,
    })),
  ];

  candidates.sort((a, b) => b.score - a.score);
  const winner = candidates[0];

  if (winner.isPlayer) {
    // Hangi alanda kazandı? En yüksek puanlı alan
    const winField = Object.entries(state.lab.nobelScores ?? {})
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'physics';

    state.nobel.won      = true;
    state.nobel.wonField = winField;
    state.nobel.wonYear  = state.time.year;

    queueEvent({
      id:          'nobel_won',
      category:    'world',
      label:       'Nobel Ödülü!',
      description: `TEBRİKLER! Laboratuvarınız ${FIELDS[winField]?.label ?? winField} alanında Nobel Ödülü kazandı! ${state.time.year}. yılınızda tarihe geçtiniz.`,
      choices: [{ id: 'celebrate', label: 'Tarihe geçtik!', effect: { type: 'none' } }],
    });
    addNotification('🏅 NOBEL ÖDÜLÜ KAZANILDI!', 'success', 0);
    EventBus.emit('nobel:won', { field: winField, year: state.time.year });
  } else {
    // Rakip kazandı
    const rivalDef = RIVAL_DEFS[winner.id];
    const winField = rivalDef?.strengths[0] ?? 'physics';

    queueEvent({
      id:          `rival_nobel_${winner.id}_${state.time.year}`,
      category:    'world',
      label:       'Rakip Nobel Kazandı',
      description: `${rivalDef?.label ?? winner.id}, ${FIELDS[winField]?.label ?? winField} alanında Nobel Ödülü kazandı. Bu alandaki fonlar artacak — siz de hızlanmalısınız.`,
      choices: [{ id: 'acknowledge', label: 'Devam et', effect: { type: 'rival_won_field', field: winField } }],
    });
    addNotification(
      `${rivalDef?.short ?? winner.id} Nobel kazandı. Yarış sürüyor.`,
      'warning', 6
    );
    EventBus.emit('rival:nobel_won', { rivalId: winner.id, field: winField });
  }
}

// ─── TRANSFER DÖNEMİ ─────────────────────────────────────────────────────────

/**
 * Ocak ayında rakipler araştırmacı teklifleri yapar.
 * researchers.js'deki transferPeriod ile koordineli çalışır.
 * GDD v3.0 §6.4 Transfer Sistemi.
 *
 * @param {Object} state
 */
function runRivalTransferOffers(state) {
  for (const rival of Object.values(state.rivals)) {
    const def     = RIVAL_DEFS[rival.id];
    const profile = STRATEGY_PROFILES[rival.strategy];

    // Transfer saldırganlığına göre kaç araştırmacıya teklif yapılır
    const targetCount = chance(profile.transferAggression) ? randInt(1, 2) : 0;
    if (targetCount === 0) continue;

    // En değerli araştırmacıları hedefle (RP + alan uyumu)
    const targets = [...state.researchers]
      .filter(r => !r.isBurnout && !r.isOnLeave)
      .sort((a, b) => {
        const aScore = a.RP + (def.strengths.includes(a.field) ? 30 : 0);
        const bScore = b.RP + (def.strengths.includes(b.field) ? 30 : 0);
        return bScore - aScore;
      })
      .slice(0, targetCount);

    for (const researcher of targets) {
      // Rakip en az %20 zam teklif eder
      const offerSalary = Math.round(
        researcher.salary * (BALANCE.RIVAL_OFFER_MIN_MULT + Math.random() * 0.3)
      );

      // Transfer event'i researchers.js tarafından işlenir
      // Burada sadece emit yapıyoruz
      EventBus.emit('rival:transfer_offer', {
        rival,
        researcher,
        offerSalary,
      });
    }
  }
}

// ─── YARDIMCILAR ─────────────────────────────────────────────────────────────

/**
 * Oyuncu aynı alanda bu projeyle yarışıyor mu?
 * @param {Object} rivalProject
 * @param {Object} state
 * @returns {boolean}
 */
function isRacingWithPlayer(rivalProject, state) {
  return state.projects.active.some(
    p => p.field === rivalProject.field && p.phase === 'datacollect'
  );
}

/**
 * İlerleme yüzdesinden faz adı döner (görsel için).
 * @param {number} progress  0-100
 * @returns {string}
 */
function getPhaseFromProgress(progress) {
  if (progress < 15) return 'hypothesis';
  if (progress < 25) return 'literature';
  if (progress < 38) return 'design';
  if (progress < 58) return 'datacollect';
  if (progress < 70) return 'analysis';
  if (progress < 82) return 'writing';
  if (progress < 92) return 'peerreview';
  if (progress < 98) return 'revision';
  return 'publication';
}

/**
 * Oyuncunun tüm adaylar arasındaki Nobel sırasını döner.
 * @param {number} playerScore
 * @param {Object} rivals
 * @returns {number}  1'den başlar
 */
function getRankingPosition(playerScore, rivals) {
  const allScores = Object.values(rivals).map(r => r.nobelScore ?? 0);
  const higher    = allScores.filter(s => s > playerScore).length;
  return higher + 1;
}

/**
 * Alan için rakip proje başlığı havuzu.
 * @param {string} field
 * @returns {string[]}
 */
function getRivalProjectTitles(field) {
  const titles = {
    physics:   ['Kuantum Hesaplama Algoritması', 'Topografik Yalıtkan Araştırması', 'Plazma Fiziği Modeli'],
    chemistry: ['Katalizör Sentez Optimizasyonu', 'Biyopolimer Reaksiyon Kinetiği', 'Elektrokimyasal Depolama'],
    medicine:  ['Nörodejeneratif Hastalık Belirteçleri', 'İmmünoterapi Protokolü', 'Klinik Genomik Çalışma'],
    biology:   ['Epigenetik Saat Mekanizması', 'Mikrobiyom Çeşitlilik Analizi', 'CRISPR Hedefleme Doğruluğu'],
    economics: ['Dijital Piyasa Dinamikleri', 'Kurumsal Yönetim Etkisi', 'Finansal Ağ Kırılganlığı'],
    climate:   ['Karbon Tutum Kapasitesi', 'Okyanus Isı İçeriği Değişimi', 'Permafrost Sera Gazı Salımı'],
    peace:     ['Barış Süreci Sağlamlığı', 'Çatışma Sonrası Ekonomik Toparlanma', 'Silahsızlanma Uyum Analizi'],
  };
  return titles[field] ?? ['Araştırma Projesi'];
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

/**
 * Rakiplerin mevcut Nobel sıralamasını döner.
 * right.js paneli tarafından kullanılır.
 *
 * @returns {Array<{ id, short, label, color, nobelScore, isPlayer }>}
 */
export function getRivalRanking() {
  const state       = getState();
  const playerTotal = Object.values(state.lab.nobelScores ?? {})
    .reduce((s, v) => s + v, 0);

  const entries = Object.values(state.rivals).map(r => ({
    id:         r.id,
    short:      r.short ?? r.id,
    label:      r.label,
    color:      RIVAL_DEFS[r.id]?.color ?? '#8888aa',
    nobelScore: Math.round(r.nobelScore ?? 0),
    activeProjects: r.activeProjects?.length ?? 0,
    isPlayer:   false,
  }));

  entries.push({
    id:             'PLAYER',
    short:          'SİZ',
    label:          state.lab.name || 'Laboratuvarınız',
    color:          '#f0c060',
    nobelScore:     Math.round(playerTotal),
    activeProjects: state.projects.active.length,
    isPlayer:       true,
  });

  return entries.sort((a, b) => b.nobelScore - a.nobelScore);
}

/**
 * Belirli bir rakibin detay bilgisini döner.
 * @param {string} rivalId
 * @returns {Object|null}
 */
export function getRivalDetail(rivalId) {
  const state = getState();
  return state.rivals[rivalId] ?? null;
}
