'use client';

import type { Command, CommandContext } from '../../../../types';

/**
 * Text-processing utilities for the Kali web shell.
 * All pure JS — base64 via btoa/atob, the rest are simple string transforms.
 * The "checksum" command is a deliberately non-cryptographic demo hash.
 */

/** Pull input from the first non-flag file arg, else from piped stdin. */
function readInput(ctx: CommandContext, fileArg?: string): string | null {
  if (fileArg) {
    const content = ctx.shell.fs.read(fileArg, ctx.shell.cwd);
    return content;
  }
  return ctx.stdin ?? null;
}

/** First operand that is not a flag (does not start with '-'). */
function firstFile(args: string[]): string | undefined {
  return args.find((a) => !a.startsWith('-'));
}

const fileComplete = ({ args, shell }: { args: string[]; shell: CommandContext['shell'] }): string[] => {
  void args;
  return shell.fs.list('.', shell.cwd) ?? [];
};

export const textprocCommands: Command[] = [
  {
    name: 'base64',
    summary: 'base64 encode/decode data',
    usage: 'base64 [-d] [file]   (text via pipe also works)',
    category: 'text',
    run: (ctx) => {
      const decode = ctx.args.includes('-d') || ctx.args.includes('--decode');
      const file = firstFile(ctx.args);
      const input = readInput(ctx, file);
      if (input == null) return file ? `base64: ${file}: No such file or directory` : '';
      try {
        if (decode) return atob(input.trim().replace(/\s+/g, ''));
        return btoa(input).replace(/(.{76})/g, '$1\n');
      } catch {
        return 'base64: invalid input';
      }
    },
    complete: fileComplete,
  },
  {
    name: 'tr',
    summary: 'translate or delete characters',
    usage: 'tr [-d] SET1 [SET2]   (reads stdin/pipe)',
    category: 'text',
    run: (ctx) => {
      const del = ctx.args.includes('-d');
      const rest = ctx.args.filter((a) => a !== '-d');
      const set1 = rest[0];
      const set2 = rest[1];
      if (!set1) return 'usage: tr [-d] SET1 [SET2]';
      const input = ctx.stdin ?? '';
      if (del) {
        const drop = new Set(set1.split(''));
        return input.split('').filter((c) => !drop.has(c)).join('');
      }
      if (!set2) return 'tr: missing operand after SET1 (SET2 required without -d)';
      const map = new Map<string, string>();
      for (let i = 0; i < set1.length; i++) {
        map.set(set1[i], set2[Math.min(i, set2.length - 1)] ?? set1[i]);
      }
      return input.split('').map((c) => map.get(c) ?? c).join('');
    },
  },
  {
    name: 'cut',
    summary: 'remove sections from each line of input',
    usage: 'cut -d DELIM -f LIST [file]',
    category: 'text',
    run: (ctx) => {
      const di = ctx.args.indexOf('-d');
      const fi = ctx.args.indexOf('-f');
      const delim = di >= 0 ? (ctx.args[di + 1] ?? '\t') : '\t';
      const fieldSpec = fi >= 0 ? ctx.args[fi + 1] : undefined;
      if (!fieldSpec) return 'usage: cut -d DELIM -f LIST [file]';
      const used = new Set([di, di + 1, fi, fi + 1]);
      const file = ctx.args.find((a, i) => !a.startsWith('-') && !used.has(i));
      const input = readInput(ctx, file);
      if (input == null) return file ? `cut: ${file}: No such file or directory` : '';
      const fields = fieldSpec
        .split(',')
        .map((n) => parseInt(n, 10))
        .filter((n) => Number.isFinite(n) && n > 0);
      if (fields.length === 0) return `cut: invalid field list: ${fieldSpec}`;
      return input
        .split('\n')
        .map((line) => {
          const parts = line.split(delim);
          return fields.map((f) => parts[f - 1] ?? '').join(delim);
        })
        .join('\n');
    },
    complete: fileComplete,
  },
  {
    name: 'tac',
    summary: 'concatenate and print files in reverse line order',
    usage: 'tac [file]',
    category: 'text',
    run: (ctx) => {
      const file = firstFile(ctx.args);
      const input = readInput(ctx, file);
      if (input == null) return file ? `tac: ${file}: No such file or directory` : '';
      return input.split('\n').reverse().join('\n');
    },
    complete: fileComplete,
  },
  {
    name: 'checksum',
    summary: 'non-crypto demo checksum of input (NOT a real hash)',
    usage: 'checksum [file]   (djb2-style, demo only)',
    category: 'text',
    run: (ctx) => {
      const file = firstFile(ctx.args);
      const input = readInput(ctx, file);
      if (input == null) return file ? `checksum: ${file}: No such file or directory` : '';
      // djb2 — a simple non-cryptographic hash, widened to 64 hex chars.
      let h1 = 5381;
      let h2 = 52711;
      for (let i = 0; i < input.length; i++) {
        const c = input.charCodeAt(i);
        h1 = (h1 * 33) ^ c;
        h2 = (h2 * 31) ^ ((c << 3) | (c >>> 5));
      }
      const a = (h1 >>> 0).toString(16).padStart(8, '0');
      const b = (h2 >>> 0).toString(16).padStart(8, '0');
      const digest = (a + b + a.split('').reverse().join('') + b.split('').reverse().join(''))
        .repeat(2)
        .slice(0, 64);
      return `${digest}  ${file ?? '-'}   (non-cryptographic demo, do not use for security)`;
    },
    complete: fileComplete,
  },
  {
    name: 'xxd',
    summary: 'make a hexdump of input',
    usage: 'xxd [file]',
    category: 'text',
    run: (ctx) => {
      const file = firstFile(ctx.args);
      const input = readInput(ctx, file);
      if (input == null) return file ? `xxd: ${file}: No such file or directory` : '';
      const bytes: number[] = [];
      for (let i = 0; i < input.length; i++) bytes.push(input.charCodeAt(i) & 0xff);
      const lines: string[] = [];
      for (let off = 0; off < bytes.length; off += 16) {
        const chunk = bytes.slice(off, off + 16);
        const hex = chunk
          .map((b) => b.toString(16).padStart(2, '0'))
          .reduce((acc, h, i) => acc + h + (i % 2 === 1 ? ' ' : ''), '')
          .padEnd(40, ' ');
        const ascii = chunk.map((b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '.')).join('');
        lines.push(`${off.toString(16).padStart(8, '0')}: ${hex} ${ascii}`);
      }
      return lines.join('\n') || '00000000:';
    },
    complete: fileComplete,
  },
  {
    name: 'fold',
    summary: 'wrap each input line to a given width',
    usage: 'fold [-w WIDTH] [file]',
    category: 'text',
    run: (ctx) => {
      const wi = ctx.args.indexOf('-w');
      const width = wi >= 0 ? Math.max(1, parseInt(ctx.args[wi + 1], 10) || 80) : 80;
      const used = new Set([wi, wi + 1]);
      const file = ctx.args.find((a, i) => !a.startsWith('-') && !used.has(i));
      const input = readInput(ctx, file);
      if (input == null) return file ? `fold: ${file}: No such file or directory` : '';
      const out: string[] = [];
      for (const line of input.split('\n')) {
        if (line.length === 0) {
          out.push('');
          continue;
        }
        for (let i = 0; i < line.length; i += width) out.push(line.slice(i, i + width));
      }
      return out.join('\n');
    },
    complete: fileComplete,
  },
  {
    name: 'cat-n',
    summary: 'print input with line numbers (like cat -n)',
    usage: 'cat-n [file]',
    category: 'text',
    run: (ctx) => {
      const file = firstFile(ctx.args);
      const input = readInput(ctx, file);
      if (input == null) return file ? `cat-n: ${file}: No such file or directory` : '';
      return input
        .split('\n')
        .map((line, i) => `${String(i + 1).padStart(6)}\t${line}`)
        .join('\n');
    },
    complete: fileComplete,
  },
];
