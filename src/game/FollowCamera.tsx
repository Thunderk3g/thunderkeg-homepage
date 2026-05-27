"use client";

import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { playerPosition, playerForward, playerSpeed } from "./refs";

// Base shoulder offset behind + above the player.
const OFFSET = new THREE.Vector3(0, 5, 9);

// Module-level scratch — never allocate per frame (Intel iGPU budget).
const desired = new THREE.Vector3();
const look = new THREE.Vector3();
const lead = new THREE.Vector3();

// Damping bases for `1 - pow(base, dt)` (frame-rate independent).
// Smaller base => snappier. Position trails a touch slower than the look target.
const POS_DAMP = 0.0018;
const LOOK_DAMP = 0.0008;

// Idle breathing: tiny vertical + lateral sway when standing still.
const IDLE_SPEED = 0.9; // rad/sec
const IDLE_AMP_Y = 0.045; // world units
const IDLE_AMP_X = 0.03;

// How far ahead to bias the framing in the travel direction when moving.
const LEAD_DIST = 1.6; // world units of look-ahead at full sway
const RUN_SPEED = 4; // ~speed where lead saturates

const MIN_CAM_Y = 1.4; // never let the camera dip into / below the ground
const LOOK_HEIGHT = 1.2; // aim at roughly the player's chest

let clock = 0;

/** A smooth third-person camera that trails the player (frame-rate independent). */
export function FollowCamera() {
  useFrame(({ camera }, dt) => {
    // Guard against huge dt spikes (tab refocus) that would jolt the camera.
    const step = Math.min(dt, 0.05);
    clock += step;

    const speed = playerSpeed.value;
    const moving = THREE.MathUtils.clamp(speed / RUN_SPEED, 0, 1);

    // --- desired camera position: behind the player by OFFSET ---
    desired.copy(playerPosition).add(OFFSET);

    // Lead the camera slightly opposite the travel direction so we can see
    // more of what's ahead (push the rig back along forward when moving).
    lead.copy(playerForward).multiplyScalar(-LEAD_DIST * moving);
    desired.x += lead.x;
    desired.z += lead.z;

    // Idle breathing — only when nearly still, faded by movement so it never
    // fights the follow. Subtle sinusoidal sway, no allocations.
    const idle = 1 - moving;
    if (idle > 0.001) {
      desired.y += Math.sin(clock * IDLE_SPEED) * IDLE_AMP_Y * idle;
      desired.x += Math.cos(clock * IDLE_SPEED * 0.7) * IDLE_AMP_X * idle;
    }

    const tPos = 1 - Math.pow(POS_DAMP, step);
    camera.position.lerp(desired, tPos);

    // Floor clamp — keep the lens above ground regardless of terrain dips.
    if (camera.position.y < MIN_CAM_Y) camera.position.y = MIN_CAM_Y;

    // --- look target: the player's chest, biased ahead in travel direction ---
    look.set(
      playerPosition.x + playerForward.x * LEAD_DIST * moving,
      playerPosition.y + LOOK_HEIGHT,
      playerPosition.z + playerForward.z * LEAD_DIST * moving
    );

    // Smooth the look point in a scratch vector, then aim at it. We reuse
    // `lead` as the smoothed-look accumulator stored on the camera's userData
    // to stay frame-rate independent without per-frame allocation.
    const lt = 1 - Math.pow(LOOK_DAMP, step);
    const ud = camera.userData as { _look?: THREE.Vector3 };
    if (!ud._look) ud._look = new THREE.Vector3().copy(look);
    ud._look.lerp(look, lt);
    camera.lookAt(ud._look);
  });

  return null;
}
