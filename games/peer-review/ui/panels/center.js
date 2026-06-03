/**
 * PEER REVIEW — center.js
 * Merkez panel: aktif proje kartları, yeni proje modal,
 * araştırmacı atama, faz ilerleme göstergeleri.
 * GDD v3.0 §9.1 Merkez Panel layout referansı.
 * Tam çalışan HTML/CSS/JS — #panel-center div'ine mount edilir.
 */

'use strict';

import {
  PROJECT_TYPES,
  FIELDS,
  PHASE_LABELS,
  LAB_LEVELS,
} from '../../utils/constants.js';
import {
  getProjectTypeLabel,
  getPhaseInfo,
  getProjectProgress,
} from '../../data/project_defs.js';
import {
  startNewProject,
  assignResearcher,
  unassignResearcher,
} from '../../systems/projects.js';
import {
  getState,
  updateState,
  addNotification,
} from '../../core/state.js';
import { EventBus } from '../../core/game.js';

// ─── PANEL KURULUM ────────────────────────────────────────────────────────────

let _container = null;

/**
 * Merkez paneli başlatır. index.html'de bir kez çağrılır.
 * @param {HTMLElement} container  — #panel-center
 */
export function initCenterPanel(container) {
  _container = container;
  injectStyles();
  render();
  registerEvents();
}

function registerEvents() {
  EventBus.on('game:week_end',                () => render());
  EventBus.on('project:started',             () => render());
  EventBus.on('project:published',           () => render());
  EventBus.on('project:failed',              () => render());
  EventBus.on('project:phase_complete',      () => render());
  EventBus.on('project:researcher_assigned', () => render());
  EventBus.on('project:researcher_unassigned',() => render());
  EventBus.on('project:rejected',            () => render());
}

// ─── ANA RENDER ───────────────────────────────────────────────────────────────

function render() {
  if (!_container) return;
  const state   = getState();
  const maxProj = LAB_LEVELS[state.lab.level]?.maxProjects ?? 2;
  const active  = state.projects.active;

  _container.innerHTML = `
    <div class="cp-root">
      ${renderHeader(state, active, maxProj)}
      <div class="cp-list" id="cp-list">
        ${active.length === 0
          ? renderEmptyState()
          : active.map(p => renderProjectCard(p, state)).join('')
        }
      </div>
      ${renderNewProjectBtn(active, maxProj)}
    </div>
  `;

  bindEvents();
}

// ─── PANEL HEADER ─────────────────────────────────────────────────────────────

function renderHeader(state, active, maxProj) {
  const racing  = active.filter(p => p.isRacing).length;
  const noTeam  = active.filter(p => p.riskFlags.includes('no_team')).length;

  return `
    <div class="cp-header">
      <span class="cp-title">Aktif Projeler</span>
      <span class="cp-cap ${active.length >= maxProj ? 'cp-cap--full' : ''}">
        ${active.length}/${maxProj}
      </span>
    </div>
    ${racing > 0 || noTeam > 0 ? `
    <div class="cp-alerts">
      ${racing > 0 ? `<span class="cp-alert cp-alert--race">⚡ ${racing} yarış</span>` : ''}
      ${noTeam > 0 ? `<span class="cp-alert cp-alert--warn">⚠ ${noTeam} ekipsiz</span>` : ''}
    </div>` : ''}
  `;
}

// ─── PROJE KARTI ─────────────────────────────────────────────────────────────

function renderProjectCard(project, state) {
  const phaseInfo    = getPhaseInfo(project);
  const progress     = getProjectProgress(project);
  const typeDef      = PROJECT_TYPES[project.type] ?? {};
  const fieldDef     = FIELDS[project.field] ?? {};
  const team         = state.researchers.filter(r => project.teamIds.includes(r.id));
  const phaseLabel   = PHASE_LABELS[project.phase] ?? project.phase;
  const phaseDur     = project.phaseDurations[project.phase] ?? 1;
  const phaseFrac    = Math.min(1, project.phaseWeek / phaseDur);
  const weeksLeft    = project.estimatedEndWeek - state.time.totalWeeks;
  const isRacing     = project.isRacing;
  const hasNoTeam    = project.riskFlags.includes('no_team');
  const hasEthicRisk = project._manipulatedPhases?.length > 0;

  return `
    <div class="cp-card
         ${isRacing    ? 'cp-card--racing'  : ''}
         ${hasNoTeam   ? 'cp-card--warn'    : ''}
         ${hasEthicRisk? 'cp-card--danger'  : ''}"
         data-id="${project.id}">

      <!-- Başlık satırı -->
      <div class="cp-card__head">
        <div class="cp-card__title">${project.label}</div>
        <div class="cp-card__cost">💰 ${project.costPerWeek}/h</div>
      </div>

      <!-- Badge'ler -->
      <div class="cp-card__badges">
        <span class="cp-badge cp-badge--type">${getProjectTypeLabel(project.type)}</span>
        <span class="cp-badge cp-badge--field"
              style="color:${fieldDef.color ?? '#8888aa'};border-color:${fieldDef.color ?? '#8888aa'}">
          ${fieldDef.label ?? project.field}
        </span>
        ${isRacing     ? `<span class="cp-badge cp-badge--race">⚡ Yarış</span>` : ''}
        ${hasNoTeam    ? `<span class="cp-badge cp-badge--warn">⚠ Ekipsiz</span>` : ''}
        ${hasEthicRisk ? `<span class="cp-badge cp-badge--danger">🔴 Etik Risk</span>` : ''}
      </div>

      <!-- Faz zaman çizelgesi -->
      ${renderPhaseTimeline(project, phaseInfo)}

      <!-- Mevcut faz ilerleme çubuğu -->
      <div class="cp-phase-bar">
        <div class="cp-phase-bar__labels">
          <span>${phaseLabel}</span>
          <span>${project.phaseWeek}/${phaseDur} hafta</span>
        </div>
        <div class="cp-phase-bar__track">
          <div class="cp-phase-bar__fill"
               style="width:${Math.round(phaseFrac * 100)}%">
          </div>
        </div>
      </div>

      <!-- Genel ilerleme çubuğu -->
      <div class="cp-total-bar">
        <div class="cp-total-bar__fill" style="width:${progress}%">
          <span class="cp-total-bar__label">${progress}%</span>
        </div>
      </div>

      <!-- Ekip avatarları -->
      <div class="cp-team">
        <div class="cp-team__avatars">
          ${team.length === 0
            ? `<span class="cp-team__empty">Araştırmacı atanmadı</span>`
            : team.map(r => renderMiniAvatar(r)).join('')
          }
        </div>
        <button class="cp-team__btn" data-project-id="${project.id}">
          👥 Ekip Düzenle
        </button>
      </div>

      <!-- Alt bilgi satırı -->
      <div class="cp-card__foot">
        <span class="cp-weeks ${weeksLeft <= 4 ? 'cp-weeks--urgent' : ''}">
          ${weeksLeft > 0 ? `~${weeksLeft} hafta kaldı` : 'Bu hafta bitiyor'}
        </span>
        ${renderRiskBadge(project)}
      </div>

      <!-- Tamamlanan faz kaliteleri (mini bar chart) -->
      ${Object.keys(project.phaseQualities).length > 0
        ? renderQualityBars(project)
        : ''}
    </div>
  `;
}

// ─── FAZ ZAMANÇİZELGESİ ──────────────────────────────────────────────────────

function renderPhaseTimeline(project, phaseInfo) {
  const phases     = project.phaseOrder;
  const currentIdx = phaseInfo.index;

  const dots = phases.map((phase, idx) => {
    const done    = idx < currentIdx;
    const active  = idx === currentIdx;
    const qual    = project.phaseQualities[phase];
    const bg      = qual != null
      ? getQualityColor(qual)
      : done ? '#4ade80' : '';
    const cls     = done ? 'done' : active ? 'active' : '';
    const tip     = `${PHASE_LABELS[phase] ?? phase}${qual != null ? ` (${Math.round(qual)})` : ''}`;

    return `<div class="cp-dot cp-dot--${cls}"
                 title="${tip}"
                 ${bg ? `style="background:${bg}"` : ''}>
            </div>`;
  });

  // Noktaları çizgilerle birleştir
  const timeline = dots.join('<div class="cp-dot-line"></div>');

  return `<div class="cp-timeline">${timeline}</div>`;
}

function renderMiniAvatar(r) {
  const initials = r.name.replace('Dr. ', '').split(' ')
    .map(p => p[0]).slice(0, 2).join('');
  return `
    <div class="cp-avatar" style="background:${getPersonalityColor(r.personality)}"
         title="${r.name} — Moral: ${r.morale}">
      ${initials}
    </div>
  `;
}

function renderRiskBadge(project) {
  if (project.isRacing)
    return `<span class="cp-risk cp-risk--race">⚡ Yarış</span>`;
  if (project.riskFlags.includes('no_team'))
    return `<span class="cp-risk cp-risk--warn">⚠ Ekipsiz</span>`;
  if (project._manipulatedPhases?.length > 0)
    return `<span class="cp-risk cp-risk--danger">🔴 Etik</span>`;
  return `<span class="cp-risk cp-risk--ok">✓ Risksiz</span>`;
}

function renderQualityBars(project) {
  const entries = Object.entries(project.phaseQualities);
  return `
    <div class="cp-qual-chart">
      ${entries.map(([phase, q]) => `
        <div class="cp-qual-bar" title="${PHASE_LABELS[phase] ?? phase}: ${Math.round(q)}">
          <div class="cp-qual-bar__fill"
               style="height:${Math.round(q * 0.28)}px;background:${getQualityColor(q)}">
          </div>
          <span class="cp-qual-bar__label">${phase.slice(0, 3).toUpperCase()}</span>
        </div>
      `).join('')}
    </div>
  `;
}

function renderEmptyState() {
  return `
    <div class="cp-empty">
      <div class="cp-empty__icon">🔬</div>
      <div class="cp-empty__text">Henüz aktif proje yok</div>
      <div class="cp-empty__sub">Yeni proje başlat ve araştırmacı ata</div>
    </div>
  `;
}

function renderNewProjectBtn(active, maxProj) {
  const full = active.length >= maxProj;
  return `
    <button class="cp-new-btn ${full ? 'cp-new-btn--full' : ''}"
            id="cp-new-btn" ${full ? 'disabled' : ''}>
      ${full ? '🔒 Kapasite Dolu' : '+ Yeni Proje Başlat'}
    </button>
  `;
}

// ─── EVENT BAĞLAMA ────────────────────────────────────────────────────────────

function bindEvents() {
  if (!_container) return;

  // Yeni proje butonu
  document.getElementById('cp-new-btn')
    ?.addEventListener('click', openNewProjectModal);

  // Ekip düzenle butonları
  _container.querySelectorAll('.cp-team__btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      openAssignModal(btn.dataset.projectId);
    });
  });

  // Kart tıklama → seçili proje güncelle
  _container.querySelectorAll('.cp-card').forEach(card => {
    card.addEventListener('click', () => {
      updateState('ui.selectedProjectId', card.dataset.id);
    });
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        updateState('ui.selectedProjectId', card.dataset.id);
      }
    });
  });
}

// ─── YENİ PROJE MODAL ────────────────────────────────────────────────────────

function openNewProjectModal() {
  closeModal('cp-new-modal');

  const modal = createModal('cp-new-modal');
  modal.innerHTML = renderNewProjectModalContent();
  document.body.appendChild(modal);
  bindNewProjectModal(modal);
}

function renderNewProjectModalContent() {
  // Proje tipi seçenekleri
  const typeCards = Object.entries(PROJECT_TYPES).map(([id, def]) => `
    <label class="cp-opt" data-value="${id}">
      <input type="radio" name="proj-type" value="${id}">
      <div class="cp-opt__body">
        <div class="cp-opt__title">${def.label}</div>
        <div class="cp-opt__meta">Nobel ×${def.nobelCoeff} · Prestij ×${def.prestigeMult}</div>
      </div>
    </label>
  `).join('');

  // Alan seçenekleri
  const fieldCards = Object.entries(FIELDS).map(([id, def]) => `
    <label class="cp-opt cp-opt--field" data-value="${id}">
      <input type="radio" name="proj-field" value="${id}">
      <div class="cp-opt__body">
        <span class="cp-dot-sm" style="background:${def.color}"></span>
        ${def.label}
      </div>
    </label>
  `).join('');

  return `
    <div class="cp-modal" role="dialog" aria-modal="true">
      <div class="cp-modal__head">
        <span class="cp-modal__title">Yeni Proje Başlat</span>
        <button class="cp-modal__close" data-close>✕</button>
      </div>

      <div class="cp-modal__section">
        <div class="cp-modal__label">Proje Tipi</div>
        <div class="cp-opt-grid">${typeCards}</div>
      </div>

      <div class="cp-modal__section">
        <div class="cp-modal__label">Araştırma Alanı</div>
        <div class="cp-opt-grid cp-opt-grid--fields">${fieldCards}</div>
      </div>

      <div class="cp-modal__section">
        <div class="cp-modal__label">Proje Adı <span style="color:#555577">(isteğe bağlı)</span></div>
        <input id="cp-proj-name" class="cp-modal__input"
               placeholder="Boş bırakılırsa otomatik atanır" maxlength="60">
      </div>

      <div class="cp-modal__preview" id="cp-preview">
        Proje tipi ve alanı seçin.
      </div>

      <div class="cp-modal__foot">
        <button class="cp-modal__cancel" data-close>İptal</button>
        <button class="cp-modal__confirm" id="cp-confirm" disabled>
          Projeyi Başlat
        </button>
      </div>
    </div>
  `;
}

function bindNewProjectModal(modal) {
  let selType  = null;
  let selField = null;

  // Kapat
  modal.querySelectorAll('[data-close]')
    .forEach(el => el.addEventListener('click', () => modal.remove()));
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  // Tip seçimi
  modal.querySelectorAll('[name="proj-type"]').forEach(radio => {
    radio.addEventListener('change', () => {
      selType = radio.value;
      modal.querySelectorAll('[data-value]').forEach(c => {
        if (c.querySelector('[name="proj-type"]')) c.classList.remove('cp-opt--sel');
      });
      radio.closest('[data-value]').classList.add('cp-opt--sel');
      updatePreview(modal, selType, selField);
      toggleConfirm(modal, selType, selField);
    });
  });

  // Alan seçimi
  modal.querySelectorAll('[name="proj-field"]').forEach(radio => {
    radio.addEventListener('change', () => {
      selField = radio.value;
      modal.querySelectorAll('[data-value]').forEach(c => {
        if (c.querySelector('[name="proj-field"]')) c.classList.remove('cp-opt--sel');
      });
      radio.closest('[data-value]').classList.add('cp-opt--sel');
      updatePreview(modal, selType, selField);
      toggleConfirm(modal, selType, selField);
    });
  });

  // Başlat
  modal.querySelector('#cp-confirm').addEventListener('click', () => {
    if (!selType || !selField) return;
    const label = modal.querySelector('#cp-proj-name').value.trim() || null;
    startNewProject({ type: selType, field: selField, label });
    modal.remove();
  });
}

function updatePreview(modal, type, field) {
  const el = modal.querySelector('#cp-preview');
  if (!el || !type || !field) return;

  const typeDef  = PROJECT_TYPES[type];
  const fieldDef = FIELDS[field];
  const state    = getState();
  const [cMin, cMax] = typeDef.costPerWeek;

  el.innerHTML = `
    <div class="cp-preview">
      <div class="cp-preview__item">
        <span class="cp-preview__k">Alan</span>
        <span class="cp-preview__v" style="color:${fieldDef.color}">${fieldDef.label}</span>
      </div>
      <div class="cp-preview__item">
        <span class="cp-preview__k">Haftalık Maliyet</span>
        <span class="cp-preview__v">${type === 'collab' ? 'Paylaşımlı' : `${cMin}–${cMax}`}</span>
      </div>
      <div class="cp-preview__item">
        <span class="cp-preview__k">Nobel Katsayısı</span>
        <span class="cp-preview__v" style="color:#f0c060">×${typeDef.nobelCoeff}</span>
      </div>
      <div class="cp-preview__item">
        <span class="cp-preview__k">Prestij Çarpanı</span>
        <span class="cp-preview__v" style="color:#a78bfa">×${typeDef.prestigeMult}</span>
      </div>
      <div class="cp-preview__item">
        <span class="cp-preview__k">Mevcut Bütçe</span>
        <span class="cp-preview__v">${state.lab.budget.toLocaleString()}</span>
      </div>
    </div>
  `;
}

function toggleConfirm(modal, type, field) {
  const btn = modal.querySelector('#cp-confirm');
  if (btn) btn.disabled = !type || !field;
}

// ─── ARAŞTIRMACI ATAMA MODAL ─────────────────────────────────────────────────

function openAssignModal(projectId) {
  closeModal('cp-assign-modal');

  const state   = getState();
  const project = state.projects.active.find(p => p.id === projectId);
  if (!project) return;

  const modal = createModal('cp-assign-modal');
  modal.innerHTML = renderAssignModalContent(project, state);
  document.body.appendChild(modal);
  bindAssignModal(modal, projectId);
}

function renderAssignModalContent(project, state) {
  const assigned   = state.researchers.filter(r => project.teamIds.includes(r.id));
  const available  = state.researchers.filter(r =>
    !project.teamIds.includes(r.id) && !r.isBurnout && !r.isOnLeave
  );

  return `
    <div class="cp-modal" role="dialog" aria-modal="true">
      <div class="cp-modal__head">
        <span class="cp-modal__title">Ekip — ${project.label}</span>
        <button class="cp-modal__close" data-close>✕</button>
      </div>

      <div class="cp-modal__section">
        <div class="cp-modal__label">Atanmış (${assigned.length})</div>
        ${assigned.length === 0
          ? '<p class="cp-assign__empty">Henüz kimse atanmadı.</p>'
          : assigned.map(r => renderAssignRow(r, true, project.phase)).join('')
        }
      </div>

      <div class="cp-modal__section">
        <div class="cp-modal__label">Müsait (${available.length})</div>
        ${available.length === 0
          ? '<p class="cp-assign__empty">Müsait araştırmacı yok.</p>'
          : available.map(r => renderAssignRow(r, false, project.phase)).join('')
        }
      </div>
    </div>
  `;
}

function renderAssignRow(r, isAssigned, phase) {
  // Mevcut faz için en önemli stat
  const relevantStat = getRelevantStat(r, phase);
  const initials = r.name.replace('Dr. ', '').split(' ')
    .map(p => p[0]).slice(0, 2).join('');

  return `
    <div class="cp-assign-row">
      <div class="cp-assign-row__av"
           style="background:${getPersonalityColor(r.personality)}">
        ${initials}
      </div>
      <div class="cp-assign-row__info">
        <div class="cp-assign-row__name">${r.name}</div>
        <div class="cp-assign-row__meta">
          ${FIELDS[r.field]?.label ?? r.field} ·
          <span style="color:${getMoraleColor(r.morale)}">Moral ${r.morale}</span> ·
          <span style="color:#f0c060">${relevantStat.label}: ${relevantStat.value}</span>
        </div>
      </div>
      <button class="cp-assign-btn ${isAssigned ? 'cp-assign-btn--remove' : ''}"
              data-action="${isAssigned ? 'remove' : 'add'}"
              data-rid="${r.id}">
        ${isAssigned ? '− Çıkar' : '+ Ata'}
      </button>
    </div>
  `;
}

function bindAssignModal(modal, projectId) {
  // Kapat
  modal.querySelectorAll('[data-close]')
    .forEach(el => el.addEventListener('click', () => modal.remove()));
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  // Ata / Çıkar butonları — event delegation
  modal.addEventListener('click', e => {
    const btn = e.target.closest('.cp-assign-btn');
    if (!btn) return;
    e.stopPropagation();

    const rid    = btn.dataset.rid;
    const action = btn.dataset.action;

    if (action === 'add') {
      assignResearcher(projectId, rid);
    } else {
      unassignResearcher(projectId, rid);
    }

    // Modal içeriğini yenile
    const state   = getState();
    const project = state.projects.active.find(p => p.id === projectId);
    if (project) {
      // innerHTML ile güncelle, ardından event'leri yeniden bağla
      modal.innerHTML = renderAssignModalContent(project, state);
      bindAssignModal(modal, projectId);
    }
  });
}

// ─── CSS ─────────────────────────────────────────────────────────────────────

function injectStyles() {
  if (document.getElementById('cp-styles')) return;
  const s = document.createElement('style');
  s.id = 'cp-styles';
  s.textContent = `
  /* ── Kök ── */
  .cp-root {
    display:flex; flex-direction:column; height:100%; overflow:hidden;
    font-family:'DM Sans',sans-serif; color:#f0f0ff;
  }

  /* ── Header ── */
  .cp-header {
    display:flex; align-items:center; justify-content:space-between;
    padding:12px 14px 6px; border-bottom:1px solid rgba(255,255,255,.07); flex-shrink:0;
  }
  .cp-title { font-size:13px; font-weight:600; text-transform:uppercase; letter-spacing:.06em; color:#8888aa; }
  .cp-cap   { font-size:12px; font-weight:700; color:#4ade80; background:rgba(74,222,128,.12); padding:2px 8px; border-radius:10px; }
  .cp-cap--full { color:#fb923c; background:rgba(251,146,60,.12); }
  .cp-alerts { display:flex; gap:6px; padding:4px 14px 6px; flex-shrink:0; }
  .cp-alert  { font-size:11px; padding:2px 8px; border-radius:8px; }
  .cp-alert--race { background:rgba(251,191,36,.18); color:#fbbf24; }
  .cp-alert--warn { background:rgba(251,146,60,.18); color:#fb923c; }

  /* ── Liste ── */
  .cp-list {
    flex:1; overflow-y:auto; padding:8px;
    display:flex; flex-direction:column; gap:10px;
    scrollbar-width:thin; scrollbar-color:rgba(255,255,255,.1) transparent;
  }
  .cp-list::-webkit-scrollbar { width:4px; }
  .cp-list::-webkit-scrollbar-thumb { background:rgba(255,255,255,.1); border-radius:2px; }

  /* ── Proje Kartı ── */
  .cp-card {
    background:#12122a; border:1px solid rgba(255,255,255,.07);
    border-radius:12px; padding:12px;
    cursor:pointer; transition:border-color .15s;
    display:flex; flex-direction:column; gap:8px;
  }
  .cp-card:hover { border-color:rgba(124,58,237,.4); }
  .cp-card:focus { outline:2px solid #7c3aed; outline-offset:2px; }
  .cp-card--racing { border-color:rgba(251,191,36,.35); background:rgba(251,191,36,.03); }
  .cp-card--warn   { border-color:rgba(251,146,60,.35); }
  .cp-card--danger { border-color:rgba(248,113,113,.35); }

  .cp-card__head { display:flex; justify-content:space-between; align-items:flex-start; }
  .cp-card__title { font-size:14px; font-weight:600; flex:1; margin-right:8px; }
  .cp-card__cost  { font-size:11px; color:#8888aa; white-space:nowrap; }

  /* Badges */
  .cp-card__badges { display:flex; flex-wrap:wrap; gap:4px; }
  .cp-badge { font-size:10px; padding:1px 7px; border-radius:6px; font-weight:600; white-space:nowrap; }
  .cp-badge--type   { background:rgba(124,58,237,.18); color:#a78bfa; }
  .cp-badge--field  { border:1px solid; background:transparent; }
  .cp-badge--race   { background:rgba(251,191,36,.2); color:#fbbf24; }
  .cp-badge--warn   { background:rgba(251,146,60,.2); color:#fb923c; }
  .cp-badge--danger { background:rgba(248,113,113,.2); color:#f87171; }

  /* ── Faz Zaman Çizelgesi ── */
  .cp-timeline { display:flex; align-items:center; padding:4px 0; }
  .cp-dot {
    width:10px; height:10px; border-radius:50%; flex-shrink:0;
    background:rgba(255,255,255,.12); cursor:help; transition:background .2s;
  }
  .cp-dot--done   { background:#4ade80; }
  .cp-dot--active { width:13px; height:13px; background:#7c3aed; box-shadow:0 0 6px #7c3aed; }
  .cp-dot-line    { flex:1; height:2px; background:rgba(255,255,255,.08); min-width:4px; }

  /* ── Faz Çubuğu ── */
  .cp-phase-bar__labels {
    display:flex; justify-content:space-between;
    font-size:11px; color:#8888aa; margin-bottom:3px;
  }
  .cp-phase-bar__track {
    height:4px; background:rgba(255,255,255,.08); border-radius:2px; overflow:hidden;
  }
  .cp-phase-bar__fill { height:100%; background:#7c3aed; border-radius:2px; transition:width .3s; }

  /* ── Toplam İlerleme ── */
  .cp-total-bar {
    height:18px; background:rgba(255,255,255,.06);
    border-radius:9px; overflow:hidden;
  }
  .cp-total-bar__fill {
    height:100%; min-width:28px;
    background:linear-gradient(90deg,#7c3aed,#06b6d4);
    border-radius:9px; transition:width .3s;
    display:flex; align-items:center; justify-content:flex-end; padding-right:6px;
  }
  .cp-total-bar__label { font-size:10px; font-weight:700; color:#fff; }

  /* ── Ekip ── */
  .cp-team { display:flex; align-items:center; justify-content:space-between; }
  .cp-team__avatars { display:flex; gap:4px; flex-wrap:wrap; align-items:center; }
  .cp-team__empty   { font-size:11px; color:#fb923c; }
  .cp-avatar {
    width:28px; height:28px; border-radius:50%; flex-shrink:0;
    display:flex; align-items:center; justify-content:center;
    font-size:10px; font-weight:700; color:#fff; cursor:default;
    min-width:28px;
  }
  .cp-team__btn {
    font-size:11px; padding:5px 10px; border-radius:7px; cursor:pointer;
    background:rgba(124,58,237,.15); border:1px solid rgba(124,58,237,.35); color:#a78bfa;
    min-height:44px; font-weight:600; transition:background .15s; white-space:nowrap;
  }
  .cp-team__btn:hover { background:rgba(124,58,237,.3); }

  /* ── Alt Bilgi ── */
  .cp-card__foot { display:flex; justify-content:space-between; align-items:center; }
  .cp-weeks        { font-size:11px; color:#8888aa; }
  .cp-weeks--urgent{ color:#fb923c; font-weight:600; }
  .cp-risk { font-size:10px; padding:2px 7px; border-radius:6px; }
  .cp-risk--ok     { background:rgba(74,222,128,.1);  color:#4ade80; }
  .cp-risk--race   { background:rgba(251,191,36,.15); color:#fbbf24; }
  .cp-risk--warn   { background:rgba(251,146,60,.15); color:#fb923c; }
  .cp-risk--danger { background:rgba(248,113,113,.15);color:#f87171; }

  /* ── Kalite Mini Bar Chart ── */
  .cp-qual-chart { display:flex; align-items:flex-end; gap:4px; height:36px; border-top:1px solid rgba(255,255,255,.05); padding-top:6px; }
  .cp-qual-bar   { display:flex; flex-direction:column; align-items:center; gap:2px; }
  .cp-qual-bar__fill  { width:14px; border-radius:2px 2px 0 0; min-height:3px; }
  .cp-qual-bar__label { font-size:9px; color:#8888aa; }

  /* ── Boş Durum ── */
  .cp-empty { text-align:center; padding:50px 20px; display:flex; flex-direction:column; align-items:center; gap:8px; }
  .cp-empty__icon { font-size:36px; opacity:.35; }
  .cp-empty__text { font-size:14px; color:#8888aa; font-weight:600; }
  .cp-empty__sub  { font-size:12px; color:#555577; }

  /* ── Yeni Proje Butonu ── */
  .cp-new-btn {
    margin:8px; padding:10px; width:calc(100% - 16px); flex-shrink:0;
    background:rgba(6,182,212,.15); border:1px solid rgba(6,182,212,.35); color:#06b6d4;
    font-size:13px; font-weight:600; border-radius:8px; cursor:pointer; min-height:44px;
    transition:background .15s;
  }
  .cp-new-btn:hover:not(:disabled) { background:rgba(6,182,212,.3); }
  .cp-new-btn--full,.cp-new-btn:disabled { opacity:.4; cursor:not-allowed; }

  /* ── Modal Overlay ── */
  .cp-overlay {
    position:fixed; inset:0; background:rgba(0,0,0,.75);
    display:flex; align-items:center; justify-content:center;
    z-index:200; padding:16px;
  }
  .cp-modal {
    background:#0d0d1c; border:1px solid rgba(255,255,255,.1);
    border-radius:14px; width:100%; max-width:660px;
    max-height:90vh; overflow-y:auto; padding:20px;
    scrollbar-width:thin; scrollbar-color:rgba(255,255,255,.1) transparent;
  }
  .cp-modal__head { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }
  .cp-modal__title{ font-size:16px; font-weight:700; }
  .cp-modal__close{
    background:none; border:none; color:#8888aa; font-size:18px; cursor:pointer;
    min-width:44px; min-height:44px; border-radius:6px;
    display:flex; align-items:center; justify-content:center;
  }
  .cp-modal__close:hover { color:#f87171; background:rgba(248,113,113,.1); }
  .cp-modal__section { margin-bottom:16px; }
  .cp-modal__label  { font-size:11px; font-weight:600; color:#8888aa; text-transform:uppercase; letter-spacing:.05em; margin-bottom:8px; }
  .cp-modal__input  {
    width:100%; background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.1);
    color:#f0f0ff; font-size:13px; padding:8px 12px; border-radius:8px; outline:none;
    box-sizing:border-box;
  }
  .cp-modal__input:focus { border-color:rgba(124,58,237,.5); }
  .cp-modal__preview {
    background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.07);
    border-radius:8px; padding:12px; font-size:12px; color:#8888aa;
    margin-bottom:16px; min-height:56px;
  }
  .cp-modal__foot { display:flex; justify-content:flex-end; gap:8px; border-top:1px solid rgba(255,255,255,.07); padding-top:14px; }
  .cp-modal__cancel  { background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.12); color:#8888aa; padding:8px 20px; border-radius:8px; cursor:pointer; min-height:44px; font-size:13px; }
  .cp-modal__confirm { background:rgba(124,58,237,.25); border:1px solid rgba(124,58,237,.5); color:#a78bfa; padding:8px 20px; border-radius:8px; cursor:pointer; font-weight:600; min-height:44px; font-size:13px; }
  .cp-modal__confirm:not(:disabled):hover { background:rgba(124,58,237,.45); }
  .cp-modal__confirm:disabled { opacity:.4; cursor:not-allowed; }

  /* ── Seçenek Kartları ── */
  .cp-opt-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:8px; }
  .cp-opt-grid--fields { grid-template-columns:repeat(auto-fill,minmax(110px,1fr)); }
  .cp-opt {
    background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08);
    border-radius:8px; padding:10px; cursor:pointer; transition:border-color .15s,background .15s;
    display:flex; align-items:flex-start; gap:8px;
  }
  .cp-opt input[type="radio"] { display:none; }
  .cp-opt:hover  { border-color:rgba(124,58,237,.4); background:rgba(124,58,237,.08); }
  .cp-opt--sel   { border-color:#7c3aed !important; background:rgba(124,58,237,.15) !important; }
  .cp-opt__body  { flex:1; }
  .cp-opt__title { font-size:12px; font-weight:600; }
  .cp-opt__meta  { font-size:10px; color:#8888aa; margin-top:2px; }
  .cp-dot-sm     { display:inline-block; width:8px; height:8px; border-radius:50%; margin-right:4px; vertical-align:middle; }

  /* ── Preview ── */
  .cp-preview { display:grid; grid-template-columns:repeat(auto-fill,minmax(110px,1fr)); gap:8px; }
  .cp-preview__item { display:flex; flex-direction:column; gap:2px; }
  .cp-preview__k { font-size:10px; color:#8888aa; }
  .cp-preview__v { font-size:13px; font-weight:600; color:#f0f0ff; }

  /* ── Atama Satırı ── */
  .cp-assign__empty { font-size:12px; color:#8888aa; padding:4px 0; }
  .cp-assign-row {
    display:flex; align-items:center; gap:10px;
    background:rgba(255,255,255,.03); border-radius:8px; padding:8px 10px;
    margin-bottom:6px;
  }
  .cp-assign-row__av {
    width:36px; height:36px; border-radius:50%; flex-shrink:0;
    display:flex; align-items:center; justify-content:center;
    font-size:11px; font-weight:700; color:#fff; min-width:36px;
  }
  .cp-assign-row__info { flex:1; min-width:0; }
  .cp-assign-row__name { font-size:12px; font-weight:600; }
  .cp-assign-row__meta { font-size:10px; color:#8888aa; }
  .cp-assign-btn {
    background:rgba(74,222,128,.15); border:1px solid rgba(74,222,128,.35); color:#4ade80;
    font-size:11px; padding:5px 12px; border-radius:7px; cursor:pointer;
    min-height:44px; font-weight:600; white-space:nowrap; transition:background .15s;
  }
  .cp-assign-btn--remove { background:rgba(248,113,113,.15); border-color:rgba(248,113,113,.35); color:#f87171; }
  .cp-assign-btn:hover { opacity:.85; }
  `;
  document.head.appendChild(s);
}

// ─── YARDIMCILAR ─────────────────────────────────────────────────────────────

/** Modal overlay oluşturur. */
function createModal(id) {
  const el = document.createElement('div');
  el.id        = id;
  el.className = 'cp-overlay';
  return el;
}

/** Varsa mevcut modal'ı kapat. */
function closeModal(id) {
  document.getElementById(id)?.remove();
}

function getQualityColor(q) {
  if (q >= 80) return '#4ade80';
  if (q >= 60) return '#a78bfa';
  if (q >= 40) return '#fb923c';
  return '#f87171';
}

function getMoraleColor(m) {
  if (m >= 80) return '#4ade80';
  if (m >= 60) return '#f0c060';
  if (m >= 40) return '#fb923c';
  return '#f87171';
}

function getPersonalityColor(p) {
  const c = {
    GEN:'#a78bfa', MET:'#3b82f6', LED:'#4ade80', AMB:'#fb923c',
    PER:'#f0c060', MNT:'#2dd4bf', PLY:'#8888aa', CAR:'#fb923c',
  };
  return c[p] ?? '#8888aa';
}

/** Mevcut faz için en önemli stat döner. */
function getRelevantStat(researcher, phase) {
  const map = {
    hypothesis:'CR', literature:'AN', design:'LB',
    datacollect:'LB', analysis:'AN', writing:'WR',
    peerreview:'WR', revision:'WR', publication:'RP',
  };
  const labels = { CR:'Yaratıcılık', AN:'Analitik', LB:'Lab', WR:'Yazarlık', RP:'İtibar' };
  const id     = map[phase] ?? 'AN';
  return { label: labels[id] ?? id, value: researcher[id] ?? 0 };
}
