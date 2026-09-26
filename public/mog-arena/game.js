// MOG QUEST — old-school split-screen arcade RPG.
// Each player's face becomes a pixel hero of a chosen class that evolves NPC → GIGACHAD.
// Move by moving your head (camera), dragging a finger on your half, or keys.
// Cast your class power by opening your mouth, tapping the power button, or F / Enter.
import { sfx, chip, speak } from './sounds.js';

const W = 640, H = 360, HALF = W / 2, ROUND = 90;
const FONT = '"Press Start 2P", monospace';
const EMOJI = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

const STAGES = [
  { name: 'NPC', xp: 0, color: '#8a8a99', size: 18, speed: 1.0 },
  { name: 'NORMIE', xp: 100, color: '#4da3ff', size: 21, speed: 1.1 },
  { name: 'CHADLITE', xp: 250, color: '#ff7a00', size: 24, speed: 1.2 },
  { name: 'CHAD', xp: 450, color: '#ff2e4d', size: 27, speed: 1.3, flame: true, minions: 1 },
  { name: 'GIGACHAD', xp: 700, color: '#ffd400', size: 32, speed: 1.4, flame: true, minions: 2, crown: true, beam: true },
];

export const CLASSES = {
  necro: { name: 'NECROMANCER', icon: '💀', robe: '#2b1640', trim: '#7dff6a', fx: '#7dff6a', power: 'RAISE DEAD',
    desc: 'Raise Dead: every hazard on your screen becomes a skeleton that invades your rival.' },
  mage: { name: 'MAGE', icon: '🔮', robe: '#1e3a8a', trim: '#7fd4ff', fx: '#7fd4ff', power: 'ARCANE NOVA',
    desc: 'Arcane Nova: a blast that turns nearby hazards into aura orbs.' },
  druid: { name: 'DRUID', icon: '🌿', robe: '#1f4d2a', trim: '#a3e635', fx: '#a3e635', power: 'WILD SHAPE',
    desc: 'Wild Shape: become a bear — unstoppable, crushes hazards, heals a heart.' },
  paladin: { name: 'PALADIN', icon: '⚔️', robe: '#cfd6e3', trim: '#ffd400', fx: '#fff3b0', power: 'DIVINE AEGIS',
    desc: 'Divine Aegis: holy shield + heal, and smites everything above you.' },
  rogue: { name: 'ROGUE', icon: '🗡️', robe: '#1a1a1f', trim: '#ff2e4d', fx: '#b0b0c0', power: 'SHADOW HEIST',
    desc: 'Shadow Heist: vanish (untouchable) and steal aura from your rival.' },
  warlock: { name: 'WARLOCK', icon: '🔥', robe: '#5a0f14', trim: '#ff7a00', fx: '#ff7a00', power: 'HELLFIRE RAIN',
    desc: 'Hellfire Rain: meteors crash onto your rival and slow them down.' },
};
const CLASS_KEYS = Object.keys(CLASSES);
const BAD = new Set(['hazard', 'garbage', 'skeleton', 'meteor']);
const isBad = it => BAD.has(it.type);

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const $ = s => document.querySelector(s);

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function loadImg(src) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
}

// Scanned face → 24×24 posterized pixel sprite.
async function pixelFace(src) {
  const img = await loadImg(src);
  const c = document.createElement('canvas');
  c.width = c.height = 24;
  const g = c.getContext('2d');
  g.drawImage(img, img.width * 0.18, img.height * 0.14, img.width * 0.64, img.height * 0.64, 0, 0, 24, 24);
  const d = g.getImageData(0, 0, 24, 24);
  for (let i = 0; i < d.data.length; i += 4) {
    for (let k = 0; k < 3; k++) d.data[i + k] = Math.round(d.data[i + k] / 51) * 51;
  }
  g.putImageData(d, 0, 0);
  return c;
}

// Procedural pixel face for "Random NPC".
function npcFace() {
  const c = document.createElement('canvas');
  c.width = c.height = 24;
  const g = c.getContext('2d');
  const hue = Math.floor(Math.random() * 360);
  g.fillStyle = `hsl(${hue},25%,20%)`; g.fillRect(0, 0, 24, 24);
  g.fillStyle = `hsl(${20 + Math.random() * 20},45%,${45 + Math.random() * 30}%)`; g.fillRect(4, 5, 16, 17);
  g.fillStyle = `hsl(${hue},40%,15%)`; g.fillRect(3, 2, 18, 5);
  g.fillStyle = '#000'; g.fillRect(7, 11, 3, 3); g.fillRect(14, 11, 3, 3);
  g.fillStyle = '#fff'; g.fillRect(7, 11, 1, 1); g.fillRect(14, 11, 1, 1);
  g.fillStyle = '#5a2020'; g.fillRect(9, 18, 6, 1);
  return c;
}

let D = null;              // host app hooks
let canvas, g;
let state = 'idle';        // idle | count | play | over
let players = [], halves = [], chars = [];
let t = 0, countT = 0, raf = 0, last = 0, paused = false, winner = -1;
const keys = new Set();
const pointers = new Map();

/* ---------- Setup screen ---------- */
async function buildSetup() {
  const fs = D.running() ? D.getFaces() : [];
  const live = [...fs].sort((a, b) => b.lm[1].x - a.lm[1].x).slice(0, 2).map((f, k) => ({
    key: `live${k}`, label: `📷 Live face (${k === 0 ? 'left' : 'right'})`, name: `PLAYER ${k + 1}`,
    src: D.cropFace(f.lm).img, style: f.track?.style ?? k,
  }));
  const roster = D.roster().map(f => ({ key: f.id, label: `${f.name} (${f.mog})`, name: f.name, src: f.img, fighterId: f.id, style: D.styleOf(f) }));
  chars = [...live, ...roster, { key: 'npc', label: '🤖 Random NPC', name: 'NPC', src: null, style: 3 }];

  const p1 = live[0] ?? roster[0] ?? chars.at(-1);
  const p2 = live[1] ?? roster.find(r => r !== p1) ?? chars.at(-1);
  const shuffled = [...CLASS_KEYS].sort(() => Math.random() - 0.5);
  const defaults = [
    { char: p1.key, ctrl: live.length ? 'face' : 'touch', cls: shuffled[0] },
    { char: p2.key, ctrl: live.length >= 2 ? 'face' : 'cpu', cls: shuffled[1] },
  ];

  document.querySelectorAll('#questSetup .qp').forEach((card, i) => {
    const cs = card.querySelector('.qchar'), cc = card.querySelector('.qctrl'), ck = card.querySelector('.qclass');
    const img = card.querySelector('img'), desc = card.querySelector('.qdesc');
    cs.replaceChildren(...chars.map(c => new Option(c.label, c.key)));
    cs.value = defaults[i].char;
    ck.replaceChildren(...CLASS_KEYS.map(k => new Option(`${CLASSES[k].icon} ${CLASSES[k].name}`, k)));
    ck.value = defaults[i].cls;
    const faceOpt = new Option(`🙂 Move your head${D.running() ? '' : ' (start camera first)'}`, 'face');
    faceOpt.disabled = !D.running();
    cc.replaceChildren(faceOpt, new Option(`👆 Finger / ${i ? 'arrows + Enter' : 'WASD + F'}`, 'touch'), new Option('🤖 CPU', 'cpu'));
    cc.value = defaults[i].ctrl;
    const preview = () => {
      const c = chars.find(x => x.key === cs.value);
      img.src = c?.src || npcFace().toDataURL();
    };
    const showDesc = () => {
      const k = CLASSES[ck.value];
      desc.textContent = k.desc;
      card.style.setProperty('--cls', k.trim);
    };
    cs.onchange = preview;
    ck.onchange = showDesc;
    preview();
    showDesc();
  });
}

async function startGame() {
  const cards = [...document.querySelectorAll('#questSetup .qp')];
  const sel = await Promise.all(cards.map(async (card, i) => {
    const c = chars.find(x => x.key === card.querySelector('.qchar').value) || chars.at(-1);
    return {
      name: c.key === 'npc' ? `NPC ${i + 1}` : c.name,
      face: c.src ? await pixelFace(c.src) : npcFace(),
      fighterId: c.fighterId, style: c.style,
      control: card.querySelector('.qctrl').value,
      cls: card.querySelector('.qclass').value,
    };
  }));
  const seed = (Math.random() * 2 ** 32) >>> 0; // same seed both halves = fair, mirrored spawns
  players = sel.map((s, i) => makePlayer(i, s));
  halves = [0, 1].map(() => makeHalf(seed));
  t = 0; winner = -1; paused = false;
  state = 'count'; countT = 3;
  $('#questSetup').classList.add('hidden');
  $('#questBar').classList.remove('hidden');
  $('#questAgain').classList.add('hidden');
  $('#questPause').textContent = '⏸ PAUSE';
  chip.blip();
}

function makePlayer(i, s) {
  return {
    i, ...s, x: HALF / 2, y: H * 0.8, tx: HALF / 2, ty: H * 0.8,
    hp: 3, xp: 0, stage: 0, shield: 0, inv: 0, evolveT: 0, beamT: 2.5, beamFx: 0,
    charge: 0.3, bear: 0, vanish: 0, slow: 0, summon: 0, castT: 0, wantCast: false, mouthWas: false,
    walk: 0, cpuT: 0, dead: false, orbs: 0, minionPos: [],
  };
}

function makeHalf(seed) {
  return {
    items: [], parts: [], texts: [], fx: [], rng: rng(seed), spawnT: 1, shake: 0, flash: 0, flashColor: '255,255,255', grid: 0,
    stars: Array.from({ length: 40 }, () => ({ x: Math.random() * HALF, y: Math.random() * H, s: Math.random() < 0.2 ? 2 : 1, v: 10 + Math.random() * 40 })),
  };
}

/* ---------- Simulation helpers ---------- */
function text(h, x, y, s, color = '#fff', size = 8) { h.texts.push({ x, y, s, color, size, life: 1.3 }); }
function burst(h, x, y, color, n = 8) {
  for (let k = 0; k < n; k++) {
    const a = Math.random() * Math.PI * 2, v = 40 + Math.random() * 90;
    h.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5 + Math.random() * 0.3, color, grav: 160 });
  }
}

// Ambient class particles around each hero.
function ambient(p, h) {
  if (p.dead || Math.random() > 0.6) return;
  const c = CLASSES[p.cls], s = STAGES[p.stage].size;
  const x = p.x + (Math.random() - 0.5) * s * 1.4, y = p.y + (Math.random() - 0.5) * s;
  const part = { x, y, vx: 0, vy: 0, life: 0.8 + Math.random() * 0.5, color: c.fx, grav: 0 };
  if (p.cls === 'necro') { part.vy = -25; part.vx = (Math.random() - 0.5) * 10; }
  else if (p.cls === 'mage') { const a = Math.random() * Math.PI * 2; part.x = p.x + Math.cos(a) * s; part.y = p.y + Math.sin(a) * s * 0.6; part.vx = -Math.sin(a) * 30; part.vy = Math.cos(a) * 18; }
  else if (p.cls === 'druid') { part.y = p.y - s; part.vy = 20; part.vx = (Math.random() - 0.5) * 30; part.color = Math.random() < 0.5 ? '#a3e635' : '#4d7c0f'; }
  else if (p.cls === 'paladin') { part.vy = -35; }
  else if (p.cls === 'rogue') { part.vy = -8; part.vx = (Math.random() - 0.5) * 16; part.color = Math.random() < 0.7 ? '#55556a' : '#ff2e4d'; }
  else if (p.cls === 'warlock') { part.vy = -45; part.vx = (Math.random() - 0.5) * 20; part.color = Math.random() < 0.5 ? '#ff7a00' : '#ffd400'; }
  h.parts.push(part);
}

function spawn(h, diff) {
  const r = h.rng(), x = 16 + h.rng() * (HALF - 32), vy = (45 + h.rng() * 35) * (0.8 + diff * 0.35);
  const type = r < 0.45 ? 'orb' : r < 0.86 ? 'hazard' : r < 0.93 ? 'mew' : 'bomb';
  const drift = h.rng() < 0.3 && type === 'hazard' ? (h.rng() - 0.5) * 70 : 0;
  h.items.push({ type, x, y: -12, vy, vx: drift, r: type === 'hazard' ? 7 : 6 });
}

function sendGarbage(to, n, type = 'garbage') {
  const h = halves[to];
  for (let k = 0; k < n; k++) {
    const fast = type === 'meteor';
    h.items.push({
      type, x: 16 + Math.random() * (HALF - 32), y: -14 - k * (fast ? 40 : 26),
      vy: fast ? 150 + Math.random() * 60 : 95 + Math.random() * 45, vx: fast ? (Math.random() - 0.5) * 60 : 0, r: 8,
    });
  }
  text(h, HALF / 2, 60, type === 'meteor' ? `METEORS x${n}!` : type === 'skeleton' ? `SKELETONS x${n}!` : `INCOMING x${n}!`, '#b026ff');
  chip.warn();
}

function damage(p, h) {
  p.hp--;
  p.xp = Math.max(0, p.xp - 40);
  p.inv = 1.3;
  h.shake = 7;
  chip.hurt();
  burst(h, p.x, p.y, '#ff2e4d', 12);
  text(h, p.x, p.y - 26, 'TOOK AN L', '#ff2e4d');
  if (p.hp <= 0) {
    p.dead = true;
    text(h, HALF / 2, H / 2, 'WASTED', '#c8102e', 12);
    sfx.faaah(p.style);
  }
}

function collectOrb(p, h, it, xp) {
  it.dead = true;
  p.xp += xp;
  p.orbs++;
  p.charge = Math.min(1, p.charge + 0.06);
  chip.coin();
  burst(h, it.x, it.y, '#ffd400', 6);
}

/* ---------- Class powers ---------- */
function cast(p) {
  if (p.dead || p.charge < 1) return;
  const i = p.i, h = halves[i], o = players[1 - i], oh = halves[1 - i], c = CLASSES[p.cls];
  p.charge = 0;
  p.castT = 1.2;
  h.flash = 0.35; h.flashColor = hexRgb(c.fx);
  text(h, HALF / 2, H * 0.28, `${c.power}!`, c.fx, 12);
  sfx.boom();

  if (p.cls === 'necro') {
    let n = 0;
    for (const it of h.items) {
      if (!it.dead && isBad(it)) { it.dead = true; n++; h.fx.push({ kind: 'soul', x: it.x, y: it.y, life: 0.8 }); }
    }
    p.xp += n * 5;
    p.summon = 8;
    sendGarbage(1 - i, n + 2, 'skeleton');
    chip.down();
  } else if (p.cls === 'mage') {
    h.fx.push({ kind: 'nova', x: p.x, y: p.y, life: 0.6, color: c.fx });
    for (const it of h.items) {
      if (!it.dead && isBad(it) && Math.hypot(it.x - p.x, it.y - p.y) < 140) {
        Object.assign(it, { type: 'orb', vy: 40, vx: 0, r: 6 });
        burst(h, it.x, it.y, c.fx, 5);
      }
    }
    chip.power();
  } else if (p.cls === 'druid') {
    p.bear = 6;
    p.hp = Math.min(3, p.hp + 1);
    text(h, p.x, p.y - 40, '+1 ❤', '#a3e635');
    for (let k = 0; k < 20; k++) burst(h, p.x, p.y, k % 2 ? '#a3e635' : '#6b4423', 1);
    chip.bomb();
  } else if (p.cls === 'paladin') {
    p.shield = 6;
    p.hp = Math.min(3, p.hp + 1);
    h.fx.push({ kind: 'smite', x: p.x, life: 0.7 });
    for (const it of h.items) {
      if (!it.dead && isBad(it) && Math.abs(it.x - p.x) < 45 && it.y < p.y) { it.dead = true; burst(h, it.x, it.y, '#fff3b0', 6); }
    }
    sfx.ding();
  } else if (p.cls === 'rogue') {
    p.vanish = 4;
    const amt = Math.round(Math.min(60, o.xp));
    o.xp -= amt; p.xp += amt;
    text(oh, o.x, o.y - 30, `-${amt} STOLEN`, '#ff2e4d');
    text(h, p.x, p.y - 40, `+${amt} YOINK`, '#ffd400');
    for (let k = 0; k < 6; k++) oh.fx.push({ kind: 'coin', x: o.x, y: o.y, vx: (Math.random() - 0.5) * 120, vy: -80 - Math.random() * 60, life: 0.8 });
    sfx.whoosh();
  } else if (p.cls === 'warlock') {
    sendGarbage(1 - i, 5, 'meteor');
    o.slow = 4;
    text(oh, o.x, o.y - 30, 'SLOWED', '#ff7a00');
    chip.bomb();
  }
}

function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

/* ---------- Input → movement ---------- */
function faceFor(i) {
  const fs = D.getFaces();
  if (!fs.length) return null;
  const split = players.filter(q => q.control === 'face').length > 1;
  const cand = split ? fs.filter(f => (i === 0) === (1 - f.lm[1].x < 0.5)) : fs;
  return cand.length ? cand.reduce((a, b) => (b.box.w > a.box.w ? b : a)) : null;
}

function faceTarget(i, f) {
  const split = players.filter(q => q.control === 'face').length > 1;
  let nx = 1 - f.lm[1].x;
  if (split) nx = i === 0 ? nx * 2 : (nx - 0.5) * 2;
  const ax = clamp((nx - 0.5) * 2.2 + 0.5, 0, 1), ay = clamp((f.lm[1].y - 0.5) * 2.4 + 0.5, 0, 1);
  return [ax * HALF, H * 0.3 + ay * (H * 0.7 - 16)];
}

function cpu(p, h, dt) {
  p.cpuT -= dt;
  if (p.cpuT > 0) return;
  p.cpuT = 0.12 + Math.random() * 0.1;
  let best = null, bd = Infinity;
  for (const it of h.items) {
    if (it.dead || it.y > p.y + 10 || !['orb', 'mew', 'bomb'].includes(it.type)) continue;
    const d = Math.abs(it.x - p.x) + (p.y - it.y) * 0.5;
    if (d < bd) { bd = d; best = it; }
  }
  let tx = best ? best.x : HALF / 2;
  const ty = best ? clamp(best.y + 40, H * 0.55, H - 20) : H * 0.8;
  let threats = 0;
  for (const it of h.items) {
    if (it.dead || !isBad(it)) continue;
    threats++;
    if (it.y > p.y + 10 || it.y < p.y - 90 || p.bear > 0) continue;
    const dx = p.x - it.x;
    if (Math.abs(dx) < 30) tx += (dx >= 0 ? 1 : -1) * (34 - Math.abs(dx)) * 1.6;
  }
  p.tx = tx + (Math.random() - 0.5) * 14;
  p.ty = ty;
  const o = players[1 - p.i];
  if (p.charge >= 1 && (threats >= 3 || p.hp < 3 || p.cls === 'warlock' || (p.cls === 'rogue' && o.xp > 80))) p.wantCast = true;
}

function controlPlayer(p, h, dt) {
  if (p.dead) return;
  const K = p.i === 0 ? ['w', 'a', 's', 'd'] : ['arrowup', 'arrowleft', 'arrowdown', 'arrowright'];
  const kx = (keys.has(K[3]) ? 1 : 0) - (keys.has(K[1]) ? 1 : 0);
  const ky = (keys.has(K[2]) ? 1 : 0) - (keys.has(K[0]) ? 1 : 0);
  if (p.control !== 'cpu' && (kx || ky)) { p.tx = p.x + kx * 60; p.ty = p.y + ky * 60; }
  else if (p.control === 'face') {
    const f = faceFor(p.i);
    if (f) {
      if (![...pointers.values()].includes(p.i)) [p.tx, p.ty] = faceTarget(p.i, f);
      // Open your mouth to cast (edge-triggered so holding it open doesn't spam).
      const open = (f.blend?.jawOpen || 0) > 0.45;
      if (open && !p.mouthWas) p.wantCast = true;
      p.mouthWas = open;
    }
  } else if (p.control === 'cpu') cpu(p, h, dt);
  if (p.wantCast) { p.wantCast = false; cast(p); }
  p.tx = clamp(p.tx, 12, HALF - 12);
  p.ty = clamp(p.ty, H * 0.3, H - 16);
  const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
  const speed = 220 * STAGES[p.stage].speed * (p.slow > 0 ? 0.55 : 1) * (p.bear > 0 ? 1.1 : 1);
  const step = Math.min(d, speed * dt);
  if (d > 0.5) { p.x += dx / d * step; p.y += dy / d * step; p.walk += dt * 10; }
}

/* ---------- Main update ---------- */
function update(dt) {
  for (const h of halves) {
    for (const s of h.stars) { s.y += s.v * dt * (state === 'play' ? 1 : 0.3); if (s.y > H) { s.y = 0; s.x = Math.random() * HALF; } }
    h.grid = (h.grid + dt * 30) % 16;
  }
  if (state === 'count') {
    const before = Math.ceil(countT);
    countT -= dt;
    if (Math.ceil(countT) !== before) countT > 0 ? chip.blip() : (chip.evolve(), chip.start());
    if (countT <= 0) state = 'play';
    return;
  }
  if (state !== 'play') return;

  t += dt;
  const diff = 1 + t / 45;
  halves.forEach((h, i) => {
    const p = players[i], o = players[1 - i], st = STAGES[p.stage];
    h.spawnT -= dt;
    if (h.spawnT <= 0) { h.spawnT = Math.max(0.28, 0.85 / diff); spawn(h, diff); }
    controlPlayer(p, h, dt);
    for (const k of ['inv', 'shield', 'evolveT', 'beamFx', 'bear', 'vanish', 'slow', 'summon', 'castT']) p[k] = Math.max(0, p[k] - dt);
    if (!p.dead) {
      p.xp += dt * 3 * diff;                        // heroes evolve over time on their own
      p.charge = Math.min(1, p.charge + dt / 14);   // class power recharges
      if (p.charge >= 1 && !p.readyShown) { p.readyShown = true; chip.power(); text(h, p.x, p.y - 36, 'POWER READY', CLASSES[p.cls].fx); }
      if (p.charge < 1) p.readyShown = false;
    }
    ambient(p, h);

    const minionCount = (st.minions || 0) + (p.summon > 0 ? 2 : 0);
    p.minionPos = Array.from({ length: minionCount }, (_, k) => {
      const a = t * 3 + k * (Math.PI * 2 / minionCount);
      return { x: p.x + Math.cos(a) * 28, y: p.y + Math.sin(a) * 15 };
    });

    const pr = st.size * (p.bear > 0 ? 0.8 : 0.55);
    for (const it of h.items) {
      it.y += it.vy * dt;
      it.x += it.vx * dt;
      if (it.x < 8 || it.x > HALF - 8) it.vx *= -1;
      if (it.type === 'meteor' && Math.random() < 0.7) h.parts.push({ x: it.x, y: it.y - 6, vx: 0, vy: -20, life: 0.3, color: Math.random() < 0.5 ? '#ff7a00' : '#ffd400', grav: 0 });
      if (it.dead || p.dead) continue;
      const hit = (x, y, r) => Math.hypot(it.x - x, it.y - y) < r + it.r;
      if (it.type === 'orb') {
        if (hit(p.x, p.y, pr)) collectOrb(p, h, it, 20);
        else if (p.minionPos.some(m => hit(m.x, m.y, 5))) collectOrb(p, h, it, 10);
        continue;
      }
      if (!hit(p.x, p.y, pr)) continue;
      if (isBad(it) && p.vanish > 0) continue; // shadow form: hazards pass through
      it.dead = true;
      if (it.type === 'mew') {
        p.shield = 5;
        chip.power();
        text(h, p.x, p.y - 26, 'MEW SHIELD', '#4dd2ff');
      } else if (it.type === 'bomb') {
        chip.bomb();
        for (const x of h.items) if (isBad(x)) { x.dead = true; burst(h, x.x, x.y, '#ff7a00', 5); }
        sendGarbage(1 - i, 3 + p.stage);
        text(h, p.x, p.y - 26, 'MOG BOMB!', '#ff7a00');
        h.flash = 0.25; h.flashColor = '255,255,255';
      } else if (p.bear > 0) {
        p.xp += 10;
        h.shake = 3;
        burst(h, it.x, it.y, '#a3e635', 8);
        chip.hurt();
      } else if (p.shield > 0) {
        burst(h, it.x, it.y, '#4dd2ff', 6);
        chip.blip();
      } else if (p.inv <= 0) {
        damage(p, h);
      }
    }

    // GIGACHAD mog beam: clears the column above and pressures the rival.
    if (st.beam && !p.dead) {
      p.beamT -= dt;
      if (p.beamT <= 0) {
        p.beamT = 2.5; p.beamFx = 0.25;
        chip.laser();
        let cleared = 0;
        for (const it of h.items) {
          if (!it.dead && isBad(it) && Math.abs(it.x - p.x) < 12 && it.y < p.y) { it.dead = true; cleared++; burst(h, it.x, it.y, '#ffd400', 6); }
        }
        if (cleared >= 2) sendGarbage(1 - i, Math.floor(cleared / 2));
      }
    }

    // Evolve / devolve
    let ns = 0;
    STAGES.forEach((s, k) => { if (p.xp >= s.xp) ns = k; });
    if (!p.dead && ns > p.stage) {
      p.stage = ns;
      p.evolveT = 1.2;
      chip.evolve();
      setTimeout(() => sfx.faaah(p.style, 0.7), 350);
      text(h, HALF / 2, H * 0.4, `EVOLVED: ${STAGES[ns].name}!`, STAGES[ns].color, 10);
      burst(h, p.x, p.y, STAGES[ns].color, 24);
      if (!o.dead) sendGarbage(1 - i, ns);
    } else if (ns < p.stage) {
      p.stage = ns;
      chip.down();
      text(h, HALF / 2, H * 0.4, `DEVOLVED: ${STAGES[ns].name}`, '#8a8a99', 10);
    }

    h.items = h.items.filter(it => !it.dead && it.y < H + 20);
    for (const q of h.parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += q.grav * dt; q.life -= dt; }
    h.parts = h.parts.filter(q => q.life > 0);
    if (h.parts.length > 400) h.parts.splice(0, h.parts.length - 400);
    for (const x of h.texts) { x.y -= 18 * dt; x.life -= dt; }
    h.texts = h.texts.filter(x => x.life > 0);
    for (const f of h.fx) {
      f.life -= dt;
      if (f.kind === 'soul') { f.y -= 160 * dt; f.x += Math.sin(f.life * 20) * 2; }
      if (f.kind === 'coin') { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 200 * dt; }
    }
    h.fx = h.fx.filter(f => f.life > 0);
    h.shake = Math.max(0, h.shake - dt * 25);
    h.flash = Math.max(0, h.flash - dt);
  });

  if (t >= ROUND || players.some(p => p.dead)) endGame();
}

function endGame() {
  state = 'over';
  chip.stop();
  const [a, b] = players;
  winner = a.dead !== b.dead ? (a.dead ? 1 : 0) : a.xp === b.xp ? -1 : a.xp > b.xp ? 0 : 1;
  chip.win();
  if (winner >= 0) {
    const w = players[winner], l = players[1 - winner];
    speak(`${w.name} the ${CLASSES[w.cls].name.toLowerCase()} mogs ${l.name}!`, { rate: 1 });
    setTimeout(() => sfx.faaah(l.style, 1.2), 700);
    D.onResult?.(w.fighterId, l.fighterId);
  } else {
    speak('Draw. Nobody mogs.', { rate: 1 });
  }
  $('#questAgain').classList.remove('hidden');
}

/* ---------- Rendering ---------- */
function px(x, y, s, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), s, s); }

function label(s, x, y, size = 8, color = '#fff', align = 'center') {
  g.font = `${size}px ${FONT}`;
  g.textAlign = align; g.textBaseline = 'middle';
  g.fillStyle = '#000'; g.fillText(s, x + 1, y + 1);
  g.fillStyle = color; g.fillText(s, x, y);
}

function emoji(ch, x, y, size) {
  g.font = `${size}px ${EMOJI}`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(ch, x, y);
}

function glow(x, y, r, color, a = 0.35) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalAlpha = a; g.fillStyle = gr;
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  g.globalAlpha = 1;
}

function drawItem(it) {
  const x = Math.round(it.x), y = Math.round(it.y);
  if (it.type === 'orb') {
    glow(x, y, 11, '#ffd400', 0.5);
    g.fillStyle = '#ffd400'; g.fillRect(x - 2, y - 6, 4, 12); g.fillRect(x - 6, y - 2, 12, 4); g.fillRect(x - 4, y - 4, 8, 8);
    px(x - 1, y - 1, 2, '#fff');
  } else if (it.type === 'hazard') {
    g.fillStyle = '#000'; g.fillRect(x - 8, y - 8, 16, 16);
    g.fillStyle = '#ff2e4d'; g.fillRect(x - 7, y - 7, 14, 14);
    g.fillStyle = '#fff'; g.fillRect(x - 3, y - 4, 2, 8); g.fillRect(x - 3, y + 2, 6, 2); // pixel "L"
  } else if (it.type === 'garbage') {
    g.fillStyle = '#000'; g.fillRect(x - 10, y - 8, 20, 16);
    g.fillStyle = '#b026ff'; g.fillRect(x - 9, y - 7, 18, 14);
    px(x - 5, y - 3, 3, '#fff'); px(x + 2, y - 3, 3, '#fff');
    g.fillStyle = '#2a0a3d'; g.fillRect(x - 4, y + 3, 8, 2);
  } else if (it.type === 'skeleton') {
    glow(x, y, 12, '#7dff6a', 0.35);
    g.fillStyle = '#000'; g.fillRect(x - 8, y - 9, 16, 16);
    g.fillStyle = '#e8e8e8'; g.fillRect(x - 7, y - 8, 14, 11); g.fillRect(x - 4, y + 3, 8, 3);
    g.fillStyle = '#000'; g.fillRect(x - 5, y - 5, 4, 4); g.fillRect(x + 1, y - 5, 4, 4); g.fillRect(x - 1, y, 2, 2);
    px(x - 4, y - 4, 2, '#7dff6a'); px(x + 2, y - 4, 2, '#7dff6a');
    g.fillStyle = '#000'; g.fillRect(x - 3, y + 3, 1, 3); g.fillRect(x, y + 3, 1, 3); g.fillRect(x + 2, y + 3, 1, 3);
  } else if (it.type === 'meteor') {
    glow(x, y, 16, '#ff7a00', 0.55);
    g.fillStyle = '#3a1a0a'; g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ff7a00'; g.fillRect(x - 3, y - 3, 3, 3); g.fillRect(x + 1, y + 1, 3, 2);
    px(x - 1, y - 5, 2, '#ffd400');
  } else if (it.type === 'mew') {
    glow(x, y, 12, '#4dd2ff', 0.4);
    g.fillStyle = '#4dd2ff'; g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fill();
    label('M', x, y + 1, 8, '#04121f');
  } else if (it.type === 'bomb') {
    g.fillStyle = '#111'; g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#555'; g.fillRect(x - 3, y - 4, 2, 2);
    px(x + 4, y - 9, 2, Math.random() < 0.5 ? '#ff7a00' : '#fff3b0');
  }
}

// Class weapon, drawn beside the body.
function drawWeapon(p, x, top, bottom, s) {
  const bob = Math.round(Math.sin(t * 4) * 1.5);
  const c = CLASSES[p.cls];
  if (['mage', 'necro', 'druid'].includes(p.cls)) {
    g.fillStyle = '#000'; g.fillRect(x - 1, top - 1 + bob, 4, bottom - top + 2);
    g.fillStyle = p.cls === 'necro' ? '#3b2a4a' : '#8b5a2b'; g.fillRect(x, top + bob, 2, bottom - top);
    const hx = x + 1, hy = top + bob - 3;
    if (p.cls === 'mage') {
      glow(hx, hy, 12, c.fx, 0.6 + 0.2 * Math.sin(t * 8));
      g.fillStyle = '#7fd4ff'; g.fillRect(hx - 3, hy - 3, 6, 6); px(hx - 2, hy - 2, 2, '#fff');
    } else if (p.cls === 'necro') {
      glow(hx, hy, 12, c.fx, 0.5);
      g.fillStyle = '#e8e8e8'; g.fillRect(hx - 4, hy - 4, 8, 6); g.fillRect(hx - 2, hy + 2, 4, 2);
      px(hx - 3, hy - 2, 2, '#7dff6a'); px(hx + 1, hy - 2, 2, '#7dff6a');
    } else {
      g.fillStyle = '#4d7c0f'; g.fillRect(hx - 4, hy - 2, 3, 3); g.fillRect(hx + 1, hy - 4, 3, 3);
      g.fillStyle = '#a3e635'; g.fillRect(hx - 2, hy - 5, 3, 3); g.fillRect(hx + 2, hy, 3, 3);
    }
  } else if (p.cls === 'paladin') {
    g.fillStyle = '#000'; g.fillRect(x - 1, top - 3 + bob, 4, s + 2);
    g.fillStyle = '#e6edf5'; g.fillRect(x, top - 2 + bob, 2, s);
    g.fillStyle = '#ffd400'; g.fillRect(x - 3, top + s - 6 + bob, 8, 2);
    g.fillStyle = '#6b4423'; g.fillRect(x, top + s - 4 + bob, 2, 4);
  } else if (p.cls === 'rogue') {
    for (const [dx, dir] of [[0, 1], [-s * 1.25, -1]]) {
      const bx = Math.round(x + dx);
      g.fillStyle = '#c0c7d0'; g.fillRect(bx, top + s * 0.5 + bob, 2, 7);
      g.fillStyle = '#ff2e4d'; g.fillRect(bx - dir, top + s * 0.5 + 7 + bob, 4, 2);
    }
  } else if (p.cls === 'warlock') {
    const hx = x + 3, hy = top + s * 0.55 + bob;
    glow(hx, hy, 14, '#ff7a00', 0.6 + 0.3 * Math.random());
    g.fillStyle = '#ff7a00'; g.fillRect(hx - 3, hy - 3, 6, 6);
    g.fillStyle = '#ffd400'; g.fillRect(hx - 1, hy - 4 - Math.round(Math.random() * 2), 2, 3);
    g.fillStyle = '#3b0a2a'; g.fillRect(x - s * 1.3, hy - 3, 7, 8); // grimoire
    g.fillStyle = '#b026ff'; g.fillRect(x - s * 1.3 + 1, hy - 2, 5, 1);
  }
}

// Class headgear, drawn over the face sprite.
function drawHeadgear(p, hx, hy, s) {
  if (p.cls === 'mage') {
    g.fillStyle = '#000';
    g.beginPath(); g.moveTo(hx - 4, hy + 3); g.lineTo(hx + s + 4, hy + 3); g.lineTo(hx + s * 0.62, hy - s * 0.95); g.closePath(); g.fill();
    g.fillStyle = '#1e3a8a';
    g.beginPath(); g.moveTo(hx - 3, hy + 2); g.lineTo(hx + s + 3, hy + 2); g.lineTo(hx + s * 0.62, hy - s * 0.9); g.closePath(); g.fill();
    g.fillStyle = '#7fd4ff'; g.fillRect(hx - 3, hy, s + 6, 2);
    px(hx + s * 0.5, hy - s * 0.35, 2, '#ffd400');
  } else if (p.cls === 'necro' || p.cls === 'rogue') {
    const hood = p.cls === 'necro' ? '#2b1640' : '#1a1a1f';
    g.fillStyle = hood;
    g.fillRect(hx - 3, hy - 3, s + 6, 4); g.fillRect(hx - 3, hy - 3, 4, s + 4); g.fillRect(hx + s - 1, hy - 3, 4, s + 4);
    g.beginPath(); g.moveTo(hx + s * 0.25, hy - 3); g.lineTo(hx + s * 0.75, hy - 3); g.lineTo(hx + s * 0.5, hy - s * 0.35); g.closePath(); g.fill();
    if (p.cls === 'necro') {
      g.fillStyle = 'rgba(40,0,60,0.35)'; g.fillRect(hx, hy, s, s * 0.45);
      px(hx + s * 0.28, hy + s * 0.4, 2, '#7dff6a'); px(hx + s * 0.62, hy + s * 0.4, 2, '#7dff6a');
    } else {
      g.fillStyle = '#8b0f1f'; g.fillRect(hx, hy + s * 0.62, s, s * 0.38);
      g.fillStyle = '#ff2e4d'; g.fillRect(hx, hy + s * 0.62, s, 1);
    }
  } else if (p.cls === 'druid') {
    g.fillStyle = '#6b4423';
    for (const sgn of [-1, 1]) {
      const bx = sgn < 0 ? hx + 2 : hx + s - 4;
      g.fillRect(bx, hy - 8, 2, 8);
      g.fillRect(bx + sgn * 2, hy - 12, 2, 5);
      g.fillRect(bx - sgn * 3, hy - 7, 4, 2);
    }
    g.fillStyle = '#a3e635'; g.fillRect(hx + s * 0.4, hy - 3, 3, 3);
  } else if (p.cls === 'paladin') {
    g.fillStyle = '#c0c7d0'; g.fillRect(hx - 2, hy - 3, s + 4, Math.round(s * 0.35));
    g.fillStyle = '#e6edf5'; g.fillRect(hx - 2, hy - 3, s + 4, 2);
    g.fillStyle = '#c0c7d0'; g.fillRect(hx + s / 2 - 1, hy, 3, Math.round(s * 0.55));
    g.fillStyle = '#ff2e4d'; g.fillRect(hx + s / 2 - 1, hy - 9, 3, 7); g.fillRect(hx + s / 2 + 2, hy - 7, 3, 4);
  } else if (p.cls === 'warlock') {
    for (const sgn of [-1, 1]) {
      const bx = sgn < 0 ? hx : hx + s;
      g.fillStyle = '#1a0508';
      g.beginPath(); g.moveTo(bx - sgn * 1, hy + 2); g.lineTo(bx + sgn * 5, hy - 2); g.lineTo(bx + sgn * 3, hy - 10); g.closePath(); g.fill();
      px(bx + sgn * 3 - 1, hy - 10, 2, '#ff7a00');
    }
  }
}

function drawBear(p, x, y, s) {
  const bw = s * 1.1, by = y + s * 0.3;
  g.fillStyle = '#000'; g.fillRect(x - bw / 2 - 1, by - 1, bw + 2, s * 0.8 + 2);
  g.fillStyle = '#6b4423'; g.fillRect(x - bw / 2, by, bw, s * 0.8);
  g.fillStyle = '#8b5a2b'; g.fillRect(x - bw / 4, by + 3, bw / 2, s * 0.5);
  const f = Math.floor(p.walk) % 2;
  g.fillStyle = '#3b2412';
  g.fillRect(x - bw / 2 + 1, by + s * 0.8, 5, f ? 5 : 3);
  g.fillRect(x + bw / 2 - 6, by + s * 0.8, 5, f ? 3 : 5);
}

function drawPlayer(p) {
  if (p.dead) return;
  const st = STAGES[p.stage], c = CLASSES[p.cls];
  const s = Math.round(st.size * (p.bear > 0 ? 1.5 : 1)), x = Math.round(p.x), y = Math.round(p.y);

  for (const m of p.minionPos) {
    glow(m.x, m.y, 9, c.fx, 0.5);
    g.fillStyle = '#000'; g.fillRect(m.x - 5, m.y - 5, 10, 10);
    g.drawImage(p.face, m.x - 4, m.y - 4, 8, 8);
  }
  if (p.inv > 0 && Math.floor(p.inv * 12) % 2) return;
  g.globalAlpha = p.vanish > 0 ? 0.28 + 0.1 * Math.sin(t * 20) : 1;

  glow(x, y + s * 0.3, s * 1.3, c.fx, 0.18 + (p.charge >= 1 ? 0.2 + 0.15 * Math.sin(t * 8) : 0));
  if (st.flame) {
    for (let k = 0; k < 12; k++) {
      const a = Math.random() * Math.PI * 2, r = s * 0.75 + Math.random() * 5;
      px(x + Math.cos(a) * r, y + Math.sin(a) * r - Math.random() * 6, 2, k % 2 ? c.fx : st.color);
    }
  }

  const hx = x - s / 2, hy = y - s / 2 - Math.round(s * 0.1);
  if (p.bear > 0) {
    drawBear(p, x, y, s);
  } else {
    // Robe with class colours; the hem stripe shows the evolution tier.
    const bw = s * 0.9, bh = s * 0.72, by = y + Math.round(s * 0.4);
    g.fillStyle = '#000';
    g.beginPath(); g.moveTo(x - bw * 0.35 - 1, by - 1); g.lineTo(x + bw * 0.35 + 1, by - 1); g.lineTo(x + bw * 0.58 + 1, by + bh + 1); g.lineTo(x - bw * 0.58 - 1, by + bh + 1); g.closePath(); g.fill();
    g.fillStyle = c.robe;
    g.beginPath(); g.moveTo(x - bw * 0.35, by); g.lineTo(x + bw * 0.35, by); g.lineTo(x + bw * 0.58, by + bh); g.lineTo(x - bw * 0.58, by + bh); g.closePath(); g.fill();
    g.fillStyle = c.trim; g.fillRect(x - 1, by, 2, bh); g.fillRect(x - bw * 0.3, by + 2, bw * 0.6, 2);
    g.fillStyle = st.color; g.fillRect(x - bw * 0.58, by + bh - 3, bw * 1.16, 3);
    const f = Math.floor(p.walk) % 2;
    g.fillStyle = '#111';
    g.fillRect(x - bw * 0.3, by + bh, 3, f ? 4 : 2);
    g.fillRect(x + bw * 0.3 - 3, by + bh, 3, f ? 2 : 4);
    if (p.cls === 'paladin') {
      // Shield on the off-hand
      const sx = x - bw * 0.72, sy = by + 1;
      g.fillStyle = '#000'; g.fillRect(sx - 1, sy - 1, 10, 13);
      g.fillStyle = '#c0c7d0'; g.fillRect(sx, sy, 8, 11);
      g.fillStyle = '#ffd400'; g.fillRect(sx + 3, sy + 1, 2, 9); g.fillRect(sx + 1, sy + 4, 6, 2);
    }
    drawWeapon(p, Math.round(x + bw * 0.62), by - s * 0.55, by + bh, s);
  }

  g.fillStyle = '#000'; g.fillRect(hx - 1, hy - 1, s + 2, s + 2);
  g.drawImage(p.face, hx, hy, s, s);
  if (p.bear > 0) {
    g.fillStyle = '#6b4423'; g.fillRect(hx - 3, hy - 4, 7, 7); g.fillRect(hx + s - 4, hy - 4, 7, 7);
    g.fillStyle = '#d19a6a'; g.fillRect(hx - 1, hy - 2, 3, 3); g.fillRect(hx + s - 2, hy - 2, 3, 3);
  } else {
    drawHeadgear(p, hx, hy, s);
  }
  if (st.crown) {
    const cy = hy - (p.cls === 'mage' ? s * 0.95 + 4 : 10);
    g.fillStyle = '#ffd400';
    g.fillRect(hx + 3, cy, s - 6, 4);
    for (let k = 0; k < 3; k++) g.fillRect(hx + 3 + k * (s - 8) / 2, cy - 4, 2, 4);
    px(hx + s / 2 - 1, cy + 1, 2, '#ff2e4d');
  }
  g.globalAlpha = 1;

  if (p.shield > 0) {
    g.strokeStyle = p.cls === 'paladin' ? `rgba(255,243,176,${0.6 + 0.4 * Math.sin(t * 10)})` : `rgba(77,210,255,${0.5 + 0.5 * Math.sin(t * 10)})`;
    g.lineWidth = 2;
    g.beginPath(); g.arc(x, y + 3, s * 0.95, 0, Math.PI * 2); g.stroke();
  }
  if (p.slow > 0) label('❄', x + s * 0.6, hy - 4, 8, '#7fd4ff');
  if (p.beamFx > 0) {
    g.fillStyle = `rgba(255,212,0,${p.beamFx * 3})`; g.fillRect(x - 6, 0, 12, hy);
    g.fillStyle = `rgba(255,255,255,${p.beamFx * 3})`; g.fillRect(x - 2, 0, 4, hy);
  }
  if (p.evolveT > 0) {
    g.globalAlpha = Math.abs(Math.sin(p.evolveT * 20));
    g.fillStyle = '#fff'; g.fillRect(hx - 2, hy - 2, s + 4, s * 1.9);
    g.globalAlpha = 1;
  }
}

function drawFx(h) {
  for (const f of h.fx) {
    if (f.kind === 'nova') {
      const r = (1 - f.life / 0.6) * 150;
      g.strokeStyle = f.color; g.globalAlpha = f.life / 0.6; g.lineWidth = 4;
      g.beginPath(); g.arc(f.x, f.y, r, 0, Math.PI * 2); g.stroke();
      g.lineWidth = 1; g.beginPath(); g.arc(f.x, f.y, r * 0.7, 0, Math.PI * 2); g.stroke();
      g.globalAlpha = 1;
    } else if (f.kind === 'smite') {
      const a = f.life / 0.7;
      g.fillStyle = `rgba(255,243,176,${a * 0.6})`; g.fillRect(f.x - 45, 0, 90, H);
      g.fillStyle = `rgba(255,255,255,${a})`; g.fillRect(f.x - 8, 0, 16, H);
    } else if (f.kind === 'soul') {
      glow(f.x, f.y, 10, '#7dff6a', 0.6);
      px(f.x - 2, f.y - 2, 4, '#c8ffc0');
    } else if (f.kind === 'coin') {
      g.fillStyle = '#ffd400'; g.fillRect(f.x - 2, f.y - 2, 5, 5);
      px(f.x - 1, f.y - 1, 1, '#fff');
    }
  }
}

// Power button: tap target for finger players, charge ring for everyone.
const BTN = { x: HALF - 28, y: H - 30, r: 18 };
function drawPowerButton(p) {
  const c = CLASSES[p.cls], ready = p.charge >= 1;
  g.fillStyle = 'rgba(0,0,0,0.6)'; g.beginPath(); g.arc(BTN.x, BTN.y, BTN.r, 0, Math.PI * 2); g.fill();
  if (ready) glow(BTN.x, BTN.y, BTN.r * 1.8, c.fx, 0.4 + 0.25 * Math.sin(t * 8));
  g.strokeStyle = '#333'; g.lineWidth = 3;
  g.beginPath(); g.arc(BTN.x, BTN.y, BTN.r, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = c.fx;
  g.beginPath(); g.arc(BTN.x, BTN.y, BTN.r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p.charge); g.stroke();
  g.globalAlpha = ready ? 1 : 0.45;
  emoji(c.icon, BTN.x, BTN.y + 1, 16);
  g.globalAlpha = 1;
  if (ready) {
    const hint = p.control === 'face' ? 'OPEN MOUTH' : p.control === 'cpu' ? 'READY' : p.i ? 'TAP/ENTER' : 'TAP / F';
    label(hint, BTN.x - BTN.r - 4, BTN.y, 6, c.fx, 'right');
  }
}

function drawHud(p) {
  const st = STAGES[p.stage], next = STAGES[p.stage + 1], c = CLASSES[p.cls];
  const ox = p.i ? 28 : 8; // clear the round timer on the divider
  label(`P${p.i + 1} ${p.name.slice(0, 10).toUpperCase()}`, ox, 12, 8, c.fx, 'left');
  for (let k = 0; k < 3; k++) {
    const col = k < p.hp ? '#ff2e4d' : '#333';
    const hx = ox + k * 12, hy = 22;
    g.fillStyle = col; g.fillRect(hx, hy + 1, 3, 3); g.fillRect(hx + 4, hy + 1, 3, 3); g.fillRect(hx + 1, hy + 3, 5, 3); g.fillRect(hx + 2, hy + 6, 3, 1);
  }
  label(`${st.name} ${c.name}`, ox + 38, 26, 6, st.color, 'left');
  const bx = ox, by = 36, bwid = 130;
  g.fillStyle = '#000'; g.fillRect(bx - 1, by - 1, bwid + 2, 6);
  g.fillStyle = '#222'; g.fillRect(bx, by, bwid, 4);
  const prog = next ? clamp((p.xp - st.xp) / (next.xp - st.xp), 0, 1) : 1;
  g.fillStyle = next ? next.color : '#ffd400'; g.fillRect(bx, by, bwid * prog, 4);
  label(`✦${p.orbs}`, p.i ? HALF - 10 : HALF - 28, 12, 8, '#ffd400', 'right');
  if (state === 'play' && !p.dead) drawPowerButton(p);
}

function drawHalf(i) {
  const h = halves[i], p = players[i];
  const st = p ? STAGES[p.stage] : STAGES[0];
  const tint = p ? CLASSES[p.cls].fx : st.color;
  g.save();
  g.beginPath(); g.rect(i * HALF, 0, HALF, H); g.clip();
  g.translate(i * HALF + (Math.random() - 0.5) * h.shake, (Math.random() - 0.5) * h.shake);
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#05030a'); bg.addColorStop(1, tint + '40');
  g.fillStyle = bg; g.fillRect(-10, -10, HALF + 20, H + 20);
  for (const s of h.stars) px(s.x, s.y, s.s, s.s > 1 ? '#fff' : '#8d86a3');
  // Synthwave floor
  const hz = H * 0.62;
  g.strokeStyle = tint + '50'; g.lineWidth = 1;
  for (let k = 0; k < 10; k++) {
    const yy = hz + Math.pow((k * 16 + h.grid) / 160, 2) * (H - hz);
    g.beginPath(); g.moveTo(0, yy); g.lineTo(HALF, yy); g.stroke();
  }
  for (let k = -6; k <= 6; k++) {
    g.beginPath(); g.moveTo(HALF / 2 + k * 8, hz); g.lineTo(HALF / 2 + k * 60, H); g.stroke();
  }
  for (const it of h.items) drawItem(it);
  for (const q of h.parts) { g.globalAlpha = clamp(q.life * 2, 0, 1); px(q.x, q.y, 2, q.color); }
  g.globalAlpha = 1;
  if (p) drawPlayer(p);
  drawFx(h);
  for (const x of h.texts) { g.globalAlpha = clamp(x.life, 0, 1); label(x.s, x.x, x.y, x.size, x.color); g.globalAlpha = 1; }
  if (h.flash > 0) { g.fillStyle = `rgba(${h.flashColor},${h.flash * 1.6})`; g.fillRect(0, 0, HALF, H); }
  if (p) {
    drawHud(p);
    if (p.dead) {
      g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(0, 0, HALF, H);
      label('WASTED', HALF / 2, H / 2, 20, '#c8102e');
    }
  }
  g.restore();
}

function draw() {
  g.imageSmoothingEnabled = false;
  g.fillStyle = '#05030a'; g.fillRect(0, 0, W, H);
  if (state === 'idle') {
    halves.forEach((_, i) => drawHalf(i));
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 0, W, H);
    label('MOG QUEST', W / 2, H * 0.3, 32, '#ffd400');
    label('FROM NPC TO GIGACHAD', W / 2, H * 0.44, 8, '#ff4dd2');
    CLASS_KEYS.forEach((k, n) => {
      const x = W / 2 + (n - 2.5) * 70, y = H * 0.6 + Math.sin(performance.now() / 300 + n) * 3;
      glow(x, y, 22, CLASSES[k].fx, 0.4);
      emoji(CLASSES[k].icon, x, y, 22);
      label(CLASSES[k].name, x, y + 24, 5, CLASSES[k].fx);
    });
    if (Math.floor(performance.now() / 500) % 2) label('PICK FIGHTERS  ▼  PRESS START', W / 2, H * 0.86, 8, '#fff');
    return;
  }
  halves.forEach((_, i) => drawHalf(i));
  g.fillStyle = '#000'; g.fillRect(HALF - 3, 0, 6, H);
  for (let y = 0; y < H; y += 8) { g.fillStyle = (y / 8) % 2 ? '#b026ff' : '#ff2e4d'; g.fillRect(HALF - 2, y, 4, 4); }
  g.fillStyle = '#000'; g.fillRect(HALF - 22, 4, 44, 18);
  const remaining = Math.max(0, Math.ceil(ROUND - t));
  label(String(remaining), HALF, 14, 10, remaining <= 10 ? '#ff2e4d' : '#fff');
  label('VS', HALF, H - 12, 8, '#ff2e4d');

  if (state === 'count') {
    const n = Math.ceil(countT);
    label(n > 0 ? String(n) : 'GO!', W / 2, H / 2, 40, n > 0 ? '#fff' : '#28ff8a');
  }
  if (paused && state === 'play') {
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(0, 0, W, H);
    label('PAUSED', W / 2, H / 2, 24, '#fff');
  }
  if (state === 'over') {
    g.fillStyle = 'rgba(0,0,0,0.65)'; g.fillRect(0, 0, W, H);
    if (winner >= 0) {
      const w = players[winner], l = players[1 - winner], c = CLASSES[w.cls];
      label(`PLAYER ${winner + 1} WINS!`, W / 2, H * 0.24, 24, c.fx);
      label(`${w.name.toUpperCase()} MOGS ${l.name.toUpperCase()}`, W / 2, H * 0.38, 10, '#fff');
      label(`${STAGES[w.stage].name} ${c.name}  ·  ✦${w.orbs}`, W / 2, H * 0.48, 8, '#ffd400');
      glow(W / 2, H * 0.72, 60, c.fx, 0.5);
      g.fillStyle = '#000'; g.fillRect(W / 2 - 34, H * 0.58, 68, 68);
      g.drawImage(w.face, W / 2 - 32, H * 0.58 + 2, 64, 64);
      emoji(c.icon, W / 2 + 44, H * 0.58 + 8, 20);
    } else {
      label('DRAW', W / 2, H * 0.4, 32, '#fff');
      label('NOBODY MOGS', W / 2, H * 0.55, 10, '#8d86a3');
    }
  }
}

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!paused) update(dt);
  draw();
  raf = requestAnimationFrame(frame);
}

/* ---------- Input ---------- */
function toLocal(e) {
  const r = canvas.getBoundingClientRect();
  return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H];
}

function onPointer(e) {
  if (state !== 'play' && state !== 'count') return;
  const [x, y] = toLocal(e);
  let i = pointers.get(e.pointerId);
  if (e.type === 'pointerdown') {
    i = x < HALF ? 0 : 1;
    const p = players[i];
    if (!p || p.control === 'cpu') return;
    if (Math.hypot(x - i * HALF - BTN.x, y - BTN.y) < BTN.r + 6) { p.wantCast = true; return; }
    pointers.set(e.pointerId, i);
    canvas.setPointerCapture(e.pointerId);
  }
  if (i === undefined) return;
  const p = players[i];
  p.tx = x - i * HALF;
  p.ty = y - 26; // keep the hero visible above the finger
}

function onKey(e) {
  if (!questOpen()) return;
  const k = e.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'enter'].includes(k)) e.preventDefault();
  if (e.type === 'keydown') {
    if ((k === ' ' || k === 'p') && state === 'play') togglePause();
    if (state === 'play' && !e.repeat) {
      if ((k === 'f' || k === 'e') && players[0]?.control !== 'cpu') players[0].wantCast = true;
      if ((k === 'enter' || k === 'l') && players[1]?.control !== 'cpu') players[1].wantCast = true;
    }
    keys.add(k);
  } else keys.delete(k);
}

function togglePause() {
  if (state !== 'play') return;
  paused = !paused;
  paused ? chip.stop() : chip.start();
  $('#questPause').textContent = paused ? '▶ RESUME' : '⏸ PAUSE';
}

function close() {
  cancelAnimationFrame(raf);
  chip.stop();
  state = 'idle';
  pointers.clear();
  keys.clear();
  $('#quest').classList.add('hidden');
}

let wired = false;
function wire() {
  canvas = $('#questCanvas');
  g = canvas.getContext('2d');
  for (const ev of ['pointerdown', 'pointermove']) canvas.addEventListener(ev, onPointer);
  for (const ev of ['pointerup', 'pointercancel']) canvas.addEventListener(ev, e => pointers.delete(e.pointerId));
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);
  $('#questStart').addEventListener('click', startGame);
  $('#questQuit').addEventListener('click', close);
  $('#questExit').addEventListener('click', close);
  $('#questPause').addEventListener('click', togglePause);
  $('#questAgain').addEventListener('click', () => { chip.stop(); startGame(); });
  wired = true;
}

export async function openQuest(deps) {
  D = deps;
  if (!wired) wire();
  try { await document.fonts.load(`8px ${FONT}`); } catch { /* fallback font */ }
  state = 'idle';
  players = [];
  halves = [0, 1].map(() => makeHalf(1));
  $('#questSetup').classList.remove('hidden');
  $('#questBar').classList.add('hidden');
  $('#quest').classList.remove('hidden');
  await buildSetup();
  cancelAnimationFrame(raf);
  last = performance.now();
  raf = requestAnimationFrame(frame);
}

export const questOpen = () => !$('#quest').classList.contains('hidden');
