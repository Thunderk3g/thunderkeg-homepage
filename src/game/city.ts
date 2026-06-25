// Deterministic procedural city: a 6x6 grid of blocks separated by roads.
// Everything that needs the layout (renderer, collisions, minimap, missions)
// reads from this single module.

export const BLOCK = 34;
export const ROAD = 12;
export const PITCH = BLOCK + ROAD;
export const GRID = 6;
export const EXTENT = GRID * PITCH + ROAD; // full city width
export const HALF = EXTENT / 2;
export const WORLD_BOUND = HALF + 40; // player/car clamp

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface BoxCollider {
  x: number;
  z: number;
  hx: number;
  hz: number;
}

export interface BuildingInstance {
  x: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  color: string;
}

export interface LandmarkDef {
  missionId: string;
  block: [number, number];
  /** marker position (set during generation, on the sidewalk) */
  marker: { x: number; z: number };
  kind: 'tower' | 'office' | 'garage' | 'gym' | 'campus' | 'cityhall' | 'park';
}

/** world-space origin (min corner) of block (i, j) */
export function blockOrigin(i: number, j: number) {
  return { x: -HALF + ROAD + i * PITCH, z: -HALF + ROAD + j * PITCH };
}

const SA_PALETTE = [
  '#c9b08a', '#b8977a', '#d8c8a8', '#9a8f82', '#b06a4a',
  '#cc8a5e', '#8a93a0', '#ad9d77', '#c2a98e', '#7d7468',
];

const rng = mulberry32(20260611);

export const landmarks: LandmarkDef[] = [
  { missionId: 'bajaj-life', block: [1, 1], marker: { x: 0, z: 0 }, kind: 'tower' },
  { missionId: 'finserv', block: [4, 1], marker: { x: 0, z: 0 }, kind: 'office' },
  { missionId: 'projects', block: [0, 4], marker: { x: 0, z: 0 }, kind: 'garage' },
  { missionId: 'skills', block: [4, 3], marker: { x: 0, z: 0 }, kind: 'gym' },
  { missionId: 'education', block: [1, 4], marker: { x: 0, z: 0 }, kind: 'campus' },
  { missionId: 'awards', block: [3, 0], marker: { x: 0, z: 0 }, kind: 'cityhall' },
  { missionId: 'contact', block: [2, 2], marker: { x: 0, z: 0 }, kind: 'park' },
];

const landmarkAt = new Map(landmarks.map((l) => [l.block[0] * 100 + l.block[1], l]));

export const buildings: BuildingInstance[] = [];
export const colliders: BoxCollider[] = [];
export const sidewalks: { x: number; z: number; grass: boolean }[] = [];
export const palms: { x: number; z: number; s: number }[] = [];
export const lamps: { x: number; z: number }[] = [];

function addBuilding(b: BuildingInstance, collide = true) {
  buildings.push(b);
  if (collide) colliders.push({ x: b.x, z: b.z, hx: b.sx / 2 + 0.3, hz: b.sz / 2 + 0.3 });
}

// --- generate generic blocks + landmark lots ---
for (let i = 0; i < GRID; i++) {
  for (let j = 0; j < GRID; j++) {
    const o = blockOrigin(i, j);
    const cx = o.x + BLOCK / 2;
    const cz = o.z + BLOCK / 2;
    const lm = landmarkAt.get(i * 100 + j);
    sidewalks.push({ x: cx, z: cz, grass: lm?.kind === 'park' || lm?.kind === 'campus' });

    if (lm) continue; // landmark geometry + marker handled below

    // 2x2 sub-lots of generic buildings
    for (let a = 0; a < 2; a++) {
      for (let b = 0; b < 2; b++) {
        if (rng() < 0.12) continue; // empty lot
        const w = 10 + rng() * 4;
        const d = 10 + rng() * 4;
        const h = 7 + Math.floor(rng() * 5) * (4 + rng() * 4);
        const x = o.x + 8.5 + a * 17 + (rng() - 0.5) * 2;
        const z = o.z + 8.5 + b * 17 + (rng() - 0.5) * 2;
        addBuilding({ x, z, sx: w, sy: Math.min(h, 36), sz: d, color: SA_PALETTE[Math.floor(rng() * SA_PALETTE.length)] });
      }
    }
  }
}

// --- landmark geometry (still plain boxes, rendered with the same instanced mesh) ---
for (const lm of landmarks) {
  const o = blockOrigin(lm.block[0], lm.block[1]);
  const cx = o.x + BLOCK / 2;
  const cz = o.z + BLOCK / 2;
  switch (lm.kind) {
    case 'tower':
      addBuilding({ x: cx, z: cz - 3, sx: 18, sy: 52, sz: 18, color: '#5d7f9e' });
      addBuilding({ x: cx, z: cz - 3, sx: 12, sy: 60, sz: 12, color: '#6f93b4' });
      break;
    case 'office':
      addBuilding({ x: cx, z: cz - 4, sx: 26, sy: 26, sz: 16, color: '#9e8b6f' });
      addBuilding({ x: cx - 9, z: cz + 8, sx: 8, sy: 12, sz: 8, color: '#b8a888' });
      break;
    case 'garage':
      addBuilding({ x: cx, z: cz - 5, sx: 22, sy: 8, sz: 14, color: '#8f5a3c' });
      addBuilding({ x: cx + 12, z: cz - 5, sx: 2, sy: 12, sz: 2, color: '#704430' });
      break;
    case 'gym':
      addBuilding({ x: cx, z: cz - 4, sx: 20, sy: 10, sz: 16, color: '#a05050' });
      break;
    case 'campus':
      addBuilding({ x: cx, z: cz - 6, sx: 24, sy: 14, sz: 10, color: '#c8b594' });
      addBuilding({ x: cx - 10, z: cz + 6, sx: 6, sy: 9, sz: 8, color: '#b8a584' });
      addBuilding({ x: cx + 10, z: cz + 6, sx: 6, sy: 9, sz: 8, color: '#b8a584' });
      break;
    case 'cityhall':
      addBuilding({ x: cx, z: cz - 4, sx: 22, sy: 16, sz: 14, color: '#d8d0c0' });
      addBuilding({ x: cx, z: cz - 4, sx: 8, sy: 24, sz: 8, color: '#e0d8c8' });
      break;
    case 'park':
      // open park, payphone box only
      addBuilding({ x: cx + 6, z: cz + 6, sx: 1.6, sy: 2.6, sz: 1.6, color: '#2a6db5' });
      break;
  }
  // marker on the south sidewalk edge of the lot, just off the road
  lm.marker = { x: cx, z: o.z + BLOCK + 4 };
}

// --- palms + lamps along road edges ---
for (let i = 0; i <= GRID; i++) {
  const lineZ = -HALF + ROAD / 2 + i * PITCH;
  for (let x = -HALF + 14; x < HALF - 10; x += 24) {
    if (rng() < 0.5) palms.push({ x: x + (rng() - 0.5) * 4, z: lineZ + ROAD / 2 + 1.4, s: 0.85 + rng() * 0.4 });
    else lamps.push({ x, z: lineZ - ROAD / 2 - 1.2 });
  }
}
for (const p of palms) colliders.push({ x: p.x, z: p.z, hx: 0.5, hz: 0.5 });

// road center lines (for dashes + minimap): roads run at these coordinates
export const roadLines: number[] = [];
for (let i = 0; i <= GRID; i++) roadLines.push(-HALF + ROAD / 2 + i * PITCH);

export const spawn = { x: -HALF + ROAD / 2 + 3 * PITCH, z: -HALF + ROAD / 2 + 3 * PITCH };
export const carSpawn = { x: spawn.x + 6, z: spawn.z - 10 };

/** SA-style zone names, used for the gothic district popups */
export function districtAt(x: number, z: number): string {
  if (Math.abs(x) > HALF || Math.abs(z) > HALF) return 'The Badlands';
  const i = Math.min(GRID - 1, Math.max(0, Math.floor((x + HALF) / PITCH)));
  const j = Math.min(GRID - 1, Math.max(0, Math.floor((z + HALF) / PITCH)));
  if (i === 2 && j === 2) return 'Adhikari Park';
  if (i < 3 && j < 3) return 'Downtown Adhikari';
  if (i >= 3 && j < 3) return 'Commerce Heights';
  if (i < 3 && j >= 3) return 'University Ward';
  return 'East Beach';
}

export function collide(x: number, z: number, radius: number): { x: number; z: number } {
  let nx = x;
  let nz = z;
  for (const c of colliders) {
    const dx = nx - c.x;
    const dz = nz - c.z;
    const px = c.hx + radius - Math.abs(dx);
    const pz = c.hz + radius - Math.abs(dz);
    if (px > 0 && pz > 0) {
      if (px < pz) nx = c.x + Math.sign(dx || 1) * (c.hx + radius);
      else nz = c.z + Math.sign(dz || 1) * (c.hz + radius);
    }
  }
  nx = Math.max(-WORLD_BOUND, Math.min(WORLD_BOUND, nx));
  nz = Math.max(-WORLD_BOUND, Math.min(WORLD_BOUND, nz));
  return { x: nx, z: nz };
}
