'use client';

import { create } from 'zustand';
import { isPhone } from '../desktop/layout';

/**
 * Teardown: the running desktop tilted and pulled apart into its layers.
 * This store is only the switch and the selection; the camera lives in
 * Teardown.tsx and never causes a React render.
 */
interface TeardownStore {
  on: boolean;
  /** reassembling: the layers are closing up before `on` drops */
  closing: boolean;
  /** the part under the pointer (in the list or in the scene) */
  hovered: string | null;
  /** the part held by a click or the keyboard */
  pinned: string | null;
  /** how far apart the layers stand, 1 = fitted to the screen */
  spread: number;
  /** a window to focus once the desktop is back together */
  focusAfter: string | null;
  open: () => void;
  /** start reassembling; `focusId` is a window to bring forward afterwards */
  close: (focusId?: string) => void;
  toggle: () => void;
  /** called by the camera once the layers have closed up */
  finish: () => void;
  hover: (id: string | null) => void;
  pin: (id: string | null) => void;
  setSpread: (v: number) => void;
}

export const SPREAD_MIN = 0.55;
export const SPREAD_MAX = 2.4;

export const useTeardown = create<TeardownStore>((set, get) => ({
  on: false,
  closing: false,
  hovered: null,
  pinned: null,
  spread: 1,
  focusAfter: null,
  open: () => {
    // a phone has no room for the parts list, and nothing to hover with
    if (isPhone() || get().on) return;
    set({ on: true, closing: false, hovered: null, pinned: null, spread: 1, focusAfter: null });
  },
  close: (focusId) => get().on && set({ closing: true, hovered: null, focusAfter: focusId ?? null }),
  toggle: () => (get().on ? get().close() : get().open()),
  finish: () => set({ on: false, closing: false, hovered: null, pinned: null }),
  hover: (id) => get().hovered !== id && set({ hovered: id }),
  pin: (id) => set({ pinned: id }),
  setSpread: (v) => set({ spread: Math.max(SPREAD_MIN, Math.min(SPREAD_MAX, v)) }),
}));
