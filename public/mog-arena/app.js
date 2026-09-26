import { initFace, detect, measure, scoreStats, mogScore, tierFor, faceBox, STAT_META } from './face.js';
import { sfx, phonk, speak, setMuted } from './sounds.js';
import { TEMPLATES, renderMeme, renderBattleMeme, templateSound } from './memes.js';
import { STYLES, styleOf } from './styles.js';
import { openQuest, questOpen } from './game.js';

const $ = (s, root = document) => root.querySelector(s);
const wait = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'meme';
const pickOne = arr => arr[Math.floor(Math.random() * arr.length)];
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

const video = $('#video');
const overlay = $('#overlay');
const octx = overlay.getContext('2d');

const KEY = 'mog.roster.v1';
let roster = loadRoster();
let running = false, busy = false, faces = [], collector = null, tracks = [];

function loadRoster() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
}
function saveRoster() {
  try { localStorage.setItem(KEY, JSON.stringify(roster)); }
  catch { toast('Storage full — delete a few fighters from the roster.'); }
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

/* ---------- Modals ---------- */
function openModal(m) { m.classList.remove('hidden'); }
function closeModal(m) { m.classList.add('hidden'); }
document.addEventListener('click', e => {
  if (e.target.matches('[data-close]')) closeModal(e.target.closest('.modal'));
  else if (e.target.classList.contains('modal') && !e.target.hasAttribute('data-sticky')) closeModal(e.target);
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  document.querySelectorAll('.modal:not(.hidden):not([data-sticky])').forEach(closeModal);
  if (!$('#arena').classList.contains('hidden')) closeArena();
});

/* ---------- Camera + detection loop ---------- */
$('#startBtn').addEventListener('click', async () => {
  const btn = $('#startBtn');
  sfx.unlock();
  btn.disabled = true;
  btn.textContent = 'LOADING FACE AI…';
  $('#startErr').textContent = '';
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera needs https or http://localhost.');
    const [stream] = await Promise.all([
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }),
      initFace(),
    ]);
    video.srcObject = stream;
    await video.play();
  } catch (e) {
    btn.disabled = false;
    btn.textContent = 'RETRY';
    $('#startErr').textContent = e?.name === 'NotAllowedError' ? 'Camera permission denied.' : (e?.message || String(e));
    return;
  }
  overlay.width = video.videoWidth;
  overlay.height = video.videoHeight;
  $('#startScreen').classList.add('hidden');
  $('#dot').classList.add('on');
  running = true;
  sfx.boom();
  requestAnimationFrame(loop);
});

let lastVideoTime = -1;
function loop() {
  if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    const w = video.videoWidth, h = video.videoHeight;
    try { faces = detect(video, performance.now()); } catch { faces = []; }
    for (const f of faces) {
      f.box = faceBox(f.lm, w, h);
      f.raw = measure(f.lm, w, h, f.blend);
      f.mog = mogScore(scoreStats(f.raw));
    }
    faces.sort((a, b) => b.box.w - a.box.w); // biggest (closest) first
    trackFaces(performance.now());
    if (collector) {
      // Top-N faces, ordered left→right as seen on screen (video is mirrored).
      const slot = faces.slice(0, collector.n).sort((a, b) => b.lm[1].x - a.lm[1].x);
      collector.frames.push(slot);
    }
    updateButtons();
  }
  if (running && !questOpen()) drawOverlay(performance.now()); // every frame, so bursts/orbits animate smoothly
  requestAnimationFrame(loop);
}

/* ---------- Face tracking: each friend keeps their own style ---------- */
let nextShoutAt = 0;

// FAAAAH with a big text burst; queued so several friends entering at once don't overlap.
function shout(track) {
  const now = performance.now(), at = Math.max(now, nextShoutAt);
  nextShoutAt = at + 550;
  setTimeout(() => {
    track.burstUntil = performance.now() + 1400;
    sfx.faaah(track.style);
  }, at - now);
}

function trackFaces(now) {
  const used = new Set();
  for (const f of faces) {
    const cx = f.lm[1].x, cy = f.lm[1].y;
    let best = null, bestD = Infinity;
    for (const t of tracks) {
      if (used.has(t)) continue;
      const d = Math.hypot(t.cx - cx, t.cy - cy);
      if (d < bestD) { bestD = d; best = t; }
    }
    if (!best || bestD > (f.box.w / video.videoWidth) * 0.9) {
      // New friend: first style nobody on screen has (random once all are taken).
      const taken = new Set(tracks.map(t => t.style));
      const free = STYLES.map((_, i) => i).filter(i => !taken.has(i));
      best = { style: free.length ? free[0] : Math.floor(Math.random() * STYLES.length), live: f.mog, burstUntil: 0 };
      tracks.push(best);
      if (!busy && $('#arena').classList.contains('hidden') && !questOpen()) shout(best);
    }
    used.add(best);
    best.cx = cx; best.cy = cy; best.lastSeen = now;
    best.live = best.live * 0.88 + f.mog * 0.12;
    f.track = best;
    f.live = Math.round(best.live);
  }
  tracks = tracks.filter(t => now - t.lastSeen < 1200);
}

/* ---------- Live overlay: per-friend filters, props, gang war ---------- */
const FACE_OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377,
  152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
const pixCanvas = document.createElement('canvas');
const pixCtx = pixCanvas.getContext('2d');
let thugMode = true;

// Thug props per style (index matches STYLES). Everyone gets a pistol.
const PROPS = [
  { smoke: 'cig' },
  { smoke: 'hookah', cash: true },
  { smoke: 'cigar', chain: true, goldGun: true },
  { smoke: 'cig' },
  { smoke: 'hookah', chain: true },
  { smoke: 'vape' },
];

function roundRectPath(x, y, w, h, r) {
  octx.beginPath();
  octx.moveTo(x + r, y);
  octx.arcTo(x + w, y, x + w, y + h, r);
  octx.arcTo(x + w, y + h, x, y + h, r);
  octx.arcTo(x, y + h, x, y, r);
  octx.arcTo(x, y, x + w, y, r);
  octx.closePath();
}

function emojiAt(ch, x, y, size, rot = 0, alpha = 1) {
  octx.save();
  octx.globalAlpha = alpha;
  octx.translate(x, y); octx.rotate(rot);
  octx.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  octx.textAlign = 'center'; octx.textBaseline = 'middle';
  octx.fillText(ch, 0, 0);
  octx.restore();
}

function shoutText(text, x, y, size, color, rot = 0, alpha = 1, scale = 1) {
  octx.save();
  octx.globalAlpha = alpha;
  octx.translate(x, y); octx.rotate(rot); octx.scale(scale, scale);
  octx.font = `${size}px Anton, Impact, sans-serif`;
  octx.textAlign = 'center'; octx.textBaseline = 'middle';
  octx.lineJoin = 'round'; octx.lineWidth = size / 6; octx.strokeStyle = '#000'; octx.fillStyle = color;
  octx.strokeText(text, 0, 0); octx.fillText(text, 0, 0);
  octx.restore();
}

function eyeGlow(x, y, r, rgb) {
  octx.save();
  octx.globalCompositeOperation = 'lighter';
  const g = octx.createRadialGradient(x, y, 0, x, y, r * 2.6);
  g.addColorStop(0, '#fff'); g.addColorStop(0.2, `rgba(${rgb},1)`); g.addColorStop(1, `rgba(${rgb},0)`);
  octx.fillStyle = g;
  octx.beginPath(); octx.arc(x, y, r * 2.6, 0, Math.PI * 2); octx.fill();
  const lg = octx.createLinearGradient(x - r * 7, y, x + r * 7, y);
  lg.addColorStop(0, `rgba(${rgb},0)`); lg.addColorStop(0.5, 'rgba(255,255,255,0.9)'); lg.addColorStop(1, `rgba(${rgb},0)`);
  octx.fillStyle = lg;
  octx.fillRect(x - r * 7, y - r * 0.12, r * 14, r * 0.24);
  octx.restore();
}

// Draws the face through its style's filter, clipped to the face silhouette.
function drawFilteredFace(f, st, wasted) {
  const w = overlay.width, h = overlay.height, b = f.box, pad = b.w * 0.08;
  const sx = Math.max(0, b.x - pad), sy = Math.max(0, b.y - pad);
  const sw = Math.min(w - sx, b.w + pad * 2), sh = Math.min(h - sy, b.h + pad * 2);
  if (sw <= 0 || sh <= 0) return;
  octx.save();
  octx.translate(w, 0); octx.scale(-1, 1); // un-mirrored image space, like the raw video
  octx.beginPath();
  FACE_OVAL.forEach((k, j) => { const p = f.lm[k]; j ? octx.lineTo(p.x * w, p.y * h) : octx.moveTo(p.x * w, p.y * h); });
  octx.closePath();
  octx.clip();
  if (wasted) {
    octx.filter = 'grayscale(1) brightness(0.55) contrast(1.2)';
    octx.drawImage(video, sx, sy, sw, sh, sx, sy, sw, sh);
  } else if (st.fx === 'npc') {
    const px = Math.max(6, Math.round(sw / 14)), py = Math.max(6, Math.round(sh / 14));
    pixCanvas.width = px; pixCanvas.height = py;
    pixCtx.drawImage(video, sx, sy, sw, sh, 0, 0, px, py);
    octx.imageSmoothingEnabled = false;
    octx.filter = st.filter;
    octx.drawImage(pixCanvas, sx, sy, sw, sh);
  } else {
    octx.filter = st.filter;
    octx.drawImage(video, sx, sy, sw, sh, sx, sy, sw, sh);
    octx.filter = 'none';
    if (st.fx === 'vapor') {
      octx.globalAlpha = 0.35; octx.globalCompositeOperation = 'screen';
      octx.drawImage(video, sx, sy, sw, sh, sx + b.w * 0.03, sy, sw, sh);
      octx.fillStyle = 'rgba(0,255,255,0.15)'; octx.fillRect(sx, sy, sw, sh);
    } else if (st.fx === 'demon') {
      octx.globalCompositeOperation = 'multiply';
      octx.fillStyle = 'rgba(255,0,60,0.45)'; octx.fillRect(sx, sy, sw, sh);
    }
  }
  octx.restore();
}

function styleDecor(st, P, eyes, bw, roll, now) {
  const [cx, cy] = P(1);
  if (st.fx === 'laser') {
    eyes.forEach(([x, y]) => eyeGlow(x, y, bw * 0.03 * (0.85 + 0.3 * Math.random()), '255,20,50'));
  } else if (st.fx === 'fried') {
    eyes.forEach(([x, y]) => eyeGlow(x, y, bw * 0.045, '120,200,255'));
    ['😂', '💯', '🔥'].forEach((ch, k) => {
      const a = now / 600 + k * 2.09;
      emojiAt(ch, cx + Math.cos(a) * bw * 0.75, cy + Math.sin(a) * bw * 0.6, bw * 0.2);
    });
  } else if (st.fx === 'gold') {
    const [x, y] = P(10);
    emojiAt('👑', x, y - bw * 0.2 + Math.sin(now / 250) * bw * 0.02, bw * 0.45, roll);
    for (let k = 0; k < 4; k++) {
      const a = now / 900 + k * 1.57;
      emojiAt('✨', cx + Math.cos(a) * bw * 0.7, cy + Math.sin(a) * bw * 0.7, bw * 0.14, 0, 0.5 + 0.5 * Math.sin(now / 150 + k));
    }
  } else if (st.fx === 'npc') {
    const [x, y] = P(10);
    emojiAt('❓', x, y - bw * 0.2 + Math.sin(now / 300) * bw * 0.04, bw * 0.3);
  } else if (st.fx === 'demon') {
    eyes.forEach(([x, y]) => eyeGlow(x, y, bw * 0.025, '255,0,0'));
    for (const k of [103, 332]) {
      const [x, y] = P(k), s = bw * 0.12;
      octx.save();
      octx.translate(x, y); octx.rotate(roll + (x > cx ? 0.35 : -0.35));
      octx.beginPath(); octx.moveTo(-s * 0.35, 0); octx.lineTo(s * 0.35, 0); octx.lineTo(0, -s * 1.4); octx.closePath();
      octx.fillStyle = '#8b0000'; octx.fill();
      octx.strokeStyle = '#ff2e4d'; octx.lineWidth = 2; octx.stroke();
      octx.restore();
    }
  } else if (st.fx === 'vapor') {
    // Pink shutter shades
    const mx = (eyes[0][0] + eyes[1][0]) / 2, my = (eyes[0][1] + eyes[1][1]) / 2;
    const d = Math.hypot(eyes[0][0] - eyes[1][0], eyes[0][1] - eyes[1][1]);
    octx.save();
    octx.translate(mx, my); octx.rotate(roll);
    for (const sgn of [-1, 1]) {
      const g = octx.createLinearGradient(0, -d * 0.2, 0, d * 0.2);
      g.addColorStop(0, '#ff4dd2'); g.addColorStop(1, '#2a0a3d');
      octx.fillStyle = g;
      roundRectPath(sgn * d * 0.5 - d * 0.3, -d * 0.2, d * 0.6, d * 0.38, d * 0.1);
      octx.fill();
    }
    octx.fillStyle = '#111'; octx.fillRect(-d * 0.2, -d * 0.12, d * 0.4, d * 0.07);
    octx.restore();
  }
}

/* Smoke particles live on the track so they keep drifting as the head moves. */
function emitSmoke(t, [x, y], bw, n, rgb) {
  t.smoke ||= [];
  for (let i = 0; i < n; i++) {
    t.smoke.push({
      x, y, rgb, r: bw * 0.03, a: 0.5, ph: Math.random() * 6,
      vx: (Math.random() - 0.5) * bw * 0.004, vy: -bw * (0.004 + Math.random() * 0.004),
    });
  }
  if (t.smoke.length > 90) t.smoke.splice(0, t.smoke.length - 90);
}

function drawSmoke(t) {
  if (!t.smoke?.length) return;
  octx.save();
  t.smoke = t.smoke.filter(p => p.a > 0.02);
  for (const p of t.smoke) {
    p.ph += 0.08;
    p.x += p.vx + Math.sin(p.ph) * p.r * 0.05;
    p.y += p.vy;
    p.r *= 1.02;
    p.a *= 0.97;
    octx.fillStyle = `rgba(${p.rgb},${p.a})`;
    octx.beginPath(); octx.arc(p.x, p.y, p.r, 0, Math.PI * 2); octx.fill();
  }
  octx.restore();
}

function drawHookah(t, P, bw, dir, now) {
  const [chx, chy] = P(152), [mx, my] = P(13);
  const bx = chx + dir * bw * 0.7, by = chy + bw * 0.55, s = bw / 100;
  octx.save();
  octx.strokeStyle = '#3a2a55'; octx.lineWidth = 4 * s; octx.lineCap = 'round';
  octx.beginPath();
  octx.moveTo(bx - dir * 4 * s, by - 40 * s);
  octx.bezierCurveTo(bx - dir * 50 * s, by + 10 * s, mx + dir * 10 * s, my + 60 * s, mx, my + 2 * s);
  octx.stroke();
  octx.fillStyle = 'rgba(80,200,255,0.55)';
  octx.beginPath(); octx.ellipse(bx, by, 22 * s, 26 * s, 0, 0, Math.PI * 2); octx.fill();
  octx.strokeStyle = '#d4a017'; octx.lineWidth = 2 * s; octx.stroke();
  octx.fillStyle = '#d4a017'; octx.fillRect(bx - 4 * s, by - 70 * s, 8 * s, 46 * s);
  octx.fillStyle = '#8b4513';
  octx.beginPath();
  octx.moveTo(bx - 14 * s, by - 72 * s); octx.lineTo(bx + 14 * s, by - 72 * s);
  octx.lineTo(bx + 6 * s, by - 60 * s); octx.lineTo(bx - 6 * s, by - 60 * s);
  octx.closePath(); octx.fill();
  octx.fillStyle = `rgb(255,${60 + Math.floor(Math.random() * 80)},0)`;
  octx.fillRect(bx - 10 * s, by - 78 * s, 20 * s, 6 * s);
  octx.restore();
  if (now % 3000 < 900) emitSmoke(t, [mx, my], bw, 2, '230,230,240'); // big exhale clouds
}

function drawSmokable(t, kind, mc, dir, bw, roll, P, now) {
  if (kind === 'hookah') { drawHookah(t, P, bw, dir, now); return; }
  const [mx, my] = mc;
  const a = roll + dir * 0.25; // droops down and away from the face
  const L = bw * (kind === 'cigar' ? 0.36 : 0.3), T = bw * (kind === 'cigar' ? 0.07 : 0.045);
  octx.save();
  octx.translate(mx, my); octx.rotate(a); octx.scale(dir, 1);
  if (kind === 'cig') {
    octx.fillStyle = '#d98b3a'; octx.fillRect(0, -T / 2, L * 0.28, T);
    octx.fillStyle = '#f4f1ea'; octx.fillRect(L * 0.28, -T / 2, L * 0.72, T);
  } else if (kind === 'cigar') {
    octx.fillStyle = '#5a3417'; roundRectPath(0, -T / 2, L, T, T / 2); octx.fill();
    octx.fillStyle = '#d4a017'; octx.fillRect(L * 0.2, -T / 2, L * 0.1, T);
  } else {
    octx.fillStyle = '#1b1b22'; roundRectPath(0, -T / 2, L, T, T / 3); octx.fill();
    octx.fillStyle = `rgba(0,220,255,${0.5 + 0.5 * Math.sin(now / 200)})`;
    octx.fillRect(L * 0.8, -T * 0.2, L * 0.12, T * 0.4);
  }
  if (kind !== 'vape') {
    const g = octx.createRadialGradient(L, 0, 0, L, 0, T * 1.2);
    g.addColorStop(0, '#fff3b0');
    g.addColorStop(0.4, `rgba(255,${80 + Math.floor(Math.random() * 60)},0,1)`);
    g.addColorStop(1, 'rgba(255,40,0,0)');
    octx.fillStyle = g;
    octx.beginPath(); octx.arc(L, 0, T * 1.2, 0, Math.PI * 2); octx.fill();
  }
  octx.restore();
  if (kind === 'vape') {
    if (now % 2600 < 700) emitSmoke(t, P(13), bw, 3, '255,150,230');
  } else if (Math.random() < 0.5) {
    emitSmoke(t, [mx + dir * L * Math.cos(a), my + dir * L * Math.sin(a)], bw, 1, '200,200,200');
  }
}

function drawChain(P, bw) {
  const [x, y] = P(152), cy = y + bw * 0.22, rw = bw * 0.42, rh = bw * 0.14;
  octx.save();
  octx.fillStyle = '#ffd400'; octx.strokeStyle = '#8a6d00'; octx.lineWidth = 1;
  for (let k = 0; k <= 16; k++) {
    const a = Math.PI * (k / 16);
    octx.beginPath();
    octx.arc(x - Math.cos(a) * rw, cy - rh + Math.sin(a) * 2 * rh, bw * 0.018, 0, Math.PI * 2);
    octx.fill(); octx.stroke();
  }
  octx.restore();
  shoutText('$', x, cy + rh + bw * 0.06, bw * 0.13, '#ffd400');
}

function drawPistol(t, gold, P, bw, side, now) {
  const a = P(234), b = P(454);
  const cheek = (a[0] - b[0]) * side > 0 ? a : b; // cheek on the side the gun points to
  const gx = cheek[0] + side * bw * 0.18, gy = cheek[1] + bw * 0.1, u = bw / 100;
  const firing = t.recoilUntil > now;
  octx.save();
  octx.translate(gx, gy); octx.scale(side, 1); octx.rotate(firing ? -0.4 : 0);
  const body = gold ? '#d4a017' : '#26262b', edge = gold ? '#fff2a8' : '#6a6a75';
  octx.fillStyle = gold ? '#8a6d00' : '#3b2a1e';
  octx.beginPath();
  octx.moveTo(-2 * u, 0); octx.lineTo(10 * u, 0); octx.lineTo(6 * u, 26 * u); octx.lineTo(-8 * u, 24 * u);
  octx.closePath(); octx.fill();
  octx.strokeStyle = body; octx.lineWidth = 2.2 * u;
  octx.beginPath(); octx.arc(15 * u, 3 * u, 6 * u, 0, Math.PI); octx.stroke();
  octx.fillStyle = body; roundRectPath(-4 * u, -10 * u, 48 * u, 11 * u, 2 * u); octx.fill();
  octx.fillStyle = edge; octx.fillRect(0, -9 * u, 40 * u, 1.6 * u);
  octx.fillStyle = '#000'; octx.fillRect(42 * u, -7 * u, 2 * u, 5 * u);
  octx.restore();
  t.muzzle = [gx + side * 46 * u, gy - 5 * u];
  if (firing) emojiAt('💥', t.muzzle[0], t.muzzle[1], bw * 0.22);
}

function drawProps(t, props, P, bw, roll, cx, w, now) {
  const side = cx < w / 2 ? 1 : -1; // gun points toward the middle of the room
  const l = P(61), r = P(291);
  const mc = (l[0] - r[0]) * -side > 0 ? l : r; // smoke on the outer side
  if (props.chain) drawChain(P, bw);
  drawSmokable(t, props.smoke, mc, -side, bw, roll, P, now);
  if (props.cash) {
    const top = P(10)[1] - bw * 0.3;
    for (let k = 0; k < 3; k++) {
      const y = (now / 8 + k * bw * 0.4) % (bw * 1.2);
      emojiAt('💸', cx + (k - 1) * bw * 0.5, top + y, bw * 0.16, Math.sin(now / 300 + k) * 0.3);
    }
  }
  drawPistol(t, props.goldGun, P, bw, side, now);
}

function drawOverlay(now) {
  const w = overlay.width, h = overlay.height;
  octx.clearRect(0, 0, w, h);
  const X = x => (1 - x) * w, Y = y => y * h;

  for (const f of faces) {
    const t = f.track;
    if (!t) continue;
    const st = STYLES[t.style];
    const P = k => [X(f.lm[k].x), Y(f.lm[k].y)];
    const bw = f.box.w, [cx, cy] = P(1);
    t.px = cx; t.py = cy; t.bw = bw;
    const eL = P(263), eR = P(33); // display-left / display-right eye corners
    const roll = Math.atan2(eR[1] - eL[1], eR[0] - eL[0]);
    const eyes = [[33, 133], [263, 362]].map(([a, c]) => [X((f.lm[a].x + f.lm[c].x) / 2), Y((f.lm[a].y + f.lm[c].y) / 2)]);

    drawFilteredFace(f, st, t.wasted);
    octx.save();
    octx.strokeStyle = t.wasted ? '#666' : st.color;
    octx.lineWidth = Math.max(2, w / 450);
    octx.shadowColor = st.color; octx.shadowBlur = 14;
    octx.beginPath();
    FACE_OVAL.forEach((k, j) => { const [x, y] = P(k); j ? octx.lineTo(x, y) : octx.moveTo(x, y); });
    octx.closePath(); octx.stroke();
    octx.restore();

    if (!t.wasted) styleDecor(st, P, eyes, bw, roll, now);
    if (thugMode || gangWar) drawProps(t, PROPS[t.style], P, bw, roll, cx, w, now);
    drawSmoke(t);

    // Name tag
    const fs = Math.max(14, bw * 0.1);
    const label = `${st.emoji} ${st.name} · MOG ${f.live}`;
    octx.font = `${fs}px Anton, Impact, sans-serif`;
    const tw = octx.measureText(label).width;
    const lx = cx - tw / 2 - 8, ly = f.box.y - fs * 1.6;
    octx.fillStyle = 'rgba(0,0,0,0.7)';
    octx.fillRect(lx, ly, tw + 16, fs * 1.35);
    octx.fillStyle = st.color; octx.textBaseline = 'top'; octx.textAlign = 'left';
    octx.fillText(label, lx + 8, ly + fs * 0.15);

    if (gangWar && t.gang !== undefined) {
      const gang = gangWar.gangs[t.gang], hbw = bw * 0.9, hy = ly - fs * 0.9;
      octx.fillStyle = 'rgba(0,0,0,0.7)'; octx.fillRect(cx - hbw / 2 - 2, hy - 2, hbw + 4, fs * 0.55 + 4);
      octx.fillStyle = gang.color; octx.fillRect(cx - hbw / 2, hy, hbw * (t.hp ?? 0) / 100, fs * 0.55);
      shoutText(gang.name, cx, hy - fs * 0.6, fs * 0.7, gang.color);
      if (t.hitUntil > now) emojiAt('💥', cx, cy, bw * 0.3);
    }
    if (t.wasted) shoutText('WASTED', cx, cy, Math.max(30, bw * 0.28), '#c8102e', -0.08);

    if (now < t.burstUntil) {
      const p = 1 - (t.burstUntil - now) / 1400;
      const scale = p < 0.15 ? 2.2 - 8 * p : 1, alpha = p > 0.7 ? (1 - p) / 0.3 : 1, shake = (1 - p) * bw * 0.05;
      shoutText(st.shout, cx + (Math.random() - 0.5) * shake, Math.max(bw * 0.2, f.box.y - bw * 0.55) + (Math.random() - 0.5) * shake,
        Math.max(30, bw * 0.26), st.color, Math.sin(now / 90) * 0.06, alpha, scale);
    }
  }

  if (gangWar) drawGangWar(now, w, h);
  else if (faces.length >= 2) {
    const [a, b] = faces;
    shoutText('VS', (X(a.lm[1].x) + X(b.lm[1].x)) / 2, (Y(a.lm[1].y) + Y(b.lm[1].y)) / 2, Math.max(40, w / 14), '#ff2e4d');
  }
}

/* ---------- Gang war ---------- */
const GANG_NAMES = ['MEWING MAFIA', 'JAWLINE CARTEL', 'SIGMA SYNDICATE', 'AURA BANDITS', 'LOOKSMAX MOB', 'NPC MILITIA', 'CANTHAL CREW', 'HUNTER EYES POSSE'];
let gangWar = null;

function drawGangWar(now, w, h) {
  const gw = gangWar, [A, B] = gw.gangs;
  gw.shots = gw.shots.filter(s => s.until > now);
  octx.save();
  octx.strokeStyle = '#ffe66b'; octx.lineWidth = Math.max(3, w / 350);
  octx.shadowColor = '#ffae00'; octx.shadowBlur = 16;
  for (const s of gw.shots) {
    octx.beginPath(); octx.moveTo(s.x1, s.y1); octx.lineTo(s.x2, s.y2); octx.stroke();
  }
  octx.restore();
  const fs = w * 0.04;
  shoutText(A.name, w * 0.3, h * 0.08, fs, A.color);
  shoutText('VS', w / 2, h * 0.08, fs, '#fff');
  shoutText(B.name, w * 0.7, h * 0.08, fs, B.color);
  if (now - gw.start < 1800) {
    shoutText('💥 GANG WAR 💥', w / 2, h * 0.45, w * 0.09, '#ff2e4d', 0, 1, 1 + 0.08 * Math.sin(now / 80));
  }
  if (gw.over) {
    shoutText('MISSION PASSED', w / 2, h * 0.42, w * 0.085, '#ffd400', -0.03);
    shoutText(`${gw.gangs[gw.winner].name}  ·  RESPECT +`, w / 2, h * 0.55, w * 0.045, '#fff');
  }
}

function fire(shooter, target) {
  const now = performance.now();
  shooter.recoilUntil = now + 120;
  const [x1, y1] = shooter.muzzle || [shooter.px, shooter.py];
  const x2 = target.px + (Math.random() - 0.5) * target.bw * 0.4, y2 = target.py + (Math.random() - 0.5) * target.bw * 0.4;
  gangWar.shots.push({ x1, y1, x2, y2, until: now + 140 });
  sfx.gunshot();
  const dmg = Math.round(7 + Math.random() * 12 * (0.6 + (shooter.live || 50) / 100));
  target.hp = Math.max(0, target.hp - dmg);
  target.hitUntil = now + 150;
  if (target.hp <= 0 && !target.wasted) {
    target.wasted = true;
    sfx.wasted();
    setTimeout(() => sfx.faaah(target.style, 0.9), 250);
  }
}

async function startGangWar() {
  if (!running || busy || gangWar) return;
  const visible = faces.filter(f => f.track);
  if (visible.length < 2) { toast('Need 2+ faces in frame for a gang war.'); return; }
  busy = true;
  updateButtons(true);
  const sorted = [...visible].sort((a, b) => b.lm[1].x - a.lm[1].x); // left → right on screen
  const half = Math.ceil(sorted.length / 2);
  const names = [...GANG_NAMES].sort(() => Math.random() - 0.5);
  const gangs = [
    { name: names[0], color: '#28ff8a', members: sorted.slice(0, half).map(f => f.track) },
    { name: names[1], color: '#ff2e4d', members: sorted.slice(half).map(f => f.track) },
  ];
  gangs.forEach((g, gi) => g.members.forEach(t => { t.gang = gi; t.hp = 100; t.wasted = false; }));
  gangWar = { gangs, start: performance.now(), shots: [], over: false, winner: 0 };

  phonk.start(150);
  speak(`Gang war! ${names[0]} versus ${names[1]}!`, { rate: 1.05 });
  await wait(1800);

  const alive = gi => gangWar.gangs[gi].members.filter(t => !t.wasted);
  const deadline = performance.now() + 20000;
  while (performance.now() < deadline) {
    // Anyone who ducks out of frame counts as wasted.
    for (const g of gangWar.gangs) for (const t of g.members) if (!tracks.includes(t)) t.wasted = true;
    const a0 = alive(0), a1 = alive(1);
    if (!a0.length || !a1.length) break;
    const leftShoots = Math.random() < 0.5;
    fire(pickOne(leftShoots ? a0 : a1), pickOne(leftShoots ? a1 : a0));
    await wait(280 + Math.random() * 420);
  }

  const hpOf = gi => gangWar.gangs[gi].members.reduce((s, t) => s + (t.wasted ? 0 : t.hp), 0);
  const h0 = hpOf(0), h1 = hpOf(1);
  gangWar.winner = h0 === h1 ? (Math.random() < 0.5 ? 0 : 1) : h0 > h1 ? 0 : 1;
  gangWar.over = true;
  phonk.stop();
  sfx.passed();
  setTimeout(() => sfx.airhorn(), 1200);
  speak(`${gangWar.gangs[gangWar.winner].name} wins the gang war. Respect plus.`, { rate: 1 });
  await wait(5000);

  for (const g of gangWar.gangs) for (const t of g.members) { delete t.gang; delete t.hp; t.wasted = false; }
  gangWar = null;
  busy = false;
  updateButtons(true);
}

let lastUi = '';
function updateButtons(force = false) {
  const n = faces.length;
  const key = `${running}|${busy}|${Math.min(n, 2)}|${!!gangWar}`;
  if (key === lastUi && !force) return;
  lastUi = key;
  $('#scanBtn').disabled = !running || busy || n < 1;
  $('#liveBattleBtn').disabled = !running || busy || n < 2;
  $('#gangBtn').disabled = !running || busy || n < 2;
  $('#faaahBtn').disabled = !running || n < 1;
  $('#status').textContent = !running ? 'Camera off'
    : gangWar ? 'GANG WAR IN PROGRESS'
    : busy ? 'Scanning… hold still'
    : n === 0 ? 'No faces detected — step into frame'
    : n === 1 ? '1 face detected — ready to scan'
    : `${n} faces detected — LIVE MOG BATTLE ready`;
}

/* ---------- Scanning ---------- */
$('#scanBtn').addEventListener('click', () => runScan(1));
$('#liveBattleBtn').addEventListener('click', () => runScan(2));
$('#gangBtn').addEventListener('click', startGangWar);
$('#questBtn').addEventListener('click', () => {
  sfx.unlock();
  openQuest({
    running: () => running,
    getFaces: () => faces,
    cropFace,
    roster: () => roster,
    styleOf,
    onResult(winId, loseId) {
      const w = roster.find(f => f.id === winId), l = roster.find(f => f.id === loseId);
      if (w) w.wins = (w.wins || 0) + 1;
      if (l) l.losses = (l.losses || 0) + 1;
      if (w || l) { saveRoster(); renderAll(); }
    },
  });
});
$('#faaahBtn').addEventListener('click', () => faces.forEach(f => f.track && shout(f.track)));
$('#thugBtn').addEventListener('click', e => {
  thugMode = !thugMode;
  e.currentTarget.textContent = `😈 THUG MODE: ${thugMode ? 'ON' : 'OFF'}`;
  sfx.beep(thugMode ? 880 : 330, 0.08);
});

async function countdown() {
  const el = $('#countdown');
  for (const [n, txt] of [['3', "DON'T SMILE"], ['2', 'LOCK IN'], ['1', 'MEW']]) {
    el.innerHTML = `<b>${n}</b><span>${txt}</span>`;
    el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
    sfx.beep(660, 0.1);
    await wait(750);
  }
  el.innerHTML = '<b>🗿</b><span>SCANNING…</span>';
  sfx.beep(1320, 0.2);
}

function cropFace(lm) {
  const vw = video.videoWidth, vh = video.videoHeight, b = faceBox(lm, vw, vh);
  const size = Math.max(b.w, b.h) * 1.55;
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2 - b.h * 0.04;
  const sx = cx - size / 2, sy = cy - size / 2, S = 360;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, S, S);
  g.translate(S, 0); g.scale(-1, 1); // mirror to match the selfie view
  g.drawImage(video, sx, sy, size, size, 0, 0, S, S);
  const norm = (x, y) => ({ x: 1 - (x * vw - sx) / size, y: (y * vh - sy) / size });
  const eye = (a, z) => norm((lm[a].x + lm[z].x) / 2, (lm[a].y + lm[z].y) / 2);
  return { img: c.toDataURL('image/jpeg', 0.85), eyes: [eye(33, 133), eye(263, 362)], mouth: norm(lm[13].x, lm[13].y) };
}

async function runScan(n) {
  if (!running || busy) return;
  if (faces.length < n) { toast(n === 1 ? 'No face in frame.' : 'Need 2 faces in frame for a live battle.'); return; }
  busy = true;
  updateButtons(true);
  let fighters = null;
  try {
    await countdown();
    $('#stage').classList.add('scanning');
    sfx.scan();
    collector = { n, frames: [] };
    await wait(2000);
    const valid = collector.frames.filter(f => f.length >= n);
    collector = null;
    $('#stage').classList.remove('scanning');
    $('#countdown').innerHTML = '';

    if (valid.length < 6) {
      sfx.sad();
      toast('Lost the face mid-scan. Better lighting, face the camera, try again.');
      return;
    }

    const results = [];
    for (let i = 0; i < n; i++) {
      const raws = valid.map(fr => fr[i].raw);
      const avg = {};
      for (const k of Object.keys(raws[0])) avg[k] = raws.reduce((s, r) => s + r[k], 0) / raws.length;
      const stats = scoreStats(avg);
      const last = valid[valid.length - 1][i];
      results.push({ stats, mog: mogScore(stats), style: last.track?.style ?? i, ...cropFace(last.lm) });
    }
    sfx.ding();

    const names = await askNames(results.map(r => r.img));
    fighters = results.map((r, i) => ({ id: newId(), name: names[i], ...r, wins: 0, losses: 0, created: Date.now() }));
    roster.push(...fighters);
    saveRoster();
    renderAll();
  } finally {
    busy = false;
    collector = null;
    $('#stage').classList.remove('scanning');
    $('#countdown').innerHTML = '';
    updateButtons(true);
  }
  if (!fighters) return;
  if (n === 1) showReveal(fighters[0]);
  else runBattle(fighters[0], fighters[1], { live: true });
}

function askNames(imgs) {
  return new Promise(resolve => {
    const m = $('#nameModal'), fields = $('#nameFields');
    const base = roster.length;
    fields.innerHTML = imgs.map((src, i) =>
      `<label class="name-row"><img src="${src}" alt=""><input maxlength="24" value="Friend ${base + i + 1}"></label>`).join('');
    openModal(m);
    const inputs = [...fields.querySelectorAll('input')];
    inputs[0].focus(); inputs[0].select();
    $('#nameForm').onsubmit = e => {
      e.preventDefault();
      closeModal(m);
      resolve(inputs.map((x, i) => x.value.trim() || `Friend ${base + i + 1}`));
    };
  });
}

/* ---------- Reveal ---------- */
function countUp(el, to, ms) {
  return new Promise(res => {
    const t0 = performance.now();
    const step = now => {
      const p = Math.min(1, (now - t0) / ms);
      el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3)));
      p < 1 ? requestAnimationFrame(step) : res();
    };
    requestAnimationFrame(step);
  });
}

async function showReveal(f, animate = true) {
  const m = $('#revealModal'), card = $('.modal-card', m), t = tierFor(f.mog);
  card.style.setProperty('--tier', t.color);
  $('#revImg').src = f.img;
  $('#revName').textContent = f.name;
  $('#revStats').innerHTML = STAT_META.map(s =>
    `<div class="stat"><span>${s.emoji} ${s.label}</span><div class="bar"><i></i></div><b>–</b></div>`).join('');
  $('#revMeme').onclick = () => { closeModal(m); openMeme(f); };
  const rows = [...$('#revStats').children];
  const setRow = (i, v) => { rows[i].querySelector('i').style.width = v + '%'; rows[i].querySelector('b').textContent = v; };

  if (!animate) {
    STAT_META.forEach((s, i) => setRow(i, f.stats[s.key]));
    $('#revMog').textContent = f.mog; $('#revTier').textContent = t.name; $('#revSub').textContent = t.sub;
    openModal(m);
    return;
  }
  $('#revMog').textContent = '0'; $('#revTier').textContent = ''; $('#revSub').textContent = '';
  openModal(m);
  for (let i = 0; i < STAT_META.length; i++) {
    await wait(380);
    const v = f.stats[STAT_META[i].key];
    setRow(i, v);
    sfx.beep(300 + v * 9, 0.07, 'square', 0.12);
  }
  await wait(350);
  sfx.riser();
  await countUp($('#revMog'), f.mog, 1000);
  sfx.boom();
  $('#revTier').textContent = t.name;
  $('#revSub').textContent = t.sub;
  card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
  sfx.faaah(styleOf(f));
  if (f.mog >= 80) setTimeout(() => sfx.airhorn(), 1600);
  else if (f.mog < 45) setTimeout(() => sfx.sad(), 1600);
  setTimeout(() => speak(`${f.name}. Mog score, ${f.mog}. ${t.name}.`), 1600);
}

/* ---------- Meme studio ---------- */
let meme = null;

async function openMeme(f, tpl = STYLES[styleOf(f)].tpl) {
  meme = { f, tpl, seed: Math.random(), cap: null };
  $('#tplBtns').innerHTML = TEMPLATES.map(t => `<button class="chip" data-tpl="${t.id}">${t.label}</button>`).join('');
  openModal($('#memeModal'));
  await drawMeme(true);
}

async function drawMeme(withSound) {
  if (!meme) return;
  document.querySelectorAll('#tplBtns .chip').forEach(c => c.classList.toggle('active', c.dataset.tpl === meme.tpl));
  meme.cap = await renderMeme($('#memeCanvas'), meme.f, meme.tpl, meme.seed);
  if (withSound) templateSound(meme.tpl);
}

$('#tplBtns').addEventListener('click', e => {
  const b = e.target.closest('[data-tpl]');
  if (!b || !meme) return;
  meme.tpl = b.dataset.tpl;
  meme.seed = Math.random();
  drawMeme(true);
});
$('#memeReroll').addEventListener('click', () => { if (!meme) return; meme.seed = Math.random(); sfx.beep(990, 0.05); drawMeme(false); });
$('#memeSound').addEventListener('click', () => {
  if (!meme?.cap) return;
  templateSound(meme.tpl);
  setTimeout(() => speak(`${meme.cap.top}. ${meme.cap.bottom}`), 400);
});
$('#memeDl').addEventListener('click', () => {
  if (!meme) return;
  download($('#memeCanvas'), `${slug(meme.f.name)}-${meme.tpl}.png`);
});

function download(canvas, name) {
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = name;
  a.click();
}

/* ---------- Battle ---------- */
let battleToken = 0, skipping = false;
$('#skipBtn').addEventListener('click', () => { skipping = true; });
$('#arenaClose').addEventListener('click', closeArena);

function closeArena() {
  battleToken++;
  phonk.stop();
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  closeModal($('#arena'));
}

function battleLog(html) {
  const el = document.createElement('div');
  el.innerHTML = html;
  $('#battleLog').prepend(el);
}

async function runBattle(a, b, { live = false } = {}) {
  const token = ++battleToken;
  const alive = () => token === battleToken;
  const sleep = ms => wait(skipping ? Math.min(ms, 30) : ms);
  skipping = false;

  const fa = $('#fA'), fb = $('#fB');
  for (const [el, f] of [[fa, a], [fb, b]]) {
    el.classList.remove('winner', 'loser', 'hit');
    $('img', el).src = f.img;
    $('h3', el).textContent = f.name;
    $('.hp i', el).style.width = '100%';
    $('.val', el).textContent = '';
  }
  $('#battleLog').innerHTML = '';
  $('#battleResult').classList.add('hidden');
  $('#battleDl').classList.add('hidden');
  $('#rematchBtn').classList.add('hidden');
  $('#skipBtn').classList.remove('hidden');
  const label = $('#roundLabel');
  const setLabel = txt => { label.textContent = txt; label.classList.remove('pop'); void label.offsetWidth; label.classList.add('pop'); };
  setLabel('MOG BATTLE');
  openModal($('#arena'));

  phonk.start();
  speak(`${a.name} versus ${b.name}. Mog battle. Begin.`, { rate: 1 });
  await sleep(2200);
  if (!alive()) return;

  const hp = { a: 100, b: 100 };
  for (const s of STAT_META) {
    setLabel(`${s.emoji} ${s.label}`);
    sfx.whoosh();
    $('.val', fa).textContent = '…';
    $('.val', fb).textContent = '…';
    await sleep(650);
    if (!alive()) return;

    const va = a.stats[s.key], vb = b.stats[s.key];
    $('.val', fa).textContent = va;
    $('.val', fb).textContent = vb;
    sfx.beep(520, 0.06);
    await sleep(450);
    if (!alive()) return;

    const diff = va - vb;
    if (Math.abs(diff) < 2) {
      sfx.beep(220, 0.15, 'sawtooth');
      battleLog(`${s.label}: dead even. Nobody mogs.`);
    } else {
      const wk = diff > 0 ? 'a' : 'b', lk = wk === 'a' ? 'b' : 'a';
      const winF = wk === 'a' ? a : b, loseEl = lk === 'a' ? fa : fb;
      const dmg = Math.round(6 + Math.abs(diff) * 0.55);
      hp[lk] = Math.max(0, hp[lk] - dmg);
      $('.hp i', loseEl).style.width = hp[lk] + '%';
      loseEl.classList.remove('hit'); void loseEl.offsetWidth; loseEl.classList.add('hit');
      sfx.hit();
      sfx.faaah(styleOf(lk === 'a' ? a : b), 0.45);
      battleLog(`<b>${esc(winF.name)}</b> mogs on ${s.label} <em>−${dmg} HP</em>`);
    }
    await sleep(900);
    if (!alive()) return;
  }

  phonk.stop();
  const aWins = hp.a !== hp.b ? hp.a > hp.b : a.mog >= b.mog;
  const [w, l] = aWins ? [a, b] : [b, a];
  (aWins ? fa : fb).classList.add('winner');
  (aWins ? fb : fa).classList.add('loser');
  setLabel(`${w.name} MOGS ${l.name}`);
  sfx.boom();
  setTimeout(() => sfx.faaah(styleOf(l), 1.6), 400);
  setTimeout(() => sfx.airhorn(), 2200);
  speak(pickOne([
    `${w.name} absolutely mogs ${l.name}!`,
    `It's over for ${l.name}. ${w.name} wins.`,
    `${l.name} has been mogged. ${w.name} is the main character.`,
  ]), { rate: 1 });

  const rw = roster.find(x => x.id === w.id), rl = roster.find(x => x.id === l.id);
  if (rw) rw.wins = (rw.wins || 0) + 1;
  if (rl) rl.losses = (rl.losses || 0) + 1;
  saveRoster();
  renderAll();

  await renderBattleMeme($('#battleCanvas'), w, l, Math.abs(hp.a - hp.b));
  if (!alive()) return;
  $('#battleResult').classList.remove('hidden');
  $('#skipBtn').classList.add('hidden');
  $('#battleDl').classList.remove('hidden');
  $('#battleDl').onclick = () => download($('#battleCanvas'), `${slug(w.name)}-mogs-${slug(l.name)}.png`);
  if (live) {
    $('#rematchBtn').classList.remove('hidden');
    $('#rematchBtn').onclick = () => { closeArena(); runScan(2); };
  }
}

$('#fightBtn').addEventListener('click', () => {
  const a = roster.find(f => f.id === $('#pickA').value), b = roster.find(f => f.id === $('#pickB').value);
  if (!a || !b) return toast('Pick two fighters.');
  if (a.id === b.id) return toast("Can't mog yourself. Pick two different fighters.");
  sfx.unlock();
  runBattle(a, b);
});
$('#randomBtn').addEventListener('click', () => {
  if (roster.length < 2) return toast('Scan at least 2 friends first.');
  const i = Math.floor(Math.random() * roster.length);
  let j = Math.floor(Math.random() * (roster.length - 1));
  if (j >= i) j++;
  $('#pickA').value = roster[i].id;
  $('#pickB').value = roster[j].id;
  sfx.unlock();
  runBattle(roster[i], roster[j]);
});

/* ---------- Panels ---------- */
document.querySelector('.tabs').addEventListener('click', e => {
  const b = e.target.closest('[data-tab]');
  if (!b) return;
  document.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('active', x === b));
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('hidden', t.id !== `tab-${b.dataset.tab}`));
});

$('#rosterGrid').addEventListener('click', e => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const f = roster.find(x => x.id === btn.closest('.card').dataset.id);
  if (!f) return;
  sfx.unlock();
  if (btn.dataset.act === 'meme') openMeme(f);
  else if (btn.dataset.act === 'stats') showReveal(f, false);
  else if (btn.dataset.act === 'del' && confirm(`Remove ${f.name} from the roster?`)) {
    roster = roster.filter(x => x.id !== f.id);
    saveRoster();
    renderAll();
  }
});

function renderAll() {
  const grid = $('#rosterGrid');
  grid.innerHTML = roster.length ? [...roster].reverse().map(f => {
    const t = tierFor(f.mog);
    return `<div class="card" data-id="${f.id}" style="--tier:${t.color}">
      <img src="${f.img}" alt="">
      <div class="meta"><span class="score">${f.mog}</span><b>${esc(f.name)}</b><span class="tier">${STYLES[styleOf(f)].emoji} ${t.name}</span>
        <small>W ${f.wins || 0} · L ${f.losses || 0}</small></div>
      <div class="actions">
        <button data-act="meme" title="Make meme">🖼️</button>
        <button data-act="stats" title="Stats">📊</button>
        <button data-act="del" title="Delete">🗑️</button>
      </div></div>`;
  }).join('') : '<p class="empty">No fighters yet. Start the camera and scan a friend.</p>';

  const opts = roster.map(f => `<option value="${f.id}">${esc(f.name)} (${f.mog})</option>`).join('');
  const pa = $('#pickA'), pb = $('#pickB'), va = pa.value, vb = pb.value;
  pa.innerHTML = opts; pb.innerHTML = opts;
  if (roster.some(f => f.id === va)) pa.value = va;
  if (roster.some(f => f.id === vb)) pb.value = vb;
  else if (roster.length > 1 && pa.value === pb.value) pb.selectedIndex = 1;
  const enough = roster.length >= 2;
  $('#fightBtn').disabled = !enough;
  $('#randomBtn').disabled = !enough;
  $('#battleEmpty').classList.toggle('hidden', enough);

  const ranked = [...roster].sort((x, y) => (y.wins || 0) - (x.wins || 0) || y.mog - x.mog);
  $('#leaderList').innerHTML = ranked.length ? ranked.map(f =>
    `<li><img src="${f.img}" alt=""><span>${esc(f.name)}<br><small style="color:${tierFor(f.mog).color}">${tierFor(f.mog).name}</small></span>
      <span class="rec">${f.wins || 0}W – ${f.losses || 0}L<small>MOG ${f.mog}</small></span></li>`).join('')
    : '<p class="empty">No battles yet.</p>';
}

$('#muteBtn').addEventListener('click', e => {
  const m = e.currentTarget.textContent === '🔊';
  e.currentTarget.textContent = m ? '🔇' : '🔊';
  setMuted(m);
});

// Voices load async in some browsers.
if ('speechSynthesis' in window) speechSynthesis.getVoices();
renderAll();
