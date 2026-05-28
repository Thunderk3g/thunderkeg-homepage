"use client";

import { useMemo } from "react";
import { Instances, Instance, Text } from "@react-three/drei";

import { BUILDINGS } from "@/game/buildings";
import { SPAWN, PLAZA, GATE, frontOf } from "./layout";
import { useQuality } from "@/game/quality";

/**
 * In-Canvas plaza/village dressing: market stalls, benches, a notice board,
 * scattered barrels/crates, standing/hanging lanterns along the paths, and a
 * festive banner string near the gate. Reads layout.ts + BUILDINGS so it tracks
 * the real world.
 *
 * Performance: VISUAL ONLY (no colliders). Repeated props are instanced via drei
 * <Instances frames={1}> so each kind uploads its matrices once and never pays
 * per-frame GPU traffic (the iGPU loses context on OOM — load-bearing). No
 * Math.random() during render: a seeded mulberry32 PRNG drives every jitter,
 * computed ONCE in useMemo so placement is stable across re-renders.
 *
 * Placement: everything hugs the plaza EDGE, path SIDES, or gaps between
 * buildings. The SPAWN point and the central walking corridors (plaza→gate,
 * plaza→doorsteps) are kept clear so nothing blocks movement.
 */

// ---------------------------------------------------------------------------
// Palette — warm, few materials, flat-shaded.
// ---------------------------------------------------------------------------
const WOOD = "#8a6a4a";
const WOOD_DARK = "#5f4730";
const CANVAS = "#f3ead6";
const INK = "#4a3f35";
const LANTERN = "#ffd98a";
const LANTERN_EMIT = "#ffb347";
const AWNING = ["#cf6a5a", "#e7c46a", "#6fae9a"]; // warm striped awning tones
const BARREL = "#9c7a52";

type V2 = [number, number];

// ---------------------------------------------------------------------------
// Seeded PRNG (matches Scatter's determinism contract).
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

const PLAZA_C: V2 = [PLAZA.x, PLAZA.z];
const SPAWN_XZ: V2 = [SPAWN[0], SPAWN[2]];

/** Point at `r` from plaza centre toward angle `ang` (radians). */
function ringPoint(ang: number, r: number): V2 {
  return [PLAZA_C[0] + Math.cos(ang) * r, PLAZA_C[1] + Math.sin(ang) * r];
}

interface Placed {
  x: number;
  z: number;
  rot: number; // y rotation, faces plaza centre by default
}

/** Y-rotation so a +Z-front prop faces the plaza centre from (x,z). */
function faceCenter(x: number, z: number): number {
  return Math.atan2(PLAZA_C[0] - x, PLAZA_C[1] - z);
}

export function Dressing() {
  // Skipped on the lite tier so the iGPU-safe fallback stays genuinely minimal.
  const lite = useQuality((s) => s.tier === "lite");
  const layout = useMemo(() => {
    const rand = mulberry32(0x5ad0c0);

    // --- Lanterns: standing lanterns along the doorstep approaches ---------
    // One pair flanking each building's front (between it and the plaza), set
    // off to the SIDES of the path so they line the route without blocking it.
    const lanternPosts: Placed[] = [];
    for (const b of BUILDINGS) {
      const [fx, fz] = frontOf(b.position, b.size, 1.2);
      // sideways (perpendicular to the radial path) offset
      const len = Math.hypot(fx, fz) || 1;
      const px = -fz / len; // perpendicular unit
      const pz = fx / len;
      for (const s of [-1, 1]) {
        lanternPosts.push({
          x: fx + px * s * 1.7,
          z: fz + pz * s * 1.7,
          rot: faceCenter(fx, fz),
        });
      }
    }

    // --- Barrels & crates: tucked at the plaza rim, off the path mouths -----
    const barrels: Placed[] = [];
    const crates: Placed[] = [];
    const rimR = PLAZA.radius + 1.0;
    // candidate angles around the rim, skip ones that sit on a path mouth (a
    // path leaves the plaza toward each building + the gate).
    const pathAngles = [
      ...BUILDINGS.map((b) =>
        Math.atan2(b.position[2] - PLAZA_C[1], b.position[0] - PLAZA_C[0]),
      ),
      Math.atan2(GATE[1] - PLAZA_C[1], GATE[0] - PLAZA_C[0]),
    ];
    const nearPath = (ang: number) =>
      pathAngles.some((pa) => {
        const d = Math.abs(((ang - pa + Math.PI) % (Math.PI * 2)) - Math.PI);
        return d < 0.45;
      });
    for (let k = 0; k < 16; k++) {
      const ang = (k / 16) * Math.PI * 2 + 0.2;
      if (nearPath(ang)) continue;
      const [x, z] = ringPoint(ang, rimR + (rand() - 0.5) * 0.5);
      if (Math.hypot(x - SPAWN_XZ[0], z - SPAWN_XZ[1]) < 3.0) continue;
      const rot = rand() * Math.PI * 2;
      if (rand() < 0.5) barrels.push({ x, z, rot });
      else crates.push({ x, z, rot });
    }

    // --- Hanging lanterns: small glow blobs threaded along the gate path ---
    // (rendered as standalone emissive instances; the "string" is the banner.)
    const gatePath: Placed[] = [];
    {
      const a: V2 = PLAZA_C;
      const b: V2 = GATE;
      for (let i = 1; i <= 4; i++) {
        const t = i / 5;
        const mx = a[0] + (b[0] - a[0]) * t;
        const mz = a[1] + (b[1] - a[1]) * t;
        for (const s of [-1, 1]) {
          // offset to the SIDE of the gate path so the corridor stays clear
          gatePath.push({ x: mx + s * 2.4, z: mz, rot: 0 });
        }
      }
    }

    return { lanternPosts, barrels, crates, gatePath };
  }, []);

  // Two market stalls at the plaza edge, in gaps BETWEEN path mouths.
  const stalls = useMemo<Placed[]>(() => {
    const r = PLAZA.radius + 1.6;
    // angles chosen in the open NE / NW gaps between building paths
    return [
      { ...toPlaced(ringPoint(-0.9, r)) },
      { ...toPlaced(ringPoint(Math.PI + 0.9, r)) },
    ];
    function toPlaced([x, z]: V2): Placed {
      return { x, z, rot: faceCenter(x, z) };
    }
  }, []);

  // Notice board + the welcome bench sit just inside the gate, off to the side.
  const noticeBoard: Placed = useMemo(() => {
    const x = GATE[0] - 3.2;
    const z = (GATE[1] + PLAZA.radius) * 0.5;
    return { x, z, rot: Math.atan2(0 - x, 0 - z) };
  }, []);

  // Banner posts span the gate mouth (well to the sides of the walking line).
  const banner = useMemo(() => {
    const z = GATE[1] - 1.0;
    const half = 3.0;
    return { z, half };
  }, []);

  if (lite) return null;

  return (
    <group>
      {/* ===================== MARKET STALLS ===================== */}
      {stalls.map((st, i) => (
        <group
          key={i}
          position={[st.x, 0, st.z]}
          rotation={[0, st.rot, 0]}
        >
          {/* counter */}
          <mesh castShadow receiveShadow position={[0, 0.55, 0.5]}>
            <boxGeometry args={[2.0, 0.12, 0.7]} />
            <meshStandardMaterial color={WOOD} flatShading roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.27, 0.5]}>
            <boxGeometry args={[2.0, 0.54, 0.66]} />
            <meshStandardMaterial color={WOOD_DARK} flatShading roughness={1} />
          </mesh>
          {/* four corner posts */}
          {[
            [-0.9, 0.3],
            [0.9, 0.3],
            [-0.9, -0.5],
            [0.9, -0.5],
          ].map(([px, pz], j) => (
            <mesh key={j} castShadow position={[px, 0.95, pz]}>
              <cylinderGeometry args={[0.06, 0.07, 1.9, 6]} />
              <meshStandardMaterial color={WOOD_DARK} flatShading />
            </mesh>
          ))}
          {/* striped awning: a few angled slats in alternating warm tones */}
          <group position={[0, 1.95, -0.1]} rotation={[-0.32, 0, 0]}>
            {[-0.75, -0.25, 0.25, 0.75].map((ox, j) => (
              <mesh key={j} castShadow position={[ox, 0, 0]}>
                <boxGeometry args={[0.5, 0.06, 1.5]} />
                <meshStandardMaterial
                  color={AWNING[j % AWNING.length]}
                  flatShading
                  roughness={0.85}
                />
              </mesh>
            ))}
          </group>
          {/* a couple of goods on the counter (crates/produce blobs) */}
          <mesh castShadow position={[-0.6, 0.74, 0.5]}>
            <boxGeometry args={[0.34, 0.3, 0.34]} />
            <meshStandardMaterial color={BARREL} flatShading />
          </mesh>
          {[0.3, 0.6, 0.85].map((ox, j) => (
            <mesh key={j} position={[ox, 0.7, 0.5]}>
              <icosahedronGeometry args={[0.11, 0]} />
              <meshStandardMaterial
                color={j % 2 ? "#cf6a5a" : "#e7c46a"}
                flatShading
              />
            </mesh>
          ))}
        </group>
      ))}

      {/* ===================== NOTICE BOARD ===================== */}
      <group
        position={[noticeBoard.x, 0, noticeBoard.z]}
        rotation={[0, noticeBoard.rot, 0]}
      >
        {[-0.7, 0.7].map((px) => (
          <mesh key={px} castShadow position={[px, 0.8, 0]}>
            <cylinderGeometry args={[0.07, 0.08, 1.6, 6]} />
            <meshStandardMaterial color={WOOD_DARK} flatShading />
          </mesh>
        ))}
        <mesh castShadow position={[0, 1.3, 0]}>
          <boxGeometry args={[1.8, 1.0, 0.1]} />
          <meshStandardMaterial color={CANVAS} flatShading roughness={0.95} />
        </mesh>
        {/* board frame + a small gable cap */}
        <mesh position={[0, 1.3, -0.06]}>
          <boxGeometry args={[1.95, 1.15, 0.06]} />
          <meshStandardMaterial color={WOOD} flatShading />
        </mesh>
        <mesh castShadow position={[0, 1.92, 0]} rotation={[0.5, 0, 0]}>
          <boxGeometry args={[2.0, 0.08, 0.4]} />
          <meshStandardMaterial color={WOOD_DARK} flatShading />
        </mesh>
        <mesh castShadow position={[0, 1.92, 0]} rotation={[-0.5, 0, 0]}>
          <boxGeometry args={[2.0, 0.08, 0.4]} />
          <meshStandardMaterial color={WOOD_DARK} flatShading />
        </mesh>
        <Text
          position={[0, 1.55, 0.06]}
          fontSize={0.2}
          anchorX="center"
          anchorY="middle"
          color={INK}
        >
          VILLAGE NOTICES
        </Text>
        {/* a couple of "pinned papers" */}
        {[
          [-0.45, 1.15],
          [0.4, 1.05],
        ].map(([px, py], j) => (
          <mesh key={j} position={[px, py, 0.07]} rotation={[0, 0, (j ? -1 : 1) * 0.08]}>
            <boxGeometry args={[0.5, 0.4, 0.01]} />
            <meshStandardMaterial color="#fffaf0" flatShading />
          </mesh>
        ))}
      </group>

      {/* ===================== GATE BANNER STRING ===================== */}
      {/* Two posts at the gate sides + a string of pennant flags between them. */}
      {[-1, 1].map((s) => (
        <mesh key={s} castShadow position={[s * banner.half, 1.2, banner.z]}>
          <cylinderGeometry args={[0.08, 0.1, 2.4, 6]} />
          <meshStandardMaterial color={WOOD_DARK} flatShading />
        </mesh>
      ))}
      {/* string line */}
      <mesh position={[0, 2.2, banner.z]}>
        <boxGeometry args={[banner.half * 2, 0.03, 0.03]} />
        <meshStandardMaterial color={INK} />
      </mesh>
      {/* pennant flags */}
      {Array.from({ length: 9 }).map((_, i) => {
        const t = i / 8;
        const fx = -banner.half + t * banner.half * 2;
        const cols = ["#cf6a5a", "#e7c46a", "#6fae9a", "#bcd9e8", "#cdbce8"];
        return (
          <mesh
            key={i}
            position={[fx, 2.05, banner.z]}
            rotation={[Math.PI, 0, 0]}
          >
            <coneGeometry args={[0.1, 0.28, 3]} />
            <meshStandardMaterial color={cols[i % cols.length]} flatShading side={2} />
          </mesh>
        );
      })}

      {/* ===================== STANDING LANTERN POSTS (instanced) ===================== */}
      {/* posts */}
      <Instances frames={1} limit={40} castShadow>
        <cylinderGeometry args={[0.06, 0.08, 2.0, 6]} />
        <meshStandardMaterial color={WOOD_DARK} roughness={1} flatShading />
        {layout.lanternPosts.map((p, i) => (
          <Instance key={i} position={[p.x, 1.0, p.z]} rotation={[0, p.rot, 0]} />
        ))}
      </Instances>
      {/* lantern cages (glowing) */}
      <Instances frames={1} limit={40}>
        <boxGeometry args={[0.22, 0.3, 0.22]} />
        <meshStandardMaterial
          color={LANTERN}
          emissive={LANTERN_EMIT}
          emissiveIntensity={0.85}
          flatShading
        />
        {layout.lanternPosts.map((p, i) => (
          <Instance key={i} position={[p.x, 2.05, p.z]} />
        ))}
      </Instances>
      {/* lantern caps */}
      <Instances frames={1} limit={40} castShadow>
        <coneGeometry args={[0.2, 0.18, 4]} />
        <meshStandardMaterial color={WOOD_DARK} roughness={1} flatShading />
        {layout.lanternPosts.map((p, i) => (
          <Instance key={i} position={[p.x, 2.3, p.z]} rotation={[0, Math.PI / 4, 0]} />
        ))}
      </Instances>

      {/* ===================== HANGING LANTERNS ALONG GATE PATH (instanced) ===================== */}
      {/* short hook posts */}
      <Instances frames={1} limit={20} castShadow>
        <cylinderGeometry args={[0.05, 0.06, 2.4, 6]} />
        <meshStandardMaterial color={WOOD_DARK} roughness={1} flatShading />
        {layout.gatePath.map((p, i) => (
          <Instance key={i} position={[p.x, 1.2, p.z]} />
        ))}
      </Instances>
      {/* glowing hanging blobs */}
      <Instances frames={1} limit={20}>
        <icosahedronGeometry args={[0.16, 0]} />
        <meshStandardMaterial
          color={LANTERN}
          emissive={LANTERN_EMIT}
          emissiveIntensity={0.9}
          flatShading
        />
        {layout.gatePath.map((p, i) => (
          <Instance key={i} position={[p.x + (p.x > GATE[0] ? -0.3 : 0.3), 2.05, p.z]} />
        ))}
      </Instances>

      {/* ===================== BARRELS (instanced) ===================== */}
      <Instances frames={1} limit={30} castShadow receiveShadow>
        <cylinderGeometry args={[0.34, 0.3, 0.85, 10]} />
        <meshStandardMaterial color={BARREL} roughness={0.9} flatShading />
        {layout.barrels.map((b, i) => (
          <Instance key={i} position={[b.x, 0.43, b.z]} rotation={[0, b.rot, 0]} />
        ))}
      </Instances>
      {/* barrel hoop rims (one dark band each, instanced) */}
      <Instances frames={1} limit={30}>
        <torusGeometry args={[0.34, 0.03, 5, 12]} />
        <meshStandardMaterial color={WOOD_DARK} roughness={1} flatShading />
        {layout.barrels.map((b, i) => (
          <Instance
            key={i}
            position={[b.x, 0.55, b.z]}
            rotation={[Math.PI / 2, 0, 0]}
          />
        ))}
      </Instances>

      {/* ===================== CRATES (instanced) ===================== */}
      <Instances frames={1} limit={30} castShadow receiveShadow>
        <boxGeometry args={[0.6, 0.6, 0.6]} />
        <meshStandardMaterial color={WOOD} roughness={0.95} flatShading />
        {layout.crates.map((c, i) => (
          <Instance key={i} position={[c.x, 0.3, c.z]} rotation={[0, c.rot, 0]} />
        ))}
      </Instances>
    </group>
  );
}
