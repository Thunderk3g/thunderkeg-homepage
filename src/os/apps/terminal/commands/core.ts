import type { Command } from '../../../types';

const KALI_DRAGON = String.raw`
        ..,;:cc:.
     .;cccccccc:'.
   .:cccccccccccc:.
  .ccccc;'.    .;cc.       kali@kali
 .ccc:.           ..
.ccc.   ,ccccc:.            ------------------
ccc    .ccccccccc.          OS: Kali GNU/Linux Rolling
cc.    .cc'  .ccc.          Host: web-kali (browser)
cc.    'cc    ccc.          Shell: zsh 5.9
ccc    .cc.  .ccc.          DE: Xfce 4.18 (simulated)
'ccc.   '::ccc:'            WM: xfwm4
 .ccc.      ..              Terminal: qterminal
  .ccc:.                    CPU: V8 JavaScript Engine
   .:cccc:,.   .,           Memory: heap-allocated
     .;cccccccccc;.         Resolution: your viewport
        .,;:::;'.           Uptime: this session
`;

export const coreCommands: Command[] = [
  {
    name: 'clear',
    summary: 'clear the terminal screen',
    category: 'shell',
    run: ({ shell }) => shell.clear(),
  },
  {
    name: 'echo',
    summary: 'display a line of text',
    usage: 'echo [text...]',
    category: 'shell',
    run: ({ args, shell }) =>
      args.map((a) => (a.startsWith('$') ? shell.env[a.slice(1)] ?? '' : a)).join(' '),
  },
  {
    name: 'pwd',
    summary: 'print working directory',
    category: 'fs',
    run: ({ shell }) => shell.cwd,
  },
  {
    name: 'cd',
    summary: 'change directory',
    usage: 'cd [dir]',
    category: 'fs',
    run: ({ args, shell }) => {
      const target = args[0] ?? '~';
      const abs = shell.fs.resolve(target, shell.cwd);
      if (!shell.fs.exists(abs)) return `cd: no such file or directory: ${target}`;
      if (!shell.fs.isDir(abs)) return `cd: not a directory: ${target}`;
      shell.setCwd(abs);
    },
    complete: ({ args, shell }) => {
      const p = args[args.length - 1] ?? '';
      const slash = p.lastIndexOf('/');
      const dirPart = slash >= 0 ? p.slice(0, slash + 1) : '';
      const namePart = slash >= 0 ? p.slice(slash + 1) : p;
      return (shell.fs.list(dirPart || '.', shell.cwd) ?? [])
        .filter((n) => n.startsWith(namePart) && shell.fs.isDir(dirPart + n, shell.cwd))
        .map((n) => dirPart + n + '/');
    },
  },
  {
    name: 'ls',
    summary: 'list directory contents',
    usage: 'ls [-l] [-a] [path]',
    category: 'fs',
    run: ({ args, shell }) => {
      const flags = args.filter((a) => a.startsWith('-')).join('');
      const long = flags.includes('l');
      const all = flags.includes('a') || flags.includes('A');
      const pathArg = args.find((a) => !a.startsWith('-')) ?? '.';
      const node = shell.fs.get(pathArg, shell.cwd);
      if (!node) return `ls: cannot access '${pathArg}': No such file or directory`;
      if (node.type === 'file') return pathArg;
      let names = shell.fs.list(pathArg, shell.cwd) ?? [];
      if (all) names = ['.', '..', ...names];
      else names = names.filter((n) => !n.startsWith('.'));
      if (!long) {
        return names
          .map((n) => {
            const child = n === '.' || n === '..' ? node : shell.fs.get(pathArg + '/' + n, shell.cwd);
            return child?.type === 'dir' ? `${n}/` : n;
          })
          .join('  ');
      }
      return names
        .map((n) => {
          const child = n === '.' || n === '..' ? node : shell.fs.get(pathArg + '/' + n, shell.cwd);
          const isDir = child?.type === 'dir';
          const mode = (isDir ? 'd' : '-') + (child?.mode ?? 'rw-r--r--');
          const size = child?.type === 'file' ? (child.content?.length ?? 0) : 4096;
          const disp = isDir ? `${n}/` : n;
          return `${mode}  kali kali  ${String(size).padStart(6)}  ${disp}`;
        })
        .join('\n');
    },
    complete: ({ args, shell }) => shell.fs.list('.', shell.cwd) ?? [],
  },
  {
    name: 'cat',
    summary: 'concatenate and print files',
    usage: 'cat <file...>',
    category: 'fs',
    run: ({ args, shell, stdin }) => {
      if (args.length === 0 && stdin !== undefined) return stdin;
      return args
        .map((a) => {
          const content = shell.fs.read(a, shell.cwd);
          if (content === null)
            return shell.fs.isDir(a, shell.cwd)
              ? `cat: ${a}: Is a directory`
              : `cat: ${a}: No such file or directory`;
          return content;
        })
        .join('\n');
    },
    complete: ({ args, shell }) => shell.fs.list('.', shell.cwd) ?? [],
  },
  {
    name: 'mkdir',
    summary: 'make directories',
    usage: 'mkdir <dir>',
    category: 'fs',
    run: ({ args, shell }) => {
      if (!args[0]) return 'mkdir: missing operand';
      return shell.fs.mkdir(args[0], shell.cwd) ? undefined : `mkdir: cannot create directory '${args[0]}'`;
    },
  },
  {
    name: 'touch',
    summary: 'create an empty file / update timestamp',
    usage: 'touch <file>',
    category: 'fs',
    run: ({ args, shell }) => {
      if (!args[0]) return 'touch: missing file operand';
      shell.fs.touch(args[0], shell.cwd);
    },
  },
  {
    name: 'rm',
    summary: 'remove files or directories',
    usage: 'rm [-rf] <path>',
    category: 'fs',
    run: ({ args, shell }) => {
      const targets = args.filter((a) => !a.startsWith('-'));
      if (targets.length === 0) return 'rm: missing operand';
      for (const t of targets) {
        if (!shell.fs.exists(t, shell.cwd)) return `rm: cannot remove '${t}': No such file or directory`;
        shell.fs.remove(t, shell.cwd);
      }
    },
    complete: ({ args, shell }) => shell.fs.list('.', shell.cwd) ?? [],
  },
  {
    name: 'tree',
    summary: 'list contents of directories in a tree-like format',
    category: 'fs',
    run: ({ args, shell }) => {
      const root = args[0] ?? '.';
      if (!shell.fs.isDir(root, shell.cwd)) return `${root} [error opening dir]`;
      const lines: string[] = ['.'];
      const walk = (path: string, prefix: string) => {
        const names = shell.fs.list(path, shell.cwd) ?? [];
        names.forEach((n, i) => {
          const last = i === names.length - 1;
          const branch = last ? '└── ' : '├── ';
          const isDir = shell.fs.isDir(path + '/' + n, shell.cwd);
          lines.push(prefix + branch + (isDir ? n + '/' : n));
          if (isDir) walk(path + '/' + n, prefix + (last ? '    ' : '│   '));
        });
      };
      walk(root, '');
      return lines.join('\n');
    },
  },
  {
    name: 'head',
    summary: 'output the first part of files',
    usage: 'head [-n N] <file>',
    category: 'fs',
    run: ({ args, shell, stdin }) => {
      let n = 10;
      const ni = args.indexOf('-n');
      if (ni >= 0) n = parseInt(args[ni + 1], 10) || 10;
      const fileArg = args.find((a) => !a.startsWith('-') && a !== String(n));
      const content = fileArg ? shell.fs.read(fileArg, shell.cwd) : stdin;
      if (content == null) return fileArg ? `head: cannot open '${fileArg}'` : '';
      return content.split('\n').slice(0, n).join('\n');
    },
  },
  {
    name: 'tail',
    summary: 'output the last part of files',
    usage: 'tail [-n N] <file>',
    category: 'fs',
    run: ({ args, shell, stdin }) => {
      let n = 10;
      const ni = args.indexOf('-n');
      if (ni >= 0) n = parseInt(args[ni + 1], 10) || 10;
      const fileArg = args.find((a) => !a.startsWith('-') && a !== String(n));
      const content = fileArg ? shell.fs.read(fileArg, shell.cwd) : stdin;
      if (content == null) return fileArg ? `tail: cannot open '${fileArg}'` : '';
      return content.split('\n').slice(-n).join('\n');
    },
  },
  {
    name: 'grep',
    summary: 'print lines matching a pattern',
    usage: 'grep <pattern> [file]',
    category: 'text',
    run: ({ args, shell, stdin }) => {
      const pattern = args[0];
      if (!pattern) return 'usage: grep <pattern> [file]';
      const fileArg = args[1];
      const content = fileArg ? shell.fs.read(fileArg, shell.cwd) : stdin;
      if (content == null) return fileArg ? `grep: ${fileArg}: No such file or directory` : '';
      let re: RegExp;
      try {
        re = new RegExp(pattern, 'i');
      } catch {
        re = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      }
      return content
        .split('\n')
        .filter((l) => re.test(l))
        .join('\n');
    },
  },
  {
    name: 'wc',
    summary: 'word, line, byte count',
    usage: 'wc [-l|-w|-c] [file]',
    category: 'text',
    run: ({ args, shell, stdin }) => {
      const fileArg = args.find((a) => !a.startsWith('-'));
      const content = fileArg ? shell.fs.read(fileArg, shell.cwd) : stdin;
      if (content == null) return fileArg ? `wc: ${fileArg}: No such file` : '';
      const lines = content.split('\n').length;
      const words = content.split(/\s+/).filter(Boolean).length;
      const chars = content.length;
      if (args.includes('-l')) return String(lines);
      if (args.includes('-w')) return String(words);
      if (args.includes('-c')) return String(chars);
      return `${lines} ${words} ${chars}` + (fileArg ? ` ${fileArg}` : '');
    },
  },
  {
    name: 'whoami',
    summary: 'print effective user name',
    category: 'system',
    run: ({ shell }) => shell.user,
  },
  {
    name: 'id',
    summary: 'print user identity',
    category: 'system',
    run: ({ shell }) =>
      `uid=1000(${shell.user}) gid=1000(${shell.user}) groups=1000(${shell.user}),27(sudo)`,
  },
  {
    name: 'hostname',
    summary: 'show system hostname',
    category: 'system',
    run: ({ shell }) => shell.host,
  },
  {
    name: 'uname',
    summary: 'print system information',
    usage: 'uname [-a]',
    category: 'system',
    run: ({ args }) =>
      args.includes('-a')
        ? 'Linux kali 6.8.0-kali3-amd64 #1 SMP PREEMPT_DYNAMIC Kali 6.8.11 x86_64 GNU/Linux'
        : 'Linux',
  },
  {
    name: 'date',
    summary: 'print the system date and time',
    category: 'system',
    run: () => new Date().toString(),
  },
  {
    name: 'uptime',
    summary: 'tell how long the system has been running',
    category: 'system',
    run: () => {
      const secs = Math.floor(performance.now() / 1000);
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      return ` ${new Date().toLocaleTimeString()} up ${m} min ${s} sec,  1 user,  load average: 0.08, 0.03, 0.01`;
    },
  },
  {
    name: 'env',
    summary: 'print environment variables',
    category: 'system',
    run: ({ shell }) =>
      Object.entries(shell.env)
        .map(([k, v]) => `${k}=${v}`)
        .join('\n'),
  },
  {
    name: 'export',
    summary: 'set an environment variable',
    usage: 'export NAME=value',
    category: 'system',
    run: ({ args, shell }) => {
      for (const a of args) {
        const eq = a.indexOf('=');
        if (eq > 0) shell.env[a.slice(0, eq)] = a.slice(eq + 1);
      }
    },
  },
  {
    name: 'history',
    summary: 'command history',
    category: 'shell',
    run: ({ shell }) => shell.history.map((h, i) => `${String(i + 1).padStart(4)}  ${h}`).join('\n'),
  },
  {
    name: 'which',
    summary: 'locate a command',
    usage: 'which <cmd>',
    category: 'shell',
    run: ({ args }) => (args[0] ? `/usr/bin/${args[0]}` : 'which: missing argument'),
  },
  {
    name: 'neofetch',
    summary: 'show system info with the Kali dragon',
    category: 'system',
    run: () => KALI_DRAGON,
  },
  {
    name: 'sudo',
    summary: 'execute a command as another user',
    usage: 'sudo <command>',
    category: 'system',
    run: async ({ args, shell }) => {
      if (args.length === 0) return 'usage: sudo <command>';
      if (args[0] === 'rm' && args.includes('-rf') && (args.includes('/') || args.includes('/*'))) {
        return 'sudo: nice try. permission to nuke the universe denied.';
      }
      await shell.exec(args.join(' '));
    },
  },
  {
    name: 'apt',
    summary: 'package manager (simulated)',
    usage: 'apt <update|upgrade|install> [pkg]',
    category: 'system',
    run: ({ args }) => {
      const sub = args[0];
      if (sub === 'update')
        return 'Hit:1 http://kali.download/kali kali-rolling InRelease\nReading package lists... Done\nAll packages are up to date.';
      if (sub === 'upgrade') return '0 upgraded, 0 newly installed, 0 to remove and 0 not upgraded.';
      if (sub === 'install')
        return `Reading package lists... Done\nBuilding dependency tree... Done\n${args[1] ?? 'package'} is already the newest version (this is a simulation).`;
      return 'usage: apt <update|upgrade|install> [pkg]';
    },
  },
  {
    name: 'ping',
    summary: 'send ICMP ECHO_REQUEST (simulated)',
    usage: 'ping <host>',
    category: 'network',
    run: ({ args }) => {
      const host = args.find((a) => !a.startsWith('-')) ?? 'kali.org';
      const lines = [`PING ${host} (192.168.1.1) 56(84) bytes of data.`];
      for (let i = 0; i < 4; i++) {
        const t = (Math.random() * 12 + 1).toFixed(1);
        lines.push(`64 bytes from ${host}: icmp_seq=${i + 1} ttl=64 time=${t} ms`);
      }
      lines.push('', `--- ${host} ping statistics ---`, '4 packets transmitted, 4 received, 0% packet loss');
      return lines.join('\n');
    },
  },
  {
    name: 'ifconfig',
    summary: 'configure a network interface (simulated)',
    category: 'network',
    run: () =>
      [
        'eth0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500',
        '        inet 192.168.1.42  netmask 255.255.255.0  broadcast 192.168.1.255',
        '        ether 08:00:27:ab:cd:ef  txqueuelen 1000  (Ethernet)',
        'lo: flags=73<UP,LOOPBACK,RUNNING>  mtu 65536',
        '        inet 127.0.0.1  netmask 255.0.0.0',
      ].join('\n'),
  },
  {
    name: 'cowsay',
    summary: 'a talking cow',
    usage: 'cowsay <text>',
    category: 'fun',
    run: ({ args }) => {
      const text = args.join(' ') || 'moo';
      const top = ' ' + '_'.repeat(text.length + 2);
      const bot = ' ' + '-'.repeat(text.length + 2);
      return [
        top,
        `< ${text} >`,
        bot,
        '        \\   ^__^',
        '         \\  (oo)\\_______',
        '            (__)\\       )\\/\\',
        '                ||----w |',
        '                ||     ||',
      ].join('\n');
    },
  },
  {
    name: 'fortune',
    summary: 'print a random epigram',
    category: 'fun',
    run: () => {
      const fortunes = [
        'There are two ways to write error-free programs; only the third one works.',
        'rm -rf / is not a backup strategy.',
        'It works on my machine. — every developer, ever.',
        'The cloud is just someone else’s computer.',
        'sudo make me a sandwich.',
        'In theory, theory and practice are the same. In practice, they are not.',
        'A good threat model beats a thousand firewalls.',
      ];
      return fortunes[Math.floor(Math.random() * fortunes.length)];
    },
  },
];
