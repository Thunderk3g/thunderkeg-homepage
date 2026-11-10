'use client';

import { useEffect, useState } from 'react';
import type { Entry } from '@/content/writing';

/**
 * One shared fetch of /api/content (prerendered at build time) for every
 * client surface that wants the published posts and paper notes: the Stacks
 * wallpaper, the command palette, the Today card.
 */
let cache: Entry[] | null = null;
let pending: Promise<Entry[]> | null = null;

export function loadEntries(): Promise<Entry[]> {
  if (cache) return Promise.resolve(cache);
  pending ??= fetch('/api/content')
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then((d: { entries: Entry[] }) => (cache = d.entries ?? []))
    .catch(() => {
      pending = null; // offline: try again on the next mount
      return [];
    });
  return pending;
}

export function useEntries(): Entry[] {
  const [entries, setEntries] = useState<Entry[]>(cache ?? []);
  useEffect(() => {
    let alive = true;
    void loadEntries().then((e) => alive && setEntries(e));
    return () => {
      alive = false;
    };
  }, []);
  return entries;
}
