"use client";

/**
 * Player life bar — a DOM HUD element (sibling of the Canvas), storybook paper
 * style. Reads the framework-agnostic health store (src/game/health.ts) via the
 * zustand hook so it re-renders only when hp changes. Shows a depleting fill
 * with hp/maxHp, plus a row of heart pips, and flashes + shakes briefly each
 * time the player takes damage. Hidden until the world is ready.
 */

import { useEffect, useRef, useState } from "react";
import { useHealth } from "@/game/health";
import { useGame } from "@/game/store";
import styles from "./HealthBar.module.css";

/** Each heart pip represents this many HP (100 hp / 20 = 5 hearts). */
const HP_PER_HEART = 20;

export function HealthBar() {
  const hp = useHealth((s) => s.hp);
  const maxHp = useHealth((s) => s.maxHp);
  const ready = useGame((s) => s.ready);

  // Damage flash/shake: bump a key whenever hp drops so the CSS animation
  // restarts. We track the previous hp to detect a decrease (heals don't flash).
  const prevHp = useRef(hp);
  const [hitKey, setHitKey] = useState(0);
  useEffect(() => {
    if (hp < prevHp.current) setHitKey((k) => k + 1);
    prevHp.current = hp;
  }, [hp]);

  if (!ready) return null;

  const pct = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
  const hearts = Math.max(1, Math.round(maxHp / HP_PER_HEART));
  // Low-health styling once the player drops to a quarter bar.
  const low = pct <= 0.25;

  return (
    <div
      className={`${styles.wrap} ${hitKey > 0 ? styles.hit : ""}`}
      // `key` restarts the shake/flash animation on each new hit.
      key={hitKey}
      role="status"
      aria-label={`Health ${Math.round(hp)} of ${maxHp}`}
    >
      <div className={styles.label}>Vitality</div>

      <div className={`${styles.bar} ${low ? styles.low : ""}`}>
        <div className={styles.fill} style={{ width: `${pct * 100}%` }} />
        <span className={styles.value}>
          {Math.max(0, Math.round(hp))}
          <span className={styles.slash}>/</span>
          {maxHp}
        </span>
      </div>

      <div className={styles.hearts} aria-hidden="true">
        {Array.from({ length: hearts }, (_, i) => {
          // Fractional fill for the heart straddling the current hp.
          const heartFill = Math.max(0, Math.min(1, hp / HP_PER_HEART - i));
          return (
            <span
              key={i}
              className={`${styles.heart} ${heartFill <= 0 ? styles.empty : ""}`}
              style={{ ["--fill" as string]: heartFill }}
            >
              ♥
            </span>
          );
        })}
      </div>
    </div>
  );
}
