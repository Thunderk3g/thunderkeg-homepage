"use client";

import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { playerPosition } from "./refs";

const OFFSET = new THREE.Vector3(0, 5, 9);
const desired = new THREE.Vector3();
const look = new THREE.Vector3();

/** A smooth third-person camera that trails the player (frame-rate independent). */
export function FollowCamera() {
  useFrame(({ camera }, dt) => {
    desired.copy(playerPosition).add(OFFSET);
    const t = 1 - Math.pow(0.0015, dt); // damping toward target
    camera.position.lerp(desired, t);
    look.set(playerPosition.x, playerPosition.y + 1.2, playerPosition.z);
    camera.lookAt(look);
  });
  return null;
}
