"use client";

import { create } from "zustand";

/**
 * Render quality tier + WebGL resilience.
 *
 * Why this exists: on some GPUs/drivers (e.g. Intel iGPU with the Chrome/ANGLE
 * `exit_on_context_lost` + `loseContextOnOutOfMemory` workarounds) a WebGL
 * context loss makes the GPU process EXIT — it cannot be restored in-session.
 * So the strategy is PREVENTION, not recovery: render within the GPU's memory
 * budget, and if a loss still happens, remember a lower tier so the *next* load
 * starts lighter instead of crashing again.
 *
 * Tiers (heaviest → lightest):
 *   high   — everything, incl. the full-res post-processing stack (bloom etc.).
 *            The post stack's HDR buffers are the biggest memory consumer and
 *            the usual cause of OOM context loss; opt-in only.
 *   medium — the full scene MINUS post-processing: shadows, image-based
 *            lighting, sky, clouds. Pretty and safe on capable integrated GPUs.
 *            This is the DEFAULT.
 *   lite   — bare scene: no shadows, no IBL, no clouds, no post. Guaranteed to
 *            render even on a CPU rasterizer; the final safety net.
 */
export type QualityTier = "high" | "medium" | "lite";

export interface QualitySettings {
  tier: QualityTier;
  /** Device pixel ratio (clamped). */
  dpr: number | [number, number];
  /** Sun shadow map. */
  shadows: boolean;
  /** Image-based lighting via the drei <Environment> cubemap. */
  ibl: boolean;
  /** Volumetric <Clouds> + <Sparkles>. */
  clouds: boolean;
  /** Full-res <EffectComposer> post stack (bloom/vignette/tonemap/SMAA). */
  postfx: boolean;
}

export function settingsFor(tier: QualityTier): QualitySettings {
  switch (tier) {
    case "high":
      return { tier, dpr: [1, 1.5], shadows: true, ibl: true, clouds: true, postfx: true };
    case "medium":
      return { tier, dpr: [1, 1.5], shadows: true, ibl: true, clouds: true, postfx: false };
    case "lite":
    default:
      return { tier, dpr: 1, shadows: false, ibl: false, clouds: false, postfx: false };
  }
}

const STORAGE_KEY = "pf-quality";
const NEXT_DOWN: Record<QualityTier, QualityTier | null> = {
  high: "medium",
  medium: "lite",
  lite: null,
};

function isTier(v: string | null): v is QualityTier {
  return v === "high" || v === "medium" || v === "lite";
}

/**
 * Seed the starting tier. Precedence:
 *   1. `?q=high|medium|lite` URL override (also pinned to localStorage)
 *   2. a tier remembered from a previous session / downgrade
 *   3. default `medium`
 */
function initialTier(): QualityTier {
  if (typeof window === "undefined") return "medium";
  const q = new URLSearchParams(window.location.search).get("q");
  if (isTier(q)) {
    try {
      window.localStorage.setItem(STORAGE_KEY, q);
    } catch {}
    return q;
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isTier(stored)) return stored;
  } catch {}
  return "medium";
}

interface QualityState {
  tier: QualityTier;
  /** True once the lowest tier also lost its context — show a DOM fallback. */
  failed: boolean;
  /** Call from the canvas `webglcontextlost` handler. Steps down one tier. */
  onContextLost: () => void;
}

export const useQuality = create<QualityState>((set, get) => ({
  tier: initialTier(),
  failed: false,
  onContextLost: () => {
    const { tier } = get();
    const next = NEXT_DOWN[tier];
    if (next) {
      console.warn(`[quality] WebGL context lost on "${tier}" → dropping to "${next}"`);
      // Remember it so the next load on this machine starts lower, no re-crash.
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {}
      set({ tier: next });
    } else {
      console.warn(`[quality] WebGL context lost on "${tier}" → showing fallback`);
      set({ failed: true });
    }
  },
}));
