'use client';

import type { Command, ShellApi } from '../../../../types';

/** stdin-or-files helper: gather text from file args, else fall back to stdin. */
function gather(args: string[], shell: ShellApi, stdin: string | undefined, cmd: string): string | null {
  const files = args.filter((a) => !a.startsWith('-'));
  if (files.length === 0) return stdin ?? '';
  const out: string[] = [];
  for (const f of files) {
    const content = shell.fs.read(f, shell.cwd);
    if (content === null) {
      out.push(`${cmd}: ${f}: No such file or directory`);
      continue;
    }
    out.push(content);
  }
  return out.join('\n');
}

/** Recursively copy a node (file or directory) from absolute src to absolute dst. */
function copyTree(shell: ShellApi, src: string, dst: string): void {
  if (shell.fs.isDir(src)) {
    shell.fs.mkdir(dst);
    for (const child of shell.fs.list(src) ?? []) {
      copyTree(shell, `${src}/${child}`, `${dst}/${child}`);
    }
  } else {
    shell.fs.write(dst, shell.fs.read(src) ?? '');
  }
}

/** Resolve a destination path: if it is an existing dir, drop the source basename into it. */
function destFor(shell: ShellApi, srcAbs: string, destArg: string): string {
  const destAbs = shell.fs.resolve(destArg, shell.cwd);
  if (shell.fs.isDir(destAbs)) {
    const base = srcAbs.split('/').filter(Boolean).pop() ?? '';
    return `${destAbs}/${base}`;
  }
  return destAbs;
}

export const coreutilsCommands: Command[] = [
  {
    name: 'mv',
    summary: 'move (rename) files',
    usage: 'mv <source> <dest>',
    category: 'fs',
    run: ({ args, shell }) => {
      const ps = args.filter((a) => !a.startsWith('-'));
      if (ps.length < 2) return 'mv: missing destination file operand';
      const dest = ps[ps.length - 1];
      const sources = ps.slice(0, -1);
      const destAbs = shell.fs.resolve(dest, shell.cwd);
      const intoDir = shell.fs.isDir(destAbs);
      if (sources.length > 1 && !intoDir) return `mv: target '${dest}' is not a directory`;
      for (const s of sources) {
        const srcAbs = shell.fs.resolve(s, shell.cwd);
        if (!shell.fs.exists(srcAbs)) return `mv: cannot stat '${s}': No such file or directory`;
        const target = destFor(shell, srcAbs, dest);
        if (target === srcAbs) return `mv: '${s}' and '${dest}' are the same file`;
        copyTree(shell, srcAbs, target);
        shell.fs.remove(srcAbs);
      }
      return undefined;
    },
    complete: ({ shell }) => shell.fs.list('.', shell.cwd) ?? [],
  },
  {
    name: 'cp',
    summary: 'copy files and directories',
    usage: 'cp [-r] <source> <dest>',
    category: 'fs',
    run: ({ args, shell }) => {
      const recursive = args.some((a) => /^-[rR]/.test(a) || a === '--recursive');
      const ps = args.filter((a) => !a.startsWith('-'));
      if (ps.length < 2) return 'cp: missing destination file operand';
      const dest = ps[ps.length - 1];
      const sources = ps.slice(0, -1);
      const destAbs = shell.fs.resolve(dest, shell.cwd);
      const intoDir = shell.fs.isDir(destAbs);
      if (sources.length > 1 && !intoDir) return `cp: target '${dest}' is not a directory`;
      for (const s of sources) {
        const srcAbs = shell.fs.resolve(s, shell.cwd);
        if (!shell.fs.exists(srcAbs)) return `cp: cannot stat '${s}': No such file or directory`;
        if (shell.fs.isDir(srcAbs) && !recursive) return `cp: -r not specified; omitting directory '${s}'`;
        copyTree(shell, srcAbs, destFor(shell, srcAbs, dest));
      }
      return undefined;
    },
    complete: ({ shell }) => shell.fs.list('.', shell.cwd) ?? [],
  },
  {
    name: 'rmdir',
    summary: 'remove empty directories',
    usage: 'rmdir <dir...>',
    category: 'fs',
    run: ({ args, shell }) => {
      const dirs = args.filter((a) => !a.startsWith('-'));
      if (dirs.length === 0) return 'rmdir: missing operand';
      for (const d of dirs) {
        if (!shell.fs.exists(d, shell.cwd)) return `rmdir: failed to remove '${d}': No such file or directory`;
        if (!shell.fs.isDir(d, shell.cwd)) return `rmdir: failed to remove '${d}': Not a directory`;
        if ((shell.fs.list(d, shell.cwd) ?? []).length > 0)
          return `rmdir: failed to remove '${d}': Directory not empty`;
        if (!shell.fs.remove(d, shell.cwd)) return `rmdir: failed to remove '${d}': Operation not permitted`;
      }
      return undefined;
    },
    complete: ({ shell }) =>
      (shell.fs.list('.', shell.cwd) ?? []).filter((n) => shell.fs.isDir(n, shell.cwd)),
  },
  {
    name: 'find',
    summary: 'search for files in a directory hierarchy',
    usage: 'find [path] [-name pattern] [-type f|d]',
    category: 'fs',
    run: ({ args, shell }) => {
      const start = args[0] && !args[0].startsWith('-') ? args[0] : '.';
      const nameIdx = args.indexOf('-name');
      const namePat = nameIdx >= 0 ? args[nameIdx + 1] : undefined;
      const typeIdx = args.indexOf('-type');
      const typeFilter = typeIdx >= 0 ? args[typeIdx + 1] : undefined;
      const startAbs = shell.fs.resolve(start, shell.cwd);
      if (!shell.fs.exists(startAbs)) return `find: '${start}': No such file or directory`;
      const re = namePat
        ? new RegExp('^' + namePat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$')
        : null;
      const out: string[] = [];
      const display = (abs: string): string => {
        if (start === '.') {
          const rel = abs === startAbs ? '.' : '.' + abs.slice(startAbs.length);
          return rel;
        }
        return abs;
      };
      const walk = (abs: string): void => {
        const isDir = shell.fs.isDir(abs);
        const base = abs.split('/').filter(Boolean).pop() ?? '.';
        const matchName = !re || re.test(base);
        const typeOk = !typeFilter || (typeFilter === 'd' ? isDir : !isDir);
        if (matchName && typeOk) out.push(display(abs));
        if (isDir) for (const child of shell.fs.list(abs) ?? []) walk(`${abs}/${child}`);
      };
      walk(startAbs);
      return out.join('\n') || `find: nothing matched under '${start}'`;
    },
    complete: ({ shell }) => shell.fs.list('.', shell.cwd) ?? [],
  },
  {
    name: 'sort',
    summary: 'sort lines of text',
    usage: 'sort [-r] [-n] [-u] [file...]',
    category: 'text',
    run: ({ args, shell, stdin }) => {
      const text = gather(args, shell, stdin, 'sort');
      if (text === null) return '';
      const numeric = args.includes('-n');
      const reverse = args.includes('-r');
      const unique = args.includes('-u');
      let lines = text.length ? text.split('\n') : [];
      lines = lines.sort((a, b) =>
        numeric ? (parseFloat(a) || 0) - (parseFloat(b) || 0) : a.localeCompare(b),
      );
      if (reverse) lines.reverse();
      if (unique) lines = lines.filter((l, i) => i === 0 || l !== lines[i - 1]);
      return lines.join('\n');
    },
  },
  {
    name: 'uniq',
    summary: 'report or omit repeated adjacent lines',
    usage: 'uniq [-c] [-d] [-u] [file]',
    category: 'text',
    run: ({ args, shell, stdin }) => {
      const text = gather(args, shell, stdin, 'uniq');
      if (text === null) return '';
      const count = args.includes('-c');
      const onlyDup = args.includes('-d');
      const onlyUniq = args.includes('-u');
      const lines = text.length ? text.split('\n') : [];
      const groups: Array<{ line: string; n: number }> = [];
      for (const l of lines) {
        const last = groups[groups.length - 1];
        if (last && last.line === l) last.n += 1;
        else groups.push({ line: l, n: 1 });
      }
      return groups
        .filter((g) => (onlyDup ? g.n > 1 : true) && (onlyUniq ? g.n === 1 : true))
        .map((g) => (count ? `${String(g.n).padStart(7)} ${g.line}` : g.line))
        .join('\n');
    },
  },
  {
    name: 'rev',
    summary: 'reverse the characters of each line',
    usage: 'rev [file...]',
    category: 'text',
    run: ({ args, shell, stdin }) => {
      const text = gather(args, shell, stdin, 'rev');
      if (text === null) return '';
      return text
        .split('\n')
        .map((l) => l.split('').reverse().join(''))
        .join('\n');
    },
  },
  {
    name: 'seq',
    summary: 'print a sequence of numbers',
    usage: 'seq [first [step]] last',
    category: 'text',
    run: ({ args }) => {
      const nums = args.filter((a) => !a.startsWith('-')).map(Number);
      if (nums.length === 0 || nums.some((n) => Number.isNaN(n))) return 'seq: invalid numeric argument';
      let first = 1;
      let step = 1;
      let last: number;
      if (nums.length === 1) [last] = nums;
      else if (nums.length === 2) [first, last] = nums;
      else [first, step, last] = nums;
      if (step === 0) return 'seq: step value must not be zero';
      const out: string[] = [];
      for (let i = first; step > 0 ? i <= last : i >= last; i += step) {
        out.push(String(Number(i.toFixed(10))));
        if (out.length > 10000) break;
      }
      return out.join('\n');
    },
  },
  {
    name: 'nl',
    summary: 'number lines of files',
    usage: 'nl [-ba] [file...]',
    category: 'text',
    run: ({ args, shell, stdin }) => {
      const text = gather(args, shell, stdin, 'nl');
      if (text === null) return '';
      const allLines = args.includes('-ba');
      const lines = text.length ? text.split('\n') : [];
      let counter = 0;
      return lines
        .map((l) => {
          if (!allLines && l.trim() === '') return `      \t${l}`;
          counter += 1;
          return `${String(counter).padStart(6)}\t${l}`;
        })
        .join('\n');
    },
  },
];
