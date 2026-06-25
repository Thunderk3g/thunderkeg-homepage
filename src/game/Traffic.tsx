'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CarMesh } from './Car';
import { useGame } from './store';
import { roadLines, HALF } from './city';

const COLORS = ['#8a3030', '#3a4f8a', '#c8c0a8', '#555c60', '#7a5a8a', '#b07030'];

interface NPC {
  line: number; // fixed coordinate of the road
  axis: 'x' | 'z'; // axis the car travels along
  dir: 1 | -1;
  pos: number;
  speed: number;
  color: string;
}

export default function Traffic() {
  const tier = useGame((s) => s.tier);
  const count = tier === 'high' ? 7 : 3;
  const cars = useMemo<NPC[]>(
    () =>
      Array.from({ length: count }, (_, i) => ({
        line: roadLines[(i * 2 + 1) % roadLines.length] + (i % 2 === 0 ? 2.8 : -2.8),
        axis: i % 2 === 0 ? 'x' : 'z',
        dir: i % 2 === 0 ? 1 : -1,
        pos: -HALF + ((i * 167) % (HALF * 2)),
        speed: 9 + (i % 4) * 2.5,
        color: COLORS[i % COLORS.length],
      })),
    [count],
  );
  const refs = useRef<(THREE.Group | null)[]>([]);

  useFrame((_, dt) => {
    cars.forEach((c, i) => {
      const g = refs.current[i];
      if (!g) return;
      c.pos += c.speed * c.dir * dt;
      if (c.pos > HALF + 20) c.pos = -HALF - 20;
      if (c.pos < -HALF - 20) c.pos = HALF + 20;
      if (c.axis === 'x') {
        g.position.set(c.pos, 0, c.line);
        g.rotation.y = c.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        g.position.set(c.line, 0, c.pos);
        g.rotation.y = c.dir > 0 ? 0 : Math.PI;
      }
    });
  });

  return (
    <group>
      {cars.map((c, i) => (
        <group key={i} ref={(el) => (refs.current[i] = el)}>
          <CarMesh body={c.color} />
        </group>
      ))}
    </group>
  );
}
