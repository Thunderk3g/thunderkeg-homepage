'use client';

import type { Command } from '../../../../types';

/* ─────────────────────────── helpers ─────────────────────────── */

const MATRIX_GLYPHS = 'ｱｲｳｴｵｶｷｸ01ｺｻｼｽｾ10ｿﾀﾁ$#ﾂﾃ@ﾄﾅ%ﾆﾇﾈ&ﾉﾊ';

/** 5-row block alphabet for figlet/banner (uppercase A–Z, 0–9, space). */
const FIGLET_FONT: Record<string, string[]> = {
  A: [' ## ', '#  #', '####', '#  #', '#  #'],
  B: ['### ', '#  #', '### ', '#  #', '### '],
  C: [' ###', '#   ', '#   ', '#   ', ' ###'],
  D: ['### ', '#  #', '#  #', '#  #', '### '],
  E: ['####', '#   ', '### ', '#   ', '####'],
  F: ['####', '#   ', '### ', '#   ', '#   '],
  G: [' ###', '#   ', '# ##', '#  #', ' ###'],
  H: ['#  #', '#  #', '####', '#  #', '#  #'],
  I: ['###', ' # ', ' # ', ' # ', '###'],
  J: ['  ##', '   #', '   #', '#  #', ' ## '],
  K: ['#  #', '# # ', '##  ', '# # ', '#  #'],
  L: ['#   ', '#   ', '#   ', '#   ', '####'],
  M: ['#   #', '## ##', '# # #', '#   #', '#   #'],
  N: ['#  #', '## #', '# ##', '#  #', '#  #'],
  O: [' ## ', '#  #', '#  #', '#  #', ' ## '],
  P: ['### ', '#  #', '### ', '#   ', '#   '],
  Q: [' ## ', '#  #', '#  #', '# ##', ' ###'],
  R: ['### ', '#  #', '### ', '# # ', '#  #'],
  S: [' ###', '#   ', ' ## ', '   #', '### '],
  T: ['###', ' # ', ' # ', ' # ', ' # '],
  U: ['#  #', '#  #', '#  #', '#  #', ' ## '],
  V: ['#  #', '#  #', '#  #', ' ## ', ' ## '],
  W: ['#   #', '#   #', '# # #', '## ##', '#   #'],
  X: ['#  #', ' ## ', ' ## ', ' ## ', '#  #'],
  Y: ['#  #', '#  #', ' ## ', ' # ', ' # '],
  Z: ['####', '  # ', ' #  ', '#   ', '####'],
  '0': [' ## ', '#  #', '#  #', '#  #', ' ## '],
  '1': [' # ', '## ', ' # ', ' # ', '###'],
  '2': ['### ', '   #', ' ## ', '#   ', '####'],
  '3': ['### ', '   #', ' ## ', '   #', '### '],
  '4': ['#  #', '#  #', '####', '   #', '   #'],
  '5': ['####', '#   ', '### ', '   #', '### '],
  '6': [' ###', '#   ', '### ', '#  #', ' ## '],
  '7': ['####', '   #', '  # ', ' #  ', ' #  '],
  '8': [' ## ', '#  #', ' ## ', '#  #', ' ## '],
  '9': [' ## ', '#  #', ' ###', '   #', '### '],
  ' ': ['  ', '  ', '  ', '  ', '  '],
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const WEATHER_SKIES = [
  { sky: 'Sunny', art: ['  \\ . /  ', ' - (_) - ', '  / . \\  '] },
  { sky: 'Partly cloudy', art: ['  \\ . /  ', ' .--(_). ', '(___.__)>'] },
  { sky: 'Cloudy', art: ['   .--.  ', ' .-(    ).', '(___.__)>'] },
  { sky: 'Light rain', art: [' .-(    ).', '(___.__)>', ' ʻ ʻ ʻ ʻ '] },
  { sky: 'Thunderstorm', art: [' .-(    ).', '(___.__)>', ' ⚡ʻ ⚡ʻ  '] },
];

function caesarShift(text: string, shift: number): string {
  const n = ((shift % 26) + 26) % 26;
  return text.replace(/[a-z]/gi, (ch) => {
    const base = ch <= 'Z' ? 65 : 97;
    return String.fromCharCode(((ch.charCodeAt(0) - base + n) % 26) + base);
  });
}

/* ─────────────────────────── commands ─────────────────────────── */

export const funstuffCommands: Command[] = [
  {
    name: 'sl',
    summary: 'a steam locomotive rolls across your terminal',
    usage: 'sl',
    category: 'fun',
    run: () =>
      [
        '      ====        ________                ___________',
        '  _D _|  |_______/        \\__I_I_____===__|_________|',
        '   |(_)---  |   H\\________/ |   |        =|___ ___|  ',
        '   /     |  |   H  |  |     |   |         ||_| |_||  ',
        '  |      |  |   H  |__--------------------| [___] |  ',
        '  | ________|___H__/__|_____/[][]~\\_______|       |  ',
        '  |/ |   |-----------I_____I [][] []  D   |=======|__',
        "__/ =| o |=-~~\\  /~~\\  /~~\\  /~~\\ ____Y___________|__",
        ' |/-=|___|=O=====O=====O=====O   |_____/~\\___/        ',
        "  \\_/      \\__/  \\__/  \\__/  \\__/      \\_/            ",
        '',
        'woo woo!  (you typed `sl` instead of `ls`, didn\'t you?)',
      ].join('\n'),
  },
  {
    name: 'cmatrix',
    summary: 'enter the matrix (a few rows of digital rain)',
    usage: 'cmatrix [rows]',
    category: 'fun',
    run: ({ args }) => {
      const rows = Math.min(Math.max(parseInt(args[0], 10) || 12, 3), 24);
      const width = 48;
      const out: string[] = ['Wake up, Neo...', ''];
      for (let r = 0; r < rows; r++) {
        let line = '';
        for (let c = 0; c < width; c++) {
          line += Math.random() < 0.62 ? MATRIX_GLYPHS[Math.floor(Math.random() * MATRIX_GLYPHS.length)] : ' ';
        }
        out.push(line);
      }
      out.push('', 'Follow the white rabbit. (Ctrl-C to wake up)');
      return out.join('\n');
    },
  },
  {
    name: 'figlet',
    summary: 'render a word as big block letters',
    usage: 'figlet <text>',
    category: 'fun',
    run: ({ args }) => renderBanner(args.join(' ') || 'KALI'),
  },
  {
    name: 'banner',
    summary: 'render a word as big block letters (alias of figlet)',
    usage: 'banner <text>',
    category: 'fun',
    run: ({ args }) => renderBanner(args.join(' ') || 'KALI'),
  },
  {
    name: 'cal',
    summary: 'display a calendar for the current month',
    usage: 'cal',
    category: 'fun',
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
    category: 'fun',
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
  {
    name: 'weather',
    summary: 'show the (totally made-up) local forecast',
    usage: 'weather [city]',
    category: 'fun',
    run: ({ args }) => {
      const city = args.join(' ') || 'localhost';
      const pick = WEATHER_SKIES[Math.floor(Math.random() * WEATHER_SKIES.length)];
      const temp = Math.floor(Math.random() * 22) + 8;
      const wind = Math.floor(Math.random() * 28) + 3;
      const humid = Math.floor(Math.random() * 45) + 40;
      const info = [
        pick.sky,
        `${temp} °C  (feels like ${temp - Math.floor(Math.random() * 3)} °C)`,
        `↗ ${wind} km/h`,
        `${humid}% humidity`,
      ];
      const lines = [`Weather report: ${city}`, ''];
      for (let i = 0; i < 3; i++) {
        lines.push(`   ${pick.art[i]}     ${info[i] ?? ''}`);
      }
      lines.push(`              ${info[3]}`);
      lines.push('', '(forecast generated by /dev/urandom — do not plan a picnic)');
      return lines.join('\n');
    },
  },
];

/* ─────────────────────── private utilities ─────────────────────── */

function renderBanner(input: string): string {
  const text = input.toUpperCase();
  const rows = ['', '', '', '', ''];
  for (const ch of text) {
    const glyph = FIGLET_FONT[ch] ?? FIGLET_FONT[' '];
    for (let r = 0; r < 5; r++) {
      rows[r] += glyph[r] + ' ';
    }
  }
  return rows.map((r) => r.replace(/#/g, '█').replace(/\s+$/, '')).join('\n');
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
