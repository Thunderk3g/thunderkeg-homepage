"use client";

import { useMemo } from "react";
import { useTexture, Text, Instances, Instance } from "@react-three/drei";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import * as THREE from "three";

import { BUILDINGS } from "@/game/buildings";
import {
  PLAZA,
  GATE,
  frontOf,
  MOUNTAINS,
  FOREST,
  WORLD_EXTENT,
  type MountainSpec,
} from "@/world/layout";
import { useQuality } from "@/game/quality";

/**
 * Ground + village green + well + paths + gate + pond + CLIMBABLE mountains +
 * a forest grove + outskirt landmarks.
 * SEAM owned by the natural-environment agent.
 *
 * Physics: the player is a kinematic controller that walks on a FLAT physics
 * floor at y=0. The fixed-body CuboidCollider below MUST be preserved, and the
 * VISUAL ground in the play area (x∈[-16,16], z∈[-13,13]) must never poke above
 * y=0 (the player would clip through it). The play-area ground is therefore a
 * flat plane at y=0; only DECORATIVE landmarks (well, gate) rise above y=0 in
 * the village. OUTSIDE the village the world opens up to ±WORLD_EXTENT with
 * real, climbable mountains (each carrying a matching trimesh collider) so the
 * player can actually walk up and over the ridge into the passes.
 *
 * GPU budget: the iGPU loses its context on OOM. Everything repeated here is
 * instanced (drei <Instances frames={1}>) with few materials, low poly counts
 * and flatShading — no big textures, no per-frame matrix traffic.
 */

const PATH_Y = 0.02;
const PATH_HALF_WIDTH = 1.1;

// Warm dirt palette reused by every path tile / node so they share one look.
const PATH_TINT = "#d9c4a3";

/** A single straight cobble/dirt ribbon segment between two XZ points. */
function PathSegment({
  from,
  to,
  map,
}: {
  from: [number, number];
  to: [number, number];
  map: THREE.Texture;
}) {
  const [x0, z0] = from;
  const [x1, z1] = to;
  const dx = x1 - x0;
  const dz = z1 - z0;
  const len = Math.hypot(dx, dz);
  const angle = Math.atan2(dx, dz); // rotate around Y so +Z plane aligns to dir
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  // overlap the ends a touch so joints don't crack
  const planeLen = len + PATH_HALF_WIDTH * 1.6;
  const repeat = Math.max(1, Math.round(planeLen / 2));
  const tex = useMemo(() => {
    const t = map.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1, repeat);
    t.anisotropy = 8;
    t.needsUpdate = true;
    return t;
  }, [map, repeat]);

  return (
    <mesh
      position={[cx, PATH_Y, cz]}
      rotation={[-Math.PI / 2, 0, -angle]}
      receiveShadow
    >
      <planeGeometry args={[PATH_HALF_WIDTH * 2, planeLen]} />
      <meshStandardMaterial
        map={tex}
        color={PATH_TINT}
        roughness={0.95}
        polygonOffset
        polygonOffsetFactor={-1}
        polygonOffsetUnits={-1}
      />
    </mesh>
  );
}

/** A soft circular pad to mask the corner where several ribbons meet. */
function PathNode({ at }: { at: [number, number] }) {
  return (
    <mesh
      position={[at[0], PATH_Y - 0.001, at[1]]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
    >
      <circleGeometry args={[PATH_HALF_WIDTH * 1.25, 24]} />
      <meshStandardMaterial
        color={PATH_TINT}
        roughness={0.95}
        polygonOffset
        polygonOffsetFactor={-1}
        polygonOffsetUnits={-1}
      />
    </mesh>
  );
}

/**
 * Charming low-poly wishing well at the plaza centre. Visual only (no collider):
 * a stone basin, a still water disc, two timber posts, and a little gable roof.
 * All flat-shaded with warm colours to read as hand-built.
 */
function WishingWell() {
  return (
    <group position={[PLAZA.x, 0, PLAZA.z]}>
      {/* stone basin (short, wide cylinder) */}
      <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.95, 1.05, 0.9, 12]} />
        <meshStandardMaterial color="#b7a890" roughness={1} flatShading />
      </mesh>
      {/* mossy stone rim */}
      <mesh position={[0, 0.92, 0]} castShadow>
        <cylinderGeometry args={[1.0, 1.0, 0.16, 12]} />
        <meshStandardMaterial color="#9aa07a" roughness={1} flatShading />
      </mesh>
      {/* still water just below the rim */}
      <mesh position={[0, 0.84, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.82, 16]} />
        <meshStandardMaterial
          color="#5fa8c0"
          roughness={0.3}
          metalness={0.05}
          transparent
          opacity={0.9}
        />
      </mesh>
      {/* two timber posts holding the roof */}
      {[-0.78, 0.78].map((x) => (
        <mesh key={x} position={[x, 1.55, 0]} castShadow>
          <boxGeometry args={[0.16, 1.3, 0.16]} />
          <meshStandardMaterial color="#8a5a3a" roughness={1} flatShading />
        </mesh>
      ))}
      {/* cross-beam + winding bucket */}
      <mesh position={[0, 2.15, 0]} castShadow>
        <boxGeometry args={[1.85, 0.14, 0.14]} />
        <meshStandardMaterial color="#9a6a44" roughness={1} flatShading />
      </mesh>
      <mesh position={[0, 1.55, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.16, 0.32, 8]} />
        <meshStandardMaterial color="#7a4a2a" roughness={1} flatShading />
      </mesh>
      {/* little gable roof (a flat-shaded cone reads as a thatched/shingle peak) */}
      <mesh position={[0, 2.5, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[1.5, 0.85, 4]} />
        <meshStandardMaterial color="#c8745f" roughness={1} flatShading />
      </mesh>
    </group>
  );
}

/**
 * South gate / entrance arch: two timber posts, a top beam, and a small hanging
 * "Welcome" sign. Decorative landmark only (no collider) — sits at the GATE.
 */
function GateArch() {
  const [gx, gz] = GATE;
  const span = 3.2;
  return (
    <group position={[gx, 0, gz]}>
      {[-span / 2, span / 2].map((x) => (
        <mesh key={x} position={[x, 1.7, 0]} castShadow>
          <boxGeometry args={[0.3, 3.4, 0.3]} />
          <meshStandardMaterial color="#8a5a3a" roughness={1} flatShading />
        </mesh>
      ))}
      {/* top beam */}
      <mesh position={[0, 3.45, 0]} castShadow>
        <boxGeometry args={[span + 0.7, 0.34, 0.34]} />
        <meshStandardMaterial color="#9a6a44" roughness={1} flatShading />
      </mesh>
      {/* hanging sign board */}
      <mesh position={[0, 2.95, 0.02]} castShadow>
        <boxGeometry args={[1.7, 0.62, 0.08]} />
        <meshStandardMaterial color="#e8d8b8" roughness={1} flatShading />
      </mesh>
      <Text
        position={[0, 2.95, 0.08]}
        fontSize={0.3}
        anchorX="center"
        anchorY="middle"
        color="#5a3a22"
      >
        Welcome
      </Text>
    </group>
  );
}

/**
 * A single CLIMBABLE mountain. Geometry is a low-poly cone (a cylinder with a
 * tiny top radius) whose base radius == spec.radius and whose height ==
 * spec.height, so the side slope is atan(height / radius) ≈ 33-36° — under the
 * kinematic controller's 45° climb limit, so the player can walk UP it. The
 * base sits exactly at y=0 (position y = height/2). A matching `colliders=
 * "trimesh"` static rigid body gives the mesh a walk-on surface; trimesh hugs
 * the cone faces exactly so the visible slope IS the collidable slope. (If the
 * trimesh ever misbehaves with the kinematic controller, swapping to
 * colliders="hull" gives the same convex cone hull.)
 *
 * Taller peaks (height ≥ 10.5) get a lighter snow cap cone perched on top.
 */
function Mountain({ spec }: { spec: MountainSpec }) {
  const { x, z, radius, height } = spec;
  const radialSegments = 8;
  const topRadius = radius * 0.12;
  const hasSnow = height >= 10.5;
  // Snow cap covers roughly the top ~28% of the cone; it follows the same taper
  // so it sits flush on the slope and only adds a couple of triangles.
  const capFrac = 0.28;
  const capHeight = height * capFrac;
  const capBottomR = topRadius + (radius - topRadius) * capFrac;
  const capCenterY = height - capFrac * height * 0.5;

  return (
    <group position={[x, 0, z]}>
      <RigidBody type="fixed" colliders="trimesh">
        <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
          <cylinderGeometry
            args={[topRadius, radius, height, radialSegments]}
          />
          <meshStandardMaterial color="#7d7466" roughness={1} flatShading />
        </mesh>
      </RigidBody>

      {hasSnow && (
        // Snow cap is purely decorative; nudged up a hair to avoid z-fighting
        // with the rock cone it rests on. No collider needed (the rock cone
        // beneath already carries the walkable surface).
        <mesh position={[0, capCenterY + 0.02, 0]} castShadow>
          <cylinderGeometry
            args={[topRadius * 0.9, capBottomR, capHeight, radialSegments]}
          />
          <meshStandardMaterial color="#eef2f5" roughness={1} flatShading />
        </mesh>
      )}
    </group>
  );
}

/**
 * A grove of denser instanced trees ringing the FOREST landmark, plus a single
 * oversized "hero" tree at its centre to reward walking out to it. Deterministic
 * (seeded), all instanced with frames={1} so matrices upload once.
 */
function ForestGrove() {
  const layout = useMemo(() => {
    // Tiny seeded PRNG so the grove is stable across re-renders.
    let a = 0x5eed1eaf >>> 0;
    const rand = () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    interface Trunk {
      x: number;
      z: number;
      s: number;
      rot: number;
    }
    interface Tier {
      x: number;
      z: number;
      y: number;
      s: number;
      color: string;
    }

    const FOLIAGE = ["#5f9a59", "#4e8a52", "#3f7044"]; // a touch deeper/denser
    const trunks: Trunk[] = [];
    const tiersByColor: Record<string, Tier[]> = {};
    FOLIAGE.forEach((c) => (tiersByColor[c] = []));

    const count = 46;
    let guard = 0;
    while (trunks.length < count && guard < count * 30) {
      guard++;
      const ang = rand() * Math.PI * 2;
      // Dense ring within the grove; bias toward the rim so the centre stays
      // clear for the hero tree.
      const r = 2.2 + Math.sqrt(rand()) * (FOREST.radius - 1.2);
      const x = FOREST.x + Math.cos(ang) * r;
      const z = FOREST.z + Math.sin(ang) * r;
      const s = 0.9 + rand() * 0.9;
      const rot = rand() * Math.PI * 2;
      trunks.push({ x, z, s, rot });

      // 2-3 stacked shrinking foliage tiers per tree.
      const trunkH = 1.6 * s;
      let cy = trunkH * 0.78;
      let tierR = (1.0 + rand() * 0.35) * s;
      const tierCount = 2 + Math.floor(rand() * 2);
      for (let i = 0; i < tierCount; i++) {
        const color = FOLIAGE[Math.min(FOLIAGE.length - 1, i)];
        tiersByColor[color].push({
          x: x + (rand() - 0.5) * 0.2 * s,
          z: z + (rand() - 0.5) * 0.2 * s,
          y: cy + tierR * 0.55,
          s: tierR,
          color,
        });
        cy += tierR * 0.72;
        tierR *= 0.7;
      }
    }

    return { trunks, tiersByColor, FOLIAGE };
  }, []);

  return (
    <group>
      {/* Trunks */}
      <Instances frames={1} limit={80} castShadow receiveShadow>
        <cylinderGeometry args={[0.16, 0.3, 1.6, 6]} />
        <meshStandardMaterial color="#7a5a3c" roughness={1} flatShading />
        {layout.trunks.map((t, i) => (
          <Instance
            key={i}
            position={[t.x, (1.6 * t.s) / 2, t.z]}
            scale={[t.s, t.s, t.s]}
            rotation={[0, t.rot, 0]}
          />
        ))}
      </Instances>

      {/* Foliage tiers, one instanced mesh per tone */}
      {layout.FOLIAGE.map((color) => (
        <Instances key={color} frames={1} limit={240} castShadow>
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color={color} roughness={1} flatShading />
          {layout.tiersByColor[color].map((t, i) => (
            <Instance
              key={i}
              position={[t.x, t.y, t.z]}
              scale={[t.s, t.s * 0.92, t.s]}
            />
          ))}
        </Instances>
      ))}

      {/* Hero tree at the grove centre — a big landmark you can spot from afar */}
      <group position={[FOREST.x, 0, FOREST.z]}>
        <mesh position={[0, 2.0, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.45, 0.8, 4.0, 8]} />
          <meshStandardMaterial color="#6e4f34" roughness={1} flatShading />
        </mesh>
        <mesh position={[0, 4.6, 0]} castShadow>
          <icosahedronGeometry args={[2.6, 1]} />
          <meshStandardMaterial color="#4e8a52" roughness={1} flatShading />
        </mesh>
        <mesh position={[1.0, 5.6, 0.4]} castShadow>
          <icosahedronGeometry args={[1.7, 1]} />
          <meshStandardMaterial color="#5f9a59" roughness={1} flatShading />
        </mesh>
        <mesh position={[-1.0, 5.4, -0.5]} castShadow>
          <icosahedronGeometry args={[1.5, 1]} />
          <meshStandardMaterial color="#3f7044" roughness={1} flatShading />
        </mesh>
      </group>
    </group>
  );
}

/** Three weathered standing stones in a loose circle — an outskirt landmark. */
function StandingStones({ at }: { at: [number, number] }) {
  const stones: Array<[number, number, number, number]> = [
    // angle around the ring, height, tilt
    [0, 2.6, 0.06, 0.9],
    [(Math.PI * 2) / 3, 2.2, -0.05, 0.8],
    [(Math.PI * 4) / 3, 2.9, 0.04, 1.0],
  ];
  const ring = 1.6;
  return (
    <group position={[at[0], 0, at[1]]}>
      {stones.map(([ang, h, tilt, w], i) => (
        <mesh
          key={i}
          position={[Math.cos(ang) * ring, h / 2, Math.sin(ang) * ring]}
          rotation={[tilt, ang, tilt * 0.5]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[w, h, 0.5]} />
          <meshStandardMaterial color="#8b8478" roughness={1} flatShading />
        </mesh>
      ))}
      {/* a flat altar stone in the middle */}
      <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.0, 1.1, 0.5, 7]} />
        <meshStandardMaterial color="#9a9388" roughness={1} flatShading />
      </mesh>
    </group>
  );
}

/** A short wooden footbridge with railings — a landmark out in a pass. */
function WoodenBridge({
  at,
  rot = 0,
}: {
  at: [number, number];
  rot?: number;
}) {
  const deckLen = 5;
  const plankColor = "#9a6a44";
  return (
    <group position={[at[0], 0, at[1]]} rotation={[0, rot, 0]}>
      {/* deck */}
      <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.0, 0.18, deckLen]} />
        <meshStandardMaterial color={plankColor} roughness={1} flatShading />
      </mesh>
      {/* a gentle arched support beam underneath each side */}
      {[-0.8, 0.8].map((x) => (
        <mesh key={x} position={[x, 0.05, 0]} castShadow>
          <boxGeometry args={[0.16, 0.3, deckLen]} />
          <meshStandardMaterial color="#7a4a2a" roughness={1} flatShading />
        </mesh>
      ))}
      {/* railings: posts + a top rail on each side */}
      {[-0.92, 0.92].map((x) => (
        <group key={x}>
          {[-1.8, -0.6, 0.6, 1.8].map((z) => (
            <mesh key={z} position={[x, 0.7, z]} castShadow>
              <boxGeometry args={[0.12, 0.8, 0.12]} />
              <meshStandardMaterial color="#7a4a2a" roughness={1} flatShading />
            </mesh>
          ))}
          <mesh position={[x, 1.05, 0]} castShadow>
            <boxGeometry args={[0.12, 0.12, deckLen]} />
            <meshStandardMaterial color={plankColor} roughness={1} flatShading />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** A weather-beaten trail signpost pointing off toward the passes. */
function TrailSign({
  at,
  rot = 0,
}: {
  at: [number, number];
  rot?: number;
}) {
  return (
    <group position={[at[0], 0, at[1]]} rotation={[0, rot, 0]}>
      {/* post */}
      <mesh position={[0, 1.1, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.12, 2.2, 6]} />
        <meshStandardMaterial color="#7a4a2a" roughness={1} flatShading />
      </mesh>
      {/* two pointer boards */}
      <group position={[0.35, 1.7, 0]}>
        <mesh castShadow>
          <boxGeometry args={[1.2, 0.42, 0.08]} />
          <meshStandardMaterial color="#e8d8b8" roughness={1} flatShading />
        </mesh>
        <Text
          position={[0, 0, 0.06]}
          fontSize={0.22}
          anchorX="center"
          anchorY="middle"
          color="#5a3a22"
        >
          Pass
        </Text>
      </group>
      <group position={[-0.35, 1.18, 0]} rotation={[0, Math.PI, 0]}>
        <mesh castShadow>
          <boxGeometry args={[1.2, 0.42, 0.08]} />
          <meshStandardMaterial color="#e8d8b8" roughness={1} flatShading />
        </mesh>
        <Text
          position={[0, 0, 0.06]}
          fontSize={0.22}
          anchorX="center"
          anchorY="middle"
          color="#5a3a22"
        >
          Forest
        </Text>
      </group>
    </group>
  );
}

export function Terrain() {
  // On the lite tier (the iGPU-safe fallback) we drop the outer-ring ground,
  // climbable mountains, forest grove, and outskirt landmarks. Lite must stay
  // genuinely minimal — the user's driver exits its GPU process on context
  // loss, so the persisted-lite next-load is our only real safety net.
  const enriched = useQuality((s) => s.tier !== "lite");

  const [grass, path, water] = useTexture([
    "/textures/grass.png",
    "/textures/path.png",
    "/textures/water.png",
  ]);

  grass.wrapS = grass.wrapT = THREE.RepeatWrapping;
  grass.repeat.set(40, 40);
  grass.anisotropy = 8;

  // A second, more tightly-tiled grass clone for the village green so it reads
  // as a slightly different, well-trodden tone without a second texture upload.
  const greenGrass = useMemo(() => {
    const t = grass.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(6, 6);
    t.anisotropy = 8;
    t.needsUpdate = true;
    return t;
  }, [grass]);

  // A coarser, cooler-tiled grass clone for the OUTER world ring so the
  // outskirts read as wilder meadow as you head out toward the mountains —
  // reuses the same texture upload (no extra GPU memory).
  const outerGrass = useMemo(() => {
    const t = grass.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(60, 60);
    t.anisotropy = 8;
    t.needsUpdate = true;
    return t;
  }, [grass]);

  water.wrapS = water.wrapT = THREE.RepeatWrapping;
  water.repeat.set(3, 3);

  // Build the path network from the shared layout: a ring node at the plaza
  // edge feeds a ribbon to each building's doorstep (frontOf) and to the gate.
  const ringNode: [number, number] = [PLAZA.x, PLAZA.z + PLAZA.radius];
  const segments = useMemo<Array<[[number, number], [number, number]]>>(() => {
    const segs: Array<[[number, number], [number, number]]> = [];
    // plaza out to each cottage doorstep
    for (const b of BUILDINGS) {
      segs.push([[PLAZA.x, PLAZA.z], frontOf(b.position, b.size)]);
    }
    // plaza down to the south gate, threaded through a ring node so the join
    // sits neatly on the green's southern edge
    segs.push([[PLAZA.x, PLAZA.z], ringNode]);
    segs.push([ringNode, GATE]);
    return segs;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {/* PHYSICS GROUND — DO NOT MODIFY. Player walks on this flat y=0 floor. */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[70, 0.5, 70]} position={[0, -0.5, 0]} />
      </RigidBody>

      {/* Outer world ground ring (wilder meadow), reaching out past the
          mountains to ≈±WORLD_EXTENT so the explorable outskirts read as solid
          ground all the way to the ridge. Sits a hair below the inner plane to
          avoid z-fighting where they overlap. Skipped on lite. */}
      {enriched && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -0.01, 0]}
          receiveShadow
        >
          <planeGeometry args={[WORLD_EXTENT * 2 + 24, WORLD_EXTENT * 2 + 24]} />
          <meshStandardMaterial map={outerGrass} color="#8fbf7e" roughness={1} />
        </mesh>
      )}

      {/* Flat grass ground for the whole walkable village area, exactly at y=0. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[140, 140]} />
        <meshStandardMaterial map={grass} color="#a8cf8f" roughness={1} />
      </mesh>

      {/* Village GREEN: a circular dirt/cobble ring around a fresher inner lawn,
          centred on the plaza. Sits a hair above the ground to avoid z-fight. */}
      <group position={[PLAZA.x, 0, PLAZA.z]}>
        {/* trodden dirt ring (the "cobble" margin of the green) */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]} receiveShadow>
          <ringGeometry args={[PLAZA.radius - 0.5, PLAZA.radius + 0.6, 40]} />
          <meshStandardMaterial map={path} color={PATH_TINT} roughness={0.95} />
        </mesh>
        {/* fresher inner lawn (distinct, tighter-tiled grass tone) */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]} receiveShadow>
          <circleGeometry args={[PLAZA.radius, 40]} />
          <meshStandardMaterial map={greenGrass} color="#bcdf9c" roughness={1} />
        </mesh>
      </group>

      {/* Warm cobble/dirt paths: ribbons + node pads at the joins. */}
      {segments.map((s, i) => (
        <PathSegment key={i} from={s[0]} to={s[1]} map={path} />
      ))}
      <PathNode at={ringNode} />
      {BUILDINGS.map((b, i) => (
        <PathNode key={i} at={frontOf(b.position, b.size)} />
      ))}

      {/* Plaza centrepiece + south gate landmarks. */}
      <WishingWell />
      <GateArch />

      {/* Stylized calm pond — off to the west between About and Experience, well
          clear of the spawn camera and of the paths/buildings. Centre matches the
          Scatter pond-avoidance constant (-9,-1) so lily pads land on it. */}
      <group position={[-9, 0, -1]}>
        {/* sandy/mud rim just under the water to fake a shoreline */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} receiveShadow>
          <circleGeometry args={[3.6, 36]} />
          <meshStandardMaterial color="#cdb58e" roughness={1} />
        </mesh>
        {/* low grassy rim ridge to read the shoreline edge */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.018, 0]} receiveShadow>
          <ringGeometry args={[3.2, 3.6, 36]} />
          <meshStandardMaterial color="#9fbf7a" roughness={1} />
        </mesh>
        {/* translucent tinted water disc */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
          <circleGeometry args={[3.1, 36]} />
          <meshStandardMaterial
            map={water}
            color="#7fc4d6"
            transparent
            opacity={0.82}
            roughness={0.25}
            metalness={0.05}
          />
        </mesh>
      </group>

      {/* CLIMBABLE MOUNTAINS, forest grove, and outskirt landmarks — all the
          "explore beyond the village" content. Skipped on the lite tier so the
          guaranteed-safe fallback stays genuinely minimal. */}
      {enriched && (
        <>
          {MOUNTAINS.map((m, i) => (
            <Mountain key={i} spec={m} />
          ))}
          <ForestGrove />
          <StandingStones at={[-22, 28]} />
          <WoodenBridge at={[-30, -6]} rot={Math.PI / 6} />
          <TrailSign at={[24, -14]} rot={-Math.PI / 5} />
        </>
      )}
    </>
  );
}
