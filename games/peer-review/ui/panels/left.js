/**
 * PEER REVIEW — left.js
 * Sol panel: araştırmacı listesi, mini kartlar, işe al butonu.
 * GDD v3.0 §9.1 Sol Panel layout referansı.
 * Tam çalışan HTML/CSS/JS — index.html'deki #panel-left div'ine mount edilir.
 */

'use strict';

import { CAREER_STAGES, PERSONALITY_TYPES, MORALE, COLORS } from '../../utils/constants.js';
import {
  getResearcherTitle,
  getDominantStat,
  getResearcherStatus,
  getCompatibilityScore,
  generateCandidates,
} from '../../data/researcher_defs.js';
import {
  getState, addResearcher, getLabCapacity,
  updateState, addNotification,
} from '../../core/state.js';
import { EventBus } from '../../core/game.js';

// ─── PANEL KURULUM ────────────────────────────────────────────────────────────

let _container = null;       // #panel-left DOM elementi
let _hireModal  = null;      // işe alma modal
let _candidates = [];        // mevcut aday havuzu

/**
 * Sol paneli başlatır. index.html'de bir kez çağrılır.
 * @param {HTMLElement} container  — #panel-left
 */
export function initLeftPanel(container) {
  _container = container;
  injectStyles();
  render();
  registerEvents();
}

/**
 * EventBus'a abone olur — ilgili event'lerde panel yenilenir.
 */
function registerEvents() {
  EventBus.on('game:week_end',          () => render());
  EventBus.on('researcher:burnout',     () => render());
  EventBus.on('researcher:returned',    () => render());
  EventBus.on('researcher:promoted',    () => render());
  EventBus.on('researcher:breakthrough',() => render());
  EventBus.on('researcher:left',        () => render());
}

// ─── ANA RENDER ───────────────────────────────────────────────────────────────

/**
 * Paneli sıfırdan render eder.
 */
function render() {
  if (!_container) return;
  const state    = getState();
  const capacity = getLabCapacity();

  _container.innerHTML = `
    <div class="lp-root">
      ${renderPanelHeader(state, capacity)}
      <div class="lp-list" id="lp-list">
        ${state.researchers.length === 0
          ? renderEmptyState()
          : state.researchers.map(r => renderResearcherCard(r, state)).join('')
        }
      </div>
      ${renderHireButton(state, capacity)}
    </div>
  `;

  bindCardEvents();
}

// ─── PANEL HEADER ─────────────────────────────────────────────────────────────

function renderPanelHeader(state, capacity) {
  const count   = state.researchers.length;
  const burnout = state.researchers.filter(r => r.isBurnout).length;
  const onLeave = state.researchers.filter(r => r.isOnLeave).length;

  return `
    <div class="lp-header">
      <span class="lp-title">Araştırmacılar</span>
      <span class="lp-capacity ${count >= capacity.maxResearchers ? 'lp-capacity--full' : ''}">
        ${count}/${capacity.maxResearchers}
      </span>
    </div>
    ${burnout > 0 || onLeave > 0 ? `
    <div class="lp-alerts">
      ${burnout > 0 ? `<span class="lp-alert lp-alert--warn">⚠ ${burnout} tükenmişlik</span>` : ''}
      ${onLeave > 0 ? `<span class="lp-alert lp-alert--info">✈ ${onLeave} izinde</span>` : ''}
    </div>` : ''}
  `;
}

// ─── ARAŞTIRMACI KARTI ────────────────────────────────────────────────────────

function renderResearcherCard(r, state) {
  const status   = getResearcherStatus(r);
  const dominant = getDominantStat(r);
  const stageData= CAREER_STAGES[r.careerStage];
  const pType    = PERSONALITY_TYPES[r.personality];
  const moraleColor = getMoraleColor(r.morale);
  const statusLabel = getStatusLabel(status, r);

  // Aktif projenin adı
  let projectLabel = '';
  if (r.assignedProjectId) {
    const proj = state.projects.active.find(p => p.id === r.assignedProjectId);
    projectLabel = proj ? proj.label : '';
  }

  return `
    <div class="lp-card lp-card--${status}"
         data-id="${r.id}"
         role="button"
         tabindex="0"
         aria-label="${r.name} araştırmacı kartı">

      <div class="lp-card__top">
        <div class="lp-avatar" style="background:${pType?.color ?? '#8888aa'}">
          ${getAvatarInitials(r.name)}
        </div>
        <div class="lp-card__info">
          <div class="lp-card__name">${r.name}</div>
          <div class="lp-card__title">${getResearcherTitle(r)}</div>
        </div>
        <div class="lp-card__badges">
          <span class="lp-badge" style="background:${stageData?.color ?? '#8888aa'}">
            ${stageData?.label ?? r.careerStage}
          </span>
          <span class="lp-badge lp-badge--personality" title="${r.personality}">
            ${pType?.label ?? r.personality}
          </span>
        </div>
      </div>

      <div class="lp-card__stats">
        <div class="lp-stat-row">
          ${renderMiniStats(r)}
        </div>
        <div class="lp-dominant">
          <span class="lp-dominant__label">En İyi:</span>
          <span class="lp-dominant__value">${dominant.label} ${dominant.value}</span>
        </div>
      </div>

      <div class="lp-card__bottom">
        <div class="lp-morale">
          <div class="lp-morale__bar">
            <div class="lp-morale__fill"
                 style="width:${r.morale}%; background:${moraleColor}">
            </div>
          </div>
          <span class="lp-morale__label" style="color:${moraleColor}">
            ${r.morale}
          </span>
        </div>
        <div class="lp-status lp-status--${status}">${statusLabel}</div>
      </div>

      ${projectLabel ? `
      <div class="lp-card__project">
        📋 ${projectLabel}
      </div>` : ''}
    </div>
  `;
}

/**
 * 8 stat için mini gösterge çubukları.
 * Sadece 4 tanesi gösterilir (en az yer kaplayan).
 */
function renderMiniStats(r) {
  const stats = [
    { id: 'AN', v: r.AN, label: 'AN' },
    { id: 'CR', v: r.CR, label: 'CR' },
    { id: 'LB', v: r.LB, label: 'LB' },
    { id: 'WR', v: r.WR, label: 'WR' },
    { id: 'TW', v: r.TW, label: 'TW' },
    { id: 'AM', v: r.AM, label: 'AM' },
    { id: 'RS', v: r.RS, label: 'RS' },
    { id: 'RP', v: r.RP, label: 'RP' },
  ];

  // En yüksek 4 stat göster
  const top4 = [...stats].sort((a, b) => b.v - a.v).slice(0, 4);

  return top4.map(s => `
    <div class="lp-mini-stat" title="${s.id}: ${s.v}">
      <span class="lp-mini-stat__id">${s.label}</span>
      <div class="lp-mini-stat__bar">
        <div class="lp-mini-stat__fill" style="width:${s.v}%"></div>
      </div>
      <span class="lp-mini-stat__val">${s.v}</span>
    </div>
  `).join('');
}

function renderEmptyState() {
  return `
    <div class="lp-empty">
      <div class="lp-empty__icon">🔬</div>
      <div class="lp-empty__text">Henüz araştırmacı yok.</div>
      <div class="lp-empty__sub">İlk araştırmacını işe al ve projelere başla.</div>
    </div>
  `;
}

function renderHireButton(state, capacity) {
  const isFull    = state.researchers.length >= capacity.maxResearchers;
  const canAfford = state.lab.budget >= 800;  // minimum junior maaşı

  return `
    <button class="lp-hire-btn ${isFull ? 'lp-hire-btn--disabled' : ''}"
            id="lp-hire-btn"
            ${isFull ? 'disabled' : ''}
            title="${isFull ? 'Kapasite dolu — lab seviyesini artır' : 'Yeni araştırmacı işe al'}">
      ${isFull ? '🔒 Kapasite Dolu' : '+ Araştırmacı İşe Al'}
    </button>
    ${!canAfford && !isFull
      ? `<div class="lp-warn-text">⚠ Bütçe yetersiz olabilir</div>`
      : ''}
  `;
}

// ─── KART TIKLAMA / DETAY ─────────────────────────────────────────────────────

function bindCardEvents() {
  if (!_container) return;

  // Araştırmacı kartı tıklama → detay modal
  _container.querySelectorAll('.lp-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.id;
      openResearcherDetail(id);
    });
    // Klavye erişilebilirliği
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openResearcherDetail(card.dataset.id);
      }
    });
  });

  // İşe al butonu
  const hireBtn = document.getElementById('lp-hire-btn');
  if (hireBtn) {
    hireBtn.addEventListener('click', openHireModal);
  }
}

// ─── ARAŞTIRMACI DETAY MODAL ──────────────────────────────────────────────────

function openResearcherDetail(id) {
  const state      = getState();
  const researcher = state.researchers.find(r => r.id === id);
  if (!researcher) return;

  // UI state'e seçili araştırmacıyı kaydet
  updateState('ui.selectedResearcherId', id);

  const modal = document.getElementById('researcher-detail-modal');
  if (modal) {
    // Eğer merkez panel detail modal'ı varsa onu kullan
    EventBus.emit('ui:show_researcher_detail', { researcher });
    return;
  }

  // Fallback: basit inline detail
  showSimpleDetailToast(researcher);
}

function showSimpleDetailToast(r) {
  // Geçici: konsola yaz — Hafta 7'de tam modal gelecek
  console.info('[left.js] Araştırmacı detayı:', r.name, r);
  addNotification(`${r.name} seçildi. Detay paneli yakında.`, 'info', 2);
}

// ─── İŞE ALMA MODAL ───────────────────────────────────────────────────────────

function openHireModal() {
  const state    = getState();
  const capacity = getLabCapacity();

  if (state.researchers.length >= capacity.maxResearchers) return;

  // Aday havuzu üret
  _candidates = generateCandidates(4);

  // Modal oluştur
  const existing = document.getElementById('lp-hire-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id        = 'lp-hire-modal';
  modal.className = 'lp-modal-overlay';
  modal.innerHTML = renderHireModal(_candidates, state);

  document.body.appendChild(modal);
  bindHireModalEvents(modal);
}

function renderHireModal(candidates, state) {
  return `
    <div class="lp-modal" role="dialog" aria-modal="true" aria-label="Araştırmacı İşe Al">
      <div class="lp-modal__header">
        <span class="lp-modal__title">Araştırmacı İşe Al</span>
        <button class="lp-modal__close" id="lp-modal-close" aria-label="Kapat">✕</button>
      </div>
      <p class="lp-modal__sub">
        Mevcut bütçe: <strong>${state.lab.budget.toLocaleString()}</strong> |
        Kapasite: ${state.researchers.length}/${getLabCapacity().maxResearchers}
      </p>
      <button class="lp-modal__refresh" id="lp-modal-refresh">
        🔄 Yeni Adaylar Göster
      </button>
      <div class="lp-modal__candidates" id="lp-modal-candidates">
        ${candidates.map(c => renderCandidateCard(c, state)).join('')}
      </div>
    </div>
  `;
}

function renderCandidateCard(candidate, state) {
  const pType    = PERSONALITY_TYPES[candidate.personality];
  const stageData= CAREER_STAGES[candidate.careerStage];
  const canAfford= state.lab.budget >= candidate.salary * 3;  // 3 aylık maaş yeterli mi

  // Mevcut takımla uyum skorları
  const compatScores = state.researchers.map(r => ({
    name:  r.name.split(' ')[0],
    score: getCompatibilityScore(r, candidate),
  }));

  return `
    <div class="lp-candidate ${!canAfford ? 'lp-candidate--unaffordable' : ''}">
      <div class="lp-candidate__top">
        <div class="lp-avatar lp-avatar--lg" style="background:${pType?.color ?? '#8888aa'}">
          ${getAvatarInitials(candidate.name)}
        </div>
        <div>
          <div class="lp-candidate__name">${candidate.name}</div>
          <div class="lp-candidate__title">${getResearcherTitle(candidate)}</div>
          <div class="lp-candidate__badges">
            <span class="lp-badge" style="background:${stageData?.color ?? '#8888aa'}">
              ${stageData?.label}
            </span>
            <span class="lp-badge lp-badge--personality">${pType?.label}</span>
            <span class="lp-badge lp-badge--field">${candidate.field}</span>
          </div>
        </div>
      </div>

      <div class="lp-candidate__stats">
        ${renderAllStats(candidate)}
      </div>

      ${compatScores.length > 0 ? `
      <div class="lp-candidate__compat">
        <span class="lp-compat__label">Ekip Uyumu:</span>
        ${compatScores.map(cs => `
          <span class="lp-compat__score lp-compat__score--${getCompatClass(cs.score)}">
            ${cs.name} ${cs.score}
          </span>
        `).join('')}
      </div>` : ''}

      <div class="lp-candidate__footer">
        <span class="lp-candidate__salary">
          💰 ${candidate.salary.toLocaleString()}/ay
          ${!canAfford ? '<span class="lp-warn">(Bütçe yetersiz)</span>' : ''}
        </span>
        <button class="lp-hire-confirm-btn ${!canAfford ? 'lp-hire-confirm-btn--disabled' : ''}"
                data-candidate-id="${candidate.id}"
                ${!canAfford ? 'disabled' : ''}>
          İşe Al
        </button>
      </div>
    </div>
  `;
}

function renderAllStats(r) {
  const stats = [
    { id: 'AN', label: 'Analitik', v: r.AN },
    { id: 'CR', label: 'Yaratıcılık', v: r.CR },
    { id: 'LB', label: 'Lab', v: r.LB },
    { id: 'WR', label: 'Yazarlık', v: r.WR },
    { id: 'TW', label: 'Ekip', v: r.TW },
    { id: 'AM', label: 'Hırs', v: r.AM },
    { id: 'RS', label: 'Dayanıklılık', v: r.RS },
    { id: 'RP', label: 'İtibar', v: r.RP },
  ];

  return `<div class="lp-all-stats">
    ${stats.map(s => `
      <div class="lp-full-stat">
        <span class="lp-full-stat__label">${s.label}</span>
        <div class="lp-full-stat__bar">
          <div class="lp-full-stat__fill" style="width:${s.v}%;background:${getStatColor(s.v)}"></div>
        </div>
        <span class="lp-full-stat__val">${s.v}</span>
      </div>
    `).join('')}
  </div>`;
}

function bindHireModalEvents(modal) {
  // Kapat
  modal.querySelector('#lp-modal-close').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => {
    if (e.target === modal) modal.remove();
  });

  // Yeni adaylar
  modal.querySelector('#lp-modal-refresh').addEventListener('click', () => {
    _candidates = generateCandidates(4);
    const state = getState();
    modal.querySelector('#lp-modal-candidates').innerHTML =
      _candidates.map(c => renderCandidateCard(c, state)).join('');
    bindConfirmButtons(modal);
  });

  bindConfirmButtons(modal);
}

function bindConfirmButtons(modal) {
  modal.querySelectorAll('.lp-hire-confirm-btn:not([disabled])').forEach(btn => {
    btn.addEventListener('click', () => {
      const candidateId = btn.dataset.candidateId;
      const candidate   = _candidates.find(c => c.id === candidateId);
      if (!candidate) return;

      confirmHire(candidate);
      modal.remove();
    });
  });
}

/**
 * Araştırmacıyı işe alır.
 * @param {Object} candidate
 */
function confirmHire(candidate) {
  addResearcher(candidate);
  EventBus.emit('researcher:hired', { researcher: candidate });
  addNotification(`${candidate.name} ekibe katıldı!`, 'success', 5);
  render();
}

// ─── CSS ENJEKSİYONU ──────────────────────────────────────────────────────────

function injectStyles() {
  if (document.getElementById('lp-styles')) return;

  const style = document.createElement('style');
  style.id    = 'lp-styles';
  style.textContent = `
    /* ── Sol Panel Kök ── */
    .lp-root {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
      font-family: 'DM Sans', sans-serif;
      color: #f0f0ff;
    }

    /* ── Header ── */
    .lp-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 14px 6px;
      border-bottom: 1px solid rgba(255,255,255,0.07);
      flex-shrink: 0;
    }
    .lp-title {
      font-size: 13px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #8888aa;
    }
    .lp-capacity {
      font-size: 12px;
      font-weight: 700;
      color: #4ade80;
      background: rgba(74,222,128,0.12);
      padding: 2px 8px;
      border-radius: 10px;
    }
    .lp-capacity--full {
      color: #fb923c;
      background: rgba(251,146,60,0.12);
    }
    .lp-alerts {
      display: flex;
      gap: 6px;
      padding: 4px 14px 6px;
      flex-shrink: 0;
    }
    .lp-alert {
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 8px;
    }
    .lp-alert--warn { background: rgba(251,146,60,0.18); color: #fb923c; }
    .lp-alert--info { background: rgba(59,130,246,0.18); color: #3b82f6; }

    /* ── Liste ── */
    .lp-list {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      scrollbar-width: thin;
      scrollbar-color: rgba(255,255,255,0.1) transparent;
    }
    .lp-list::-webkit-scrollbar { width: 4px; }
    .lp-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }

    /* ── Araştırmacı Kartı ── */
    .lp-card {
      background: #12122a;
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 10px;
      padding: 10px;
      cursor: pointer;
      transition: border-color 0.15s, background 0.15s;
      min-height: 44px;
    }
    .lp-card:hover, .lp-card:focus {
      border-color: rgba(124,58,237,0.5);
      background: #1a1a35;
      outline: none;
    }
    .lp-card--burnout {
      border-color: rgba(251,146,60,0.4);
      background: rgba(251,146,60,0.06);
    }
    .lp-card--leave {
      border-color: rgba(59,130,246,0.4);
      opacity: 0.75;
    }

    /* Kart üst kısmı */
    .lp-card__top {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin-bottom: 8px;
    }
    .lp-avatar {
      width: 36px; height: 36px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 700;
      color: #fff;
      flex-shrink: 0;
      min-width: 36px; min-height: 36px;
    }
    .lp-avatar--lg {
      width: 48px; height: 48px;
      font-size: 15px;
      min-width: 48px; min-height: 48px;
    }
    .lp-card__info { flex: 1; min-width: 0; }
    .lp-card__name {
      font-size: 13px; font-weight: 600;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .lp-card__title { font-size: 11px; color: #8888aa; margin-top: 1px; }
    .lp-card__badges {
      display: flex; flex-direction: column; gap: 3px; align-items: flex-end;
    }

    /* Badges */
    .lp-badge {
      font-size: 10px; font-weight: 600;
      padding: 1px 6px; border-radius: 6px;
      color: #fff; white-space: nowrap;
      opacity: 0.85;
    }
    .lp-badge--personality { background: rgba(255,255,255,0.12); color: #f0f0ff; }
    .lp-badge--field { background: rgba(45,212,191,0.2); color: #2dd4bf; }

    /* Stat çubukları (mini) */
    .lp-card__stats { margin-bottom: 6px; }
    .lp-stat-row { display: flex; flex-direction: column; gap: 3px; }
    .lp-mini-stat {
      display: grid;
      grid-template-columns: 20px 1fr 22px;
      align-items: center;
      gap: 4px;
    }
    .lp-mini-stat__id { font-size: 10px; color: #8888aa; font-weight: 600; }
    .lp-mini-stat__bar {
      height: 4px; background: rgba(255,255,255,0.08);
      border-radius: 2px; overflow: hidden;
    }
    .lp-mini-stat__fill {
      height: 100%; background: #7c3aed;
      border-radius: 2px; transition: width 0.3s;
    }
    .lp-mini-stat__val { font-size: 10px; color: #8888aa; text-align: right; }
    .lp-dominant {
      font-size: 10px; color: #8888aa; margin-top: 4px;
      display: flex; gap: 4px;
    }
    .lp-dominant__value { color: #f0c060; font-weight: 600; }

    /* Moral bar */
    .lp-card__bottom {
      display: flex; align-items: center; justify-content: space-between; gap: 8px;
    }
    .lp-morale { display: flex; align-items: center; gap: 6px; flex: 1; }
    .lp-morale__bar {
      flex: 1; height: 5px; background: rgba(255,255,255,0.08);
      border-radius: 3px; overflow: hidden;
    }
    .lp-morale__fill { height: 100%; border-radius: 3px; transition: width 0.3s; }
    .lp-morale__label { font-size: 11px; font-weight: 700; min-width: 24px; }

    /* Durum etiketi */
    .lp-status {
      font-size: 10px; padding: 2px 7px; border-radius: 6px;
      white-space: nowrap; font-weight: 600;
    }
    .lp-status--active   { background: rgba(74,222,128,0.15); color: #4ade80; }
    .lp-status--idle     { background: rgba(136,136,170,0.15); color: #8888aa; }
    .lp-status--burnout  { background: rgba(251,146,60,0.15); color: #fb923c; }
    .lp-status--leave    { background: rgba(59,130,246,0.15); color: #3b82f6; }

    /* Proje etiketi */
    .lp-card__project {
      font-size: 10px; color: #8888aa; margin-top: 5px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }

    /* Boş durum */
    .lp-empty {
      text-align: center; padding: 40px 20px;
      display: flex; flex-direction: column; align-items: center; gap: 8px;
    }
    .lp-empty__icon { font-size: 32px; opacity: 0.4; }
    .lp-empty__text { font-size: 13px; color: #8888aa; font-weight: 600; }
    .lp-empty__sub  { font-size: 11px; color: #555577; }

    /* İşe al butonu */
    .lp-hire-btn {
      margin: 8px;
      padding: 10px;
      width: calc(100% - 16px);
      background: rgba(124,58,237,0.2);
      border: 1px solid rgba(124,58,237,0.4);
      color: #a78bfa;
      font-size: 13px; font-weight: 600;
      border-radius: 8px; cursor: pointer;
      transition: background 0.15s, border-color 0.15s;
      min-height: 44px;
      flex-shrink: 0;
    }
    .lp-hire-btn:hover:not(:disabled) {
      background: rgba(124,58,237,0.35);
      border-color: rgba(124,58,237,0.7);
    }
    .lp-hire-btn--disabled, .lp-hire-btn:disabled {
      opacity: 0.4; cursor: not-allowed;
    }
    .lp-warn-text {
      text-align: center; font-size: 11px; color: #fb923c;
      margin-bottom: 8px; flex-shrink: 0;
    }

    /* ── İşe Alma Modal ── */
    .lp-modal-overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.75);
      display: flex; align-items: center; justify-content: center;
      z-index: 200;
      padding: 16px;
    }
    .lp-modal {
      background: #0d0d1c;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 14px;
      width: 100%; max-width: 780px;
      max-height: 90vh;
      overflow-y: auto;
      padding: 20px;
      scrollbar-width: thin;
      scrollbar-color: rgba(255,255,255,0.1) transparent;
    }
    .lp-modal__header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 8px;
    }
    .lp-modal__title { font-size: 16px; font-weight: 700; }
    .lp-modal__close {
      background: none; border: none; color: #8888aa;
      font-size: 18px; cursor: pointer; padding: 4px 8px;
      border-radius: 6px; min-width: 44px; min-height: 44px;
      display: flex; align-items: center; justify-content: center;
    }
    .lp-modal__close:hover { color: #f87171; background: rgba(248,113,113,0.1); }
    .lp-modal__sub { font-size: 12px; color: #8888aa; margin-bottom: 12px; }
    .lp-modal__refresh {
      background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
      color: #8888aa; font-size: 12px; padding: 6px 14px;
      border-radius: 8px; cursor: pointer; margin-bottom: 14px;
      min-height: 44px;
    }
    .lp-modal__refresh:hover { background: rgba(255,255,255,0.1); color: #f0f0ff; }
    .lp-modal__candidates {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 12px;
    }

    /* Aday kartı */
    .lp-candidate {
      background: #12122a; border: 1px solid rgba(255,255,255,0.08);
      border-radius: 10px; padding: 12px;
      display: flex; flex-direction: column; gap: 10px;
    }
    .lp-candidate--unaffordable { opacity: 0.5; }
    .lp-candidate__top { display: flex; gap: 10px; align-items: flex-start; }
    .lp-candidate__name { font-size: 13px; font-weight: 600; }
    .lp-candidate__title { font-size: 11px; color: #8888aa; }
    .lp-candidate__badges { display: flex; flex-wrap: wrap; gap: 3px; margin-top: 4px; }

    /* Tüm stat barları */
    .lp-all-stats { display: flex; flex-direction: column; gap: 4px; }
    .lp-full-stat {
      display: grid; grid-template-columns: 80px 1fr 24px;
      align-items: center; gap: 6px;
    }
    .lp-full-stat__label { font-size: 10px; color: #8888aa; }
    .lp-full-stat__bar {
      height: 5px; background: rgba(255,255,255,0.08);
      border-radius: 3px; overflow: hidden;
    }
    .lp-full-stat__fill { height: 100%; border-radius: 3px; }
    .lp-full-stat__val { font-size: 10px; color: #8888aa; text-align: right; }

    /* Uyum skorları */
    .lp-candidate__compat { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
    .lp-compat__label { font-size: 10px; color: #8888aa; }
    .lp-compat__score {
      font-size: 10px; padding: 1px 6px; border-radius: 6px; font-weight: 600;
    }
    .lp-compat__score--good    { background: rgba(74,222,128,0.15); color: #4ade80; }
    .lp-compat__score--neutral { background: rgba(136,136,170,0.15); color: #8888aa; }
    .lp-compat__score--bad     { background: rgba(248,113,113,0.15); color: #f87171; }

    /* Aday footer */
    .lp-candidate__footer {
      display: flex; align-items: center; justify-content: space-between; gap: 8px;
      border-top: 1px solid rgba(255,255,255,0.07); padding-top: 8px;
    }
    .lp-candidate__salary { font-size: 12px; color: #f0c060; font-weight: 600; }
    .lp-warn { font-size: 10px; color: #f87171; margin-left: 4px; }
    .lp-hire-confirm-btn {
      background: rgba(124,58,237,0.25); border: 1px solid rgba(124,58,237,0.5);
      color: #a78bfa; font-size: 12px; font-weight: 600;
      padding: 6px 14px; border-radius: 8px; cursor: pointer;
      min-height: 44px; transition: background 0.15s;
    }
    .lp-hire-confirm-btn:hover:not(:disabled) { background: rgba(124,58,237,0.45); }
    .lp-hire-confirm-btn--disabled,
    .lp-hire-confirm-btn:disabled { opacity: 0.35; cursor: not-allowed; }
  `;

  document.head.appendChild(style);
}

// ─── YARDIMCILAR ─────────────────────────────────────────────────────────────

function getAvatarInitials(name) {
  const parts = name.replace('Dr. ', '').split(' ');
  return parts.length >= 2
    ? parts[0][0] + parts[parts.length - 1][0]
    : name.slice(0, 2).toUpperCase();
}

function getMoraleColor(morale) {
  if (morale >= 80) return '#4ade80';
  if (morale >= 60) return '#f0c060';
  if (morale >= 40) return '#fb923c';
  return '#f87171';
}

function getStatColor(value) {
  if (value >= 80) return '#4ade80';
  if (value >= 60) return '#a78bfa';
  if (value >= 40) return '#3b82f6';
  return '#f87171';
}

function getStatusLabel(status, researcher) {
  switch (status) {
    case 'active':  return '● Aktif';
    case 'burnout': return '🔥 Tükenmişlik';
    case 'leave':   return `✈ İzin (${researcher.leaveWeeksLeft}h)`;
    default:        return '○ Boşta';
  }
}

function getCompatClass(score) {
  if (score >= 65) return 'good';
  if (score >= 40) return 'neutral';
  return 'bad';
}
