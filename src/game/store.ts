import { create } from "zustand";

export type BuildingId =
  | "about"
  | "experience"
  | "projects"
  | "skills"
  | "awards"
  | "contact";

export type MinigameId = "bug-hunt" | "kafka-courier" | "cache-match";

/** Analog movement vector contributed by the mobile joystick (range -1..1). */
export interface JoystickVector {
  x: number;
  z: number;
}

export interface GameState {
  // --- loading ---
  ready: boolean;
  setReady: (ready: boolean) => void;

  // --- input (analog, written by mobile joystick; keyboard is read separately) ---
  joystick: JoystickVector;
  setJoystick: (x: number, z: number) => void;

  // --- proximity / interaction ---
  nearBuilding: BuildingId | null;
  setNearBuilding: (id: BuildingId | null) => void;

  // --- content panels ---
  activePanel: BuildingId | null;
  openPanel: (id: BuildingId) => void;
  closePanel: () => void;

  // --- minigames ---
  activeMinigame: MinigameId | null;
  startMinigame: (id: MinigameId) => void;
  endMinigame: () => void;
  scores: Record<MinigameId, number | null>;
  setScore: (id: MinigameId, score: number) => void;

  // true while any modal UI (panel or minigame) is open — pauses player control
  isModalOpen: () => boolean;
}

export const useGame = create<GameState>((set, get) => ({
  ready: false,
  setReady: (ready) => set({ ready }),

  joystick: { x: 0, z: 0 },
  setJoystick: (x, z) => set({ joystick: { x, z } }),

  nearBuilding: null,
  setNearBuilding: (id) => set({ nearBuilding: id }),

  activePanel: null,
  openPanel: (id) => set({ activePanel: id }),
  closePanel: () => set({ activePanel: null }),

  activeMinigame: null,
  startMinigame: (id) => set({ activeMinigame: id, activePanel: null }),
  endMinigame: () => set({ activeMinigame: null }),
  scores: { "bug-hunt": null, "kafka-courier": null, "cache-match": null },
  setScore: (id, score) =>
    set((s) => ({ scores: { ...s.scores, [id]: score } })),

  isModalOpen: () => get().activePanel !== null || get().activeMinigame !== null,
}));
