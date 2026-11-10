import type { OSSettings } from '../store';

/**
 * Wallpaper catalogue. Ids are stable (they are persisted settings and CSS
 * class names: `.wall-<id>`); the artwork behind `kali-dragon` is now the
 * original isometric "data-dragon" cubes in /public/wallpapers. `stacks` is
 * the plain midnight backdrop the board was designed on.
 *
 * The Stacks board itself (src/os/desktop/stacks) is not a wallpaper: it is
 * a layer drawn over whichever one is chosen, so the record of the work is
 * the same on every backdrop. See stacksOn().
 */
export const WALLPAPERS: { id: string; label: string }[] = [
  { id: 'stacks', label: 'Midnight' },
  { id: 'kali-dragon', label: 'Data Dragon' },
  { id: 'sweep', label: 'Sweep' },
  { id: 'ticker', label: 'Ticker' },
  { id: 'synapse', label: 'Synapse' },
  { id: 'horizon', label: 'Horizon' },
  { id: 'contours', label: 'Contours' },
  { id: 'kali-2025', label: 'Facets' },
  { id: 'kali-mono', label: 'Mono' },
  { id: 'kali-blue', label: 'Kali Blue' },
  { id: 'kali-mountains', label: 'Aurora' },
  { id: 'kali-matrix', label: 'Matrix' },
  { id: 'kali-void', label: 'Deep Void' },
];

/** Undercover and BackTrack bring their own wallpaper, like the real script. */
export function wallpaperFor(settings: Pick<OSSettings, 'theme' | 'wallpaper'>): string {
  if (settings.theme === 'kali-undercover') return 'undercover';
  if (settings.theme === 'backtrack') return 'backtrack';
  return settings.wallpaper;
}

/**
 * Whether the Stacks board is drawn. On by default over every wallpaper;
 * Undercover hides it with the rest of the Kali look.
 */
export function stacksOn(settings: Pick<OSSettings, 'theme' | 'stacks'>): boolean {
  return settings.stacks !== false && settings.theme !== 'kali-undercover';
}
