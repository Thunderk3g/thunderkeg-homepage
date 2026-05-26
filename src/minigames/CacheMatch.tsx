"use client";

import { useGame } from "@/game/store";

/**
 * STUB — replaced by the Cache Match implementation.
 * Contract: render the game UI; call `useGame.getState().setScore("cache-match", n)`
 * on win and `endMinigame()` to close. Rendered inside MinigameHost's overlay.
 */
export default function CacheMatch() {
  const end = useGame((s) => s.endMinigame);
  return (
    <div className="minigame-modal">
      <h2>Cache Match</h2>
      <p>Coming soon.</p>
      <button className="play-btn" onClick={end}>
        Close
      </button>
    </div>
  );
}
