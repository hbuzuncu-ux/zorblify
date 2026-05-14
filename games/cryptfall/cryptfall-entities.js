// ═══════════════════════════════════════════════════════════
// CRYPTFALL — ENTITIES
// Player, enemies, weapons, projectiles, particles, AI
// ═══════════════════════════════════════════════════════════

'use strict';

// ── PARTICLE SYSTEM ─────────────────────────────────────────
const particles = [];
const sparks    = [];
const floatTexts = [];

function spawnParticles(x, y, col, n, opts = {}) {
  for (let i = 0; i < n; i++) {
    const a   = Math.random() * Math.PI * 2;
    const spd = (opts.spd || 3) + Math.random() * (opts.spdVar || 3);
    particles.push({
      x, y,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd - (opts.upBias || 0.5),
      r:  (opts.r || 2) + Math.random() * (opts.rVar || 2),
      col,
      a: 1,
      dec: (opts.dec || 0.025) + Math.random() * 0.015,
      grav: opts.grav !== undefined ? opts.grav : 0.08,
    });
  }
}

function spawnBloodBurst(x, y, n = 16) {
  spawnParticles(x, y, `rgba(${160+Math.random()*40|0},${8+Math.random()*12|0},${8+Math.random()*8|0},1)`,
    n, { spd:4, spdVar:4, r:2, rVar:3, upBias:1, grav:0.12 });
  // extra large drops
  for (let i = 0; i < 4; i++) {
    const a = Math.random()*Math.PI*2, spd=2+Math.random()*4;
    particles.push({ x, y,
      vx:Math.cos(a)*spd, vy:Math.sin(a)*spd-2,
      r:4+Math.random()*4, col:'rgba(140,10,10,0.8)',
      a:1, dec:0.018, grav:0.1 });
  }
}

function spawnSparks(x, y, col, n = 12) {
  for (let i = 0; i < n; i++) {
    const a   = Math.random()*Math.PI*2;
    const spd = 2 + Math.random() * 5;
    sparks.push({ x, y,
      vx:Math.cos(a)*spd, vy:Math.sin(a)*spd,
      len:3+Math.random()*8, col,
      a:1, dec:0.07 });
  }
}

function spawnDust(x, y, n = 6) {
  spawnParticles(x, y, 'rgba(120,100,70,0.5)', n,
    { spd:1.5, spdVar:1, r:4, rVar:4, upBias:0.5, grav:0.02, dec:0.02 });
}

function spawnFloatText(x, y, text, col = '#f0c060', big = false) {
  floatTexts.push({ x, y, text, col, big, a:1, vy:-1.1, life: big ? 80 : 55 });
}

function updateParticles() {
  for (let i = particles.length-1; i >= 0; i--) {
    const p = particles[i];
    p.x  += p.vx; p.y  += p.vy;
    p.vy += p.grav; p.vx *= 0.97;
    p.a  -= p.dec;  p.r  *= 0.97;
    if (p.a <= 0) particles.splice(i, 1);
  }
  for (let i = sparks.length-1; i >= 0; i--) {
    const s = sparks[i];
    s.x += s.vx; s.y += s.vy;
    s.vx *= 0.88; s.vy *= 0.88;
    s.a  -= s.dec;
    if (s.a <= 0) sparks.splice(i, 1);
  }
  for (let i = floatTexts.length-1; i >= 0; i--) {
    const f = floatTexts[i];
    f.y += f.vy; f.a -= 1/f.life;
    if (f.a <= 0) floatTexts.splice(i, 1);
  }
}

function drawParticles() {
  particles.forEach(p => {
    ctx.globalAlpha = p.a;
    ctx.fillStyle   = p.col;
    ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.1, p.r), 0, Math.PI*2); ctx.fill();
  });
  sparks.forEach(s => {
    ctx.globalAlpha = s.a;
    ctx.strokeStyle = s.col; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x - s.vx/Math.abs(s.vx||1)*s.len, s.y - s.vy/Math.abs(s.vy||1)*s.len);
    ctx.stroke();
  });
  ctx.globalAlpha = 1;
}

function drawFloatTexts() {
  floatTexts.forEach(f => {
    ctx.globalAlpha = f.a;
    ctx.font = f.big ? 'bold 18px Arial' : 'bold 13px Arial';
    ctx.fillStyle = f.col; ctx.textAlign = 'center';
    ctx.shadowColor = f.col; ctx.shadowBlur = 8;
    ctx.fillText(f.text, f.x, f.y);
  });
  ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.textAlign = 'left';
}

// ── WEAPON DEFINITIONS ──────────────────────────────────────
const WEAPONS = {
  sword: {
    name: '⚔ Sword', key: 1,
    dmg: 28, range: 68, arc: Math.PI*.8, cooldown: 28,
    color: '#c0c8e0', glowColor: '#8899ff',
    knockback: 5,
    attackFn: (p, enemies, room) => swingAttack(p, enemies, room, WEAPONS.sword),
  },
  dagger: {
    name: '🗡 Dagger', key: 2,
    dmg: 14, range: 50, arc: Math.PI*.5, cooldown: 14,
    color: '#e0d0a0', glowColor: '#ffd060',
    knockback: 3, comboMax: 3,
    attackFn: (p, enemies, room) => swingAttack(p, enemies, room, WEAPONS.dagger),
  },
  bow: {
    name: '🏹 Bow', key: 3,
    dmg: 22, range: 400, arc: 0.18, cooldown: 40,
    color: '#80a060', glowColor: '#80ff60',
    knockback: 2,
    attackFn: (p, enemies, room) => fireArrow(p, room),
  },
};

// ── PROJECTILES ─────────────────────────────────────────────
const projectiles = [];

function fireArrow(player, room) {
  const ang = player.aimAngle;
  SFX.arrow();
  projectiles.push({
    x: player.x, y: player.y,
    vx: Math.cos(ang) * 9, vy: Math.sin(ang) * 9,
    dmg: WEAPONS.bow.dmg + (player.upgrades.dmgBoost || 0),
    r: 5,
    angle: ang,
    life: 90,
    owner: 'player',
    col: '#a0e060',
    piercing: player.upgrades.piercingArrows || false,
    hitIds: new Set(),
  });
  spawnParticles(player.x, player.y, '#a0e060', 5, {spd:2,upBias:0,grav:0.02,dec:0.06});
}

function fireEnemyProjectile(e, targetX, targetY, dmg, col) {
  const ang = Math.atan2(targetY - e.y, targetX - e.x);
  const spd = 4.5;
  projectiles.push({
    x: e.x, y: e.y,
    vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
    dmg, r: 6, angle: ang, life: 100,
    owner: 'enemy', col,
    hitIds: new Set(),
  });
  spawnSparks(e.x, e.y, col, 8);
}

function updateProjectiles(room, player) {
  for (let i = projectiles.length-1; i >= 0; i--) {
    const p = projectiles[i];
    p.x += p.vx; p.y += p.vy;
    p.life--;

    // Wall collision
    if (collidesWithWalls(room, p.x, p.y, p.r)) {
      spawnSparks(p.x, p.y, p.col, 8);
      spawnParticles(p.x, p.y, p.col, 5, {spd:2,grav:0.05,dec:0.06});
      projectiles.splice(i, 1); continue;
    }
    if (p.life <= 0) { projectiles.splice(i, 1); continue; }

    // Player hit (enemy projectile)
    if (p.owner === 'enemy') {
      if (!player.invincible && Math.hypot(player.x-p.x, player.y-p.y) < player.r + p.r) {
        damagePlayer(player, p.dmg, p.x, p.y);
        spawnBloodBurst(player.x, player.y, 10);
        if (!p.piercing) { projectiles.splice(i, 1); continue; }
      }
    }
    // Enemy hit (player projectile)
    if (p.owner === 'player') {
      for (const e of enemies) {
        if (e.dead || p.hitIds.has(e.id)) continue;
        if (Math.hypot(e.x-p.x, e.y-p.y) < e.r + p.r) {
          applyDamageToEnemy(e, p.dmg, p.x, p.y, player);
          p.hitIds.add(e.id);
          spawnSparks(p.x, p.y, p.col, 10);
          if (!p.piercing) { projectiles.splice(i, 1); break; }
        }
      }
    }
  }
}

function drawProjectiles() {
  projectiles.forEach(p => {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle);
    ctx.shadowColor = p.col; ctx.shadowBlur = 10;
    if (p.owner === 'player') {
      // Arrow shaft
      ctx.strokeStyle = '#806040'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-14,0); ctx.lineTo(10,0); ctx.stroke();
      // Arrowhead
      ctx.fillStyle = p.col;
      ctx.beginPath(); ctx.moveTo(10,0); ctx.lineTo(4,-3); ctx.lineTo(4,3); ctx.closePath(); ctx.fill();
      // Feathers
      ctx.fillStyle = '#c0a060';
      ctx.beginPath(); ctx.moveTo(-14,0); ctx.lineTo(-10,-4); ctx.lineTo(-8,0); ctx.closePath(); ctx.fill();
    } else {
      // Magic orb
      const g = ctx.createRadialGradient(0,0,1,0,0,p.r);
      g.addColorStop(0,'rgba(255,255,255,0.9)');
      g.addColorStop(0.4, p.col);
      g.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0,0,p.r,0,Math.PI*2); ctx.fill();
    }
    ctx.shadowBlur = 0; ctx.restore();
  });
}

// ── SWING ATTACK ────────────────────────────────────────────
function swingAttack(player, enemies, room, wDef) {
  const ang = player.aimAngle;
  const halfArc = wDef.arc / 2;
  let hit = false;

  enemies.forEach(e => {
    if (e.dead) return;
    const dist = Math.hypot(player.x - e.x, player.y - e.y);
    if (dist > wDef.range + e.r) return;
    const eAng = Math.atan2(e.y - player.y, e.x - player.x);
    let diff = eAng - ang;
    while (diff >  Math.PI) diff -= Math.PI*2;
    while (diff < -Math.PI) diff += Math.PI*2;
    if (Math.abs(diff) > halfArc) return;

    applyDamageToEnemy(e, wDef.dmg, player.x, player.y, player);
    hit = true;
  });

  // Swing arc visual
  player.swingArc = { ang, arc: wDef.arc, range: wDef.range,
    col: wDef.glowColor, life: 8, maxLife: 8 };

  if (hit) {
    triggerHitFreeze(wDef === WEAPONS.dagger ? 2 : 4);
    camera.shake(wDef === WEAPONS.dagger ? 3 : 6);
  }
  if (wDef === WEAPONS.sword) SFX.sword();
  else SFX.dagger();
}

// ── PLAYER ──────────────────────────────────────────────────
function createPlayer(room) {
  // Spawn in center of room
  const sx = room.w * TILE / 2;
  const sy = room.h * TILE / 2;
  return {
    x: sx, y: sy,
    r: 16,
    vx: 0, vy: 0,
    hp: 100, maxHp: 100,
    armor: 40, maxArmor: 60,
    speed: 3.2,
    weapons: ['sword','dagger','bow'],
    activeWeapon: 0,
    attackCd: 0,
    dodgeCd: 0,
    dodging: false,
    dodgeVx: 0, dodgeVy: 0,
    dodgeFrames: 0,
    invincible: 0,
    aimAngle: 0,
    trail: [],
    comboCount: 0,
    comboTimer: 0,
    swingArc: null,
    runes: 0,
    gold: 0,
    kills: 0,
    // upgrades object
    upgrades: {
      dmgBoost: 0,
      speedBoost: 0,
      hpRegen: 0,
      piercingArrows: false,
      extraDodge: false,
      lifesteal: false,
      aoe: false,
    },
    regenTimer: 0,
  };
}

function updatePlayer(player, room, input, dt) {
  if (hitFreezeFrames > 0) { hitFreezeFrames--; return; }

  // Aim
  const sc = camera.toScreen(player.x, player.y);
  player.aimAngle = Math.atan2(input.mouseY - sc.sy, input.mouseX - sc.sx);

  // Regen (if upgrade)
  if (player.upgrades.hpRegen > 0) {
    player.regenTimer++;
    if (player.regenTimer >= 180) {
      player.regenTimer = 0;
      player.hp = Math.min(player.maxHp, player.hp + player.upgrades.hpRegen);
      updateHUD(player);
    }
  }

  // Dodge roll
  if (player.dodging) {
    player.dodgeFrames--;
    player.x += player.dodgeVx;
    player.y += player.dodgeVy;
    if (player.dodgeFrames <= 0) {
      player.dodging  = false;
      player.invincible = 6;
    }
    spawnDust(player.x - player.dodgeVx * 3, player.y - player.dodgeVy * 3, 3);
    // Resolve after dodge
    const res = slideResolve(room, player.x - player.dodgeVx, player.y - player.dodgeVy,
                              player.x, player.y, player.r);
    player.x = res.x; player.y = res.y;
    player.trail.push({x:player.x, y:player.y, a:0.7});
    if (player.trail.length > 10) player.trail.shift();
    if (player.invincible > 0) player.invincible--;
    if (player.attackCd > 0) player.attackCd--;
    if (player.dodgeCd   > 0) player.dodgeCd--;
    if (player.comboTimer > 0) { player.comboTimer--; if (!player.comboTimer) player.comboCount = 0; }
    return;
  }

  // Normal movement
  let dx = 0, dy = 0;
  if (input.left)  dx -= 1;
  if (input.right) dx += 1;
  if (input.up)    dy -= 1;
  if (input.down)  dy += 1;
  if (dx && dy) { dx *= 0.707; dy *= 0.707; }

  const spd = player.speed + (player.upgrades.speedBoost || 0);
  player.vx += (dx * spd - player.vx) * 0.2;
  player.vy += (dy * spd - player.vy) * 0.2;

  const nx = player.x + player.vx;
  const ny = player.y + player.vy;
  const res = slideResolve(room, player.x, player.y, nx, ny, player.r);
  player.x = res.x; player.y = res.y;

  // Trail
  if (dx || dy) {
    player.trail.push({x:player.x, y:player.y, a:0.5});
    if (player.trail.length > 14) player.trail.shift();
    // footstep sound occasionally
    if (Math.floor(Date.now()/250) !== player._lastStep) {
      player._lastStep = Math.floor(Date.now()/250);
      SFX.footstep();
    }
  }

  // Cooldowns
  if (player.attackCd > 0) player.attackCd--;
  if (player.dodgeCd   > 0) player.dodgeCd--;
  if (player.invincible > 0) player.invincible--;
  if (player.comboTimer > 0) { player.comboTimer--; if (!player.comboTimer) player.comboCount = 0; }
  if (player.swingArc)       { player.swingArc.life--; if (player.swingArc.life <= 0) player.swingArc = null; }

  // Initiate dodge
  if (input.dodge && player.dodgeCd <= 0) {
    let ddx = dx, ddy = dy;
    if (!ddx && !ddy) ddx = Math.cos(player.aimAngle), ddy = Math.sin(player.aimAngle);
    if (ddx || ddy) {
      const m = Math.hypot(ddx, ddy);
      player.dodgeVx = (ddx/m) * 8;
      player.dodgeVy = (ddy/m) * 8;
      player.dodging = true;
      player.dodgeFrames = 10;
      player.invincible = 14;
      player.dodgeCd = player.upgrades.extraDodge ? 28 : 40;
      SFX.dodge();
      spawnDust(player.x, player.y, 8);
      input.dodge = false;
    }
  }

  // Attack
  if (input.attack && player.attackCd <= 0) {
    const wKey = player.weapons[player.activeWeapon];
    const wDef = WEAPONS[wKey];
    player.attackCd = wDef.cooldown;
    player.comboCount++;
    player.comboTimer = 60;
    wDef.attackFn(player, enemies, room);
    input.attack = false;
  }
}

function drawPlayer(player, frameCount) {
  const { x, y, r, invincible, dodging, aimAngle, swingArc, trail } = player;

  // Dodge trail
  trail.forEach((t, i) => {
    ctx.globalAlpha = (i/trail.length) * (dodging ? 0.5 : 0.2);
    ctx.fillStyle = dodging ? '#06b6d4' : '#7c3aed';
    ctx.beginPath(); ctx.arc(t.x, t.y, r * (i/trail.length) * 0.8, 0, Math.PI*2); ctx.fill();
  });
  ctx.globalAlpha = 1;

  // Blink on invincible
  if (invincible > 0 && Math.floor(invincible/5) % 2 === 1) return;

  // Swing arc
  if (swingArc) {
    const t = swingArc.life / swingArc.maxLife;
    ctx.save();
    ctx.globalAlpha = t * 0.45;
    ctx.fillStyle = swingArc.col;
    ctx.shadowColor = swingArc.col; ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, swingArc.range * (1.1 - t*0.1),
      swingArc.ang - swingArc.arc/2,
      swingArc.ang + swingArc.arc/2);
    ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0; ctx.restore();
  }

  // Combo aura
  if (player.comboCount >= 2) {
    const aCol = player.comboCount >= 4 ? 'rgba(240,192,96,' : 'rgba(124,58,237,';
    const ag = ctx.createRadialGradient(x,y,r,x,y,r+12+player.comboCount*3);
    ag.addColorStop(0, aCol + '0.35)'); ag.addColorStop(1, aCol + '0)');
    ctx.fillStyle = ag; ctx.beginPath(); ctx.arc(x,y,r+12+player.comboCount*3,0,Math.PI*2); ctx.fill();
  }

  // Shadow beneath
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath(); ctx.ellipse(x, y+r*.8, r*.65, r*.2, 0, 0, Math.PI*2); ctx.fill();

  // Body — layered radial
  ctx.shadowColor = '#7c3aed'; ctx.shadowBlur = 18;
  const pg = ctx.createRadialGradient(x-5, y-5, 2, x, y, r);
  pg.addColorStop(0, 'rgba(220,200,255,0.98)');
  pg.addColorStop(0.4, 'rgba(124,58,237,0.95)');
  pg.addColorStop(1,   'rgba(30,0,80,0.92)');
  ctx.fillStyle = pg;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();
  ctx.shadowBlur = 0;

  // Cloak edge
  ctx.strokeStyle = 'rgba(167,139,250,0.6)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.stroke();

  // Inner spinning ring
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(x, y, r*.58, 0, Math.PI*2); ctx.stroke();

  // 4 orbiting energy nodes
  for (let i=0; i<4; i++) {
    const a = frameCount * 0.05 + i/4 * Math.PI*2;
    const ex = x + Math.cos(a)*r*.52, ey = y + Math.sin(a)*r*.52;
    ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.shadowColor = '#fff'; ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.arc(ex, ey, 2.5, 0, Math.PI*2); ctx.fill();
  }
  ctx.shadowBlur = 0;

  // Center gem
  ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.shadowColor='#fff'; ctx.shadowBlur=14;
  ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI*2); ctx.fill();
  ctx.shadowBlur = 0;

  // Weapon visual (held at hand)
  drawHeldWeapon(player, frameCount);

  // Aim direction indicator
  ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1.5;
  ctx.setLineDash([3,5]);
  ctx.beginPath();
  ctx.moveTo(x + Math.cos(aimAngle)*r, y + Math.sin(aimAngle)*r);
  ctx.lineTo(x + Math.cos(aimAngle)*(r+14), y + Math.sin(aimAngle)*(r+14));
  ctx.stroke(); ctx.setLineDash([]);
}

function drawHeldWeapon(player, frameCount) {
  const { x, y, r, aimAngle, activeWeapon, weapons } = player;
  const wKey = weapons[activeWeapon];
  const handX = x + Math.cos(aimAngle) * (r+6);
  const handY = y + Math.sin(aimAngle) * (r+6);
  ctx.save(); ctx.translate(handX, handY); ctx.rotate(aimAngle);

  if (wKey === 'sword') {
    ctx.shadowColor = '#8899ff'; ctx.shadowBlur = 10;
    // Blade
    ctx.strokeStyle = '#c0c8e0'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(28,0); ctx.stroke();
    // Edge shine
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(2,-1); ctx.lineTo(26,-1); ctx.stroke();
    // Guard
    ctx.fillStyle = '#8899cc';
    ctx.fillRect(-4,-5,5,10);
    // Handle
    ctx.strokeStyle = '#804020'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-4,0); ctx.lineTo(-14,0); ctx.stroke();
  } else if (wKey === 'dagger') {
    ctx.shadowColor = '#ffd060'; ctx.shadowBlur = 8;
    ctx.strokeStyle = '#e0d0a0'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(18,0); ctx.stroke();
    ctx.fillStyle = '#e0d0a0';
    ctx.beginPath(); ctx.moveTo(18,0); ctx.lineTo(12,-3); ctx.lineTo(12,3); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#806030'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-2,0); ctx.lineTo(-10,0); ctx.stroke();
    ctx.fillStyle = '#a06020'; ctx.fillRect(-4,-3.5,4,7);
  } else if (wKey === 'bow') {
    ctx.shadowColor = '#80ff60'; ctx.shadowBlur = 8;
    ctx.strokeStyle = '#806040'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(4, 0, 12, -Math.PI*.6, Math.PI*.6); ctx.stroke();
    ctx.strokeStyle = 'rgba(180,220,100,0.7)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(4,-11); ctx.lineTo(4,11); ctx.stroke();
    // Arrow nocked
    ctx.strokeStyle = '#a0e060'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-2,0); ctx.lineTo(14,0); ctx.stroke();
  }
  ctx.shadowBlur = 0; ctx.restore();
}

// ── ENEMY DEFINITIONS ───────────────────────────────────────
const ENEMY_DEFS = {
  skeleton: {
    hp: 35, maxHp: 35, r: 16, spd: 1.4,
    dmg: 12, reward: 15, color: '#c8c0a8',
    attackRange: 32, attackCd: 60, sightRange: 280,
    patrolSpd: 0.6,
  },
  armored: {
    hp: 75, maxHp: 75, r: 20, spd: 1.0,
    dmg: 20, reward: 30, color: '#8090a8',
    attackRange: 36, attackCd: 80, sightRange: 240,
    frontShield: true, patrolSpd: 0.5,
  },
  mage: {
    hp: 45, maxHp: 45, r: 15, spd: 1.2,
    dmg: 18, reward: 25, color: '#b060e0',
    attackRange: 240, attackCd: 90, sightRange: 320,
    ranged: true, patrolSpd: 0.7,
    projColor: '#c080ff',
  },
  golem: {  // BOSS
    hp: 260, maxHp: 260, r: 36, spd: 0.7,
    dmg: 30, reward: 120, color: '#806040',
    attackRange: 55, attackCd: 100, sightRange: 500,
    boss: true, patrolSpd: 0.4,
    phase2Threshold: 0.4,
  },
};

let enemies = [];
let enemyIdCounter = 0;

function spawnEnemies(room) {
  enemies = [];
  room.enemies.forEach(def => {
    const eDef = ENEMY_DEFS[def.type];
    enemies.push({
      ...eDef,
      id: enemyIdCounter++,
      type: def.type,
      x: def.rx * TILE + TILE/2,
      y: def.ry * TILE + TILE/2,
      vx: 0, vy: 0,
      angle: Math.random() * Math.PI*2,
      rotSpd: (Math.random()-.5)*.04,
      hp: eDef.hp,
      attackCdLeft: 0,
      state: 'patrol',   // patrol | alert | attack | stunned | dead
      stateTimer: 0,
      patrolAngle: Math.random() * Math.PI*2,
      patrolTimer: 0,
      trail: [],
      hitFlash: 0,
      phase2: false,
      alertAnim: 0,
      dead: false,
    });
  });
}

function updateEnemies(enemies, room, player, frameCount) {
  enemies.forEach(e => {
    if (e.dead) return;

    e.angle  += e.rotSpd;
    e.hitFlash = Math.max(0, e.hitFlash - 1);
    if (e.attackCdLeft > 0) e.attackCdLeft--;

    const distToPlayer = Math.hypot(player.x - e.x, player.y - e.y);
    const angToPlayer  = Math.atan2(player.y - e.y, player.x - e.x);

    // State machine
    switch (e.state) {
      case 'patrol': {
        // Wander
        e.patrolTimer++;
        if (e.patrolTimer > 80 + Math.random()*60) {
          e.patrolAngle = Math.random() * Math.PI*2;
          e.patrolTimer = 0;
        }
        const pvx = Math.cos(e.patrolAngle) * e.patrolSpd;
        const pvy = Math.sin(e.patrolAngle) * e.patrolSpd;
        const pr = slideResolve(room, e.x, e.y, e.x+pvx, e.y+pvy, e.r);
        e.x = pr.x; e.y = pr.y;
        if (pr.x === e.x - pvx || pr.y === e.y - pvy) e.patrolAngle += Math.PI*.7;

        if (distToPlayer < e.sightRange) {
          e.state = 'alert'; e.alertAnim = 40; e.stateTimer = 40;
        }
        break;
      }
      case 'alert': {
        e.alertAnim--;
        if (e.alertAnim <= 0) e.state = 'attack';
        break;
      }
      case 'attack': {
        if (distToPlayer > e.sightRange * 1.3) { e.state = 'patrol'; break; }

        if (e.ranged) {
          // Mage: keep distance, shoot
          const idealDist = 180;
          const movDir = distToPlayer > idealDist ? 1 : -1;
          const mvx = Math.cos(angToPlayer)*e.spd*movDir;
          const mvy = Math.sin(angToPlayer)*e.spd*movDir;
          const mr = slideResolve(room, e.x, e.y, e.x+mvx, e.y+mvy, e.r);
          e.x = mr.x; e.y = mr.y;

          if (e.attackCdLeft <= 0) {
            fireEnemyProjectile(e, player.x, player.y, e.dmg, e.projColor);
            e.attackCdLeft = e.attackCd;
            // Mage teleport (if upgrade phase)
            if (e.hp < e.maxHp * 0.5 && Math.random() < 0.3) {
              // Pick a random floor tile to teleport to
              teleportToRandomFloor(e, room);
              spawnParticles(e.x, e.y, e.projColor, 14, {spd:3,dec:0.04});
            }
          }
        } else {
          // Melee: chase
          const mvx = Math.cos(angToPlayer)*e.spd;
          const mvy = Math.sin(angToPlayer)*e.spd;

          // Armored: can't be hit from front
          if (e.frontShield) {
            const shieldAng = Math.atan2(player.y-e.y, player.x-e.x);
            e._shieldAng = shieldAng;
          }

          // Boss phase 2 — faster, ground slam
          if (e.boss && !e.phase2 && e.hp < e.maxHp * e.phase2Threshold) {
            e.phase2 = true; e.spd *= 1.5; e.dmg = Math.round(e.dmg * 1.4);
            SFX.boss();
            spawnFloatText(e.x, e.y-60, 'PHASE 2!', '#f87171', true);
            camera.shake(16, 30);
            for (let i=0;i<3;i++) spawnBloodBurst(e.x + (Math.random()-.5)*80, e.y + (Math.random()-.5)*80, 14);
          }

          const mr = slideResolve(room, e.x, e.y, e.x+mvx, e.y+mvy, e.r);
          e.x = mr.x; e.y = mr.y;

          if (distToPlayer < e.attackRange + player.r && e.attackCdLeft <= 0) {
            // Melee strike
            if (!player.invincible) {
              // Armored front shield blocks
              if (e.frontShield && e._shieldAng !== undefined) {
                const attackAng = Math.atan2(player.y-e.y, player.x-e.x);
                const diff = Math.abs(normalizeAngle(attackAng - e._shieldAng));
                if (diff < Math.PI * 0.45) {
                  // blocked
                  spawnSparks(e.x, e.y, '#8090a8', 8);
                  e.attackCdLeft = e.attackCd;
                  return;
                }
              }
              damagePlayer(player, e.dmg, e.x, e.y);
              const kb = Math.atan2(player.y-e.y, player.x-e.x);
              player.vx += Math.cos(kb)*8; player.vy += Math.sin(kb)*8;
            }
            e.attackCdLeft = e.attackCd;

            // Boss ground slam AOE
            if (e.boss && distToPlayer < 70) {
              camera.shake(12, 20);
              spawnDust(e.x, e.y, 20);
              spawnSparks(e.x, e.y, '#f0c060', 16);
            }
          }
        }
        break;
      }
      case 'stunned': {
        e.stateTimer--;
        e.vx *= 0.7; e.vy *= 0.7;
        e.x += e.vx; e.y += e.vy;
        if (e.stateTimer <= 0) e.state = 'attack';
        break;
      }
    }

    // Trail
    e.trail.push({x:e.x, y:e.y});
    if (e.trail.length > 8) e.trail.shift();
  });
}

function teleportToRandomFloor(e, room) {
  for (let attempt=0; attempt<30; attempt++) {
    const tx = 1 + Math.floor(Math.random()*(room.w-2));
    const ty = 1 + Math.floor(Math.random()*(room.h-2));
    if (room.grid[ty][tx] === T.FLOOR) {
      e.x = tx*TILE + TILE/2;
      e.y = ty*TILE + TILE/2;
      break;
    }
  }
}

function applyDamageToEnemy(e, dmg, srcX, srcY, player) {
  if (e.dead) return;

  // Lifesteal
  if (player.upgrades.lifesteal) {
    player.hp = Math.min(player.maxHp, player.hp + Math.round(dmg * 0.08));
    updateHUD(player);
  }

  e.hp -= dmg;
  e.hitFlash = 12;

  const kb = Math.atan2(e.y - srcY, e.x - srcX);
  e.vx += Math.cos(kb) * 5; e.vy += Math.sin(kb) * 5;
  e.state = 'stunned'; e.stateTimer = 12;

  SFX.hit(Math.hypot(e.x - player.x, e.y - player.y));
  spawnBloodBurst(e.x, e.y, 10);
  spawnFloatText(e.x, e.y-30, `-${dmg}`, '#f87171');

  if (e.hp <= 0) killEnemy(e, player);
}

function killEnemy(e, player) {
  e.dead = true;
  player.gold  += e.reward;
  player.kills += 1;
  spawnBloodBurst(e.x, e.y, 22);
  spawnSparks(e.x, e.y, e.color, 18);
  spawnDust(e.x, e.y, 10);
  spawnFloatText(e.x, e.y-40, `+${e.reward}g`, '#f0c060', e.boss);
  if (e.boss) {
    SFX.boss();
    camera.shake(20, 40);
    spawnFloatText(e.x, e.y-80, 'GOLEM SLAIN!', '#f0c060', true);
    for (let i=0;i<5;i++) {
      setTimeout(()=>{
        spawnBloodBurst(e.x+(Math.random()-.5)*120, e.y+(Math.random()-.5)*120, 18);
        spawnSparks(e.x, e.y, '#f0c060', 20);
      }, i*120);
    }
  }
  updateHUD(player);
}

function damagePlayer(player, dmg, srcX, srcY) {
  if (player.invincible) return;
  // Armor absorbs first
  let remaining = dmg;
  if (player.armor > 0) {
    const block = Math.min(player.armor, remaining * 0.6);
    player.armor = Math.max(0, player.armor - block * 2);
    remaining -= block;
    spawnSparks(player.x, player.y, '#3b82f6', 10);
  }
  player.hp -= Math.round(remaining);
  player.invincible = 55;
  camera.shake(8, 14);
  SFX.hit(0);
  updateHUD(player);
  if (player.hp <= 0) { player.hp = 0; triggerDeath(); }
}

function drawEnemies(enemies, frameCount) {
  enemies.forEach(e => {
    if (e.dead) return;

    // Trail
    e.trail.forEach((t,i) => {
      ctx.globalAlpha = (i/e.trail.length) * 0.12;
      ctx.fillStyle = e.color;
      ctx.beginPath(); ctx.arc(t.x, t.y, e.r*.5, 0, Math.PI*2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    ctx.save(); ctx.translate(e.x, e.y);

    // Alert bubble
    if (e.state === 'alert' && e.alertAnim > 20) {
      ctx.fillStyle = '#f0c060'; ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.shadowColor = '#f0c060'; ctx.shadowBlur = 8;
      ctx.fillText('!', 0, -e.r - 6);
      ctx.shadowBlur = 0;
    }

    const flash = e.hitFlash > 0 && Math.floor(e.hitFlash/3)%2 === 1;
    ctx.globalAlpha = flash ? 1 : 0.95;
    ctx.rotate(e.angle);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(0, e.r*.7, e.r*.65, e.r*.2, 0, 0, Math.PI*2); ctx.fill();

    if (e.type === 'skeleton') drawSkeleton(ctx, e, flash, frameCount);
    else if (e.type === 'armored') drawArmored(ctx, e, flash, frameCount);
    else if (e.type === 'mage')    drawMage(ctx, e, flash, frameCount);
    else if (e.type === 'golem')   drawGolem(ctx, e, flash, frameCount);

    ctx.globalAlpha = 1; ctx.restore();

    // HP bar (always upright)
    const bw = e.r*2.8, bh = 5;
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath(); ctx.roundRect(e.x-bw/2, e.y-e.r-14, bw, bh, 2); ctx.fill();
    const hpPct = e.hp/e.maxHp;
    ctx.fillStyle = hpPct > 0.5 ? '#4ade80' : hpPct > 0.25 ? '#fbbf24' : '#f87171';
    ctx.beginPath(); ctx.roundRect(e.x-bw/2, e.y-e.r-14, bw*hpPct, bh, 2); ctx.fill();
    if (e.boss) {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = '9px Arial'; ctx.textAlign='center';
      ctx.fillText('GOLEM', e.x, e.y-e.r-17);
    }
  });
}

function drawSkeleton(ctx, e, flash, frameCount) {
  ctx.shadowColor = flash ? '#fff' : '#c8c0a8';
  ctx.shadowBlur  = flash ? 16 : 8;
  // Ribcage body
  ctx.fillStyle = flash ? '#fff' : '#2a2820';
  ctx.strokeStyle = flash ? '#fff' : '#c8c0a8';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(0, 0, e.r*.55, e.r*.7, 0, 0, Math.PI*2); ctx.fill(); ctx.stroke();
  // Ribs
  ctx.strokeStyle = flash ? 'rgba(255,255,255,0.7)' : 'rgba(200,192,168,0.5)';
  ctx.lineWidth = 1;
  [-e.r*.25, 0, e.r*.25].forEach(y => {
    ctx.beginPath(); ctx.moveTo(-e.r*.42, y); ctx.lineTo(e.r*.42, y); ctx.stroke();
  });
  // Skull
  ctx.fillStyle = flash ? '#fff' : '#d8d0b8';
  ctx.strokeStyle = flash ? '#fff' : '#c8c0a8';
  ctx.lineWidth = 1.5; ctx.shadowBlur = flash?16:4;
  ctx.beginPath(); ctx.arc(0, -e.r*.7, e.r*.42, 0, Math.PI*2); ctx.fill(); ctx.stroke();
  // Eye sockets
  ctx.fillStyle = flash ? 'rgba(255,200,0,0.9)' : 'rgba(80,160,255,0.8)';
  ctx.shadowColor = flash ? '#ff0' : '#4080ff'; ctx.shadowBlur = 6;
  [-e.r*.14, e.r*.14].forEach(ox=>{
    ctx.beginPath(); ctx.arc(ox, -e.r*.72, e.r*.1, 0, Math.PI*2); ctx.fill();
  });
  ctx.shadowBlur = 0;
}

function drawArmored(ctx, e, flash, frameCount) {
  ctx.shadowColor = flash ? '#fff' : '#607090'; ctx.shadowBlur = flash?16:10;
  // Armor body
  const ag = ctx.createLinearGradient(-e.r, -e.r, e.r, e.r);
  ag.addColorStop(0, flash?'#fff':'#5060708');
  ag.addColorStop(0.4, flash?'#eee':'#687080');
  ag.addColorStop(1,   flash?'#ccc':'#404858');
  ctx.fillStyle = flash ? '#fff' : ag;
  ctx.strokeStyle = flash ? '#fff' : '#8090a8'; ctx.lineWidth = 2;
  ctx.beginPath();
  for (let k=0;k<6;k++){const a=k/6*Math.PI*2;k?ctx.lineTo(Math.cos(a)*e.r,Math.sin(a)*e.r):ctx.moveTo(Math.cos(a)*e.r,Math.sin(a)*e.r);}
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // Inner plating
  ctx.strokeStyle='rgba(255,255,255,0.15)'; ctx.lineWidth=1.5;
  ctx.beginPath();
  for (let k=0;k<6;k++){const a=k/6*Math.PI*2;k?ctx.lineTo(Math.cos(a)*e.r*.6,Math.sin(a)*e.r*.6):ctx.moveTo(Math.cos(a)*e.r*.6,Math.sin(a)*e.r*.6);}
  ctx.closePath(); ctx.stroke();
  // Helmet slit
  ctx.fillStyle=flash?'rgba(255,200,0,0.8)':'rgba(100,180,255,0.6)';
  ctx.shadowColor=flash?'#ff0':'#60b0ff'; ctx.shadowBlur=8;
  ctx.fillRect(-e.r*.25, -e.r*.18, e.r*.5, e.r*.1);
  // Front shield indicator
  if (e._shieldAng !== undefined) {
    const sa = e._shieldAng - e.angle;
    ctx.strokeStyle = 'rgba(150,170,200,0.7)'; ctx.lineWidth=4;
    ctx.shadowColor='#8090a8'; ctx.shadowBlur=10;
    ctx.beginPath(); ctx.arc(0,0,e.r+8, sa-Math.PI*.4, sa+Math.PI*.4); ctx.stroke();
  }
  ctx.shadowBlur=0;
}

function drawMage(ctx, e, flash, frameCount) {
  ctx.shadowColor = flash?'#fff':'#b060e0'; ctx.shadowBlur=flash?18:14;
  // Robe
  ctx.fillStyle = flash?'#fff':'#1a0828';
  ctx.strokeStyle = flash?'#fff':'#b060e0'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.arc(0,0,e.r,0,Math.PI*2); ctx.fill(); ctx.stroke();
  // Pulsing inner glow
  const pulse = Math.sin(frameCount*.08)*0.4+0.6;
  ctx.fillStyle=`rgba(${flash?255:180},${flash?255:90},${flash?255:240},${pulse*.4})`;
  ctx.beginPath(); ctx.arc(0,0,e.r*.6,0,Math.PI*2); ctx.fill();
  // Staff
  ctx.strokeStyle=flash?'#fff':'#806040'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(e.r*.3,-e.r*.8); ctx.lineTo(e.r*.3,e.r*.8); ctx.stroke();
  ctx.fillStyle=flash?'#ff0':'#e060ff'; ctx.shadowColor=flash?'#ff0':'#e060ff'; ctx.shadowBlur=12;
  ctx.beginPath(); ctx.arc(e.r*.3,-e.r*.8, 5,0,Math.PI*2); ctx.fill();
  // Eyes
  ctx.fillStyle=flash?'rgba(255,200,0,1)':'rgba(220,100,255,0.9)';
  ctx.shadowBlur=8;
  [-e.r*.2, e.r*.2].forEach(ox=>{
    ctx.beginPath(); ctx.arc(ox,-e.r*.15, e.r*.12,0,Math.PI*2); ctx.fill();
  });
  ctx.shadowBlur=0;
}

function drawGolem(ctx, e, flash, frameCount) {
  ctx.shadowColor = flash?'#fff':(e.phase2?'#f87171':'#f0c060');
  ctx.shadowBlur  = flash?22:(e.phase2?20:14);
  // Stone body
  const gg=ctx.createRadialGradient(-e.r*.3,-e.r*.3,5,0,0,e.r);
  gg.addColorStop(0, flash?'#fff':(e.phase2?'#5a2020':'#4a3820'));
  gg.addColorStop(.5, flash?'#eee':(e.phase2?'#3a1818':'#3a2818'));
  gg.addColorStop(1, flash?'#ccc':'#201808');
  ctx.fillStyle=flash?'#fff':gg;
  ctx.strokeStyle=flash?'#fff':(e.phase2?'#f87171':'#f0c060'); ctx.lineWidth=3;
  ctx.beginPath(); ctx.arc(0,0,e.r,0,Math.PI*2); ctx.fill(); ctx.stroke();
  // Phase 2 cracks
  if (e.phase2 && !flash) {
    ctx.strokeStyle='rgba(248,113,113,0.4)'; ctx.lineWidth=2;
    [[8,-20,22,-8],[- 15,10,-5,25],[-8,-8,-20,8]].forEach(([x1,y1,x2,y2])=>{
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    });
  }
  // Outer ring
  ctx.strokeStyle=flash?'rgba(255,255,255,0.4)':(e.phase2?'rgba(248,113,113,0.3)':'rgba(240,192,96,0.25)');
  ctx.lineWidth=2;
  ctx.beginPath(); ctx.arc(0,0,e.r*1.3,0,Math.PI*2); ctx.stroke();
  ctx.beginPath(); ctx.arc(0,0,e.r*1.6,0,Math.PI*2); ctx.stroke();
  // Core gem
  const cPulse=Math.sin(frameCount*.06)*0.5+0.5;
  ctx.fillStyle=flash?'#fff':(e.phase2?`rgba(248,113,113,${0.7+cPulse*.3})`:`rgba(240,192,96,${0.7+cPulse*.3})`);
  ctx.shadowBlur=16+cPulse*10;
  ctx.beginPath(); ctx.arc(0,0,e.r*.3,0,Math.PI*2); ctx.fill();
  // Orbiting stones
  for (let k=0;k<(e.phase2?5:3);k++){
    const a=frameCount*.04+k/3*Math.PI*2*(e.phase2?1:-1);
    const orR=e.r*.9+Math.sin(frameCount*.1+k)*4;
    ctx.fillStyle=flash?'#fff':(e.phase2?'#f87171':'#c9a84c');
    ctx.shadowBlur=8;
    ctx.beginPath(); ctx.arc(Math.cos(a)*orR, Math.sin(a)*orR, 5+k%2*2, 0, Math.PI*2); ctx.fill();
  }
  // Eyes
  ctx.fillStyle=flash?'rgba(255,200,0,1)':(e.phase2?'rgba(255,80,80,0.95)':'rgba(240,192,96,0.95)');
  ctx.shadowColor=flash?'#ff0':(e.phase2?'#f87171':'#f0c060'); ctx.shadowBlur=14;
  [-e.r*.22, e.r*.22].forEach(ox=>{
    ctx.beginPath(); ctx.arc(ox,-e.r*.12, e.r*.14,0,Math.PI*2); ctx.fill();
  });
  ctx.shadowBlur=0;
}

// ── UTILITY ─────────────────────────────────────────────────
function normalizeAngle(a) {
  while (a >  Math.PI) a -= Math.PI*2;
  while (a < -Math.PI) a += Math.PI*2;
  return a;
}
