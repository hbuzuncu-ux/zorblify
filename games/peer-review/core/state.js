/**
 * PEER REVIEW — state.js
 * Tüm oyun state'inin tek kaynağı.
 * Immutable update pattern: state doğrudan değiştirilmez,
 * updateState() ile yeni nesne üretilir.
 * GDD v3.0 §10.2 State Yapısı referansıyla üretilmiştir.
 */

'use strict';

import { ECONOMY, LAB_LEVELS } from '../utils/constants.js';

// ─── INITIAL STATE ────────────────────────────────────────────────────────────

/**
 * Oyunun başlangıç state'i.
 * save.js bu yapıyı localStorage'a yazar/okur.
 * Yeni alan eklenirse burada tanımlanmalı — save.js migration bunu yakalar.
 */
export const INITIAL_STATE = {
  meta: {
    version: '1.0.0',
    created: null,        // Date.now() — save.js doldurur
    lastSaved: null,
    playTime: 0,          // toplam oynama süresi (ms)
  },

  time: {
    year: 1,
    month: 1,
    week: 1,
    totalWeeks: 0,        // başlangıçtan bu yana geçen toplam hafta
  },

  lab: {
    name: '',             // oyuncu oyun başında girer
    level: 1,             // 1-5, LAB_LEVELS sabiti
    prestige: 0,          // 0-1000
    budget: ECONOMY.STARTING_BUDGET,
    grants: [],           // aktif hibeler: { id, label, amount, monthsLeft, condition }
    patents: [],          // aktif patentler: { id, label, monthlyRevenue, age, maxAge }
    equipment: [],        // sahip olunan ekipmanlar: { id, age (ay) }
    publications: [],     // yayınlanan makaleler (aşağıda tip tanımı)
    retractions: [],      // geri çekilen makaleler: { paperId, field, year }
    nobelScores: {},      // field → birikimli Nobel puanı
    internationalCollabs: 0,
    acceptedGrantsCount: 0,  // hibe kabul oranı hesabı için
  },

  researchers: [],
  // Her araştırmacı nesnesi şu alanları içerir:
  // {
  //   id: string,            — benzersiz ID
  //   name: string,
  //   personality: string,   — GEN | MET | LED | AMB | PER | MNT | PLY | CAR
  //   field: string,         — tercih ettiği alan
  //   careerStage: string,   — junior | mid | senior | emeritus
  //   yearsExp: number,
  //   salary: number,
  //   hoursPerWeek: number,  — varsayılan 40
  //   morale: number,        — 0-100
  //   xp: number,            — birikimli XP
  //   assignedProjectId: null | string,
  //   isBurnout: boolean,
  //   // Görünür statlar
  //   AN: number, CR: number, LB: number, WR: number,
  //   TW: number, AM: number, RS: number, RP: number,
  //   // Gizli statlar
  //   ET: number, LY: number,
  //   // Runtime (save'e yazılmaz)
  //   _manipulated: false,
  // }

  projects: {
    active: [],
    completed: [],
    failed: [],
  },
  // Her proje nesnesi şu alanları içerir:
  // {
  //   id: string,
  //   label: string,
  //   type: string,          — basic | applied | meta_analysis | collab | field
  //   field: string,
  //   phase: string,         — mevcut aşama
  //   phaseWeek: number,     — bu aşamada geçen hafta
  //   phaseDuration: number, — bu aşama kaç hafta sürecek
  //   phaseQualities: {},    — tamamlanan aşamaların kalite puanları
  //   teamIds: [],           — atanan araştırmacı ID'leri
  //   weeklyProgress: number,— bu hafta üretilen ilerleme
  //   totalProgress: number,
  //   targetProgress: number,
  //   costPerWeek: number,
  //   startWeek: number,
  //   estimatedEndWeek: number,
  //   riskFlags: [],         — aktif risk işaretleri
  //   isRacing: false,       — rakiple yarış var mı
  //   partnerId: null,       — işbirliği projesi için
  // }

  rivals: {
    // id → rival state
    // VIT: { nobleScore: number, activeProjects: [], lastAction: string }
    // NAS, SRC, CBA, OEL aynı yapı
  },

  events: {
    pending: [],
    // Her event nesnesi:
    // { id, category, label, description, choices: [{ id, label, effect }], week, year }
    history: [],
    // { id, category, choiceId, week, year }
  },

  nobel: {
    hasSignal: false,
    onLongList: false,
    onShortList: false,
    shortListPosition: null,
    won: false,
    wonField: null,
    wonYear: null,
  },

  stats: {
    totalPublications: 0,
    totalCitations: 0,
    totalResearchersHired: 0,
    totalResearchersLost: 0,
    highestIF: 0,
    peakPrestige: 0,
    totalWeeksPlayed: 0,
  },

  ui: {
    // Geçici UI state — save'e yazılmaz
    // (save.js bu alanı atlar)
    selectedResearcherId: null,
    selectedProjectId: null,
    activePanel: 'center',    // left | center | right
    isAutoAdvance: false,
    speed: 1,                 // 1x | 2x | 4x (ileride)
    notifications: [],        // { id, text, type, ttl }
  },
};

// ─── STATE YÖNETİMİ ───────────────────────────────────────────────────────────

/**
 * Global oyun state'i.
 * Doğrudan erişim için export edilir ama
 * her zaman updateState() veya atomik setter'lar üzerinden değiştirilmeli.
 */
let _state = null;

/**
 * State'i başlatır.
 * save.js'ten yüklenen state verilirse onu kullanır,
 * yoksa INITIAL_STATE'in derin kopyasını oluşturur.
 *
 * @param {Object|null} savedState
 */
export function initState(savedState = null) {
  if (savedState) {
    _state = mergeWithDefaults(savedState, deepClone(INITIAL_STATE));
  } else {
    _state = deepClone(INITIAL_STATE);
    _state.meta.created = Date.now();
  }
  return _state;
}

/**
 * Mevcut state'i döner (salt okunur referans).
 * Direkt mutasyon yapılmamalı — updateState kullanılmalı.
 * @returns {Object}
 */
export function getState() {
  if (!_state) throw new Error('State henüz başlatılmadı. initState() çağrılmalı.');
  return _state;
}

/**
 * State'in bir bölümünü günceller.
 * Shallow merge değil, path bazlı derin güncelleme.
 *
 * Kullanım:
 *   updateState('lab.budget', 4200)
 *   updateState('time', { year: 2, month: 3, week: 1, totalWeeks: 88 })
 *   updateState('researchers', updatedArray)
 *
 * @param {string} path   nokta-ayrımlı yol: 'lab.budget', 'time.year' vb.
 * @param {any}    value
 */
export function updateState(path, value) {
  if (!_state) throw new Error('State henüz başlatılmadı.');
  setNestedValue(_state, path, value);
}

/**
 * State'i doğrudan bir nesneyle günceller (toplu güncelleme).
 * Sadece top-level key'leri merge eder.
 * Dikkat: iç içe nesneler replace edilir, merge edilmez.
 *
 * @param {Object} partial
 */
export function patchState(partial) {
  if (!_state) throw new Error('State henüz başlatılmadı.');
  Object.assign(_state, partial);
}

/**
 * State'i INITIAL_STATE'e sıfırlar (yeni oyun).
 */
export function resetState() {
  _state = deepClone(INITIAL_STATE);
  _state.meta.created = Date.now();
  return _state;
}

// ─── ARAŞTIRMACI HELPERS ──────────────────────────────────────────────────────

/**
 * ID'ye göre araştırmacı döner.
 * @param {string} id
 * @returns {Object|null}
 */
export function getResearcher(id) {
  return _state.researchers.find(r => r.id === id) ?? null;
}

/**
 * Araştırmacıyı günceller (mutable — doğrudan nesne içinde).
 * researchers dizisi referansı değişmez, sadece eleman güncellenir.
 *
 * @param {string} id
 * @param {Object} changes
 */
export function updateResearcher(id, changes) {
  const r = getResearcher(id);
  if (!r) throw new Error(`Araştırmacı bulunamadı: ${id}`);
  Object.assign(r, changes);
}

/**
 * Yeni araştırmacı ekler.
 * @param {Object} researcher
 */
export function addResearcher(researcher) {
  _state.researchers.push(researcher);
  _state.stats.totalResearchersHired++;
}

/**
 * Araştırmacıyı kadrodan çıkarır.
 * @param {string} id
 */
export function removeResearcher(id) {
  const idx = _state.researchers.findIndex(r => r.id === id);
  if (idx === -1) return;
  _state.researchers.splice(idx, 1);
  _state.stats.totalResearchersLost++;
}

// ─── PROJE HELPERS ───────────────────────────────────────────────────────────

/**
 * ID'ye göre aktif proje döner.
 * @param {string} id
 * @returns {Object|null}
 */
export function getProject(id) {
  return _state.projects.active.find(p => p.id === id) ?? null;
}

/**
 * Yeni proje başlatır.
 * @param {Object} project
 */
export function addProject(project) {
  _state.projects.active.push(project);
}

/**
 * Projeyi tamamlandı olarak işaretler, active'den completed'a taşır.
 * @param {string} id
 * @param {Object} publication  — yayın verisi (null ise başarısız proje)
 */
export function completeProject(id, publication = null) {
  const idx = _state.projects.active.findIndex(p => p.id === id);
  if (idx === -1) return;
  const [project] = _state.projects.active.splice(idx, 1);
  project.completedWeek = _state.time.totalWeeks;

  if (publication) {
    _state.projects.completed.push(project);
    _state.lab.publications.push(publication);
    _state.stats.totalPublications++;
    if (publication.impactFactor > _state.stats.highestIF) {
      _state.stats.highestIF = publication.impactFactor;
    }
  } else {
    _state.projects.failed.push(project);
  }
}

// ─── LAB HELPERS ─────────────────────────────────────────────────────────────

/**
 * Bütçeyi değiştirir (pozitif = gelir, negatif = gider).
 * @param {number} delta
 */
export function changeBudget(delta) {
  _state.lab.budget += delta;
}

/**
 * Prestij değiştirir (min 0, max 1000).
 * @param {number} delta
 */
export function changePrestige(delta) {
  _state.lab.prestige = Math.max(0, Math.min(1000, _state.lab.prestige + delta));
  if (_state.lab.prestige > _state.stats.peakPrestige) {
    _state.stats.peakPrestige = _state.lab.prestige;
  }
}

/**
 * Lab seviyesini artırır (max 5).
 */
export function upgradeLabLevel() {
  if (_state.lab.level < 5) _state.lab.level++;
}

/**
 * Mevcut lab kapasitesini döner.
 * @returns {{ maxResearchers: number, maxProjects: number }}
 */
export function getLabCapacity() {
  return LAB_LEVELS[_state.lab.level];
}

// ─── EVENT HELPERS ────────────────────────────────────────────────────────────

/**
 * Oyuncuya gösterilecek event kuyruğuna ekler.
 * @param {Object} event
 */
export function queueEvent(event) {
  _state.events.pending.push(event);
}

/**
 * Pending queue'dan event alır (FIFO).
 * @returns {Object|null}
 */
export function dequeueEvent() {
  return _state.events.pending.shift() ?? null;
}

/**
 * Event'i tarihçeye kaydeder.
 * @param {string} eventId
 * @param {string} choiceId
 */
export function recordEvent(eventId, choiceId) {
  _state.events.history.push({
    id: eventId,
    choiceId,
    week: _state.time.totalWeeks,
    year: _state.time.year,
  });
}

// ─── ZAMAN HELPERS ────────────────────────────────────────────────────────────

/**
 * Bir hafta ilerler. Ay/yıl geçişlerini otomatik yönetir.
 * @returns {{ newMonth: boolean, newYear: boolean }}
 */
export function advanceWeek() {
  _state.time.totalWeeks++;
  _state.time.week++;
  _state.stats.totalWeeksPlayed++;

  let newMonth = false;
  let newYear  = false;

  if (_state.time.week > 4) {
    _state.time.week = 1;
    _state.time.month++;
    newMonth = true;
  }

  if (_state.time.month > 12) {
    _state.time.month = 1;
    _state.time.year++;
    newYear = true;
  }

  return { newMonth, newYear };
}

// ─── UI HELPERS ───────────────────────────────────────────────────────────────

/**
 * Bildirim ekler.
 * @param {string} text
 * @param {'info'|'success'|'warning'|'danger'} type
 * @param {number} ttl  kaç saniye görünür kalır
 */
export function addNotification(text, type = 'info', ttl = 5) {
  _state.ui.notifications.push({
    id: Date.now() + Math.random(),
    text,
    type,
    ttl,
  });
}

/**
 * Süresi dolan bildirimleri temizler.
 */
export function pruneNotifications() {
  _state.ui.notifications = _state.ui.notifications.filter(n => n.ttl > 0);
}

// ─── INTERNAL UTILS ──────────────────────────────────────────────────────────

/**
 * Nesnenin derin kopyasını döner.
 * @param {any} obj
 * @returns {any}
 */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Nokta-ayrımlı path ile iç içe nesneye değer atar.
 * Örn: setNestedValue(obj, 'lab.budget', 5000)
 *
 * @param {Object} obj
 * @param {string} path
 * @param {any}    value
 */
function setNestedValue(obj, path, value) {
  const keys = path.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (current[keys[i]] === undefined) {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
}

/**
 * Kaydedilmiş state ile varsayılan state'i birleştirir.
 * Yeni eklenen alanlar (migration) default değerleriyle gelir.
 * UI state'i her zaman default'tan alınır (persist edilmez).
 *
 * @param {Object} saved
 * @param {Object} defaults
 * @returns {Object}
 */
function mergeWithDefaults(saved, defaults) {
  const result = { ...defaults, ...saved };

  // İç içe nesneleri de merge et
  for (const key of Object.keys(defaults)) {
    if (
      defaults[key] !== null &&
      typeof defaults[key] === 'object' &&
      !Array.isArray(defaults[key]) &&
      saved[key] !== undefined
    ) {
      result[key] = mergeWithDefaults(saved[key], defaults[key]);
    }
  }

  // UI state her zaman default — persist edilmez
  result.ui = deepClone(defaults.ui);

  return result;
}
