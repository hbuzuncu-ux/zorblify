/**
 * PEER REVIEW — save.js
 * localStorage tabanlı kaydet/yükle sistemi.
 * Android WebView'da localStorage çalışır — Capacitor eklentisi gerekmez.
 * GDD v3.0 §10.4 Android Uyumluluk Notları referansıyla üretilmiştir.
 */

'use strict';

import { INITIAL_STATE } from './state.js';

// ─── SABİTLER ─────────────────────────────────────────────────────────────────

const SAVE_KEY        = 'peerreview_v1';
const SAVE_VERSION    = '1.0.0';
const AUTOSAVE_KEY    = 'peerreview_autosave';
const SETTINGS_KEY    = 'peerreview_settings';

// UI state persist edilmez — bu alanlar save'den çıkarılır
const SKIP_SAVE_KEYS  = ['ui'];

// ─── KAYDET ──────────────────────────────────────────────────────────────────

/**
 * Oyun state'ini localStorage'a yazar.
 * UI state kaydedilmez. Son kayıt zamanı güncellenir.
 *
 * @param {Object} state  — getState() çıktısı
 * @returns {boolean}     — başarılı mı
 */
export function saveGame(state) {
  try {
    const saveData = buildSaveData(state);
    const serialized = JSON.stringify(saveData);
    localStorage.setItem(SAVE_KEY, serialized);
    return true;
  } catch (err) {
    console.error('[save.js] Kayıt başarısız:', err);
    // localStorage dolu olabilir — eski veriyi temizle, tekrar dene
    if (err.name === 'QuotaExceededError') {
      clearOldSaves();
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(buildSaveData(state)));
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}

/**
 * Otomatik kayıt — ana kayıt slotundan ayrı.
 * game.js her N haftada bir çağırır.
 *
 * @param {Object} state
 * @returns {boolean}
 */
export function autoSave(state) {
  try {
    const saveData = buildSaveData(state);
    saveData._isAutoSave = true;
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(saveData));
    return true;
  } catch {
    return false;
  }
}

// ─── YÜKLE ───────────────────────────────────────────────────────────────────

/**
 * Kayıtlı oyunu localStorage'dan yükler.
 * Bulunamazsa null döner — initState() bunu yakalar.
 *
 * @returns {Object|null}
 */
export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;

    const saveData = JSON.parse(raw);
    return migrateSave(saveData);
  } catch (err) {
    console.error('[save.js] Yükleme başarısız:', err);
    return null;
  }
}

/**
 * Otomatik kaydı yükler.
 * Ana kayıt bozuksa yedek olarak kullanılır.
 *
 * @returns {Object|null}
 */
export function loadAutoSave() {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return null;
    return migrateSave(JSON.parse(raw));
  } catch {
    return null;
  }
}

// ─── KAYIT DURUMU ─────────────────────────────────────────────────────────────

/**
 * Kayıtlı oyun var mı?
 * @returns {boolean}
 */
export function hasSave() {
  return localStorage.getItem(SAVE_KEY) !== null;
}

/**
 * Kayıt meta bilgisini döner (state yüklemeden).
 * Yeni oyun ekranında "kaldığın yer: Yıl 3, Ay 7" göstermek için.
 *
 * @returns {Object|null}  { year, month, week, labName, playTime, savedAt }
 */
export function getSaveMeta() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return {
      year:     data.time?.year     ?? 1,
      month:    data.time?.month    ?? 1,
      week:     data.time?.week     ?? 1,
      labName:  data.lab?.name      ?? '',
      playTime: data.meta?.playTime ?? 0,
      savedAt:  data.meta?.lastSaved ?? null,
    };
  } catch {
    return null;
  }
}

// ─── SİL ─────────────────────────────────────────────────────────────────────

/**
 * Kayıtlı oyunu siler (yeni oyun başlarken).
 */
export function deleteSave() {
  localStorage.removeItem(SAVE_KEY);
  localStorage.removeItem(AUTOSAVE_KEY);
}

// ─── AYARLAR ─────────────────────────────────────────────────────────────────

/**
 * Oyun ayarlarını kaydeder (ses, hız vb.).
 * Oyun state'inden bağımsız persist edilir.
 *
 * @param {Object} settings
 */
export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ayar kaydı kritik değil, sessizce geç
  }
}

/**
 * Kayıtlı ayarları yükler.
 * @returns {Object}  — bulunamazsa default ayarlar
 */
export function loadSettings() {
  const defaults = {
    autoSaveInterval: 4,   // her 4 haftada bir otomatik kayıt
    showTutorial: true,
    animationsEnabled: true,
    language: 'tr',
  };

  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaults;
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return defaults;
  }
}

// ─── MİGRASYON ────────────────────────────────────────────────────────────────

/**
 * Eski format kayıtları yeni versiyona taşır.
 * Her versiyon geçişi burada ele alınır.
 *
 * @param {Object} saveData
 * @returns {Object}  migrate edilmiş state
 */
function migrateSave(saveData) {
  const version = saveData.meta?.version ?? '0.0.0';

  // Versiyon eşleşiyorsa direkt döndür
  if (version === SAVE_VERSION) return saveData;

  console.info(`[save.js] Migration: ${version} → ${SAVE_VERSION}`);

  // v0.x → v1.0.0 geçişleri buraya eklenir
  // if (versionLessThan(version, '1.0.0')) { ... }

  // Eksik alanları INITIAL_STATE'ten tamamla
  const migrated = deepMergeDefaults(saveData, INITIAL_STATE);
  migrated.meta.version = SAVE_VERSION;

  return migrated;
}

// ─── İÇ YARDIMCILAR ──────────────────────────────────────────────────────────

/**
 * State'ten save edilecek veriyi hazırlar.
 * UI state çıkarılır, lastSaved güncellenir.
 *
 * @param {Object} state
 * @returns {Object}
 */
function buildSaveData(state) {
  const saveData = {};

  for (const key of Object.keys(state)) {
    if (SKIP_SAVE_KEYS.includes(key)) continue;
    saveData[key] = state[key];
  }

  // Runtime-only araştırmacı alanlarını temizle
  if (saveData.researchers) {
    saveData.researchers = saveData.researchers.map(r => {
      const clean = { ...r };
      delete clean._manipulated;  // runtime flag
      return clean;
    });
  }

  saveData.meta = {
    ...saveData.meta,
    lastSaved: Date.now(),
  };

  return saveData;
}

/**
 * Kayıtlı state ile varsayılan state'i derin merge eder.
 * Yeni eklenen alanlar eksikse default değerle gelir.
 *
 * @param {Object} saved
 * @param {Object} defaults
 * @returns {Object}
 */
function deepMergeDefaults(saved, defaults) {
  const result = { ...defaults };

  for (const key of Object.keys(saved)) {
    if (SKIP_SAVE_KEYS.includes(key)) continue;

    if (
      saved[key] !== null &&
      typeof saved[key] === 'object' &&
      !Array.isArray(saved[key]) &&
      defaults[key] !== null &&
      typeof defaults[key] === 'object'
    ) {
      result[key] = deepMergeDefaults(saved[key], defaults[key]);
    } else {
      result[key] = saved[key];
    }
  }

  return result;
}

/**
 * localStorage dolunca eski/gereksiz anahtarları temizler.
 */
function clearOldSaves() {
  // Sadece bu oyuna ait eski anahtarları temizle
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('peerreview_') && key !== SAVE_KEY && key !== SETTINGS_KEY) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));
}

/**
 * Nesnenin derin kopyası.
 * @param {any} obj
 * @returns {any}
 */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}
