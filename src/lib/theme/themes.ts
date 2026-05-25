/**
 * Theme catalog for the Kali-desktop portfolio.
 *
 * Each theme defines 11 color tokens that map 1:1 to the Tailwind utilities
 * exposed in `tailwind.config.js` (bg, surface, elevated, border, fg, muted,
 * accent, accent2, success, warning, danger). The CSS-variable layer in
 * `themePatch.css` reads these at runtime so themes hot-swap without a
 * Tailwind rebuild.
 *
 * Palettes:
 *  - Kali Purple    : project default; matches the baked-in tokens.cjs.
 *  - Tokyo Night    : canonical "Tokyo Night" (enkia) — bg #1a1b26, fg #c0caf5.
 *  - Dracula        : official Dracula spec — bg #282a36, fg #f8f8f2.
 *  - Solarized Dark : Ethan Schoonover's base03/base0 palette.
 */

export type ThemeId =
  | "kali-purple"
  | "tokyo-night"
  | "dracula"
  | "solarized-dark";

export interface ThemeTokens {
  bg: string;
  surface: string;
  elevated: string;
  border: string;
  fg: string;
  muted: string;
  accent: string;
  accent2: string;
  success: string;
  warning: string;
  danger: string;
}

export interface Theme {
  id: ThemeId;
  label: string;
  tokens: ThemeTokens;
  /** Optional CSS `background` shorthand for the desktop root. */
  wallpaper?: string;
}

export const THEMES: Theme[] = [
  {
    id: "kali-purple",
    label: "Kali Purple",
    tokens: {
      bg: "#0b0d12",
      surface: "#13161f",
      elevated: "#1a1e2b",
      border: "#2a3144",
      fg: "#e6e9f2",
      muted: "#8a93a8",
      accent: "#7c5cff",
      accent2: "#22d3ee",
      success: "#4ade80",
      warning: "#fbbf24",
      danger: "#ef4444",
    },
    wallpaper:
      "radial-gradient(1200px 600px at 20% 10%, rgba(124,92,255,0.18), transparent 60%), radial-gradient(900px 500px at 80% 90%, rgba(34,211,238,0.10), transparent 60%), #0b0d12",
  },
  {
    id: "tokyo-night",
    label: "Tokyo Night",
    tokens: {
      bg: "#1a1b26",
      surface: "#1f2335",
      elevated: "#24283b",
      border: "#414868",
      fg: "#c0caf5",
      muted: "#9aa5ce",
      accent: "#bb9af7",
      accent2: "#7dcfff",
      success: "#9ece6a",
      warning: "#e0af68",
      danger: "#f7768e",
    },
    wallpaper:
      "radial-gradient(1200px 600px at 20% 10%, rgba(187,154,247,0.18), transparent 60%), radial-gradient(900px 500px at 80% 90%, rgba(125,207,255,0.12), transparent 60%), #1a1b26",
  },
  {
    id: "dracula",
    label: "Dracula",
    tokens: {
      bg: "#282a36",
      surface: "#21222c",
      elevated: "#343746",
      border: "#44475a",
      fg: "#f8f8f2",
      muted: "#6272a4",
      accent: "#bd93f9",
      accent2: "#8be9fd",
      success: "#50fa7b",
      warning: "#f1fa8c",
      danger: "#ff5555",
    },
    wallpaper:
      "radial-gradient(1200px 600px at 20% 10%, rgba(189,147,249,0.20), transparent 60%), radial-gradient(900px 500px at 80% 90%, rgba(139,233,253,0.12), transparent 60%), #282a36",
  },
  {
    id: "solarized-dark",
    label: "Solarized Dark",
    tokens: {
      bg: "#002b36",
      surface: "#073642",
      elevated: "#0a4452",
      border: "#586e75",
      fg: "#eee8d5",
      muted: "#93a1a1",
      accent: "#268bd2",
      accent2: "#2aa198",
      success: "#859900",
      warning: "#b58900",
      danger: "#dc322f",
    },
    wallpaper:
      "radial-gradient(1200px 600px at 20% 10%, rgba(38,139,210,0.18), transparent 60%), radial-gradient(900px 500px at 80% 90%, rgba(42,161,152,0.12), transparent 60%), #002b36",
  },
];

export const DEFAULT_THEME_ID: ThemeId = "kali-purple";

export const THEME_STORAGE_KEY = "thunderkeg.theme";

export function getThemeById(id: string | null | undefined): Theme {
  const found = THEMES.find((t) => t.id === id);
  return found ?? (THEMES.find((t) => t.id === DEFAULT_THEME_ID) as Theme);
}
