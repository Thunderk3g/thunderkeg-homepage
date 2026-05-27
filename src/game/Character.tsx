"use client";

/**
 * The hero's visual. SEAM owned by the character agent. Rendered INSIDE the
 * Player's `visual` group, which the controller rotates to face travel
 * direction — so this component only renders the model and drives its
 * animation from `playerSpeed.value` (idle / walk / run crossfade).
 *
 * Loads the KayKit Adventurer "Knight" glTF (CC0, single skin, 76 clips) and
 * blends Idle → Walking_A → Running_A based on the player's horizontal speed.
 */

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations } from "@react-three/drei";
import * as THREE from "three";
import { HERO_MODEL, CLIPS } from "@/game/assets";
import { playerSpeed } from "@/game/refs";

// ──────────────────────────────────────────────────────────────────────────
// VISUAL TUNING CONSTANTS — adjust after a visual check in the running world.
// ──────────────────────────────────────────────────────────────────────────

/**
 * Uniform model scale. KayKit Adventurers stand ~1.8 units tall at scale 1,
 * which reads well against the ~2.0-tall capsule and the ~3-5 unit buildings.
 * Bump up/down only if the hero looks oversized/tiny next to the world.
 */
const SCALE = 1;

/**
 * Vertical placement inside the Player's `visual` group. The group's origin is
 * the capsule CENTER and the capsule spans y ∈ [-1.0, +1.0], so feet belong at
 * y ≈ -1.0. KayKit models have their origin at the feet, so dropping the model
 * by 1.0 plants the feet on the capsule bottom (the ground).
 */
const Y_OFFSET = -1.0;

/**
 * Yaw applied to the model so its forward axis matches the travel direction.
 * The controller already rotates the parent group to face movement, and KayKit
 * characters face +Z by default, so 0 should be correct. If the hero appears to
 * moonwalk / face backwards in-world, flip this to Math.PI.
 */
const BASE_ROTATION_Y = 0;

// Speed thresholds (world units/sec; Player max speed is 5).
const WALK_THRESHOLD = 0.1; // below this → Idle
const RUN_THRESHOLD = 3.6; // at/above this → Running_A
const FADE = 0.2; // crossfade duration in seconds

useGLTF.preload(HERO_MODEL);

export function Character() {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(HERO_MODEL);
  const { actions } = useAnimations(animations, group);

  // Enable shadow casting/receiving on every mesh once after load.
  useEffect(() => {
    scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
  }, [scene]);

  // Track which clip is currently playing so we only crossfade on a change,
  // never restart the active clip every frame.
  const current = useRef<string | null>(null);

  // Start in idle once the actions are available.
  useEffect(() => {
    const idle = actions[CLIPS.idle];
    if (idle) {
      idle.reset().fadeIn(FADE).play();
      current.current = CLIPS.idle;
    }
    return () => {
      // Stop everything on unmount so a remount doesn't double-play.
      Object.values(actions).forEach((a) => a?.stop());
      current.current = null;
    };
  }, [actions]);

  useFrame(() => {
    const speed = playerSpeed.value;
    const next =
      speed < WALK_THRESHOLD
        ? CLIPS.idle
        : speed < RUN_THRESHOLD
          ? CLIPS.walk
          : CLIPS.run;

    if (next === current.current) return; // no change → keep playing

    const prevAction = current.current ? actions[current.current] : null;
    const nextAction = actions[next];
    if (!nextAction) return; // clip missing — leave current playing

    nextAction.reset().setEffectiveWeight(1).fadeIn(FADE).play();
    if (prevAction && prevAction !== nextAction) prevAction.fadeOut(FADE);
    current.current = next;
  });

  // Memoize so the JSX object identity is stable across re-renders.
  const position = useMemo<[number, number, number]>(
    () => [0, Y_OFFSET, 0],
    [],
  );

  return (
    <group
      ref={group}
      position={position}
      scale={SCALE}
      rotation={[0, BASE_ROTATION_Y, 0]}
    >
      <primitive object={scene} />
    </group>
  );
}
