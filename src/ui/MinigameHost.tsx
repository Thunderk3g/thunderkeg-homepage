"use client";

import { Suspense } from "react";
import { useGame } from "@/game/store";
import { modalMinigames } from "@/minigames/registry";

/** Renders the active modal minigame as a full-screen overlay. */
export function MinigameHost() {
  const active = useGame((s) => s.activeMinigame);
  if (!active) return null;
  const Game = modalMinigames[active];
  if (!Game) return null;

  return (
    <div className="minigame-overlay">
      <Suspense fallback={<div className="minigame-loading">Loading…</div>}>
        <Game />
      </Suspense>
    </div>
  );
}
