"use client";

import { create } from "zustand";

/**
 * Player health store — deliberately tiny + framework-agnostic so it can be
 * read/written from the R3F frame loop via `useHealth.getState()` (no hooks,
 * no re-render churn) AND subscribed to from DOM UI (HealthBar) with the hook.
 *
 * Damage is gated by a short invulnerability window (i-frames) so a monster
 * can't drain the whole bar in a handful of frames, and is a no-op once dead
 * (hp<=0) — the Player owns the death→respawn→reset() flow.
 */

const MAX_HP = 100;
/** Seconds of i-frames granted after taking a hit (or after a respawn). */
const INVULN_AFTER_HIT = 0.6;

export interface HealthState {
  hp: number;
  maxHp: number;
  /** perf.now()/1000 timestamp until which incoming damage is ignored. */
  invulnUntil: number;

  /** Apply `n` damage. Ignored while invulnerable or already dead. */
  damage: (n: number) => void;
  /** Heal `n` (clamped to maxHp). Ignored while dead. */
  heal: (n: number) => void;
  /** Full reset to max HP, with a brief grace window of i-frames. */
  reset: () => void;
}

const now = () =>
  typeof performance !== "undefined" ? performance.now() / 1000 : Date.now() / 1000;

export const useHealth = create<HealthState>((set, get) => ({
  hp: MAX_HP,
  maxHp: MAX_HP,
  invulnUntil: 0,

  damage: (n) => {
    const s = get();
    if (s.hp <= 0) return; // already dead — respawn flow handles revival
    if (now() < s.invulnUntil) return; // i-frames active
    if (n <= 0) return;
    const hp = Math.max(0, s.hp - n);
    set({ hp, invulnUntil: now() + INVULN_AFTER_HIT });
  },

  heal: (n) => {
    const s = get();
    if (s.hp <= 0) return;
    if (n <= 0) return;
    set({ hp: Math.min(s.maxHp, s.hp + n) });
  },

  reset: () =>
    set({ hp: MAX_HP, maxHp: MAX_HP, invulnUntil: now() + INVULN_AFTER_HIT }),
}));
