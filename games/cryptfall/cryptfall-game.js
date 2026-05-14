// ═══════════════════════════════════════════════════════════
// CRYPTFALL — GAME LOGIC
// Game loop, room transitions, chests, runes, UI, HUD
// ═══════════════════════════════════════════════════════════

'use strict';

// ── INPUT ───────────────────────────────────────────────────
const input = {
  left:false, right:false, up:false, down:false,
  attack:false, dodge:false, interact:false,
  mouseX:0, mouseY:0,
};

document.addEventListener('keydown', e => {
  if (e.code==='ArrowLeft'||e.code==='KeyA')  input.left  = true;
  if (e.code==='ArrowRight'||e.code==='KeyD') input.right = true;
  if (e.code==='ArrowUp'||e.code==='KeyW')    input.up    = true;
  if (e.code==='ArrowDown'||e.code==='KeyS')  input.down  = true;
  if (e.code==='ShiftLeft'||e.code==='ShiftRight') input.dodge = true;
  if (e.code==='KeyE') input.interact = true;
  if (e.code==='Space') { e.preventDefault(); input.attack = true; }
  if (e.code==='Digit1') player && (player.activeWeapon=0);
  if (e.code==='Digit2') player && (player.activeWeapon=1);
  if (e.code==='Digit3') player && (player.activeWeapon=2);
});
document.addEventListener('keyup', e => {
  if (e.code==='ArrowLeft'||e.code==='KeyA')  input.left  = false;
  if (e.code==='ArrowRight'||e.code==='KeyD') input.right = false;
  if (e.code==='ArrowUp'||e.code==='KeyW')    input.up    = false;
  if (e.code==='ArrowDown'||e.code==='KeyS')  input.down  = false;
  if (e.code==='ShiftLeft'||e.code==='ShiftRight') input.dodge = false;
  if (e.code==='KeyE') input.interact = false;
});
document.addEventListener('mousemove', e => { input.mouseX=e.clientX; input.mouseY=e.clientY; });
document.addEventListener('mousedown', e => {
  if (e.button===0) input.attack = true;
  if (e.button===2) input.dodge  = true;
});
document.addEventListener('mouseup',   e => {
  if (e.button===2) input.dodge = false;
});
document.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  input.attack = true;
  input.mouseX = e.touches[0].clientX;
  input.mouseY = e.touches[0].clientY;
},{passive:false});
canvas.addEventListener('touchend',  e => { e.preventDefault(); input.attack=false; },{passive:false});
canvas.addEventListener('touchmove', e => { input.mouseX=e.touches[0].clientX; input.mouseY=e.touches[0].clientY; },{passive:false});

// ── GAME STATE ──────────────────────────────────────────────
let player       = null;
let currentRoomIdx = 0;
let gameActive   = false;
let frameCount   = 0;
let transitioning = false;
let transitionAlpha = 0;
let transitionDir   = 1; // 1=fade out, -1=fade in
let pendingRoomIdx  = -1;
let bestScore    = parseInt(localStorage.getItem('cf_best')||'0');

// ── TORCH LIGHT ANIMATION ───────────────────────────────────
const torchFlickers = [];
function initTorchFlickers(room) {
  torchFlickers.length = 0;
  room.torchPositions.forEach(() =>
    torchFlickers.push({ phase: Math.random()*Math.PI*2, offset: 0 })
  );
}

function buildLightList(room, player) {
  const lights = [];
  // Player light
  const ps = camera.toScreen(player.x, player.y);
  lights.push({ sx:ps.sx, sy:ps.sy, r:260, intensity:1.0 });

  // Torch lights
  room.torchPositions.forEach(([tx,ty],i) => {
    const wx = tx*TILE + TILE/2;
    const wy = ty*TILE + TILE/2;
    const sc = camera.toScreen(wx, wy);
    const flicker = torchFlickers[i];
    flicker.phase += 0.07 + Math.random()*0.03;
    flicker.offset = Math.sin(flicker.phase)*12 + Math.sin(flicker.phase*2.3)*6;
    lights.push({ sx:sc.sx, sy:sc.sy, r:130+flicker.offset, intensity:0.55 });
  });

  // Enemy phase2 glow
  enemies.forEach(e => {
    if (e.dead || !e.boss || !e.phase2) return;
    const sc = camera.toScreen(e.x, e.y);
    lights.push({ sx:sc.sx, sy:sc.sy, r:100, intensity:0.3 });
  });

  return lights;
}

// ── TORCHES (visual) ────────────────────────────────────────
function drawTorches(room, frameCount) {
  room.torchPositions.forEach(([tx,ty], i) => {
    const wx = tx*TILE + TILE/2;
    const wy = ty*TILE + TILE/2;
    const flicker = torchFlickers[i];

    ctx.save(); ctx.translate(wx, wy);
    // Wall bracket
    ctx.fillStyle = '#3d2a14'; ctx.strokeStyle = '#6b4a22'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.roundRect(-5,-8,10,16,3); ctx.fill(); ctx.stroke();
    // Flame layers
    const fOff = Math.sin(flicker.phase)*3;
    [[10,'rgba(240,100,20,0.9)'],[7,'rgba(255,160,30,0.8)'],[4,'rgba(255,220,80,0.9)']].forEach(([fR,col],fi)=>{
      ctx.fillStyle=col;
      ctx.shadowColor=col; ctx.shadowBlur=10+fi*4;
      ctx.beginPath();
      ctx.ellipse(fOff*(fi*.5), -8-fi*3, fR, fR*1.5, 0, 0, Math.PI*2);
      ctx.fill();
    });
    // Ember particles (occasional)
    if (Math.random()<0.15) {
      spawnParticles(wx+fOff, wy-18, '#ff8020', 1,
        {spd:0.8,spdVar:0.5,r:1.5,rVar:1,upBias:1.5,grav:-0.04,dec:0.04});
    }
    ctx.shadowBlur=0; ctx.restore();
  });
}

// ── UPGRADE / CHEST SYSTEM ──────────────────────────────────
const UPGRADES_POOL = [
  { id:'hp',      name:'Ancient Mending',   icon:'💉', desc:'+30 Max HP. Current HP restored.',
    apply(p){ p.maxHp+=30; p.hp=Math.min(p.hp+30,p.maxHp); } },
  { id:'armor',   name:'Stone Plating',      icon:'🛡', desc:'+20 Max Armor.',
    apply(p){ p.maxArmor+=20; p.armor=Math.min(p.armor+20,p.maxArmor); } },
  { id:'spd',     name:'Hermes Boots',       icon:'💨', desc:'Movement speed +0.6.',
    apply(p){ p.upgrades.speedBoost=(p.upgrades.speedBoost||0)+0.6; } },
  { id:'dmg',     name:'Cursed Edge',        icon:'⚔',  desc:'+10 Attack damage.',
    apply(p){ p.upgrades.dmgBoost=(p.upgrades.dmgBoost||0)+10;
              Object.values(WEAPONS).forEach(w=>w.dmg+=10); } },
  { id:'regen',   name:'Blood Font',         icon:'🩸', desc:'Slowly regenerate HP.',
    apply(p){ p.upgrades.hpRegen=(p.upgrades.hpRegen||0)+2; } },
  { id:'pierce',  name:'Phantom Arrow',      icon:'🏹', desc:'Arrows pierce through enemies.',
    apply(p){ p.upgrades.piercingArrows=true; } },
  { id:'dodge',   name:'Shadow Step',        icon:'🌫', desc:'Dodge cooldown -30%.',
    apply(p){ p.upgrades.extraDodge=true; } },
  { id:'steal',   name:'Vampiric Aura',      icon:'🧛', desc:'Attacks drain 8% HP.',
    apply(p){ p.upgrades.lifesteal=true; } },
];

function pickChestUpgrades() {
  const pool = [...UPGRADES_POOL];
  const picks = [];
  while (picks.length < 3 && pool.length > 0) {
    const i = Math.floor(Math.random()*pool.length);
    picks.push(pool.splice(i,1)[0]);
  }
  return picks;
}

function openChestUI(player) {
  const picks = pickChestUpgrades();
  const cards = document.getElementById('chestCards');
  cards.innerHTML = '';
  SFX.chest();
  picks.forEach(u => {
    const div = document.createElement('div');
    div.className = 'chest-card';
    div.innerHTML = `<div class="cc-icon">${u.icon}</div>
      <div class="cc-name">${u.name}</div>
      <div class="cc-desc">${u.desc}</div>`;
    div.onclick = () => {
      u.apply(player);
      SFX.levelup();
      document.getElementById('chestOv').classList.remove('open');
      gameActive = true;
      updateHUD(player);
      spawnFloatText(player.x, player.y-50, u.name, '#f0c060', true);
    };
    cards.appendChild(div);
  });
  gameActive = false;
  document.getElementById('chestOv').classList.add('open');
}

// ── RUNE SYSTEM ─────────────────────────────────────────────
const RUNE_BOONS = [
  { name:'Rune of Fury',    desc:'Attack speed +20%', icon:'🔴',
    apply(p){ Object.values(WEAPONS).forEach(w=>w.cooldown=Math.max(5,w.cooldown*.8)); } },
  { name:'Rune of Warding', desc:'Armor +30, regenerates slowly', icon:'🔵',
    apply(p){ p.maxArmor+=30; p.armor+=30; p.upgrades.armorRegen=true; } },
  { name:'Rune of Sight',   desc:'Enemy detection range revealed', icon:'🟡',
    apply(p){ p._runeOfSight=true; } },
];

function applyRuneBoon(player) {
  const boon = RUNE_BOONS[player.runes % RUNE_BOONS.length];
  boon.apply(player);
  SFX.rune();
  spawnFloatText(player.x, player.y-60, boon.name+'!', '#a78bfa', true);
  updateHUD(player);
}

// ── INTERACTION CHECK ───────────────────────────────────────
function checkInteractions(player, room) {
  const pr = 52; // interaction radius in pixels

  for (let ty=0; ty<room.h; ty++) {
    for (let tx=0; tx<room.w; tx++) {
      const tile = room.grid[ty][tx];
      const wx = tx*TILE + TILE/2, wy = ty*TILE + TILE/2;
      const dist = Math.hypot(player.x-wx, player.y-wy);
      if (dist > pr) continue;

      if (tile === T.DOOR && room.cleared) {
        if (input.interact) {
          input.interact = false;
          SFX.door();
          startRoomTransition(currentRoomIdx + 1);
        } else {
          // Prompt
          spawnFloatText(wx, wy-28, '[E] Enter', '#f0c060');
        }
      }

      if (tile === T.CHEST && !room.chestOpened) {
        if (input.interact) {
          input.interact = false;
          room.chestOpened = true;
          openChestUI(player);
          // Drop rune
          player.runes++;
          updateHUD(player);
          if (player.runes % 3 === 0) applyRuneBoon(player);
          room.grid[ty][tx] = T.FLOOR; // Mark opened in grid
        } else {
          spawnFloatText(wx, wy-28, '[E] Open', '#f0c060');
        }
      }

      if (tile === T.STAIRS) {
        if (input.interact) {
          input.interact = false;
          // Victory — escape
          triggerVictory(player);
        } else {
          spawnFloatText(wx, wy-28, '[E] Escape!', '#4ade80');
        }
      }
    }
  }
}

// ── ROOM TRANSITION ─────────────────────────────────────────
function startRoomTransition(nextIdx) {
  if (nextIdx >= ROOMS.length) { triggerVictory(player); return; }
  transitioning = true;
  transitionDir = 1;
  transitionAlpha = 0;
  pendingRoomIdx = nextIdx;
  gameActive = false;
}

function doTransition() {
  if (!transitioning) return;
  transitionAlpha += transitionDir * 0.06;

  if (transitionDir === 1 && transitionAlpha >= 1) {
    // Fully black — switch room
    loadRoom(pendingRoomIdx);
    transitionDir = -1;
  }
  if (transitionDir === -1 && transitionAlpha <= 0) {
    transitioning = false;
    transitionAlpha = 0;
    gameActive = true;
  }

  ctx.fillStyle = `rgba(0,0,0,${Math.min(1,Math.max(0,transitionAlpha))})`;
  ctx.fillRect(0, 0, W, H);
}

function loadRoom(idx) {
  currentRoomIdx = idx;
  const room = ROOMS[idx];
  spawnEnemies(room);

  // Respawn player at entry point
  // Entry from left (door at col 0) or center
  let spawnX = room.w * TILE / 2, spawnY = room.h * TILE / 2;
  for (let ty=0; ty<room.h; ty++) {
    if (room.grid[ty][0] === T.DOOR) { spawnX = TILE*2; spawnY = ty*TILE+TILE/2; break; }
  }
  player.x = spawnX; player.y = spawnY;
  player.vx = 0; player.vy = 0;
  player.trail = [];
  projectiles.length = 0;
  particles.length   = 0;
  sparks.length      = 0;

  initTorchFlickers(room);
  camera.x = player.x - W/2; camera.y = player.y - H/2;
  camera.tx= player.x - W/2; camera.ty= player.y - H/2;
  updateHUD(player);

  if (idx === 4) SFX.boss(); // Boss room
}

// ── HUD UPDATE ──────────────────────────────────────────────
function updateHUD(player) {
  document.getElementById('hpBar').style.width    = Math.max(0,player.hp/player.maxHp*100)+'%';
  document.getElementById('armorBar').style.width = Math.max(0,player.armor/player.maxArmor*100)+'%';
  document.getElementById('hGold').textContent    = player.gold;
  document.getElementById('hRunes').textContent   = player.runes+'/3';
  document.getElementById('hRoom').textContent    = (currentRoomIdx+1)+'/'+ROOMS.length;

  // Weapon slots
  const wHud = document.getElementById('weaponHud');
  wHud.innerHTML = '';
  player.weapons.forEach((wKey,i) => {
    const w = WEAPONS[wKey];
    const div = document.createElement('div');
    div.className = 'weapon-slot' + (i===player.activeWeapon?' active':'');
    div.textContent = `${i+1} ${w.name}`;
    div.onclick = () => { player.activeWeapon = i; updateHUD(player); };
    wHud.appendChild(div);
  });
}

// ── ROOM CLEAR CHECK ────────────────────────────────────────
function checkRoomClear(room) {
  if (room.cleared) return;
  if (enemies.every(e => e.dead)) {
    room.cleared = true;
    spawnFloatText(player.x, player.y-70, 'ROOM CLEARED!', '#4ade80', true);
    SFX.levelup();
    camera.shake(6, 12);
    // Unlock doors
    for (let ty=0;ty<room.h;ty++)
      for (let tx=0;tx<room.w;tx++)
        if (room.grid[ty][tx]===T.DOOR) {
          // doors visually unlock — no tile change needed, drawDoor checks cleared
        }
  }
}

// ── DEATH / VICTORY ─────────────────────────────────────────
function triggerDeath() {
  gameActive = false;
  const score = player.gold * 10 + player.kills * 25 + currentRoomIdx * 100;
  if (score > bestScore) { bestScore=score; localStorage.setItem('cf_best',bestScore); }
  document.getElementById('dsGold').textContent  = player.gold;
  document.getElementById('dsRoom').textContent  = currentRoomIdx+1;
  document.getElementById('dsKills').textContent = player.kills;
  document.getElementById('dsBest').textContent  = bestScore;
  document.getElementById('nameInput').value     = localStorage.getItem('cf_name')||'';
  setTimeout(()=>document.getElementById('deathOv').classList.add('open'), 900);
}

function triggerVictory(player) {
  gameActive = false;
  spawnFloatText(player.x, player.y-80, 'ESCAPED! 🏆', '#f0c060', true);
  camera.shake(20, 40);
  const score = player.gold*10 + player.kills*25 + currentRoomIdx*100 + 500;
  if (score > bestScore) { bestScore=score; localStorage.setItem('cf_best',bestScore); }
  document.getElementById('dsGold').textContent  = player.gold;
  document.getElementById('dsRoom').textContent  = ROOMS.length;
  document.getElementById('dsKills').textContent = player.kills;
  document.getElementById('dsBest').textContent  = bestScore;
  document.getElementById('nameInput').value     = localStorage.getItem('cf_name')||'';
  setTimeout(()=>document.getElementById('deathOv').classList.add('open'), 1800);
}

async function submitAndRestart() {
  const name = document.getElementById('nameInput').value.trim();
  if (name.length >= 2) {
    localStorage.setItem('cf_name', name);
    const score = player.gold*10 + player.kills*25 + currentRoomIdx*100;
    await saveScore(name, player.gold, currentRoomIdx+1, player.kills);
  }
  restartGame();
}

function restartGame() {
  document.getElementById('deathOv').classList.remove('open');
  startGame();
}

// ── START GAME ──────────────────────────────────────────────
function startGame() {
  document.getElementById('startOv').style.display = 'none';
  buildRooms();
  currentRoomIdx = 0;
  const room = ROOMS[0];
  player = createPlayer(room);
  spawnEnemies(room);
  initTorchFlickers(room);
  projectiles.length = 0;
  particles.length   = 0;
  sparks.length      = 0;
  floatTexts.length  = 0;
  camera.x = player.x - W/2; camera.y = player.y - H/2;
  camera.tx= player.x - W/2; camera.ty= player.y - H/2;
  gameActive   = true;
  transitioning= false;
  frameCount   = 0;
  updateHUD(player);
}

// ── MAIN GAME LOOP ──────────────────────────────────────────
function loop() {
  requestAnimationFrame(loop);
  frameCount++;
  camera.update();

  const room = ROOMS[currentRoomIdx];

  // ─ Clear ─
  ctx.fillStyle = room.ambient ? `hsl(30,20%,${Math.round(room.ambient*100/10)}%)` : '#0a0704';
  ctx.fillRect(0, 0, W, H);

  // ─ World space ─
  camera.begin();

  drawRoom(room);
  drawTorches(room, frameCount);

  if (gameActive) {
    updatePlayer(player, room, input, 1);
    updateEnemies(enemies, room, player, frameCount);
    updateProjectiles(room, player);
    updateParticles();
    checkInteractions(player, room);
    checkRoomClear(room);
    camera.follow(player.x, player.y);

    // Rune of Sight: show enemy patrol ranges
    if (player._runeOfSight) {
      enemies.forEach(e => {
        if (e.dead) return;
        ctx.strokeStyle = 'rgba(255,200,50,0.12)'; ctx.lineWidth=1; ctx.setLineDash([4,8]);
        ctx.beginPath(); ctx.arc(e.x, e.y, e.sightRange, 0, Math.PI*2); ctx.stroke();
        ctx.setLineDash([]);
      });
    }

    // Armor regen boon
    if (player.upgrades.armorRegen && frameCount%120===0) {
      player.armor = Math.min(player.maxArmor, player.armor+3);
      updateHUD(player);
    }
  }

  drawProjectiles();
  drawEnemies(enemies, frameCount);
  drawPlayer(player, frameCount);
  drawParticles();
  drawFloatTexts();

  camera.end();

  // ─ Lighting pass (screen space) ─
  if (gameActive || transitioning) {
    const lights = buildLightList(room, player);
    renderLights(lights, room.ambient || 0.06);
    applyLights();
  }

  // ─ Screen-space UI ─
  drawVignette(0.65);
  drawMinimap(ROOMS, currentRoomIdx, player);

  // Transition fade
  doTransition();

  // Reset one-shot inputs
  input.attack   = false;
  input.interact = false;
}

loop();
