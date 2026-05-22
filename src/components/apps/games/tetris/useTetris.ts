"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  GameState,
  createInitialState,
  hardDrop,
  rotate,
  softDrop,
  tick,
  togglePause,
  tryMove,
} from "./engine";

export interface TetrisControls {
  moveLeft: () => void;
  moveRight: () => void;
  rotateCW: () => void;
  rotateCCW: () => void;
  softDrop: () => void;
  hardDrop: () => void;
  pause: () => void;
  restart: () => void;
  setPaused: (paused: boolean) => void;
}

export interface TetrisHookResult {
  state: GameState;
  controls: TetrisControls;
}

export function useTetris(): TetrisHookResult {
  const [state, setState] = useState<GameState>(() => createInitialState());
  const stateRef = useRef<GameState>(state);
  stateRef.current = state;

  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  const apply = useCallback((updater: (s: GameState) => GameState) => {
    setState((prev) => {
      const next = updater(prev);
      stateRef.current = next;
      return next;
    });
  }, []);

  // RAF loop.
  useEffect(() => {
    const loop = (time: number) => {
      const last = lastTimeRef.current;
      lastTimeRef.current = time;
      const delta = last == null ? 0 : Math.min(time - last, 100);
      const cur = stateRef.current;
      if (!cur.gameOver && !cur.paused && delta > 0) {
        apply((s) => tick(s, delta));
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTimeRef.current = null;
    };
  }, [apply]);

  // Auto-pause when document hidden.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        const s = stateRef.current;
        if (!s.paused && !s.gameOver) {
          apply((cur) => ({ ...cur, paused: true }));
        }
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [apply]);

  const controls: TetrisControls = {
    moveLeft: () => apply((s) => tryMove(s, -1, 0)),
    moveRight: () => apply((s) => tryMove(s, 1, 0)),
    rotateCW: () => apply((s) => rotate(s, 1)),
    rotateCCW: () => apply((s) => rotate(s, -1)),
    softDrop: () => apply((s) => softDrop(s)),
    hardDrop: () => apply((s) => hardDrop(s)),
    pause: () => apply((s) => togglePause(s)),
    restart: () => apply(() => createInitialState()),
    setPaused: (paused) =>
      apply((s) => (s.gameOver ? s : { ...s, paused })),
  };

  return { state, controls };
}
