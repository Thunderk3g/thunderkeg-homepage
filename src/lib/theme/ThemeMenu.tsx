"use client";

import { useTheme } from "./ThemeProvider";

/**
 * Inline list of theme buttons for use inside the desktop right-click
 * ContextMenu. Renders one <button> per theme; the active theme is marked
 * with a leading checkmark. Styling uses theme tokens only.
 */
export function ThemeMenuItems(): JSX.Element {
  const { theme, themes, setThemeId } = useTheme();

  return (
    <>
      {themes.map((t) => {
        const active = t.id === theme.id;
        return (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => setThemeId(t.id)}
              aria-current={active ? "true" : undefined}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-fg hover:bg-white/5"
            >
              <span
                aria-hidden="true"
                className="inline-block w-3 text-accent"
              >
                {active ? "✓" : ""}
              </span>
              <span
                aria-hidden="true"
                className="inline-block h-3 w-3 rounded-sm border border-border"
                style={{ backgroundColor: t.tokens.accent }}
              />
              <span className="flex-1">{t.label}</span>
            </button>
          </li>
        );
      })}
    </>
  );
}

/**
 * Standalone fly-out menu — exported in case the main agent wants a
 * grouped "Themes" submenu instead of an inline list. Safe to ignore.
 */
export function ThemeMenu(): JSX.Element {
  return (
    <ul
      role="menu"
      className="w-48 rounded border border-border bg-elevated py-1 text-sm shadow-window"
    >
      <ThemeMenuItems />
    </ul>
  );
}
