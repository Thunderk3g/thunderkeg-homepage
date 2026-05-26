"use client";

import { useEffect } from "react";
import { useProgress } from "@react-three/drei";
import { useGame } from "@/game/store";

export function Loader() {
  const { progress, active } = useProgress();
  const ready = useGame((s) => s.ready);
  const setReady = useGame((s) => s.setReady);

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

  if (ready) return null;

  return (
    <div className="loader">
      <img src="/ui/loading_screen.png" alt="" className="loader-bg" />
      <div className="loader-panel">
        <img src="/ui/logo.png" alt="Diwakar Adhikari" className="loader-logo" />
        <div className="loader-bar">
          <div className="loader-fill" style={{ width: `${Math.max(8, progress)}%` }} />
        </div>
        <p className="loader-hint">WASD / drag to move · E to enter a building</p>
      </div>
    </div>
  );
}
