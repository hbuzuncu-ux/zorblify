/**
 * PEER REVIEW — right.js
 * Sağ panel: rakip panosu, Nobel sıralaması,
 * fon/bütçe durumu, bekleyen kararlar listesi.
 * GDD v3.0 §9.1 Sağ Panel layout referansı.
 * Tam çalışan HTML/CSS/JS — #panel-right div'ine mount edilir.
 */

'use strict';

import {
  RIVAL_DEFS,
  FIELDS,
  NOBEL,
} from '../../utils/constants.js';
import {
  getRivalRanking,
} from '../../systems/rivals.js';
import {
  getBudgetSummary,
  getGrantOptions,
  applyForGrant,
  purchaseEquipment,
} from '../../systems/economy.js';
import {
  getState,
  addNotification,
} from '../../core/state.js';
import { EventBus } from '../../core/game.js';
import {
  getAvailableEquipment,
  EQUIPMENT_DEFS,
  EQUIPMENT_CATEGORIES,
} from '../../data/equipment_defs.js';

// ─── PANEL KURULUM ────────────────────────────────────────────────────────────

let _container  = null;
let _activeTab  = 'rivals';   // 'rivals' | 'budget' | 'grants' | 'equipment'

/**
 * Sağ paneli başlatır. index.html'de bir kez çağrılır.
 * @param {HTMLElement} container  — #panel-right
 */
export function initRightPanel(container) {
  _container = container;
  injectStyles();
  render();
  registerEvents();
}

function registerEvents() {
  EventBus.on('game:week_end',              () => render());
  EventBus.on('rival:nobel_score_updated',  () => render());
  EventBus.on('rival:published',            () => render());
  EventBus.on('economy:month_tick',         () => render());
  EventBus.on('economy:grant_accepted',     () => render());
  EventBus.on('economy:grant_expired',      () => render());
  EventBus.on('economy:equipment_purchased',() => render());
  EventBus.on('event:pending',              () => render());
  EventBus.on('event:resolved',             () => render());
  EventBus.on('nobel:signal',               () => render());
  EventBus.on('nobel:longlist',             () => render());
  EventBus.on('nobel:shortlist',            () => render());
}

// ─── ANA RENDER ───────────────────────────────────────────────────────────────

function render() {
  if (!_container) return;
  const state = getState();

  _container.innerHTML = `
    <div class="rp-root">
      ${renderPendingEvents(state)}
      ${renderNobelStatus(state)}
      ${renderTabBar()}
      <div class="rp-tab-content">
        ${_activeTab === 'rivals'    ? renderRivalsTab(state)    : ''}
        ${_activeTab === 'budget'    ? renderBudgetTab()         : ''}
        ${_activeTab === 'grants'    ? renderGrantsTab(state)    : ''}
        ${_activeTab === 'equipment' ? renderEquipmentTab(state) : ''}
      </div>
    </div>
  `;

  bindEvents();
}

// ─── BEKLEYENKararlar ─────────────────────────────────────────────────────────

function renderPendingEvents(state) {
  const count = state.events.pending.length;
  if (count === 0) return '';

  return `
    <div class="rp-pending">
      <span class="rp-pending__icon">⚡</span>
      <span class="rp-pending__text">
        ${count} bekleyen karar
      </span>
      <span class="rp-pending__badge">${count}</span>
    </div>
  `;
}

// ─── NOBEL DURUMU ─────────────────────────────────────────────────────────────

function renderNobelStatus(state) {
  const totalScore = Object.values(state.lab.nobelScores ?? {})
    .reduce((s, v) => s + v, 0);
  const nobel      = state.nobel;

  // Hangi eşiğe ne kadar kaldı
  let nextThreshold = NOBEL.SIGNAL_THRESHOLD;
  let nextLabel     = 'Nobel Sinyali';
  if (nobel.hasSignal)   { nextThreshold = NOBEL.LONGLIST_THRESHOLD; nextLabel = 'Uzun Liste'; }
  if (nobel.onLongList)  { nextThreshold = NOBEL.SHORTLIST_THRESHOLD; nextLabel = 'Kısa Liste'; }
  if (nobel.onShortList) { nextThreshold = NOBEL.WIN_THRESHOLD; nextLabel = 'Nobel Ödülü'; }
  if (nobel.won)         { nextThreshold = totalScore; nextLabel = '🏅 Nobel Kazanıldı!'; }

  const pct = Math.min(100, Math.round((totalScore / nextThreshold) * 100));

  return `
    <div class="rp-nobel">
      <div class="rp-nobel__head">
        <span class="rp-nobel__title">Nobel Skoru</span>
        <span class="rp-nobel__score">${Math.round(totalScore)}</span>
      </div>
      <div class="rp-nobel__bar">
        <div class="rp-nobel__fill" style="width:${pct}%"></div>
      </div>
      <div class="rp-nobel__labels">
        <span class="rp-nobel__next">${nextLabel}</span>
        <span class="rp-nobel__pct">${pct}%</span>
      </div>
      ${nobel.onShortList ? `
        <div class="rp-nobel__shortlist">
          🏆 Kısa Liste: ${nobel.shortListPosition}. sıra
        </div>` : ''}
    </div>
  `;
}

// ─── TAB BAR ─────────────────────────────────────────────────────────────────

function renderTabBar() {
  const tabs = [
    { id: 'rivals',    label: 'Rakipler' },
    { id: 'budget',    label: 'Bütçe'   },
    { id: 'grants',    label: 'Hibeler' },
    { id: 'equipment', label: 'Ekipman' },
  ];

  return `
    <div class="rp-tabs">
      ${tabs.map(t => `
        <button class="rp-tab ${_activeTab === t.id ? 'rp-tab--active' : ''}"
                data-tab="${t.id}">
          ${t.label}
        </button>
      `).join('')}
    </div>
  `;
}

// ─── RAKİPLER TABI ───────────────────────────────────────────────────────────

function renderRivalsTab(state) {
  const ranking = getRivalRanking();

  return `
    <div class="rp-rivals">
      ${ranking.map((entry, idx) => renderRivalRow(entry, idx + 1, state)).join('')}
    </div>
  `;
}

function renderRivalRow(entry, position, state) {
  const isPlayer   = entry.isPlayer;
  const def        = isPlayer ? null : RIVAL_DEFS[entry.id];
  const maxScore   = NOBEL.WIN_THRESHOLD;
  const barPct     = Math.min(100, Math.round((entry.nobelScore / maxScore) * 100));

  return `
    <div class="rp-rival ${isPlayer ? 'rp-rival--player' : ''}">
      <div class="rp-rival__rank">${position}</div>
      <div class="rp-rival__body">
        <div class="rp-rival__head">
          <span class="rp-rival__short" style="color:${entry.color}">${entry.short}</span>
          <span class="rp-rival__score">${entry.nobelScore}</span>
        </div>
        <div class="rp-rival__bar">
          <div class="rp-rival__fill" style="width:${barPct}%;background:${entry.color}"></div>
        </div>
        ${!isPlayer && def ? `
        <div class="rp-rival__meta">
          ${def.strengths.map(f =>
            `<span class="rp-rival__field" style="color:${FIELDS[f]?.color ?? '#8888aa'}">${FIELDS[f]?.label ?? f}</span>`
          ).join('')}
          · ${entry.activeProjects} proje
        </div>` : `
        <div class="rp-rival__meta">
          ${state.projects.active.length} aktif proje
        </div>`}
      </div>
    </div>
  `;
}

// ─── BÜTÇE TABI ──────────────────────────────────────────────────────────────

function renderBudgetTab() {
  const summary = getBudgetSummary();
  const state   = getState();

  const deltaColor = summary.delta >= 0 ? '#4ade80' : '#f87171';
  const runwayColor = summary.runway <= 2 ? '#f87171'
                    : summary.runway <= 4 ? '#fb923c'
                    : '#4ade80';

  return `
    <div class="rp-budget">

      <!-- Özet -->
      <div class="rp-budget__summary">
        <div class="rp-budget__item">
          <span class="rp-budget__k">Mevcut Bütçe</span>
          <span class="rp-budget__v">${state.lab.budget.toLocaleString()}</span>
        </div>
        <div class="rp-budget__item">
          <span class="rp-budget__k">Aylık Denge</span>
          <span class="rp-budget__v" style="color:${deltaColor}">
            ${summary.delta >= 0 ? '+' : ''}${summary.delta.toLocaleString()}
          </span>
        </div>
        <div class="rp-budget__item">
          <span class="rp-budget__k">Dayanma Süresi</span>
          <span class="rp-budget__v" style="color:${runwayColor}">
            ~${summary.runway} ay
          </span>
        </div>
      </div>

      <!-- Gelir detayı -->
      <div class="rp-budget__section">
        <div class="rp-budget__label">Aylık Gelir — ${summary.income.total.toLocaleString()}</div>
        ${renderBudgetLine('Devlet Fonu',      summary.income.base,       '#4ade80')}
        ${renderBudgetLine('Hibeler',          summary.income.grants,     '#3b82f6')}
        ${renderBudgetLine('Patentler',        summary.income.patents,    '#f0c060')}
        ${renderBudgetLine('Üniversite',       summary.income.university, '#2dd4bf')}
      </div>

      <!-- Gider detayı -->
      <div class="rp-budget__section">
        <div class="rp-budget__label">Aylık Gider — ${summary.expenses.total.toLocaleString()}</div>
        ${renderBudgetLine('Maaşlar',          summary.expenses.salaries,     '#f87171')}
        ${renderBudgetLine('Ekipman Bakımı',   summary.expenses.equipment,    '#fb923c')}
        ${renderBudgetLine('Tesis',            summary.expenses.facility,     '#fb923c')}
        ${renderBudgetLine('Yayın Ücretleri',  summary.expenses.publications, '#fb923c')}
      </div>
    </div>
  `;
}

function renderBudgetLine(label, amount, color) {
  if (amount === 0) return '';
  return `
    <div class="rp-budget__line">
      <span class="rp-budget__line-k">${label}</span>
      <span class="rp-budget__line-v" style="color:${color}">${amount.toLocaleString()}</span>
    </div>
  `;
}

// ─── HİBELER TABI ────────────────────────────────────────────────────────────

function renderGrantsTab(state) {
  const options = getGrantOptions();

  const activeGrants = state.lab.grants.filter(g => g.monthsLeft > 0);

  return `
    <div class="rp-grants">

      ${activeGrants.length > 0 ? `
      <div class="rp-grants__section">
        <div class="rp-grants__label">Aktif Hibeler (${activeGrants.length})</div>
        ${activeGrants.map(g => `
          <div class="rp-grant-row rp-grant-row--active">
            <div class="rp-grant-row__name">${g.label}</div>
            <div class="rp-grant-row__meta">
              ${g.monthlyAmount.toLocaleString()}/ay · ${g.monthsLeft} ay kaldı
            </div>
          </div>
        `).join('')}
      </div>` : ''}

      <div class="rp-grants__section">
        <div class="rp-grants__label">Başvuru Seçenekleri</div>
        ${options.map(opt => renderGrantOption(opt)).join('')}
      </div>
    </div>
  `;
}

function renderGrantOption(opt) {
  const { id, def, acceptRate, alreadyApplied, alreadyActive } = opt;
  const disabled = alreadyApplied || alreadyActive;

  return `
    <div class="rp-grant-row ${disabled ? 'rp-grant-row--disabled' : ''}">
      <div class="rp-grant-row__head">
        <span class="rp-grant-row__name">${def.label}</span>
        <span class="rp-grant-row__rate">%${acceptRate}</span>
      </div>
      <div class="rp-grant-row__meta">
        ${def.amountRange[0].toLocaleString()}–${def.amountRange[1].toLocaleString()}/ay ·
        ${def.durationMonths} ay ·
        ${def.applicationWeeks * 4} hafta değerlendirme
      </div>
      <button class="rp-grant-btn ${disabled ? 'rp-grant-btn--disabled' : ''}"
              data-grant-id="${id}"
              ${disabled ? 'disabled' : ''}>
        ${alreadyActive    ? '✓ Aktif'
        : alreadyApplied   ? '⏳ Bekliyor'
        : 'Başvur'}
      </button>
    </div>
  `;
}

// ─── EKİPMAN TABI ────────────────────────────────────────────────────────────

function renderEquipmentTab(state) {
  const available = getAvailableEquipment(
    state.lab.equipment,
    state.lab.level,
    state.lab.budget
  );
  const owned = state.lab.equipment;

  return `
    <div class="rp-equipment">

      ${owned.length > 0 ? `
      <div class="rp-equip__section">
        <div class="rp-equip__label">Mevcut Ekipmanlar (${owned.length})</div>
        ${owned.map(e => renderOwnedEquipment(e)).join('')}
      </div>` : ''}

      <div class="rp-equip__section">
        <div class="rp-equip__label">Satın Alınabilir</div>
        ${available.length === 0
          ? '<div class="rp-equip__empty">Tüm ekipmanlar mevcut.</div>'
          : available.map(item => renderEquipmentOption(item, state)).join('')
        }
      </div>
    </div>
  `;
}

function renderOwnedEquipment(owned) {
  const def       = EQUIPMENT_DEFS[owned.id];
  if (!def) return '';
  const condition = getConditionLabel(owned);

  return `
    <div class="rp-equip-row">
      <span class="rp-equip-row__icon">${def.icon ?? '🔧'}</span>
      <div class="rp-equip-row__info">
        <div class="rp-equip-row__name">${def.label}</div>
        <div class="rp-equip-row__meta">
          <span style="color:${condition.color}">${condition.label}</span> ·
          Bakım: ${def.maintenance}/ay
        </div>
      </div>
    </div>
  `;
}

function renderEquipmentOption(item, state) {
  const { id, def, canAfford, available } = item;
  const disabled = !available || !canAfford;

  return `
    <div class="rp-equip-row ${disabled ? 'rp-equip-row--disabled' : ''}">
      <span class="rp-equip-row__icon">${def.icon ?? '🔧'}</span>
      <div class="rp-equip-row__info">
        <div class="rp-equip-row__name">${def.label}</div>
        <div class="rp-equip-row__meta">
          ${def.cost.toLocaleString()} · Bakım: ${def.maintenance}/ay
          ${!available && item.prerequisite
            ? `<span class="rp-equip-row__req">Ön koşul gerekli</span>` : ''}
          ${!item.levelMet
            ? `<span class="rp-equip-row__req">Lab Sv. ${def.labLevelReq} gerekli</span>` : ''}
          ${!canAfford
            ? `<span class="rp-equip-row__req" style="color:#f87171">Bütçe yetersiz</span>` : ''}
        </div>
      </div>
      <button class="rp-equip-btn ${disabled ? 'rp-equip-btn--disabled' : ''}"
              data-equip-id="${id}"
              ${disabled ? 'disabled' : ''}>
        Al
      </button>
    </div>
  `;
}

// ─── EVENT BAĞLAMA ────────────────────────────────────────────────────────────

function bindEvents() {
  if (!_container) return;

  // Tab geçişleri
  _container.querySelectorAll('.rp-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      _activeTab = btn.dataset.tab;
      render();
    });
  });

  // Hibe başvuru butonları
  _container.querySelectorAll('.rp-grant-btn:not([disabled])').forEach(btn => {
    btn.addEventListener('click', () => {
      const grantId = btn.dataset.grantId;
      applyForGrant(grantId, getState());
      render();
    });
  });

  // Ekipman satın alma butonları
  _container.querySelectorAll('.rp-equip-btn:not([disabled])').forEach(btn => {
    btn.addEventListener('click', () => {
      const equipId = btn.dataset.equipId;
      purchaseEquipment(equipId);
      render();
    });
  });
}

// ─── CSS ─────────────────────────────────────────────────────────────────────

function injectStyles() {
  if (document.getElementById('rp-styles')) return;
  const s = document.createElement('style');
  s.id = 'rp-styles';
  s.textContent = `
  /* ── Kök ── */
  .rp-root {
    display:flex; flex-direction:column; height:100%; overflow:hidden;
    font-family:'DM Sans',sans-serif; color:#f0f0ff;
  }

  /* ── Bekleyen Kararlar ── */
  .rp-pending {
    display:flex; align-items:center; gap:8px;
    background:rgba(251,191,36,.12); border:1px solid rgba(251,191,36,.3);
    border-radius:8px; margin:8px 8px 0; padding:8px 12px;
    flex-shrink:0;
  }
  .rp-pending__icon { font-size:14px; }
  .rp-pending__text { font-size:12px; font-weight:600; color:#fbbf24; flex:1; }
  .rp-pending__badge {
    background:#fbbf24; color:#07070f;
    font-size:11px; font-weight:700;
    padding:1px 7px; border-radius:10px;
  }

  /* ── Nobel Durumu ── */
  .rp-nobel {
    margin:8px; padding:10px 12px;
    background:#12122a; border:1px solid rgba(255,255,255,.07);
    border-radius:10px; flex-shrink:0;
  }
  .rp-nobel__head { display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; }
  .rp-nobel__title { font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.06em; color:#8888aa; }
  .rp-nobel__score { font-size:18px; font-weight:700; color:#f0c060; }
  .rp-nobel__bar   { height:6px; background:rgba(255,255,255,.08); border-radius:3px; overflow:hidden; margin-bottom:4px; }
  .rp-nobel__fill  { height:100%; background:linear-gradient(90deg,#a78bfa,#f0c060); border-radius:3px; transition:width .4s; }
  .rp-nobel__labels { display:flex; justify-content:space-between; font-size:10px; color:#8888aa; }
  .rp-nobel__shortlist {
    margin-top:6px; font-size:11px; font-weight:700;
    color:#f0c060; text-align:center;
  }

  /* ── Tab Bar ── */
  .rp-tabs {
    display:flex; gap:2px; padding:6px 8px;
    flex-shrink:0; border-bottom:1px solid rgba(255,255,255,.07);
  }
  .rp-tab {
    flex:1; padding:5px 4px; font-size:10px; font-weight:600;
    background:transparent; border:1px solid transparent;
    color:#8888aa; border-radius:6px; cursor:pointer;
    transition:all .15s; min-height:32px;
  }
  .rp-tab:hover { color:#f0f0ff; background:rgba(255,255,255,.06); }
  .rp-tab--active {
    color:#a78bfa; background:rgba(124,58,237,.15);
    border-color:rgba(124,58,237,.35);
  }

  /* ── Tab İçerik ── */
  .rp-tab-content {
    flex:1; overflow-y:auto; padding:8px;
    scrollbar-width:thin; scrollbar-color:rgba(255,255,255,.1) transparent;
  }
  .rp-tab-content::-webkit-scrollbar { width:4px; }
  .rp-tab-content::-webkit-scrollbar-thumb { background:rgba(255,255,255,.1); border-radius:2px; }

  /* ── Rakipler ── */
  .rp-rivals { display:flex; flex-direction:column; gap:6px; }
  .rp-rival {
    background:#12122a; border:1px solid rgba(255,255,255,.07);
    border-radius:8px; padding:8px 10px;
    display:flex; align-items:center; gap:8px;
  }
  .rp-rival--player { border-color:rgba(240,192,96,.3); background:rgba(240,192,96,.05); }
  .rp-rival__rank  { font-size:13px; font-weight:700; color:#8888aa; min-width:18px; text-align:center; }
  .rp-rival__body  { flex:1; min-width:0; }
  .rp-rival__head  { display:flex; justify-content:space-between; align-items:center; margin-bottom:3px; }
  .rp-rival__short { font-size:12px; font-weight:700; }
  .rp-rival__score { font-size:13px; font-weight:700; color:#f0c060; }
  .rp-rival__bar   { height:4px; background:rgba(255,255,255,.08); border-radius:2px; overflow:hidden; margin-bottom:3px; }
  .rp-rival__fill  { height:100%; border-radius:2px; transition:width .3s; }
  .rp-rival__meta  { font-size:10px; color:#8888aa; display:flex; flex-wrap:wrap; gap:4px; align-items:center; }
  .rp-rival__field { font-weight:600; }

  /* ── Bütçe ── */
  .rp-budget { display:flex; flex-direction:column; gap:12px; }
  .rp-budget__summary {
    background:#12122a; border:1px solid rgba(255,255,255,.07);
    border-radius:8px; padding:10px;
    display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px;
  }
  .rp-budget__item  { display:flex; flex-direction:column; gap:2px; }
  .rp-budget__k     { font-size:10px; color:#8888aa; }
  .rp-budget__v     { font-size:13px; font-weight:700; color:#f0f0ff; }
  .rp-budget__section { background:#12122a; border:1px solid rgba(255,255,255,.07); border-radius:8px; padding:8px 10px; }
  .rp-budget__label { font-size:11px; font-weight:600; color:#8888aa; text-transform:uppercase; letter-spacing:.05em; margin-bottom:6px; }
  .rp-budget__line  { display:flex; justify-content:space-between; align-items:center; font-size:11px; padding:2px 0; }
  .rp-budget__line-k{ color:#8888aa; }
  .rp-budget__line-v{ font-weight:600; }

  /* ── Hibeler ── */
  .rp-grants { display:flex; flex-direction:column; gap:12px; }
  .rp-grants__section { background:#12122a; border:1px solid rgba(255,255,255,.07); border-radius:8px; padding:8px 10px; }
  .rp-grants__label   { font-size:11px; font-weight:600; color:#8888aa; text-transform:uppercase; letter-spacing:.05em; margin-bottom:8px; }
  .rp-grant-row {
    background:rgba(255,255,255,.03); border-radius:7px; padding:8px;
    margin-bottom:6px;
  }
  .rp-grant-row--active { border-left:2px solid #4ade80; }
  .rp-grant-row--disabled { opacity:.5; }
  .rp-grant-row__head { display:flex; justify-content:space-between; align-items:center; margin-bottom:3px; }
  .rp-grant-row__name { font-size:12px; font-weight:600; }
  .rp-grant-row__rate { font-size:11px; color:#4ade80; font-weight:700; }
  .rp-grant-row__meta { font-size:10px; color:#8888aa; margin-bottom:6px; }
  .rp-grant-btn {
    width:100%; padding:6px; font-size:11px; font-weight:600;
    background:rgba(124,58,237,.2); border:1px solid rgba(124,58,237,.4);
    color:#a78bfa; border-radius:6px; cursor:pointer; min-height:36px;
    transition:background .15s;
  }
  .rp-grant-btn:hover:not(:disabled) { background:rgba(124,58,237,.35); }
  .rp-grant-btn--disabled, .rp-grant-btn:disabled { opacity:.4; cursor:not-allowed; }

  /* ── Ekipman ── */
  .rp-equipment { display:flex; flex-direction:column; gap:12px; }
  .rp-equip__section { background:#12122a; border:1px solid rgba(255,255,255,.07); border-radius:8px; padding:8px 10px; }
  .rp-equip__label   { font-size:11px; font-weight:600; color:#8888aa; text-transform:uppercase; letter-spacing:.05em; margin-bottom:8px; }
  .rp-equip__empty   { font-size:12px; color:#8888aa; padding:4px 0; }
  .rp-equip-row {
    display:flex; align-items:center; gap:8px;
    padding:7px 0; border-bottom:1px solid rgba(255,255,255,.05);
  }
  .rp-equip-row:last-child { border-bottom:none; }
  .rp-equip-row--disabled  { opacity:.5; }
  .rp-equip-row__icon { font-size:16px; flex-shrink:0; }
  .rp-equip-row__info { flex:1; min-width:0; }
  .rp-equip-row__name { font-size:12px; font-weight:600; }
  .rp-equip-row__meta { font-size:10px; color:#8888aa; }
  .rp-equip-row__req  { color:#fb923c; margin-left:4px; }
  .rp-equip-btn {
    padding:4px 10px; font-size:11px; font-weight:600;
    background:rgba(6,182,212,.15); border:1px solid rgba(6,182,212,.35);
    color:#06b6d4; border-radius:6px; cursor:pointer; min-height:36px;
    white-space:nowrap; transition:background .15s; flex-shrink:0;
  }
  .rp-equip-btn:hover:not(:disabled) { background:rgba(6,182,212,.3); }
  .rp-equip-btn--disabled, .rp-equip-btn:disabled { opacity:.4; cursor:not-allowed; }
  `;
  document.head.appendChild(s);
}

// ─── YARDIMCILAR ─────────────────────────────────────────────────────────────

function getConditionLabel(owned) {
  const def   = EQUIPMENT_DEFS[owned.id];
  if (!def) return { label: 'Bilinmiyor', color: '#8888aa' };
  const ratio = owned.age / def.lifespan;
  if (ratio < 0.25) return { label: 'Yeni',      color: '#4ade80' };
  if (ratio < 0.50) return { label: 'İyi',        color: '#a78bfa' };
  if (ratio < 0.75) return { label: 'Eskiyor',    color: '#f0c060' };
  if (ratio < 1.00) return { label: 'Yıpranmış',  color: '#fb923c' };
  return               { label: 'Arızalı',    color: '#f87171' };
}
