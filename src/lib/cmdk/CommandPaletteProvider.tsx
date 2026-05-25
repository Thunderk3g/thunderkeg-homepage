"use client";

import { useCallback, useState } from "react";

import CommandPalette from "@/components/apps/command-palette/CommandPalette";
import { useGlobalHotkey } from "./useGlobalHotkey";

interface CommandPaletteProviderProps {
  children: React.ReactNode;
}

/**
 * Top-level provider for the Cmd+K command palette.
 *
 * Wrap your desktop tree with this (inside the `WindowManagerProvider`, since
 * the palette reads `useWindows()` to open apps). It:
 *
 *   - holds the `open` boolean for the palette,
 *   - registers Cmd/Ctrl+K as a global toggle hotkey,
 *   - renders `<CommandPalette />` once.
 *
 * No imperative API is exposed — Cmd+K (or Ctrl+K on non-Mac) is the only way
 * to summon it. This keeps the public surface to a single component.
 */
export function CommandPaletteProvider({
  children,
}: CommandPaletteProviderProps) {
  const [open, setOpen] = useState(false);

  const toggle = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  useGlobalHotkey(toggle);

  return (
    <>
      {children}
      <CommandPalette open={open} setOpen={setOpen} />
    </>
  );
}
