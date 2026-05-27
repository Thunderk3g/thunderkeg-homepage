"use client";

import { useEffect, useState } from "react";
import { useGame } from "@/game/store";
import styles from "./Intro.module.css";

/**
 * A brief storybook TITLE overlay shown once after the world becomes ready.
 * Fades in, then fades out after ~4s OR on the first key/pointer input, then
 * unmounts. Never traps input (pointer-events: none throughout).
 */

const HOLD_MS = 4000; // visible duration before auto-dismiss
const FADE_MS = 900; // matches the CSS transition

export function Intro() {
  const ready = useGame((s) => s.ready);

  // "shown" once ready latches true; "leaving" triggers the fade-out;
  // "gone" unmounts entirely.
  const [shown, setShown] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);

  // Latch visible once the world is ready (only the first time).
  useEffect(() => {
    if (ready && !shown && !gone) {
      // Defer one frame so the fade-in transition actually animates from 0.
      const id = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(id);
    }
  }, [ready, shown, gone]);

  // Once shown: arm auto-dismiss + first-input dismiss.
  useEffect(() => {
    if (!shown || leaving) return;

    const dismiss = () => setLeaving(true);

    const timer = window.setTimeout(dismiss, HOLD_MS);
    window.addEventListener("keydown", dismiss, { once: true });
    window.addEventListener("pointerdown", dismiss, { once: true });

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", dismiss);
      window.removeEventListener("pointerdown", dismiss);
    };
  }, [shown, leaving]);

  // After the fade-out completes, unmount.
  useEffect(() => {
    if (!leaving) return;
    const id = window.setTimeout(() => setGone(true), FADE_MS);
    return () => window.clearTimeout(id);
  }, [leaving]);

  if (gone || !shown) return null;

  return (
    <div
      className={`${styles.intro} ${leaving ? styles.leaving : styles.entered}`}
      aria-hidden="true"
    >
      <div className={styles.card}>
        <h1 className={styles.name}>Diwakar Adhikari</h1>
        <p className={styles.role}>Senior Software Engineer</p>
        <p className={styles.hint}>
          WASD / arrows to walk <span className={styles.dot}>·</span> E to interact
        </p>
      </div>
    </div>
  );
}
