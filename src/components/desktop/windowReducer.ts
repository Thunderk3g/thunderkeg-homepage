import type { AppKind, Bounds, WindowState } from "@/types/window";

export interface WindowMgrState {
  windows: Record<string, WindowState>;
  order: string[];
  zCounter: number;
}

export type Action =
  | { type: "OPEN"; kind: AppKind; title: string; bounds: Bounds; id: string }
  | { type: "CLOSE"; id: string }
  | { type: "FOCUS"; id: string }
  | { type: "MIN"; id: string }
  | { type: "MAX"; id: string; viewport: { w: number; h: number } }
  | { type: "BOUNDS"; id: string; bounds: Bounds };

const TASKBAR_H = 40;

export const initialState: WindowMgrState = { windows: {}, order: [], zCounter: 10 };

export function reduce(state: WindowMgrState, a: Action): WindowMgrState {
  switch (a.type) {
    case "OPEN": {
      if (state.windows[a.id]) {
        return reduce(state, { type: "FOCUS", id: a.id });
      }
      const z = state.zCounter + 1;
      const win: WindowState = {
        id: a.id,
        kind: a.kind,
        title: a.title,
        bounds: a.bounds,
        zIndex: z,
        minimised: false,
        maximised: false,
      };
      return {
        windows: { ...state.windows, [a.id]: win },
        order: [...state.order.filter((x) => x !== a.id), a.id],
        zCounter: z,
      };
    }
    case "CLOSE": {
      const next = { ...state.windows };
      delete next[a.id];
      return { ...state, windows: next, order: state.order.filter((x) => x !== a.id) };
    }
    case "FOCUS": {
      const w = state.windows[a.id];
      if (!w) return state;
      const z = state.zCounter + 1;
      return {
        ...state,
        zCounter: z,
        windows: { ...state.windows, [a.id]: { ...w, zIndex: z, minimised: false } },
        order: [...state.order.filter((x) => x !== a.id), a.id],
      };
    }
    case "MIN": {
      const w = state.windows[a.id];
      if (!w) return state;
      return { ...state, windows: { ...state.windows, [a.id]: { ...w, minimised: !w.minimised } } };
    }
    case "MAX": {
      const w = state.windows[a.id];
      if (!w) return state;
      if (w.maximised && w.prevBounds) {
        return {
          ...state,
          windows: {
            ...state.windows,
            [a.id]: { ...w, maximised: false, bounds: w.prevBounds, prevBounds: undefined },
          },
        };
      }
      const max: Bounds = { x: 0, y: 0, width: a.viewport.w, height: a.viewport.h - TASKBAR_H };
      return {
        ...state,
        windows: {
          ...state.windows,
          [a.id]: { ...w, maximised: true, prevBounds: w.bounds, bounds: max },
        },
      };
    }
    case "BOUNDS": {
      const w = state.windows[a.id];
      if (!w) return state;
      return { ...state, windows: { ...state.windows, [a.id]: { ...w, bounds: a.bounds } } };
    }
  }
}
