"use client";

import { useTexture } from "@react-three/drei";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import * as THREE from "three";

/**
 * Ground + path + water. SEAM owned by the natural-environment agent —
 * currently the baseline flat grass plane moved out of World. The physics
 * ground collider MUST be preserved (the player walks on it).
 */
export function Terrain() {
  const grass = useTexture("/textures/grass.png");
  grass.wrapS = grass.wrapT = THREE.RepeatWrapping;
  grass.repeat.set(40, 40);
  grass.anisotropy = 8;

  return (
    <>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[70, 0.5, 70]} position={[0, -0.5, 0]} />
      </RigidBody>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[140, 140]} />
        <meshStandardMaterial map={grass} />
      </mesh>
    </>
  );
}
