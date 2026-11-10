'use client';

import { create } from 'zustand';
import type { SnapZone, WindowState } from './types';
import { FileSystem, createDefaultFileSystem } from './fs/filesystem';
import { apps, getApp } from './registry';
import { getTheme } from './themes';
import { prefersReducedMotion, snapRect, workArea } from './desktop/layout';

/**
 * boot → (splash + systemd log) → login (LightDM greeter) → desktop.
 * `locked` draws the greeter over a live desktop; `off` is the post-shutdown
 * black screen.
 */
export type Phase = 'boot' | 'login' | 'desktop' | 'locked' | 'off';

export interface OSSettings {
  wallpaper: string;
  accent: string;
  reducedMotion: boolean;
  terminalOpacity: number;
  theme: string;
  /** larger UI type (14px → 16px) */
  hidpi: boolean;
  /** 24-hour panel clock */
  clock24: boolean;
  /** CPU/memory sparkline in the panel */
  panelGraph: boolean;
  /** drag-to-edge window snapping */
  snapping: boolean;
  /** the live Stacks skyline, drawn over whichever wallpaper is chosen */
  stacks: boolean;
}

export const WORKSPACE_COUNT = 4;
export const UNDERCOVER_THEME = 'kali-undercover';
const CLOSE_MS = 140;

interface OSStore {
  phase: Phase;
  user: string;
  host: string;
  fs: FileSystem;
  /** bumped after FS mutations so views over the (mutable) FileSystem re-render */
  fsVersion: number;
  bumpFs: () => void;

  windows: WindowState[];
  focusedId: string | null;
  nextZ: number;
  seq: number;

  settings: OSSettings;

  /* shell */
  /** bumps whenever the boot sequence must replay (Restart) */
  bootNonce: number;
  activeWorkspace: number;
  menuOpen: boolean;
  paletteOpen: boolean;
  /** xfce4-session-logout dialog (Log Out / Restart / Shut Down / Lock) */
  sessionDialog: boolean;
  /** most-recent-first app ids, for the Whisker "Recently Used" list */
  recent: string[];
  /** windows hidden by "Show desktop", restored by pressing it again */
  shownDesktop: string[] | null;
  /** theme to return to when leaving Undercover mode */
  prevTheme: string;

  /* session */
  finishBoot: () => void;
  login: (user?: string) => void;
  lock: () => void;
  logout: () => void;
  restart: () => void;
  shutdown: () => void;

  /* settings */
  setWallpaper: (w: string) => void;
  setAccent: (a: string) => void;
  setReducedMotion: (v: boolean) => void;
  setTerminalOpacity: (v: number) => void;
  setTheme: (id: string) => void;
  setSetting: <K extends keyof OSSettings>(key: K, value: OSSettings[K]) => void;
  toggleUndercover: () => void;

  /* shell UI */
  setMenuOpen: (open: boolean | ((o: boolean) => boolean)) => void;
  setPaletteOpen: (open: boolean | ((o: boolean) => boolean)) => void;
  setSessionDialog: (open: boolean) => void;
  setWorkspace: (n: number) => void;
  switchWorkspace: (delta: number) => void;
  moveToWorkspace: (id: string, n: number) => void;
  showDesktop: () => void;

  /* window manager */
  launch: (appId: string, args?: Record<string, unknown>) => string | null;
  close: (id: string) => void;
  /** remove a window immediately, skipping the close animation */
  destroy: (id: string) => void;
  focus: (id: string) => void;
  minimize: (id: string) => void;
  toggleMinimize: (id: string) => void;
  toggleMaximize: (id: string) => void;
  snap: (id: string, zone: SnapZone) => void;
  /** Super+Arrow tiling */
  tile: (id: string, dir: 'left' | 'right' | 'up' | 'down') => void;
  /** drop any maximise/snap state, restoring the floating size */
  unsnap: (id: string) => void;
  move: (id: string, x: number, y: number) => void;
  setBounds: (id: string, b: Partial<Pick<WindowState, 'x' | 'y' | 'width' | 'height'>>) => void;
  setTitle: (id: string, title: string) => void;
}

const DEFAULT_SETTINGS: OSSettings = {
  wallpaper: 'stacks',
  accent: '#2777ff',
  reducedMotion: false,
  terminalOpacity: 0.95,
  theme: 'kali-dark',
  hidpi: false,
  clock24: true,
  panelGraph: true,
  snapping: true,
  stacks: true,
};

const undercoverOn = (s: { settings: OSSettings }) => s.settings.theme === UNDERCOVER_THEME;
const wsOf = (w: WindowState) => w.workspace ?? 0;
const animationsOff = (s: { settings: OSSettings }) => s.settings.reducedMotion || prefersReducedMotion();

const SETTINGS_KEY = 'kos:settings';

/** Settings survive a reload; everything else about a session starts fresh. */
function storedSettings(): OSSettings {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(SETTINGS_KEY) : null;
    const saved = raw ? (JSON.parse(raw) as Partial<OSSettings>) : {};
    const merged = { ...DEFAULT_SETTINGS, ...saved };
    // Undercover is a mode you switch into, not a place to wake up in
    if (merged.theme === UNDERCOVER_THEME) merged.theme = DEFAULT_SETTINGS.theme;
    return merged;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export const useOS = create<OSStore>((set, get) => ({
  phase: 'boot',
  user: 'kali',
  host: 'kali',
  fs: createDefaultFileSystem(),
  fsVersion: 0,
  bumpFs: () => set((s) => ({ fsVersion: s.fsVersion + 1 })),

  windows: [],
  focusedId: null,
  nextZ: 10,
  seq: 1,

  settings: storedSettings(),

  bootNonce: 0,
  activeWorkspace: 0,
  menuOpen: false,
  paletteOpen: false,
  sessionDialog: false,
  recent: [],
  shownDesktop: null,
  prevTheme: 'kali-dark',

  finishBoot: () => set({ phase: 'login' }),
  login: (user) => set({ phase: 'desktop', user: user || get().user }),
  lock: () => set({ phase: 'locked', menuOpen: false, paletteOpen: false, sessionDialog: false }),
  logout: () =>
    set({
      phase: 'login',
      windows: [],
      focusedId: null,
      menuOpen: false,
      paletteOpen: false,
      sessionDialog: false,
      activeWorkspace: 0,
      shownDesktop: null,
    }),
  restart: () =>
    set((s) => ({
      phase: 'boot',
      bootNonce: s.bootNonce + 1,
      windows: [],
      focusedId: null,
      menuOpen: false,
      paletteOpen: false,
      sessionDialog: false,
      activeWorkspace: 0,
      shownDesktop: null,
    })),
  shutdown: () =>
    set({
      phase: 'off',
      windows: [],
      focusedId: null,
      menuOpen: false,
      paletteOpen: false,
      sessionDialog: false,
      shownDesktop: null,
    }),

  setWallpaper: (wallpaper) => set((s) => ({ settings: { ...s.settings, wallpaper } })),
  setAccent: (accent) => set((s) => ({ settings: { ...s.settings, accent } })),
  setReducedMotion: (reducedMotion) => set((s) => ({ settings: { ...s.settings, reducedMotion } })),
  setTerminalOpacity: (terminalOpacity) => set((s) => ({ settings: { ...s.settings, terminalOpacity } })),
  setTheme: (theme) =>
    set((s) => ({
      settings: { ...s.settings, theme, accent: getTheme(theme).vars['--kos-accent'] },
      prevTheme: s.settings.theme === UNDERCOVER_THEME || theme === UNDERCOVER_THEME ? s.prevTheme : theme,
    })),
  setSetting: (key, value) => set((s) => ({ settings: { ...s.settings, [key]: value } })),
  toggleUndercover: () => {
    const s = get();
    if (undercoverOn(s)) s.setTheme(s.prevTheme || 'kali-dark');
    else {
      set({ prevTheme: s.settings.theme });
      s.setTheme(UNDERCOVER_THEME);
    }
    // tiled windows follow the panel to its new edge
    const uc = undercoverOn(get());
    set((st) => ({
      windows: st.windows.map((w) => {
        if (w.maximized || w.snapped) {
          const r = snapRect(w.maximized ? 'max' : w.snapped!, uc);
          return { ...w, x: r.x, y: r.y, width: r.width, height: r.height };
        }
        const a = workArea(uc);
        return { ...w, y: Math.max(a.y, Math.min(w.y, a.y + a.height - 60)) };
      }),
    }));
  },

  setMenuOpen: (open) => set((s) => ({ menuOpen: typeof open === 'function' ? open(s.menuOpen) : open })),
  setPaletteOpen: (open) =>
    set((s) => ({ paletteOpen: typeof open === 'function' ? open(s.paletteOpen) : open })),
  setSessionDialog: (sessionDialog) => set({ sessionDialog, menuOpen: false }),

  setWorkspace: (n) => {
    const ws = ((n % WORKSPACE_COUNT) + WORKSPACE_COUNT) % WORKSPACE_COUNT;
    set((s) => {
      const top = s.windows
        .filter((w) => wsOf(w) === ws && !w.minimized && !w.closing)
        .sort((a, b) => b.z - a.z)[0];
      return { activeWorkspace: ws, focusedId: top?.id ?? null, shownDesktop: null };
    });
  },
  switchWorkspace: (delta) => get().setWorkspace(get().activeWorkspace + delta),
  moveToWorkspace: (id, n) =>
    set((s) => ({
      windows: s.windows.map((w) => (w.id === id ? { ...w, workspace: n } : w)),
      focusedId: s.focusedId === id && n !== s.activeWorkspace ? null : s.focusedId,
    })),

  showDesktop: () => {
    const s = get();
    if (s.shownDesktop) {
      const ids = new Set(s.shownDesktop);
      set((st) => ({
        windows: st.windows.map((w) => (ids.has(w.id) ? { ...w, minimized: false } : w)),
        shownDesktop: null,
      }));
      const top = get()
        .windows.filter((w) => ids.has(w.id))
        .sort((a, b) => b.z - a.z)[0];
      if (top) set({ focusedId: top.id });
      return;
    }
    const hide = s.windows.filter((w) => wsOf(w) === s.activeWorkspace && !w.minimized && !w.closing);
    const ids = new Set(hide.map((w) => w.id));
    set((st) => ({
      windows: st.windows.map((w) => (ids.has(w.id) ? { ...w, minimized: true } : w)),
      focusedId: null,
      shownDesktop: hide.length ? [...ids] : null,
    }));
  },

  launch: (appId, args) => {
    const app = getApp(appId);
    if (!app) return null;
    const state = get();
    const recent = [appId, ...state.recent.filter((r) => r !== appId)].slice(0, 12);

    if (!app.multi) {
      const existing = state.windows.find((w) => w.appId === appId && !w.closing);
      if (existing) {
        set({ recent });
        if (wsOf(existing) !== state.activeWorkspace) set({ activeWorkspace: wsOf(existing) });
        get().focus(existing.id);
        if (existing.minimized) get().toggleMinimize(existing.id);
        if (args) set((s) => ({ windows: s.windows.map((w) => (w.id === existing.id ? { ...w, args } : w)) }));
        return existing.id;
      }
    }

    const id = `win-${state.seq}`;
    const size = app.defaultSize ?? { width: 760, height: 500 };
    const area = workArea(undercoverOn(state));
    const vw = area.width;
    const width = Math.min(size.width, vw - 40);
    const height = Math.min(size.height, area.height - 48);
    const onWs = state.windows.filter((w) => wsOf(w) === state.activeWorkspace && !w.closing);
    const offset = (onWs.length % 6) * 28;
    // centre in the space right of the desktop icon column, when there is room for it
    const left = vw - width >= 440 ? 200 : 10;
    const x = Math.max(left, Math.min(vw - width - 10, left + Math.round((vw - left - width) / 2) + offset));
    const y = Math.max(area.y + 12, area.y + Math.round((area.height - height) / 2) - 40 + offset);
    const phone = typeof window !== 'undefined' && window.innerWidth < 640;

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
      // a floating window on a phone is just a smaller, fiddlier maximised one
      maximized: phone,
      args,
      workspace: state.activeWorkspace,
    };
    set((s) => ({
      windows: [...s.windows, win],
      focusedId: id,
      nextZ: s.nextZ + 1,
      seq: s.seq + 1,
      recent,
      shownDesktop: null,
      menuOpen: false,
    }));
    return id;
  },

  close: (id) => {
    const s = get();
    const w = s.windows.find((x) => x.id === id);
    if (!w) return;
    if (animationsOff(s) || w.minimized || typeof window === 'undefined') {
      get().destroy(id);
      return;
    }
    if (w.closing) return;
    set((st) => ({
      windows: st.windows.map((x) => (x.id === id ? { ...x, closing: true } : x)),
      focusedId: st.focusedId === id ? null : st.focusedId,
    }));
    window.setTimeout(() => get().destroy(id), CLOSE_MS);
  },

  destroy: (id) =>
    set((s) => {
      const windows = s.windows.filter((w) => w.id !== id);
      let focusedId = s.focusedId === id ? null : s.focusedId;
      if (!focusedId) {
        const next = windows
          .filter((w) => wsOf(w) === s.activeWorkspace && !w.minimized && !w.closing)
          .sort((a, b) => b.z - a.z)[0];
        focusedId = next?.id ?? null;
      }
      return { windows, focusedId };
    }),

  focus: (id) =>
    set((s) => {
      const w = s.windows.find((x) => x.id === id);
      if (!w || w.closing) return {};
      if (s.focusedId === id && w.z === s.nextZ - 1) return {};
      const z = s.nextZ;
      return {
        windows: s.windows.map((x) => (x.id === id ? { ...x, z } : x)),
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
        shownDesktop: null,
      }));
    } else {
      get().minimize(id);
    }
  },

  toggleMaximize: (id) => {
    const w = get().windows.find((x) => x.id === id);
    if (!w) return;
    if (w.maximized) get().unsnap(id);
    else get().snap(id, 'max');
  },

  snap: (id, zone) =>
    set((s) => ({
      windows: s.windows.map((w) => {
        if (w.id !== id) return w;
        const restore = w.maximized || w.snapped ? w.restore : { x: w.x, y: w.y, width: w.width, height: w.height };
        const r = snapRect(zone, undercoverOn(s));
        return {
          ...w,
          ...r,
          maximized: zone === 'max',
          snapped: zone === 'max' ? undefined : zone,
          restore,
        };
      }),
      focusedId: id,
    })),

  unsnap: (id) =>
    set((s) => ({
      windows: s.windows.map((w) => {
        if (w.id !== id || (!w.maximized && !w.snapped)) return w;
        return { ...w, maximized: false, snapped: undefined, ...(w.restore ?? {}), restore: undefined };
      }),
    })),

  tile: (id, dir) => {
    const w = get().windows.find((x) => x.id === id);
    if (!w) return;
    if (dir === 'up') return get().snap(id, 'max');
    if (dir === 'down') {
      if (w.maximized || w.snapped) get().unsnap(id);
      else get().minimize(id);
      return;
    }
    // Super+Left on a right-tiled window goes back to floating, like xfwm4/GNOME
    if ((dir === 'left' && w.snapped === 'right') || (dir === 'right' && w.snapped === 'left')) get().unsnap(id);
    else get().snap(id, dir);
  },

  move: (id, x, y) => set((s) => ({ windows: s.windows.map((w) => (w.id === id ? { ...w, x, y } : w)) })),

  setBounds: (id, b) => set((s) => ({ windows: s.windows.map((w) => (w.id === id ? { ...w, ...b } : w)) })),

  setTitle: (id, title) => set((s) => ({ windows: s.windows.map((w) => (w.id === id ? { ...w, title } : w)) })),
}));

/** Windows visible on the active workspace, in stacking order. */
export const windowsOnWorkspace = (s: { windows: WindowState[]; activeWorkspace: number }) =>
  s.windows.filter((w) => (w.workspace ?? 0) === s.activeWorkspace);

export const isUndercover = (s: { settings: OSSettings }) => undercoverOn(s);

if (typeof window !== 'undefined') {
  // test/debug handle (mirrors the old window.__game)
  (window as unknown as { __os: typeof useOS }).__os = useOS;
  (window as unknown as { __osApps: string[] }).__osApps = apps.map((a) => a.id);
}

if (typeof window !== 'undefined') {
  useOS.subscribe((s, prev) => {
    if (s.settings === prev.settings) return;
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(s.settings));
    } catch {
      /* storage blocked: settings just last for this visit */
    }
  });
}
