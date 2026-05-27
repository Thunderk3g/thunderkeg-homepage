/**
 * Shared asset paths + animation clip names for the 3D world.
 *
 * The hero is a KayKit "Adventurers" character (CC0). All five characters are
 * downloaded under /public/models — swap HERO_MODEL to change the avatar.
 * The Knight.glb ships 76 clips; the ones we drive are listed in CLIPS.
 */

export const MODELS = {
  knight: "/models/Knight.glb",
  rogue: "/models/Rogue.glb",
  rogueHooded: "/models/Rogue_Hooded.glb",
  mage: "/models/Mage.glb",
  barbarian: "/models/Barbarian.glb",
} as const;

/** The character the player walks around as. */
export const HERO_MODEL = MODELS.knight;

/** Exact animation clip names present in the KayKit adventurer glbs. */
export const CLIPS = {
  idle: "Idle",
  walk: "Walking_A",
  run: "Running_A",
  cheer: "Cheer",
  interact: "Interact",
  jump: "Jump_Full_Short",
} as const;
