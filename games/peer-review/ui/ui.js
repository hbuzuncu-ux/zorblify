/**
 * PEER REVIEW — ui.js
 * Genel UI orchestrator.
 * Topbar güncelleme, bildirim kuyruğu, bottombar buton yönetimi,
 * oyun bitiş ekranı, tutorial ipuçları.
 * index.html ile koordineli çalışır — DOM elementleri oradan gelir.
 * GDD v3.0 §9 Görsel & UI Mimarisi referansı.
 */

'use strict';

import { FIELDS, COLORS } from '../../utils/constants.js';
import {
  getState,
  addNotification,
  pruneNotifications,
} from '../../core/state.js';
import {
  EventBus,
  advanceOneWeek,
  startAutoAdvance,
  stopAutoAdvance,
  isAutoAdvancing,
  manualSave,
} from '../../core/game.js';

// ─── BAŞLATMA ─────────────────────────────────────────────────────────────────

/**
 * UI sistemini başlatır.
 * index.html'deki script bloğundan launchGame() içinde çağrılır.
 */
export function initUI() {
  bindTopbar();
  bindBottombar();
  startTopbarTick();
  startNotificationTick();
  registerUIEvents();
}

// ─── TOPBAR ───────────────────────────────────────────────────────────────────

function bindTopbar() {
  document.getElementById('topbar-save-btn')
    ?.addEventListener('click', () => {
      manualSave();
    });
}

/**
 * Topbar'ı EventBus event'lerine abone eder.
 * Her anlamlı değişiklikte güncellenir — sürekli polling yok.
 */
function startTopbarTick() {
  updateTopbar();

  const events = [
    'game:week_end',
    'game:month_end',
    'lab:prestige_changed',
    'economy:month_tick',
    'nobel:score_updated',
    'nobel:signal',
    'nobel:longlist',
    'nobel:shortlist',
  ];

  events.forEach(evt => EventBus.on(evt, updateTopbar));
}

/**
 * Topbar'ı mevcut state ile günceller.
 */
function updateTopbar() {
  const state = getState();
  if (!state) return;

  // Lab adı
  setEl('topbar-lab-name', state.lab.name || 'Laboratuvar');

  // Zaman
  setEl('topbar-time', `Yıl ${state.time.year}, Ay ${state.time.month}, H${state.time.week}`);

  // Bütçe — renkli
  const budget    = state.lab.budget;
  const budgetEl  = document.getElementById('topbar-budget');
  if (budgetEl) {
    budgetEl.textContent = formatBudget(budget);
    budgetEl.style.color =
      budget > 10000 ? COLORS.medicine   :   // yeşil
      budget > 3000  ? COLORS.gold       :   // sarı
                       COLORS.danger;         // kırmızı
  }

  // Prestij
  const prestige    = state.lab.prestige;
  const prestigePct = Math.min(100, Math.round(prestige / 10));
  const fillEl      = document.getElementById('topbar-prestige-fill');
  const valEl       = document.getElementById('topbar-prestige-val');
  if (fillEl) fillEl.style.width = prestigePct + '%';
  if (valEl)  valEl.textContent  = prestige;

  // Nobel toplam skoru
  const nobelTotal = Object.values(state.lab.nobelScores ?? {})
    .reduce((s, v) => s + v, 0);
  const nobelEl = document.getElementById('topbar-nobel-score');
  if (nobelEl) {
    nobelEl.textContent = Math.round(nobelTotal);
    // Nobel milestone'larında renk değişimi
    nobelEl.style.color =
      state.nobel.won         ? '#f0c060' :
      state.nobel.onShortList ? '#fbbf24' :
      state.nobel.onLongList  ? '#a78bfa' :
      state.nobel.hasSignal   ? '#4ade80' :
                                '#8888aa';
  }
}

// ─── BOTTOMBAR ────────────────────────────────────────────────────────────────

const TIPS = [
  'İpucu: Araştırmacı moralini yüksek tut.',
  'İpucu: Ekip uyumu üretimi %20 artırabilir.',
  'İpucu: Temel araştırma Nobel puanı için en güçlü.',
  'İpucu: Burnout başlamadan izin ver.',
  'İpucu: Hibe başvurularını zamanında yap.',
  'İpucu: Ekipman bakımını ihmal etme.',
  'İpucu: Rakibin güçlü olduğu alanda niş bul.',
  'İpucu: Saha araştırması en yüksek Nobel katsayısına sahip.',
  'İpucu: Etik puanı düşük araştırmacı retraction riski taşır.',
  'İpucu: Senior araştırmacıların moralini gözlemle.',
  'İpucu: İşbirliği projeleri maliyeti paylaşır.',
  'İpucu: Yüksek IF dergilere göndermek daha fazla citation getirir.',
];

let _tipIndex   = 0;
let _tipTimer   = null;

function bindBottombar() {
  const advBtn  = document.getElementById('btn-advance');
  const autoBtn = document.getElementById('btn-auto');

  if (!advBtn || !autoBtn) return;

  // Manuel ilerleme
  advBtn.addEventListener('click', () => {
    if (!advBtn.disabled) advanceOneWeek();
  });

  // Touch desteği
  advBtn.addEventListener('touchend', e => {
    e.preventDefault();
    if (!advBtn.disabled) advanceOneWeek();
  });

  // Otomatik mod toggle
  autoBtn.addEventListener('click', toggleAutoMode);
  autoBtn.addEventListener('touchend', e => {
    e.preventDefault();
    toggleAutoMode();
  });

  // İpucu rotasyonu
  rotateTip();
  _tipTimer = setInterval(rotateTip, 15000);
}

function toggleAutoMode() {
  const autoBtn = document.getElementById('btn-auto');
  if (!autoBtn) return;

  if (isAutoAdvancing()) {
    stopAutoAdvance();
    autoBtn.classList.remove('active');
    autoBtn.textContent = '▶▶ Otomatik';
  } else {
    startAutoAdvance();
    autoBtn.classList.add('active');
    autoBtn.textContent = '⏸ Durdur';
  }
}

function rotateTip() {
  _tipIndex = (_tipIndex + 1) % TIPS.length;
  setEl('bottombar-tip', TIPS[_tipIndex]);
}

// ─── BUTON DURUMU YÖNETİMİ ───────────────────────────────────────────────────

/**
 * Event beklenirken ilerleme butonlarını devre dışı bırakır.
 */
function registerUIEvents() {
  EventBus.on('event:pending', () => {
    setButtonsDisabled(true);
    // İpucu güncelle
    setEl('bottombar-tip', '⚡ Karar bekleniyor — seçimini yap.');
  });

  EventBus.on('event:resolved', () => {
    const state = getState();
    if (state.events.pending.length === 0) {
      setButtonsDisabled(false);
      rotateTip();
    }
  });

  EventBus.on('game:paused', () => {
    setButtonsDisabled(true);
  });

  EventBus.on('game:resumed', () => {
    setButtonsDisabled(false);
  });

  EventBus.on('game:over', ({ reason }) => {
    setButtonsDisabled(true);
    if (_tipTimer) clearInterval(_tipTimer);
    showEndScreen(reason);
  });

  // Otomatik mod durduğunda butonu sıfırla
  EventBus.on('game:paused', () => {
    const autoBtn = document.getElementById('btn-auto');
    if (autoBtn) {
      autoBtn.classList.remove('active');
      autoBtn.textContent = '▶▶ Otomatik';
    }
  });
}

function setButtonsDisabled(disabled) {
  const advBtn  = document.getElementById('btn-advance');
  const autoBtn = document.getElementById('btn-auto');
  if (advBtn)  advBtn.disabled  = disabled;
  if (autoBtn) autoBtn.disabled = disabled;
}

// ─── BİLDİRİM SİSTEMİ ────────────────────────────────────────────────────────

/**
 * State'deki bildirimleri düzenli aralıklarla ekrana taşır.
 * state.js addNotification() ile eklenir, burada render edilir.
 */
function startNotificationTick() {
  // Her hafta sonu bildirimleri flush et
  EventBus.on('game:week_end', flushNotifications);
  EventBus.on('game:month_end', flushNotifications);
}

function flushNotifications() {
  const state = getState();
  if (!state.ui?.notifications?.length) return;

  for (const n of [...state.ui.notifications]) {
    renderNotification(n.text, n.type);
  }
  // Bildirimleri temizle
  pruneNotifications();
  state.ui.notifications = [];
}

/**
 * Anlık bildirim göster (EventBus üzerinden doğrudan tetiklenir).
 */
export function showNotification(text, type = 'info', ttl = 5) {
  renderNotification(text, type, ttl);
}

function renderNotification(text, type = 'info', ttl = 5) {
  const container = document.getElementById('notifications');
  if (!container) return;

  const el = document.createElement('div');
  el.className   = `notif notif--${type}`;
  el.textContent = text;
  container.appendChild(el);

  // Maksimum 6 bildirim — eskisini sil
  const notifs = container.querySelectorAll('.notif');
  if (notifs.length > 6) notifs[0].remove();

  // TTL sonunda sil
  const ms = type === 'danger' ? 8000
           : type === 'success' ? 5000
           : (ttl * 1000);

  setTimeout(() => {
    el.classList.add('notif--exit');
    setTimeout(() => el.remove(), 300);
  }, ms);
}

// ─── OYUN BİTİŞ EKRANI ───────────────────────────────────────────────────────

function showEndScreen(reason) {
  const state     = getState();
  const endScreen = document.getElementById('end-screen');
  const endTitle  = document.getElementById('end-title');
  const endStats  = document.getElementById('end-stats');

  if (!endScreen) return;

  const titles = {
    nobel_won:  '🏅 Nobel Ödülü Kazanıldı!',
    time_limit: '⏰ Süre Doldu',
    bankrupt:   '💸 Bütçe Tükendi',
    manual:     '🔬 Oyun Kaydedildi',
  };

  endTitle.textContent     = titles[reason] ?? 'Oyun Bitti';
  endTitle.style.color     = reason === 'nobel_won' ? '#f0c060' : '#f0f0ff';

  const nobelTotal = Object.values(state.lab.nobelScores ?? {})
    .reduce((s, v) => s + v, 0);

  // En iyi alan
  const topField = Object.entries(state.lab.nobelScores ?? {})
    .sort((a, b) => b[1] - a[1])[0];
  const topFieldLabel = topField
    ? `${FIELDS[topField[0]]?.label ?? topField[0]} (${Math.round(topField[1])})`
    : '—';

  const stats = [
    { k: 'Laboratuvar',       v: state.lab.name || '—' },
    { k: 'Toplam Süre',       v: `${state.time.year} yıl` },
    { k: 'Yayın Sayısı',      v: state.stats.totalPublications },
    { k: 'Toplam Citation',   v: state.stats.totalCitations.toLocaleString('tr-TR') },
    { k: 'Nobel Skoru',       v: Math.round(nobelTotal) },
    { k: 'Güçlü Alan',        v: topFieldLabel },
    { k: 'En Yüksek IF',      v: state.stats.highestIF?.toFixed(1) ?? '0.0' },
    { k: 'Zirve Prestij',     v: state.stats.peakPrestige },
    { k: 'İşe Alınan',        v: state.stats.totalResearchersHired },
    { k: 'Kaybedilen',        v: state.stats.totalResearchersLost },
  ];

  endStats.innerHTML = stats.map(item => `
    <div class="end-stat">
      <span class="end-stat__k">${item.k}</span>
      <span class="end-stat__v">${item.v}</span>
    </div>
  `).join('');

  endScreen.classList.add('visible');
}

// ─── YARDIMCILAR ─────────────────────────────────────────────────────────────

/**
 * ID'ye göre element içeriğini günceller.
 * @param {string} id
 * @param {string} text
 */
function setEl(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

/**
 * Bütçeyi Türkçe formatlar.
 * @param {number} budget
 * @returns {string}
 */
function formatBudget(budget) {
  if (budget < 0) return `−${Math.abs(budget).toLocaleString('tr-TR')}`;
  return budget.toLocaleString('tr-TR');
}
