"use client";

import { Terrain } from "@/world/Terrain";
import { Town } from "@/world/Town";
import { Scatter } from "@/world/Scatter";
import { Dressing } from "@/world/Dressing";
import { Ambience } from "@/world/Ambience";
import { QuestEntities } from "./QuestEntities";
import { FootstepDust } from "./FootstepDust";

/**
 * Composes the world: ground/green/paths, the six cottages, scatter props,
 * plaza dressing, ambient life, the in-world quest entities, and footstep dust.
 */
export function World() {
  return (
    <>
      <Terrain />
      <Town />
      <Scatter />
      <Dressing />
      <Ambience />
      <QuestEntities />
      <FootstepDust />
    </>
  );
}
