/**
 * Theme catalog. Each theme is a map of the OS CSS variables (defined in
 * globals.css under `.kos`). Applied at the `.kos` root by KaliOS, so themes
 * hot-swap with no rebuild. Ported/expanded from the thunderkeg theme tokens.
 */
export interface OSTheme {
  id: string;
  label: string;
  vars: Record<string, string>;
}

function mk(
  id: string,
  label: string,
  c: {
    bg: string;
    panel: string;
    panel2: string;
    win: string;
    titlebar: string;
    titlebarActive: string;
    border: string;
    text: string;
    dim: string;
    accent: string;
    good: string;
  },
): OSTheme {
  return {
    id,
    label,
    vars: {
      '--kos-bg': c.bg,
      '--kos-panel': c.panel,
      '--kos-panel-2': c.panel2,
      '--kos-win': c.win,
      '--kos-titlebar': c.titlebar,
      '--kos-titlebar-active': c.titlebarActive,
      '--kos-border': c.border,
      '--kos-text': c.text,
      '--kos-dim': c.dim,
      '--kos-accent': c.accent,
      '--kos-good': c.good,
    },
  };
}

export const THEMES: OSTheme[] = [
  mk('kali-dark', 'Kali Dark', {
    bg: '#0b0f17', panel: '#15171d', panel2: '#20232b', win: '#2a2d35',
    titlebar: '#1c1f26', titlebarActive: '#233044', border: '#363b47',
    text: '#d6dae0', dim: '#878d99', accent: '#33aaff', good: '#66d9a0',
  }),
  mk('kali-purple', 'Kali Purple', {
    bg: '#0b0d12', panel: '#13161f', panel2: '#1a1e2b', win: '#1a1e2b',
    titlebar: '#13161f', titlebarActive: '#241b4d', border: '#2a3144',
    text: '#e6e9f2', dim: '#8a93a8', accent: '#7c5cff', good: '#4ade80',
  }),
  mk('tokyo-night', 'Tokyo Night', {
    bg: '#1a1b26', panel: '#1f2335', panel2: '#24283b', win: '#222634',
    titlebar: '#1f2335', titlebarActive: '#2a3158', border: '#2a2e42',
    text: '#c0caf5', dim: '#565f89', accent: '#7aa2f7', good: '#9ece6a',
  }),
  mk('dracula', 'Dracula', {
    bg: '#282a36', panel: '#21222c', panel2: '#343746', win: '#2b2d3a',
    titlebar: '#21222c', titlebarActive: '#44384f', border: '#44475a',
    text: '#f8f8f2', dim: '#6272a4', accent: '#bd93f9', good: '#50fa7b',
  }),
  mk('solarized-dark', 'Solarized Dark', {
    bg: '#002b36', panel: '#073642', panel2: '#0a4351', win: '#083d49',
    titlebar: '#073642', titlebarActive: '#0d4f60', border: '#094b5a',
    text: '#93a1a1', dim: '#586e75', accent: '#268bd2', good: '#859900',
  }),
  mk('matrix', 'Matrix', {
    bg: '#000800', panel: '#021a02', panel2: '#063206', win: '#052705',
    titlebar: '#021a02', titlebarActive: '#0a4a0a', border: '#0a3a0a',
    text: '#b6ffb6', dim: '#2f7d2f', accent: '#00ff66', good: '#00ff66',
  }),
];

export function getTheme(id: string): OSTheme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}
