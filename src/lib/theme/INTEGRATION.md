# Theme switcher — main-agent integration TODOs

Files added under `src/lib/theme/`:

- `themes.ts` — 4 themes (Kali Purple, Tokyo Night, Dracula, Solarized Dark) + types.
- `ThemeProvider.tsx` — `<ThemeProvider>` + `useTheme()` hook. Reads/writes `localStorage["thunderkeg.theme"]` and injects a managed `<style id="thunderkeg-theme-vars">` tag that defines `--color-*` and `--wallpaper` on `:root`.
- `themePatch.css` — Re-binds the Tailwind utilities generated from `tokens.cjs` (`bg-bg`, `bg-surface`, `text-fg`, `border-border`, etc.) to the CSS variables. Every rule has a fallback to the Kali Purple value so pre-hydration / SSR paints look right.
- `ThemeMenu.tsx` — `<ThemeMenuItems />` renders 4 `<li><button>` rows for use inside the existing `ContextMenu`. Also exports `<ThemeMenu />` (a complete `<ul>`) if you prefer a submenu container.

## Wiring checklist (main agent only)

1. **Wrap the app in `<ThemeProvider>`.** In `src/app/layout.tsx` (or wherever `<Desktop>` is mounted), wrap children:

   ```tsx
   import { ThemeProvider } from "@/lib/theme/ThemeProvider";
   // ...
   <ThemeProvider>{children}</ThemeProvider>
   ```

   `'use client'` is already declared inside `ThemeProvider.tsx`, so it can be imported from a server component.

2. **Load the CSS patch.** Add to `src/app/globals.css` (after the `@tailwind` directives so it can override):

   ```css
   @import "../lib/theme/themePatch.css";
   ```

   Then remove the hardcoded `background: #0b0d12; color: #e6e9f2;` from the existing `body { ... }` block — the patch sets those via `var(--wallpaper)` / `var(--color-fg)`.

3. **Add a "Themes ▸" entry to `ContextMenu.tsx`.** Import the menu items and slot them in:

   ```tsx
   import { ThemeMenuItems } from "@/lib/theme/ThemeMenu";
   // inside the <ul>:
   <li className="border-t border-border my-1" aria-hidden />
   <li className="px-3 py-1 text-xs uppercase tracking-wider text-muted">
     Themes
   </li>
   <ThemeMenuItems />
   ```

   (Or build a proper hover-submenu — `ThemeMenuItems` is just the `<li>` rows.)

4. **Desktop gradient.** Update `Desktop.tsx`'s inline `background` style (currently hard-coded `#0b0d12`) to:

   ```ts
   style={{ background: "var(--wallpaper, #0b0d12)" }}
   ```

   Any other hard-coded `#0b0d12` / `#e6e9f2` in shared chrome should swap to `var(--color-bg)` / `var(--color-fg)` for full theme coverage.

## Notes

- `useTheme()` returns a no-op fallback when used outside the provider — safe for SSR/storybook.
- `localStorage` writes are wrapped in try/catch (private-mode safe).
- The default theme is rendered during SSR and the first client paint; the persisted theme is applied in a `useEffect` on mount, so there's a one-frame swap but no hydration mismatch.
- `tokens.cjs` / `tailwind.config.js` are untouched; the patch CSS overrides Tailwind's generated rules via specificity (same single-class selector, but loaded after Tailwind utilities thanks to the `@import` placement).
