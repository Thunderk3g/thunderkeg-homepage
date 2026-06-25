import type { Command, CommandContext, ShellApi } from '../../types';
import { FileSystem } from '../../fs/filesystem';

export interface ShellOptions {
  fs: FileSystem;
  commands: Map<string, Command>;
  user: string;
  host: string;
  launch: (appId: string, args?: Record<string, unknown>) => void;
  onOutput: (text: string) => void;
  onClear: () => void;
}

/** Parses & executes terminal command lines against the in-memory FS. */
export class Shell {
  cwd = '/home/kali';
  env: Record<string, string> = { HOME: '/home/kali', USER: 'kali', SHELL: '/usr/bin/zsh', PWD: '/home/kali', TERM: 'xterm-256color' };
  history: string[] = [];
  aliases: Record<string, string> = { ll: 'ls -la', la: 'ls -A', '..': 'cd ..', cls: 'clear' };

  private fs: FileSystem;
  private commands: Map<string, Command>;
  private opts: ShellOptions;

  constructor(opts: ShellOptions) {
    this.opts = opts;
    this.fs = opts.fs;
    this.commands = opts.commands;
    this.env.USER = opts.user;
  }

  get api(): ShellApi {
    return {
      fs: this.fs,
      cwd: this.cwd,
      setCwd: (p) => {
        this.cwd = p;
        this.env.PWD = p;
      },
      env: this.env,
      user: this.opts.user,
      host: this.opts.host,
      history: this.history,
      launch: this.opts.launch,
      clear: this.opts.onClear,
      exec: (line) => this.run(line),
    };
  }

  prompt(): string {
    const home = '/home/kali';
    let p = this.cwd;
    if (p === home) p = '~';
    else if (p.startsWith(home + '/')) p = '~' + p.slice(home.length);
    return p;
  }

  completions(line: string): string[] {
    const tokens = line.split(/\s+/);
    const partial = tokens[tokens.length - 1] ?? '';
    if (tokens.length <= 1) {
      const names = [...this.commands.keys(), ...Object.keys(this.aliases)];
      return names.filter((n) => n.startsWith(partial)).sort();
    }
    const cmd = this.commands.get(tokens[0]);
    if (cmd?.complete) {
      return cmd.complete({ args: tokens.slice(1), shell: this.api });
    }
    // default: path completion
    return this.pathComplete(partial);
  }

  pathComplete(partial: string): string[] {
    const slash = partial.lastIndexOf('/');
    const dirPart = slash >= 0 ? partial.slice(0, slash + 1) : '';
    const namePart = slash >= 0 ? partial.slice(slash + 1) : partial;
    const listing = this.fs.list(dirPart || '.', this.cwd) ?? [];
    return listing
      .filter((n) => n.startsWith(namePart))
      .map((n) => {
        const abs = dirPart + n;
        return this.fs.isDir(abs, this.cwd) ? abs + '/' : abs;
      });
  }

  private tokenize(input: string): string[] {
    const out: string[] = [];
    let cur = '';
    let quote: '"' | "'" | null = null;
    for (let i = 0; i < input.length; i++) {
      const c = input[i];
      if (quote) {
        if (c === quote) quote = null;
        else cur += c;
      } else if (c === '"' || c === "'") {
        quote = c;
      } else if (c === ' ' || c === '\t') {
        if (cur) {
          out.push(cur);
          cur = '';
        }
      } else {
        cur += c;
      }
    }
    if (cur) out.push(cur);
    return out;
  }

  async run(rawLine: string): Promise<void> {
    const line = rawLine.trim();
    if (!line) return;
    if (line !== this.history[this.history.length - 1]) this.history.push(line);

    // && chaining
    for (const segment of line.split('&&')) {
      const ok = await this.runPipeline(segment.trim());
      if (!ok) break;
    }
  }

  private async runPipeline(segment: string): Promise<boolean> {
    if (!segment) return true;
    const stages = segment.split('|').map((s) => s.trim());
    let stdin: string | undefined;
    let lastOk = true;
    for (let i = 0; i < stages.length; i++) {
      const isLast = i === stages.length - 1;
      const { ok, output, suppressed } = await this.runSingle(stages[i], stdin, !isLast);
      lastOk = ok;
      if (isLast) {
        if (!suppressed && output) this.opts.onOutput(output);
      } else {
        stdin = output;
      }
    }
    return lastOk;
  }

  private async runSingle(
    cmdLine: string,
    stdin: string | undefined,
    piped: boolean,
  ): Promise<{ ok: boolean; output: string; suppressed: boolean }> {
    // redirection
    let redirect: { path: string; append: boolean } | null = null;
    let work = cmdLine;
    const appendMatch = work.match(/\s*>>\s*(\S+)\s*$/);
    const writeMatch = work.match(/\s*>\s*(\S+)\s*$/);
    if (appendMatch) {
      redirect = { path: appendMatch[1], append: true };
      work = work.slice(0, appendMatch.index).trim();
    } else if (writeMatch) {
      redirect = { path: writeMatch[1], append: false };
      work = work.slice(0, writeMatch.index).trim();
    }

    let tokens = this.tokenize(work);
    if (tokens.length === 0) return { ok: true, output: '', suppressed: false };

    // alias expansion (one level)
    if (this.aliases[tokens[0]]) {
      tokens = this.tokenize(this.aliases[tokens[0]] + ' ' + tokens.slice(1).join(' '));
    }

    const name = tokens[0];
    const args = tokens.slice(1);
    const cmd = this.commands.get(name);

    let buffer = '';
    const ctx: CommandContext = {
      args,
      raw: cmdLine,
      stdin,
      print: (t = '') => {
        buffer += t + '\n';
      },
      write: (t) => {
        buffer += t;
      },
      shell: this.api,
    };

    if (!cmd) {
      const msg = `zsh: command not found: ${name}`;
      if (redirect) return { ok: false, output: '', suppressed: true };
      return { ok: false, output: msg, suppressed: piped };
    }

    let ok = true;
    try {
      const result = await cmd.run(ctx);
      if (typeof result === 'string') buffer += (buffer && !buffer.endsWith('\n') ? '\n' : '') + result;
    } catch (e) {
      buffer += `error: ${(e as Error).message}`;
      ok = false;
    }

    const trimmed = buffer.replace(/\n$/, '');

    if (redirect) {
      const ok2 = redirect.append
        ? this.fs.append(redirect.path, buffer, this.cwd)
        : this.fs.write(redirect.path, buffer, this.cwd);
      return { ok: ok && ok2, output: '', suppressed: true };
    }

    return { ok, output: trimmed, suppressed: false };
  }
}
