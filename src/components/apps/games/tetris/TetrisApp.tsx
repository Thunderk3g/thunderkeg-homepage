"use client";

import {
  PointerEvent as ReactPointerEvent,
  KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { ghostPiece } from "./engine";
import {
  computeGeometry,
  drawBoard,
  drawHud,
  drawPaused,
  drawPiece,
} from "./render";
import { useTetris } from "./useTetris";

const MAX_W = 360;
const MAX_H = 640;
const SWIPE_THRESHOLD = 20;
const TAP_MAX_DISTANCE = 12;
const TAP_MAX_DURATION_MS = 250;

interface PointerTrack {
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  startTime: number;
  movedCols: number;
  softDropping: boolean;
}

export default function TetrisApp() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const { state, controls } = useTetris();

  const [canvasSize, setCanvasSize] = useState<{ w: number; h: number }>({
    w: MAX_W,
    h: MAX_H,
  });

  // Track sizes from wrapper.
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const update = () => {
      const rect = wrapper.getBoundingClientRect();
      const w = Math.max(80, Math.min(MAX_W, Math.floor(rect.width)));
      const h = Math.max(80, Math.min(MAX_H, Math.floor(rect.height)));
      setCanvasSize({ w, h });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(wrapper);
    return () => ro.disconnect();
  }, []);

  // Draw on every state change.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const geom = computeGeometry(canvasSize.w, canvasSize.h);
    const cssW = geom.totalW;
    const cssH = geom.totalH;
    if (canvas.width !== Math.floor(cssW * dpr)) {
      canvas.width = Math.floor(cssW * dpr);
    }
    if (canvas.height !== Math.floor(cssH * dpr)) {
      canvas.height = Math.floor(cssH * dpr);
    }
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    drawBoard(ctx, state.board, geom);
    if (!state.gameOver) {
      const ghost = ghostPiece(state);
      drawPiece(ctx, ghost, geom, true);
      drawPiece(ctx, state.current, geom, false);
    }
    drawHud(
      ctx,
      {
        score: state.score,
        level: state.level,
        lines: state.lines,
        next: state.next,
      },
      geom,
    );
    if (state.paused && !state.gameOver) drawPaused(ctx, geom);
  }, [state, canvasSize]);

  // Keyboard handlers (only when wrapper is focused).
  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      const key = e.key;
      // Always allow restart and pause.
      if (key === "r" || key === "R") {
        e.preventDefault();
        controls.restart();
        return;
      }
      if (key === "p" || key === "P") {
        e.preventDefault();
        controls.pause();
        return;
      }
      if (state.gameOver) return;
      switch (key) {
        case "ArrowLeft":
          e.preventDefault();
          controls.moveLeft();
          break;
        case "ArrowRight":
          e.preventDefault();
          controls.moveRight();
          break;
        case "ArrowDown":
          e.preventDefault();
          controls.softDrop();
          break;
        case "ArrowUp":
        case "x":
        case "X":
          e.preventDefault();
          controls.rotateCW();
          break;
        case "z":
        case "Z":
          e.preventDefault();
          controls.rotateCCW();
          break;
        case " ":
          e.preventDefault();
          controls.hardDrop();
          break;
        default:
          break;
      }
    },
    [controls, state.gameOver],
  );

  // Pointer / touch handlers for swipe + tap.
  const pointerTrackRef = useRef<Map<number, PointerTrack>>(new Map());

  const cellPx = (() => {
    const geom = computeGeometry(canvasSize.w, canvasSize.h);
    return geom.cell;
  })();

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      // Focus the wrapper so keyboard works after touching.
      wrapperRef.current?.focus();
      e.currentTarget.setPointerCapture(e.pointerId);
      pointerTrackRef.current.set(e.pointerId, {
        startX: e.clientX,
        startY: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
        startTime: performance.now(),
        movedCols: 0,
        softDropping: false,
      });
    },
    [],
  );

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      const track = pointerTrackRef.current.get(e.pointerId);
      if (!track) return;
      const dx = e.clientX - track.startX;
      const dy = e.clientY - track.startY;
      const moveUnit = Math.max(SWIPE_THRESHOLD, cellPx);

      // Horizontal swipe move.
      const targetCols = Math.trunc(dx / moveUnit);
      while (track.movedCols < targetCols) {
        controls.moveRight();
        track.movedCols++;
      }
      while (track.movedCols > targetCols) {
        controls.moveLeft();
        track.movedCols--;
      }

      // Soft drop: continuous while pointer pulled downward beyond threshold.
      if (dy > moveUnit && Math.abs(dy) > Math.abs(dx)) {
        const stepDy = e.clientY - track.lastY;
        if (stepDy > moveUnit * 0.6) {
          controls.softDrop();
          track.lastY = e.clientY;
          track.softDropping = true;
        }
      }

      track.lastX = e.clientX;
    },
    [cellPx, controls],
  );

  const handlePointerUp = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      const track = pointerTrackRef.current.get(e.pointerId);
      pointerTrackRef.current.delete(e.pointerId);
      if (!track) return;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      const dx = e.clientX - track.startX;
      const dy = e.clientY - track.startY;
      const dist = Math.hypot(dx, dy);
      const duration = performance.now() - track.startTime;

      // Tap = rotate CW.
      if (dist <= TAP_MAX_DISTANCE && duration <= TAP_MAX_DURATION_MS) {
        controls.rotateCW();
        return;
      }

      // Swipe up = hard drop (only if vertical-dominant and large).
      if (
        -dy > SWIPE_THRESHOLD * 2 &&
        Math.abs(dy) > Math.abs(dx) &&
        !track.softDropping
      ) {
        controls.hardDrop();
      }
    },
    [controls],
  );

  // Re-focus the wrapper on mount so keyboard works immediately when the window
  // gains focus.
  useEffect(() => {
    wrapperRef.current?.focus();
  }, []);

  return (
    <div
      ref={wrapperRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="relative w-full h-full flex items-center justify-center bg-surface outline-none select-none"
      style={{ touchAction: "none" }}
    >
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="block"
        style={{ touchAction: "none" }}
      />

      {state.gameOver && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ background: "rgba(11,13,18,0.78)" }}
        >
          <div className="rounded-md border border-border bg-elevated p-5 text-center shadow-window min-w-[200px]">
            <div className="font-mono text-lg text-fg">Game Over</div>
            <div className="mt-1 font-mono text-sm text-muted">
              Score {state.score} - Lines {state.lines}
            </div>
            <button
              type="button"
              onClick={() => {
                controls.restart();
                wrapperRef.current?.focus();
              }}
              className="mt-4 rounded-sm border border-border bg-surface px-4 py-2 font-mono text-sm text-fg hover:bg-bg focus:outline-none focus:ring-1 focus:ring-accent"
            >
              Play again
            </button>
          </div>
        </div>
      )}

      {state.paused && !state.gameOver && (
        <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-sm bg-bg/70 px-2 py-1 font-mono text-xs text-muted">
          Press P to resume
        </div>
      )}
    </div>
  );
}
