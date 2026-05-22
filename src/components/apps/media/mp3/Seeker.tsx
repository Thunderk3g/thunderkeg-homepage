"use client";

import { useCallback } from "react";

export interface SeekerProps {
  /** current playback position, in seconds */
  value: number;
  /** total track duration, in seconds (may be 0 before metadata loads) */
  max: number;
  /** called continuously while the user drags */
  onSeek: (seconds: number) => void;
  /** optional disabled flag — usually when duration is unknown */
  disabled?: boolean;
}

/**
 * Seeker — touch-friendly progress bar.
 *
 * Uses a native <input type="range"> with `touch-action: none` so the browser
 * doesn't interpret drags as scrolls. We listen to both `onChange` (covers
 * keyboard + mouse + tap) and `onPointerMove` while the pointer is down
 * (covers smooth touch dragging on iOS Safari).
 */
export function Seeker({ value, max, onSeek, disabled }: SeekerProps) {
  const safeMax = Number.isFinite(max) && max > 0 ? max : 0;
  const safeVal = Math.max(0, Math.min(value, safeMax));
  const pct = safeMax > 0 ? (safeVal / safeMax) * 100 : 0;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onSeek(Number(e.target.value));
    },
    [onSeek],
  );

  // While dragging on touch, derive the seek position from the pointer's X
  // coordinate against the input's bounding box. This works even when the
  // native range thumb hasn't fired a change event yet.
  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLInputElement>) => {
      if (e.buttons === 0 && e.pointerType !== "touch") return;
      if (safeMax <= 0) return;
      const target = e.currentTarget;
      const rect = target.getBoundingClientRect();
      if (rect.width <= 0) return;
      const ratio = (e.clientX - rect.left) / rect.width;
      const clamped = Math.max(0, Math.min(1, ratio));
      onSeek(clamped * safeMax);
    },
    [onSeek, safeMax],
  );

  return (
    <div className="relative w-full">
      {/* Visual track + filled portion underneath the native input */}
      <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2">
        <div className="h-1.5 w-full rounded-full bg-border">
          <div
            className="h-1.5 rounded-full bg-accent transition-[width] duration-75"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <input
        type="range"
        min={0}
        max={safeMax || 1}
        step={0.01}
        value={safeVal}
        onChange={handleChange}
        onPointerMove={handlePointerMove}
        disabled={disabled || safeMax <= 0}
        aria-label="Seek"
        className="relative z-10 h-6 w-full cursor-pointer appearance-none bg-transparent accent-accent disabled:cursor-not-allowed"
        style={{ touchAction: "none" }}
      />
    </div>
  );
}
