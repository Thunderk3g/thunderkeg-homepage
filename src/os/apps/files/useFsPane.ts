'use client';

import { useCallback, useMemo, useReducer, useState } from 'react';
import type { FileSystem } from '../../fs/filesystem';

/** A back/forward navigation history for one pane. */
export interface NavState {
  stack: string[];
  index: number;
}

export type ViewMode = 'icons' | 'compact' | 'details';
export type SortKey = 'name' | 'size' | 'modified' | 'type';

export interface Entry {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  /** stable fake mtime (ms) derived from path + content length */
  mtime: number;
  mode: string;
}

function join(dir: string, name: string): string {
  return (dir.endsWith('/') ? dir : dir + '/') + name;
}

/** A deterministic "modified" time so the column is stable across renders. */
function stableMtime(path: string, size: number): number {
  let h = 2166136261;
  const s = path + ':' + size;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  h >>>= 0;
  // spread across the last ~2 years, ending a few days ago
  const end = Date.UTC(2025, 9, 1);
  return end - (h % (720 * 86400 * 1000));
}

export function entriesOf(fs: FileSystem, cwd: string): Entry[] {
  const names = fs.list(cwd) ?? [];
  return names.map((name) => {
    const path = join(cwd, name);
    const node = fs.get(path);
    const isDir = node?.type === 'dir';
    const size = isDir ? (node?.children ? Object.keys(node.children).length : 0) : (node?.content?.length ?? 0);
    return {
      name,
      path,
      isDir,
      size,
      mtime: stableMtime(path, size),
      mode: node?.mode ?? (isDir ? 'rwxr-xr-x' : 'rw-r--r--'),
    };
  });
}

export function sortEntries(entries: Entry[], key: SortKey, asc: boolean): Entry[] {
  const dir = asc ? 1 : -1;
  const typeOf = (e: Entry) => (e.isDir ? '' : (/\.[^.]+$/.exec(e.name)?.[0] ?? ''));
  const sorted = [...entries].sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1; // folders first, always
    switch (key) {
      case 'size':
        return (a.size - b.size) * dir;
      case 'modified':
        return (a.mtime - b.mtime) * dir;
      case 'type':
        return (typeOf(a).localeCompare(typeOf(b)) || a.name.localeCompare(b.name)) * dir;
      default:
        return a.name.localeCompare(b.name) * dir;
    }
  });
  return sorted;
}

type NavAction =
  | { type: 'go'; path: string }
  | { type: 'back' }
  | { type: 'forward' }
  | { type: 'replace'; path: string };

function navReducer(s: NavState, a: NavAction): NavState {
  switch (a.type) {
    case 'go': {
      if (s.stack[s.index] === a.path) return s;
      const stack = s.stack.slice(0, s.index + 1);
      stack.push(a.path);
      return { stack, index: stack.length - 1 };
    }
    case 'replace': {
      const stack = s.stack.slice();
      stack[s.index] = a.path;
      return { stack, index: s.index };
    }
    case 'back':
      return s.index > 0 ? { ...s, index: s.index - 1 } : s;
    case 'forward':
      return s.index < s.stack.length - 1 ? { ...s, index: s.index + 1 } : s;
  }
}

/** Per-pane navigation + view/selection state. */
export function usePane(initial: string) {
  const [nav, dispatch] = useReducer(navReducer, { stack: [initial], index: 0 });
  const [view, setView] = useState<ViewMode>('icons');
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: 'name', asc: true });
  const [selection, setSelection] = useState<string[]>([]);
  const [filter, setFilter] = useState('');
  const [zoom, setZoom] = useState(64);
  const [anchor, setAnchor] = useState<string | null>(null);

  const cwd = nav.stack[nav.index];
  const canBack = nav.index > 0;
  const canForward = nav.index < nav.stack.length - 1;

  const go = useCallback((path: string) => {
    dispatch({ type: 'go', path });
    setSelection([]);
    setAnchor(null);
    setFilter('');
  }, []);

  const sortBy = useCallback((key: SortKey) => {
    setSort((s) => (s.key === key ? { key, asc: !s.asc } : { key, asc: true }));
  }, []);

  return {
    nav,
    cwd,
    canBack,
    canForward,
    back: () => {
      dispatch({ type: 'back' });
      setSelection([]);
    },
    forward: () => {
      dispatch({ type: 'forward' });
      setSelection([]);
    },
    go,
    replace: (p: string) => dispatch({ type: 'replace', path: p }),
    view,
    setView,
    sort,
    sortBy,
    selection,
    setSelection,
    anchor,
    setAnchor,
    filter,
    setFilter,
    zoom,
    setZoom,
  };
}

export type Pane = ReturnType<typeof usePane>;

/** Human size: items for dirs, bytes/KiB for files. */
export function sizeText(e: Entry): string {
  if (e.isDir) return `${e.size} item${e.size === 1 ? '' : 's'}`;
  if (e.size < 1024) return `${e.size} B`;
  if (e.size < 1024 * 1024) return `${(e.size / 1024).toFixed(1)} KiB`;
  return `${(e.size / 1024 / 1024).toFixed(1)} MiB`;
}

export function modifiedText(mtime: number): string {
  return new Date(mtime).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function useVisibleEntries(fs: FileSystem, pane: Pane, fsVersion: number): Entry[] {
  return useMemo(() => {
    const all = entriesOf(fs, pane.cwd);
    const f = pane.filter.trim().toLowerCase();
    const filtered = f ? all.filter((e) => e.name.toLowerCase().includes(f)) : all;
    return sortEntries(filtered, pane.sort.key, pane.sort.asc);
    // fsVersion forces recompute after mutations to the mutable FileSystem
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fs, pane.cwd, pane.filter, pane.sort.key, pane.sort.asc, fsVersion]);
}
