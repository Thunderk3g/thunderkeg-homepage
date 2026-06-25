'use client';

import type { AppDefinition } from '../../types';
import { ToolConsole } from './ToolConsole';

/* Educational simulation only — produces canned, realistic-looking gobuster
   output. No requests are ever sent; nothing on the network is touched. */

const BANNER = String.raw`
===============================================================
Gobuster v3.6
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
   ⚠  Simulation only — for portfolio/education. No real targets.
`;

interface Found {
  path: string;
  status: number;
  size: number;
  redirect?: string;
}

/* Canned "wordlist hits". Status/size are fixed so output is deterministic
   per path; a small random jitter is only used for timing/log noise. */
const HITS: Found[] = [
  { path: '/.htaccess', status: 403, size: 277 },
  { path: '/.htpasswd', status: 403, size: 277 },
  { path: '/admin', status: 301, size: 312, redirect: '/admin/' },
  { path: '/login', status: 200, size: 1842 },
  { path: '/dashboard', status: 302, size: 0, redirect: '/login' },
  { path: '/images', status: 301, size: 313, redirect: '/images/' },
  { path: '/css', status: 301, size: 310, redirect: '/css/' },
  { path: '/js', status: 301, size: 309, redirect: '/js/' },
  { path: '/uploads', status: 301, size: 314, redirect: '/uploads/' },
  { path: '/config.php', status: 200, size: 0 },
  { path: '/backup', status: 403, size: 277 },
  { path: '/robots.txt', status: 200, size: 142 },
  { path: '/server-status', status: 403, size: 277 },
  { path: '/api', status: 401, size: 95 },
  { path: '/.git', status: 301, size: 311, redirect: '/.git/' },
  { path: '/phpinfo.php', status: 200, size: 64211 },
];

const DEFAULT_URL = 'http://10.10.10.42';
const DEFAULT_WORDLIST = '/usr/share/wordlists/dirb/common.txt';
const TOTAL_WORDS = 4614;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function statusLine(f: Found): string {
  const status = `(Status: ${f.status})`;
  const size = `[Size: ${f.size}]`;
  const redir = f.redirect ? ` [--> ${f.redirect}]` : '';
  return `${f.path.padEnd(22)} ${status} ${size}${redir}`;
}

interface Opts {
  url: string;
  wordlist: string;
}

function parseOpts(args: string[]): Opts {
  const o: Opts = { url: DEFAULT_URL, wordlist: DEFAULT_WORDLIST };
  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '-u' || args[i] === '--url') && args[i + 1]) o.url = args[++i];
    else if ((args[i] === '-w' || args[i] === '--wordlist') && args[i + 1]) o.wordlist = args[++i];
  }
  return o;
}

async function runDir(opts: Opts, print: (t: string) => void): Promise<void> {
  print('===============================================================');
  print(`[+] Url:                     ${opts.url}`);
  print('[+] Method:                  GET');
  print('[+] Threads:                 10');
  print(`[+] Wordlist:                ${opts.wordlist}`);
  print('[+] Negative Status codes:   404');
  print('[+] User Agent:              gobuster/3.6');
  print('[+] Timeout:                 10s');
  print('===============================================================');
  print(`Starting gobuster in directory enumeration mode (${TOTAL_WORDS} words, simulated)`);
  print('===============================================================');

  for (const f of HITS) {
    await sleep(120 + Math.floor(Math.random() * 140));
    print(statusLine(f));
  }

  await sleep(200);
  print('===============================================================');
  print('Finished — 0 real requests sent (simulation).');
  print('===============================================================');
}

function handle(cmd: string, print: (t: string) => void): void | Promise<void> {
  const parts = cmd.split(/\s+/);
  const [c, sub, ...rest] = parts;

  if (c === 'help' || c === '?' || c === '-h' || c === '--help') {
    print('Usage:');
    print('  gobuster dir -u <url> -w <wordlist>   directory/file brute-force');
    print('  clear                                 reset the screen output');
    print('  exit                                  (use the window close button)');
    print('');
    print('Example: gobuster dir -u http://10.10.10.42 -w /usr/share/wordlists/dirb/common.txt');
    return;
  }

  if (c === 'exit' || c === 'quit') {
    print('Use the window close button to exit.');
    return;
  }

  if (c === 'version' || c === '--version') {
    print('gobuster version 3.6 (simulation)');
    return;
  }

  if (c !== 'gobuster') {
    print(`Error: unknown command "${c}". Try 'help' or 'gobuster dir -u <url> -w <wordlist>'.`);
    return;
  }

  if (sub !== 'dir') {
    print(`Error: mode "${sub ?? ''}" is not available in this simulation. Use: gobuster dir ...`);
    return;
  }

  return runDir(parseOpts(rest), print);
}

function Gobuster() {
  return (
    <ToolConsole
      banner={BANNER}
      prompt="gobuster $"
      intro="Type 'help' for usage. Try: gobuster dir -u http://10.10.10.42 -w /usr/share/wordlists/dirb/common.txt"
      onCommand={handle}
    />
  );
}

export const gobusterApp: AppDefinition = {
  id: 'gobuster',
  title: 'gobuster',
  icon: '📁',
  category: 'Web Application Analysis',
  component: Gobuster,
  description: 'Directory/file brute-forcer (simulation)',
  defaultSize: { width: 760, height: 480 },
  minSize: { width: 460, height: 300 },
  launchCommands: ['gobuster', 'dirbuster'],
};

export default Gobuster;
