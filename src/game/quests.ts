"use client";

import { create } from "zustand";

/**
 * In-world quest system. The three "minigames" are now quests you play inside
 * the 3D village (not DOM overlays):
 *   - bug-hunt      (VAPT / security): defeat the glitch-skeletons roaming the
 *                   field. Combat: walk up + press E; goal = clear them all.
 *   - kafka-courier (messaging): carry letters from the post office to each
 *                   building in order. Goal = all deliveries made.
 *   - cache-match   (Redis): activate the cache shrine and complete the match.
 *
 * A quest is started from its building's panel ("Begin quest" button), tracked
 * on the HUD, advanced by in-world entities (monsters, delivery points), and on
 * completion writes a score back into the main game store (useGame.setScore).
 */
export type QuestId = "bug-hunt" | "kafka-courier" | "cache-match";
export type QuestStatus = "inactive" | "active" | "complete";

/** How many "steps" each quest needs to complete. */
export const QUEST_GOAL: Record<QuestId, number> = {
  "bug-hunt": 5,
  "kafka-courier": 3,
  "cache-match": 1,
};

export const QUEST_LABEL: Record<QuestId, string> = {
  "bug-hunt": "Bug Hunt",
  "kafka-courier": "Kafka Courier",
  "cache-match": "Cache Match",
};

interface QuestState {
  status: Record<QuestId, QuestStatus>;
  progress: Record<QuestId, number>;
  /** The quest currently shown in the HUD tracker (most recently started). */
  active: QuestId | null;

  start: (id: QuestId) => void;
  /** Advance progress by `by` (default 1); auto-completes at the goal. */
  advance: (id: QuestId, by?: number) => void;
  complete: (id: QuestId) => void;
  reset: (id: QuestId) => void;
}

const ZERO: Record<QuestId, number> = {
  "bug-hunt": 0,
  "kafka-courier": 0,
  "cache-match": 0,
};
const INACTIVE: Record<QuestId, QuestStatus> = {
  "bug-hunt": "inactive",
  "kafka-courier": "inactive",
  "cache-match": "inactive",
};

export const useQuests = create<QuestState>((set, get) => ({
  status: { ...INACTIVE },
  progress: { ...ZERO },
  active: null,

  start: (id) =>
    set((s) =>
      s.status[id] === "complete"
        ? { active: id }
        : {
            active: id,
            status: { ...s.status, [id]: "active" },
            progress: { ...s.progress, [id]: 0 },
          },
    ),

  advance: (id, by = 1) => {
    const s = get();
    if (s.status[id] !== "active") return;
    const next = s.progress[id] + by;
    const done = next >= QUEST_GOAL[id];
    set({
      progress: { ...s.progress, [id]: Math.min(next, QUEST_GOAL[id]) },
      status: done ? { ...s.status, [id]: "complete" } : s.status,
    });
  },

  complete: (id) =>
    set((s) => ({
      status: { ...s.status, [id]: "complete" },
      progress: { ...s.progress, [id]: QUEST_GOAL[id] },
    })),

  reset: (id) =>
    set((s) => ({
      status: { ...s.status, [id]: "inactive" },
      progress: { ...s.progress, [id]: 0 },
    })),
}));
