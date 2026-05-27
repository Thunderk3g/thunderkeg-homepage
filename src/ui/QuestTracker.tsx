"use client";

import {
  useQuests,
  QUEST_GOAL,
  QUEST_LABEL,
  type QuestId,
} from "@/game/quests";

/** One-line objective shown under each quest's label in the tracker. */
const QUEST_OBJECTIVE: Record<QuestId, string> = {
  "bug-hunt": "Squash the glitch-skeletons in the north field.",
  "kafka-courier": "Carry the letters from Projects to each cottage.",
  "cache-match": "Activate the cache shrine by the Skills cottage.",
};

/**
 * Storybook "paper" HUD tracker, top-left. Shows the most recently started
 * quest (useQuests.active): its label, a one-line objective, and progress
 * "x / goal" (or "Complete!"). Hidden when no quest is active. Pure DOM overlay.
 */
export function QuestTracker() {
  const active = useQuests((s) => s.active);
  const status = useQuests((s) => (active ? s.status[active] : null));
  const progress = useQuests((s) => (active ? s.progress[active] : 0));

  if (!active) return null;

  const goal = QUEST_GOAL[active];
  const isComplete = status === "complete";

  return (
    <div className="quest-tracker paper" role="status" aria-live="polite">
      <div className="quest-tracker__head">
        <span className="quest-tracker__pin" aria-hidden="true" />
        <h3 className="quest-tracker__title">{QUEST_LABEL[active]}</h3>
      </div>
      <p className="quest-tracker__objective">{QUEST_OBJECTIVE[active]}</p>
      <div className="quest-tracker__progress">
        {isComplete ? (
          <span className="quest-tracker__done">Complete!</span>
        ) : (
          <>
            <span className="quest-tracker__count">
              {progress} / {goal}
            </span>
            <span className="quest-tracker__bar" aria-hidden="true">
              <span
                className="quest-tracker__fill"
                style={{ width: `${(progress / goal) * 100}%` }}
              />
            </span>
          </>
        )}
      </div>
    </div>
  );
}
