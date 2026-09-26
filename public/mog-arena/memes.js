// Meme generator — everything is drawn on <canvas>.
import { sfx } from './sounds.js';
import { STAT_META, tierFor } from './face.js';

const FONT = 'Anton, Impact, "Arial Black", sans-serif';

export const TEMPLATES = [
  { id: 'sigma', label: '🗿 Sigma Stare' },
  { id: 'deepfry', label: '🔥 Deep Fried' },
  { id: 'card', label: '🃏 Mog Card' },
  { id: 'mogged', label: '💀 Mogged' },
  { id: 'mewing', label: '🤫 Mewing' },
];

const SOUNDS = { sigma: 'boom', deepfry: 'airhorn', card: 'ding', mogged: 'sad', mewing: 'shh' };
export const templateSound = id => sfx[SOUNDS[id] || 'boom']();

const CAPTIONS = {
  top: [
    ['{n} WALKED IN', 'AND THE WHOLE ROOM GOT MOGGED'],
    ['JAWLINE SO SHARP', 'IT CUT THE WIFI'],
    ["{n} DOESN'T MEW", 'MEWING DOES {n}'],
    ['CANTHAL TILT', 'ILLEGAL IN 12 COUNTRIES'],
    ['AURA LEVEL', '+10,000'],
    ['WHEN {n} LOOKS AT YOU', 'YOU FORGET YOUR OWN NAME'],
    ['GYM? SKINCARE? NO.', '{n} WAS BORN LIKE THIS'],
    ['NOBODY:', '{n}: *MOGS WITHOUT TRYING*'],
  ],
  mid: [
    ['{n}', 'HIGH TIER NORMIE ENERGY'],
    ['ONE MORE MONTH OF MEWING', "AND IT'S OVER FOR Y'ALL"],
    ['LOOKSMAXXING', '67% COMPLETE'],
    ['{n} WHEN THE LIGHTING', 'IS ACTUALLY GOOD'],
    ['NOT A CHAD YET', 'BUT THE POTENTIAL IS THERE'],
    ['{n} IN THEIR HEAD: GIGACHAD', 'IN REALITY: LOADING…'],
  ],
  low: [
    ['{n}', 'GOT MOGGED BY THE WEBCAM'],
    ['AURA', '-500'],
    ['ERROR 404', 'JAWLINE NOT FOUND'],
    ['{n} PLEASE', 'START MEWING IMMEDIATELY'],
    ['BRO IS AN', 'NPC SIDE QUEST'],
    ['{n} WHEN THE', 'CHAD WALKS IN'],
    ['SCIENTISTS ARE STILL', "LOOKING FOR {n}'S JAWLINE"],
  ],
};

const BATTLE_CAPTIONS = [
  ['{w} MOGS {l}', 'INTO ANOTHER DIMENSION'],
  ["IT'S OVER FOR {l}", '{w} WAS TOO POWERFUL'],
  ['{l} WAS NEVER', 'THE MAIN CHARACTER'],
  ['{w}: EXISTS', '{l}: GETS MOGGED'],
  ['{l} THOUGHT THEY HAD A CHANCE', 'THEY DID NOT'],
  ['BREAKING NEWS', '{l} HAS BEEN MOGGED BY {w}'],
];

function rng(seed) {
  let a = Math.floor(seed * 2 ** 32) >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const fill = (s, vars) => s.replace(/\{(\w)\}/g, (_, k) => vars[k] ?? '');

function captionFor(f, r, forcePool) {
  const s = f.stats;
  const pool = forcePool ? [...CAPTIONS[forcePool]]
    : [...CAPTIONS[f.mog >= 70 ? 'top' : f.mog >= 50 ? 'mid' : 'low']];
  if (!forcePool) {
    if (s.aura < 35) pool.push(['SMILED DURING THE SCAN', '-1000 AURA']);
    if (s.hunter > 80) pool.push(['HUNTER EYES', 'LOCKED ON TARGET']);
    if (s.jaw > 85) pool.push(['THAT JAWLINE', 'REQUIRES A WEAPONS LICENSE']);
    if (s.sym > 90) pool.push(['SYMMETRY SO CLEAN', 'MIRRORS ARE JEALOUS']);
  }
  const [top, bottom] = pick(r, pool);
  return { top: fill(top, { n: f.name }), bottom: fill(bottom, { n: f.name }) };
}

const imgCache = new Map();
function loadImg(src) {
  if (!imgCache.has(src)) {
    imgCache.set(src, new Promise((res, rej) => {
      const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src;
    }));
  }
  return imgCache.get(src);
}

async function fontsReady() {
  try { await document.fonts.load(`60px Anton`); } catch { /* fallback font is fine */ }
}

function wrap(g, text, maxW) {
  const words = text.split(/\s+/), lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (g.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

// Classic white-with-black-outline meme text. anchor 'top' grows down, 'bottom' grows up.
function memeText(g, text, x, y, maxW, size, anchor = 'top') {
  text = text.toUpperCase();
  let lines;
  do {
    g.font = `${size}px ${FONT}`;
    lines = wrap(g, text, maxW);
    if (lines.length <= 2) break;
    size -= 4;
  } while (size > 26);
  const lh = size * 1.08;
  g.save();
  g.textAlign = 'center';
  g.textBaseline = anchor === 'top' ? 'top' : 'bottom';
  g.lineJoin = 'round';
  g.lineWidth = size / 6;
  g.strokeStyle = '#000';
  g.fillStyle = '#fff';
  lines.forEach((ln, i) => {
    const yy = anchor === 'top' ? y + i * lh : y - (lines.length - 1 - i) * lh;
    g.strokeText(ln, x, yy);
    g.fillText(ln, x, yy);
  });
  g.restore();
}

function vignette(g, w, h, strength = 0.85) {
  const v = g.createRadialGradient(w / 2, h / 2, w * 0.25, w / 2, h / 2, w * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, `rgba(0,0,0,${strength})`);
  g.fillStyle = v;
  g.fillRect(0, 0, w, h);
}

function glowEyes(g, f, x0, y0, size, color = '255,20,50', r = 0.035) {
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (const e of f.eyes) {
    const x = x0 + e.x * size, y = y0 + e.y * size, rad = size * r;
    const grad = g.createRadialGradient(x, y, 0, x, y, rad * 2.6);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.18, `rgba(${color},1)`);
    grad.addColorStop(1, `rgba(${color},0)`);
    g.fillStyle = grad;
    g.beginPath(); g.arc(x, y, rad * 2.6, 0, Math.PI * 2); g.fill();
    const lg = g.createLinearGradient(x - rad * 7, y, x + rad * 7, y);
    lg.addColorStop(0, `rgba(${color},0)`);
    lg.addColorStop(0.5, 'rgba(255,255,255,0.95)');
    lg.addColorStop(1, `rgba(${color},0)`);
    g.fillStyle = lg;
    g.fillRect(x - rad * 7, y - rad * 0.12, rad * 14, rad * 0.24);
  }
  g.restore();
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function emoji(g, ch, x, y, size, rot = 0) {
  g.save();
  g.translate(x, y); g.rotate(rot);
  g.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(ch, 0, 0);
  g.restore();
}

// Renders a fighter meme onto `canvas`. Returns the caption used.
export async function renderMeme(canvas, f, tpl, seed) {
  await fontsReady();
  const img = await loadImg(f.img);
  const r = rng(seed);
  const g = canvas.getContext('2d');
  const S = 640;
  canvas.width = S; canvas.height = tpl === 'card' ? 900 : S;
  g.clearRect(0, 0, canvas.width, canvas.height);
  g.filter = 'none';
  let cap;

  if (tpl === 'sigma') {
    cap = captionFor(f, r);
    g.fillStyle = '#000'; g.fillRect(0, 0, S, S);
    g.filter = 'grayscale(1) contrast(1.6) brightness(0.85)';
    g.drawImage(img, 0, 0, S, S);
    g.filter = 'none';
    vignette(g, S, S);
    glowEyes(g, f, 0, 0, S);
    memeText(g, cap.top, S / 2, 18, S - 40, 58, 'top');
    memeText(g, cap.bottom, S / 2, S - 18, S - 40, 58, 'bottom');
  }

  else if (tpl === 'deepfry') {
    cap = captionFor(f, r);
    const small = document.createElement('canvas');
    small.width = small.height = 170;
    const sg = small.getContext('2d');
    sg.filter = 'saturate(4) contrast(2.2) brightness(1.15)';
    sg.drawImage(img, 0, 0, 170, 170);
    g.imageSmoothingEnabled = true;
    g.drawImage(small, 0, 0, S, S);
    g.globalCompositeOperation = 'overlay';
    g.fillStyle = 'rgba(255,110,0,0.45)'; g.fillRect(0, 0, S, S);
    g.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 1800; i++) {
      g.fillStyle = `hsla(${r() * 60},100%,${r() * 100}%,0.35)`;
      g.fillRect(r() * S, r() * S, 2, 2);
    }
    glowEyes(g, f, 0, 0, S, '120,200,255', 0.06);
    const emojis = ['😂', '💯', '🔥', '👌', '😳', '💀', '🅱️', '🗿'];
    for (let i = 0; i < 6; i++) emoji(g, pick(r, emojis), 40 + r() * (S - 80), 120 + r() * (S - 240), 50 + r() * 60, (r() - 0.5) * 0.8);
    memeText(g, cap.top, S / 2, 18, S - 40, 60, 'top');
    memeText(g, cap.bottom, S / 2, S - 18, S - 40, 60, 'bottom');
  }

  else if (tpl === 'card') {
    const t = tierFor(f.mog);
    cap = { top: `${f.name}: ${t.name}`, bottom: `MOG SCORE ${f.mog}` };
    const H = 900;
    const bg = g.createLinearGradient(0, 0, S, H);
    bg.addColorStop(0, t.color); bg.addColorStop(0.55, '#15101f'); bg.addColorStop(1, '#050408');
    g.fillStyle = bg; g.fillRect(0, 0, S, H);
    g.save(); roundRect(g, 36, 36, S - 72, 520, 22); g.clip();
    g.drawImage(img, 36, 36, S - 72, 520);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(36, 440, S - 72, 116);
    g.restore();
    g.lineWidth = 6; g.strokeStyle = t.color; roundRect(g, 36, 36, S - 72, 520, 22); g.stroke();
    // Score badge
    g.fillStyle = '#000'; g.beginPath(); g.arc(S - 90, 96, 62, 0, Math.PI * 2); g.fill();
    g.lineWidth = 6; g.strokeStyle = t.color; g.stroke();
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `64px ${FONT}`; g.fillText(String(f.mog), S - 90, 92);
    g.font = `14px ${FONT}`; g.fillStyle = t.color; g.fillText('MOG', S - 90, 136);
    // Name + tier
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.font = `52px ${FONT}`; g.fillStyle = '#fff';
    g.fillText(f.name.toUpperCase().slice(0, 18), 60, 505);
    g.font = `26px ${FONT}`; g.fillStyle = t.color;
    g.fillText(t.name, 60, 540);
    // Stats
    STAT_META.forEach((m, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const x = 50 + col * 280, y = 600 + row * 90;
      const v = f.stats[m.key];
      g.font = `20px ${FONT}`; g.fillStyle = '#cfc8e0';
      g.fillText(`${m.emoji} ${m.label}`, x, y);
      g.fillStyle = 'rgba(255,255,255,0.12)'; roundRect(g, x, y + 14, 230, 16, 8); g.fill();
      g.fillStyle = v >= 80 ? '#ffd400' : v >= 55 ? t.color : '#6b6680';
      roundRect(g, x, y + 14, Math.max(16, 230 * v / 100), 16, 8); g.fill();
      g.font = `26px ${FONT}`; g.fillStyle = '#fff';
      g.fillText(String(v), x + 240, y + 30);
    });
    g.font = `16px ${FONT}`; g.fillStyle = 'rgba(255,255,255,0.4)'; g.textAlign = 'center';
    g.fillText(`W ${f.wins || 0} · L ${f.losses || 0}   //   AURA MAKER MOG ARENA`, S / 2, H - 28);
  }

  else if (tpl === 'mogged') {
    cap = captionFor(f, r, 'low');
    g.filter = 'grayscale(0.7) brightness(0.65) contrast(1.2)';
    g.drawImage(img, 0, 0, S, S);
    g.filter = 'none';
    g.fillStyle = 'rgba(40,60,160,0.28)'; g.fillRect(0, 0, S, S);
    vignette(g, S, S, 0.7);
    for (const e of f.eyes) emoji(g, '💧', e.x * S + 6, e.y * S + 50, 44);
    g.save();
    g.translate(S / 2, S / 2); g.rotate(-0.22);
    g.strokeStyle = '#ff2e4d'; g.lineWidth = 12;
    roundRect(g, -250, -80, 500, 160, 18); g.stroke();
    g.fillStyle = '#ff2e4d'; g.font = `128px ${FONT}`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('MOGGED', 0, 8);
    g.restore();
    memeText(g, cap.top, S / 2, 18, S - 40, 54, 'top');
    memeText(g, cap.bottom, S / 2, S - 18, S - 40, 54, 'bottom');
  }

  else if (tpl === 'mewing') {
    const day = 1 + Math.floor(r() * 400);
    cap = { top: `MEWING STREAK: DAY ${day}`, bottom: `${f.name} CAN'T TALK RN` };
    g.filter = 'saturate(1.2) contrast(1.1) sepia(0.15)';
    g.drawImage(img, 0, 0, S, S);
    g.filter = 'none';
    vignette(g, S, S, 0.5);
    const m = f.mouth || { x: 0.5, y: 0.72 };
    emoji(g, '🤫', m.x * S, m.y * S, 170);
    memeText(g, cap.top, S / 2, 18, S - 40, 58, 'top');
    memeText(g, cap.bottom, S / 2, S - 18, S - 40, 58, 'bottom');
  }

  return cap;
}

// Winner vs loser battle meme.
export async function renderBattleMeme(canvas, w, l, diff, seed = Math.random()) {
  await fontsReady();
  const [wi, li] = await Promise.all([loadImg(w.img), loadImg(l.img)]);
  const r = rng(seed);
  const W = 1080, H = 700;
  canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d');
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#2a0a3d'); bg.addColorStop(1, '#07060b');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);

  // Winner: big, colored, glowing
  const ws = 470, wx = 50, wy = 150;
  g.save(); g.shadowColor = '#ffd400'; g.shadowBlur = 40;
  g.fillStyle = '#ffd400'; g.fillRect(wx - 8, wy - 8, ws + 16, ws + 16);
  g.restore();
  g.filter = 'contrast(1.2) saturate(1.2)';
  g.drawImage(wi, wx, wy, ws, ws);
  g.filter = 'none';
  glowEyes(g, w, wx, wy, ws, '255,20,50', 0.045);
  emoji(g, '👑', wx + ws / 2, wy - 20, 100);

  // Loser: small, grey, tilted
  const ls = 340, lcx = 800, lcy = 360;
  g.save();
  g.translate(lcx, lcy); g.rotate(0.1);
  g.fillStyle = '#555'; g.fillRect(-ls / 2 - 6, -ls / 2 - 6, ls + 12, ls + 12);
  g.filter = 'grayscale(1) brightness(0.6)';
  g.drawImage(li, -ls / 2, -ls / 2, ls, ls);
  g.filter = 'none';
  g.restore();
  emoji(g, '💀', lcx + 130, lcy - 150, 80, 0.2);

  g.font = `36px ${FONT}`; g.textAlign = 'center'; g.fillStyle = '#ffd400';
  g.fillText(w.name.toUpperCase().slice(0, 20), wx + ws / 2, wy + ws + 55);
  g.fillStyle = '#9a93ad';
  g.fillText(l.name.toUpperCase().slice(0, 20), lcx, lcy + ls / 2 + 55);

  const [top, bottom] = pick(r, BATTLE_CAPTIONS);
  const cap = { top: fill(top, { w: w.name, l: l.name }), bottom: fill(bottom, { w: w.name, l: l.name }) };
  memeText(g, cap.top, W / 2, 20, W - 60, 64, 'top');
  memeText(g, `${cap.bottom}  //  MOG DIFF +${diff}`, lcx - 20, H - 20, 560, 34, 'bottom');
  return cap;
}
