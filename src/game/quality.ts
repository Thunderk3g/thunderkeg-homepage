"use client";

import { create } from "zustand";

/**
 * Render quality tier + WebGL resilience.
 *
 * The world can be too heavy for modest / integrated GPUs: a single overweight
 * first frame (large shadow map + cubemap + full-res post stack) can exceed the
 * OS GPU watchdog (TDR on Windows) and the browser drops the WebGL context,
 * leaving a permanently blank canvas.
 *
 * To survive that, we render at a tier and step DOWN on `webglcontextlost`:
 *   high → lite → failed (DOM fallback)
 * Each step-down remounts a fresh <Canvas> (keyed by tier) at lighter settings,
 * so a transient loss becomes a graceful degrade instead of a dead page.
 */
export type QualityTier = "high" | "lite";

/**
 * Seed the starting tier. Honors a `?q=lite` URL escape hatch so anyone on a
 * weak machine can force the light path without waiting for an auto-downgrade.
 */
function initialTier(): QualityTier {
  if (typeof window !== "undefined") {
    if (new URLSearchParams(window.location.search).get("q") === "lite") {
      return "lite";
    }
  }
  return "high";
}

interface QualityState {
  tier: QualityTier;
  /** True once even the lite tier failed — show a DOM fallback instead. */
  failed: boolean;
  /** Call from the canvas `webglcontextlost` handler. Steps down one level. */
  onContextLost: () => void;
}

export const useQuality = create<QualityState>((set, get) => ({
  tier: initialTier(),
  failed: false,
  onContextLost: () => {
    const { tier } = get();
    if (tier === "high") set({ tier: "lite" });
    else set({ failed: true });
  },
}));
