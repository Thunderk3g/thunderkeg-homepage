import type { Command } from '../../../types';
import { isUndercover, useOS } from '../../../store';

/** `kali-undercover` — the real Kali script that disguises the desktop as Windows 10. */
export const undercoverCommands: Command[] = [
  {
    name: 'kali-undercover',
    summary: 'toggle Kali Undercover mode (Windows-10 disguise)',
    usage: 'kali-undercover',
    category: 'system',
    run: () => {
      const wasOn = isUndercover(useOS.getState());
      useOS.getState().toggleUndercover();
      return wasOn
        ? 'Kali Undercover mode disabled. Welcome back.'
        : 'Kali Undercover mode enabled. Your desktop now looks like Windows 10 — press Super to see the start menu.';
    },
  },
  {
    name: 'undercover',
    summary: 'alias for kali-undercover',
    category: 'system',
    run: ({ shell }) => shell.exec('kali-undercover'),
  },
];
