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

const STORAGE_KEY = "pf-quality";

/**
 * Seed the starting tier. Order of precedence:
 *   1. `?q=lite` / `?q=high` URL override (high also clears a remembered downgrade)
 *   2. a downgrade remembered from a previous crash (localStorage) — so a weak
 *      machine starts light instead of crashing on every single load
 *   3. default `high`
 */
function initialTier(): QualityTier {
  if (typeof window === "undefined") return "high";
  const q = new URLSearchParams(window.location.search).get("q");
  if (q === "lite") {
    // Persist so plain reloads stay light too, no param needed.
    try {
      window.localStorage.setItem(STORAGE_KEY, "lite");
    } catch {}
    return "lite";
  }
  if (q === "high") {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {}
    return "high";
  }
  try {
    if (window.localStorage.getItem(STORAGE_KEY) === "lite") return "lite";
  } catch {}
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
    if (tier === "high") {
      console.warn("[quality] WebGL context lost on high tier → dropping to lite");
      // Remember it so future loads on this machine start light, no re-crash.
      try {
        window.localStorage.setItem(STORAGE_KEY, "lite");
      } catch {}
      set({ tier: "lite" });
    } else {
      console.warn("[quality] WebGL context lost on lite tier → showing fallback");
      set({ failed: true });
    }
  },
}));
