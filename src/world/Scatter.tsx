"use client";

import { useMemo } from "react";
import { Instances, Instance } from "@react-three/drei";
import * as THREE from "three";

/**
 * Decorative scatter: instanced trees, rocks, flowers, grass tufts, lanterns
 * and fences. SEAM owned by the natural-environment agent.
 *
 * Determinism: NO Math.random() during render. A seeded mulberry32 PRNG drives
 * every position/scale/rotation, all computed ONCE in useMemo so the layout is
 * stable across re-renders. Repeated props use instancing (drei <Instances>).
 *
 * Placement rules: props never land on the winding path, on a building
 * footprint (+~2u margin), on the spawn point, or in the pond.
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
// Layout constants — mirror the world so placement avoids structures.
// ---------------------------------------------------------------------------
type V2 = [number, number];

const BUILDINGS: Array<{ pos: V2; half: V2 }> = [
  { pos: [0, 0], half: [2, 2] }, // about
  { pos: [-12, -8], half: [2.2, 2.2] }, // experience
  { pos: [12, -8], half: [2.4, 2.4] }, // projects
  { pos: [-13, 6], half: [2.2, 2.2] }, // skills
  { pos: [13, 6], half: [2, 2] }, // awards
  { pos: [0, 19], half: [1.8, 1.8] }, // contact
];
const BUILDING_MARGIN = 2;

const SPAWN: V2 = [0, 6];
const SPAWN_CLEAR = 3.5;

const POND_CENTER: V2 = [-9, -1];
const POND_CLEAR = 4.2;

// Path skeleton (same control points as Terrain): hub + branch endpoints.
const HUB: V2 = [0, 4];
const PATH_TARGETS: V2[] = [
  [0, 6], // spawn
  [0, 0.2], // about
  [-9.5, -6.5], // experience
  [9.5, -6.5], // projects
  [-10.5, 5.2], // skills
  [10.5, 5.2], // awards
  [0, 16.5], // contact
];
const PATH_SEGMENTS: Array<[V2, V2]> = [
  [PATH_TARGETS[0], HUB],
  [HUB, PATH_TARGETS[1]],
  [HUB, PATH_TARGETS[2]],
  [HUB, PATH_TARGETS[3]],
  [HUB, PATH_TARGETS[4]],
  [HUB, PATH_TARGETS[5]],
  [HUB, PATH_TARGETS[6]],
];
const PATH_CLEAR = 2.0; // keep props this far from the path centre-line

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
  for (const b of BUILDINGS) {
    if (
      Math.abs(x - b.pos[0]) < b.half[0] + BUILDING_MARGIN + extra &&
      Math.abs(z - b.pos[1]) < b.half[1] + BUILDING_MARGIN + extra
    ) {
      return false;
    }
  }
  if (Math.hypot(x - SPAWN[0], z - SPAWN[1]) < SPAWN_CLEAR + extra) return false;
  if (Math.hypot(x - POND_CENTER[0], z - POND_CENTER[1]) < POND_CLEAR + extra)
    return false;
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

/** A tree-crown blob: a Placed with an explicit crown height. */
interface FoliageBlob extends Placed {
  y: number;
}

/** Rejection-sample N clear placements within a square region. */
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
  }
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

// Foliage palette (sage -> deep forest)
const FOLIAGE = ["#a8cf8f", "#6fae6a", "#4e8a52"];
const FLOWER = ["#c8745f", "#cdbce8", "#f7f1e3", "#f0d27a"];

export function Scatter() {
  const layout = useMemo(() => {
    const rand = mulberry32(0xc0ffee);

    // --- Trees: pushed to the rim + groves between buildings ----------------
    const treeSlots = sample(rand, 110, {
      minR: 8,
      maxR: 58,
      sMin: 0.8,
      sMax: 1.9,
      extra: 0.6,
    });
    const trees = treeSlots.map((p) => {
      const blobCount = 1 + Math.floor(rand() * 3); // 1..3 foliage blobs
      const blobs = Array.from({ length: blobCount }, () => ({
        color: FOLIAGE[Math.floor(rand() * FOLIAGE.length)],
        ox: (rand() - 0.5) * 0.5,
        oz: (rand() - 0.5) * 0.5,
        oy: rand() * 0.5,
        r: 0.7 + rand() * 0.5,
      }));
      return { ...p, blobs };
    });
    // Flatten foliage blobs into instanced lists per palette color.
    const trunkInstances = trees.map((t) => ({
      x: t.x,
      z: t.z,
      s: t.s,
      rot: t.rot,
    }));
    const foliageByColor: Record<string, FoliageBlob[]> = {};
    FOLIAGE.forEach((c) => (foliageByColor[c] = []));
    for (const t of trees) {
      const trunkH = 1.4 * t.s;
      for (const b of t.blobs) {
        foliageByColor[b.color].push({
          x: t.x + b.ox * t.s,
          z: t.z + b.oz * t.s,
          s: b.r * t.s,
          rot: t.rot,
          y: trunkH + (0.8 + b.oy) * t.s,
        });
      }
    }

    // --- Rocks --------------------------------------------------------------
    const rocks = sample(rand, 55, {
      minR: 5,
      maxR: 56,
      sMin: 0.25,
      sMax: 1.0,
      extra: 0.2,
    });

    // --- Flower / grass tuft clusters --------------------------------------
    // Pick cluster centers, then dot a few tufts around each.
    const clusterCenters = sample(rand, 60, {
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

    // --- Lanterns: spaced along every path segment -------------------------
    const lanterns: V2[] = [];
    const lanternSide = 1.35; // offset from path centre-line
    for (const [a, b] of PATH_SEGMENTS) {
      const dx = b[0] - a[0];
      const dz = b[1] - a[1];
      const len = Math.hypot(dx, dz);
      const nx = dx / len;
      const nz = dz / len;
      const px = -nz; // perpendicular
      const pz = nx;
      const step = 5.5;
      let along = step * 0.6;
      let flip = 1;
      while (along < len - 1.2) {
        const cx = a[0] + nx * along + px * lanternSide * flip;
        const cz = a[1] + nz * along + pz * lanternSide * flip;
        // avoid dropping a lantern inside a building margin
        if (isClear(cx, cz, -1.4)) lanterns.push([cx, cz]);
        along += step;
        flip *= -1;
      }
    }

    // --- Fences: short runs lining a couple of building approaches ---------
    // Build picket lines along the edges of two segments (skills & projects).
    const fencePosts: Array<{ x: number; z: number; rot: number }> = [];
    const fenceRails: Array<{ x: number; z: number; rot: number; len: number }> =
      [];
    const makeFenceRun = (a: V2, b: V2, side: number) => {
      const dx = b[0] - a[0];
      const dz = b[1] - a[1];
      const len = Math.hypot(dx, dz);
      const nx = dx / len;
      const nz = dz / len;
      const px = -nz * 1.9 * side;
      const pz = nx * 1.9 * side;
      const rot = Math.atan2(nx, nz);
      const spacing = 1.1;
      const count = Math.floor((len - 2) / spacing);
      for (let i = 0; i <= count; i++) {
        const t = 1 + i * spacing;
        const x = a[0] + nx * t + px;
        const z = a[1] + nz * t + pz;
        fencePosts.push({ x, z, rot });
        if (i < count) {
          fenceRails.push({
            x: a[0] + nx * (t + spacing / 2) + px,
            z: a[1] + nz * (t + spacing / 2) + pz,
            rot,
            len: spacing,
          });
        }
      }
    };
    // skills branch and projects branch get a fence on their outer side
    makeFenceRun(HUB, PATH_TARGETS[4], 1); // skills
    makeFenceRun(HUB, PATH_TARGETS[3], -1); // projects

    return {
      trunkInstances,
      foliageByColor,
      rocks,
      flowersByColor,
      grass,
      lanterns,
      fencePosts,
      fenceRails,
    };
  }, []);

  return (
    <group>
      {/* ---- Tree trunks (one instanced mesh) ---- */}
      <Instances limit={400} castShadow receiveShadow>
        <cylinderGeometry args={[0.16, 0.26, 1.4, 6]} />
        <meshStandardMaterial color="#8a6a4a" roughness={1} flatShading />
        {layout.trunkInstances.map((t, i) => (
          <Instance
            key={i}
            position={[t.x, (1.4 * t.s) / 2, t.z]}
            scale={[t.s, t.s, t.s]}
            rotation={[0, t.rot, 0]}
          />
        ))}
      </Instances>

      {/* ---- Tree foliage blobs, one instanced mesh per palette color ---- */}
      {FOLIAGE.map((color) => (
        <Instances key={color} limit={400} castShadow>
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color={color} roughness={1} flatShading />
          {layout.foliageByColor[color].map((b, i) => (
            <Instance
              key={i}
              position={[b.x, b.y, b.z]}
              scale={[b.s, b.s * 0.92, b.s]}
              rotation={[0, b.rot, 0]}
            />
          ))}
        </Instances>
      ))}

      {/* ---- Rocks ---- */}
      <Instances limit={120} castShadow receiveShadow>
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

      {/* ---- Grass tufts ---- */}
      <Instances limit={600}>
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

      {/* ---- Flowers, one instanced mesh per color ---- */}
      {FLOWER.map((color) => (
        <Instances key={color} limit={400}>
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

      {/* ---- Lanterns: instanced posts + instanced emissive tops ---- */}
      <Instances limit={120} castShadow>
        <cylinderGeometry args={[0.07, 0.09, 1.5, 6]} />
        <meshStandardMaterial color="#5a4632" roughness={1} flatShading />
        {layout.lanterns.map((l, i) => (
          <Instance key={i} position={[l[0], 0.75, l[1]]} />
        ))}
      </Instances>
      <Instances limit={120}>
        <icosahedronGeometry args={[0.22, 0]} />
        <meshStandardMaterial
          color="#ffcaa0"
          emissive="#ffcaa0"
          emissiveIntensity={2.4}
          toneMapped={false}
        />
        {layout.lanterns.map((l, i) => (
          <Instance key={i} position={[l[0], 1.6, l[1]]} />
        ))}
      </Instances>

      {/* ---- Fences: instanced posts + instanced rails ---- */}
      <Instances limit={200} castShadow receiveShadow>
        <boxGeometry args={[0.12, 0.9, 0.12]} />
        <meshStandardMaterial color="#8a6a4a" roughness={1} flatShading />
        {layout.fencePosts.map((p, i) => (
          <Instance
            key={i}
            position={[p.x, 0.45, p.z]}
            rotation={[0, p.rot, 0]}
          />
        ))}
      </Instances>
      <Instances limit={200} castShadow>
        <boxGeometry args={[0.06, 0.08, 1]} />
        <meshStandardMaterial color="#a07d57" roughness={1} flatShading />
        {layout.fenceRails.map((r, i) => (
          <Instance
            key={i}
            position={[r.x, 0.6, r.z]}
            rotation={[0, r.rot, 0]}
            scale={[1, 1, r.len]}
          />
        ))}
      </Instances>
    </group>
  );
}
