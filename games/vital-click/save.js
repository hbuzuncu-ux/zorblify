/* ═══════════════════════════════════════════════
   VITAL CLICK — save.js
   localStorage save/load, state defaults,
   format helpers, offline earnings
═══════════════════════════════════════════════ */

'use strict';

const SAVE_KEY     = 'vitalclick_v1';
const SAVE_VERSION = 1;

// ── DEFAULT STATE ────────────────────────────────
// NOTE: 'timer' fields are runtime-only, never persisted.
// They are stripped on save and reset to 0 on load.
const DEFAULT_STATE = {
  version:      SAVE_VERSION,
  gold:         0,
  totalEarned:  0,      // cumulative gold ever earned (this run)
  totalClicks:  0,
  patients:     0,
  prestige:     0,
  prestigeMult: 1.0,
  clickPower:   1,
  bestClick:    0,
  playtime:     0,      // seconds, accumulated across sessions
  lastSaved:    null,

  upgrades: {
    stethoscope: 0,   // +3g/click,        max 5
    expertHands: 0,   // ×2 click power,   max 4
    aiAssist:    0,   // +10g/click,        max 3
    nanoMed:     0,   // ×5 click power,   max 2
    nightShift:  0,   // auto depts +50%,  max 3
    hospitalAI:  0,   // all cooldowns -20%, max 3
    speedBoost:  0,   // cooldowns -30%,   max 2
    quantumLab:  0,   // research ×3,      max 1
  },

  departments: {
    // timer is NOT saved — runtime only
    er:       { lv: 1, unlocked: true,  auto: false },
    icu:      { lv: 1, unlocked: false, auto: false },
    surgery:  { lv: 1, unlocked: false, auto: false },
    lab:      { lv: 1, unlocked: false, auto: false },
    pharma:   { lv: 1, unlocked: false, auto: false },
    research: { lv: 1, unlocked: false, auto: false },
  },

  achievements: {
    firstClick:    false,
    earn1k:        false,
    earn100k:      false,
    earn1m:        false,
    click100:      false,
    click1000:     false,
    allDepts:      false,
    firstPrestige: false,
  },

  stats: {
    totalPrestige:  0,
    longestSession: 0,   // seconds
    allTimeEarned:  0,   // gold across ALL prestige runs
  },
};

// ── HELPERS ──────────────────────────────────────

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function deepMerge(target, defaults) {
  for (const key of Object.keys(defaults)) {
    if (!(key in target)) {
      target[key] = deepClone(defaults[key]);
    } else if (
      typeof defaults[key] === 'object' &&
      defaults[key] !== null &&
      !Array.isArray(defaults[key])
    ) {
      if (typeof target[key] !== 'object' || target[key] === null) {
        target[key] = deepClone(defaults[key]);
      } else {
        deepMerge(target[key], defaults[key]);
      }
    }
  }
  return target;
}

// ── LOAD ─────────────────────────────────────────

function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return deepClone(DEFAULT_STATE);

    const parsed = JSON.parse(raw);

    // Version mismatch — migrate or reset
    if (parsed.version !== SAVE_VERSION) {
      console.warn('[save] Version mismatch, resetting save.');
      return deepClone(DEFAULT_STATE);
    }

    // Fill any missing keys from defaults
    const state = deepMerge(parsed, DEFAULT_STATE);

    // Runtime-only: reset all dept timers to 0 on load
    Object.keys(state.departments).forEach(k => {
      state.departments[k].timer = 0;
    });

    return state;
  } catch (e) {
    console.warn('[save] Failed to load, using defaults.', e);
    return deepClone(DEFAULT_STATE);
  }
}

// ── SAVE ─────────────────────────────────────────

function saveState(state) {
  try {
    // Strip runtime-only timer fields before writing
    const toWrite = deepClone(state);
    Object.keys(toWrite.departments).forEach(k => {
      delete toWrite.departments[k].timer;
    });
    toWrite.lastSaved = Date.now();
    localStorage.setItem(SAVE_KEY, JSON.stringify(toWrite));
    // Update original state's lastSaved too
    state.lastSaved = toWrite.lastSaved;
  } catch (e) {
    console.warn('[save] Failed to write to localStorage.', e);
  }
}

// ── RESET ────────────────────────────────────────

function resetState() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (e) {}
  return deepClone(DEFAULT_STATE);
}

// ── OFFLINE EARNINGS ─────────────────────────────

/**
 * Calculate gold earned while the game was closed.
 * Uses 50% of auto-income rate, capped at 8 hours.
 *
 * USAGE (in game.js):
 *   const gps = computeGPS(state);   // call after load
 *   const bonus = calcOfflineEarnings(state, gps);
 *   if (bonus > 0) { state.gold += bonus; showOfflineModal(bonus); }
 *
 * @param {object} state  — loaded game state
 * @param {number} gps    — gold per second (computed by game.js)
 * @returns {number}      — gold to award
 */
function calcOfflineEarnings(state, gps) {
  if (!state.lastSaved || gps <= 0) return 0;
  const elapsed = Math.floor((Date.now() - state.lastSaved) / 1000);
  if (elapsed < 30) return 0;                   // ignore very short gaps
  const capped = Math.min(elapsed, 8 * 3600);   // cap at 8 hours
  return Math.floor(gps * capped * 0.5);
}

// ── FORMAT HELPERS ───────────────────────────────

/**
 * Format a large number for display.
 * e.g. 1500 → "1.5K", 2000000 → "2.00M"
 */
function fmt(n) {
  n = Math.floor(n);
  if (n < 0)     return '0';          // guard: no negative gold display
  if (n >= 1e15) return (n / 1e15).toFixed(2) + 'Qa';
  if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9)  return (n / 1e9 ).toFixed(2) + 'B';
  if (n >= 1e6)  return (n / 1e6 ).toFixed(2) + 'M';
  if (n >= 1e3)  return (n / 1e3 ).toFixed(1) + 'K';
  return n.toLocaleString();
}

/**
 * Format seconds into human-readable duration.
 * e.g. 3720 → "1h 2m"
 */
function fmtTime(sec) {
  sec = Math.floor(sec);
  if (sec < 0) return '0s';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/**
 * Format a multiplier for display.
 * e.g. 1.5 → "×1.50"
 */
function fmtMult(n) {
  return '×' + n.toFixed(2);
}
