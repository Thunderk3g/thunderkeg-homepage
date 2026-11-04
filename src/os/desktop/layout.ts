/**
 * Shell geometry shared by the store (tiling, launch placement) and the window
 * manager (drag, snap previews). Kept free of React so the store can use it.
 */

export const PANEL_H = 34; // Kali Xfce top panel (kali-defaults)
export const PANEL_H_PHONE = 44; // compact but thumb-sized
export const TASKBAR_H = 44; // Undercover mode bottom taskbar (Windows-10 look)
export const PHONE_MAX = 640;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const isPhone = () => typeof window !== 'undefined' && window.innerWidth <= PHONE_MAX;

export function panelHeight(undercover: boolean): number {
  if (isPhone()) return PANEL_H_PHONE;
  return undercover ? TASKBAR_H : PANEL_H;
}

/** The part of the viewport windows may occupy (everything but the panel). */
export function workArea(undercover: boolean): Rect {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const ph = panelHeight(undercover);
  return undercover ? { x: 0, y: 0, width: vw, height: vh - ph } : { x: 0, y: ph, width: vw, height: vh - ph };
}

export function snapRect(zone: 'max' | 'left' | 'right', undercover: boolean): Rect {
  const a = workArea(undercover);
  if (zone === 'max') return a;
  const half = Math.round(a.width / 2);
  return zone === 'left'
    ? { x: a.x, y: a.y, width: half, height: a.height }
    : { x: a.x + half, y: a.y, width: a.width - half, height: a.height };
}

/** Classifies a key event target: things that need raw keys (xterm, inputs) or nothing. */
export function isTypingTarget(t: EventTarget | null): 'xterm' | 'input' | null {
  if (!(t instanceof HTMLElement)) return null;
  if (t.closest('.xterm')) return 'xterm';
  const tag = t.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable) return 'input';
  if (t.closest('.cm-editor')) return 'input';
  return null;
}

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
