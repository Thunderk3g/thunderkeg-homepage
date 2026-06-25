'use client';

import { forwardRef, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGame, live } from './store';
import { isDown, wasPressed } from './controls';
import { collide, carSpawn } from './city';

const MAX_FWD = 26;
const MAX_REV = -9;
const ACCEL = 16;
const BRAKE = 34;
const DRAG = 6;
const WHEEL_RADIUS = 0.34;

interface CarMeshProps {
  body: string;
  lowrider?: boolean;
  /** accumulated wheel angle in radians; all four wheels spin to match */
  spinRef?: MutableRefObject<number>;
  /** -1..1 smoothed steering; front wheels yaw by steer * 0.45 */
  steerRef?: MutableRefObject<number>;
  /** when true the tail lights flare bright red */
  brakeRef?: MutableRefObject<boolean>;
}

// [x, z, isFront] axle positions
const WHEELS: [number, number, boolean][] = [
  [-0.95, 1.8, true],
  [0.95, 1.8, true],
  [-0.95, -1.8, false],
  [0.95, -1.8, false],
];

/** PS2-flavoured procedural SA sedan/lowrider: three-box body, chrome, whitewalls */
export const CarMesh = forwardRef<THREE.Group, CarMeshProps>(function CarMesh(
  { body, lowrider, spinRef, steerRef, brakeRef },
  ref,
) {
  const spinGroups = useRef<(THREE.Group | null)[]>([]);
  const steerGroups = useRef<(THREE.Group | null)[]>([]);
  const tailMat = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(() => {
    if (spinRef) {
      const a = spinRef.current;
      for (const g of spinGroups.current) if (g) g.rotation.x = a;
    }
    if (steerRef) {
      const yaw = steerRef.current * 0.45;
      for (const g of steerGroups.current) if (g) g.rotation.y = yaw;
    }
    if (brakeRef && tailMat.current) {
      tailMat.current.emissiveIntensity = brakeRef.current ? 3.2 : 0.55;
    }
  });

  const drop = lowrider ? -0.07 : 0;

  return (
    <group>
      {/* forwarded ref targets the body group so callers can tilt it (body roll)
          without dragging the flat blob shadow along */}
      <group ref={ref} position-y={drop}>
        {/* main body slab */}
        <mesh position={[0, 0.5, 0]} castShadow>
          <boxGeometry args={[2.1, 0.5, 5.4]} />
          <meshStandardMaterial color={body} metalness={0.55} roughness={0.35} />
        </mesh>
        {/* long hood */}
        <mesh position={[0, 0.85, 1.75]} castShadow>
          <boxGeometry args={[1.95, 0.22, 1.7]} />
          <meshStandardMaterial color={body} metalness={0.55} roughness={0.35} />
        </mesh>
        {/* trunk */}
        <mesh position={[0, 0.87, -1.9]} castShadow>
          <boxGeometry args={[1.95, 0.26, 1.35]} />
          <meshStandardMaterial color={body} metalness={0.55} roughness={0.35} />
        </mesh>
        {/* cabin frame, offset rear — pillars + roof in body colour */}
        <mesh position={[0, 1.14, -0.35]} castShadow>
          <boxGeometry args={[1.84, 0.52, 2.05]} />
          <meshStandardMaterial color={body} metalness={0.5} roughness={0.4} />
        </mesh>
        {/* dark glass, slightly inset so pillars stay visible */}
        <mesh position={[0, 1.1, -0.35]}>
          <boxGeometry args={[1.88, 0.36, 1.68]} />
          <meshStandardMaterial color="#1c2429" metalness={0.3} roughness={0.12} />
        </mesh>
        {/* chrome side trim line */}
        <mesh position={[0, 0.6, 0]}>
          <boxGeometry args={[2.16, 0.06, 5.0]} />
          <meshStandardMaterial color="#c8c8c8" metalness={0.9} roughness={0.25} />
        </mesh>
        {/* chrome bumpers, front + rear */}
        <mesh position={[0, 0.38, 2.75]}>
          <boxGeometry args={[2.2, 0.2, 0.25]} />
          <meshStandardMaterial color="#b8b8b8" metalness={0.85} roughness={0.25} />
        </mesh>
        <mesh position={[0, 0.38, -2.75]}>
          <boxGeometry args={[2.2, 0.2, 0.25]} />
          <meshStandardMaterial color="#b8b8b8" metalness={0.85} roughness={0.25} />
        </mesh>
        {/* headlights */}
        <mesh position={[0, 0.58, 2.71]}>
          <boxGeometry args={[1.7, 0.16, 0.06]} />
          <meshBasicMaterial color="#fff2c4" />
        </mesh>
        {/* tail lights (brake flare via emissive) */}
        <mesh position={[0, 0.58, -2.71]}>
          <boxGeometry args={[1.8, 0.16, 0.06]} />
          <meshStandardMaterial
            ref={tailMat}
            color="#5a120c"
            emissive="#d03a2a"
            emissiveIntensity={0.55}
            roughness={0.4}
          />
        </mesh>
        {/* dual exhaust tips */}
        <mesh position={[-0.55, 0.24, -2.76]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.06, 0.06, 0.25, 8]} />
          <meshStandardMaterial color="#9a9a9a" metalness={0.85} roughness={0.3} />
        </mesh>
        <mesh position={[0.55, 0.24, -2.76]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.06, 0.06, 0.25, 8]} />
          <meshStandardMaterial color="#9a9a9a" metalness={0.85} roughness={0.3} />
        </mesh>
      </group>
      {/* wheels stay planted outside the body group (unaffected by drop/roll):
          tire + whitewall ring + chrome hub bar; steer yaw outer, spin inner */}
      {WHEELS.map(([x, z, front], i) => (
          <group
            key={i}
            position={[x, WHEEL_RADIUS, z]}
            ref={(el) => {
              if (front) steerGroups.current[i] = el;
            }}
          >
            <group
              ref={(el) => {
                spinGroups.current[i] = el;
              }}
            >
              <mesh rotation-z={Math.PI / 2}>
                <cylinderGeometry args={[WHEEL_RADIUS, WHEEL_RADIUS, 0.3, 12]} />
                <meshStandardMaterial color="#151515" roughness={0.9} />
              </mesh>
              {/* whitewall hint */}
              <mesh rotation-z={Math.PI / 2} position-x={x > 0 ? 0.14 : -0.14}>
                <cylinderGeometry args={[0.26, 0.26, 0.03, 12]} />
                <meshStandardMaterial color="#e8e4d8" roughness={0.6} />
              </mesh>
              {/* chrome hub bar — asymmetric so the spin reads */}
              <mesh position-x={x > 0 ? 0.165 : -0.165}>
                <boxGeometry args={[0.02, 0.3, 0.1]} />
                <meshStandardMaterial color="#d4d4d4" metalness={0.9} roughness={0.2} />
              </mesh>
            </group>
          </group>
      ))}
      {/* blob shadow */}
      <mesh position={[0, 0.025, 0]} rotation-x={-Math.PI / 2} scale={[1.35, 2.85, 1]}>
        <circleGeometry args={[1, 16]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.32} depthWrite={false} />
      </mesh>
    </group>
  );
});

export default function PlayerCar() {
  const group = useRef<THREE.Group>(null!);
  const mesh = useRef<THREE.Group>(null);
  const speed = useRef(0);
  const steer = useRef(0);
  const spin = useRef(0);
  const braking = useRef(false);
  const roll = useRef(0);
  const setInCar = useGame((s) => s.setInCar);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const { inCar, activeMission, started } = useGame.getState();
    if (!started) return;

    // enter / exit
    if (wasPressed('e') || wasPressed('f')) {
      if (inCar) {
        speed.current = 0;
        const side = collide(g.position.x - Math.cos(live.carHeading) * 2.4, g.position.z + Math.sin(live.carHeading) * 2.4, 0.5);
        live.px = side.x;
        live.pz = side.z;
        setInCar(false);
      } else {
        const dx = live.px - g.position.x;
        const dz = live.pz - g.position.z;
        if (dx * dx + dz * dz < 22) setInCar(true);
      }
    }

    braking.current = false;
    if (useGame.getState().inCar && !activeMission) {
      let acc = 0;
      if (isDown('w', 'arrowup')) acc = ACCEL;
      if (isDown('s', 'arrowdown')) acc = speed.current > 1 ? -BRAKE : -ACCEL * 0.7;
      speed.current += acc * dt;
      if (acc === 0) speed.current -= Math.sign(speed.current) * Math.min(Math.abs(speed.current), DRAG * dt);
      speed.current = THREE.MathUtils.clamp(speed.current, MAX_REV, MAX_FWD);
      const handbrake = isDown(' ');
      if (handbrake) speed.current -= Math.sign(speed.current) * Math.min(Math.abs(speed.current), 50 * dt);
      braking.current = isDown('s', 'arrowdown') || handbrake;

      let steerTarget = 0;
      if (isDown('a', 'arrowleft')) steerTarget = 1;
      if (isDown('d', 'arrowright')) steerTarget = -1;
      // smooth the steering input so the car arcs instead of twitching
      steer.current = THREE.MathUtils.damp(steer.current, steerTarget, 8, dt);
      const grip = Math.min(1, Math.abs(speed.current) / 9);
      const steerStrength = 1.75 * grip * (1 - Math.min(0.45, Math.abs(speed.current) / 70));
      // handbrake at speed kicks the tail out a touch (drift hint)
      const drift = handbrake && Math.abs(speed.current) > 5 ? 0.9 * grip : 0;
      live.carHeading += steer.current * (steerStrength + drift) * dt * Math.sign(speed.current || 1);

      const nx = g.position.x + Math.sin(live.carHeading) * speed.current * dt;
      const nz = g.position.z + Math.cos(live.carHeading) * speed.current * dt;
      const hit = collide(nx, nz, 1.3);
      if (Math.abs(hit.x - nx) > 0.001 || Math.abs(hit.z - nz) > 0.001) {
        speed.current *= -0.25; // bounce off walls
      }
      g.position.x = hit.x;
      g.position.z = hit.z;
      g.rotation.y = live.carHeading;
    }

    // wheel spin accumulator (radians, wrapped to keep float precision)
    spin.current = (spin.current + (speed.current / WHEEL_RADIUS) * dt) % (Math.PI * 2);

    // slight body roll opposite the turn, proportional to steer * speed
    const rollTarget = THREE.MathUtils.clamp(steer.current * speed.current * 0.0045, -0.07, 0.07);
    roll.current = THREE.MathUtils.damp(roll.current, rollTarget, 7, dt);
    if (mesh.current) mesh.current.rotation.z = roll.current;

    live.carX = g.position.x;
    live.carZ = g.position.z;
    live.carSpeed = speed.current;
  });

  return (
    <group ref={group} position={[carSpawn.x, 0, carSpawn.z]} rotation-y={0}>
      <CarMesh ref={mesh} body="#27808a" spinRef={spin} steerRef={steer} brakeRef={braking} />
    </group>
  );
}
