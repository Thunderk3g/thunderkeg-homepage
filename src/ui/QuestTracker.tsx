"use client";

import {
  useQuests,
  QUEST_GOAL,
  QUEST_LABEL,
  type QuestId,
} from "@/game/quests";
import { useGame } from "@/game/store";

/** One-line objective shown under each quest's label in the tracker. */
const QUEST_OBJECTIVE: Record<QuestId, string> = {
  "bug-hunt": "Squash the glitch-skeletons in the north field.",
  "kafka-courier": "Carry the letters from Projects to each cottage.",
  "cache-match": "Activate the cache shrine by the Skills cottage.",
};

/** Stable display order for the compact all-quests list. */
const QUEST_ORDER: QuestId[] = ["bug-hunt", "kafka-courier", "cache-match"];

/** Status pip glyph: inactive ○ · active ◐ · complete ✓. */
const STATUS_PIP: Record<string, string> = {
  inactive: "○",
  active: "◐",
  complete: "✓",
};

/**
 * Storybook "paper" HUD tracker, top-left. Shows the most recently started
 * quest (useQuests.active): its label, a one-line objective, and progress
 * "x / goal" (or a "Complete!" badge with the score earned). Below, a compact
 * "quest log" lists all three quests with status pips. Hidden when no quest is
 * active. Pure DOM overlay.
 */
export function QuestTracker() {
  const active = useQuests((s) => s.active);
  const status = useQuests((s) => (active ? s.status[active] : null));
  const progress = useQuests((s) => (active ? s.progress[active] : 0));
  const statusMap = useQuests((s) => s.status);
  const score = useGame((s) => (active ? s.scores[active] : null));

  if (!active) return null;

  const goal = QUEST_GOAL[active];
  const isComplete = status === "complete";
  const pct = Math.max(0, Math.min(100, (progress / goal) * 100));

  return (
    <div className="quest-tracker paper" role="status" aria-live="polite">
      <div className="quest-tracker__head">
        <span className="quest-tracker__pin" aria-hidden="true" />
        <h3 className="quest-tracker__title">{QUEST_LABEL[active]}</h3>
      </div>
      <p className="quest-tracker__objective">{QUEST_OBJECTIVE[active]}</p>

      <div className="quest-tracker__progress">
        {isComplete ? (
          <span className="quest-tracker__done">
            Complete!
            {score != null && (
              <span className="quest-tracker__score">
                Score {score.toLocaleString()}
              </span>
            )}
          </span>
        ) : (
          <>
            <span className="quest-tracker__count">
              {progress} / {goal}
            </span>
            <span
              className="quest-tracker__bar"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={goal}
            >
              <span
                className="quest-tracker__fill"
                style={{ width: `${pct}%` }}
              />
            </span>
          </>
        )}
      </div>

      {/* Compact quest log: all three quests with status pips. */}
      <ul className="quest-tracker__log" aria-label="All quests">
        {QUEST_ORDER.map((id) => {
          const s = statusMap[id];
          return (
            <li
              key={id}
              className={`quest-tracker__log-item quest-tracker__log-item--${s}${
                id === active ? " is-active" : ""
              }`}
            >
              <span className="quest-tracker__log-pip" aria-hidden="true">
                {STATUS_PIP[s]}
              </span>
              <span className="quest-tracker__log-label">
                {QUEST_LABEL[id]}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
