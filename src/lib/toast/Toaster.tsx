"use client";

import { Toaster as Sonner } from "sonner";

/**
 * App-wide toast surface. Mount once near the top of the desktop tree so
 * notifications overlay every window. Visual styling is forced via Tailwind
 * `!` overrides to defeat sonner's built-in light/dark CSS.
 */
export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      theme="dark"
      toastOptions={{
        classNames: {
          toast:
            "!bg-elevated !text-fg !border !border-border !shadow-window !font-mono !text-sm",
          title: "!text-fg",
          description: "!text-muted",
          actionButton: "!bg-accent !text-bg",
          cancelButton: "!bg-surface !text-muted",
          success: "!border-success",
          error: "!border-danger",
          warning: "!border-warning",
          info: "!border-accent",
        },
      }}
    />
  );
}
