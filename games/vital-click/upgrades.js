/* ═══════════════════════════════════════════════
   VITAL CLICK — upgrades.js
   Department definitions, upgrade definitions,
   achievement definitions, computed stat helpers
═══════════════════════════════════════════════ */

'use strict';

// ── DEPARTMENT DEFINITIONS ───────────────────────
// base      : gold per click at lv1 (before multipliers)
// cooldown  : seconds between auto-ticks
// unlockAt  : totalEarned threshold to unlock
// autoAt    : totalEarned threshold to enable automation
// cost      : base upgrade cost (scales per level)
// color     : theme key matching CSS class suffix
// icon      : emoji icon
// scene     : canvas scene key drawn by game.js

const DEPT_DEFS = {
  er: {
    id:        'er',
    name:      'Emergency Room',
    short:     'ER',
    icon:      '🚑',
    color:     'er',
    scene:     'scene_er',
    base:      5,
    cooldown:  3,
    unlockAt:  0,
    autoAt:    150,
    cost:      50,
    desc:      '24/7 trauma & emergency care',
    autoDesc:  'Paramedics handle intake automatically',
  },
  icu: {
    id:        'icu',
    name:      'Intensive Care Unit',
    short:     'ICU',
    icon:      '💊',
    color:     'icu',
    scene:     'scene_icu',
    base:      20,
    cooldown:  5,
    unlockAt:  50,
    autoAt:    600,
    cost:      200,
    desc:      'Critical patient monitoring & care',
    autoDesc:  'Nurses manage vitals automatically',
  },
  surgery: {
    id:        'surgery',
    name:      'Operating Theatre',
    short:     'Surgery',
    icon:      '🫀',
    color:     'surgery',
    scene:     'scene_surgery',
    base:      80,
    cooldown:  8,
    unlockAt:  200,
    autoAt:    2500,
    cost:      800,
    desc:      'Surgical procedures & operations',
    autoDesc:  'Surgical robot assists operations',
  },
  lab: {
    id:        'lab',
    name:      'Diagnostics Lab',
    short:     'Lab',
    icon:      '🧬',
    color:     'lab',
    scene:     'scene_lab',
    base:      200,
    cooldown:  12,
    unlockAt:  800,
    autoAt:    9000,
    cost:      3000,
    desc:      'Blood work, imaging & diagnostics',
    autoDesc:  'AI handles sample analysis',
  },
  pharma: {
    id:        'pharma',
    name:      'Pharmacy',
    short:     'Pharma',
    icon:      '💉',
    color:     'pharma',
    scene:     'scene_pharma',
    base:      600,
    cooldown:  18,
    unlockAt:  3000,
    autoAt:    35000,
    cost:      10000,
    desc:      'Drug dispensing & synthesis',
    autoDesc:  'Automated dispensing system active',
  },
  research: {
    id:        'research',
    name:      'Research Center',
    short:     'Research',
    icon:      '🧪',
    color:     'research',
    scene:     'scene_research',
    base:      2000,
    cooldown:  28,
    unlockAt:  10000,
    autoAt:    120000,
    cost:      40000,
    desc:      'Breakthrough medical research',
    autoDesc:  'AI accelerates discovery pipeline',
  },
};

// Ordered list for iteration (unlock order)
const DEPT_ORDER = ['er', 'icu', 'surgery', 'lab', 'pharma', 'research'];

// ── UPGRADE DEFINITIONS ──────────────────────────
// type    : 'click' | 'auto' | 'special'
// maxLv   : maximum level
// costs   : array of costs per level [lv0→lv1, lv1→lv2, ...]
// apply   : function(state) called when purchased — mutates state
// desc    : description shown in shop
// flavor  : short flavor text shown in shop card

const UPGRADE_DEFS = [

  // ── CLICK POWER ────────────────────────────────
  {
    id:      'stethoscope',
    name:    'Premium Stethoscope',
    icon:    '🩺',
    type:    'click',
    maxLv:   5,
    costs:   [60, 180, 420, 900, 2000],
    desc:    '+3 gold per main click per level',
    flavor:  'Listen closer. Earn more.',
    // NOTE: apply() is called once per purchase.
    // On prestige reset, clickPower returns to 1 and upgrade levels to 0.
    apply(state) {
      state.clickPower += 3;
    },
  },
  {
    id:      'expertHands',
    name:    'Expert Surgeon Hands',
    icon:    '🤲',
    type:    'click',
    maxLv:   4,
    costs:   [350, 1200, 4000, 12000],
    desc:    'Doubles main click power',
    flavor:  'Precision that pays.',
    apply(state) {
      state.clickPower *= 2;
    },
  },
  {
    id:      'aiAssist',
    name:    'AI Diagnosis Assistant',
    icon:    '🤖',
    type:    'click',
    maxLv:   3,
    costs:   [1400, 5000, 15000],
    desc:    '+10 gold per main click per level',
    flavor:  'The AI never misses a diagnosis.',
    apply(state) {
      state.clickPower += 10;
    },
  },
  {
    id:      'nanoMed',
    name:    'Nano Medicine Protocol',
    icon:    '🧫',
    type:    'click',
    maxLv:   2,
    costs:   [8000, 40000],
    desc:    'Click power ×5 per level',
    flavor:  'Healing at the molecular level.',
    apply(state) {
      state.clickPower *= 5;
    },
  },

  // ── AUTOMATION ─────────────────────────────────
  {
    id:      'nightShift',
    name:    'Night Shift Staff',
    icon:    '🌙',
    type:    'auto',
    maxLv:   3,
    costs:   [2500, 8000, 22000],
    desc:    'Auto departments earn +50% per level',
    flavor:  'The hospital never sleeps.',
    apply(_state) {
      // Effect applied at runtime in computeAutoEarn()
      // No direct state mutation needed
    },
  },
  {
    id:      'hospitalAI',
    name:    'Hospital Management AI',
    icon:    '🧠',
    type:    'auto',
    maxLv:   3,
    costs:   [4000, 12000, 35000],
    desc:    'All department cooldowns -20% per level',
    flavor:  'Optimize. Automate. Dominate.',
    apply(state) {
      // Cooldown reduction applied in computeMaxCd()
      // No direct state mutation needed
    },
  },
  {
    id:      'speedBoost',
    name:    'Express Care Protocol',
    icon:    '⚡',
    type:    'auto',
    maxLv:   2,
    costs:   [14000, 50000],
    desc:    'All department cooldowns -30% per level',
    flavor:  'Faster care, better outcomes.',
    apply(_state) {
      // Applied at runtime in computeMaxCd()
    },
  },
  {
    id:      'quantumLab',
    name:    'Quantum Research Engine',
    icon:    '🔮',
    type:    'special',
    maxLv:   1,
    costs:   [60000],
    desc:    'Research department earns ×3',
    flavor:  'Science at the speed of thought.',
    apply(_state) {
      // Applied at runtime in computeDeptEarn()
    },
  },
];

// ── ACHIEVEMENT DEFINITIONS ──────────────────────
// condition(state) → boolean: checked after each earn/click event

const ACHIEVEMENT_DEFS = [
  {
    id:        'firstClick',
    name:      'First Do No Harm',
    icon:      '👶',
    desc:      'Treat your first patient',
    condition: (s) => s.totalClicks >= 1,
  },
  {
    id:        'earn1k',
    name:      'Pocket Money',
    icon:      '💰',
    desc:      'Earn 1,000 gold total',
    condition: (s) => s.totalEarned >= 1000,
  },
  {
    id:        'earn100k',
    name:      'Hospital Financier',
    icon:      '🏦',
    desc:      'Earn 100,000 gold total',
    condition: (s) => s.totalEarned >= 100000,
  },
  {
    id:        'earn1m',
    name:      'Medical Mogul',
    icon:      '🏆',
    desc:      'Earn 1,000,000 gold total',
    condition: (s) => s.totalEarned >= 1000000,
  },
  {
    id:        'click100',
    name:      'Dedicated Doctor',
    icon:      '👨‍⚕️',
    desc:      'Click 100 times',
    condition: (s) => s.totalClicks >= 100,
  },
  {
    id:        'click1000',
    name:      'Tireless Surgeon',
    icon:      '⚕️',
    desc:      'Click 1,000 times',
    condition: (s) => s.totalClicks >= 1000,
  },
  {
    id:        'allDepts',
    name:      'Full Hospital',
    icon:      '🏥',
    desc:      'Unlock all departments',
    condition: (s) => DEPT_ORDER.every(k => s.departments[k].unlocked),
  },
  {
    id:        'firstPrestige',
    name:      'Hospital Chain',
    icon:      '⭐',
    desc:      'Complete your first prestige',
    condition: (s) => s.prestige >= 1,
  },
];

// ── COMPUTED STAT HELPERS ────────────────────────

/**
 * Compute the actual cooldown (frames at 60fps) for a department.
 * Applies hospitalAI and speedBoost upgrade reductions.
 * @param {string} deptId
 * @param {object} upgrades  — state.upgrades
 * @returns {number}         — frames
 */
function computeMaxCd(deptId, upgrades) {
  const def  = DEPT_DEFS[deptId];
  let   secs = def.cooldown;
  // hospitalAI: -20% per level
  secs *= Math.pow(0.8, upgrades.hospitalAI || 0);
  // speedBoost: -30% per level
  secs *= Math.pow(0.7, upgrades.speedBoost  || 0);
  // Minimum 0.5 second (30 frames) — allows fast upgrades without breaking loop
  return Math.max(30, Math.round(secs * 60)); // convert to frames
}

/**
 * Compute gold earned per click/auto-tick for a department.
 * Applies level, prestige multiplier, nightShift, quantumLab.
 * @param {string} deptId
 * @param {object} dept      — state.departments[deptId]
 * @param {object} upgrades  — state.upgrades
 * @param {number} prestigeMult
 * @returns {number}
 */
function computeDeptEarn(deptId, dept, upgrades, prestigeMult) {
  const def  = DEPT_DEFS[deptId];
  let   earn = def.base * dept.lv * prestigeMult;

  // nightShift: +50% per level for auto depts, +25% for manual
  const nightLv = upgrades.nightShift || 0;
  if (nightLv > 0) {
    earn *= dept.auto
      ? (1 + nightLv * 0.5)
      : (1 + nightLv * 0.25);
  }

  // quantumLab: research ×3
  if (deptId === 'research' && (upgrades.quantumLab || 0) >= 1) {
    earn *= 3;
  }

  return Math.round(earn);
}

/**
 * Compute the cost to upgrade a department to the next level.
 * Scales exponentially with current level.
 * @param {string} deptId
 * @param {number} currentLv
 * @returns {number}
 */
function computeDeptUpgradeCost(deptId, currentLv) {
  const base = DEPT_DEFS[deptId].cost;
  return Math.round(base * Math.pow(1.75, currentLv - 1));
}

/**
 * Compute total gold per second from all auto departments.
 * Used for GPS display and offline earnings.
 * @param {object} state  — full game state
 * @returns {number}
 */
function computeGPS(state) {
  let gps = 0;
  DEPT_ORDER.forEach(k => {
    const dept = state.departments[k];
    if (!dept.unlocked || !dept.auto) return;
    const earn = computeDeptEarn(k, dept, state.upgrades, state.prestigeMult);
    const cdFrames = computeMaxCd(k, state.upgrades);
    const cdSecs = cdFrames / 60; // frames → seconds
    if (cdSecs > 0) gps += earn / cdSecs;
  });
  return gps;
}

/**
 * Compute the next prestige multiplier.
 * Base ×1.5, +0.25 per prestige already done.
 * @param {number} prestigeCount
 * @returns {number}
 */
function computePrestigeMult(prestigeCount) {
  return 1.5 + prestigeCount * 0.25;
}

/**
 * Check all achievements, unlock any that are newly met.
 * Returns array of newly unlocked achievement ids.
 * @param {object} state
 * @returns {string[]}
 */
function checkAchievements(state) {
  const newlyUnlocked = [];
  ACHIEVEMENT_DEFS.forEach(def => {
    if (!state.achievements[def.id] && def.condition(state)) {
      state.achievements[def.id] = true;
      newlyUnlocked.push(def.id);
    }
  });
  return newlyUnlocked;
}

/**
 * Get upgrade def by id.
 * @param {string} id
 * @returns {object|undefined}
 */
function getUpgradeDef(id) {
  return UPGRADE_DEFS.find(u => u.id === id);
}

/**
 * Compute cost for next level of a global upgrade.
 * @param {string} id
 * @param {number} currentLv
 * @returns {number}
 */
function computeUpgradeCost(id, currentLv) {
  const def = getUpgradeDef(id);
  if (!def || currentLv >= def.maxLv) return Infinity;
  return def.costs[currentLv];
}
