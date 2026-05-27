"use client";

import { useEffect, useState } from "react";
import { useProgress } from "@react-three/drei";
import { useGame } from "@/game/store";

const HINTS = [
  "Stretching the meadows…",
  "Waking the little spirits…",
  "Painting the rooftops…",
  "Brewing a pot of tea…",
  "Folding paper clouds…",
  "Planting the tech garden…",
];

export function Loader() {
  const { progress, active } = useProgress();
  const ready = useGame((s) => s.ready);
  const setReady = useGame((s) => s.setReady);
  const [hint, setHint] = useState(0);

  // Hide once loading settles.
  useEffect(() => {
    if (!active && progress >= 100) {
      const t = setTimeout(() => setReady(true), 400);
      return () => clearTimeout(t);
    }
  }, [active, progress, setReady]);

  // Safety net: never trap the user behind the loader.
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 6000);
    return () => clearTimeout(t);
  }, [setReady]);

  // Rotating cozy hint line.
  useEffect(() => {
    const id = setInterval(() => setHint((h) => (h + 1) % HINTS.length), 2200);
    return () => clearInterval(id);
  }, []);

  if (ready) return null;

  const pct = Math.max(8, Math.min(100, progress));

  return (
    <div className="loader" role="status" aria-live="polite" aria-label="Loading the world">
      <span className="loader-cloud c1" aria-hidden="true" />
      <span className="loader-cloud c2" aria-hidden="true" />
      <span className="loader-cloud c3" aria-hidden="true" />

      <div className="loader-panel">
        <h1 className="loader-title">Diwakar&rsquo;s World</h1>
        <p className="loader-sub">a little walkable portfolio</p>

        <div className="loader-bar">
          <div className="loader-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="loader-walker" aria-hidden="true">
          <span style={{ left: `${pct}%` }}>🍃</span>
        </div>

        <p className="loader-hint" key={hint}>
          {HINTS[hint]}
        </p>
        <p className="loader-sub" aria-hidden="true">
          WASD / drag to move · press E to enter a building
        </p>
      </div>
    </div>
  );
}
