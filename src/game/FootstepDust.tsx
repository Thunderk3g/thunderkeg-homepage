"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { playerPosition, playerSpeed } from "./refs";

/**
 * In-Canvas footstep dust: small warm puffs spawned at the player's feet while
 * moving. A single InstancedMesh pools a fixed number of puffs (allocation-free
 * per frame — Intel iGPU budget). Each puff scales up + rises + fades over its
 * lifetime, then recycles.
 */

const COUNT = 16;
const LIFE = 0.6; // seconds per puff
const EMIT_DIST = 0.9; // world units travelled between emissions
const SPEED_THRESHOLD = 0.4; // min speed (u/s) to leave dust
const FOOT_Y = 0.05;
const RISE = 0.35; // how high a puff drifts over its life
const BASE_SCALE = 0.18;
const MAX_SCALE = 0.55;

// Module-level scratch — reused every frame, never reallocated.
const tmpPos = new THREE.Vector3();
const tmpScale = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();
const tmpMatrix = new THREE.Matrix4();
const lastEmit = new THREE.Vector3().copy(playerPosition);
const dustColor = new THREE.Color("#cda984"); // warm storybook dust
const UP = new THREE.Vector3(0, 1, 0);

// Per-puff pool state (plain typed arrays — no GC churn).
const ages = new Float32Array(COUNT).fill(LIFE + 1); // start "dead"
const px = new Float32Array(COUNT);
const py = new Float32Array(COUNT);
const pz = new Float32Array(COUNT);
const rot = new Float32Array(COUNT);
let cursor = 0;
let initialized = false;

export function FootstepDust() {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  useFrame((_, dt) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const step = Math.min(dt, 0.05);

    // One-time: hide all instances and seed the emit tracker.
    if (!initialized) {
      initialized = true;
      lastEmit.copy(playerPosition);
      for (let i = 0; i < COUNT; i++) {
        tmpMatrix.makeScale(0, 0, 0);
        mesh.setMatrixAt(i, tmpMatrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }

    // --- emission: drop a puff each EMIT_DIST of travel while moving ---
    if (playerSpeed.value > SPEED_THRESHOLD) {
      const dx = playerPosition.x - lastEmit.x;
      const dz = playerPosition.z - lastEmit.z;
      if (dx * dx + dz * dz >= EMIT_DIST * EMIT_DIST) {
        // Spawn at the trailing foot position.
        const i = cursor;
        cursor = (cursor + 1) % COUNT;
        ages[i] = 0;
        px[i] = lastEmit.x;
        py[i] = FOOT_Y;
        pz[i] = lastEmit.z;
        rot[i] = Math.random() * Math.PI * 2;
        lastEmit.copy(playerPosition);
      }
    } else {
      // Keep the tracker glued to the player while idle so the first step
      // after stopping doesn't dump a stale long-distance puff.
      lastEmit.copy(playerPosition);
    }

    // --- advance + write every instance ---
    for (let i = 0; i < COUNT; i++) {
      const age = ages[i];
      if (age > LIFE) {
        // Dead: ensure it's collapsed (cheap; idempotent).
        tmpMatrix.makeScale(0, 0, 0);
        mesh.setMatrixAt(i, tmpMatrix);
        continue;
      }

      ages[i] = age + step;
      const t = THREE.MathUtils.clamp(age / LIFE, 0, 1); // 0..1 life progress

      // Scale envelope: pop up quickly (sqrt grow) then shrink away in the last
      // third so the puff visibly "dissipates" — fading via geometry keeps the
      // shared material opacity stable (no per-instance alpha needed).
      const grow = BASE_SCALE + (MAX_SCALE - BASE_SCALE) * Math.sqrt(t);
      const shrink = t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1; // 1 → 0 over last 40%
      const scale = grow * shrink;
      // Rise gently.
      const y = py[i] + RISE * t;

      tmpPos.set(px[i], y, pz[i]);
      tmpQuat.setFromAxisAngle(UP, rot[i]);
      tmpScale.setScalar(scale);
      tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
      mesh.setMatrixAt(i, tmpMatrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, COUNT]}
      frustumCulled={false}
      castShadow={false}
      receiveShadow={false}
    >
      <icosahedronGeometry args={[1, 0]} />
      <meshStandardMaterial
        color={dustColor}
        flatShading
        transparent
        opacity={0.4}
        depthWrite={false}
        roughness={1}
        metalness={0}
      />
    </instancedMesh>
  );
}
