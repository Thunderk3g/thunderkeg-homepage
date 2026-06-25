'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import gsap from 'gsap';
import { useGame, live } from './store';
import { spawn } from './city';

export default function CameraRig() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const started = useGame((s) => s.started);
  const intro = useRef({ t: 0, done: false });
  const camYaw = useRef(0);
  const desired = useMemo(() => new THREE.Vector3(), []);
  const flyFrom = useMemo(() => new THREE.Vector3(spawn.x - 120, 150, spawn.z - 160), []);
  const look = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    if (!started) return;
    intro.current = { t: 0, done: false };
    gsap.to(intro.current, {
      t: 1,
      duration: 4.5,
      ease: 'power3.inOut',
      onComplete: () => {
        intro.current.done = true;
      },
    });
  }, [started]);

  useFrame((_, dt) => {
    const { inCar } = useGame.getState();
    const heading = inCar ? live.carHeading : live.pHeading;
    const tx = inCar ? live.carX : live.px;
    const tz = inCar ? live.carZ : live.pz;

    // GTA-style lazy chase: the camera yaw swings behind the heading with damping,
    // faster in a car, slower on foot, never snapping.
    let d = heading - camYaw.current;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    camYaw.current += d * Math.min(1, dt * (inCar ? 3.2 : 4.5));
    live.camYaw = camYaw.current;

    const speedK = inCar ? Math.min(1, Math.abs(live.carSpeed) / 26) : 0;
    const dist = inCar ? 9.5 + speedK * 2.5 : 6.0;
    const height = inCar ? 4.0 + speedK : 2.9;
    desired.set(
      tx - Math.sin(camYaw.current) * dist,
      height,
      tz - Math.cos(camYaw.current) * dist,
    );

    if (!intro.current.done) {
      camera.position.lerpVectors(flyFrom, desired, intro.current.t);
    } else {
      // critically-damped position follow — no jitter, no rubber-banding
      const k = 1 - Math.exp(-dt * 10);
      camera.position.lerp(desired, k);
    }

    // subtle FOV kick at speed (SA does this when you floor it)
    const targetFov = 55 + speedK * 9;
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 4);
    camera.updateProjectionMatrix();

    look.set(
      tx + Math.sin(camYaw.current) * 2.2,
      inCar ? 1.4 : 1.55,
      tz + Math.cos(camYaw.current) * 2.2,
    );
    camera.lookAt(look);
  });

  return null;
}
