"use client";

import { useEffect, useRef, useState } from "react";
import {
  useQuests,
  QUEST_LABEL,
  type QuestId,
  type QuestStatus,
} from "@/game/quests";

const QUEST_IDS: QuestId[] = ["bug-hunt", "kafka-courier", "cache-match"];

/** How long each toast stays on screen before auto-dismissing. */
const TOAST_MS = 3500;

interface ToastItem {
  id: number;
  questId: QuestId;
}

/**
 * DOM celebration overlay. Subscribes to useQuests and remembers the previous
 * per-quest status; when any quest flips to "complete", a storybook toast pops
 * ("✨ Quest complete — {label}!") with a sparkle and auto-dismisses after
 * ~3.5s. Multiple completions queue and show one after another. Sibling of the
 * Canvas, pure DOM.
 */
export function Toast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  // Previous per-quest status snapshot (ref so it never triggers re-render).
  const prevRef = useRef<Record<QuestId, QuestStatus>>({
    ...useQuests.getState().status,
  });
  const seqRef = useRef(0);

  useEffect(() => {
    // Catch any transitions that happened between render and subscribe.
    const sync = (status: Record<QuestId, QuestStatus>) => {
      const newlyComplete: QuestId[] = [];
      for (const id of QUEST_IDS) {
        if (status[id] === "complete" && prevRef.current[id] !== "complete") {
          newlyComplete.push(id);
        }
      }
      prevRef.current = { ...status };
      if (newlyComplete.length > 0) {
        setToasts((cur) => [
          ...cur,
          ...newlyComplete.map((questId) => ({
            id: (seqRef.current += 1),
            questId,
          })),
        ]);
      }
    };

    sync(useQuests.getState().status);
    const unsub = useQuests.subscribe((s) => sync(s.status));
    return unsub;
  }, []);

  const dismiss = (id: number) =>
    setToasts((cur) => cur.filter((t) => t.id !== id));

  if (toasts.length === 0) return null;

  return (
    <div className="quest-toasts" aria-live="polite">
      {toasts.map((t) => (
        <ToastCard key={t.id} item={t} onDone={() => dismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastCard({
  item,
  onDone,
}: {
  item: ToastItem;
  onDone: () => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="quest-toast paper" role="status">
      <span className="quest-toast__spark" aria-hidden="true">
        ✨
      </span>
      <div className="quest-toast__text">
        <span className="quest-toast__eyebrow">Quest complete</span>
        <span className="quest-toast__title">{QUEST_LABEL[item.questId]}!</span>
      </div>
      <button
        className="quest-toast__close"
        type="button"
        aria-label="Dismiss"
        onClick={onDone}
      >
        ×
      </button>
      <span className="quest-toast__timer" aria-hidden="true" />
    </div>
  );
}
