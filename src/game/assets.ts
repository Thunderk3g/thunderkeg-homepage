/**
 * Shared asset paths + animation clip names for the 3D world.
 *
 * The hero is a KayKit "Adventurers" character (CC0). All five characters are
 * downloaded under /public/models — swap HERO_MODEL to change the avatar.
 * The Knight.glb ships 76 clips; the ones we drive are listed in CLIPS.
 */

export const MODELS = {
  /** Higher-detail CC0 hero (three.js examples, Tomás Laulhé / Don McCurdy). */
  robot: "/models/RobotExpressive.glb",
  knight: "/models/Knight.glb",
  rogue: "/models/Rogue.glb",
  rogueHooded: "/models/Rogue_Hooded.glb",
  mage: "/models/Mage.glb",
  barbarian: "/models/Barbarian.glb",
} as const;

/** The character the player walks around as. */
export const HERO_MODEL = MODELS.robot;

/**
 * Hero animation clip names. These map to the RobotExpressive rig (14 clips:
 * Idle, Walking, Running, Jump, Punch, Death, Dance, Wave, ThumbsUp, Sitting,
 * Standing, Yes, No, WalkJump). Idle/Walking/Running loop; Punch is the one-shot
 * melee swing used for the heroAttack signal.
 */
export const CLIPS = {
  idle: "Idle",
  walk: "Walking",
  run: "Running",
  cheer: "Wave",
  interact: "ThumbsUp",
  jump: "Jump",
  attack: "Punch",
} as const;

/**
 * KayKit "Skeletons" monsters (CC0) — same rig/clip names as the Adventurers,
 * so the hero and monsters animate from the same vocabulary. Used for the Bug
 * Hunt quest's roaming "glitch" enemies.
 */
export const MONSTERS = {
  minion: "/models/monsters/Skeleton_Minion.glb",
  warrior: "/models/monsters/Skeleton_Warrior.glb",
  mage: "/models/monsters/Skeleton_Mage.glb",
  rogue: "/models/monsters/Skeleton_Rogue.glb",
} as const;

export type MonsterModel = keyof typeof MONSTERS;

/** Clip names shared by every KayKit skeleton (verified present in the glbs). */
export const MONSTER_CLIPS = {
  idle: "Idle",
  walk: "Walking_A",
  run: "Running_A",
  attack: "1H_Melee_Attack_Chop",
  hit: "Hit_A",
  death: "Death_A",
} as const;
