"use client";
import { createContext, useCallback, useContext, useMemo, useReducer } from "react";
import type { AppKind, Bounds, WindowState } from "@/types/window";
import { initialState, reduce } from "./windowReducer";

interface Api {
  windows: Record<string, WindowState>;
  order: string[];
  open(kind: AppKind, opts?: { title?: string; bounds?: Partial<Bounds>; id?: string }): string;
  close(id: string): void;
  focus(id: string): void;
  minimise(id: string): void;
  toggleMaximise(id: string): void;
  setBounds(id: string, b: Bounds): void;
}

const Ctx = createContext<Api | null>(null);

export const useWindows = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWindows outside provider");
  return v;
};

export const DEFAULT_TITLES: Record<AppKind, string> = {
  terminal: "Terminal",
  voice: "Voice Assistant",
  resume: "Resume",
  projects: "Projects",
  about: "About",
  social: "Social",
  doom: "Doom",
  tetris: "Tetris",
  mp3: "MP3 Player",
  vlc: "Media Player",
  files: "Files",
  "code-editor": "Code Editor",
};

const DEFAULT_BOUNDS: Bounds = { x: 80, y: 60, width: 720, height: 480 };

export function WindowManagerProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reduce, initialState);

  const open: Api["open"] = useCallback((kind, opts) => {
    const id = opts?.id ?? `${kind}-${Date.now()}`;
    const bounds: Bounds = {
      x: opts?.bounds?.x ?? DEFAULT_BOUNDS.x + Math.random() * 60,
      y: opts?.bounds?.y ?? DEFAULT_BOUNDS.y + Math.random() * 40,
      width:  opts?.bounds?.width  ?? DEFAULT_BOUNDS.width,
      height: opts?.bounds?.height ?? DEFAULT_BOUNDS.height,
    };
    dispatch({
      type: "OPEN",
      kind,
      title: opts?.title ?? DEFAULT_TITLES[kind],
      bounds,
      id,
    });
    return id;
  }, []);

  const api = useMemo<Api>(() => ({
    windows: state.windows,
    order: state.order,
    open,
    close:    (id) => dispatch({ type: "CLOSE", id }),
    focus:    (id) => dispatch({ type: "FOCUS", id }),
    minimise: (id) => dispatch({ type: "MIN", id }),
    toggleMaximise: (id) =>
      dispatch({
        type: "MAX",
        id,
        viewport: {
          w: typeof window !== "undefined" ? window.innerWidth : 1280,
          h: typeof window !== "undefined" ? window.innerHeight : 800,
        },
      }),
    setBounds: (id, b) => dispatch({ type: "BOUNDS", id, bounds: b }),
  }), [state, open]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
