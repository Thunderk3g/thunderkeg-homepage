"use client";

/**
 * MobileControls — on-screen virtual joystick for touch devices.
 *
 * Renders an nipplejs joystick in the lower-left of the screen on touch-capable
 * devices only, and writes the analog movement vector into the game store via
 * `useGame.getState().setJoystick(x, z)`:
 *   - x: strafe, -1..1 (positive = right)
 *   - z: forward/back, -1..1 (NEGATIVE = forward, matching the -Z forward
 *        convention). nipplejs `vector.y` is +up on screen, so z = -vector.y.
 * On release/unmount the joystick resets to (0, 0) so the player stops.
 *
 * Non-touch devices render nothing.
 */

import { useEffect, useRef, useState } from "react";
// Type-only import: erased at compile time so nipplejs's module code (which
// touches `window`) never runs during server prerender. The real module is
// loaded lazily inside the effect below, client-side only.
import type nipplejs from "nipplejs";
import { useGame } from "@/game/store";

/** The instance returned by nipplejs.create (a Collection). */
type JoystickManager = ReturnType<typeof nipplejs.create>;

const clamp = (value: number): number => Math.max(-1, Math.min(1, value));

export function MobileControls() {
  const [isTouch, setIsTouch] = useState(false);
  const zoneRef = useRef<HTMLDivElement | null>(null);
  const managerRef = useRef<JoystickManager | null>(null);

  // Detect touch capability on the client only (never read `window` at module
  // top — that would crash during SSR).
  useEffect(() => {
    setIsTouch(
      typeof window !== "undefined" &&
        ("ontouchstart" in window || navigator.maxTouchPoints > 0),
    );
  }, []);

  // Create the nipplejs manager once we know we're on a touch device and the
  // zone element is mounted. The effect depends on `isTouch` so it runs after
  // the zone is rendered.
  useEffect(() => {
    if (!isTouch) return;
    const zone = zoneRef.current;
    if (!zone) return;

    let cancelled = false;

    // Load nipplejs lazily so its window-touching module code only ever runs
    // on the client, never during Next's server prerender.
    void import("nipplejs").then(({ default: nipplejs }) => {
      if (cancelled || !zoneRef.current) return;

      const manager: JoystickManager = nipplejs.create({
        zone,
        mode: "static",
        position: { left: "50%", top: "50%" },
        color: "#6fae6a", // sage, Ghibli palette
        size: 110,
        restJoystick: true,
      });
      managerRef.current = manager;

      const setJoystick = useGame.getState().setJoystick;

      // nipplejs 1.0.3 passes a single InternalEvent whose payload is `evt.data`.
      manager.on("move", (evt) => {
        const data = evt.data;
        if (!data || !data.vector) return;
        // vector.x = right (+), vector.y = up (+). Forward is -Z.
        setJoystick(clamp(data.vector.x), clamp(-data.vector.y));
      });

      manager.on("end", () => {
        setJoystick(0, 0);
      });
    });

    // Cleanup: fully destroy so a StrictMode remount can't leave a duplicate
    // joystick behind, and reset movement to idle. Guards the async import in
    // case the effect tears down before nipplejs finishes loading.
    return () => {
      cancelled = true;
      managerRef.current?.destroy();
      managerRef.current = null;
      useGame.getState().setJoystick(0, 0);
    };
  }, [isTouch]);

  if (!isTouch) return null;

  return (
    <>
      <style>{`
        .mobile-joystick-zone {
          position: fixed;
          left: calc(24px + env(safe-area-inset-left));
          bottom: calc(24px + env(safe-area-inset-bottom));
          width: 140px;
          height: 140px;
          z-index: 20;
          /* Only the circular zone itself captures touches; everything outside
             stays interactive for the rest of the HUD. */
          pointer-events: auto;
          touch-action: none;
          border-radius: 50%;
          background: rgba(247, 241, 227, 0.35);
          border: 2px dashed rgba(111, 174, 106, 0.5);
          box-sizing: border-box;
        }
      `}</style>
      <div
        ref={zoneRef}
        className="mobile-joystick-zone"
        aria-hidden="true"
      />
    </>
  );
}
