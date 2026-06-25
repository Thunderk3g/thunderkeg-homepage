import { create } from 'zustand';
import { missions, totalRespect } from '@/data/resume';

export type Tier = 'high' | 'lite';

interface GameStore {
  started: boolean;
  tier: Tier;
  activeMission: string | null;
  completed: string[];
  respect: number;
  inCar: boolean;
  splash: string | null; // mission title for "MISSION PASSED" splash
  allDone: boolean;
  start: (tier: Tier) => void;
  openMission: (id: string) => void;
  closeMission: () => void;
  setInCar: (v: boolean) => void;
  clearSplash: () => void;
}

export const useGame = create<GameStore>((set, get) => ({
  started: false,
  tier: 'high',
  activeMission: null,
  completed: [],
  respect: 0,
  inCar: false,
  splash: null,
  allDone: false,
  start: (tier) => set({ started: true, tier }),
  openMission: (id) => {
    if (get().activeMission) return;
    set({ activeMission: id });
  },
  closeMission: () => {
    const { activeMission, completed, respect } = get();
    if (!activeMission) return;
    const m = missions.find((x) => x.id === activeMission)!;
    if (!completed.includes(activeMission)) {
      const newCompleted = [...completed, activeMission];
      set({
        activeMission: null,
        completed: newCompleted,
        respect: respect + m.respect,
        splash: m.title,
        allDone: newCompleted.length === missions.length,
      });
    } else {
      set({ activeMission: null });
    }
  },
  setInCar: (v) => set({ inCar: v }),
  clearSplash: () => set({ splash: null }),
}));

export { totalRespect };

// debug/testing handle
if (typeof window !== 'undefined') {
  (window as unknown as { __game: typeof useGame }).__game = useGame;
}

// Mutable, render-loop-shared world state (kept out of React to avoid re-renders).
export const live = {
  px: 0,
  pz: 0,
  pHeading: 0,
  carX: 0,
  carZ: 0,
  carHeading: 0,
  carSpeed: 0,
  camYaw: 0,
};
