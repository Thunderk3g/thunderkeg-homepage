"use client";

import { useEffect } from "react";
import { useGame } from "@/game/store";
import { getBuilding } from "@/game/buildings";
import { Panel } from "./Panel";

export function Hud() {
  const near = useGame((s) => s.nearBuilding);
  const activePanel = useGame((s) => s.activePanel);
  const openPanel = useGame((s) => s.openPanel);
  const closePanel = useGame((s) => s.closePanel);

  // E to enter when near a building; Esc to close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closePanel();
        return;
      }
      if (e.key === "e" || e.key === "E" || e.key === "Enter") {
        const s = useGame.getState();
        if (!s.activePanel && !s.activeMinigame && s.nearBuilding) {
          openPanel(s.nearBuilding);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openPanel, closePanel]);

  return (
    <div className="hud">
      {near && !activePanel && (
        <div className="prompt">
          <img src="/ui/interact_prompt.png" alt="E" className="prompt-key" />
          <span>
            Enter <strong>{getBuilding(near).label}</strong>
          </span>
        </div>
      )}
      {activePanel && <Panel id={activePanel} onClose={closePanel} />}
    </div>
  );
}
