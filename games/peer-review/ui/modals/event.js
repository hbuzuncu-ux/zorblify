/**
 * PEER REVIEW — event.js
 * Event karar modal'ı.
 * Oyuncuya gelen her event için karar ekranı sunar.
 * game.js 'event:pending' emit ettiğinde otomatik açılır.
 * GDD v3.0 §8 Random Event Sistemi UI implementasyonu.
 */

'use strict';

import { FIELDS } from '../../utils/constants.js';
import {
  getState,
} from '../../core/state.js';
import { EventBus, resolveEvent } from '../../core/game.js';

// ─── MODAL KURULUM ────────────────────────────────────────────────────────────

let _modalEl    = null;   // aktif modal DOM elementi
let _isOpen     = false;

/**
 * Event modal sistemini başlatır. index.html'de bir kez çağrılır.
 */
export function initEventModal() {
  injectStyles();
  registerEvents();
}

function registerEvents() {
  // Bekleyen event geldiğinde otomatik aç
  EventBus.on('event:pending', ({ event }) => {
    // Önceki modal açıksa kapatma — yeni event'i sıraya koy
    if (!_isOpen) openEventModal(event);
  });

  // Event çözüldüğünde — sonraki bekleyeni aç
  EventBus.on('event:resolved', () => {
    closeModal();
    // Kısa gecikme sonrası sıradaki event'i kontrol et
    setTimeout(() => {
      const state = getState();
      if (state.events.pending.length > 0) {
        openEventModal(state.events.pending[0]);
      }
    }, 300);
  });

  // ESC tuşu ile kapat (sadece tek seçenekli event'lerde)
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && _isOpen) {
      const state = getState();
      const event = state.events.pending[0];
      if (event?.choices?.length === 1) {
        handleChoice(event, event.choices[0].id);
      }
    }
  });
}

// ─── MODAL AÇ/KAPAT ──────────────────────────────────────────────────────────

function openEventModal(event) {
  if (!event) return;
  closeModal();

  _isOpen  = true;
  _modalEl = document.createElement('div');
  _modalEl.id        = 'ev-overlay';
  _modalEl.className = 'ev-overlay';
  _modalEl.innerHTML = renderEventModal(event);

  document.body.appendChild(_modalEl);
  bindModalEvents(_modalEl, event);

  // Açılış animasyonu
  requestAnimationFrame(() => {
    _modalEl.querySelector('.ev-modal')?.classList.add('ev-modal--visible');
  });
}

function closeModal() {
  if (_modalEl) {
    _modalEl.remove();
    _modalEl = null;
  }
  _isOpen = false;
}

// ─── MODAL RENDER ─────────────────────────────────────────────────────────────

function renderEventModal(event) {
  const meta     = getEventMeta(event);
  const state    = getState();

  return `
    <div class="ev-modal" role="dialog" aria-modal="true"
         aria-labelledby="ev-title">

      <!-- Başlık alanı -->
      <div class="ev-header" style="border-color:${meta.color}20">
        <div class="ev-header__icon">${meta.icon}</div>
        <div class="ev-header__body">
          <div class="ev-category" style="color:${meta.color}">
            ${meta.categoryLabel}
          </div>
          <div class="ev-title" id="ev-title">${event.label}</div>
        </div>
        <div class="ev-header__badge" style="background:${meta.color}20;color:${meta.color}">
          ${getTimeContext(state)}
        </div>
      </div>

      <!-- Açıklama -->
      <div class="ev-description">${event.description}</div>

      <!-- Araştırmacı bilgisi (kişisel event ise) -->
      ${event.researcherId ? renderResearcherCard(event.researcherId, state) : ''}

      <!-- Proje bilgisi (araştırma event ise) -->
      ${event.projectId ? renderProjectInfo(event.projectId, state) : ''}

      <!-- Seçenekler -->
      <div class="ev-choices">
        ${event.choices.map((c, i) => renderChoice(c, i, event)).join('')}
      </div>

      <!-- Kuyruk göstergesi -->
      ${renderQueueIndicator(state)}
    </div>
  `;
}

// ─── BILEŞEN RENDERLAR ────────────────────────────────────────────────────────

function renderResearcherCard(researcherId, state) {
  const r = state.researchers.find(res => res.id === researcherId);
  if (!r) return '';

  const moraleColor = r.morale >= 70 ? '#4ade80' : r.morale >= 40 ? '#f0c060' : '#f87171';

  return `
    <div class="ev-researcher">
      <div class="ev-researcher__av" style="background:${getPersonalityColor(r.personality)}">
        ${r.name.replace('Dr. ', '').split(' ').map(p => p[0]).slice(0, 2).join('')}
      </div>
      <div class="ev-researcher__info">
        <div class="ev-researcher__name">${r.name}</div>
        <div class="ev-researcher__meta">
          ${r.careerStage} ·
          ${FIELDS[r.field]?.label ?? r.field} ·
          <span style="color:${moraleColor}">Moral ${r.morale}</span>
        </div>
      </div>
    </div>
  `;
}

function renderProjectInfo(projectId, state) {
  const proj = state.projects.active.find(p => p.id === projectId);
  if (!proj) return '';

  const fieldDef = FIELDS[proj.field] ?? {};

  return `
    <div class="ev-project">
      <span class="ev-project__label" style="color:${fieldDef.color ?? '#8888aa'}">
        📋 ${proj.label}
      </span>
      <span class="ev-project__phase">
        ${proj.phase} fazı
      </span>
    </div>
  `;
}

function renderChoice(choice, index, event) {
  const hasEffect  = choice.effect?.type !== 'none' && choice.effect?.type;
  const effectHint = hasEffect ? getEffectHint(choice.effect) : null;

  return `
    <button class="ev-choice"
            data-choice-id="${choice.id}"
            data-event-id="${event.id}">
      <div class="ev-choice__head">
        <span class="ev-choice__key">${String.fromCharCode(65 + index)}</span>
        <span class="ev-choice__label">${choice.label}</span>
      </div>
      ${choice.description ? `
        <div class="ev-choice__desc">${choice.description}</div>
      ` : ''}
      ${effectHint ? `
        <div class="ev-choice__effect">${effectHint}</div>
      ` : ''}
    </button>
  `;
}

function renderQueueIndicator(state) {
  const count = state.events.pending.length;
  if (count <= 1) return '';

  return `
    <div class="ev-queue">
      Sırada ${count - 1} karar daha bekliyor
    </div>
  `;
}

// ─── EVENT BAĞLAMA ────────────────────────────────────────────────────────────

function bindModalEvents(modal, event) {
  // Seçim butonları
  modal.querySelectorAll('.ev-choice').forEach(btn => {
    btn.addEventListener('click', () => {
      const choiceId = btn.dataset.choiceId;
      handleChoice(event, choiceId);
    });

    // Touch desteği (Android)
    btn.addEventListener('touchend', e => {
      e.preventDefault();
      const choiceId = btn.dataset.choiceId;
      handleChoice(event, choiceId);
    });
  });

  // Overlay tıklama — tek seçenekliyse kapat
  modal.addEventListener('click', e => {
    if (e.target === modal && event.choices.length === 1) {
      handleChoice(event, event.choices[0].id);
    }
  });
}

function handleChoice(event, choiceId) {
  if (!_isOpen) return;
  resolveEvent(event.id, choiceId);
}

// ─── YARDIMCILAR ─────────────────────────────────────────────────────────────

/**
 * Event kategorisine göre görsel meta döner.
 */
function getEventMeta(event) {
  // ID prefix'e göre kategori belirle
  const id = event.id ?? '';

  if (id.startsWith('W') || event.category === 'world') {
    return { icon: '🌍', categoryLabel: 'Dünya Olayı', color: '#3b82f6' };
  }
  if (id.startsWith('I') || event.category === 'institution') {
    return { icon: '🏛️', categoryLabel: 'Kurum Olayı', color: '#a78bfa' };
  }
  if (id.startsWith('R') || event.category === 'research') {
    return { icon: '🔬', categoryLabel: 'Araştırma Olayı', color: '#4ade80' };
  }
  if (id.startsWith('P') || event.category === 'personal') {
    return { icon: '👤', categoryLabel: 'Kişisel Olay', color: '#fb923c' };
  }
  // Nobel / özel event'ler
  if (id.startsWith('nobel')) {
    return { icon: '🏅', categoryLabel: 'Nobel', color: '#f0c060' };
  }
  if (id.startsWith('journal')) {
    return { icon: '📄', categoryLabel: 'Dergi Seçimi', color: '#2dd4bf' };
  }
  if (id.startsWith('rejection')) {
    return { icon: '📭', categoryLabel: 'Red Kararı', color: '#f87171' };
  }
  if (id.startsWith('burnout')) {
    return { icon: '🔥', categoryLabel: 'Tükenmişlik', color: '#fb923c' };
  }
  if (id.startsWith('transfer')) {
    return { icon: '✈️', categoryLabel: 'Transfer Teklifi', color: '#f0c060' };
  }
  if (id.startsWith('grant')) {
    return { icon: '💰', categoryLabel: 'Hibe', color: '#4ade80' };
  }
  if (id.startsWith('equip')) {
    return { icon: '🔧', categoryLabel: 'Ekipman', color: '#8888aa' };
  }

  return { icon: '📢', categoryLabel: 'Bildirim', color: '#8888aa' };
}

/**
 * Mevcut oyun zamanını kısa string olarak döner.
 */
function getTimeContext(state) {
  return `Yıl ${state.time.year}, Ay ${state.time.month}`;
}

/**
 * Effect tipinden kısa Türkçe ipucu döner.
 */
function getEffectHint(effect) {
  const hints = {
    prestige_gain:      `+${effect.amount ?? '?'} prestij`,
    prestige_hit:       `${effect.amount ?? '?'} prestij`,
    budget_gain:        `+${effect.amount?.toLocaleString() ?? '?'} bütçe`,
    budget_random:      'Bütçe değişimi',
    open_grant:         'Hibe başvurusu açılır',
    field_boost:        `${FIELDS[effect.field]?.label ?? effect.field ?? 'Alan'} güçlenir`,
    cost_cut:           'Maliyetler düşer',
    lab_upgrade:        'Lab seviyesi artar',
    equipment_boost:    'Ekipman verimlenir',
    free_equipment:     'Ücretsiz ekipman',
    project_quality_boost: `Proje kalitesi +${effect.amount ?? '?'}`,
    project_pause:      `Proje +${effect.weeks ?? '?'} hafta yavaşlar`,
    citation_burst:     `+${effect.amount ?? '?'} citation`,
    media_boost:        'Medya ilgisi',
    ethics_boost:       'Etik puanlar artar',
    hire_junior:        'Yeni junior araştırmacı',
    mentorship:         'Mentörlük ilişkisi',
    leave:              `${effect.weeks ?? '?'} hafta izin`,
    conference:         `Konferans — RP +${effect.rpGain ?? '?'}`,
    salary_match:       'Maaş eşitlenir',
    researcher_leaves:  'Araştırmacı ayrılır',
  };

  return hints[effect.type] ?? null;
}

function getPersonalityColor(p) {
  const c = {
    GEN:'#a78bfa', MET:'#3b82f6', LED:'#4ade80', AMB:'#fb923c',
    PER:'#f0c060', MNT:'#2dd4bf', PLY:'#8888aa', CAR:'#fb923c',
  };
  return c[p] ?? '#8888aa';
}

// ─── CSS ─────────────────────────────────────────────────────────────────────

function injectStyles() {
  if (document.getElementById('ev-styles')) return;
  const s = document.createElement('style');
  s.id = 'ev-styles';
  s.textContent = `
  /* ── Overlay ── */
  .ev-overlay {
    position:fixed; inset:0;
    background:rgba(0,0,0,.80);
    display:flex; align-items:center; justify-content:center;
    z-index:300; padding:16px;
    backdrop-filter:blur(4px);
  }

  /* ── Modal ── */
  .ev-modal {
    background:#0d0d1c;
    border:1px solid rgba(255,255,255,.1);
    border-radius:16px;
    width:100%; max-width:520px;
    max-height:90vh; overflow-y:auto;
    padding:0;
    display:flex; flex-direction:column;
    scrollbar-width:thin; scrollbar-color:rgba(255,255,255,.1) transparent;
    /* Açılış animasyonu */
    opacity:0; transform:translateY(12px) scale(.97);
    transition:opacity .2s ease, transform .2s ease;
  }
  .ev-modal--visible {
    opacity:1; transform:translateY(0) scale(1);
  }
  .ev-modal::-webkit-scrollbar { width:4px; }
  .ev-modal::-webkit-scrollbar-thumb { background:rgba(255,255,255,.1); border-radius:2px; }

  /* ── Header ── */
  .ev-header {
    display:flex; align-items:flex-start; gap:12px;
    padding:18px 20px 14px;
    border-bottom:1px solid;
  }
  .ev-header__icon {
    font-size:28px; flex-shrink:0;
    width:44px; height:44px;
    display:flex; align-items:center; justify-content:center;
    background:rgba(255,255,255,.05); border-radius:10px;
  }
  .ev-header__body { flex:1; min-width:0; }
  .ev-category {
    font-size:10px; font-weight:700; text-transform:uppercase;
    letter-spacing:.08em; margin-bottom:4px;
  }
  .ev-title {
    font-size:17px; font-weight:700;
    font-family:'Syne',sans-serif;
    line-height:1.3;
  }
  .ev-header__badge {
    font-size:10px; font-weight:600;
    padding:3px 8px; border-radius:8px;
    white-space:nowrap; flex-shrink:0;
  }

  /* ── Açıklama ── */
  .ev-description {
    padding:14px 20px;
    font-size:13px; line-height:1.6; color:#c8c8e0;
    border-bottom:1px solid rgba(255,255,255,.06);
  }

  /* ── Araştırmacı kartı ── */
  .ev-researcher {
    display:flex; align-items:center; gap:10px;
    padding:10px 20px;
    background:rgba(255,255,255,.03);
    border-bottom:1px solid rgba(255,255,255,.06);
  }
  .ev-researcher__av {
    width:40px; height:40px; border-radius:50%; flex-shrink:0;
    display:flex; align-items:center; justify-content:center;
    font-size:13px; font-weight:700; color:#fff;
    min-width:40px;
  }
  .ev-researcher__name { font-size:13px; font-weight:600; }
  .ev-researcher__meta { font-size:11px; color:#8888aa; margin-top:2px; }

  /* ── Proje bilgisi ── */
  .ev-project {
    display:flex; align-items:center; justify-content:space-between;
    padding:8px 20px;
    background:rgba(255,255,255,.03);
    border-bottom:1px solid rgba(255,255,255,.06);
    font-size:11px;
  }
  .ev-project__label { font-weight:600; }
  .ev-project__phase { color:#8888aa; text-transform:capitalize; }

  /* ── Seçenekler ── */
  .ev-choices {
    display:flex; flex-direction:column; gap:8px;
    padding:16px 20px;
  }
  .ev-choice {
    display:flex; flex-direction:column; gap:4px;
    background:rgba(255,255,255,.04);
    border:1px solid rgba(255,255,255,.09);
    border-radius:10px; padding:12px 14px;
    cursor:pointer; text-align:left;
    transition:background .15s, border-color .15s;
    min-height:56px;
  }
  .ev-choice:hover {
    background:rgba(124,58,237,.12);
    border-color:rgba(124,58,237,.4);
  }
  .ev-choice:focus {
    outline:2px solid #7c3aed; outline-offset:2px;
  }
  .ev-choice:active { background:rgba(124,58,237,.2); }

  .ev-choice__head {
    display:flex; align-items:center; gap:8px;
  }
  .ev-choice__key {
    width:22px; height:22px; border-radius:6px; flex-shrink:0;
    background:rgba(124,58,237,.25); color:#a78bfa;
    font-size:11px; font-weight:700;
    display:flex; align-items:center; justify-content:center;
  }
  .ev-choice__label {
    font-size:13px; font-weight:600; color:#f0f0ff;
  }
  .ev-choice__desc {
    font-size:11px; color:#8888aa; line-height:1.5;
    padding-left:30px;
  }
  .ev-choice__effect {
    font-size:10px; font-weight:600;
    color:#4ade80; padding-left:30px;
    opacity:.85;
  }

  /* ── Kuyruk göstergesi ── */
  .ev-queue {
    text-align:center; font-size:11px; color:#555577;
    padding:8px 20px 14px;
  }
  `;
  document.head.appendChild(s);
}
