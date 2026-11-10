'use client';

import { useEffect, useMemo, useState } from 'react';
import { create } from 'zustand';
import type { Entry } from '@/content/writing';
import { loadEntries } from '@/os/content';
import { useResearch, useResearchHydrated } from '@/research/store';
import { buildBoard, type Board } from './model';

/**
 * The board, live: the curated record plus whatever the Research library and
 * /content hold right now. `ready` is false until both have loaded, so the
 * first thing drawn is the whole record and nothing has to be re-sorted.
 *
 * Pass `entries` when the caller already has them (the /stacks page renders on
 * the server with the posts and notes in hand).
 */
export function useBoard(given?: Entry[]): { board: Board; ready: boolean } {
  const hydrated = useResearchHydrated();
  const storePapers = useResearch((s) => s.papers);
  const storeCards = useResearch((s) => s.cards);
  const rqs = useResearch((s) => s.rqs);
  const [fetched, setFetched] = useState<Entry[] | null>(null);

  useEffect(() => {
    if (given) return;
    let alive = true;
    void loadEntries().then((e) => alive && setFetched(e));
    return () => {
      alive = false;
    };
  }, [given]);

  const entries = given ?? fetched;
  // the library is only read after rehydration, so server and first client render agree
  const papers = hydrated ? storePapers : EMPTY_PAPERS;
  const cards = hydrated ? storeCards : EMPTY_CARDS;
  const board = useMemo(
    () => buildBoard({ entries: entries ?? [], papers, cards, rqs }),
    [entries, papers, cards, rqs],
  );
  return { board, ready: hydrated && entries !== null };
}

const EMPTY_PAPERS: never[] = [];
const EMPTY_CARDS: never[] = [];

/**
 * What the board is showing: now, or the record as it stood at the end of a
 * year. The timeline under the board sets it; the canvas reads it.
 */
interface StacksView {
  /** null = now */
  asOf: number | null;
  /** a year held by a click, as opposed to one being hovered */
  pinned: number | null;
  playing: boolean;
  hover: (year: number | null) => void;
  pin: (year: number | null) => void;
  setPlaying: (on: boolean) => void;
  show: (year: number | null) => void;
}

export const useStacksView = create<StacksView>((set, get) => ({
  asOf: null,
  pinned: null,
  playing: false,
  hover: (year) => !get().playing && set({ asOf: year ?? get().pinned }),
  pin: (year) => set({ pinned: year, asOf: year, playing: false }),
  setPlaying: (on) => set(on ? { playing: true, pinned: null } : { playing: false, asOf: null }),
  show: (year) => set({ asOf: year }),
}));
