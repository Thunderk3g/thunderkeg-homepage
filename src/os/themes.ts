/**
 * Theme catalog. Each theme is a map of the OS CSS variables (defined in
 * globals.css under `.kos`). Applied at the `.kos` root by KaliOS, so themes
 * hot-swap with no rebuild. The root also carries `data-theme=<id>`, which the
 * stylesheet uses for structural variants (Undercover's bottom taskbar,
 * BackTrack's left-hand window buttons).
 *
 * Variable names are a public contract: apps style themselves with them.
 */
export interface OSTheme {
  id: string;
  label: string;
  /** one-line description for Settings → Appearance */
  note?: string;
  vars: Record<string, string>;
}

interface Palette {
  bg: string;
  panel: string;
  panel2: string;
  win: string;
  titlebar: string;
  titlebarActive: string;
  titlebarActive2?: string;
  titleFg?: string;
  titleFgInactive?: string;
  border: string;
  text: string;
  dim: string;
  accent: string;
  accentHover?: string;
  good: string;
  danger?: string;
  /** terminal background (rgb triplet, alpha comes from --kos-term-opacity) */
  termRgb?: string;
  glass?: string;
}

function mk(id: string, label: string, c: Palette, note?: string): OSTheme {
  return {
    id,
    label,
    note,
    vars: {
      '--kos-bg': c.bg,
      '--kos-panel': c.panel,
      '--kos-panel-2': c.panel2,
      '--kos-win': c.win,
      '--kos-titlebar': c.titlebar,
      '--kos-titlebar-active': c.titlebarActive,
      '--kos-titlebar-active-2': c.titlebarActive2 ?? c.titlebarActive,
      '--kos-title-fg': c.titleFg ?? '#ffffff',
      '--kos-title-fg-inactive': c.titleFgInactive ?? '#8c8f94',
      '--kos-border': c.border,
      '--kos-text': c.text,
      '--kos-dim': c.dim,
      '--kos-accent': c.accent,
      '--kos-accent-hover': c.accentHover ?? c.accent,
      '--kos-good': c.good,
      '--kos-danger': c.danger ?? '#ff5370',
      '--kos-term-rgb': c.termRgb ?? '35, 37, 46',
      '--kos-glass': c.glass ?? 'rgba(26, 28, 35, 0.82)',
    },
  };
}

export const THEMES: OSTheme[] = [
  // GTK "Kali-Dark" (kali-themes 2026.x): #23252E surfaces, #0D0E11-ish
  // headerbars with a #16171D→#1A1C23 gradient, #2777FF selection blue.
  mk(
    'kali-dark',
    'Kali Dark',
    {
      bg: '#0f1117', panel: '#1a1c23', panel2: '#23252e', win: '#23252e',
      titlebar: '#23252e', titlebarActive: '#16171d', titlebarActive2: '#1a1c23',
      border: '#363944', text: '#eeeeec', dim: '#9a9da3', accent: '#2777ff', accentHover: '#4d8eff',
      good: '#3ddc84', danger: '#ff5370',
    },
    'The default Xfce look',
  ),
  mk(
    'kali-purple',
    'Kali Purple',
    {
      bg: '#0b0d12', panel: '#15131f', panel2: '#1e1b2b', win: '#1e1b2b',
      titlebar: '#1e1b2b', titlebarActive: '#141220', titlebarActive2: '#1a1729',
      border: '#332e48', text: '#ecebf5', dim: '#9b97ad', accent: '#8a6cff', accentHover: '#a08aff',
      good: '#4ade80', termRgb: '30, 27, 43',
    },
    'Purple-team flavour',
  ),
  mk('tokyo-night', 'Tokyo Night', {
    bg: '#1a1b26', panel: '#16161e', panel2: '#1f2335', win: '#1f2335',
    titlebar: '#1f2335', titlebarActive: '#16161e', titlebarActive2: '#1a1b26',
    border: '#2f3449', text: '#c0caf5', dim: '#7a83ad', accent: '#7aa2f7', accentHover: '#97b6fa',
    good: '#9ece6a', termRgb: '26, 27, 38',
  }),
  mk('dracula', 'Dracula', {
    bg: '#282a36', panel: '#1e1f29', panel2: '#2b2d3a', win: '#2b2d3a',
    titlebar: '#2b2d3a', titlebarActive: '#1e1f29', titlebarActive2: '#21222c',
    border: '#44475a', text: '#f8f8f2', dim: '#9ea8cf', accent: '#bd93f9', accentHover: '#cfaefb',
    good: '#50fa7b', termRgb: '40, 42, 54',
  }),
  mk('solarized-dark', 'Solarized Dark', {
    bg: '#002b36', panel: '#002630', panel2: '#073642', win: '#073642',
    titlebar: '#073642', titlebarActive: '#00212b', titlebarActive2: '#002630',
    border: '#0e4b5a', text: '#c5d0d0', dim: '#839496', accent: '#268bd2', accentHover: '#4aa1e0',
    good: '#859900', termRgb: '0, 43, 54',
  }),
  mk('matrix', 'Matrix', {
    bg: '#000800', panel: '#011201', panel2: '#031c03', win: '#031c03',
    titlebar: '#031c03', titlebarActive: '#010e01', titlebarActive2: '#021502',
    border: '#0b3a0b', text: '#b6ffb6', dim: '#4fa24f', accent: '#00d455', accentHover: '#00ff66',
    good: '#00ff66', termRgb: '0, 10, 0',
  }),
  // kali-undercover: "look like Windows 10" — light chrome, dark taskbar.
  mk(
    'kali-undercover',
    'Kali Undercover',
    {
      bg: '#0b4f9c', panel: '#1b2330', panel2: '#2b3340', win: '#262d38',
      titlebar: '#ffffff', titlebarActive: '#ffffff', titlebarActive2: '#ffffff',
      titleFg: '#111111', titleFgInactive: '#7a7a7a',
      border: '#3c4655', text: '#f2f4f7', dim: '#a6aebb', accent: '#0a74da', accentHover: '#2a8be6',
      good: '#3ddc84', termRgb: '12, 12, 12', glass: 'rgba(24, 31, 42, 0.9)',
    },
    'Looks like Windows 10, so nobody looks twice',
  ),
  // kali-undercover --backtrack (2026.1): Kali-Red-Dark, buttons on the left.
  mk(
    'backtrack',
    'BackTrack',
    {
      bg: '#0d0606', panel: '#1a1212', panel2: '#251a1a', win: '#251b1b',
      titlebar: '#251b1b', titlebarActive: '#170f0f', titlebarActive2: '#1d1414',
      border: '#4a2a2a', text: '#f0e9e9', dim: '#ab9c9c', accent: '#e0322f', accentHover: '#f05a57',
      good: '#7bd88f', termRgb: '20, 12, 12', glass: 'rgba(30, 18, 18, 0.86)',
    },
    'Old-school red, window buttons on the left',
  ),
];

export function getTheme(id: string): OSTheme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}
