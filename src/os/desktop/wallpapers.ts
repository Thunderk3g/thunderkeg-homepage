import type { OSSettings } from '../store';

/**
 * Wallpaper catalogue. Ids are stable (they are persisted settings and CSS
 * class names: `.wall-<id>`); the artwork behind `kali-dragon` is now the
 * original isometric "data-dragon" cubes in /public/wallpapers.
 */
export const WALLPAPERS: { id: string; label: string }[] = [
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
