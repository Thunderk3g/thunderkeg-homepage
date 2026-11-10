'use client';

import { useEffect, useMemo, useState } from 'react';
import { useOS, WORKSPACE_COUNT } from '../store';
import { getApp } from '../registry';
import { desktopApps } from '../registry';
import { WALLPAPERS, stacksOn, wallpaperFor } from '../desktop/wallpapers';
import { panelHeight } from '../desktop/layout';
import { GUEST } from '../apps/vm/guest';
import type { FsNode } from '../types';
import { useBoard } from '@/stacks/useBoard';
import type { Rect } from './camera';
import { useTeardown } from './store';

/**
 * The desktop as a parts list, top to bottom.
 *
 * Above the glass are the layers anyone can see: the panel, each window, the
 * icons, the Stacks board, the wallpaper. Below it are the layers that hold
 * those up, drawn from the same live state the desktop runs on: the display,
 * the session, the file system, what is stored in this browser, and the
 * machine. Every part says what it stands in for on a real Kali desktop
 * (`role`) and what it actually is here (`impl`), so the teardown doubles as
 * an honest map of how the site is built.
 */

export type PartKind =
  | 'panel'
  | 'window'
  | 'nowindows'
  | 'desk'
  | 'board'
  | 'wall'
  | 'display'
  | 'session'
  | 'fs'
  | 'storage'
  | 'machine';

export interface Part {
  id: string;
  kind: PartKind;
  /** 'surface' is what you can see; 'under' is what holds it up */
  group: 'surface' | 'under';
  name: string;
  /** the piece of a real Kali / Xfce system this stands in for */
  role: string;
  /** what it really is on this site */
  impl: string;
  facts: [string, string][];
  /** where it sits on its layer, in desktop px: leader lines aim at it */
  rect: Rect;
  /** what the pointer can hit, when that is less than the whole rect */
  hits?: Rect[];
  /** the live element on the desktop that is this part, if there is one */
  selector?: string;
  /** drawn as a plate by Plates.tsx: glass for a see-through layer, solid under the glass */
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
  machine: { cores: number | null; memoryGB: number | null; platform: string; vmOpen: boolean; heapMB: number | null };
}

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

  // the clock, the heap and the viewport move while the desktop is apart
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    const onResize = () => setTick((n) => n + 1);
    window.addEventListener('resize', onResize);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const fsInfo = useMemo(() => fsStats(fs.root), [fs, fsVersion]);
  // storage only changes when something saves; once a second is plenty
  const storage = useMemo(readStorage, [tick]);

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

    const live = windows
      .filter((w) => !w.closing && !w.minimized && (w.workspace ?? 0) === activeWs)
      .sort((a, b) => b.z - a.z);
    const focused = windows.find((w) => w.id === focusedId);
    const wallpaper = wallpaperFor(settings);
    const wallName = WALLPAPERS.find((w) => w.id === wallpaper)?.label ?? wallpaper;
    const boardOn = stacksOn(settings);
    const now = new Date();
    const clock = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: !settings.clock24 });

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
        { id: 'session', name: 'xfce4-session', note: 'one zustand store', state: 'daemon' },
        { id: 'xfwm4', name: 'xfwm4', note: `${windows.length} window${windows.length === 1 ? '' : 's'}`, state: 'daemon' },
        { id: 'panel', name: 'xfce4-panel', note: 'top bar', state: 'daemon' },
        { id: 'xfdesktop', name: 'xfdesktop', note: 'wallpaper and icons', state: 'daemon' },
        { id: 'notifyd', name: 'xfce4-notifyd', note: 'toasts', state: 'daemon' },
        ...windows
          .filter((w) => !w.closing)
          .map<Proc>((w) => ({
            id: w.id,
            name: getApp(w.appId)?.title ?? w.title,
            note: w.id,
            state:
              (w.workspace ?? 0) !== activeWs
                ? 'elsewhere'
                : w.minimized
                  ? 'minimized'
                  : w.id === focusedId
                    ? 'focused'
                    : 'running',
          })),
      ],
      fs: fsInfo,
      storage,
      machine: {
        cores: navigator.hardwareConcurrency || null,
        memoryGB: nav.deviceMemory ?? null,
        platform: nav.userAgentData?.platform || navigator.platform || 'unknown',
        vmOpen: windows.some((w) => w.appId === 'vm' && !w.closing),
        heapMB: mem ? Math.round(mem.usedJSHeapSize / 1048576) : null,
      },
    };

    const parts: Part[] = [];

    parts.push({
      id: 'panel',
      kind: 'panel',
      group: 'surface',
      name: 'Panel',
      role: 'xfce4-panel',
      impl: 'A flex row of React components: menu, launchers, pager, task list, tray. src/os/desktop/Panel.tsx',
      facts: [
        ['Height', `${ph} px`],
        ['Clock', clock],
        ['Workspace', `${activeWs + 1} of ${WORKSPACE_COUNT}`],
        ['Task buttons', String(windows.filter((w) => !w.closing).length)],
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
        parts.push({
          id: w.id,
          kind: 'window',
          group: 'surface',
          name: app?.title ?? w.title,
          role: 'a window managed by xfwm4',
          impl: `${app?.description ?? 'An app'}. A React component in a frame drawn by src/os/desktop/Window.tsx`,
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
          action: { label: 'Reassemble and open', run: () => close(w.id) },
        });
      }
    } else {
      parts.push({
        id: 'nowindows',
        kind: 'nowindows',
        group: 'surface',
        name: 'Windows',
        role: 'xfwm4, the window manager',
        impl: 'Nothing is open, so the window manager has nothing to stack. Open an app and take the desktop apart again: each window becomes its own layer here.',
        facts: [
          ['Open here', '0'],
          ['On other workspaces', String(windows.filter((w) => !w.closing && (w.workspace ?? 0) !== activeWs).length)],
          ['Minimised', String(windows.filter((w) => !w.closing && w.minimized).length)],
        ],
        rect: full,
        hits: [],
        plate: 'glass',
        drop: 1,
        action: { label: 'Reassemble and open a terminal', run: reassembleThen(() => launch('terminal')) },
      });
    }

    parts.push({
      id: 'desk',
      kind: 'desk',
      group: 'surface',
      name: 'Icons and card',
      role: 'xfdesktop icons and a conky widget',
      impl: 'A CSS grid of launcher buttons and the introduction card, in one layer that sits under every window. src/os/desktop/Desktop.tsx',
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
      parts.push({
        id: 'board',
        kind: 'board',
        group: 'surface',
        name: 'Stacks board',
        role: 'no Xfce twin: a live overlay',
        impl: 'One canvas, redrawn only when the record behind it changes. src/os/desktop/stacks',
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

    parts.push({
      id: 'wall',
      kind: 'wall',
      group: 'surface',
      name: 'Wallpaper',
      role: 'xfdesktop backdrop',
      impl: 'A CSS background on one element, drifting a few pixels on a 20-second loop. app/globals.css',
      facts: [
        ['Wallpaper', wallName],
        ['Theme', settings.theme],
        ['Accent', settings.accent],
      ],
      rect: full,
      selector: '.kos-wall',
      plate: null,
      drop: 1,
      action: { label: 'Reassemble and change it', run: reassembleThen(() => launch('settings', { page: 'wallpaper' })) },
    });

    /* ── under the glass ── */

    parts.push({
      id: 'display',
      kind: 'display',
      group: 'under',
      name: 'Display',
      role: 'Xorg and the framebuffer',
      impl: 'Your browser tab. The desktop is ordinary HTML laid out to this viewport and composited by the browser, which is why it can be tilted and pulled apart at all.',
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

    parts.push({
      id: 'session',
      kind: 'session',
      group: 'under',
      name: 'Session',
      role: 'xfce4-session, the process table',
      impl: 'One zustand store holds every window, workspace and setting; each "process" is a mounted React component. src/os/store.ts',
      facts: [
        ['Windows', `${windows.filter((w) => !w.closing).length} (${windows.filter((w) => w.minimized && !w.closing).length} minimised)`],
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

    parts.push({
      id: 'fs',
      kind: 'fs',
      group: 'under',
      name: 'File system',
      role: 'ext4 on /dev/sda1',
      impl: 'A tree of plain objects in memory, shared by the terminal and the file manager. It is rebuilt on every load. src/os/fs',
      facts: [
        ['Files', String(fsInfo.files)],
        ['Directories', String(fsInfo.dirs)],
        ['Size', kb(fsInfo.bytes)],
        ['Largest in ~', fsInfo.top[0] ? `${fsInfo.top[0].name} (${kb(fsInfo.top[0].bytes)})` : 'empty'],
        ['Survives a reload', 'no'],
      ],
      rect: full,
      plate: 'solid',
      drop: 1,
      action: { label: 'Reassemble and browse it', run: reassembleThen(() => launch('files')) },
    });

    parts.push({
      id: 'storage',
      kind: 'storage',
      group: 'under',
      name: 'Storage',
      role: 'the disk',
      impl: 'localStorage in this browser: your settings, and the Research library if you used it. None of it is sent to a server.',
      facts: storage.ok
        ? [
            ['Keys', String(storage.keys.length)],
            ['Total', kb(storage.bytes)],
            ...storage.keys.slice(0, 3).map<[string, string]>((k) => [k.key, kb(k.bytes)]),
            ['Leaves this browser', 'never'],
          ]
        : [['Storage', 'blocked in this browser, so nothing is kept']],
      rect: full,
      plate: 'solid',
      drop: 1,
    });

    parts.push({
      id: 'machine',
      kind: 'machine',
      group: 'under',
      name: 'Machine',
      role: 'the hardware',
      impl: `Your device, as far as a web page is allowed to see it. The Linux VM app boots a real ${GUEST.kernel} kernel on an x86 emulator inside this tab.`,
      facts: [
        ['Logical cores', under.machine.cores ? String(under.machine.cores) : 'not reported'],
        ['Memory', under.machine.memoryGB ? `${under.machine.memoryGB} GB or more (browsers round this)` : 'not reported'],
        ['Platform', under.machine.platform],
        ['Page heap', under.machine.heapMB !== null ? `${under.machine.heapMB} MB` : 'not reported'],
        ['Linux VM', under.machine.vmOpen ? `${GUEST.kernel}, ${GUEST.memoryMB} MB guest, window open` : 'not booted'],
      ],
      rect: full,
      plate: 'solid',
      drop: 1,
      action: { label: 'Reassemble and boot the VM', run: reassembleThen(() => launch('vm')) },
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
