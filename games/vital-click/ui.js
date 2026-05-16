/* ═══════════════════════════════════════════════
   VITAL CLICK — ui.js
   DOM panel rendering, shop overlay, toasts,
   float texts, click ripples, achievement popups
   Depends on: save.js, upgrades.js
═══════════════════════════════════════════════ */

'use strict';

// ── DOM REFS ─────────────────────────────────────
const DOM = {
  // Top bar
  gold:        () => document.getElementById('tb-gold'),
  gps:         () => document.getElementById('tb-gps'),
  patients:    () => document.getElementById('tb-patients'),
  prestige:    () => document.getElementById('tb-prestige'),

  // Left panel
  leftPanel:   () => document.getElementById('left-panel'),

  // Float layer (over canvas)
  floatLayer:  () => document.getElementById('float-layer'),

  // Right panel
  statCards:   () => document.getElementById('stat-cards'),
  prestigeCard:() => document.getElementById('prestige-card'),
  achStrip:    () => document.getElementById('ach-strip'),

  // Bottom bar
  bottomTip:   () => document.getElementById('bottom-tip'),

  // Shop overlay
  shopOverlay: () => document.getElementById('shop-overlay'),
  shopGold:    () => document.getElementById('shop-gold'),
  shopClickUpg:() => document.getElementById('shop-click-upg'),
  shopAutoUpg: () => document.getElementById('shop-auto-upg'),
  shopDeptUpg: () => document.getElementById('shop-dept-upg'),

  // Toast
  toast:       () => document.getElementById('toast'),
};

// ── TIPS ─────────────────────────────────────────
const TIPS = [
  'Click the main button to treat patients and earn gold.',
  'Unlock departments by earning enough total gold.',
  'Click a department card to activate it manually.',
  'Departments automate once you reach their auto threshold.',
  'Upgrade your click power in the shop to earn more per click.',
  'Prestige resets progress but gives a permanent multiplier.',
  'Hospital AI reduces all department cooldowns.',
  'Night Shift Staff increases auto department earnings.',
  'The Research Center has the highest gold yield.',
  'Quantum Research Engine triples Research earnings.',
];
let tipIndex = 0;

// ── TOAST ─────────────────────────────────────────
let toastTimer = null;

/**
 * Show a toast notification.
 * @param {string} text
 * @param {number} duration ms
 */
function showToast(text, duration = 2500) {
  const el = DOM.toast();
  if (!el) return;
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), duration);
}

// ── FLOAT TEXTS ───────────────────────────────────
/**
 * Spawn a floating gold text at (x, y) relative to the float layer.
 * @param {number} x
 * @param {number} y
 * @param {string} text
 * @param {string} color  CSS color
 * @param {string} size   CSS font-size e.g. '14px'
 */
function spawnFloat(x, y, text, color = '#4ade80', size = '14px') {
  const layer = DOM.floatLayer();
  if (!layer) return;
  const el = document.createElement('div');
  el.className = 'float-text';
  el.textContent = text;
  el.style.left      = x + 'px';
  el.style.top       = y + 'px';
  el.style.color     = color;
  el.style.fontSize  = size;
  layer.appendChild(el);
  // Remove after animation ends (950ms)
  setTimeout(() => el.remove(), 950);
}

/**
 * Spawn a click ripple effect at (x, y) relative to the float layer.
 */
function spawnRipple(x, y) {
  const layer = DOM.floatLayer();
  if (!layer) return;
  const el = document.createElement('div');
  el.className  = 'click-ripple';
  el.style.left = x + 'px';
  el.style.top  = y + 'px';
  layer.appendChild(el);
  setTimeout(() => el.remove(), 600);
}

// ── ACHIEVEMENT POPUP ─────────────────────────────
/**
 * Show an achievement unlock popup.
 * @param {string} achId
 */
function showAchievementPopup(achId) {
  const def = ACHIEVEMENT_DEFS.find(a => a.id === achId);
  if (!def) return;

  const el = document.createElement('div');
  el.style.cssText = `
    position: fixed;
    bottom: 70px;
    right: 20px;
    background: linear-gradient(135deg, #1c2a1c, #162414);
    border: 1px solid rgba(74,222,128,0.4);
    border-radius: 14px;
    padding: 12px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    z-index: 300;
    box-shadow: 0 8px 24px rgba(0,0,0,0.6);
    animation: fadeIn 0.3s ease;
    max-width: 260px;
  `;
  el.innerHTML = `
    <div style="font-size:28px;flex-shrink:0;">${def.icon}</div>
    <div>
      <div style="font-size:9px;color:#4ade80;font-weight:800;letter-spacing:1px;text-transform:uppercase;margin-bottom:2px;">Achievement Unlocked</div>
      <div style="font-size:13px;font-weight:800;color:#e8f4ff;">${def.name}</div>
      <div style="font-size:10px;color:#7fa8cc;margin-top:2px;">${def.desc}</div>
    </div>
  `;
  el.id = 'offline-modal';
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity 0.4s ease';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 400);
  }, 3000);
}

// ── TOP BAR ───────────────────────────────────────
/**
 * Update top bar resource displays.
 * @param {object} state
 * @param {number} gps
 */
function updateTopBar(state, gps) {
  const g   = DOM.gold();
  const gp  = DOM.gps();
  const pt  = DOM.patients();
  const pr  = DOM.prestige();
  if (g)  g.textContent  = fmt(state.gold);
  if (gp) gp.textContent = '+' + fmt(gps) + '/s';
  if (pt) pt.textContent = fmt(state.patients);
  if (pr) pr.textContent = fmtMult(state.prestigeMult);
}

// ── LEFT PANEL — DEPARTMENT CARDS ────────────────
/**
 * Build department cards into the left panel.
 * Called once on init; updates are done via updateDeptCard().
 * @param {object} state
 * @param {function} onDeptClick  callback(deptId)
 */
function buildDeptCards(state, onDeptClick) {
  const panel = DOM.leftPanel();
  if (!panel) return;
  panel.innerHTML = `<div class="panel-section-label">Departments</div>`;

  DEPT_ORDER.forEach(k => {
    const def  = DEPT_DEFS[k];
    const dept = state.departments[k];

    const card = document.createElement('div');
    card.id        = `dc-${k}`;
    card.className = `dept-card d-${def.color}${dept.unlocked ? '' : ' locked'}`;
    card.innerHTML = buildDeptCardHTML(k, def, dept, state);
    card.addEventListener('click', () => onDeptClick(k));
    panel.appendChild(card);
  });
}

/**
 * Build inner HTML for a department card.
 */
function buildDeptCardHTML(k, def, dept, state) {
  const earn    = computeDeptEarn(k, dept, state.upgrades, state.prestigeMult);
  const maxCd   = computeMaxCd(k, state.upgrades);
  const timer   = dept.timer || 0;
  const cdPct   = timer > 0 ? ((1 - timer / maxCd) * 100) : 100;
  const isReady = timer === 0;

  return `
    <div class="dc-top">
      <div class="dc-icon-wrap">
        <div class="dc-icon-glow"></div>
        ${def.icon}
      </div>
      <div class="dc-info">
        <div class="dc-name">${def.name}</div>
        <div class="dc-sub">${def.desc}</div>
      </div>
    </div>
    <div class="dc-earn-row">
      <div class="dc-earn" id="de-${k}">+${fmt(earn)}g</div>
      <div class="dc-lv" id="dlv-${k}">Lv ${dept.lv}</div>
    </div>
    <div class="dc-bar-wrap">
      <div class="dc-bar" id="db-${k}" style="width:${cdPct}%"></div>
    </div>
    <div class="dc-tag-row" id="dtags-${k}">
      ${dept.auto       ? '<span class="dc-tag tag-auto">AUTO</span>' : ''}
      ${isReady && dept.unlocked && !dept.auto ? '<span class="dc-tag tag-ready">READY</span>' : ''}
      ${!dept.unlocked  ? `<span class="dc-tag tag-lock">🔒 ${fmt(def.unlockAt)}g</span>` : ''}
    </div>
  `;
}

/**
 * Update a single department card's dynamic values.
 * Called every frame for active cards (bar + earn display).
 * @param {string} k      deptId
 * @param {object} state
 */
/**
 * Fast update — only progress bar. Called every frame.
 */
function updateDeptCard(k, state) {
  const dept  = state.departments[k];
  const maxCd = computeMaxCd(k, state.upgrades);
  const timer = dept.timer || 0;
  const cdPct = timer > 0 ? ((1 - timer / maxCd) * 100) : 100;
  const bar   = document.getElementById(`db-${k}`);
  if (bar) bar.style.width = cdPct + '%';
}

/**
 * Slow update — earn, level, tags, lock. Called every ~60 frames.
 */
function slowUpdateDeptCard(k, state) {
  const dept    = state.departments[k];
  const def     = DEPT_DEFS[k];
  const earn    = computeDeptEarn(k, dept, state.upgrades, state.prestigeMult);
  const timer   = dept.timer || 0;
  const isReady = timer === 0;

  const earnEl = document.getElementById(`de-${k}`);
  if (earnEl) earnEl.textContent = '+' + fmt(earn) + 'g';

  const lvEl = document.getElementById(`dlv-${k}`);
  if (lvEl) lvEl.textContent = 'Lv ' + dept.lv;

  const tagsEl = document.getElementById(`dtags-${k}`);
  if (tagsEl) {
    tagsEl.innerHTML = `
      ${dept.auto      ? '<span class="dc-tag tag-auto">AUTO</span>'   : ''}
      ${isReady && dept.unlocked && !dept.auto ? '<span class="dc-tag tag-ready">READY</span>' : ''}
      ${!dept.unlocked ? `<span class="dc-tag tag-lock">🔒 ${fmt(def.unlockAt)}g</span>` : ''}
    `;
  }

  const card = document.getElementById(`dc-${k}`);
  if (card) {
    if (dept.unlocked) card.classList.remove('locked');
    else card.classList.add('locked');
  }
}

// ── RIGHT PANEL ───────────────────────────────────
/**
 * Build the right panel (stats + prestige + achievements).
 * Called once on init; prestige card updated via updatePrestigeCard().
 * @param {object} state
 * @param {function} onPrestige  callback()
 */
function buildRightPanel(state, onPrestige) {
  buildStatCard(state);
  buildPrestigeCard(state, onPrestige);
  buildAchievements(state);
}

function buildStatCard(state) {
  const el = document.getElementById('stat-cards');
  if (!el) return;
  el.innerHTML = `
    <div class="stat-card">
      <div class="stat-card-title">📊 Statistics</div>
      <div class="stat-row">
        <span class="stat-row-lbl">Total Earned</span>
        <span class="stat-row-val" style="color:var(--gold)" id="st-totalEarned">${fmt(state.totalEarned)}</span>
      </div>
      <div class="stat-row">
        <span class="stat-row-lbl">Total Clicks</span>
        <span class="stat-row-val" style="color:var(--blue)" id="st-totalClicks">${fmt(state.totalClicks)}</span>
      </div>
      <div class="stat-row">
        <span class="stat-row-lbl">Best Click</span>
        <span class="stat-row-val" style="color:var(--purple)" id="st-bestClick">${fmt(state.bestClick)}</span>
      </div>
      <div class="stat-row">
        <span class="stat-row-lbl">Patients Treated</span>
        <span class="stat-row-val" style="color:var(--teal)" id="st-patients">${fmt(state.patients)}</span>
      </div>
      <div class="stat-row">
        <span class="stat-row-lbl">Playtime</span>
        <span class="stat-row-val" style="color:var(--text-muted)" id="st-playtime">${fmtTime(state.playtime)}</span>
      </div>
      <div class="stat-row">
        <span class="stat-row-lbl">All-Time Gold</span>
        <span class="stat-row-val" style="color:var(--gold)" id="st-allTime">${fmt(state.stats.allTimeEarned)}</span>
      </div>
    </div>
  `;
}

/**
 * Update stat card values without rebuilding DOM.
 */
function updateStatCard(state) {
  const ids = {
    'st-totalEarned': state.totalEarned,
    'st-totalClicks': state.totalClicks,
    'st-bestClick':   state.bestClick,
    'st-patients':    state.patients,
    'st-allTime':     state.stats.allTimeEarned,
  };
  Object.entries(ids).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = fmt(val);
  });
  const pt = document.getElementById('st-playtime');
  if (pt) pt.textContent = fmtTime(state.playtime);
}

function buildPrestigeCard(state, onPrestige) {
  const el = DOM.prestigeCard();
  if (!el) return;
  const nextMult  = computePrestigeMult(state.prestige);
  const required  = 10000;
  const ready     = state.totalEarned >= required;

  el.className = 'prestige-card' + (ready ? '' : ' locked-p');
  el.innerHTML = `
    <div class="pcard-icon">⭐</div>
    <div class="pcard-name">Prestige Reset</div>
    <div class="pcard-desc">
      Reset all progress for a permanent<br>gold multiplier. Current: ${fmtMult(state.prestigeMult)}
    </div>
    <div class="pcard-mult" id="pcard-mult">Next: ${fmtMult(nextMult)}</div>
    <div class="pcard-req" id="pcard-req">
      ${ready
        ? '✅ Ready to prestige!'
        : `Requires ${fmt(required)}g total earned (${fmt(state.totalEarned)}/${fmt(required)})`}
    </div>
  `;
  el.onclick = ready ? onPrestige : null;
  el.style.cursor = ready ? 'pointer' : 'not-allowed';
}

/**
 * Update prestige card readiness without full rebuild.
 */
function updatePrestigeCard(state, onPrestige) {
  buildPrestigeCard(state, onPrestige);
}

function buildAchievements(state) {
  const el = DOM.achStrip();
  if (!el) return;
  el.innerHTML = `<div class="stat-card-title" style="padding:10px 12px 4px;">🏅 Achievements</div>`;
  ACHIEVEMENT_DEFS.forEach(def => {
    const unlocked = state.achievements[def.id];
    const item = document.createElement('div');
    item.className = 'ach-item' + (unlocked ? ' unlocked' : '');
    item.id = `ach-${def.id}`;
    item.innerHTML = `
      <div class="ach-icon">${unlocked ? def.icon : '🔒'}</div>
      <div class="ach-info">
        <div class="ach-name" style="${unlocked ? 'color:var(--gold)' : ''}">${def.name}</div>
        <div class="ach-desc">${unlocked ? def.desc : '???'}</div>
      </div>
    `;
    el.appendChild(item);
  });
}

/**
 * Mark a single achievement as unlocked in the DOM.
 */
function unlockAchievementDOM(achId) {
  const def = ACHIEVEMENT_DEFS.find(a => a.id === achId);
  if (!def) return;
  const el = document.getElementById(`ach-${achId}`);
  if (!el) return;
  el.classList.add('unlocked');
  el.querySelector('.ach-icon').textContent = def.icon;
  el.querySelector('.ach-name').style.color = 'var(--gold)';
  el.querySelector('.ach-name').textContent = def.name;
  el.querySelector('.ach-desc').textContent = def.desc;
}

// ── BOTTOM BAR ────────────────────────────────────
function rotateTip() {
  const el = DOM.bottomTip();
  if (!el) return;
  el.textContent = '💡 ' + TIPS[tipIndex % TIPS.length];
  tipIndex++;
}

// ── SHOP OVERLAY ──────────────────────────────────
let shopOpen = false;

function openShop(state, onBuyUpgrade, onBuyDeptLevel) {
  shopOpen = true;
  const ov = DOM.shopOverlay();
  if (ov) ov.classList.add('open');
  buildShop(state, onBuyUpgrade, onBuyDeptLevel);
}

function closeShop() {
  shopOpen = false;
  const ov = DOM.shopOverlay();
  if (ov) ov.classList.remove('open');
}

function toggleShop(state, onBuyUpgrade, onBuyDeptLevel) {
  if (shopOpen) closeShop();
  else openShop(state, onBuyUpgrade, onBuyDeptLevel);
}

/**
 * Build full shop contents.
 * @param {object}   state
 * @param {function} onBuyUpgrade    callback(upgradeId)
 * @param {function} onBuyDeptLevel  callback(deptId)
 */
function buildShop(state, onBuyUpgrade, onBuyDeptLevel) {
  // Update gold display
  const sg = DOM.shopGold();
  if (sg) sg.textContent = fmt(state.gold);

  // Click upgrades
  const clickEl = DOM.shopClickUpg();
  if (clickEl) {
    clickEl.innerHTML = '';
    UPGRADE_DEFS
      .filter(u => u.type === 'click')
      .forEach(u => {
        clickEl.appendChild(buildUpgradeCard(u, state, onBuyUpgrade));
      });
  }

  // Auto upgrades
  const autoEl = DOM.shopAutoUpg();
  if (autoEl) {
    autoEl.innerHTML = '';
    UPGRADE_DEFS
      .filter(u => u.type === 'auto' || u.type === 'special')
      .forEach(u => {
        autoEl.appendChild(buildUpgradeCard(u, state, onBuyUpgrade));
      });
  }

  // Dept level upgrades
  const deptEl = DOM.shopDeptUpg();
  if (deptEl) {
    deptEl.innerHTML = '';
    DEPT_ORDER.forEach(k => {
      const dept = state.departments[k];
      if (!dept.unlocked) return;
      const def  = DEPT_DEFS[k];
      const cost = computeDeptUpgradeCost(k, dept.lv);
      const canAfford = state.gold >= cost;

      const btn = document.createElement('button');
      btn.className = 'dept-upg-btn';
      btn.disabled  = !canAfford;
      btn.innerHTML = `
        <div class="dub-left">
          <span class="dub-icon">${def.icon}</span>
          <div>
            <div class="dub-name">${def.short} — Lv ${dept.lv} → ${dept.lv + 1}</div>
            <div class="dub-sub">+${fmt(computeDeptEarn(k, {...dept, lv: dept.lv + 1}, state.upgrades, state.prestigeMult))}g at Lv ${dept.lv + 1}</div>
          </div>
        </div>
        <div class="dub-cost">💰 ${fmt(cost)}</div>
      `;
      btn.addEventListener('click', () => {
        onBuyDeptLevel(k);
        buildShop(state, onBuyUpgrade, onBuyDeptLevel);
      });
      deptEl.appendChild(btn);
    });
  }
}

/**
 * Build a single upgrade card element.
 */
function buildUpgradeCard(u, state, onBuyUpgrade) {
  const currentLv = state.upgrades[u.id] || 0;
  const maxed     = currentLv >= u.maxLv;
  const cost      = maxed ? 0 : computeUpgradeCost(u.id, currentLv);
  const canAfford = !maxed && state.gold >= cost;

  const el = document.createElement('div');
  el.className = 'upg-card' + (maxed ? ' maxed' : !canAfford ? ' cant' : '');

  el.innerHTML = `
    <div class="upg-icon">${u.icon}</div>
    <div class="upg-info">
      <div class="upg-name">${u.name}</div>
      <div class="upg-desc">${u.desc}</div>
      <div style="font-size:9px;color:var(--text-dim);margin-top:2px;font-style:italic;">${u.flavor}</div>
    </div>
    <div class="upg-right">
      ${maxed
        ? '<div class="upg-max">✓ MAX</div>'
        : `<div class="upg-cost">💰 ${fmt(cost)}</div>`}
      <div class="upg-lv">${currentLv}/${u.maxLv}</div>
    </div>
  `;

  if (!maxed && canAfford) {
    el.style.cursor = 'pointer';
    el.addEventListener('click', () => {
      onBuyUpgrade(u.id);
    });
  }
  return el;
}

// ── OFFLINE EARNINGS MODAL ────────────────────────
/**
 * Show offline earnings modal on game load.
 * @param {number} gold  — gold earned offline
 * @param {number} secs  — seconds elapsed
 */
function showOfflineModal(gold, secs) {
  if (gold <= 0) return;
  const el = document.createElement('div');
  el.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.8);
    z-index: 500;
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(4px);
  `;
  el.innerHTML = `
    <div style="
      background: var(--bg-panel);
      border: 1px solid var(--border-hi);
      border-radius: 18px;
      padding: 28px 36px;
      text-align: center;
      max-width: 340px;
      animation: scaleIn 0.25s ease;
    ">
      <div style="font-size:40px;margin-bottom:10px;">🌙</div>
      <div style="font-size:17px;font-weight:900;color:var(--text);margin-bottom:6px;">Welcome Back!</div>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:16px;">
        While you were away for ${fmtTime(secs)}, your hospital kept running.
      </div>
      <div style="font-size:24px;font-weight:900;color:var(--gold);margin-bottom:20px;">
        +${fmt(gold)} Gold
      </div>
      <button onclick="document.getElementById('offline-modal').remove()" style="
        background: linear-gradient(135deg,#1e3a8a,#2563eb);
        border: none;
        border-radius: 10px;
        color: #fff;
        font-size: 13px;
        font-weight: 800;
        padding: 10px 28px;
        cursor: pointer;
        font-family: var(--font);
      ">Collect & Continue</button>
    </div>
  `;
  el.id = 'offline-modal';
  document.body.appendChild(el);
}

// ── INIT ──────────────────────────────────────────
/**
 * Initialize UI — build all panels, start tip rotation.
 * @param {object}   state
 * @param {object}   callbacks  { onDeptClick, onPrestige, onBuyUpgrade, onBuyDeptLevel, onShopToggle, onSave }
 */
/**
 * Initialize UI.
 * @param {object}   state
 * @param {object}   callbacks  { getState, onDeptClick, onPrestige,
 *                                onBuyUpgrade, onBuyDeptLevel, onSave }
 * NOTE: callbacks.getState() returns the live state reference,
 *       avoiding stale closure issues.
 */
function initUI(state, callbacks) {
  buildDeptCards(state, callbacks.onDeptClick);
  buildRightPanel(state, callbacks.onPrestige);
  rotateTip();

  setInterval(rotateTip, 8000);

  const shopBtn = document.getElementById('btn-shop');
  if (shopBtn) {
    shopBtn.addEventListener('click', () => {
      const s = callbacks.getState();
      toggleShop(s, callbacks.onBuyUpgrade, callbacks.onBuyDeptLevel);
    });
  }
  const saveBtn = document.getElementById('btn-save');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      callbacks.onSave();
      showToast('💾 Game saved!');
    });
  }
  const shopCloseBtn = document.getElementById('shop-close-btn');
  if (shopCloseBtn) {
    shopCloseBtn.addEventListener('click', closeShop);
  }
}

// ── FULL UI REFRESH ───────────────────────────────
/**
 * Lightweight per-frame update — only updates values, not DOM structure.
 * Call this every frame from game.js.
 * @param {object} state
 * @param {number} gps
 */
function tickUI(state, gps) {
  updateTopBar(state, gps);
  DEPT_ORDER.forEach(k => updateDeptCard(k, state)); // fast: bar only
}

/**
 * Heavy update — rebuilds shop if open, updates stat card.
 * Call every ~60 frames (1 second).
 * @param {object}   state
 * @param {function} onBuyUpgrade
 * @param {function} onBuyDeptLevel
 * @param {function} onPrestige
 */
function slowTickUI(state, onBuyUpgrade, onBuyDeptLevel, onPrestige) {
  updateStatCard(state);
  updatePrestigeCard(state, onPrestige);
  DEPT_ORDER.forEach(k => slowUpdateDeptCard(k, state));
  if (shopOpen) buildShop(state, onBuyUpgrade, onBuyDeptLevel);
}
