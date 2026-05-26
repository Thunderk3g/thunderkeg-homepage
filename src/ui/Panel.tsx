"use client";

import { getBuilding } from "@/game/buildings";
import type { BuildingId } from "@/game/store";
import { PanelContent } from "./PanelContent";

export function Panel({ id, onClose }: { id: BuildingId; onClose: () => void }) {
  const b = getBuilding(id);
  return (
    <div className="panel-overlay" onClick={onClose}>
      <div className="panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={b.label}>
        <div className="panel-header">
          <img src={b.icon} alt="" className="panel-icon" />
          <h2>{b.label}</h2>
          <button className="panel-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="panel-body">
          <PanelContent id={id} />
        </div>
      </div>
    </div>
  );
}
