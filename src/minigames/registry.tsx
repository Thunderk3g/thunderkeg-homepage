"use client";

import { lazy, type ComponentType } from "react";
import type { MinigameId } from "@/game/store";

/**
 * Modal (DOM overlay) minigames, loaded lazily. In-world minigames (Bug Hunt,
 * Kafka Courier) live inside the Canvas and are handled separately, not here.
 */
export const modalMinigames: Partial<Record<MinigameId, ComponentType>> = {
  "cache-match": lazy(() => import("./CacheMatch")),
};
