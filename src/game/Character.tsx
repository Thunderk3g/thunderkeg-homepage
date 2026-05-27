"use client";

/**
 * The hero's visual. SEAM owned by the character agent. Rendered INSIDE the
 * Player's `visual` group, which the controller rotates to face travel
 * direction — so this component only renders the model and drives its
 * animation from `playerSpeed.value` (idle / walk / run crossfade).
 *
 * Stub = the placeholder capsule hero moved out of Player. Will be replaced by
 * the loaded KayKit Knight.glb.
 */
export function Character() {
  return (
    <>
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
    </>
  );
}
