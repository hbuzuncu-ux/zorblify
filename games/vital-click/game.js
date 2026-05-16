/* ═══════════════════════════════════════════════
   VITAL CLICK — game.js
   Canvas engine, character drawing, animations,
   game loop, state management, event wiring
   Depends on: save.js, upgrades.js, ui.js
═══════════════════════════════════════════════ */

'use strict';

// ── CANVAS SETUP ─────────────────────────────────
const canvas = document.getElementById('game-canvas');
const ctx    = canvas.getContext('2d');
let CW, CH;  // canvas pixel dimensions

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr  = window.devicePixelRatio || 1;
  CW = canvas.width  = Math.round(rect.width  * dpr);
  CH = canvas.height = Math.round(rect.height * dpr);
  // Reset transform before scaling to avoid accumulation on resize
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  // Logical dimensions (CSS pixels)
  canvas._lw = rect.width;
  canvas._lh = rect.height;
}
window.addEventListener('resize', () => { resizeCanvas(); });

// ── GAME STATE ───────────────────────────────────
let state;          // live game state object (from save.js)
let frameCount = 0; // total frames since start
let running    = false;

// Cached GPS (recomputed every second)
let cachedGPS = 0;

// ── ANIMATION OBJECTS ────────────────────────────
// Particles
const particles = [];

// Click ripples on canvas
const canvasRipples = [];

// Active scene animations per dept
const sceneAnims = {
  er:       { phase: 0, active: false, activeT: 0 },
  icu:      { phase: 0, active: false, activeT: 0 },
  surgery:  { phase: 0, active: false, activeT: 0 },
  lab:      { phase: 0, active: false, activeT: 0 },
  pharma:   { phase: 0, active: false, activeT: 0 },
  research: { phase: 0, active: false, activeT: 0 },
};

// Main button animation
const mainBtn = { scale: 1, targetScale: 1, clickFlash: 0 };

// ── PARTICLE SYSTEM ──────────────────────────────
function spawnParticle(x, y, opts = {}) {
  const angle = opts.angle !== undefined ? opts.angle : Math.random() * Math.PI * 2;
  const speed = opts.speed || (1 + Math.random() * 3);
  particles.push({
    x, y,
    vx:  Math.cos(angle) * speed,
    vy:  Math.sin(angle) * speed - (opts.upBias || 0),
    life: 1,
    dec:  opts.dec  || (0.02 + Math.random() * 0.02),
    r:    opts.r    || (2 + Math.random() * 3),
    col:  opts.col  || '#fbbf24',
    grav: opts.grav !== undefined ? opts.grav : 0.06,
    type: opts.type || 'circle',  // 'circle' | 'cross' | 'heart' | 'star'
  });
}

function spawnGoldBurst(x, y, count = 8) {
  for (let i = 0; i < count; i++) {
    spawnParticle(x, y, {
      col: i % 2 === 0 ? '#fbbf24' : '#f59e0b',
      speed: 1.5 + Math.random() * 3,
      upBias: 1.5,
      dec: 0.025,
      r: 2 + Math.random() * 4,
    });
  }
}

function spawnHeart(x, y) {
  spawnParticle(x, y, {
    col: '#f472b6', speed: 1 + Math.random() * 2,
    upBias: 2.5, dec: 0.018, r: 5 + Math.random() * 4,
    type: 'heart', grav: -0.03,
  });
}

function spawnStar(x, y) {
  spawnParticle(x, y, {
    col: '#a78bfa', speed: 0.8 + Math.random() * 2,
    upBias: 2, dec: 0.02, r: 4 + Math.random() * 3,
    type: 'star', grav: 0.01,
  });
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x  += p.vx;
    p.y  += p.vy;
    p.vy += p.grav;
    p.vx *= 0.97;
    p.life -= p.dec;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawParticle(p) {
  ctx.globalAlpha = Math.max(0, p.life);
  ctx.fillStyle   = p.col;
  ctx.strokeStyle = p.col;

  if (p.type === 'circle') {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();

  } else if (p.type === 'heart') {
    ctx.save();
    ctx.translate(p.x, p.y);
    const s = p.r / 5;
    ctx.scale(s, s);
    ctx.beginPath();
    ctx.moveTo(0, -2);
    ctx.bezierCurveTo( 2.5, -5,  6, -2,  0,  3);
    ctx.bezierCurveTo(-6,  -2, -2.5, -5,  0, -2);
    ctx.fill();
    ctx.restore();

  } else if (p.type === 'star') {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(frameCount * 0.05);
    const r1 = p.r, r2 = p.r * 0.45;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a1 = (i / 5) * Math.PI * 2 - Math.PI / 2;
      const a2 = ((i + 0.5) / 5) * Math.PI * 2 - Math.PI / 2;
      i === 0
        ? ctx.moveTo(Math.cos(a1)*r1, Math.sin(a1)*r1)
        : ctx.lineTo(Math.cos(a1)*r1, Math.sin(a1)*r1);
      ctx.lineTo(Math.cos(a2)*r2, Math.sin(a2)*r2);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();

  } else if (p.type === 'cross') {
    const r = p.r;
    ctx.lineWidth = r * 0.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(p.x - r, p.y); ctx.lineTo(p.x + r, p.y);
    ctx.moveTo(p.x, p.y - r); ctx.lineTo(p.x, p.y + r);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// ── CANVAS RIPPLES ───────────────────────────────
function spawnCanvasRipple(x, y, col = 'rgba(125,211,252,0.7)') {
  canvasRipples.push({ x, y, r: 0, maxR: 60, life: 1, col });
}

function updateRipples() {
  for (let i = canvasRipples.length - 1; i >= 0; i--) {
    const r = canvasRipples[i];
    r.r    += 4;
    r.life -= 0.06;
    if (r.life <= 0) canvasRipples.splice(i, 1);
  }
}

function drawRipples() {
  canvasRipples.forEach(r => {
    ctx.globalAlpha = r.life * 0.6;
    ctx.strokeStyle = r.col;
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.globalAlpha = 1;
}

// ── DRAW HELPERS ─────────────────────────────────
function drawRoundRect(x, y, w, h, r, fill, stroke) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  if (fill)   { ctx.fillStyle   = fill;   ctx.fill();   }
  if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
}

function drawShadow(blur, col) {
  ctx.shadowBlur  = blur;
  ctx.shadowColor = col;
}
function clearShadow() {
  ctx.shadowBlur  = 0;
  ctx.shadowColor = 'transparent';
}

// ── CHARACTER DRAWING ────────────────────────────
// All characters are drawn procedurally using canvas 2D

/**
 * Draw a doctor character at (cx, cy).
 * @param {number} cx     center X
 * @param {number} cy     center Y (feet level)
 * @param {number} scale  1.0 = normal
 * @param {object} opts   { walking, holdItem, color }
 */
function drawDoctor(cx, cy, scale = 1, opts = {}) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  const walk   = opts.walking ? Math.sin(frameCount * 0.2) * 4 : 0;
  const armSwg = opts.walking ? Math.sin(frameCount * 0.2) * 12 : 0;
  const col    = opts.color || '#3b82f6';

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 14, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs
  ctx.strokeStyle = '#1e3a5f';
  ctx.lineWidth   = 5;
  ctx.lineCap     = 'round';
  ctx.beginPath();
  ctx.moveTo(-5, -20);
  ctx.lineTo(-5 + walk * 0.5, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(5, -20);
  ctx.lineTo(5 - walk * 0.5, 0);
  ctx.stroke();

  // Shoes
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.ellipse(-5 + walk * 0.5, 0, 5, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(5 - walk * 0.5, 0, 5, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body (white coat)
  drawRoundRect(-12, -52, 24, 34, 6, '#f0f9ff', 'rgba(148,163,184,0.4)');
  ctx.lineWidth = 1;

  // Coat collar & tie
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(-4, -52); ctx.lineTo(0, -42); ctx.lineTo(4, -52);
  ctx.closePath(); ctx.fill();

  // Stethoscope
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  ctx.moveTo(-2, -45);
  ctx.bezierCurveTo(-10, -38, -12, -30, -8, -28);
  ctx.stroke();
  ctx.fillStyle = '#64748b';
  ctx.beginPath();
  ctx.arc(-8, -26, 3, 0, Math.PI * 2);
  ctx.fill();

  // Arms
  ctx.strokeStyle = '#f0f9ff';
  ctx.lineWidth   = 6;
  ctx.lineCap     = 'round';
  // Left arm (with clipboard or idle)
  ctx.beginPath();
  ctx.moveTo(-12, -46);
  ctx.lineTo(-18 - armSwg * 0.3, -30);
  ctx.stroke();
  // Right arm
  ctx.beginPath();
  ctx.moveTo(12, -46);
  ctx.lineTo(18 + armSwg * 0.3, -30);
  ctx.stroke();

  // Clipboard in left hand
  if (opts.holdItem === 'clipboard') {
    ctx.save();
    ctx.translate(-20 - armSwg * 0.3, -28);
    drawRoundRect(-6, -10, 12, 16, 2, '#fef3c7', '#d97706');
    ctx.strokeStyle = '#92400e'; ctx.lineWidth = 0.8;
    [-5,-2,1,4].forEach(y2 => {
      ctx.beginPath();
      ctx.moveTo(-4, y2); ctx.lineTo(4, y2); ctx.stroke();
    });
    ctx.restore();
  }

  // Syringe in right hand
  if (opts.holdItem === 'syringe') {
    ctx.save();
    ctx.translate(20 + armSwg * 0.3, -28);
    ctx.rotate(-Math.PI / 4);
    drawRoundRect(-2, -12, 4, 18, 2, 'rgba(219,234,254,0.9)', '#3b82f6');
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(-1.5, -12, 3, 6);
    ctx.strokeStyle = '#64748b'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 6); ctx.lineTo(0, 12); ctx.stroke();
    ctx.restore();
  }

  // Head
  ctx.fillStyle = '#fde68a';
  ctx.beginPath();
  ctx.arc(0, -62, 13, 0, Math.PI * 2);
  ctx.fill();

  // Hair
  ctx.fillStyle = opts.hairColor || '#1e293b';
  ctx.beginPath();
  ctx.arc(0, -71, 10, Math.PI, 0);
  ctx.fill();

  // Eyes
  ctx.fillStyle = '#1e293b';
  [-5, 5].forEach(ex => {
    ctx.beginPath();
    ctx.arc(ex, -63, 2, 0, Math.PI * 2);
    ctx.fill();
  });

  // Smile
  ctx.strokeStyle = '#92400e';
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  ctx.arc(0, -60, 5, 0.2, Math.PI - 0.2);
  ctx.stroke();

  // Doctor cap
  ctx.fillStyle = '#fff';
  drawRoundRect(-9, -76, 18, 6, 2, '#fff', 'rgba(148,163,184,0.5)');
  ctx.fillStyle = col;
  ctx.fillRect(-3, -76, 6, 6);

  ctx.restore();
}

/**
 * Draw a nurse character at (cx, cy).
 */
function drawNurse(cx, cy, scale = 1, opts = {}) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  const walk = opts.walking ? Math.sin(frameCount * 0.22 + 1) * 4 : 0;
  const col  = opts.color || '#ec4899';

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 12, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs
  ctx.strokeStyle = '#be185d';
  ctx.lineWidth   = 5; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-4, -20); ctx.lineTo(-4 + walk * 0.5, 0); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(4, -20); ctx.lineTo(4 - walk * 0.5, 0); ctx.stroke();

  // Shoes
  ctx.fillStyle = '#fff';
  [-4, 4].forEach((x2, i) => {
    ctx.beginPath();
    ctx.ellipse(x2 + (i === 0 ? walk * 0.5 : -walk * 0.5), 0, 4.5, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  // Dress/uniform
  ctx.fillStyle = '#fce7f3';
  ctx.strokeStyle = col;
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(-12, -20);
  ctx.lineTo(-13, -52);
  ctx.lineTo(13, -52);
  ctx.lineTo(12, -20);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  // Apron
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  drawRoundRect(-7, -50, 14, 28, 4, 'rgba(255,255,255,0.6)');

  // Red cross on apron
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(-1.5, -44, 3, 10);
  ctx.fillRect(-5, -40, 10, 3);

  // Arms
  ctx.strokeStyle = '#fce7f3';
  ctx.lineWidth   = 5; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-12, -47); ctx.lineTo(-17, -32); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(12, -47); ctx.lineTo(17, -32); ctx.stroke();

  // IV bag in right hand
  if (opts.holdItem === 'iv') {
    ctx.save();
    ctx.translate(20, -34);
    ctx.fillStyle = 'rgba(219,234,254,0.85)';
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth   = 1;
    drawRoundRect(-6, -16, 12, 20, 4, 'rgba(219,234,254,0.85)', '#3b82f6');
    ctx.strokeStyle = '#93c5fd'; ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(0, 4); ctx.lineTo(0, 14); ctx.stroke();
    ctx.restore();
  }

  // Head
  ctx.fillStyle = '#fde68a';
  ctx.beginPath();
  ctx.arc(0, -62, 12, 0, Math.PI * 2);
  ctx.fill();

  // Hair
  ctx.fillStyle = opts.hairColor || '#7c3aed';
  ctx.beginPath();
  ctx.arc(0, -70, 10, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(-10, -70, 20, 6);

  // Nurse cap
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = col; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-11, -72); ctx.lineTo(0, -80); ctx.lineTo(11, -72); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = col;
  ctx.fillRect(-2, -76, 4, 3);

  // Eyes
  ctx.fillStyle = '#1e293b';
  [-4.5, 4.5].forEach(ex => {
    ctx.beginPath();
    ctx.arc(ex, -63, 1.8, 0, Math.PI * 2);
    ctx.fill();
  });

  // Smile
  ctx.strokeStyle = '#92400e';
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  ctx.arc(0, -60, 4.5, 0.2, Math.PI - 0.2);
  ctx.stroke();

  ctx.restore();
}

/**
 * Draw a patient in bed at (cx, cy).
 */
function drawPatient(cx, cy, scale = 1, opts = {}) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  const healthPct = opts.health !== undefined ? opts.health : 1;
  const breathe   = Math.sin(frameCount * 0.04) * 2;

  // Bed frame
  ctx.fillStyle   = '#cbd5e1';
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth   = 2;
  drawRoundRect(-45, -18, 90, 20, 4, '#cbd5e1', '#94a3b8');
  // Headboard
  drawRoundRect(-45, -38, 18, 22, 4, '#94a3b8', '#64748b');
  // Footboard
  drawRoundRect(27, -28, 18, 14, 4, '#94a3b8', '#64748b');

  // Sheet
  ctx.fillStyle = '#f0f9ff';
  ctx.strokeStyle = '#bae6fd';
  ctx.lineWidth = 1;
  drawRoundRect(-36, -28, 72, 12, 4, '#f0f9ff', '#bae6fd');

  // Patient body under sheet
  ctx.fillStyle = '#fde68a';
  ctx.beginPath();
  ctx.ellipse(-10, -22 + breathe, 20, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Patient head
  ctx.fillStyle = '#fde68a';
  ctx.beginPath();
  ctx.arc(-32, -30 + breathe * 0.5, 10, 0, Math.PI * 2);
  ctx.fill();

  // Hair
  ctx.fillStyle = opts.hairColor || '#92400e';
  ctx.beginPath();
  ctx.arc(-32, -37 + breathe * 0.5, 8, Math.PI, 0);
  ctx.fill();

  // Eyes — open or half closed depending on health
  ctx.fillStyle = '#1e293b';
  const eyeOpen = healthPct > 0.5 ? 2 : 1;
  [-36, -28].forEach(ex => {
    ctx.beginPath();
    ctx.arc(ex, -30 + breathe * 0.5, eyeOpen, 0, Math.PI * 2);
    ctx.fill();
  });

  // IV line
  ctx.strokeStyle = '#93c5fd';
  ctx.lineWidth   = 1.5;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(-32, -30);
  ctx.bezierCurveTo(-32, -50, -20, -55, 5, -55);
  ctx.stroke();
  ctx.setLineDash([]);
  // IV bag
  ctx.fillStyle = 'rgba(219,234,254,0.8)';
  ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 1;
  drawRoundRect(0, -68, 14, 18, 4, 'rgba(219,234,254,0.8)', '#3b82f6');

  // Health bar above patient
  const barW = 50, barH = 5;
  const bx = -25, by = -52;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  drawRoundRect(bx, by, barW, barH, 2, 'rgba(0,0,0,0.3)');
  const barCol = healthPct > 0.6 ? '#4ade80' : healthPct > 0.3 ? '#fbbf24' : '#f87171';
  drawRoundRect(bx, by, barW * healthPct, barH, 2, barCol);

  ctx.restore();
}

// ── SCENE DRAWING ─────────────────────────────────
const LW = () => canvas._lw || 600;
const LH = () => canvas._lh || 400;

/**
 * Draw the hospital room background.
 */
function drawRoomBackground(roomCol = '#0f1f3d', accentCol = '#1e3a5f') {
  const lw = LW(), lh = LH();

  // Floor
  const floorGrad = ctx.createLinearGradient(0, lh * 0.65, 0, lh);
  floorGrad.addColorStop(0, '#0f172a');
  floorGrad.addColorStop(1, '#0a0e1a');
  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, lh * 0.65, lw, lh * 0.35);

  // Floor tiles
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth   = 1;
  const tileSize  = 48;
  for (let x = 0; x < lw; x += tileSize) {
    ctx.beginPath();
    ctx.moveTo(x, lh * 0.65); ctx.lineTo(x, lh); ctx.stroke();
  }
  for (let y = Math.floor(lh * 0.65 / tileSize) * tileSize; y < lh; y += tileSize) {
    ctx.beginPath();
    ctx.moveTo(0, y); ctx.lineTo(lw, y); ctx.stroke();
  }

  // Wall
  const wallGrad = ctx.createLinearGradient(0, 0, 0, lh * 0.65);
  wallGrad.addColorStop(0, accentCol);
  wallGrad.addColorStop(1, roomCol);
  ctx.fillStyle = wallGrad;
  ctx.fillRect(0, 0, lw, lh * 0.65);

  // Wall grid / panels
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth   = 1;
  const panelW    = 100;
  for (let x = 0; x < lw; x += panelW) {
    drawRoundRect(x + 6, 10, panelW - 12, lh * 0.6, 4, null, 'rgba(255,255,255,0.03)');
  }

  // Wall-floor border
  ctx.fillStyle = '#334155';
  ctx.fillRect(0, lh * 0.65 - 4, lw, 8);

  // Window (left wall)
  const wx = 30, wy = 40, ww = 80, wh = 100;
  drawRoundRect(wx, wy, ww, wh, 6, '#0ea5e9', 'rgba(255,255,255,0.15)');
  ctx.lineWidth = 2;
  // Window cross
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath();
  ctx.moveTo(wx + ww/2, wy); ctx.lineTo(wx + ww/2, wy + wh); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(wx, wy + wh/2); ctx.lineTo(wx + ww, wy + wh/2); ctx.stroke();
  // Window light glow
  const wGlow = ctx.createRadialGradient(wx + ww/2, wy + wh/2, 0, wx + ww/2, wy + wh/2, ww);
  wGlow.addColorStop(0, 'rgba(14,165,233,0.15)');
  wGlow.addColorStop(1, 'transparent');
  ctx.fillStyle = wGlow;
  ctx.fillRect(wx - 20, wy - 20, ww + 40, wh + 40);
}

/**
 * Draw ECG / heart monitor line.
 */
function drawECG(x, y, w, h, phase, col = '#4ade80') {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = col;
  ctx.lineWidth   = 1.5;
  ctx.shadowColor = col;
  ctx.shadowBlur  = 8;
  ctx.beginPath();
  const steps = 80;
  for (let i = 0; i <= steps; i++) {
    const px = (i / steps) * w;
    const t  = (i / steps) + phase;
    const frac = t % 1;
    let py = h / 2;
    // ECG shape
    if (frac > 0.3 && frac < 0.35)  py = h * 0.1;
    else if (frac >= 0.35 && frac < 0.38) py = h * 0.9;
    else if (frac >= 0.38 && frac < 0.42) py = h * 0.05;
    else if (frac >= 0.42 && frac < 0.45) py = h * 0.55;
    else                                   py = h / 2 + Math.sin(t * Math.PI * 2) * 2;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.stroke();
  clearShadow();
  ctx.restore();
}

// ── SCENE: EMERGENCY ROOM ─────────────────────────
function drawSceneER(anim) {
  const lw = LW(), lh = LH();
  drawRoomBackground('#0f2020', '#1a3535');

  // ER sign
  ctx.fillStyle = '#ef4444';
  drawRoundRect(lw/2 - 40, 15, 80, 28, 6, '#ef4444');
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px Nunito, Arial';
  ctx.textAlign = 'center';
  ctx.fillText('EMERGENCY', lw/2, 34);
  ctx.textAlign = 'left';

  // Ambulance light effect
  const lightPhase = (frameCount % 60) / 60;
  if (lightPhase < 0.5) {
    ctx.fillStyle = 'rgba(239,68,68,0.08)';
    ctx.fillRect(0, 0, lw, lh);
  }

  // Stretcher
  ctx.fillStyle = '#1e3a5f';
  drawRoundRect(lw*0.35, lh*0.52, lw*0.3, lh*0.12, 6, '#1e3a5f', '#334155');
  ctx.fillStyle = '#f0f9ff';
  drawRoundRect(lw*0.36, lh*0.50, lw*0.28, lh*0.08, 4, '#f0f9ff');

  // Patient on stretcher
  drawPatient(lw * 0.5, lh * 0.62, 0.9, { health: 0.4 + Math.sin(frameCount*0.02)*0.1 });

  // Doctor rushing in
  const drX = anim.active
    ? lw*0.72 - anim.activeT * 0.5
    : lw * 0.72;
  drawDoctor(drX, lh * 0.72, 0.85, { walking: anim.active, holdItem: 'syringe' });

  // Nurse
  drawNurse(lw * 0.28, lh * 0.72, 0.8, { walking: false, holdItem: 'iv' });

  // ECG monitor
  drawRoundRect(lw*0.68, lh*0.25, 120, 70, 8, '#0a0e1a', '#334155');
  ctx.fillStyle = '#0f172a';
  drawRoundRect(lw*0.69, lh*0.26, 118, 68, 6, '#0f172a');
  drawECG(lw*0.70, lh*0.27, 110, 55, frameCount * 0.015, '#4ade80');
  ctx.fillStyle = '#4ade80';
  ctx.font = '9px monospace';
  ctx.fillText('HR: 98 bpm', lw*0.70, lh*0.26 + 62);

  // Flash effect on click
  if (anim.active && anim.activeT < 20) {
    ctx.fillStyle = `rgba(239,68,68,${0.15 * (1 - anim.activeT/20)})`;
    ctx.fillRect(0, 0, lw, lh);
  }
}

// ── SCENE: ICU ────────────────────────────────────
function drawSceneICU(anim) {
  const lw = LW(), lh = LH();
  drawRoomBackground('#0a1628', '#102040');

  // ICU label
  ctx.fillStyle = '#3b82f6';
  drawRoundRect(lw/2-35, 15, 70, 28, 6, '#3b82f6');
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px Nunito, Arial';
  ctx.textAlign = 'center';
  ctx.fillText('ICU', lw/2, 34);
  ctx.textAlign = 'left';

  // Bed 1 (main patient)
  drawPatient(lw * 0.38, lh * 0.62, 1.0, { health: 0.65, hairColor: '#1e293b' });

  // Bed 2 (background)
  ctx.globalAlpha = 0.5;
  drawPatient(lw * 0.72, lh * 0.60, 0.75, { health: 0.8, hairColor: '#92400e' });
  ctx.globalAlpha = 1;

  // Nurse checking vitals
  drawNurse(lw * 0.22, lh * 0.72, 0.85, { walking: anim.active, holdItem: 'iv' });

  // Doctor with clipboard
  drawDoctor(lw * 0.60, lh * 0.72, 0.82, { walking: false, holdItem: 'clipboard', hairColor: '#92400e' });

  // Multiple monitors
  [[lw*0.15, lh*0.2, '#4ade80', 'HR: 72'], [lw*0.5, lh*0.18, '#60a5fa', 'O2: 98%'], [lw*0.78, lh*0.22, '#f87171', 'BP: 120/80']].forEach(([mx, my, mc, label]) => {
    drawRoundRect(mx, my, 110, 60, 8, '#0a0e1a', '#334155');
    drawRoundRect(mx+2, my+2, 106, 56, 6, '#0f172a');
    drawECG(mx+4, my+4, 102, 40, frameCount * 0.012, mc);
    ctx.fillStyle = mc;
    ctx.font = '9px monospace';
    ctx.fillText(label, mx+4, my+56);
  });
}

// ── SCENE: SURGERY ────────────────────────────────
function drawSceneSurgery(anim) {
  const lw = LW(), lh = LH();
  drawRoomBackground('#0f0f28', '#1a1a3a');

  // Surgery sign
  ctx.fillStyle = '#7c3aed';
  drawRoundRect(lw/2-55, 15, 110, 28, 6, '#7c3aed');
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px Nunito, Arial';
  ctx.textAlign = 'center';
  ctx.fillText('OPERATING THEATRE', lw/2, 34);
  ctx.textAlign = 'left';

  // Surgery table
  ctx.fillStyle = '#334155';
  drawRoundRect(lw*0.25, lh*0.55, lw*0.5, lh*0.08, 6, '#334155', '#475569');
  ctx.fillStyle = '#1e293b';
  drawRoundRect(lw*0.26, lh*0.52, lw*0.48, lh*0.06, 4, '#1e293b');

  // Patient on table
  drawPatient(lw*0.5, lh*0.58, 0.95, { health: 0.5, hairColor: '#374151' });

  // Surgical light
  const lightX = lw * 0.5, lightY = lh * 0.08;
  const lightGrad = ctx.createRadialGradient(lightX, lightY, 0, lightX, lightY + 100, 150);
  lightGrad.addColorStop(0, 'rgba(255,255,240,0.25)');
  lightGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = lightGrad;
  ctx.fillRect(lightX - 150, lightY, 300, 260);

  // Light fixture
  ctx.fillStyle = '#cbd5e1';
  ctx.beginPath();
  ctx.arc(lightX, lightY, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,220,0.9)';
  ctx.beginPath();
  ctx.arc(lightX, lightY, 14, 0, Math.PI * 2);
  ctx.fill();

  // Surgeons
  drawDoctor(lw*0.32, lh*0.72, 0.85, { walking: false, holdItem: 'syringe', color: '#7c3aed' });
  drawDoctor(lw*0.68, lh*0.72, 0.85, { walking: false, color: '#7c3aed', hairColor: '#92400e' });
  drawNurse(lw*0.18, lh*0.72, 0.78, { color: '#7c3aed' });

  // Instrument tray
  ctx.fillStyle = '#cbd5e1';
  drawRoundRect(lw*0.72, lh*0.60, 70, 10, 3, '#cbd5e1', '#94a3b8');
  [5,18,31,44,57].forEach(ix => {
    ctx.fillStyle = '#64748b';
    ctx.fillRect(lw*0.72 + ix, lh*0.58, 3, 14);
  });

  // Active pulse
  if (anim.active) {
    ctx.fillStyle = `rgba(124,58,237,${0.1 * Math.sin(anim.activeT * 0.3)})`;
    ctx.fillRect(0, 0, lw, lh);
  }
}

// ── SCENE: LABORATORY ─────────────────────────────
function drawSceneLab(anim) {
  const lw = LW(), lh = LH();
  drawRoomBackground('#062020', '#0d3030');

  ctx.fillStyle = '#0d9488';
  drawRoundRect(lw/2-55, 15, 110, 28, 6, '#0d9488');
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px Nunito, Arial';
  ctx.textAlign = 'center';
  ctx.fillText('DIAGNOSTICS LAB', lw/2, 34);
  ctx.textAlign = 'left';

  // Lab bench
  ctx.fillStyle = '#1e3a3a';
  drawRoundRect(lw*0.1, lh*0.55, lw*0.8, lh*0.12, 6, '#1e3a3a', '#2d5a5a');

  // Lab equipment — flasks
  const flaskColors = ['#60a5fa','#f472b6','#4ade80','#fbbf24'];
  flaskColors.forEach((fc, i) => {
    const fx = lw*0.18 + i * 60;
    const fy = lh*0.48;
    const bubble = Math.sin(frameCount * 0.06 + i) > 0.5;

    // Flask body
    ctx.fillStyle = fc + '44';
    ctx.strokeStyle = fc;
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(fx - 8, fy);
    ctx.lineTo(fx - 14, fy + 30);
    ctx.arc(fx, fy + 30, 14, Math.PI, 0);
    ctx.lineTo(fx + 8, fy);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Neck
    drawRoundRect(fx - 5, fy - 18, 10, 20, 3, fc + '66', fc);

    // Bubbles
    if (bubble && anim.active) {
      ctx.fillStyle = fc;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.arc(fx + (Math.random()*6-3), fy + 10, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  });

  // Microscope
  const mx = lw * 0.7;
  ctx.fillStyle = '#334155';
  ctx.strokeStyle = '#64748b'; ctx.lineWidth = 2;
  drawRoundRect(mx, lh*0.40, 50, 70, 4, '#334155', '#64748b');
  ctx.fillStyle = '#0ea5e9';
  ctx.beginPath();
  ctx.arc(mx+25, lh*0.43, 12, 0, Math.PI*2);
  ctx.fill();
  ctx.fillStyle = 'rgba(14,165,233,0.3)';
  ctx.beginPath();
  ctx.arc(mx+25, lh*0.43, 18, 0, Math.PI*2);
  ctx.fill();

  // Lab technician
  drawDoctor(lw*0.38, lh*0.70, 0.85, {
    walking: false, color: '#0d9488', hairColor: '#92400e',
  });

  // DNA helix on screen
  const screenX = lw*0.55, screenY = lh*0.22;
  drawRoundRect(screenX, screenY, 130, 90, 8, '#0a0e1a', '#334155');
  for (let i = 0; i < 20; i++) {
    const t  = i / 20;
    const sx = screenX + 10 + t * 110;
    const y1 = screenY + 45 + Math.sin(t * Math.PI * 4 + frameCount*0.04) * 25;
    const y2 = screenY + 45 + Math.sin(t * Math.PI * 4 + frameCount*0.04 + Math.PI) * 25;
    ctx.fillStyle = '#4ade80';
    ctx.beginPath(); ctx.arc(sx, y1, 3, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#60a5fa';
    ctx.beginPath(); ctx.arc(sx, y2, 3, 0, Math.PI*2); ctx.fill();
    if (i % 2 === 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(sx, y1); ctx.lineTo(sx, y2); ctx.stroke();
    }
  }
}

// ── SCENE: PHARMACY ───────────────────────────────
function drawScenePharma(anim) {
  const lw = LW(), lh = LH();
  drawRoomBackground('#181400', '#2a2200');

  ctx.fillStyle = '#ca8a04';
  drawRoundRect(lw/2-40, 15, 80, 28, 6, '#ca8a04');
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px Nunito, Arial';
  ctx.textAlign = 'center';
  ctx.fillText('PHARMACY', lw/2, 34);
  ctx.textAlign = 'left';

  // Shelves
  [0.18, 0.36, 0.54].forEach(sy => {
    drawRoundRect(lw*0.05, lh*sy, lw*0.9, 8, 2, '#334155', '#475569');
    // Bottles on shelf
    for (let i = 0; i < 12; i++) {
      const bx  = lw*0.08 + i * (lw*0.75/12);
      const by  = lh*sy - 28;
      const bc  = ['#f87171','#60a5fa','#4ade80','#fbbf24','#a78bfa'][i%5];
      const bh2 = 20 + (i%3)*8;
      drawRoundRect(bx, by - bh2 + 28, 12, bh2, 3, bc+'88', bc);
      // Label
      ctx.fillStyle = '#fff';
      drawRoundRect(bx+1, by - bh2 + 34, 10, 8, 1, '#fff');
    }
  });

  // Pharmacist
  drawNurse(lw*0.5, lh*0.72, 0.9, { color: '#ca8a04', holdItem: 'iv' });

  // Dispensing robot (if anim active)
  if (anim.active) {
    const rx = lw * 0.78;
    ctx.fillStyle = '#334155';
    drawRoundRect(rx, lh*0.45, 60, 80, 8, '#334155', '#ca8a04');
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath(); ctx.arc(rx+30, lh*0.52, 14, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#1e293b';
    ctx.beginPath(); ctx.arc(rx+30, lh*0.52, 8, 0, Math.PI*2); ctx.fill();
    // Arm dispensing
    ctx.strokeStyle = '#ca8a04'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(rx+30, lh*0.56);
    ctx.lineTo(rx+30, lh*0.60 + Math.sin(anim.activeT*0.2)*8);
    ctx.stroke();
  }
}

// ── SCENE: RESEARCH CENTER ────────────────────────
function drawSceneResearch(anim) {
  const lw = LW(), lh = LH();
  drawRoomBackground('#100818', '#1a0e28');

  ctx.fillStyle = '#9333ea';
  drawRoundRect(lw/2-65, 15, 130, 28, 6, '#9333ea');
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px Nunito, Arial';
  ctx.textAlign = 'center';
  ctx.fillText('RESEARCH CENTER', lw/2, 34);
  ctx.textAlign = 'left';

  // Holographic display
  const hx = lw*0.35, hy = lh*0.15;
  drawRoundRect(hx, hy, 200, 130, 10, 'rgba(147,51,234,0.08)', '#7c3aed');
  // Molecular structure
  const atoms = [
    {x:hx+100, y:hy+65, r:12, col:'#a78bfa'},
    {x:hx+60,  y:hy+45, r:8,  col:'#60a5fa'},
    {x:hx+140, y:hy+45, r:8,  col:'#4ade80'},
    {x:hx+60,  y:hy+90, r:8,  col:'#f472b6'},
    {x:hx+140, y:hy+90, r:8,  col:'#fbbf24'},
  ];
  // Bonds
  atoms.slice(1).forEach(a => {
    ctx.strokeStyle = 'rgba(167,139,250,0.4)'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(atoms[0].x, atoms[0].y);
    ctx.lineTo(a.x, a.y);
    ctx.stroke();
  });
  // Atoms
  atoms.forEach(a => {
    const pulse = anim.active ? Math.sin(anim.activeT*0.15)*2 : 0;
    drawShadow(12, a.col);
    ctx.fillStyle = a.col;
    ctx.beginPath();
    ctx.arc(a.x, a.y, a.r + pulse, 0, Math.PI*2);
    ctx.fill();
    clearShadow();
  });

  // Floating data particles
  if (anim.active) {
    for (let i = 0; i < 3; i++) {
      const dx = hx + Math.random()*200;
      const dy = hy + Math.random()*130;
      ctx.fillStyle = '#a78bfa';
      ctx.globalAlpha = 0.6;
      ctx.font = '9px monospace';
      ctx.fillText(['AT','CG','0x2A','ΔE','∑'][Math.floor(Math.random()*5)], dx, dy);
      ctx.globalAlpha = 1;
    }
  }

  // Researcher
  drawDoctor(lw*0.72, lh*0.72, 0.9, {
    color: '#9333ea', holdItem: 'clipboard', hairColor: '#4c1d95',
  });

  // AI terminal on side
  const tx = lw*0.05, ty = lh*0.28;
  drawRoundRect(tx, ty, 90, 120, 8, '#0a0e1a', '#7c3aed');
  ctx.fillStyle = '#7c3aed';
  ctx.font = '8px monospace';
  ['> ANALYZING...','> DNA: 98.2%','> MATCH FOUND','> PATENT: OK','> YIELD +2000g'].forEach((line, i) => {
    if (i * 16 < anim.phase * 80) {
      ctx.fillStyle = i === 4 ? '#4ade80' : '#a78bfa';
      ctx.fillText(line, tx+6, ty+18+i*18);
    }
  });
}

// ── MAIN CLICK BUTTON (canvas center) ────────────
function drawMainButton() {
  const lw = LW(), lh = LH();
  const cx = lw / 2, cy = lh / 2;
  const r  = Math.min(lw, lh) * 0.2;

  // Outer pulse rings
  const pulseR = r + 10 + Math.sin(frameCount * 0.05) * 6;
  ctx.strokeStyle = 'rgba(125,211,252,0.15)';
  ctx.lineWidth   = 2;
  ctx.beginPath(); ctx.arc(cx, cy, pulseR, 0, Math.PI*2); ctx.stroke();
  ctx.strokeStyle = 'rgba(125,211,252,0.08)';
  ctx.beginPath(); ctx.arc(cx, cy, pulseR + 14, 0, Math.PI*2); ctx.stroke();

  // Button shadow glow
  const scale = mainBtn.scale;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  drawShadow(30 + mainBtn.clickFlash * 10, '#0ea5e9');
  // Outer ring
  ctx.strokeStyle = `rgba(125,211,252,${0.4 + mainBtn.clickFlash * 0.4})`;
  ctx.lineWidth   = 3;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.stroke();
  clearShadow();

  // Button body gradient
  const grad = ctx.createRadialGradient(-r*0.2, -r*0.2, r*0.1, 0, 0, r);
  grad.addColorStop(0, '#1e4a6e');
  grad.addColorStop(0.6, '#0c2a45');
  grad.addColorStop(1, '#061522');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill();

  // Click flash overlay
  if (mainBtn.clickFlash > 0) {
    ctx.fillStyle = `rgba(14,165,233,${mainBtn.clickFlash * 0.25})`;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill();
  }

  // Hospital cross icon
  const crossSize = r * 0.38;
  drawShadow(16, '#0ea5e9');
  ctx.fillStyle = '#0ea5e9';
  ctx.fillRect(-crossSize * 0.35, -crossSize, crossSize * 0.7, crossSize * 2);
  ctx.fillRect(-crossSize, -crossSize * 0.35, crossSize * 2, crossSize * 0.7);
  clearShadow();

  // Plus shimmer
  const shimAlpha = (Math.sin(frameCount * 0.08) + 1) * 0.5 * 0.4;
  ctx.fillStyle = `rgba(186,230,253,${shimAlpha})`;
  ctx.fillRect(-crossSize*0.35, -crossSize, crossSize*0.7, crossSize*2);
  ctx.fillRect(-crossSize, -crossSize*0.35, crossSize*2, crossSize*0.7);

  // Click power text
  ctx.fillStyle = '#bae6fd';
  ctx.font = `bold ${Math.round(r * 0.18)}px Nunito, Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('+' + fmt(Math.round(state.clickPower * state.prestigeMult)) + 'g', 0, r * 0.62);
  ctx.fillText('TREAT PATIENT', 0, r * 0.82);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  ctx.restore();
}

// ── SCENE ROUTER ─────────────────────────────────
const SCENE_DRAW = {
  er:       drawSceneER,
  icu:      drawSceneICU,
  surgery:  drawSceneSurgery,
  lab:      drawSceneLab,
  pharma:   drawScenePharma,
  research: drawSceneResearch,
};

/**
 * Determine which scene to show based on unlocked departments.
 * Shows the most recently unlocked department's scene,
 * cycling through them if multiple are auto.
 */
function getActiveScene() {
  // Collect all unlocked depts, cycle through them every 5 seconds
  const unlocked = DEPT_ORDER.filter(k => state.departments[k].unlocked);
  if (unlocked.length === 0) return 'er';
  const idx = Math.floor(frameCount / 300) % unlocked.length;
  return unlocked[idx];
}

// ── MAIN RENDER ───────────────────────────────────
function render() {
  ctx.clearRect(0, 0, CW, CH);

  ctx.save();

  // Draw active scene background
  const activeScene = getActiveScene();
  const sceneFn     = SCENE_DRAW[activeScene];
  if (sceneFn) sceneFn(sceneAnims[activeScene]);

  // Main click button (center)
  drawMainButton();

  // Particles
  updateParticles();
  particles.forEach(p => drawParticle(p));

  // Ripples
  updateRipples();
  drawRipples();

  ctx.restore();
}

// ── GAME TICK ─────────────────────────────────────
function tick() {
  frameCount++;

  // Advance scene animations
  DEPT_ORDER.forEach(k => {
    const a = sceneAnims[k];
    a.phase += 0.008;
    if (a.active) {
      a.activeT++;
      if (a.activeT > 60) { a.active = false; a.activeT = 0; }
    }
  });

  // Main button animation
  mainBtn.scale      += (mainBtn.targetScale - mainBtn.scale) * 0.2;
  mainBtn.targetScale = 1;
  mainBtn.clickFlash  = Math.max(0, mainBtn.clickFlash - 0.06);

  // Department auto-tick
  DEPT_ORDER.forEach(k => {
    const dept = state.departments[k];
    if (!dept.unlocked || !dept.auto) return;
    const maxCd = computeMaxCd(k, state.upgrades);
    if ((dept.timer || 0) > 0) {
      dept.timer--;
    } else {
      // Auto earn
      const earned = computeDeptEarn(k, dept, state.upgrades, state.prestigeMult);
      addGold(earned);
      dept.timer = maxCd;
      sceneAnims[k].active  = true;
      sceneAnims[k].activeT = 0;
      // Spawn auto-earn particles in float layer
      const cx = LW() / 2, cy = LH() / 2;
      spawnGoldBurst(cx + (Math.random()-0.5)*100, cy + (Math.random()-0.5)*60, 4);
    }
  });

  // Manual dept cooldowns
  DEPT_ORDER.forEach(k => {
    const dept = state.departments[k];
    if (!dept.auto && dept.unlocked) {
      if ((dept.timer || 0) > 0) dept.timer--;
    }
  });

  // Playtime
  if (frameCount % 60 === 0) {
    state.playtime++;
    state.stats.longestSession = Math.max(
      state.stats.longestSession,
      state.playtime
    );
  }

  // GPS recompute once per second
  if (frameCount % 60 === 0) {
    cachedGPS = computeGPS(state);
  }

  // Check unlocks + achievements once per second
  if (frameCount % 60 === 0) {
    checkAndUnlock();
    const newAch = checkAchievements(state);
    newAch.forEach(id => {
      unlockAchievementDOM(id);
      showAchievementPopup(id);
      showToast('🏅 Achievement: ' + ACHIEVEMENT_DEFS.find(a=>a.id===id)?.name);
    });
  }

  // Auto-save every 60 seconds
  if (frameCount % (60 * 60) === 0) saveState(state);

  // UI ticks
  tickUI(state, cachedGPS);
  if (frameCount % 60 === 0) {
    slowTickUI(state,
      (id) => buyUpgrade(id),
      (k)  => buyDeptLevel(k),
      ()   => doPrestige()
    );
  }
}

// ── GOLD / EARN ───────────────────────────────────
function addGold(amount) {
  state.gold         += amount;
  state.totalEarned  += amount;
  state.patients     += 1;
  state.stats.allTimeEarned += amount;
}

// ── CLICK HANDLER ─────────────────────────────────
function handleMainClick(e) {
  const rect = canvas.getBoundingClientRect();
  const mx   = e.clientX - rect.left;
  const my   = e.clientY - rect.top;
  const lw   = LW(), lh = LH();
  const cx   = lw / 2, cy = lh / 2;
  const r    = Math.min(lw, lh) * 0.2;

  // Check if click is on main button
  const dist = Math.hypot(mx - cx, my - cy);
  if (dist <= r) {
    const earned = Math.round(state.clickPower * state.prestigeMult);
    addGold(earned);
    state.totalClicks++;
    if (earned > state.bestClick) state.bestClick = earned;

    // Visual feedback
    mainBtn.targetScale = 0.92;
    mainBtn.clickFlash  = 1;
    spawnCanvasRipple(cx, cy);
    spawnGoldBurst(cx, cy - 30, 10);
    for (let i = 0; i < 3; i++) spawnHeart(cx + (Math.random()-0.5)*60, cy - 20);
    for (let i = 0; i < 2; i++) spawnStar(cx + (Math.random()-0.5)*80, cy - 10);

    // DOM float text
    spawnFloat(mx - 20, my - 20, '+' + fmt(earned) + 'g', '#fbbf24', '16px');
    spawnRipple(mx, my);

    updateTopBar(state, cachedGPS);
  }
}

// ── DEPT CLICK HANDLER ────────────────────────────
function handleDeptClick(k) {
  const dept = state.departments[k];
  if (!dept.unlocked) return;
  if ((dept.timer || 0) > 0) {
    showToast('⏳ ' + DEPT_DEFS[k].name + ' is cooling down...');
    return;
  }
  const earned = computeDeptEarn(k, dept, state.upgrades, state.prestigeMult);
  addGold(earned);
  state.totalClicks++;
  dept.timer = computeMaxCd(k, state.upgrades);
  sceneAnims[k].active  = true;
  sceneAnims[k].activeT = 0;

  // Particles
  const cx = LW()/2, cy = LH()/2;
  spawnGoldBurst(cx, cy - 40, 6);

  showToast(DEPT_DEFS[k].icon + ' ' + DEPT_DEFS[k].name + ': +' + fmt(earned) + 'g');
  updateTopBar(state, cachedGPS);
}

// ── UPGRADES ──────────────────────────────────────
function buyUpgrade(id) {
  const def       = getUpgradeDef(id);
  if (!def) return;
  const currentLv = state.upgrades[id] || 0;
  if (currentLv >= def.maxLv) return;
  const cost = computeUpgradeCost(id, currentLv);
  if (state.gold < cost) { showToast('💸 Not enough gold!'); return; }

  state.gold -= cost;
  state.upgrades[id] = currentLv + 1;
  def.apply(state);

  showToast('✅ ' + def.name + ' upgraded to Lv' + state.upgrades[id] + '!');
  spawnGoldBurst(LW()/2, LH()/2, 6);
}

function buyDeptLevel(k) {
  const dept = state.departments[k];
  const cost = computeDeptUpgradeCost(k, dept.lv);
  if (state.gold < cost) { showToast('💸 Not enough gold!'); return; }

  state.gold -= cost;
  dept.lv++;
  showToast('⬆ ' + DEPT_DEFS[k].name + ' upgraded to Lv' + dept.lv + '!');
}

// ── UNLOCK CHECK ──────────────────────────────────
function checkAndUnlock() {
  DEPT_ORDER.forEach(k => {
    const def  = DEPT_DEFS[k];
    const dept = state.departments[k];
    if (!dept.unlocked && state.totalEarned >= def.unlockAt) {
      dept.unlocked = true;
      showToast('🏥 ' + def.name + ' unlocked!');
    }
    if (!dept.auto && dept.unlocked && state.totalEarned >= def.autoAt) {
      dept.auto = true;
      dept.timer = 0;
      showToast('🤖 ' + def.name + ' is now automated!');
    }
  });
}

// ── PRESTIGE ──────────────────────────────────────
function doPrestige() {
  if (state.totalEarned < 10000) {
    showToast('⭐ Need 10,000 total earned to prestige.');
    return;
  }
  const mult = computePrestigeMult(state.prestige);
  state.prestige++;
  state.prestigeMult *= mult;
  state.stats.totalPrestige++;

  // Reset run-specific state
  state.gold        = 0;
  state.totalEarned = 0;
  state.totalClicks = 0;
  state.patients    = 0;
  state.clickPower  = 1;
  state.bestClick   = 0;

  // Reset upgrades (levels back to 0, re-apply none)
  Object.keys(state.upgrades).forEach(k => state.upgrades[k] = 0);

  // Reset departments
  DEPT_ORDER.forEach(k => {
    state.departments[k] = {
      lv: 1, unlocked: k === 'er', auto: false, timer: 0,
    };
  });

  frameCount = 0;  // reset scene cycle after prestige
  saveState(state);
  showToast('⭐ Prestige! Permanent ×' + mult.toFixed(2) + ' multiplier active!');

  // Rebuild UI from scratch
  initUI(state, makeCallbacks());
}

// ── INIT ──────────────────────────────────────────
function makeCallbacks() {
  return {
    getState:      () => state,
    onDeptClick:   (k)  => handleDeptClick(k),
    onPrestige:    ()   => doPrestige(),
    onBuyUpgrade:  (id) => buyUpgrade(id),
    onBuyDeptLevel:(k)  => buyDeptLevel(k),
    onSave:        ()   => saveState(state),
  };
}

function initGame() {
  resizeCanvas();
  state = loadState();

  // Init runtime timers on departments
  DEPT_ORDER.forEach(k => {
    if (!state.departments[k].timer) state.departments[k].timer = 0;
  });

  // Offline earnings
  const gps    = computeGPS(state);
  const offline = calcOfflineEarnings(state, gps);
  if (offline > 0) {
    const elapsed = Math.floor((Date.now() - state.lastSaved) / 1000);
    state.gold += offline;
    state.totalEarned += offline;
    state.stats.allTimeEarned += offline;
    showOfflineModal(offline, elapsed);
  }

  // Init UI
  initUI(state, makeCallbacks());

  // Canvas click
  canvas.addEventListener('click', handleMainClick);

  // Start loop
  running = true;
  loop();
}

// ── MAIN LOOP ─────────────────────────────────────
function loop() {
  if (!running) return;
  tick();
  render();
  requestAnimationFrame(loop);
}

// ── START ─────────────────────────────────────────
// Called after DOM is ready (from index.html)
window.addEventListener('DOMContentLoaded', initGame);
