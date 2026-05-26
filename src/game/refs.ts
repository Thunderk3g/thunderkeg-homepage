import * as THREE from "three";

/**
 * Module-level shared refs for per-frame data that must NOT trigger React
 * re-renders. The Player writes these every frame; the FollowCamera (and later,
 * minigames / NPCs) read them. Mutate in place — never reassign.
 */
export const playerPosition = new THREE.Vector3(0, 0, 6);

/** Player's current planar facing direction (unit vector on XZ). */
export const playerForward = new THREE.Vector3(0, 0, -1);

/** Player's current horizontal speed in world units/sec (for animation blending). */
export const playerSpeed = { value: 0 };
