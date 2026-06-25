'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGame } from './store';
import { blockOrigin, BLOCK, GRID } from './city';

const SKIN = ['#caa183', '#8d5c3c', '#6e452c', '#e0b89a'];
const SHIRT = ['#d8d4c8', '#8a3030', '#3a5f8a', '#4a7a4a', '#caa83a', '#7a4a8a'];
const PANTS = ['#3a4a5a', '#2a2a2a', '#6a5a3a', '#4a3a5a'];

interface Ped {
  cx: number;
  cz: number;
  r: number; // walks a square loop around a block edge
  phase: number;
  speed: number;
  skin: string;
  shirt: string;
  pants: string;
}

/** position on a square loop of half-size r, param t in [0,4) */
function squareWalk(t: number, r: number): { x: number; z: number; yaw: number } {
  const seg = Math.floor(t) % 4;
  const f = t - Math.floor(t);
  switch (seg) {
    case 0: return { x: -r + f * 2 * r, z: -r, yaw: Math.PI / 2 };
    case 1: return { x: r, z: -r + f * 2 * r, yaw: 0 };
    case 2: return { x: r - f * 2 * r, z: r, yaw: -Math.PI / 2 };
    default: return { x: -r, z: r - f * 2 * r, yaw: Math.PI };
  }
}

export default function Peds() {
  const tier = useGame((s) => s.tier);
  const count = tier === 'high' ? 10 : 4;
  const peds = useMemo<Ped[]>(
    () =>
      Array.from({ length: count }, (_, i) => {
        const bi = (i * 3 + 1) % GRID;
        const bj = (i * 5 + 2) % GRID;
        const o = blockOrigin(bi, bj);
        return {
          cx: o.x + BLOCK / 2,
          cz: o.z + BLOCK / 2,
          r: BLOCK / 2 + 2.6,
          phase: (i * 1.37) % 4,
          speed: 0.045 + (i % 3) * 0.012,
          skin: SKIN[i % SKIN.length],
          shirt: SHIRT[i % SHIRT.length],
          pants: PANTS[i % PANTS.length],
        };
      }),
    [count],
  );
  const refs = useRef<(THREE.Group | null)[]>([]);
  const t = useRef(0);

  useFrame((_, dt) => {
    t.current += dt;
    peds.forEach((p, i) => {
      const g = refs.current[i];
      if (!g) return;
      const w = squareWalk((p.phase + t.current * p.speed) % 4, p.r);
      g.position.set(p.cx + w.x, 0.3, p.cz + w.z);
      g.rotation.y = w.yaw;
      const swing = Math.sin(t.current * 7 + i) * 0.5;
      (g.children[3] as THREE.Group).rotation.x = swing; // legs
      (g.children[4] as THREE.Group).rotation.x = -swing;
      (g.children[5] as THREE.Group).rotation.x = -swing * 0.7; // arms
      (g.children[6] as THREE.Group).rotation.x = swing * 0.7;
    });
  });

  return (
    <group>
      {peds.map((p, i) => (
        <group key={i} ref={(el) => (refs.current[i] = el)}>
          {/* 0 torso, 1 head, 2 hips, 3-4 legs, 5-6 arms — index order matters for the animator above */}
          <mesh position={[0, 1.15, 0]}>
            <boxGeometry args={[0.46, 0.55, 0.26]} />
            <meshLambertMaterial color={p.shirt} />
          </mesh>
          <mesh position={[0, 1.62, 0]}>
            <boxGeometry args={[0.26, 0.28, 0.24]} />
            <meshLambertMaterial color={p.skin} />
          </mesh>
          <mesh position={[0, 0.84, 0]}>
            <boxGeometry args={[0.44, 0.18, 0.25]} />
            <meshLambertMaterial color={p.pants} />
          </mesh>
          <group position={[-0.12, 0.78, 0]}>
            <mesh position={[0, -0.38, 0]}>
              <boxGeometry args={[0.16, 0.72, 0.18]} />
              <meshLambertMaterial color={p.pants} />
            </mesh>
          </group>
          <group position={[0.12, 0.78, 0]}>
            <mesh position={[0, -0.38, 0]}>
              <boxGeometry args={[0.16, 0.72, 0.18]} />
              <meshLambertMaterial color={p.pants} />
            </mesh>
          </group>
          <group position={[-0.3, 1.4, 0]}>
            <mesh position={[0, -0.3, 0]}>
              <boxGeometry args={[0.12, 0.6, 0.14]} />
              <meshLambertMaterial color={p.shirt} />
            </mesh>
          </group>
          <group position={[0.3, 1.4, 0]}>
            <mesh position={[0, -0.3, 0]}>
              <boxGeometry args={[0.12, 0.6, 0.14]} />
              <meshLambertMaterial color={p.shirt} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}
