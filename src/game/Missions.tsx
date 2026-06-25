'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import * as THREE from 'three';
import { useGame, live } from './store';
import { landmarks } from './city';
import { missions } from '@/data/resume';

const TRIGGER = 2.4;
const REARM = 5.5;

function Marker({ missionId, x, z }: { missionId: string; x: number; z: number }) {
  const mission = missions.find((m) => m.id === missionId)!;
  const ring = useRef<THREE.Mesh>(null!);
  const cyl = useRef<THREE.Mesh>(null!);
  const armed = useRef(true);
  const done = useGame((s) => s.completed.includes(missionId));

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (ring.current) ring.current.rotation.y = t * 1.2;
    if (cyl.current) {
      const mat = cyl.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.35 + Math.sin(t * 3) * 0.12;
    }
    const { activeMission, openMission, started } = useGame.getState();
    if (!started) return;
    const dx = live.px - x;
    const dz = live.pz - z;
    const d2 = dx * dx + dz * dz;
    if (d2 > REARM * REARM) armed.current = true;
    if (armed.current && !activeMission && d2 < TRIGGER * TRIGGER) {
      armed.current = false;
      openMission(missionId);
    }
  });

  const color = done ? '#58c858' : '#f5c542';
  return (
    <group position={[x, 0.3, z]}>
      <mesh ref={cyl} position-y={1.5}>
        <cylinderGeometry args={[1.5, 1.5, 3, 20, 1, true]} />
        <meshBasicMaterial color={color} transparent opacity={0.4} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh ref={ring} position-y={0.08} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[1.45, 1.75, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.85} side={THREE.DoubleSide} />
      </mesh>
      <Billboard position-y={4.6}>
        <Text
          fontSize={0.85}
          color={done ? '#9fdc9f' : '#ffe27a'}
          outlineWidth={0.07}
          outlineColor="#181410"
          anchorX="center"
          anchorY="middle"
          letterSpacing={0.04}
        >
          {mission.sign}
        </Text>
        {done && (
          <Text position-y={-0.9} fontSize={0.45} color="#bfe8bf" outlineWidth={0.04} outlineColor="#181410">
            MISSION PASSED
          </Text>
        )}
      </Billboard>
    </group>
  );
}

export default function Missions() {
  return (
    <group>
      {landmarks.map((l) => (
        <Marker key={l.missionId} missionId={l.missionId} x={l.marker.x} z={l.marker.z} />
      ))}
    </group>
  );
}
