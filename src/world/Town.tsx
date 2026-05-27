"use client";

import { BUILDINGS } from "@/game/buildings";
import { Building } from "@/game/Building";

/**
 * The six résumé buildings. Maps the BUILDINGS data to <Building> instances; the
 * per-building colliders and store wiring live inside Building.tsx and must be
 * preserved. The village green + central well are part of the Terrain layer.
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
