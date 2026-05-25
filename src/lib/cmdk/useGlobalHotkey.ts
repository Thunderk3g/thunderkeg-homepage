"use client";

import { useEffect } from "react";

/**
 * Registers a keyboard shortcut on `window` and invokes `callback` when it matches.
 *
 * Defaults to Cmd/Ctrl + K. SSR-safe: only attaches the listener inside
 * `useEffect`, so it never runs during server rendering or hydration.
 *
 * @example
 *   useGlobalHotkey(() => setOpen((o) => !o));
 *   useGlobalHotkey(close, { key: "Escape", mod: false });
 */
export interface HotkeyOptions {
  /** The key to match (case-insensitive). Defaults to `"k"`. */
  key?: string;
  /** Require Cmd (mac) or Ctrl (other) to be held. Defaults to `true`. */
  mod?: boolean;
  /** Disable the listener entirely. Defaults to `false`. */
  disabled?: boolean;
}

export function useGlobalHotkey(
  callback: (e: KeyboardEvent) => void,
  options: HotkeyOptions = {},
): void {
  const { key = "k", mod = true, disabled = false } = options;

  useEffect(() => {
    if (disabled) return;
    if (typeof window === "undefined") return;

    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key.toLowerCase() !== key.toLowerCase()) return;
      if (mod) {
        const isMod = e.metaKey || e.ctrlKey;
        if (!isMod) return;
      }
      // Avoid intercepting when the user is editing a contentEditable.
      // (input/textarea are still allowed — Cmd+K is global.)
      const target = e.target as HTMLElement | null;
      if (target?.isContentEditable) return;

      e.preventDefault();
      callback(e);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [callback, key, mod, disabled]);
}
