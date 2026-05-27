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

/** The pond (matches Terrain/Scatter). For ambient water shimmer & fireflies. */
export const POND = { x: -9, z: -1, radius: 3.1 } as const;

/**
 * Half-extent of the explorable world (the physics floor is ±70). Used as the
 * minimap range and the bound for outer-world content. The village sits in the
 * flat centre; mountains + forest ring the outskirts to explore.
 */
export const WORLD_EXTENT = 56;

/**
 * Climbable mountains ringing the village. Each is a sloped cone-ish mesh with
 * a matching collider; slopes are ~33-36° (under the controller's 45° climb
 * limit) so the player can actually walk UP them. Gaps between them form passes.
 */
export interface MountainSpec {
  x: number;
  z: number;
  radius: number;
  height: number;
}
export const MOUNTAINS: MountainSpec[] = [
  { x: 0, z: -46, radius: 17, height: 11.5 },
  { x: -40, z: -28, radius: 15, height: 10 },
  { x: 40, z: -28, radius: 15, height: 10 },
  { x: -48, z: 8, radius: 16, height: 10.5 },
  { x: 48, z: 10, radius: 16, height: 10.5 },
  { x: -28, z: 44, radius: 14, height: 9 },
  { x: 32, z: 46, radius: 15, height: 9.5 },
];

/** A forest grove to explore (denser trees + a landmark), away from the village. */
export const FOREST = { x: 30, z: -34, radius: 12 } as const;

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
