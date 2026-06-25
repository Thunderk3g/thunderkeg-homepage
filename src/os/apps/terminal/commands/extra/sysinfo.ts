'use client';

import type { Command } from '../../../../types';

/**
 * System-information terminal commands for the simulated Kali shell.
 * Everything here is canned / simulated — no real processes are touched.
 */

interface Proc {
  pid: number;
  user: string;
  cpu: number;
  mem: number;
  vsz: number;
  rss: number;
  stat: string;
  time: string;
  cmd: string;
}

const PROCS: Proc[] = [
  { pid: 1, user: 'root', cpu: 0.0, mem: 0.3, vsz: 168204, rss: 12480, stat: 'Ss', time: '0:04', cmd: '/sbin/init splash' },
  { pid: 412, user: 'root', cpu: 0.0, mem: 0.1, vsz: 24960, rss: 5120, stat: 'Ss', time: '0:00', cmd: '/lib/systemd/systemd-journald' },
  { pid: 588, user: 'root', cpu: 0.0, mem: 0.2, vsz: 47820, rss: 8960, stat: 'Ss', time: '0:01', cmd: '/usr/sbin/NetworkManager --no-daemon' },
  { pid: 901, user: 'root', cpu: 0.1, mem: 0.4, vsz: 312040, rss: 18020, stat: 'Ssl', time: '0:09', cmd: '/usr/sbin/xfwm4' },
  { pid: 1042, user: 'kali', cpu: 0.0, mem: 0.6, vsz: 421360, rss: 30210, stat: 'Sl', time: '0:12', cmd: 'xfce4-panel' },
  { pid: 1337, user: 'kali', cpu: 0.4, mem: 1.1, vsz: 998240, rss: 58740, stat: 'Sl', time: '0:21', cmd: 'qterminal' },
  { pid: 1602, user: 'kali', cpu: 0.0, mem: 0.2, vsz: 17640, rss: 6020, stat: 'Ss', time: '0:00', cmd: 'zsh' },
  { pid: 2048, user: 'kali', cpu: 7.3, mem: 9.4, vsz: 2841320, rss: 502140, stat: 'Sl', time: '1:48', cmd: 'firefox-esr' },
  { pid: 2210, user: 'kali', cpu: 0.0, mem: 0.5, vsz: 188420, rss: 27410, stat: 'S', time: '0:02', cmd: 'pulseaudio --daemonize=no' },
  { pid: 3001, user: 'kali', cpu: 1.2, mem: 2.0, vsz: 612080, rss: 104880, stat: 'Sl', time: '0:33', cmd: 'code --type=renderer' },
  { pid: 4096, user: 'kali', cpu: 0.0, mem: 0.1, vsz: 19320, rss: 4180, stat: 'R+', time: '0:00', cmd: 'ps aux' },
];

const pad = (s: string | number, n: number): string => String(s).padEnd(n);
const padL = (s: string | number, n: number): string => String(s).padStart(n);

export const sysinfoCommands: Command[] = [
  {
    name: 'ps',
    summary: 'report a snapshot of current processes',
    usage: 'ps [aux]',
    category: 'system',
    run: ({ args }) => {
      const full = args.some((a) => a.includes('a') || a.includes('u') || a.includes('x') || a === '-ef');
      if (!full) {
        const head = `${padL('PID', 7)} TTY          TIME CMD`;
        const rows = PROCS.filter((p) => p.user === 'kali' && /zsh|qterminal|ps/.test(p.cmd)).map(
          (p) => `${padL(p.pid, 7)} pts/0    00:00:${p.time.split(':')[1].padStart(2, '0')} ${p.cmd.split(' ')[0]}`,
        );
        return [head, ...rows].join('\n');
      }
      const head = `${pad('USER', 9)}${padL('PID', 5)} ${padL('%CPU', 4)} ${padL('%MEM', 4)} ${padL('VSZ', 8)} ${padL('RSS', 6)} STAT  TIME COMMAND`;
      const rows = PROCS.map(
        (p) =>
          `${pad(p.user, 9)}${padL(p.pid, 5)} ${padL(p.cpu.toFixed(1), 4)} ${padL(p.mem.toFixed(1), 4)} ${padL(p.vsz, 8)} ${padL(p.rss, 6)} ${pad(p.stat, 5)} ${padL(p.time, 4)} ${p.cmd}`,
      );
      return [head, ...rows].join('\n');
    },
  },
  {
    name: 'top',
    summary: 'display tasks and system summary (one-shot)',
    usage: 'top',
    category: 'system',
    run: () => {
      const now = new Date().toLocaleTimeString();
      const header = [
        `top - ${now} up 47 min,  1 user,  load average: 0.14, 0.09, 0.04`,
        'Tasks:  11 total,   1 running,  10 sleeping,   0 stopped,   0 zombie',
        '%Cpu(s):  9.8 us,  2.1 sy,  0.0 ni, 87.6 id,  0.3 wa,  0.0 hi,  0.2 si,  0.0 st',
        'MiB Mem :   7976.0 total,   2841.4 free,   3402.1 used,   1732.5 buff/cache',
        'MiB Swap:   2048.0 total,   2048.0 free,      0.0 used.   4118.6 avail Mem',
        '',
        `${padL('PID', 6)} ${pad('USER', 8)} PR  NI    VIRT    RES  S  %CPU  %MEM     TIME+ COMMAND`,
      ];
      const rows = [...PROCS]
        .sort((a, b) => b.cpu - a.cpu)
        .map(
          (p) =>
            `${padL(p.pid, 6)} ${pad(p.user, 8)}20   0 ${padL(p.vsz, 7)} ${padL(p.rss, 6)}  ${p.stat[0]} ${padL(p.cpu.toFixed(1), 5)} ${padL(p.mem.toFixed(1), 5)} ${padL(p.time + '.00', 9)} ${p.cmd.split(' ')[0]}`,
        );
      return [...header, ...rows].join('\n');
    },
  },
  {
    name: 'free',
    summary: 'display amount of free and used memory',
    usage: 'free [-h|-m]',
    category: 'system',
    run: ({ args }) => {
      const human = args.includes('-h');
      const v = (mb: number): string => (human ? `${(mb / 1024).toFixed(1)}Gi` : String(mb));
      const head = `${pad('', 14)}${padL('total', 9)} ${padL('used', 9)} ${padL('free', 9)} ${padL('shared', 9)} ${padL('buff/cache', 11)} ${padL('available', 9)}`;
      const mem = `${pad('Mem:', 14)}${padL(v(7976), 9)} ${padL(v(3402), 9)} ${padL(v(2841), 9)} ${padL(v(184), 9)} ${padL(v(1733), 11)} ${padL(v(4119), 9)}`;
      const swap = `${pad('Swap:', 14)}${padL(v(2048), 9)} ${padL(v(0), 9)} ${padL(v(2048), 9)}`;
      return [head, mem, swap].join('\n');
    },
  },
  {
    name: 'df',
    summary: 'report file system disk space usage',
    usage: 'df [-h]',
    category: 'system',
    run: ({ args }) => {
      const h = args.includes('-h');
      const rows = [
        ['Filesystem', 'Size', 'Used', 'Avail', 'Use%', 'Mounted on'],
        ['/dev/sda1', h ? '79G' : '82506716', h ? '38G' : '39845112', h ? '37G' : '38461604', '52%', '/'],
        ['tmpfs', h ? '3.9G' : '4083712', h ? '1.2M' : '1228', h ? '3.9G' : '4082484', '1%', '/dev/shm'],
        ['tmpfs', h ? '798M' : '816742', h ? '1.5M' : '1532', h ? '797M' : '815210', '1%', '/run'],
        ['/dev/sda2', h ? '511M' : '523248', h ? '6.1M' : '6248', h ? '505M' : '517000', '2%', '/boot/efi'],
      ];
      return rows
        .map(
          ([fs, size, used, avail, use, mnt]) =>
            `${pad(fs, 16)}${padL(size, 8)} ${padL(used, 8)} ${padL(avail, 8)} ${padL(use, 4)} ${mnt}`,
        )
        .join('\n');
    },
  },
  {
    name: 'du',
    summary: 'estimate file space usage',
    usage: 'du [-h] [-s] [path]',
    category: 'system',
    run: ({ args }) => {
      const h = args.includes('-h');
      const summary = args.includes('-s');
      const path = args.find((a) => !a.startsWith('-')) ?? '.';
      const entries: Array<[string, number]> = [
        [`${path}/.config`, 12480],
        [`${path}/.cache`, 88204],
        [`${path}/Desktop`, 16],
        [`${path}/Documents`, 4096],
        [`${path}/Downloads`, 204816],
        [`${path}/.local`, 41020],
        [path, 350648],
      ];
      const fmt = (kb: number): string => (h ? (kb >= 1024 ? `${(kb / 1024).toFixed(1)}M` : `${kb}K`) : String(kb));
      const list = summary ? entries.slice(-1) : entries;
      return list.map(([p, kb]) => `${pad(fmt(kb), 8)}${p}`).join('\n');
    },
  },
  {
    name: 'lscpu',
    summary: 'display information about the CPU architecture',
    category: 'system',
    run: () =>
      [
        'Architecture:            x86_64',
        '  CPU op-mode(s):        32-bit, 64-bit',
        '  Address sizes:         39 bits physical, 48 bits virtual',
        '  Byte Order:            Little Endian',
        'CPU(s):                  4',
        '  On-line CPU(s) list:   0-3',
        'Vendor ID:               GenuineIntel',
        '  Model name:            Intel(R) Core(TM) i5-8250U CPU @ 1.60GHz',
        '    CPU family:          6',
        '    Model:               142',
        '    Thread(s) per core:  2',
        '    Core(s) per socket:  2',
        '    Socket(s):           1',
        '    CPU max MHz:         3400.0000',
        '    CPU min MHz:         400.0000',
        'Virtualization:          VT-x',
        'Caches (sum of all):',
        '  L1d:                   64 KiB',
        '  L1i:                   64 KiB',
        '  L2:                    512 KiB',
        '  L3:                    6 MiB',
      ].join('\n'),
  },
  {
    name: 'lsblk',
    summary: 'list block devices',
    category: 'system',
    run: () =>
      [
        'NAME   MAJ:MIN RM   SIZE RO TYPE MOUNTPOINTS',
        'sda      8:0    0    80G  0 disk',
        '├─sda1   8:1    0  79.5G  0 part /',
        '└─sda2   8:2    0   512M  0 part /boot/efi',
        'sr0     11:0    1  1024M  0 rom',
      ].join('\n'),
  },
  {
    name: 'kill',
    summary: 'send a signal to a process (simulated)',
    usage: 'kill [-9] <pid>',
    category: 'system',
    run: ({ args }) => {
      const pidArg = args.find((a) => !a.startsWith('-'));
      if (!pidArg) return 'kill: usage: kill [-s sigspec | -n signum | -sigspec] pid';
      const pid = Number(pidArg);
      if (!Number.isInteger(pid)) return `kill: ${pidArg}: arguments must be process or job IDs`;
      const proc = PROCS.find((p) => p.pid === pid);
      if (!proc) return `kill: (${pid}): No such process`;
      if (pid === 1) return `kill: (1): Operation not permitted`;
      return `[${proc.cmd.split(' ')[0]}] terminated (pid ${pid})`;
    },
  },
  {
    name: 'jobs',
    summary: 'list active jobs',
    usage: 'jobs [-l]',
    category: 'shell',
    run: ({ args }) => {
      const long = args.includes('-l');
      const rows = [
        { spec: '[1]', flag: '-', pid: 2048, state: 'Running', cmd: 'firefox-esr &' },
        { spec: '[2]', flag: '+', pid: 3001, state: 'Stopped', cmd: 'code --wait notes.md' },
      ];
      return rows
        .map((j) =>
          long
            ? `${j.spec}${j.flag} ${padL(j.pid, 6)} ${pad(j.state, 8)}  ${j.cmd}`
            : `${j.spec}${j.flag}  ${pad(j.state, 8)}  ${j.cmd}`,
        )
        .join('\n');
    },
  },
];
