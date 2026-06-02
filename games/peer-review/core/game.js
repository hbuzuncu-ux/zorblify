/**
 * PEER REVIEW — game.js
 * Ana oyun döngüsü ve zaman motoru.
 * Modüller arası iletişim Event Bus üzerinden yürür —
 * hiçbir modül başka bir modülü doğrudan çağırmaz.
 * GDD v3.0 §2 Temel Oyun Döngüsü + §10.3 Event Bus referansıyla üretilmiştir.
 */

'use strict';

import { TIME, EVENTS, BALANCE } from '../utils/constants.js';
import {
  getState,
  initState,
  updateState,
  advanceWeek,
  queueEvent,
  dequeueEvent,
  addNotification,
} from './state.js';
import { saveGame, autoSave, loadGame, loadSettings } from './save.js';

// ─── EVENT BUS ────────────────────────────────────────────────────────────────

/**
 * Modüller arası iletişim katmanı.
 * Gönderen modül emit() çağırır, dinleyen modül on() ile abone olur.
 * Hiçbir modül başka modülü import etmez — sadece EventBus kullanır.
 *
 * Tanımlı event'ler:
 *   game:week_start      { state }
 *   game:week_end        { state, newMonth, newYear }
 *   game:month_end       { state }
 *   game:year_end        { state }
 *   game:paused          {}
 *   game:resumed         {}
 *   game:over            { reason }
 *   game:saved           { success }
 *   researcher:burnout   { researcher }
 *   researcher:leaving   { researcher, offer }
 *   researcher:left      { researcher }
 *   project:complete     { project, publication }
 *   project:failed       { project }
 *   project:racing       { project, rival }
 *   event:pending        { event }
 *   event:resolved       { event, choiceId }
 *   budget:critical      { budget }
 *   budget:bankrupt      {}
 *   nobel:signal         { field, score }
 *   nobel:longlist       { position }
 *   nobel:shortlist      { position }
 *   nobel:won            { field, year }
 *   retraction:occurred  { paper, researcher }
 *   ui:notification      { text, type }
 */
export const EventBus = {
  _listeners: {},

  /**
   * Event dinleyici kaydeder.
   * @param {string}   event
   * @param {Function} callback
   * @returns {Function}  abonelikten çıkmak için çağrılacak fonksiyon
   */
  on(event, callback) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(callback);
    // Unsubscribe fonksiyonu döner
    return () => {
      this._listeners[event] = this._listeners[event].filter(cb => cb !== callback);
    };
  },

  /**
   * Event'i tüm dinleyicilere iletir.
   * @param {string} event
   * @param {any}    data
   */
  emit(event, data = {}) {
    const listeners = this._listeners[event];
    if (!listeners || listeners.length === 0) return;
    listeners.forEach(cb => {
      try {
        cb(data);
      } catch (err) {
        console.error(`[EventBus] ${event} handler hatası:`, err);
      }
    });
  },

  /**
   * Tüm dinleyicileri temizler (test / yeni oyun için).
   */
  clear() {
    this._listeners = {};
  },
};

// ─── OYUN MOTORU ─────────────────────────────────────────────────────────────

/**
 * Oyun motoru iç state'i.
 * Dışarıdan doğrudan erişilmemeli.
 */
const Engine = {
  isRunning:      false,
  isPaused:       false,
  isWaitingEvent: false,   // bekleyen karar varsa zaman durur
  autoAdvance:    false,
  autoTimer:      null,    // setInterval handle
  settings:       null,
  autoSaveCounter: 0,      // otosave sayacı (hafta)
};

// ─── BAŞLATMA ─────────────────────────────────────────────────────────────────

/**
 * Oyunu başlatır.
 * Kayıtlı oyun varsa yükler, yoksa yeni oyun kurar.
 *
 * @param {string|null} labName  — yeni oyun için lab adı
 * @returns {Object}  başlangıç state'i
 */
export function startGame(labName = null) {
  Engine.settings = loadSettings();

  const savedState = loadGame();

  if (savedState && !labName) {
    // Kayıtlı oyunu yükle
    initState(savedState);
    addNotification('Oyun yüklendi.', 'info', 3);
  } else {
    // Yeni oyun
    initState(null);
    if (labName) updateState('lab.name', labName);
    addNotification(`${labName || 'Laboratuvarın'} kuruldu. İyi araştırmalar!`, 'success', 5);
  }

  Engine.isRunning = true;
  Engine.isPaused  = false;
  Engine.autoSaveCounter = 0;

  EventBus.emit('game:week_start', { state: getState() });

  return getState();
}

/**
 * Oyunu duraklatır.
 */
export function pauseGame() {
  if (!Engine.isRunning || Engine.isPaused) return;
  Engine.isPaused = true;
  stopAutoAdvance();
  EventBus.emit('game:paused');
}

/**
 * Duraklatılmış oyunu devam ettirir.
 */
export function resumeGame() {
  if (!Engine.isRunning || !Engine.isPaused) return;
  Engine.isPaused = false;
  EventBus.emit('game:resumed');
  if (Engine.autoAdvance) startAutoAdvance();
}

/**
 * Oyunu kaydedip bitirir.
 */
export function endGame(reason = 'manual') {
  pauseGame();
  const success = saveGame(getState());
  EventBus.emit('game:saved', { success });
  EventBus.emit('game:over', { reason });
  Engine.isRunning = false;
}

// ─── ZAMAN KONTROLÜ ──────────────────────────────────────────────────────────

/**
 * Manuel ilerleme — oyuncu "1 Hafta İlerle" butonuna basar.
 * Bekleyen karar varsa ilerlemez.
 *
 * @returns {boolean}  ilerlendi mi
 */
export function advanceOneWeek() {
  if (!Engine.isRunning) return false;
  if (Engine.isPaused) return false;
  if (Engine.isWaitingEvent) return false;

  runWeeklyTick();
  return true;
}

/**
 * Otomatik ilerlemeyi açar — her 3 saniyede 1 hafta.
 * Bekleyen karar gelince otomatik durur.
 */
export function startAutoAdvance() {
  if (Engine.autoTimer) return;
  Engine.autoAdvance = true;
  updateState('ui.isAutoAdvance', true);

  Engine.autoTimer = setInterval(() => {
    if (Engine.isPaused || Engine.isWaitingEvent) return;
    runWeeklyTick();
  }, TIME.AUTO_ADVANCE_MS);
}

/**
 * Otomatik ilerlemeyi durdurur.
 */
export function stopAutoAdvance() {
  Engine.autoAdvance = false;
  updateState('ui.isAutoAdvance', false);

  if (Engine.autoTimer) {
    clearInterval(Engine.autoTimer);
    Engine.autoTimer = null;
  }
}

/**
 * Otomatik mod durumu.
 * @returns {boolean}
 */
export function isAutoAdvancing() {
  return Engine.autoAdvance && !Engine.isPaused;
}

// ─── HAFTALIK TICK ────────────────────────────────────────────────────────────

/**
 * Bir haftalık oyun döngüsünü çalıştırır.
 * GDD v3 §2 Mikro Loop (Haftalık) sırası korunur:
 *
 *   1. week_start event'i
 *   2. Random event kontrolü (%30 ihtimal)
 *   3. Bekleyen event varsa dur, karar bekle
 *   4. Sistem tick'leri (researchers, projects, economy, rivals)
 *   5. Zaman ilerle
 *   6. Ay/yıl geçiş kontrolleri
 *   7. Otomatik kayıt kontrolü
 *   8. Oyun bitiş kontrolü
 *   9. week_end event'i
 */
function runWeeklyTick() {
  const state = getState();

  EventBus.emit('game:week_start', { state });

  // ── 1. Random event kontrolü ─────────────────────────────────────────────
  const newEvent = checkForRandomEvent(state);
  if (newEvent) {
    queueEvent(newEvent);
    EventBus.emit('event:pending', { event: newEvent });
  }

  // Bekleyen karar varsa zamanı dondur
  const pending = state.events.pending;
  if (pending.length > 0) {
    Engine.isWaitingEvent = true;
    stopAutoAdvance();
    // UI modülü event'i yakalar ve modal açar
    // Karar verildikten sonra resolveEvent() çağrılır
    return;
  }

  // ── 2. Sistem tick'leri ──────────────────────────────────────────────────
  // Her sistem EventBus üzerinden dinler ve kendi tick'ini çalıştırır.
  // game.js bu sistemleri doğrudan çağırmaz.
  EventBus.emit('systems:tick', { state });

  // ── 3. Zaman ilerle ───────────────────────────────────────────────────────
  const { newMonth, newYear } = advanceWeek();

  // ── 4. Ay/yıl geçiş event'leri ───────────────────────────────────────────
  if (newMonth) {
    EventBus.emit('game:month_end', { state: getState() });
  }
  if (newYear) {
    handleYearEnd();
  }

  // ── 5. Otomatik kayıt ────────────────────────────────────────────────────
  Engine.autoSaveCounter++;
  if (Engine.autoSaveCounter >= Engine.settings.autoSaveInterval) {
    autoSave(getState());
    Engine.autoSaveCounter = 0;
  }

  // ── 6. Oyun bitiş kontrolü ───────────────────────────────────────────────
  const gameOverReason = checkGameOver(getState());
  if (gameOverReason) {
    endGame(gameOverReason);
    return;
  }

  EventBus.emit('game:week_end', {
    state: getState(),
    newMonth,
    newYear,
  });
}

// ─── EVENT ÇÖZÜMLEME ──────────────────────────────────────────────────────────

/**
 * Oyuncu bir event kararı verdiğinde çağrılır.
 * Karar uygulanır, zaman devam eder.
 *
 * @param {string} eventId
 * @param {string} choiceId
 */
export function resolveEvent(eventId, choiceId) {
  const state = getState();
  const eventIdx = state.events.pending.findIndex(e => e.id === eventId);
  if (eventIdx === -1) return;

  const [event] = state.events.pending.splice(eventIdx, 1);

  // Seçimi tarihçeye kaydet
  state.events.history.push({
    id: eventId,
    choiceId,
    week: state.time.totalWeeks,
    year: state.time.year,
  });

  EventBus.emit('event:resolved', { event, choiceId });

  // Başka bekleyen event kalmadıysa zamanı serbest bırak
  if (state.events.pending.length === 0) {
    Engine.isWaitingEvent = false;
    // Otomatik modda kaldıysa devam et
    if (Engine.autoAdvance && !Engine.isPaused) {
      startAutoAdvance();
    }
  }
}

// ─── YIL SONU ─────────────────────────────────────────────────────────────────

/**
 * Yıl sonu işlemleri.
 * Nobel değerlendirmesi, araştırmacı transfer dönemi,
 * bütçe özeti bu fonksiyondan emit edilir.
 */
function handleYearEnd() {
  const state = getState();

  EventBus.emit('game:year_end', { state });

  // Nobel kontrol (yıl 8'den itibaren)
  if (state.time.year >= 8) {
    EventBus.emit('nobel:check', { state });
  }

  // Transfer dönemi (Ocak = ay 1)
  if (state.time.month === BALANCE.TRANSFER_PERIOD_MONTH) {
    EventBus.emit('researchers:transfer_period', { state });
  }

  // Yıl sonu bütçe özeti
  EventBus.emit('economy:year_summary', { state });
}

// ─── RANDOM EVENT KONTROLÜ ───────────────────────────────────────────────────

/**
 * Bu hafta random event tetiklenecek mi?
 * %30 temel ihtimal — koşul sağlayan event havuzundan seçilir.
 * Gerçek event içeriği events.js modülü tarafından üretilir,
 * game.js sadece tetikleme kararını verir.
 *
 * @param {Object} state
 * @returns {Object|null}  event nesnesi veya null
 */
function checkForRandomEvent(state) {
  if (Math.random() > EVENTS.BASE_WEEKLY_CHANCE) return null;

  // EventBus üzerinden events.js'ten event ister
  let generatedEvent = null;
  const unsub = EventBus.on('events:generated', ({ event }) => {
    generatedEvent = event;
  });

  EventBus.emit('events:request', {
    state,
    categoryWeights: EVENTS.CATEGORY_WEIGHTS,
  });

  unsub();
  return generatedEvent;
}

// ─── OYUN BİTİŞ KONTROLÜ ─────────────────────────────────────────────────────

/**
 * Oyun bitmeli mi?
 *
 * Bitiş koşulları:
 *   - Nobel kazanıldı                 → 'nobel_won'
 *   - 30. yıla gelindi, Nobel yok     → 'time_limit'
 *   - Bütçe -2× aylık gider altına   → 'bankrupt' (economy.js tetikler)
 *
 * @param {Object} state
 * @returns {string|null}  bitiş sebebi veya null
 */
function checkGameOver(state) {
  if (state.nobel.won) return 'nobel_won';
  if (state.time.year > TIME.MAX_GAME_YEARS) return 'time_limit';
  return null;
}

// ─── MANUEL KAYDET ───────────────────────────────────────────────────────────

/**
 * Oyuncunun manuel kaydet butonuna basması.
 * @returns {boolean}
 */
export function manualSave() {
  const success = saveGame(getState());
  EventBus.emit('game:saved', { success });
  addNotification(
    success ? 'Oyun kaydedildi.' : 'Kayıt başarısız — depolama dolu olabilir.',
    success ? 'success' : 'danger',
    3
  );
  return success;
}

// ─── DEBUG YARDIMCILARI ───────────────────────────────────────────────────────
// Sadece geliştirme aşamasında kullanılır, prod'da çağrılmaz.

/**
 * N hafta hızlı ilerletir (test için).
 * @param {number} n
 */
export function debugAdvanceWeeks(n) {
  for (let i = 0; i < n; i++) {
    Engine.isWaitingEvent = false;  // event'leri atla
    runWeeklyTick();
  }
}

/**
 * Mevcut engine durumunu döner.
 * @returns {Object}
 */
export function debugGetEngineState() {
  return {
    isRunning:      Engine.isRunning,
    isPaused:       Engine.isPaused,
    isWaitingEvent: Engine.isWaitingEvent,
    autoAdvance:    Engine.autoAdvance,
    autoSaveCounter: Engine.autoSaveCounter,
  };
}
