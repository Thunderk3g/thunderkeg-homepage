'use client';

import type { Command } from '../../../../types';
import { isPhone } from '../../../../desktop/layout';
import { useTeardown } from '../../../../teardown/store';

/** Small real utilities: a month calendar and a ROT-N cipher for crypto study. */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function caesarShift(text: string, shift: number): string {
  const n = ((shift % 26) + 26) % 26;
  return text.replace(/[a-z]/gi, (ch) => {
    const base = ch <= 'Z' ? 65 : 97;
    return String.fromCharCode(((ch.charCodeAt(0) - base + n) % 26) + base);
  });
}

function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return 'th';
  switch (n % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}

export const miscCommands: Command[] = [
  {
    name: 'teardown',
    summary: 'take the desktop apart into its layers (Esc puts it back)',
    usage: 'teardown',
    category: 'shell',
    run: () => {
      if (isPhone()) return 'teardown: needs a wider screen than this one';
      // after this line has printed, so the terminal is seen hanging in the stack with it
      window.setTimeout(() => useTeardown.getState().open(), 350);
      return 'Lifting the layers apart. This window is one of them. Esc reassembles.';
    },
  },
  {
    name: 'cal',
    summary: 'display a calendar for the current month',
    usage: 'cal',
    category: 'text',
    run: () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const today = now.getDate();
      const first = new Date(year, month, 1).getDay();
      const days = new Date(year, month + 1, 0).getDate();
      const title = `${MONTHS[month]} ${year}`;
      const pad = Math.max(0, Math.floor((20 - title.length) / 2));
      const lines = [' '.repeat(pad) + title, 'Su Mo Tu We Th Fr Sa'];
      let week = '   '.repeat(first);
      for (let d = 1; d <= days; d++) {
        week += String(d).padStart(2, ' ') + ' ';
        if ((first + d) % 7 === 0) {
          lines.push(week.replace(/ +$/, ''));
          week = '';
        }
      }
      if (week.trim()) lines.push(week.replace(/ +$/, ''));
      lines.push('', `(today is the ${today}${ordinal(today)})`);
      return lines.join('\n');
    },
  },
  {
    name: 'caesar',
    summary: 'encrypt/decrypt text with a Caesar (ROT-N) cipher',
    usage: 'caesar <N> <text...>   (use a negative N to decrypt)',
    category: 'text',
    run: ({ args }) => {
      if (args.length < 2) return 'usage: caesar <N> <text...>   e.g. `caesar 13 Hello World`';
      const shift = parseInt(args[0], 10);
      if (Number.isNaN(shift)) return `caesar: '${args[0]}' is not a valid shift amount`;
      const text = args.slice(1).join(' ');
      const cipher = caesarShift(text, shift);
      return [
        `plain  : ${text}`,
        `ROT-${((shift % 26) + 26) % 26} : ${cipher}`,
        `decode : caesar ${-shift} ${cipher}`,
      ].join('\n');
    },
  },
];
