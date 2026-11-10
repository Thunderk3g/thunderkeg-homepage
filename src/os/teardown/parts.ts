'use client';

import { useEffect, useMemo, useState } from 'react';
import { useOS, WORKSPACE_COUNT } from '../store';
import { getApp } from '../registry';
import { desktopApps } from '../registry';
import { WALLPAPERS, stacksOn, wallpaperFor } from '../desktop/wallpapers';
import { panelHeight } from '../desktop/layout';
import { GUEST } from '../apps/vm/guest';
import type { FsNode } from '../types';
import { SUBJECTS } from '@/data/record';
import { useBoard } from '@/stacks/useBoard';
import { LAYERS, windowAnatomy, type Anatomy, type LayerKind } from './anatomy';
import type { Rect } from './camera';
import { useTeardown } from './store';

/**
 * The desktop as a parts list, top to bottom.
 *
 * Above the wallpaper are the layers anyone can see: the panel, each window,
 * the icons, the Stacks board, the wallpaper. Below it are the layers that
 * hold those up, drawn from the same live state the desktop runs on: the
 * display, the session, the file system, the kernel, the hardware.
 *
 * Every part carries three readings of itself (anatomy.ts): what it is on a
 * real Kali machine, what it actually is here, and what it corresponds to in
 * an LLM system. It also knows which other parts it depends on, and which
 * subjects of the Stacks record show my work at that layer.
 */

export type PartKind = LayerKind;

export interface Part {
  id: string;
  kind: PartKind;
  /** 'surface' is what you can see; 'under' is what holds it up */
  group: 'surface' | 'under';
  /** the plain name in the parts list */
  name: string;
  /** the app in the window, for window parts */
  appId?: string;
  /** the three readings: Kali, this site, an LLM system */
  anatomy: Anatomy;
  /** live figures, read from this tab right now */
  facts: [string, string][];
  /** other parts on the board this one depends on */
  links: { id: string; how: string }[];
  /** Stacks subjects that show my work at this layer */
  work: { id: string; name: string; cubes: number }[];
  /** where it sits on its layer, in desktop px: leader lines aim at it */
  rect: Rect;
  /** what the pointer can hit, when that is less than the whole rect */
  hits?: Rect[];
  /** the live element on the desktop that is this part, if there is one */
  selector?: string;
  /** drawn as a plate by Plates.tsx: glass for a see-through layer, solid under the wallpaper */
  plate: 'glass' | 'solid' | null;
  /** how far below the part above it this one hangs, in gaps */
  drop: number;
  action?: { label: string; run: () => void };
}

/* ───────────────────────── what is underneath ───────────────────────── */

export interface Proc {
  id: string;
  name: string;
  note: string;
  state: 'daemon' | 'focused' | 'running' | 'minimized' | 'elsewhere';
}

export interface DirStat {
  name: string;
  files: number;
  bytes: number;
}

export interface Under {
  display: { w: number; h: number; dpr: number; depth: number; hz: number | null; reduced: boolean; scheme: string };
  procs: Proc[];
  fs: { files: number; dirs: number; bytes: number; top: DirStat[] };
  storage: { keys: { key: string; bytes: number }[]; bytes: number; ok: boolean };
  kernel: { guest: string; guestMB: number; vmOpen: boolean; psqlOpen: boolean; heapMB: number | null; lagMs: number; routes: number };
  hardware: { cores: number | null; memoryGB: number | null; platform: string };
}

/** The server routes the desktop calls out through: its network stack. */
export const ROUTES = ['/api/chat', '/api/research', '/api/news', '/api/music', '/api/hire', '/api/vm/proxy', '/api/content'];

function walk(node: FsNode): { files: number; dirs: number; bytes: number } {
  if (node.type !== 'dir') return { files: 1, dirs: 0, bytes: (node.content ?? '').length };
  let files = 0;
  let dirs = 1;
  let bytes = 0;
  for (const child of Object.values(node.children ?? {})) {
    const s = walk(child);
    files += s.files;
    dirs += s.dirs;
    bytes += s.bytes;
  }
  return { files, dirs, bytes };
}

function fsStats(root: FsNode): Under['fs'] {
  const all = walk(root);
  const home = root.children?.home?.children?.kali ?? root;
  const top: DirStat[] = [];
  let loose = { files: 0, bytes: 0 };
  for (const [name, child] of Object.entries(home.children ?? {})) {
    const s = walk(child);
    if (child.type === 'dir') top.push({ name, files: s.files, bytes: s.bytes });
    else loose = { files: loose.files + 1, bytes: loose.bytes + s.bytes };
  }
  if (loose.files) top.push({ name: 'dotfiles', files: loose.files, bytes: loose.bytes });
  top.sort((a, b) => b.bytes - a.bytes);
  return { files: all.files, dirs: all.dirs - 1, bytes: all.bytes, top };
}

function readStorage(): Under['storage'] {
  try {
    const keys: { key: string; bytes: number }[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key === null) continue;
      // JavaScript strings are UTF-16: two bytes a character is what the quota counts
      keys.push({ key, bytes: (key.length + (window.localStorage.getItem(key) ?? '').length) * 2 });
    }
    keys.sort((a, b) => b.bytes - a.bytes);
    return { keys, bytes: keys.reduce((n, k) => n + k.bytes, 0), ok: true };
  } catch {
    return { keys: [], bytes: 0, ok: false }; // storage blocked or private mode
  }
}

const RATES = [30, 48, 50, 60, 72, 75, 90, 100, 120, 144, 165, 240];

/** The display's refresh rate, timed over a short run of frames and snapped to the nearest real one. */
function useRefreshRate(): number | null {
  const [hz, setHz] = useState<number | null>(null);
  useEffect(() => {
    let raf = 0;
    const stamps: number[] = [];
    const frame = (t: number) => {
      stamps.push(t);
      if (stamps.length < 40) {
        raf = requestAnimationFrame(frame);
        return;
      }
      const gaps = stamps.slice(1).map((s, i) => s - stamps[i]).sort((a, b) => a - b);
      const median = gaps[Math.floor(gaps.length / 2)];
      if (median > 0) {
        const raw = 1000 / median;
        setHz(RATES.reduce((best, r) => (Math.abs(r - raw) < Math.abs(best - raw) ? r : best), RATES[0]));
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);
  return hz;
}

export const kb = (bytes: number) =>
  bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1048576).toFixed(1)} MB`;

const since = (ms: number) => {
  const m = Math.floor(ms / 60000);
  return m < 1 ? 'under a minute' : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
};

/* ───────────────────────── the list ───────────────────────── */

export function useTeardownModel(): { parts: Part[]; under: Under; W: number; H: number } {
  const windows = useOS((s) => s.windows);
  const focusedId = useOS((s) => s.focusedId);
  const activeWs = useOS((s) => s.activeWorkspace);
  const settings = useOS((s) => s.settings);
  const fs = useOS((s) => s.fs);
  const fsVersion = useOS((s) => s.fsVersion);
  const user = useOS((s) => s.user);
  const launch = useOS((s) => s.launch);
  const close = useTeardown((s) => s.close);
  const { board } = useBoard();
  const hz = useRefreshRate();

  // the clock, the heap and the viewport move while the desktop is apart;
  // how late each tick arrives is the event loop's lag, the load of this "kernel"
  const [tick, setTick] = useState({ n: 0, lag: 0 });
  useEffect(() => {
    let due = performance.now() + 1000;
    const id = window.setInterval(() => {
      const now = performance.now();
      const lag = Math.max(0, now - due);
      due = now + 1000;
      setTick((t) => ({ n: t.n + 1, lag }));
    }, 1000);
    const onResize = () => setTick((t) => ({ ...t, n: t.n + 1 }));
    window.addEventListener('resize', onResize);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const fsInfo = useMemo(() => fsStats(fs.root), [fs, fsVersion]);
  // storage only changes when something saves; once a second is plenty
  const storage = useMemo(readStorage, [tick.n]);

  return useMemo(() => {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const full: Rect = { x: 0, y: 0, w: W, h: H };
    const ph = panelHeight(false);
    const reassembleThen = (fn: () => void) => () => {
      close();
      // let the layers close up before something new opens over them
      window.setTimeout(fn, 620);
    };

    const open = windows.filter((w) => !w.closing);
    const live = open.filter((w) => !w.minimized && (w.workspace ?? 0) === activeWs).sort((a, b) => b.z - a.z);
    const focused = windows.find((w) => w.id === focusedId);
    const wallpaper = wallpaperFor(settings);
    const wallName = WALLPAPERS.find((w) => w.id === wallpaper)?.label ?? wallpaper;
    const boardOn = stacksOn(settings);
    const clock = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: !settings.clock24 });

    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    const nav = navigator as Navigator & { deviceMemory?: number; userAgentData?: { platform?: string } };
    const under: Under = {
      display: {
        w: W,
        h: H,
        dpr: Math.round((window.devicePixelRatio || 1) * 100) / 100,
        depth: window.screen?.colorDepth ?? 24,
        hz,
        reduced: settings.reducedMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        scheme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
      },
      procs: [
        { id: 'session', name: 'xfce4-session', note: 'the store', state: 'daemon' },
        { id: 'xfwm4', name: 'xfwm4', note: `${open.length} window${open.length === 1 ? '' : 's'}`, state: 'daemon' },
        { id: 'panel', name: 'xfce4-panel', note: 'top bar', state: 'daemon' },
        { id: 'xfdesktop', name: 'xfdesktop', note: 'wallpaper, icons', state: 'daemon' },
        { id: 'notifyd', name: 'xfce4-notifyd', note: 'toasts', state: 'daemon' },
        ...open.map<Proc>((w) => ({
          id: w.id,
          name: getApp(w.appId)?.title ?? w.title,
          note: w.id,
          state: (w.workspace ?? 0) !== activeWs ? 'elsewhere' : w.minimized ? 'minimized' : w.id === focusedId ? 'focused' : 'running',
        })),
      ],
      fs: fsInfo,
      storage,
      kernel: {
        guest: GUEST.kernel,
        guestMB: GUEST.memoryMB,
        vmOpen: open.some((w) => w.appId === 'vm'),
        psqlOpen: open.some((w) => w.appId === 'psql'),
        heapMB: mem ? Math.round(mem.usedJSHeapSize / 1048576) : null,
        lagMs: Math.round(tick.lag),
        routes: ROUTES.length,
      },
      hardware: {
        cores: navigator.hardwareConcurrency || null,
        memoryGB: nav.deviceMemory ?? null,
        platform: nav.userAgentData?.platform || navigator.platform || 'unknown',
      },
    };

    /** the Stacks subjects behind a layer, with how much is on each */
    const workOf = (ids: string[]) =>
      ids.flatMap((id) => {
        const subject = SUBJECTS.find((s) => s.id === id);
        if (!subject) return [];
        return [{ id, name: subject.name, cubes: board.stacks.find((s) => s.subject.id === id)?.cubes.length ?? 0 }];
      });

    type Draft = Omit<Part, 'links' | 'work' | 'anatomy'> & { anatomy?: Anatomy };
    const drafts: Draft[] = [];

    drafts.push({
      id: 'panel',
      kind: 'panel',
      group: 'surface',
      name: 'Panel',
      facts: [
        ['Height', `${ph} px`],
        ['Clock', clock],
        ['Workspace', `${activeWs + 1} of ${WORKSPACE_COUNT}`],
        ['Task buttons', String(open.length)],
      ],
      rect: { x: 0, y: 0, w: W, h: ph },
      selector: '.kos-panel',
      plate: 'glass',
      drop: 0,
    });

    if (live.length) {
      // a tall pile of windows is squeezed so it never crowds out the rest
      const each = live.length > 3 ? 3 / live.length : 1;
      for (const w of live) {
        const app = getApp(w.appId);
        const tiled = w.maximized ? 'maximised' : w.snapped ? `tiled ${w.snapped}` : 'floating';
        const r: Rect = w.maximized
          ? { x: 0, y: ph, w: W, h: H - ph }
          : w.snapped
            ? { x: w.snapped === 'left' ? 0 : Math.round(W / 2), y: ph, w: Math.round(W / 2), h: H - ph }
            : { x: w.x, y: w.y, w: w.width, h: w.height };
        drafts.push({
          id: w.id,
          kind: 'window',
          group: 'surface',
          name: app?.title ?? w.title,
          appId: w.appId,
          anatomy: windowAnatomy(w.appId),
          facts: [
            ['Window', w.id],
            ['Position', `${r.x}, ${r.y}`],
            ['Size', `${r.w} × ${r.h}`],
            ['State', (w.id === focusedId ? 'focused, ' : '') + tiled],
            ['Stacking order', `${live.indexOf(w) + 1} of ${live.length} from the top`],
          ],
          rect: r,
          selector: `[data-window-id="${w.id}"]`,
          plate: null,
          drop: each,
          action: { label: 'Reassemble and open it', run: () => close(w.id) },
        });
      }
    } else {
      drafts.push({
        id: 'nowindows',
        kind: 'nowindows',
        group: 'surface',
        name: 'Windows',
        facts: [
          ['Open here', '0'],
          ['On other workspaces', String(open.filter((w) => (w.workspace ?? 0) !== activeWs).length)],
          ['Minimised', String(open.filter((w) => w.minimized).length)],
        ],
        rect: full,
        hits: [],
        plate: 'glass',
        drop: 1,
        action: { label: 'Reassemble and open a terminal', run: reassembleThen(() => launch('terminal')) },
      });
    }

    drafts.push({
      id: 'desk',
      kind: 'desk',
      group: 'surface',
      name: 'Icons and card',
      facts: [
        ['Launchers', String(desktopApps.length)],
        ['Signed in as', user],
        ['Introduction card', live.length ? 'stepped aside for the windows' : 'showing'],
      ],
      rect: full,
      hits: [
        { x: 0, y: ph, w: 180, h: H - ph },
        { x: W - 380, y: H - 520, w: 380, h: 520 },
      ],
      selector: '.kos-desktop-surface',
      plate: 'glass',
      drop: 1,
    });

    if (boardOn) {
      drafts.push({
        id: 'board',
        kind: 'board',
        group: 'surface',
        name: 'Stacks board',
        facts: [
          ['Cubes', String(board.totals.cubes)],
          ['Stacks', String(board.totals.subjects)],
          ['Lanes', String(board.totals.fields)],
          ['Papers queued', String(board.totals.queued)],
        ],
        rect: full,
        hits: [],
        selector: '.kos-stacks',
        plate: 'glass',
        drop: 1,
        action: { label: 'Reassemble and open Stacks', run: reassembleThen(() => launch('stacks')) },
      });
    }

    drafts.push({
      id: 'wall',
      kind: 'wall',
      group: 'surface',
      name: 'Wallpaper',
      facts: [
        ['Wallpaper', wallName],
        ['Theme', settings.theme],
        ['Accent', settings.accent],
      ],
      rect: full,
      selector: '.kos-wall',
      plate: 'glass',
      drop: 1,
      action: { label: 'Reassemble and change it', run: reassembleThen(() => launch('settings', { page: 'wallpaper' })) },
    });

    /* ── under the wallpaper ── */

    drafts.push({
      id: 'display',
      kind: 'display',
      group: 'under',
      name: 'Display',
      facts: [
        ['Viewport', `${W} × ${H} px`],
        ['Device pixels', `${Math.round(W * under.display.dpr)} × ${Math.round(H * under.display.dpr)} (${under.display.dpr}×)`],
        ['Refresh', under.display.hz ? `about ${under.display.hz} Hz, timed just now` : 'timing…'],
        ['Colour depth', `${under.display.depth}-bit`],
        ['Motion', under.display.reduced ? 'reduced' : 'full'],
      ],
      rect: full,
      plate: 'solid',
      drop: 1.9,
      action: { label: 'Reassemble and open display settings', run: reassembleThen(() => launch('settings', { page: 'appearance' })) },
    });

    drafts.push({
      id: 'session',
      kind: 'session',
      group: 'under',
      name: 'Session',
      facts: [
        ['Windows', `${open.length} (${open.filter((w) => w.minimized).length} minimised)`],
        ['Focused', focused ? (getApp(focused.appId)?.title ?? focused.title) : 'the desktop'],
        ['Workspace', `${activeWs + 1} of ${WORKSPACE_COUNT}`],
        ['Tab open for', since(performance.now())],
        ['Survives a reload', 'settings only'],
      ],
      rect: full,
      plate: 'solid',
      drop: 1,
      action: { label: 'Reassemble and open a terminal', run: reassembleThen(() => launch('terminal')) },
    });

    drafts.push({
      id: 'fs',
      kind: 'fs',
      group: 'under',
      name: 'File system',
      facts: [
        ['Files in the tree', `${fsInfo.files} in ${fsInfo.dirs} directories`],
        ['Tree size', `${kb(fsInfo.bytes)}, rebuilt on every load`],
        ['Largest in ~', fsInfo.top[0] ? `${fsInfo.top[0].name} (${kb(fsInfo.top[0].bytes)})` : 'empty'],
        ['Kept in this browser', storage.ok ? `${storage.keys.length} key${storage.keys.length === 1 ? '' : 's'}, ${kb(storage.bytes)}` : 'storage is blocked'],
        ['Sent to a server', 'none of it'],
      ],
      rect: full,
      plate: 'solid',
      drop: 1,
      action: { label: 'Reassemble and browse it', run: reassembleThen(() => launch('files')) },
    });

    drafts.push({
      id: 'kernel',
      kind: 'kernel',
      group: 'under',
      name: 'Kernel',
      facts: [
        ['Event-loop lag', `${under.kernel.lagMs} ms on the last tick`],
        ['Page heap', under.kernel.heapMB !== null ? `${under.kernel.heapMB} MB` : 'not reported by this browser'],
        ['Linux guest', under.kernel.vmOpen ? `${GUEST.kernel}, running in its window` : `${GUEST.kernel}, not booted`],
        ['PostgreSQL', under.kernel.psqlOpen ? 'running in WebAssembly' : 'not started'],
        ['Network routes', String(under.kernel.routes)],
      ],
      rect: full,
      plate: 'solid',
      drop: 1,
      action: { label: 'Reassemble and boot the Linux VM', run: reassembleThen(() => launch('vm')) },
    });

    drafts.push({
      id: 'hardware',
      kind: 'hardware',
      group: 'under',
      name: 'Hardware',
      facts: [
        ['Logical cores', under.hardware.cores ? String(under.hardware.cores) : 'not reported'],
        ['Memory', under.hardware.memoryGB ? `${under.hardware.memoryGB} GB or more (browsers round this)` : 'not reported'],
        ['Platform', under.hardware.platform],
        ['Screen', `${window.screen?.width ?? W} × ${window.screen?.height ?? H}`],
      ],
      rect: full,
      plate: 'solid',
      drop: 1,
    });

    // resolve each part's readings, its work, and the parts it depends on
    const present = new Set(drafts.map((d) => d.id));
    const parts: Part[] = drafts.map((d) => {
      const anatomy = d.anatomy ?? LAYERS[d.kind as Exclude<LayerKind, 'window'>];
      const seen = new Set<string>();
      const links = anatomy.links.flatMap(([to, how]) => {
        // a link to "the windows" lands on the placeholder when none is open
        const id = to === 'nowindows' || to === 'window' ? 'nowindows' : to;
        if (!present.has(id) || id === d.id || seen.has(id)) return [];
        seen.add(id);
        return [{ id, how }];
      });
      return { ...d, anatomy, links, work: workOf(anatomy.work) };
    });

    return { parts, under, W, H };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windows, focusedId, activeWs, settings, fsInfo, storage, user, board, hz, tick, close, launch]);
}

/** Height of each part above the bottom of the stack, in gaps; and the stack's whole height. */
export function heights(parts: Part[]): { z: Map<string, number>; units: number } {
  const z = new Map<string, number>();
  let at = 0;
  for (let i = parts.length - 1; i >= 0; i--) {
    z.set(parts[i].id, at);
    at += parts[i].drop;
  }
  // `drop` is the gap above the part below, so the top part's own drop is not height
  return { z, units: at - (parts[0]?.drop ?? 0) };
}

/** Everything a part is wired to, in both directions: what it depends on, and what depends on it. */
export function wiring(parts: Part[], id: string): { id: string; how: string; dir: 'uses' | 'used by' }[] {
  const part = parts.find((p) => p.id === id);
  if (!part) return [];
  const out: { id: string; how: string; dir: 'uses' | 'used by' }[] = part.links.map((l) => ({ ...l, dir: 'uses' }));
  for (const p of parts) {
    if (p.id === id) continue;
    const back = p.links.find((l) => l.id === id);
    if (back && !out.some((o) => o.id === p.id)) out.push({ id: p.id, how: back.how, dir: 'used by' });
  }
  return out;
}
