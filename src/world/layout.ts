/**
 * Single source of truth for the village LAYOUT — shared by buildings, terrain,
 * scatter, the player spawn, and the quest entities so everything stays in sync
 * when the layout is retuned.
 *
 * Design: a circular village green (plaza) at the origin with a well at its
 * centre. Six résumé cottages ring the green, each FACING inward. The player
 * enters from the south gate, walks up the main path into the green. North of
 * the village, past the Home cottage, lies an open field where the Bug Hunt
 * skeletons roam.
 *
 *            (north / -Z)
 *                 [field]
 *        experience   about   projects
 *                 (  green/well  )
 *           skills           awards
 *                  contact
 *                 [south gate]  ← spawn
 *            (south / +Z)
 */
import { BUILDINGS } from "@/game/buildings";

/** Player start: just inside the south gate, facing north (-Z) into town. */
export const SPAWN: [number, number, number] = [0, 1.2, 12];

/** Village green at the origin (a circular grassy plaza with a central well). */
export const PLAZA = { x: 0, z: 0, radius: 3.6 } as const;

/** South gate / entrance arch position. */
export const GATE: [number, number] = [0, 12.5];

/** Open field (north, behind Home) where Bug Hunt skeletons spawn & roam. */
export const MONSTER_FIELD = { x: 0, z: -15.5, radius: 5.5 } as const;

/** Half-width clearance kept free of scatter around each building footprint. */
export const BUILDING_CLEAR_PAD = 1.4;

/** XZ doorstep targets the main path connects out from the plaza. */
export const PATH_TARGETS: [number, number][] = BUILDINGS.map((b) => [
  b.position[0],
  b.position[2],
]);

/** A point in front of a building (between it and the plaza), for path/props. */
export function frontOf(
  pos: [number, number, number],
  size: [number, number, number],
  extra = 0.6,
): [number, number] {
  const [x, , z] = pos;
  const len = Math.hypot(x, z) || 1;
  const back = size[2] + extra;
  return [x - (x / len) * back, z - (z / len) * back];
}
