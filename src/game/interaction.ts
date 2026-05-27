"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useKeyboardControls } from "@react-three/drei";
import { Controls } from "./controls";

/**
 * Shared interaction helpers for quests/monsters.
 *
 * `heroAttack` is a one-shot signal: any system (e.g. a monster being struck)
 * bumps `token` via requestHeroAttack(); Character.tsx watches it and plays the
 * Knight's melee-chop clip once. Module-level so it never triggers re-renders.
 */
export const heroAttack = { token: 0 };
export function requestHeroAttack() {
  heroAttack.token += 1;
}

/**
 * Calls `onPress` exactly once on each rising edge of the interact key (E /
 * Enter). Runs in the R3F frame loop; safe to use from any number of in-world
 * entities (each gets its own edge state). Pass `enabled=false` to ignore
 * presses (e.g. when the entity is out of range or a modal is open).
 */
export function useInteractPressed(onPress: () => void, enabled = true) {
  const [, getKeys] = useKeyboardControls<Controls>();
  const wasDown = useRef(false);
  const cb = useRef(onPress);
  cb.current = onPress;

  useFrame(() => {
    const down = getKeys().interact === true;
    if (down && !wasDown.current && enabled) cb.current();
    wasDown.current = down;
  });
}
