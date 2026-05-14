// ═══════════════════════════════════════════════════════════
// CRYPTFALL — ENGINE
// canvas, audio, tile system, procedural textures,
// dynamic lighting, camera, room generator
// ═══════════════════════════════════════════════════════════

'use strict';

// ── CANVAS ──────────────────────────────────────────────────
const canvas = document.getElementById('gc');
const ctx    = canvas.getContext('2d');
let W, H;
function resizeCanvas() {
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// ── AUDIO ENGINE ────────────────────────────────────────────
const AC = new (window.AudioContext || window.webkitAudioContext)();

function playTone(freq, dur, type = 'sine', vol = 0.12, freqEnd = null, distFromPlayer = 0) {
  const falloff = Math.max(0.01, 1 - distFromPlayer / 700);
  const v = vol * falloff;
  if (v < 0.01) return;
  const o = AC.createOscillator(), g = AC.createGain();
  o.connect(g); g.connect(AC.destination);
  o.type = type;
  o.frequency.setValueAtTime(freq, AC.currentTime);
  if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, AC.currentTime + dur);
  g.gain.setValueAtTime(v, AC.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + dur);
  o.start(); o.stop(AC.currentTime + dur);
}

// named sound helpers
const SFX = {
  sword:  () => playTone(280, 0.13, 'sawtooth', 0.11, 580),
  dagger: () => playTone(520, 0.07, 'square',   0.08, 960),
  arrow:  () => playTone(820, 0.18, 'sine',      0.07, 180),
  hit:    (d) => playTone(140, 0.15, 'sawtooth', 0.16, 55,  d),
  dodge:  () => playTone(620, 0.11, 'sine',      0.08, 940),
  chest:  () => playTone(440, 0.22, 'sine',      0.12, 880),
  door:   () => playTone(190, 0.32, 'sawtooth',  0.10, 90),
  rune:   () => playTone(680, 0.26, 'sine',      0.10, 1360),
  boss:   () => { playTone(80, 0.5, 'sawtooth', 0.2, 40); playTone(60, 0.6, 'square', 0.1, 30); },
  footstep: () => playTone(60 + Math.random()*20, 0.04, 'sawtooth', 0.03),
  levelup: () => { [440,554,659,880].forEach((f,i)=>setTimeout(()=>playTone(f,0.15,'sine',0.1),i*90)); },
};

// ── TILE CONSTANTS ──────────────────────────────────────────
const TILE    = 48;
const T = { FLOOR:0, WALL:1, DOOR:2, CHEST:3, STAIRS:4, PILLAR:5, BLOOD:6 };

// ── PROCEDURAL FLOOR TILE CACHE ─────────────────────────────
const floorCache = [];
const wallCache  = [];
const bloodCache = [];

function buildFloorTile(seed) {
  const tc = document.createElement('canvas');
  tc.width = tc.height = TILE;
  const tx = tc.getContext('2d');
  const base = ['#1c1610','#181310','#1a1510','#16110e'][seed % 4];
  tx.fillStyle = base; tx.fillRect(0, 0, TILE, TILE);
  // mortar lines
  tx.strokeStyle = 'rgba(0,0,0,0.55)'; tx.lineWidth = 1;
  if (seed % 2 === 0) {
    tx.beginPath(); tx.moveTo(TILE/2, 0); tx.lineTo(TILE/2, TILE); tx.stroke();
    tx.beginPath(); tx.moveTo(0, TILE/2); tx.lineTo(TILE, TILE/2); tx.stroke();
  } else {
    [0, TILE].forEach(y => { tx.beginPath(); tx.moveTo(0,y); tx.lineTo(TILE,y); tx.stroke(); });
  }
  // noise specks
  for (let i = 0; i < 8; i++) {
    const nx = (seed * 17 + i * 29) % TILE, ny = (seed * 13 + i * 19) % TILE;
    tx.fillStyle = `rgba(0,0,0,${0.15 + (seed*i%3)*.08})`;
    tx.fillRect(nx, ny, 2, 2);
  }
  // occasional crack
  if (seed % 6 === 0) {
    tx.strokeStyle = 'rgba(0,0,0,0.3)'; tx.lineWidth = 1;
    tx.beginPath(); tx.moveTo(6,8); tx.lineTo(18,17); tx.lineTo(26,14); tx.stroke();
  }
  // edge darkening (for depth)
  const edgeGrad = tx.createLinearGradient(0, 0, 0, TILE);
  edgeGrad.addColorStop(0, 'rgba(0,0,0,0.18)');
  edgeGrad.addColorStop(0.3, 'rgba(0,0,0,0)');
  edgeGrad.addColorStop(0.7, 'rgba(0,0,0,0)');
  edgeGrad.addColorStop(1,   'rgba(0,0,0,0.22)');
  tx.fillStyle = edgeGrad; tx.fillRect(0, 0, TILE, TILE);
  return tc;
}

function buildWallTile(seed) {
  const tc = document.createElement('canvas');
  tc.width = TILE; tc.height = TILE * 1.5; // taller for 2.5D extrusion
  const tx = tc.getContext('2d');
  // top face (lighter)
  tx.fillStyle = ['#2a2018','#252016','#28221a'][seed%3];
  tx.fillRect(0, 0, TILE, TILE);
  // front face (darker, 2.5D extruded bottom)
  const frontH = TILE * 0.5;
  tx.fillStyle = ['#18130e','#14110c','#160f0a'][seed%3];
  tx.fillRect(0, TILE, TILE, frontH);
  // mortar on top face
  tx.strokeStyle = 'rgba(0,0,0,0.5)'; tx.lineWidth = 1;
  [TILE*0.5].forEach(x=>{tx.beginPath();tx.moveTo(x,0);tx.lineTo(x,TILE);tx.stroke();});
  [TILE*0.35, TILE*0.7].forEach(y=>{tx.beginPath();tx.moveTo(0,y);tx.lineTo(TILE,y);tx.stroke();});
  // highlight top edge
  tx.strokeStyle = 'rgba(255,220,150,0.08)'; tx.lineWidth = 1;
  tx.beginPath(); tx.moveTo(0,0); tx.lineTo(TILE,0); tx.stroke();
  // shadow bottom of front face
  const sh = tx.createLinearGradient(0, TILE, 0, TILE + frontH);
  sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.6)');
  tx.fillStyle = sh; tx.fillRect(0, TILE, TILE, frontH);
  // noise
  for (let i = 0; i < 5; i++) {
    const nx=(seed*11+i*23)%TILE, ny=(seed*7+i*17)%TILE;
    tx.fillStyle=`rgba(0,0,0,0.2)`; tx.fillRect(nx,ny,3,2);
  }
  return tc;
}

function buildBloodDecal(seed) {
  const tc = document.createElement('canvas'); tc.width = tc.height = TILE;
  const tx = tc.getContext('2d');
  tx.fillStyle = 'transparent'; tx.clearRect(0,0,TILE,TILE);
  const cx = TILE/2 + (seed%7)-3, cy = TILE/2 + ((seed*3)%7)-3;
  const r  = 6 + seed%10;
  tx.fillStyle = `rgba(${120+seed%40},10,10,0.55)`;
  tx.beginPath(); tx.arc(cx,cy,r,0,Math.PI*2); tx.fill();
  // splatter drops
  for (let i=0;i<4+seed%4;i++) {
    const a=(seed*37+i*60)*Math.PI/180, d=r+4+i*3;
    tx.fillStyle=`rgba(${100+seed%30},8,8,${0.3+i*.05})`;
    tx.beginPath(); tx.arc(cx+Math.cos(a)*d, cy+Math.sin(a)*d, 2+i%3, 0, Math.PI*2); tx.fill();
  }
  return tc;
}

for (let i=0;i<16;i++) floorCache.push(buildFloorTile(i));
for (let i=0;i<8; i++) wallCache.push(buildWallTile(i));
for (let i=0;i<6; i++) bloodCache.push(buildBloodDecal(i));

// ── LIGHT / SHADOW SYSTEM ───────────────────────────────────
// We render a shadow map on an offscreen canvas using radial
// gradient composition to fake soft shadow casting.
const lightCanvas = document.createElement('canvas');
const lightCtx    = lightCanvas.getContext('2d');

function resizeLightCanvas() {
  lightCanvas.width  = W;
  lightCanvas.height = H;
}
resizeLightCanvas();
window.addEventListener('resize', resizeLightCanvas);

/**
 * Draw the light layer for the current frame.
 * @param {Array}  lights     [{x,y,r,color,intensity}]
 * @param {Array}  walls      world-space rects blocking light
 * @param {number} ambient    0..1 ambient brightness
 */
function renderLights(lights, ambientLevel) {
  lightCtx.clearRect(0, 0, W, H);
  // Fill with darkness
  lightCtx.fillStyle = `rgba(0,0,0,${0.94 - ambientLevel * 0.3})`;
  lightCtx.fillRect(0, 0, W, H);
  // Each light punches a hole
  lightCtx.globalCompositeOperation = 'destination-out';
  lights.forEach(l => {
    const g = lightCtx.createRadialGradient(l.sx, l.sy, 0, l.sx, l.sy, l.r);
    const intensity = l.intensity || 1;
    g.addColorStop(0,   `rgba(255,255,255,${0.92 * intensity})`);
    g.addColorStop(0.25,`rgba(255,255,255,${0.65 * intensity})`);
    g.addColorStop(0.6, `rgba(255,255,255,${0.25 * intensity})`);
    g.addColorStop(1,   'rgba(255,255,255,0)');
    lightCtx.fillStyle = g;
    lightCtx.beginPath(); lightCtx.arc(l.sx, l.sy, l.r, 0, Math.PI*2); lightCtx.fill();
  });
  lightCtx.globalCompositeOperation = 'source-over';
}

/** Apply the light layer on top of the scene */
function applyLights() {
  ctx.drawImage(lightCanvas, 0, 0);
}

// ── CAMERA ──────────────────────────────────────────────────
const camera = {
  x: 0, y: 0,
  tx: 0, ty: 0,       // target
  shakeAmt: 0,
  shakeDur: 0,
  zoom: 1.0,
  tzoom: 1.0,

  follow(wx, wy) {
    this.tx = wx - W/2;
    this.ty = wy - H/2;
  },
  update() {
    this.x += (this.tx - this.x) * 0.1;
    this.y += (this.ty - this.y) * 0.1;
    this.zoom += (this.tzoom - this.zoom) * 0.08;
    if (this.shakeDur > 0) { this.shakeDur--; this.shakeAmt *= 0.85; }
    else this.shakeAmt = 0;
  },
  shake(amt, dur = 12) {
    this.shakeAmt = Math.max(this.shakeAmt, amt);
    this.shakeDur = Math.max(this.shakeDur, dur);
  },
  begin() {
    ctx.save();
    const sx = this.shakeDur > 0 ? (Math.random()-.5)*this.shakeAmt : 0;
    const sy = this.shakeDur > 0 ? (Math.random()-.5)*this.shakeAmt : 0;
    ctx.translate(W/2 + sx, H/2 + sy);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-W/2 - this.x, -H/2 - this.y);
  },
  end() { ctx.restore(); },

  // world → screen
  toScreen(wx, wy) {
    return {
      sx: (wx - this.x - W/2) * this.zoom + W/2,
      sy: (wy - this.y - H/2) * this.zoom + H/2,
    };
  },
};

// ── ROOM LAYOUT BUILDER ─────────────────────────────────────
/**
 * A room is a 2-D tile grid with metadata.
 * Rooms are pre-defined but contain procedural decorations.
 */
function makeRoom(def) {
  const grid = def.layoutFn();
  // scatter blood decals on floor tiles (10% chance)
  const decals = [];
  for (let y=0; y<def.h; y++)
    for (let x=0; x<def.w; x++)
      if (grid[y][x] === T.FLOOR && Math.random() < 0.07)
        decals.push({ x, y, seed: Math.floor(Math.random()*6) });

  return {
    ...def,
    grid,
    decals,
    cleared: def.enemies.length === 0,
    chestOpened: false,
  };
}

// ── ROOM DEFINITIONS ────────────────────────────────────────
// layoutFn returns a 2-D array of tile constants.
// Enemies are placed by the entity system after room load.
const ROOM_DEFS = [
  // ── Room 0: Hall of Arrival (no enemies, tutorial feel) ──
  {
    id: 0, name: 'Hall of Arrival',
    w: 15, h: 12,
    ambient: 0.12,
    torchPositions: [[2,2],[12,2],[2,9],[12,9]],
    enemies: [],
    layoutFn() {
      const g = emptyRoom(this.w, this.h);
      // right door
      g[5][14] = T.DOOR;
      // chest near top-left
      g[2][3]  = T.CHEST;
      // pillar pair
      g[3][7] = T.PILLAR; g[8][7] = T.PILLAR;
      return g;
    }
  },

  // ── Room 1: Ossuary ──
  {
    id: 1, name: 'Ossuary',
    w: 17, h: 13,
    ambient: 0.08,
    torchPositions: [[3,1],[13,1],[3,11],[13,11]],
    enemies: [
      { type:'skeleton', rx:6, ry:5 },
      { type:'skeleton', rx:10, ry:4 },
      { type:'skeleton', rx:8, ry:9 },
    ],
    layoutFn() {
      const g = emptyRoom(this.w, this.h);
      g[6][0]  = T.DOOR; g[6][16] = T.DOOR;
      g[10][9] = T.CHEST;
      // interior columns
      [[4,4],[4,8],[12,4],[12,8]].forEach(([x,y])=>g[y][x]=T.PILLAR);
      return g;
    }
  },

  // ── Room 2: Hall of Chains ──
  {
    id: 2, name: 'Hall of Chains',
    w: 19, h: 14,
    ambient: 0.06,
    torchPositions: [[2,2],[16,2],[2,11],[16,11],[9,1]],
    enemies: [
      { type:'skeleton', rx:4,  ry:4  },
      { type:'armored',  rx:14, ry:7  },
      { type:'skeleton', rx:9,  ry:10 },
      { type:'skeleton', rx:15, ry:11 },
    ],
    layoutFn() {
      const g = emptyRoom(this.w, this.h);
      g[7][0] = T.DOOR; g[7][18] = T.DOOR;
      g[2][15] = T.CHEST; g[11][3] = T.CHEST;
      // horizontal wall breaks
      for (let x=3;x<7; x++) g[5][x]  = T.WALL;
      for (let x=12;x<16;x++) g[8][x] = T.WALL;
      return g;
    }
  },

  // ── Room 3: Mage Sanctum ──
  {
    id: 3, name: 'Mage Sanctum',
    w: 17, h: 16,
    ambient: 0.05,
    torchPositions: [[2,2],[14,2],[2,13],[14,13],[8,8]],
    enemies: [
      { type:'skeleton', rx:3,  ry:5  },
      { type:'mage',     rx:13, ry:4  },
      { type:'armored',  rx:8,  ry:10 },
      { type:'mage',     rx:14, ry:12 },
    ],
    layoutFn() {
      const g = emptyRoom(this.w, this.h);
      g[8][0] = T.DOOR; g[8][16] = T.DOOR;
      g[13][13] = T.CHEST;
      // central cross obstacle
      for (let x=6;x<11;x++) g[6][x] = T.WALL;
      for (let y=3;y<6; y++) g[y][8] = T.WALL;
      for (let y=9;y<12;y++) g[y][8] = T.WALL;
      // pillars
      [[4,4],[12,4],[4,12],[12,12]].forEach(([x,y])=>g[y][x]=T.PILLAR);
      return g;
    }
  },

  // ── Room 4: Throne of the Golem (Boss) ──
  {
    id: 4, name: 'Throne of the Golem',
    w: 22, h: 18,
    ambient: 0.04,
    torchPositions: [[2,2],[19,2],[2,15],[19,15],[10,1],[10,16],[2,9],[19,9]],
    enemies: [
      { type:'skeleton', rx:5,  ry:5  },
      { type:'skeleton', rx:16, ry:5  },
      { type:'armored',  rx:5,  ry:12 },
      { type:'armored',  rx:16, ry:12 },
      { type:'golem',    rx:10, ry:8  }, // BOSS
    ],
    layoutFn() {
      const g = emptyRoom(this.w, this.h);
      g[9][0] = T.DOOR;
      g[9][21] = T.STAIRS; // escape stairs
      g[15][18] = T.CHEST;
      // throne dais (raised pillars)
      [[8,6],[13,6],[8,11],[13,11],[10,4],[11,4]].forEach(([x,y])=>g[y][x]=T.PILLAR);
      return g;
    }
  },
];

/** Build an empty walled room grid */
function emptyRoom(w, h) {
  return Array.from({length:h}, (_,y) =>
    Array.from({length:w}, (_2,x) =>
      (x===0||x===w-1||y===0||y===h-1) ? T.WALL : T.FLOOR
    )
  );
}

/** All rooms, instantiated */
let ROOMS = [];
function buildRooms() {
  ROOMS = ROOM_DEFS.map(def => makeRoom(def));
}

// ── ROOM RENDERER ───────────────────────────────────────────
/**
 * Draw the current room tiles with 2.5D wall extrusion.
 * Call this BEFORE the light pass.
 */
function drawRoom(room) {
  const offX = 0; // room origin in world pixels
  const offY = 0;

  for (let ty=0; ty<room.h; ty++) {
    for (let tx2=0; tx2<room.w; tx2++) {
      const tile = room.grid[ty][tx2];
      const wx = offX + tx2 * TILE;
      const wy = offY + ty  * TILE;

      if (tile === T.WALL) {
        // 2.5D extrusion: draw front face below
        const wi = (tx2 + ty) % wallCache.length;
        ctx.drawImage(wallCache[wi], wx, wy - TILE*0.5, TILE, TILE*1.5);
        // top edge highlight
        ctx.fillStyle = 'rgba(255,220,130,0.04)';
        ctx.fillRect(wx, wy - TILE*0.5, TILE, 3);
      } else {
        // Floor
        const fi = (tx2 * 3 + ty * 7) % floorCache.length;
        ctx.drawImage(floorCache[fi], wx, wy);
      }
    }
  }

  // Blood decals
  room.decals.forEach(d => {
    ctx.drawImage(bloodCache[d.seed], d.x*TILE, d.y*TILE);
  });

  // Special tiles
  for (let ty=0; ty<room.h; ty++) {
    for (let tx2=0; tx2<room.w; tx2++) {
      const tile = room.grid[ty][tx2];
      const wx = tx2 * TILE + TILE/2;
      const wy = ty  * TILE + TILE/2;

      if (tile === T.DOOR) {
        drawDoor(wx, wy, room.cleared);
      } else if (tile === T.CHEST) {
        drawChest(wx, wy, room.chestOpened);
      } else if (tile === T.PILLAR) {
        drawPillar(wx, wy);
      } else if (tile === T.STAIRS) {
        drawStairs(wx, wy);
      }
    }
  }
}

function drawDoor(wx, wy, open) {
  ctx.save(); ctx.translate(wx, wy);
  ctx.fillStyle = open ? '#3d2e1a' : '#1a120a';
  ctx.strokeStyle = open ? '#8b6914' : '#4a3010';
  ctx.lineWidth = 3;
  // Door frame
  ctx.beginPath(); ctx.roundRect(-TILE*.42, -TILE*.46, TILE*.84, TILE*.92, 4); ctx.fill(); ctx.stroke();
  if (open) {
    ctx.fillStyle = '#0a0704';
    ctx.fillRect(-TILE*.3, -TILE*.38, TILE*.6, TILE*.76);
  } else {
    // Door handle
    ctx.fillStyle = '#f0c060';
    ctx.beginPath(); ctx.arc(TILE*.15, 0, 4, 0, Math.PI*2); ctx.fill();
    // Planks
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1;
    [-TILE*.2, 0, TILE*.2].forEach(y => {
      ctx.beginPath(); ctx.moveTo(-TILE*.35, y); ctx.lineTo(TILE*.35, y); ctx.stroke();
    });
  }
  ctx.restore();
}

function drawChest(wx, wy, opened) {
  ctx.save(); ctx.translate(wx, wy);
  ctx.shadowColor = opened ? 'rgba(0,0,0,0)' : '#f0c060';
  ctx.shadowBlur  = opened ? 0 : 12;
  // Body
  ctx.fillStyle = opened ? '#2a1e10' : '#3d2a14';
  ctx.strokeStyle = opened ? '#4a3010' : '#c9a84c';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(-TILE*.38, -TILE*.22, TILE*.76, TILE*.44, 5); ctx.fill(); ctx.stroke();
  // Lid
  ctx.fillStyle = opened ? '#201508' : '#4a3018';
  ctx.beginPath();
  if (opened) {
    ctx.roundRect(-TILE*.38, -TILE*.28, TILE*.76, TILE*.12, [5,5,0,0]);
  } else {
    ctx.roundRect(-TILE*.38, -TILE*.36, TILE*.76, TILE*.18, [5,5,0,0]);
  }
  ctx.fill(); ctx.stroke();
  // Lock clasp
  if (!opened) {
    ctx.fillStyle = '#f0c060';
    ctx.beginPath(); ctx.arc(0, -TILE*.08, 5, 0, Math.PI*2); ctx.fill();
  }
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawPillar(wx, wy) {
  ctx.save(); ctx.translate(wx, wy);
  // Base shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(0, TILE*.28, TILE*.32, TILE*.12, 0, 0, Math.PI*2); ctx.fill();
  // Front face (2.5D)
  const frontH = TILE * 0.55;
  ctx.fillStyle = '#1e1810';
  ctx.fillRect(-TILE*.26, 0, TILE*.52, frontH);
  // Top cap
  ctx.fillStyle = '#2e2518';
  ctx.strokeStyle = '#3d3020';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(0, 0, TILE*.28, TILE*.1, 0, 0, Math.PI*2); ctx.fill(); ctx.stroke();
  // Highlight
  ctx.strokeStyle = 'rgba(255,220,130,0.1)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-TILE*.26, 0); ctx.lineTo(-TILE*.26, frontH); ctx.stroke();
  ctx.restore();
}

function drawStairs(wx, wy) {
  ctx.save(); ctx.translate(wx, wy);
  for (let i=0; i<4; i++) {
    ctx.fillStyle = `hsl(30,${20+i*5}%,${12+i*4}%)`;
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1;
    const w = TILE*.7 - i*TILE*.1, h = TILE*.12;
    ctx.beginPath();
    ctx.roundRect(-w/2, -TILE*.24 + i*h, w, h, 2);
    ctx.fill(); ctx.stroke();
  }
  // Arrow down glyph
  ctx.fillStyle = 'rgba(240,192,96,0.6)';
  ctx.font = 'bold 14px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('▼', 0, TILE*.16);
  ctx.restore();
}

// ── WALL COLLISION HELPER ───────────────────────────────────
/**
 * Returns true if the circle (wx,wy,r) overlaps any solid tile.
 */
function collidesWithWalls(room, wx, wy, r) {
  const minTX = Math.max(0, Math.floor((wx-r)/TILE));
  const maxTX = Math.min(room.w-1, Math.ceil((wx+r)/TILE));
  const minTY = Math.max(0, Math.floor((wy-r)/TILE));
  const maxTY = Math.min(room.h-1, Math.ceil((wy+r)/TILE));
  for (let ty=minTY; ty<=maxTY; ty++) {
    for (let tx=minTX; tx<=maxTX; tx++) {
      const t = room.grid[ty][tx];
      if (t === T.WALL || t === T.PILLAR) {
        // AABB circle check
        const cx = tx*TILE + TILE/2, cy = ty*TILE + TILE/2;
        const dx = Math.abs(wx-cx), dy = Math.abs(wy-cy);
        const hw = TILE/2 + r, hh = TILE/2 + r;
        if (dx < hw && dy < hh) return true;
      }
    }
  }
  return false;
}

/**
 * Slide collision: resolve circle against walls, return new {x,y}.
 */
function slideResolve(room, ox, oy, nx, ny, r) {
  // Try X
  if (!collidesWithWalls(room, nx, oy, r)) return {x:nx, y:oy};
  // Try Y
  if (!collidesWithWalls(room, ox, ny, r)) return {x:ox, y:ny};
  // Stuck
  return {x:ox, y:oy};
}

// ── MINIMAP RENDERER ────────────────────────────────────────
function drawMinimap(rooms, currentRoomIdx, player) {
  const mm = mmCanvas;
  const mc = mmCtx;
  mc.clearRect(0, 0, mm.width, mm.height);
  mc.fillStyle = 'rgba(0,0,0,0.7)';
  mc.fillRect(0, 0, mm.width, mm.height);

  const roomW = (mm.width - 10) / rooms.length;
  rooms.forEach((r, i) => {
    const rx = 5 + i * roomW;
    const ry = 5;
    mc.fillStyle = i === currentRoomIdx ? '#f0c060'
                 : r.cleared ? '#4a3010'
                 : '#2a1a08';
    mc.strokeStyle = '#3d2a14'; mc.lineWidth = 1;
    mc.beginPath(); mc.roundRect(rx, ry, roomW-4, mm.height-10, 3); mc.fill(); mc.stroke();
    if (i === currentRoomIdx) {
      // Player dot
      mc.fillStyle = '#fff';
      mc.beginPath(); mc.arc(rx + roomW/2 - 2, ry + (mm.height-10)/2, 3, 0, Math.PI*2); mc.fill();
    }
    if (r.cleared && i !== currentRoomIdx) {
      mc.fillStyle = '#4ade80'; mc.font = '8px Arial'; mc.textAlign='center';
      mc.fillText('✓', rx + roomW/2 - 2, ry + (mm.height-10)/2 + 3);
    }
  });
}

// ── VIGNETTE ────────────────────────────────────────────────
function drawVignette(intensity = 0.7) {
  const g = ctx.createRadialGradient(W/2, H/2, H*.2, W/2, H/2, H*.8);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${intensity})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

// ── HIT FREEZE ──────────────────────────────────────────────
let hitFreezeFrames = 0;
function triggerHitFreeze(frames = 3) {
  hitFreezeFrames = Math.max(hitFreezeFrames, frames);
}

// ── EXPORTS ─────────────────────────────────────────────────
// Everything above is module-level. The entity and game
// scripts reference these globals directly (single-page game).
