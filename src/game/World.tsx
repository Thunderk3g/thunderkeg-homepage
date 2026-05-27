"use client";

import { Terrain } from "@/world/Terrain";
import { Town } from "@/world/Town";
import { Scatter } from "@/world/Scatter";
import { QuestEntities } from "./QuestEntities";

/**
 * Composes the world: ground/green/paths, the six cottages, scatter props, and
 * the in-world quest entities (monsters, courier markers, cache shrine).
 */
export function World() {
  return (
    <>
      <Terrain />
      <Town />
      <Scatter />
      <QuestEntities />
    </>
  );
}
