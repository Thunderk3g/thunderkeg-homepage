"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_THEME_ID,
  getThemeById,
  THEME_STORAGE_KEY,
  THEMES,
  type Theme,
  type ThemeId,
} from "./themes";

interface ThemeContextValue {
  theme: Theme;
  themes: Theme[];
  setThemeId: (id: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function tokensToCss(theme: Theme): string {
  const t = theme.tokens;
  // The `:root` block here is intentional; the <style> tag is global.
  return `:root {
  --color-bg: ${t.bg};
  --color-surface: ${t.surface};
  --color-elevated: ${t.elevated};
  --color-border: ${t.border};
  --color-fg: ${t.fg};
  --color-muted: ${t.muted};
  --color-accent: ${t.accent};
  --color-accent2: ${t.accent2};
  --color-success: ${t.success};
  --color-warning: ${t.warning};
  --color-danger: ${t.danger};
  --wallpaper: ${theme.wallpaper ?? t.bg};
}`;
}

export function ThemeProvider({ children }: { children: ReactNode }): JSX.Element {
  // Default theme during SSR + first client paint to avoid hydration mismatch.
  const [themeId, setThemeIdState] = useState<ThemeId>(DEFAULT_THEME_ID);

  // Read persisted choice after mount.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (stored) {
        const next = getThemeById(stored);
        if (next.id !== themeId) setThemeIdState(next.id);
      }
    } catch {
      /* ignore — private mode / disabled storage */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const theme = useMemo(() => getThemeById(themeId), [themeId]);

  // Sync :root CSS variables via a managed <style> tag in <head>.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const STYLE_ID = "thunderkeg-theme-vars";
    let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement("style");
      el.id = STYLE_ID;
      document.head.appendChild(el);
    }
    el.textContent = tokensToCss(theme);
  }, [theme]);

  const setThemeId = useCallback((id: ThemeId) => {
    setThemeIdState(id);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, themes: THEMES, setThemeId }),
    [theme, setThemeId],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Graceful fallback: components outside the provider get the default theme
    // and a no-op setter. Keeps SSR / isolated rendering safe.
    const fallbackTheme = getThemeById(DEFAULT_THEME_ID);
    return {
      theme: fallbackTheme,
      themes: THEMES,
      setThemeId: () => {
        /* no-op outside provider */
      },
    };
  }
  return ctx;
}
