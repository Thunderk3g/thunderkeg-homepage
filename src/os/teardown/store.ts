'use client';

import { create } from 'zustand';
import { isPhone } from '../desktop/layout';
import type { Lens } from './anatomy';

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
  /** the part held by the keyboard or the list: selected, but still in the stack */
  pinned: string | null;
  /** the part whose own screen is showing: the rest of the stack has stepped away */
  opened: string | null;
  /** the component of the opened part being pointed at, by its place in the list */
  piece: number | null;
  /** how far apart the layers stand, 1 = fitted to the screen */
  spread: number;
  /** a window to focus once the desktop is back together */
  focusAfter: string | null;
  /** which reading of the stack is showing: Kali, this site, or an LLM system */
  lens: Lens;
  setLens: (lens: Lens) => void;
  open: () => void;
  /** start reassembling; `focusId` is a window to bring forward afterwards */
  close: (focusId?: string) => void;
  toggle: () => void;
  /** called by the camera once the layers have closed up */
  finish: () => void;
  hover: (id: string | null) => void;
  pin: (id: string | null) => void;
  /** open a part's own screen */
  enter: (id: string) => void;
  /** back to the stack */
  leave: () => void;
  setPiece: (i: number | null) => void;
  setSpread: (v: number) => void;
}

export const SPREAD_MIN = 0.55;
// past this the plates shrink to thumbnails that cannot be read
export const SPREAD_MAX = 1.8;

export const useTeardown = create<TeardownStore>((set, get) => ({
  on: false,
  closing: false,
  hovered: null,
  pinned: null,
  opened: null,
  piece: null,
  spread: 1,
  focusAfter: null,
  // the lens is kept between visits: it is how you chose to read the desktop
  lens: 'kali',
  setLens: (lens) => set({ lens }),
  open: () => {
    // a phone has no room for the parts list, and nothing to hover with
    if (isPhone() || get().on) return;
    set({ on: true, closing: false, hovered: null, pinned: null, opened: null, piece: null, spread: 1, focusAfter: null });
  },
  close: (focusId) => get().on && set({ closing: true, hovered: null, piece: null, focusAfter: focusId ?? null }),
  toggle: () => (get().on ? get().close() : get().open()),
  finish: () => set({ on: false, closing: false, hovered: null, pinned: null, opened: null, piece: null }),
  hover: (id) => get().hovered !== id && set({ hovered: id }),
  pin: (id) => set({ pinned: id }),
  enter: (id) => set({ opened: id, pinned: id, hovered: null, piece: null }),
  // the part that was open stays selected, so the stack shows where you were
  leave: () => set({ opened: null, hovered: null, piece: null }),
  setPiece: (i) => get().piece !== i && set({ piece: i }),
  setSpread: (v) => set({ spread: Math.max(SPREAD_MIN, Math.min(SPREAD_MAX, v)) }),
}));
