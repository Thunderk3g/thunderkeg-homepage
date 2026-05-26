"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useKeyboardControls } from "@react-three/drei";
import {
  RigidBody,
  CapsuleCollider,
  useRapier,
  type RapierRigidBody,
} from "@react-three/rapier";
import { QueryFilterFlags, ActiveCollisionTypes } from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { Controls } from "./controls";
import { useGame } from "./store";
import { playerPosition, playerForward, playerSpeed } from "./refs";

const SPEED = 5; // world units / second
const GRAVITY = 22;
const SPAWN: [number, number, number] = [0, 1.2, 6];

export function Player() {
  const body = useRef<RapierRigidBody>(null);
  const visual = useRef<THREE.Group>(null);
  const { world } = useRapier();
  const [, getKeys] = useKeyboardControls<Controls>();

  // Rapier kinematic character controller (autostep, snap-to-ground, slopes).
  const controllerRef = useRef<ReturnType<
    typeof world.createCharacterController
  > | null>(null);
  useEffect(() => {
    const c = world.createCharacterController(0.01);
    c.enableAutostep(0.5, 0.2, true);
    c.enableSnapToGround(0.5);
    c.setMaxSlopeClimbAngle((45 * Math.PI) / 180);
    c.setApplyImpulsesToDynamicBodies(true);
    controllerRef.current = c;
    return () => {
      world.removeCharacterController(c);
      controllerRef.current = null;
    };
  }, [world]);

  const velocityY = useRef(0);
  const move = useMemo(() => new THREE.Vector3(), []);
  const disp = useMemo(() => new THREE.Vector3(), []);
  const targetQuat = useMemo(() => new THREE.Quaternion(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  useFrame((_, dtRaw) => {
    const controller = controllerRef.current;
    const b = body.current;
    if (!b || !controller) return;
    // Cap only to avoid a catastrophic step after a stall; keep movement
    // wall-clock-accurate down to ~10fps (a 1/30 cap causes slow-motion <30fps).
    const dt = Math.min(dtRaw, 0.1);

    const blocked = useGame.getState().isModalOpen();
    const k = getKeys();
    const j = useGame.getState().joystick;

    let ix = 0;
    let iz = 0;
    if (!blocked) {
      ix = (k.right ? 1 : 0) - (k.left ? 1 : 0) + j.x;
      iz = (k.back ? 1 : 0) - (k.forward ? 1 : 0) + j.z;
    }
    move.set(ix, 0, iz);
    if (move.lengthSq() > 1) move.normalize();

    const horizSpeed = move.length() * SPEED;
    playerSpeed.value = horizSpeed;

    disp.set(move.x * SPEED * dt, 0, move.z * SPEED * dt);
    velocityY.current -= GRAVITY * dt;
    disp.y = velocityY.current * dt;

    const collider = b.collider(0);
    // EXCLUDE_SENSORS so the character controller passes through trigger zones
    // instead of being blocked by them.
    controller.computeColliderMovement(collider, disp, QueryFilterFlags.EXCLUDE_SENSORS);
    if (controller.computedGrounded()) velocityY.current = 0;
    const corrected = controller.computedMovement();

    const t = b.translation();
    const nx = t.x + corrected.x;
    const ny = t.y + corrected.y;
    const nz = t.z + corrected.z;
    b.setNextKinematicTranslation({ x: nx, y: ny, z: nz });
    playerPosition.set(nx, ny, nz);

    // turn the character to face travel direction
    if (horizSpeed > 0.05 && visual.current) {
      const angle = Math.atan2(move.x, move.z);
      targetQuat.setFromAxisAngle(up, angle);
      visual.current.quaternion.slerp(targetQuat, 1 - Math.pow(0.001, dt));
      playerForward.set(Math.sin(angle), 0, Math.cos(angle));
    }
  });

  return (
    <RigidBody
      ref={body}
      name="player"
      type="kinematicPosition"
      colliders={false}
      position={SPAWN}
      enabledRotations={[false, false, false]}
    >
      {/* ALL active collision types so kinematic↔fixed sensor intersections fire. */}
      <CapsuleCollider args={[0.6, 0.4]} activeCollisionTypes={ActiveCollisionTypes.ALL} />
      {/* Placeholder hero — swapped for the sourced glTF in the art pass. */}
      <group ref={visual}>
        <mesh castShadow>
          <capsuleGeometry args={[0.4, 1.2, 8, 16]} />
          <meshStandardMaterial color="#5566aa" />
        </mesh>
        <mesh castShadow position={[0, 0.95, 0]}>
          <sphereGeometry args={[0.32, 16, 16]} />
          <meshStandardMaterial color="#f0c9a0" />
        </mesh>
        <mesh position={[0, 0.95, 0.3]}>
          <boxGeometry args={[0.12, 0.12, 0.14]} />
          <meshStandardMaterial color="#c8745f" />
        </mesh>
      </group>
    </RigidBody>
  );
}
