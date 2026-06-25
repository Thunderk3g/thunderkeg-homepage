'use client';

import { forwardRef, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';

// CJ-inspired low-poly street character: white tank top, baggy jeans,
// sneakers, short fade. Two-segment limbs animated by a hand-rolled
// walk/run cycle (PS2-era proportions on purpose).

const SKIN = '#7a5236';
const SKIN_DARK = '#6b4730';
const TANK = '#e9e7e1';
const JEANS = '#41608f';
const JEANS_DARK = '#38537c';
const SHOE = '#dcdcd4';
const SOLE = '#2a2a2a';
const HAIR = '#16120e';

export interface CharacterHandle {
  /** drive the body: phase = stride cycle, speed01 = 0 idle … 1 sprint */
  animate(phase: number, speed01: number, time: number): void;
}

export const Character = forwardRef<CharacterHandle, { scale?: number }>(function Character(
  { scale = 1 },
  ref,
) {
  const root = useRef<THREE.Group>(null!);
  const torso = useRef<THREE.Group>(null!);
  const lThigh = useRef<THREE.Group>(null!);
  const rThigh = useRef<THREE.Group>(null!);
  const lShin = useRef<THREE.Group>(null!);
  const rShin = useRef<THREE.Group>(null!);
  const lArm = useRef<THREE.Group>(null!);
  const rArm = useRef<THREE.Group>(null!);
  const lFore = useRef<THREE.Group>(null!);
  const rFore = useRef<THREE.Group>(null!);
  const head = useRef<THREE.Group>(null!);

  useImperativeHandle(ref, () => ({
    animate(phase, speed01, time) {
      const s = Math.sin(phase);
      const c = Math.cos(phase);
      const amp = 0.25 + speed01 * 0.65; // stride amplitude grows with speed

      if (speed01 < 0.02) {
        // idle: breathe, subtle sway
        const b = Math.sin(time * 1.8) * 0.02;
        torso.current.position.y = 0;
        torso.current.rotation.x = b * 0.4;
        root.current.position.y = 0;
        lThigh.current.rotation.x = THREE.MathUtils.lerp(lThigh.current.rotation.x, 0, 0.12);
        rThigh.current.rotation.x = THREE.MathUtils.lerp(rThigh.current.rotation.x, 0, 0.12);
        lShin.current.rotation.x = THREE.MathUtils.lerp(lShin.current.rotation.x, 0, 0.12);
        rShin.current.rotation.x = THREE.MathUtils.lerp(rShin.current.rotation.x, 0, 0.12);
        lArm.current.rotation.x = THREE.MathUtils.lerp(lArm.current.rotation.x, 0.06, 0.12);
        rArm.current.rotation.x = THREE.MathUtils.lerp(rArm.current.rotation.x, 0.06, 0.12);
        lArm.current.rotation.z = 0.1 + b;
        rArm.current.rotation.z = -0.1 - b;
        lFore.current.rotation.x = -0.15;
        rFore.current.rotation.x = -0.15;
        head.current.rotation.y = Math.sin(time * 0.5) * 0.15;
        return;
      }

      // stride
      lThigh.current.rotation.x = s * amp;
      rThigh.current.rotation.x = -s * amp;
      // knees bend on the back-to-front swing
      lShin.current.rotation.x = -Math.max(0, -c) * amp * 1.5;
      rShin.current.rotation.x = -Math.max(0, c) * amp * 1.5;
      // arms counter-swing, bent at the elbow when running
      lArm.current.rotation.x = -s * amp * 0.8;
      rArm.current.rotation.x = s * amp * 0.8;
      lArm.current.rotation.z = 0.12;
      rArm.current.rotation.z = -0.12;
      lFore.current.rotation.x = -0.3 - speed01 * 0.75;
      rFore.current.rotation.x = -0.3 - speed01 * 0.75;
      // body bob + forward lean at speed
      root.current.position.y = Math.abs(c) * 0.05 * (0.5 + speed01);
      torso.current.rotation.x = 0.05 + speed01 * 0.22;
      torso.current.rotation.y = s * 0.08;
      head.current.rotation.y = 0;
    },
  }));

  return (
    <group ref={root} scale={scale}>
      {/* legs hang from the hips */}
      <group ref={lThigh} position={[-0.13, 0.92, 0]}>
        <mesh position={[0, -0.23, 0]} castShadow>
          <boxGeometry args={[0.19, 0.46, 0.21]} />
          <meshLambertMaterial color={JEANS} />
        </mesh>
        <group ref={lShin} position={[0, -0.46, 0]}>
          <mesh position={[0, -0.2, 0]} castShadow>
            <boxGeometry args={[0.17, 0.4, 0.19]} />
            <meshLambertMaterial color={JEANS_DARK} />
          </mesh>
          <mesh position={[0, -0.42, 0.05]}>
            <boxGeometry args={[0.17, 0.1, 0.32]} />
            <meshLambertMaterial color={SHOE} />
          </mesh>
          <mesh position={[0, -0.475, 0.05]}>
            <boxGeometry args={[0.18, 0.05, 0.34]} />
            <meshLambertMaterial color={SOLE} />
          </mesh>
        </group>
      </group>
      <group ref={rThigh} position={[0.13, 0.92, 0]}>
        <mesh position={[0, -0.23, 0]} castShadow>
          <boxGeometry args={[0.19, 0.46, 0.21]} />
          <meshLambertMaterial color={JEANS} />
        </mesh>
        <group ref={rShin} position={[0, -0.46, 0]}>
          <mesh position={[0, -0.2, 0]} castShadow>
            <boxGeometry args={[0.17, 0.4, 0.19]} />
            <meshLambertMaterial color={JEANS_DARK} />
          </mesh>
          <mesh position={[0, -0.42, 0.05]}>
            <boxGeometry args={[0.17, 0.1, 0.32]} />
            <meshLambertMaterial color={SHOE} />
          </mesh>
          <mesh position={[0, -0.475, 0.05]}>
            <boxGeometry args={[0.18, 0.05, 0.34]} />
            <meshLambertMaterial color={SOLE} />
          </mesh>
        </group>
      </group>

      <group ref={torso} position={[0, 0.95, 0]}>
        {/* hips / belt */}
        <mesh position={[0, 0.02, 0]} castShadow>
          <boxGeometry args={[0.42, 0.16, 0.26]} />
          <meshLambertMaterial color={JEANS_DARK} />
        </mesh>
        {/* tank top */}
        <mesh position={[0, 0.34, 0]} castShadow>
          <boxGeometry args={[0.46, 0.5, 0.27]} />
          <meshLambertMaterial color={TANK} />
        </mesh>
        {/* shoulders (skin showing past the tank straps) */}
        <mesh position={[0, 0.56, 0]}>
          <boxGeometry args={[0.52, 0.1, 0.24]} />
          <meshLambertMaterial color={SKIN} />
        </mesh>
        {/* gold chain */}
        <mesh position={[0, 0.52, 0.14]}>
          <boxGeometry args={[0.16, 0.03, 0.02]} />
          <meshBasicMaterial color="#d8a838" />
        </mesh>

        {/* arms hang from the shoulders */}
        <group ref={lArm} position={[-0.3, 0.52, 0]}>
          <mesh position={[0, -0.17, 0]} castShadow>
            <boxGeometry args={[0.14, 0.34, 0.15]} />
            <meshLambertMaterial color={SKIN} />
          </mesh>
          <group ref={lFore} position={[0, -0.34, 0]}>
            <mesh position={[0, -0.15, 0]} castShadow>
              <boxGeometry args={[0.12, 0.3, 0.13]} />
              <meshLambertMaterial color={SKIN_DARK} />
            </mesh>
            <mesh position={[0, -0.34, 0]}>
              <boxGeometry args={[0.11, 0.1, 0.12]} />
              <meshLambertMaterial color={SKIN} />
            </mesh>
          </group>
        </group>
        <group ref={rArm} position={[0.3, 0.52, 0]}>
          <mesh position={[0, -0.17, 0]} castShadow>
            <boxGeometry args={[0.14, 0.34, 0.15]} />
            <meshLambertMaterial color={SKIN} />
          </mesh>
          <group ref={rFore} position={[0, -0.34, 0]}>
            <mesh position={[0, -0.15, 0]} castShadow>
              <boxGeometry args={[0.12, 0.3, 0.13]} />
              <meshLambertMaterial color={SKIN_DARK} />
            </mesh>
            <mesh position={[0, -0.34, 0]}>
              <boxGeometry args={[0.11, 0.1, 0.12]} />
              <meshLambertMaterial color={SKIN} />
            </mesh>
          </group>
        </group>

        {/* head */}
        <group ref={head} position={[0, 0.72, 0]}>
          <mesh position={[0, 0.04, 0]}>
            <boxGeometry args={[0.1, 0.1, 0.1]} />
            <meshLambertMaterial color={SKIN} />
          </mesh>
          <mesh position={[0, 0.21, 0.01]} castShadow>
            <boxGeometry args={[0.26, 0.28, 0.26]} />
            <meshLambertMaterial color={SKIN} />
          </mesh>
          {/* fade haircut */}
          <mesh position={[0, 0.35, -0.01]}>
            <boxGeometry args={[0.27, 0.08, 0.27]} />
            <meshLambertMaterial color={HAIR} />
          </mesh>
          <mesh position={[0, 0.26, -0.12]}>
            <boxGeometry args={[0.27, 0.14, 0.05]} />
            <meshLambertMaterial color={HAIR} />
          </mesh>
          {/* nose hint */}
          <mesh position={[0, 0.18, 0.14]}>
            <boxGeometry args={[0.05, 0.07, 0.04]} />
            <meshLambertMaterial color={SKIN_DARK} />
          </mesh>
        </group>
      </group>
    </group>
  );
});
