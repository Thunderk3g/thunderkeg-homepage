'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useAnimations, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { useGame, live } from './store';
import { isDown } from './controls';
import { collide, spawn } from './city';

const MODEL = '/models/Man1.glb';
const WALK = 4.4;
const RUN = 9.0;
const ACCEL = 26;
const HEIGHT = 1.78; // normalize model to a GTA-protagonist height

export default function Player() {
  const group = useRef<THREE.Group>(null!);
  const speed = useRef(0);
  const current = useRef('idle');
  const tier = useGame((s) => s.tier);
  const dir = useMemo(() => new THREE.Vector3(), []);

  const { scene, animations } = useGLTF(MODEL);
  const { actions, mixer } = useAnimations(animations, scene);

  // normalize whatever scale the asset shipped with
  const fit = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const s = HEIGHT / Math.max(0.01, box.max.y - box.min.y);
    return { s, y: -box.min.y * s };
  }, [scene]);

  const clips = useMemo(() => {
    const find = (re: RegExp) => {
      const key = Object.keys(actions).find((n) => re.test(n));
      return key ? actions[key] : undefined;
    };
    return { idle: find(/Idle/i), walk: find(/Walk$/i), run: find(/Run$/i) };
  }, [actions]);

  useEffect(() => {
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = tier === 'high';
        m.frustumCulled = false; // skinned meshes pop with default culling
      }
    });
    clips.idle?.reset().play();
  }, [scene, clips, tier]);

  useFrame((_, dt) => {
    const { activeMission, inCar, started } = useGame.getState();
    const g = group.current;
    if (!g) return;
    g.visible = !inCar;
    if (inCar) {
      live.px = live.carX;
      live.pz = live.carZ;
      speed.current = 0;
      return;
    }

    let ix = 0;
    let iz = 0;
    if (started && !activeMission) {
      if (isDown('w', 'arrowup')) iz += 1;
      if (isDown('s', 'arrowdown')) iz -= 1;
      if (isDown('a', 'arrowleft')) ix -= 1;
      if (isDown('d', 'arrowright')) ix += 1;
    }
    const moving = ix !== 0 || iz !== 0;
    const sprint = isDown('shift');
    const targetSpeed = moving ? (sprint ? RUN : WALK) : 0;
    speed.current = THREE.MathUtils.damp(speed.current, targetSpeed, ACCEL / 4, dt);
    if (speed.current < 0.05) speed.current = 0;

    if (moving) {
      // camera-relative: W away from camera, A screen-left, D screen-right
      const inputYaw = Math.atan2(-ix, iz);
      const yaw = live.camYaw + inputYaw;
      let d = yaw - live.pHeading;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      live.pHeading += d * Math.min(1, dt * 10);
    }
    if (speed.current > 0) {
      dir.set(Math.sin(live.pHeading), 0, Math.cos(live.pHeading));
      const next = collide(
        g.position.x + dir.x * speed.current * dt,
        g.position.z + dir.z * speed.current * dt,
        0.5,
      );
      g.position.x = next.x;
      g.position.z = next.z;
    }
    g.rotation.y = live.pHeading;
    live.px = g.position.x;
    live.pz = g.position.z;

    // animation state machine with crossfades
    const want = speed.current < 0.3 ? 'idle' : sprint && moving ? 'run' : 'walk';
    if (want !== current.current) {
      const prev = clips[current.current as keyof typeof clips];
      const next = clips[want as keyof typeof clips];
      if (next) {
        next.reset().fadeIn(0.22).play();
        prev?.fadeOut(0.22);
        current.current = want;
      }
    }
    // sync stride to actual ground speed so feet don't slide
    if (current.current === 'walk' && clips.walk) clips.walk.timeScale = speed.current / WALK;
    if (current.current === 'run' && clips.run) clips.run.timeScale = Math.max(0.7, speed.current / RUN);
    mixer.timeScale = 1;
  });

  return (
    <group ref={group} position={[spawn.x, 0.3, spawn.z]}>
      <group scale={fit.s} position-y={fit.y}>
        <primitive object={scene} />
      </group>
      {/* soft blob shadow keeps him grounded on lite tier */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.02}>
        <circleGeometry args={[0.42, 16]} />
        <meshBasicMaterial color="#000" transparent opacity={0.28} depthWrite={false} />
      </mesh>
    </group>
  );
}

useGLTF.preload(MODEL);
