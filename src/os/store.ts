'use client';

import { create } from 'zustand';
import type { WindowState } from './types';
import { FileSystem, createDefaultFileSystem } from './fs/filesystem';
import { getApp } from './registry';

export type Phase = 'boot' | 'login' | 'desktop' | 'locked';

export interface OSSettings {
  wallpaper: string;
  accent: string;
  reducedMotion: boolean;
  terminalOpacity: number;
}

interface OSStore {
  phase: Phase;
  user: string;
  host: string;
  fs: FileSystem;

  windows: WindowState[];
  focusedId: string | null;
  nextZ: number;
  seq: number;

  settings: OSSettings;

  /* session */
  finishBoot: () => void;
  login: (user?: string) => void;
  lock: () => void;
  logout: () => void;

  /* settings */
  setWallpaper: (w: string) => void;
  setAccent: (a: string) => void;
  setReducedMotion: (v: boolean) => void;
  setTerminalOpacity: (v: number) => void;

  /* window manager */
  launch: (appId: string, args?: Record<string, unknown>) => string | null;
  close: (id: string) => void;
  focus: (id: string) => void;
  minimize: (id: string) => void;
  toggleMinimize: (id: string) => void;
  toggleMaximize: (id: string) => void;
  move: (id: string, x: number, y: number) => void;
  setBounds: (id: string, b: Partial<Pick<WindowState, 'x' | 'y' | 'width' | 'height'>>) => void;
  setTitle: (id: string, title: string) => void;
}

const DEFAULT_SETTINGS: OSSettings = {
  wallpaper: 'kali-dragon',
  accent: '#33aaff',
  reducedMotion: false,
  terminalOpacity: 0.92,
};

export const useOS = create<OSStore>((set, get) => ({
  phase: 'boot',
  user: 'kali',
  host: 'kali',
  fs: createDefaultFileSystem(),

  windows: [],
  focusedId: null,
  nextZ: 10,
  seq: 1,

  settings: DEFAULT_SETTINGS,

  finishBoot: () => set({ phase: 'desktop' }),
  login: (user) => set({ phase: 'desktop', user: user || get().user }),
  lock: () => set({ phase: 'locked' }),
  logout: () => set({ phase: 'login', windows: [], focusedId: null }),

  setWallpaper: (wallpaper) => set((s) => ({ settings: { ...s.settings, wallpaper } })),
  setAccent: (accent) => set((s) => ({ settings: { ...s.settings, accent } })),
  setReducedMotion: (reducedMotion) => set((s) => ({ settings: { ...s.settings, reducedMotion } })),
  setTerminalOpacity: (terminalOpacity) =>
    set((s) => ({ settings: { ...s.settings, terminalOpacity } })),

  launch: (appId, args) => {
    const app = getApp(appId);
    if (!app) return null;
    const state = get();

    if (!app.multi) {
      const existing = state.windows.find((w) => w.appId === appId);
      if (existing) {
        get().focus(existing.id);
        if (existing.minimized) get().toggleMinimize(existing.id);
        if (args) set((s) => ({ windows: s.windows.map((w) => (w.id === existing.id ? { ...w, args } : w)) }));
        return existing.id;
      }
    }

    const id = `win-${state.seq}`;
    const size = app.defaultSize ?? { width: 760, height: 500 };
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    const width = Math.min(size.width, vw - 40);
    const height = Math.min(size.height, vh - 100);
    const offset = (state.windows.length % 6) * 30;
    const x = Math.max(10, Math.round((vw - width) / 2) - 120 + offset);
    const y = Math.max(40, Math.round((vh - height) / 2) - 60 + offset);

    const win: WindowState = {
      id,
      appId,
      title: app.title,
      icon: app.icon,
      x,
      y,
      width,
      height,
      z: state.nextZ,
      minimized: false,
      maximized: false,
      args,
    };
    set((s) => ({
      windows: [...s.windows, win],
      focusedId: id,
      nextZ: s.nextZ + 1,
      seq: s.seq + 1,
    }));
    return id;
  },

  close: (id) =>
    set((s) => ({
      windows: s.windows.filter((w) => w.id !== id),
      focusedId: s.focusedId === id ? null : s.focusedId,
    })),

  focus: (id) =>
    set((s) => {
      const z = s.nextZ;
      return {
        windows: s.windows.map((w) => (w.id === id ? { ...w, z } : w)),
        focusedId: id,
        nextZ: z + 1,
      };
    }),

  minimize: (id) =>
    set((s) => ({
      windows: s.windows.map((w) => (w.id === id ? { ...w, minimized: true } : w)),
      focusedId: s.focusedId === id ? null : s.focusedId,
    })),

  toggleMinimize: (id) => {
    const w = get().windows.find((x) => x.id === id);
    if (!w) return;
    if (w.minimized) {
      set((s) => ({
        windows: s.windows.map((x) => (x.id === id ? { ...x, minimized: false, z: s.nextZ } : x)),
        focusedId: id,
        nextZ: s.nextZ + 1,
      }));
    } else {
      get().minimize(id);
    }
  },

  toggleMaximize: (id) =>
    set((s) => ({
      windows: s.windows.map((w) => {
        if (w.id !== id) return w;
        if (w.maximized) {
          return { ...w, maximized: false, ...(w.restore ?? {}), restore: undefined };
        }
        return {
          ...w,
          maximized: true,
          restore: { x: w.x, y: w.y, width: w.width, height: w.height },
        };
      }),
      focusedId: id,
    })),

  move: (id, x, y) =>
    set((s) => ({ windows: s.windows.map((w) => (w.id === id ? { ...w, x, y } : w)) })),

  setBounds: (id, b) =>
    set((s) => ({ windows: s.windows.map((w) => (w.id === id ? { ...w, ...b } : w)) })),

  setTitle: (id, title) =>
    set((s) => ({ windows: s.windows.map((w) => (w.id === id ? { ...w, title } : w)) })),
}));

if (typeof window !== 'undefined') {
  // test/debug handle (mirrors the old window.__game)
  (window as unknown as { __os: typeof useOS }).__os = useOS;
}
