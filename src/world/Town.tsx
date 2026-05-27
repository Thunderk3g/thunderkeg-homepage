"use client";

import { BUILDINGS } from "@/game/buildings";
import { Building } from "@/game/Building";

/**
 * The six résumé buildings. SEAM owned by the town/buildings agent. Maps the
 * BUILDINGS data to <Building> instances; the per-building colliders and store
 * wiring live inside Building.tsx and must be preserved.
 */
export function Town() {
  return (
    <>
      {BUILDINGS.map((b) => (
        <Building key={b.id} def={b} />
      ))}
    </>
  );
}
