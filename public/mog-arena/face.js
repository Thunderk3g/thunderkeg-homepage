// Face detection (MediaPipe Face Landmarker) + "looksmaxxing" metrics.
// Scores are for fun: real geometry, silly interpretation.

const VISION = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

let landmarker = null;

export async function initFace() {
  const { FaceLandmarker, FilesetResolver } = await import(`${VISION}/vision_bundle.mjs`);
  const files = await FilesetResolver.forVisionTasks(`${VISION}/wasm`);
  const opts = delegate => ({
    baseOptions: { modelAssetPath: MODEL, delegate },
    runningMode: 'VIDEO',
    numFaces: 6,
    outputFaceBlendshapes: true,
  });
  try {
    landmarker = await FaceLandmarker.createFromOptions(files, opts('GPU'));
  } catch {
    landmarker = await FaceLandmarker.createFromOptions(files, opts('CPU'));
  }
}

export function detect(video, timestamp) {
  const r = landmarker.detectForVideo(video, timestamp);
  return r.faceLandmarks.map((lm, i) => {
    const blend = {};
    for (const c of r.faceBlendshapes?.[i]?.categories || []) blend[c.categoryName] = c.score;
    return { lm, blend };
  });
}

export function faceBox(lm, w, h) {
  let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
  for (const p of lm) {
    if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x;
    if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y;
  }
  return { x: x0 * w, y: y0 * h, w: (x1 - x0) * w, h: (y1 - y0) * h };
}

export const STAT_META = [
  { key: 'jaw', label: 'JAWLINE', emoji: '🗿' },
  { key: 'canthal', label: 'CANTHAL TILT', emoji: '👁️' },
  { key: 'sym', label: 'SYMMETRY', emoji: '⚖️' },
  { key: 'fwhr', label: 'FACE WIDTH RATIO', emoji: '📐' },
  { key: 'hunter', label: 'HUNTER EYES', emoji: '🦅' },
  { key: 'aura', label: 'AURA', emoji: '✨' },
];

const WEIGHTS = { jaw: 0.2, canthal: 0.15, sym: 0.17, fwhr: 0.14, hunter: 0.14, aura: 0.2 };

export const TIERS = [
  { min: 90, name: 'GIGACHAD', sub: 'Terminal mogger. The room is cooked.', color: '#ffd400' },
  { min: 80, name: 'CHAD', sub: 'Mogs on sight. No warm-up needed.', color: '#ff2e4d' },
  { min: 70, name: 'CHADLITE', sub: 'Dangerous with good lighting.', color: '#ff7a00' },
  { min: 58, name: 'HIGH TIER NORMIE', sub: 'One mewing arc away from greatness.', color: '#b026ff' },
  { min: 45, name: 'MID TIER NORMIE', sub: 'Side character with potential.', color: '#4da3ff' },
  { min: 0, name: 'NPC', sub: 'Start mewing immediately.', color: '#8a8a99' },
];

export const tierFor = mog => TIERS.find(t => mog >= t.min);

// Raw geometric measurements from one frame.
export function measure(lm, w, h, blend = {}) {
  const P = i => [lm[i].x * w, lm[i].y * h];
  const L = P(33), R = P(263);
  const roll = Math.atan2(R[1] - L[1], R[0] - L[0]);
  const cs = Math.cos(-roll), sn = Math.sin(-roll);
  // Landmark in a head-roll-corrected frame, so tilting your head doesn't change the stats.
  const Q = i => { const [x, y] = P(i); return [x * cs - y * sn, x * sn + y * cs]; };
  const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

  const cheek = d(Q(234), Q(454));
  const jawW = d(Q(172), Q(397));
  const upperH = Math.abs(Q(0)[1] - Q(9)[1]) || 1;

  // Positive = outer eye corner higher than inner corner.
  const tilt = (outer, inner) => {
    const o = Q(outer), n = Q(inner);
    return Math.atan2(n[1] - o[1], Math.abs(n[0] - o[0])) * 180 / Math.PI;
  };
  const canthal = (tilt(33, 133) + tilt(263, 362)) / 2;

  const midX = (Q(9)[0] + Q(168)[0] + Q(1)[0] + Q(152)[0]) / 4;
  const pairs = [[33, 263], [133, 362], [234, 454], [172, 397], [61, 291], [159, 386], [70, 300], [58, 288]];
  let asym = 0;
  for (const [a, b] of pairs) {
    const qa = Q(a), qb = Q(b);
    const dl = Math.abs(qa[0] - midX), dr = Math.abs(qb[0] - midX);
    asym += Math.abs(dl - dr) / (dl + dr || 1) + Math.abs(qa[1] - qb[1]) / cheek;
  }
  const sym = 1 - asym / pairs.length;

  const ear = (d(Q(159), Q(145)) / d(Q(33), Q(133)) + d(Q(386), Q(374)) / d(Q(263), Q(362))) / 2;
  const yaw = ((Q(1)[0] - Q(234)[0]) / ((Q(454)[0] - Q(234)[0]) || 1) - 0.5) * 2;

  const b = k => blend[k] || 0;
  return {
    jawRatio: jawW / cheek,
    fwhr: cheek / upperH,
    canthal,
    sym,
    ear,
    yaw,
    smile: (b('mouthSmileLeft') + b('mouthSmileRight')) / 2,
    browDown: (b('browDownLeft') + b('browDownRight')) / 2,
    squint: (b('eyeSquintLeft') + b('eyeSquintRight')) / 2,
    pucker: b('mouthPucker'),
    jawOpen: b('jawOpen'),
    browUp: b('browInnerUp'),
  };
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const map = (v, a, b) => clamp((v - a) / (b - a), 0, 1);

export function scoreStats(r) {
  const aura = 52 + 45 * r.browDown + 30 * r.squint - 60 * r.smile - 40 * r.pucker
    - 35 * r.jawOpen - 20 * r.browUp - 40 * Math.abs(r.yaw);
  return {
    jaw: Math.round(15 + 85 * map(r.jawRatio, 0.72, 0.9)),
    canthal: Math.round(10 + 90 * map(r.canthal, -3, 9)),
    sym: Math.round(10 + 90 * map(r.sym, 0.9, 0.985)),
    fwhr: Math.round(15 + 85 * map(r.fwhr, 1.5, 2.1)),
    hunter: Math.round(10 + 90 * map(r.ear, 0.36, 0.18)),
    aura: Math.round(clamp(aura, 3, 99)),
  };
}

export function mogScore(stats) {
  let s = 0;
  for (const k in WEIGHTS) s += WEIGHTS[k] * stats[k];
  return Math.round(s);
}
