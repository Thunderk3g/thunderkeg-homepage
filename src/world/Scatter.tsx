"use client";

import { useMemo } from "react";
import { Instances, Instance } from "@react-three/drei";

import { BUILDINGS } from "@/game/buildings";
import {
  SPAWN,
  PLAZA,
  GATE,
  MONSTER_FIELD,
  BUILDING_CLEAR_PAD,
} from "./layout";
import { useQuality } from "@/game/quality";

/**
 * Decorative scatter: instanced stylized trees, rocks, bushes, flower/grass
 * tufts and a ring of lily pads by the pond. SEAM owned by the
 * natural-environment agent.
 *
 * Determinism: NO Math.random() during render. A seeded mulberry32 PRNG drives
 * every position/scale/rotation, all computed ONCE in useMemo so the layout is
 * stable across re-renders. Everything repeated is instanced (drei <Instances>)
 * and — since none of this scatter ever moves — every static group carries
 * `frames={1}` to upload its matrices once and stop per-frame GPU traffic
 * (the iGPU loses its context on OOM, so this is load-bearing, not a nicety).
 *
 * Placement rules: props never land on the main path (plaza→building doorsteps,
 * plaza→gate), on a building footprint (+BUILDING_CLEAR_PAD), in the plaza, on
 * the spawn point, in the pond, or in the MONSTER_FIELD — that field stays OPEN
 * for the Bug Hunt skeletons.
 */

// ---------------------------------------------------------------------------
// Seeded PRNG
// ---------------------------------------------------------------------------
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Layout — derived from the SHARED contracts so scatter tracks the real world.
// (src/world/layout.ts + src/game/buildings.ts are the single source of truth.)
// ---------------------------------------------------------------------------
type V2 = [number, number];

/** Building footprints projected to XZ: centre + half-extents. */
const FOOTPRINTS: Array<{ pos: V2; half: V2 }> = BUILDINGS.map((b) => ({
  pos: [b.position[0], b.position[2]],
  half: [b.size[0], b.size[2]],
}));

const SPAWN_XZ: V2 = [SPAWN[0], SPAWN[2]];
const SPAWN_CLEAR = 3.0;

// Pond off to the west, between About and Experience. Centre + radius MUST
// match the Terrain water disc at (-9, 0, -1) (r≈3.1, rim≈3.6) so the lily
// pads land on the water and props avoid the shoreline.
const POND_CENTER: V2 = [-9, -1];
const POND_RADIUS = 3.1;
const POND_CLEAR = 3.6 + 0.6; // rim radius + a little bank breathing room

// Main path skeleton: every route radiates from the plaza centre — out to each
// building's doorstep and down to the south gate. We approximate the painted
// path as a fixed clearance corridor along each segment.
const PLAZA_C: V2 = [PLAZA.x, PLAZA.z];
const PATH_SEGMENTS: Array<[V2, V2]> = [
  ...BUILDINGS.map((b): [V2, V2] => [PLAZA_C, [b.position[0], b.position[2]]]),
  [PLAZA_C, GATE],
];
const PATH_CLEAR = 1.8; // keep props this far from the path centre-line

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------
function distToSegment(px: number, pz: number, a: V2, b: V2): number {
  const abx = b[0] - a[0];
  const abz = b[1] - a[1];
  const apx = px - a[0];
  const apz = pz - a[1];
  const len2 = abx * abx + abz * abz || 1e-6;
  let t = (apx * abx + apz * abz) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = a[0] + t * abx;
  const cz = a[1] + t * abz;
  return Math.hypot(px - cx, pz - cz);
}

/** True if (x,z) is a legal spot for a scatter prop. */
function isClear(x: number, z: number, extra = 0): boolean {
  // Building footprints + clearance pad.
  for (const b of FOOTPRINTS) {
    if (
      Math.abs(x - b.pos[0]) < b.half[0] + BUILDING_CLEAR_PAD + extra &&
      Math.abs(z - b.pos[1]) < b.half[1] + BUILDING_CLEAR_PAD + extra
    ) {
      return false;
    }
  }
  // Village green / plaza.
  if (Math.hypot(x - PLAZA.x, z - PLAZA.z) < PLAZA.radius + extra) return false;
  // Spawn breathing room.
  if (Math.hypot(x - SPAWN_XZ[0], z - SPAWN_XZ[1]) < SPAWN_CLEAR + extra)
    return false;
  // Pond.
  if (Math.hypot(x - POND_CENTER[0], z - POND_CENTER[1]) < POND_CLEAR + extra)
    return false;
  // Bug Hunt field — keep it open for the skeletons.
  if (
    Math.hypot(x - MONSTER_FIELD.x, z - MONSTER_FIELD.z) <
    MONSTER_FIELD.radius + extra
  )
    return false;
  // Main paths.
  for (const [a, b] of PATH_SEGMENTS) {
    if (distToSegment(x, z, a, b) < PATH_CLEAR + extra) return false;
  }
  return true;
}

interface Placed {
  x: number;
  z: number;
  s: number; // scale
  rot: number; // y rotation
}

/** Rejection-sample N clear placements within an annulus around the origin. */
function sample(
  rand: () => number,
  n: number,
  opts: {
    minR?: number;
    maxR?: number;
    sMin: number;
    sMax: number;
    extra?: number;
    centerBias?: boolean;
  },
): Placed[] {
  const out: Placed[] = [];
  const { sMin, sMax, extra = 0 } = opts;
  const minR = opts.minR ?? 0;
  const maxR = opts.maxR ?? 60;
  let guard = 0;
  while (out.length < n && guard < n * 60) {
    guard++;
    const ang = rand() * Math.PI * 2;
    // bias toward outer ring when centerBias=false (keeps centre cozy/open)
    const u = rand();
    const r = minR + (maxR - minR) * (opts.centerBias ? u : Math.sqrt(u));
    const x = Math.cos(ang) * r;
    const z = Math.sin(ang) * r;
    if (Math.abs(x) > 64 || Math.abs(z) > 64) continue;
    if (!isClear(x, z, extra)) continue;
    out.push({
      x,
      z,
      s: sMin + rand() * (sMax - sMin),
      rot: rand() * Math.PI * 2,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Palettes — few materials, warm Ghibli sage→forest greens + wildflowers.
// ---------------------------------------------------------------------------
const FOLIAGE = ["#a8cf8f", "#6fae6a", "#4e8a52"]; // light, mid, deep green
const FOLIAGE_INK = "#3a4a2f"; // dark back-foliage = cheap storybook ink edge
const BUSH = ["#7fb872", "#5f9a59"];
const FLOWER = ["#c8745f", "#cdbce8", "#f7f1e3", "#f0d27a"];

/** One foliage tier of a tree: a rounded blob sitting at height y. */
interface Tier {
  x: number;
  z: number;
  y: number;
  s: number; // radius scale
  rot: number;
  color: string;
}

export function Scatter() {
  // Skipped on the lite tier so the iGPU-safe fallback stays genuinely minimal
  // (driver exits the GPU process on context loss — prevention is the only fix).
  const lite = useQuality((s) => s.tier === "lite");
  const layout = useMemo(() => {
    const rand = mulberry32(0xc0ffee);

    // --- Trees: pushed to the rim + groves between buildings ----------------
    // Each tree = tapered trunk + 2-3 stacked, shrinking foliage tiers. Tiers
    // are flattened into per-color instance lists (few draw calls). A single
    // dark "back tier" per tree, scaled up slightly, fakes an ink outline.
    const treeSlots = sample(rand, 96, {
      minR: 7,
      maxR: 58,
      sMin: 0.85,
      sMax: 1.8,
      extra: 0.6,
    });

    const trunks: Placed[] = [];
    const tiersByColor: Record<string, Tier[]> = {};
    FOLIAGE.forEach((c) => (tiersByColor[c] = []));
    const inkTiers: Tier[] = [];

    for (const t of treeSlots) {
      const trunkH = 1.5 * t.s;
      trunks.push({ x: t.x, z: t.z, s: t.s, rot: t.rot });

      const tierCount = 2 + Math.floor(rand() * 2); // 2..3 tiers
      // Crown base sits a touch above the trunk top.
      let cy = trunkH * 0.78;
      let tierR = (0.95 + rand() * 0.35) * t.s; // bottom tier radius
      for (let i = 0; i < tierCount; i++) {
        const jx = (rand() - 0.5) * 0.18 * t.s;
        const jz = (rand() - 0.5) * 0.18 * t.s;
        const color = FOLIAGE[Math.min(FOLIAGE.length - 1, i)];
        const tier: Tier = {
          x: t.x + jx,
          z: t.z + jz,
          y: cy + tierR * 0.55,
          s: tierR,
          rot: t.rot + i * 1.1,
          color,
        };
        tiersByColor[color].push(tier);
        // Dark back-foliage twin (slightly larger) → cheap storybook ink edge.
        inkTiers.push({
          x: tier.x,
          z: tier.z,
          y: tier.y,
          s: tier.s * 1.08,
          rot: tier.rot,
          color: FOLIAGE_INK,
        });
        // Next tier sits higher and is smaller.
        cy += tierR * 0.72;
        tierR *= 0.7;
      }
    }

    // --- Rocks --------------------------------------------------------------
    const rocks = sample(rand, 48, {
      minR: 5,
      maxR: 56,
      sMin: 0.25,
      sMax: 1.0,
      extra: 0.2,
    });

    // --- Bushes: small rounded shrubs, clustered toward the rim ------------
    const bushSlots = sample(rand, 54, {
      minR: 6,
      maxR: 54,
      sMin: 0.5,
      sMax: 1.05,
      extra: 0.2,
    });
    const bushesByColor: Record<string, Placed[]> = {};
    BUSH.forEach((c) => (bushesByColor[c] = []));
    for (const b of bushSlots) {
      const col = BUSH[Math.floor(rand() * BUSH.length)];
      bushesByColor[col].push(b);
    }

    // --- Flower / grass tuft clusters --------------------------------------
    // Pick cluster centers, then dot a few tufts around each.
    const clusterCenters = sample(rand, 56, {
      minR: 4,
      maxR: 50,
      sMin: 1,
      sMax: 1,
      extra: 0,
      centerBias: true,
    });
    const flowersByColor: Record<string, Placed[]> = {};
    FLOWER.forEach((c) => (flowersByColor[c] = []));
    const grass: Placed[] = [];
    for (const c of clusterCenters) {
      const petals = 4 + Math.floor(rand() * 6);
      for (let i = 0; i < petals; i++) {
        const a = rand() * Math.PI * 2;
        const rr = rand() * 1.3;
        const x = c.x + Math.cos(a) * rr;
        const z = c.z + Math.sin(a) * rr;
        if (!isClear(x, z, 0)) continue;
        const placed: Placed = {
          x,
          z,
          s: 0.5 + rand() * 0.6,
          rot: rand() * Math.PI * 2,
        };
        if (rand() < 0.55) {
          const col = FLOWER[Math.floor(rand() * FLOWER.length)];
          flowersByColor[col].push(placed);
        } else {
          grass.push(placed);
        }
      }
    }

    // --- Lily pads: a little raft of discs floating on the pond -------------
    // Placed directly on the water surface (no isClear — they belong IN the
    // pond). Kept within the pond radius so none drift onto the bank.
    const lilies: Placed[] = [];
    const lilyCount = 7;
    for (let i = 0; i < lilyCount; i++) {
      const a = rand() * Math.PI * 2;
      const rr = rand() * (POND_RADIUS - 0.7);
      lilies.push({
        x: POND_CENTER[0] + Math.cos(a) * rr,
        z: POND_CENTER[1] + Math.sin(a) * rr,
        s: 0.45 + rand() * 0.5,
        rot: rand() * Math.PI * 2,
      });
    }

    return {
      trunks,
      tiersByColor,
      inkTiers,
      rocks,
      bushesByColor,
      flowersByColor,
      grass,
      lilies,
    };
  }, []);

  if (lite) return null;

  return (
    <group>
      {/* ---- Tree trunks (one instanced mesh, tapered + flat-shaded) ---- */}
      <Instances frames={1} limit={200} castShadow receiveShadow>
        <cylinderGeometry args={[0.14, 0.26, 1.5, 6]} />
        <meshStandardMaterial color="#8a6a4a" roughness={1} flatShading />
        {layout.trunks.map((t, i) => (
          <Instance
            key={i}
            position={[t.x, (1.5 * t.s) / 2, t.z]}
            scale={[t.s, t.s, t.s]}
            rotation={[0, t.rot, 0]}
          />
        ))}
      </Instances>

      {/* ---- Ink back-foliage: dark tier twins, rendered first so the
              colored crowns sit just in front → cheap storybook edge ---- */}
      <Instances frames={1} limit={400}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color={FOLIAGE_INK} roughness={1} flatShading />
        {layout.inkTiers.map((t, i) => (
          <Instance
            key={i}
            position={[t.x, t.y, t.z]}
            scale={[t.s, t.s * 0.92, t.s]}
            rotation={[0, t.rot, 0]}
          />
        ))}
      </Instances>

      {/* ---- Tree foliage tiers, one instanced mesh per green tone ---- */}
      {FOLIAGE.map((color) => (
        <Instances key={color} frames={1} limit={400} castShadow>
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color={color} roughness={1} flatShading />
          {layout.tiersByColor[color].map((t, i) => (
            <Instance
              key={i}
              position={[t.x, t.y, t.z]}
              scale={[t.s, t.s * 0.92, t.s]}
              rotation={[0, t.rot, 0]}
            />
          ))}
        </Instances>
      ))}

      {/* ---- Rocks ---- */}
      <Instances frames={1} limit={120} castShadow receiveShadow>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#9aa0a6" roughness={1} flatShading />
        {layout.rocks.map((r, i) => (
          <Instance
            key={i}
            position={[r.x, r.s * 0.35, r.z]}
            scale={[r.s, r.s * 0.7, r.s]}
            rotation={[r.rot * 0.3, r.rot, r.rot * 0.2]}
          />
        ))}
      </Instances>

      {/* ---- Bushes: rounded low-poly shrubs, one mesh per tone ---- */}
      {BUSH.map((color) => (
        <Instances key={color} frames={1} limit={120} castShadow receiveShadow>
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color={color} roughness={1} flatShading />
          {layout.bushesByColor[color].map((b, i) => (
            <Instance
              key={i}
              position={[b.x, b.s * 0.5, b.z]}
              scale={[b.s, b.s * 0.8, b.s]}
              rotation={[0, b.rot, 0]}
            />
          ))}
        </Instances>
      ))}

      {/* ---- Grass tufts ---- */}
      <Instances frames={1} limit={600}>
        <coneGeometry args={[0.14, 0.5, 5]} />
        <meshStandardMaterial color="#6fae6a" roughness={1} flatShading />
        {layout.grass.map((g, i) => (
          <Instance
            key={i}
            position={[g.x, 0.25 * g.s, g.z]}
            scale={[g.s, g.s, g.s]}
            rotation={[0, g.rot, 0]}
          />
        ))}
      </Instances>

      {/* ---- Flowers, one instanced mesh per warm wildflower color ---- */}
      {FLOWER.map((color) => (
        <Instances key={color} frames={1} limit={400}>
          <coneGeometry args={[0.12, 0.42, 6]} />
          <meshStandardMaterial
            color={color}
            roughness={0.8}
            emissive={color}
            emissiveIntensity={0.12}
            flatShading
          />
          {layout.flowersByColor[color].map((f, i) => (
            <Instance
              key={i}
              position={[f.x, 0.22 * f.s, f.z]}
              scale={[f.s, f.s, f.s]}
              rotation={[0, f.rot, 0]}
            />
          ))}
        </Instances>
      ))}

      {/* ---- Lily pads: flat discs floating just over the pond surface ---- */}
      <Instances frames={1} limit={40} receiveShadow>
        <cylinderGeometry args={[0.5, 0.5, 0.04, 7]} />
        <meshStandardMaterial color="#5f9a59" roughness={1} flatShading />
        {layout.lilies.map((l, i) => (
          <Instance
            key={i}
            position={[l.x, 0.06, l.z]}
            scale={[l.s, 1, l.s]}
            rotation={[0, l.rot, 0]}
          />
        ))}
      </Instances>
    </group>
  );
}
