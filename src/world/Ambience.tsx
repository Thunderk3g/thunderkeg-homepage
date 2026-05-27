"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { BUILDINGS } from "@/game/buildings";
import { PLAZA, POND } from "./layout";

/**
 * In-Canvas ambient motion that makes the village feel alive — implemented by
 * the ambient-life agent. Four cheap systems, each driven by ONE useFrame with
 * MODULE-LEVEL temporaries (allocation-free per frame):
 *
 *   1. CHIMNEY SMOKE  — a few soft puffs rise + scale + fade above each cottage,
 *                       then recycle. One InstancedMesh, warm off-white.
 *   2. FLYING LIFE    — a small flock of pastel butterfly/bird quads wandering
 *                       sinusoidally over the green at 1.5-3u. One InstancedMesh.
 *   3. FIREFLIES      — ~12 warm emissive points bobbing over the pond, drawn as
 *                       THREE.Points (toneMapped=false so they glow).
 *   4. WATER SHIMMER  — a thin translucent disc just above the pond surface that
 *                       slowly rotates + pulses, so the water reads as alive.
 *
 * GPU budget (Intel iGPU): tens of items total, instanced/points, reused
 * materials, no post-processing, no textures.
 */

// ---------------------------------------------------------------------------
// Module-level temporaries — reused every frame, never allocated in useFrame.
// ---------------------------------------------------------------------------
const _pos = new THREE.Vector3();
const _scale = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _mat = new THREE.Matrix4();
const _color = new THREE.Color();

// A tiny seeded PRNG so the initial spread is stable across renders (no
// Math.random in render). Matches the determinism style used by Scatter.
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

export function Ambience() {
  return (
    <group>
      <ChimneySmoke />
      <Flock />
      <Fireflies />
      <WaterShimmer />
    </group>
  );
}

/* ============================================================
   1. CHIMNEY SMOKE — soft puffs rising above each cottage.
   ============================================================ */

const PUFFS_PER_COTTAGE = 4;

interface Puff {
  /** Chimney origin in world space. */
  ox: number;
  oy: number;
  oz: number;
  /** Phase offset so puffs from the same chimney don't pulse in lock-step. */
  phase: number;
  /** Per-puff lifetime + lateral drift, varied for organic motion. */
  life: number;
  driftX: number;
  driftZ: number;
}

function ChimneySmoke() {
  const ref = useRef<THREE.InstancedMesh>(null);

  const puffs = useMemo<Puff[]>(() => {
    const rand = mulberry32(0x510be);
    const out: Puff[] = [];
    for (const b of BUILDINGS) {
      // Approximate a chimney just off the roof ridge, toward +X.
      const ox = b.position[0] + b.size[0] * 0.5;
      const oy = b.position[1] + b.size[1] * 2 + 1.5;
      const oz = b.position[2];
      for (let i = 0; i < PUFFS_PER_COTTAGE; i += 1) {
        out.push({
          ox,
          oy,
          oz,
          phase: rand(),
          life: 3.2 + rand() * 2.4,
          driftX: (rand() - 0.5) * 0.5,
          driftZ: (rand() - 0.5) * 0.5,
        });
      }
    }
    return out;
  }, []);

  useFrame((state) => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < puffs.length; i += 1) {
      const p = puffs[i];
      // Normalized progress through this puff's rise (0 -> 1), recycling.
      const k = ((t / p.life + p.phase) % 1 + 1) % 1;
      const rise = k * 2.6; // how far it has climbed
      const sway = Math.sin((t + p.phase * 6.28) * 0.8) * 0.18;
      _pos.set(
        p.ox + p.driftX * rise + sway,
        p.oy + rise,
        p.oz + p.driftZ * rise,
      );
      // Grow as it rises, fade handled via scale->0 near top (cheap pseudo-fade
      // since a per-instance opacity would need a custom shader).
      const grow = 0.18 + k * 0.55;
      const taper = k > 0.7 ? (1 - k) / 0.3 : 1; // shrink out in the last 30%
      const s = grow * taper;
      _scale.set(s, s, s);
      _quat.identity();
      _mat.compose(_pos, _quat, _scale);
      mesh.setMatrixAt(i, _mat);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, puffs.length]}
      frustumCulled={false}
    >
      <icosahedronGeometry args={[1, 1]} />
      <meshStandardMaterial
        color="#f3ece0"
        transparent
        opacity={0.45}
        roughness={1}
        depthWrite={false}
        flatShading
      />
    </instancedMesh>
  );
}

/* ============================================================
   2. FLYING LIFE — a small flock wandering over the green.
   ============================================================ */

const FLOCK_COUNT = 12;
const FLOCK_COLORS = ["#f7d27a", "#f0a8c0", "#bcd9e8", "#f7f1e3", "#cdbce8"];

interface Flier {
  /** Orbit centre over the green + orbit radius. */
  cx: number;
  cz: number;
  radius: number;
  speed: number;
  phase: number;
  baseY: number;
  bobAmp: number;
  bobSpeed: number;
}

function Flock() {
  const ref = useRef<THREE.InstancedMesh>(null);

  const fliers = useMemo<Flier[]>(() => {
    const rand = mulberry32(0xb17e5);
    const out: Flier[] = [];
    for (let i = 0; i < FLOCK_COUNT; i += 1) {
      // Wander over the plaza/green and a little beyond its rim.
      const a = rand() * Math.PI * 2;
      const r = rand() * (PLAZA.radius + 2.5);
      out.push({
        cx: PLAZA.x + Math.cos(a) * r * 0.5,
        cz: PLAZA.z + Math.sin(a) * r * 0.5,
        radius: 1.2 + rand() * 2.6,
        speed: (rand() < 0.5 ? -1 : 1) * (0.25 + rand() * 0.4),
        phase: rand() * Math.PI * 2,
        baseY: 1.6 + rand() * 1.3,
        bobAmp: 0.2 + rand() * 0.35,
        bobSpeed: 0.8 + rand() * 1.2,
      });
    }
    return out;
  }, []);

  // Set per-instance colors once on mount.
  useFrame((state) => {
    const mesh = ref.current;
    if (!mesh) return;
    if (!mesh.instanceColor) {
      const rand = mulberry32(0xc010b);
      for (let i = 0; i < fliers.length; i += 1) {
        _color.set(FLOCK_COLORS[Math.floor(rand() * FLOCK_COLORS.length)]);
        mesh.setColorAt(i, _color);
      }
      // setColorAt lazily allocates instanceColor; flag it for upload.
      const ic = mesh.instanceColor as THREE.InstancedBufferAttribute | null;
      if (ic) ic.needsUpdate = true;
    }

    const t = state.clock.elapsedTime;
    for (let i = 0; i < fliers.length; i += 1) {
      const f = fliers[i];
      const ang = f.phase + t * f.speed;
      const x = f.cx + Math.cos(ang) * f.radius;
      const z = f.cz + Math.sin(ang) * f.radius;
      const y = f.baseY + Math.sin(t * f.bobSpeed + f.phase) * f.bobAmp;
      _pos.set(x, y, z);
      // "Wing flutter" — squash the quad on X in a fast sine to fake flapping,
      // and face the direction of travel so it banks through the turn.
      const flap = 0.55 + Math.abs(Math.sin(t * 9 + f.phase)) * 0.45;
      _scale.set(0.28 * flap, 0.28, 0.28);
      _quat.setFromAxisAngle(UP, ang + Math.PI / 2);
      _mat.compose(_pos, _quat, _scale);
      mesh.setMatrixAt(i, _mat);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, FLOCK_COUNT]}
      frustumCulled={false}
    >
      <planeGeometry args={[1, 0.6]} />
      <meshStandardMaterial
        color="#ffffff"
        side={THREE.DoubleSide}
        roughness={0.7}
        flatShading
      />
    </instancedMesh>
  );
}

const UP = new THREE.Vector3(0, 1, 0);

/* ============================================================
   3. FIREFLIES — warm emissive points bobbing over the pond.
   ============================================================ */

const FIREFLY_COUNT = 12;

function Fireflies() {
  const ref = useRef<THREE.Points>(null);

  // Static spawn offsets within the pond disc; bob/drift applied per frame.
  const seeds = useMemo(() => {
    const rand = mulberry32(0xf17e);
    const arr: { bx: number; bz: number; phase: number; ampY: number; ampX: number }[] =
      [];
    for (let i = 0; i < FIREFLY_COUNT; i += 1) {
      const a = rand() * Math.PI * 2;
      const r = rand() * (POND.radius - 0.3);
      arr.push({
        bx: POND.x + Math.cos(a) * r,
        bz: POND.z + Math.sin(a) * r,
        phase: rand() * Math.PI * 2,
        ampY: 0.25 + rand() * 0.4,
        ampX: 0.2 + rand() * 0.5,
      });
    }
    return arr;
  }, []);

  // A fixed Float32 buffer we mutate in place each frame (allocation-free).
  const positions = useMemo(
    () => new Float32Array(FIREFLY_COUNT * 3),
    [],
  );

  useFrame((state) => {
    const pts = ref.current;
    if (!pts) return;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < seeds.length; i += 1) {
      const s = seeds[i];
      positions[i * 3] = s.bx + Math.sin(t * 0.5 + s.phase) * s.ampX;
      positions[i * 3 + 1] =
        0.6 + Math.sin(t * 0.9 + s.phase * 2) * s.ampY * 0.5 + s.ampY;
      positions[i * 3 + 2] = s.bz + Math.cos(t * 0.45 + s.phase) * s.ampX;
    }
    const attr = pts.geometry.getAttribute("position") as THREE.BufferAttribute;
    attr.needsUpdate = true;
  });

  return (
    <points ref={ref} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#ffe6a0"
        size={0.18}
        sizeAttenuation
        transparent
        opacity={0.9}
        depthWrite={false}
        toneMapped={false}
      />
    </points>
  );
}

/* ============================================================
   4. WATER SHIMMER — a thin translucent disc over the pond.
   ============================================================ */

function WaterShimmer() {
  const ref = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (ref.current) {
      ref.current.rotation.z = t * 0.06; // slow swirl
      const pulse = 1 + Math.sin(t * 0.7) * 0.015;
      ref.current.scale.set(pulse, pulse, 1);
    }
    if (matRef.current) {
      matRef.current.opacity = 0.12 + (Math.sin(t * 0.9) * 0.5 + 0.5) * 0.14;
    }
  });

  return (
    <mesh
      ref={ref}
      position={[POND.x, 0.05, POND.z]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <circleGeometry args={[POND.radius * 0.98, 40]} />
      <meshStandardMaterial
        ref={matRef}
        color="#dff3ff"
        emissive="#bfe6ff"
        emissiveIntensity={0.25}
        transparent
        opacity={0.18}
        roughness={0.15}
        metalness={0.1}
        depthWrite={false}
      />
    </mesh>
  );
}
