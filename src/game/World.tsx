"use client";

import { Terrain } from "@/world/Terrain";
import { Town } from "@/world/Town";
import { Scatter } from "@/world/Scatter";

/** Composes the world: ground/path/water, the six buildings, and scatter props. */
export function World() {
  return (
    <>
      <Terrain />
      <Town />
      <Scatter />
    </>
  );
}
