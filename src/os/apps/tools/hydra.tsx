'use client';

import type { AppDefinition } from '../../types';
import { ToolConsole } from './ToolConsole';

const BANNER = String.raw`
Hydra v9.5 (c) 2024 by van Hauser/THC & David Maciejak - for legal purposes only

   ⚠  Simulation only — for portfolio/education. No real hosts are contacted.
`;

const USERS = ['root', 'admin', 'msfadmin', 'user', 'oracle', 'postgres'];
const PASSWORDS = [
  '123456',
  'password',
  'admin',
  'letmein',
  'qwerty',
  'toor',
  'root123',
  'changeme',
  'P@ssw0rd',
  'hunter2',
  'dragon',
  'monkey',
];

interface Target {
  host: string;
  service: string;
  port: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseTarget(arg: string): Target | null {
  // hydra -l <user> -P <list> <host> <service>
  const tokens = arg.split(/\s+/).filter(Boolean);
  let host = '';
  let service = 'ssh';
  for (const t of tokens) {
    if (t.startsWith('-')) continue;
    if (!host) host = t;
    else service = t;
  }
  if (!host) return null;
  const ports: Record<string, number> = {
    ssh: 22,
    ftp: 21,
    telnet: 23,
    smtp: 25,
    http: 80,
    'http-get': 80,
    mysql: 3306,
    rdp: 3389,
    'postgres': 5432,
    smb: 445,
  };
  return { host, service, port: ports[service] ?? 22 };
}

async function runAttack(arg: string, print: (t: string) => void): Promise<void> {
  const target = parseTarget(arg);
  if (!target) {
    print('Usage: hydra -l <user> -P <wordlist> <host> <service>');
    print("Example: hydra -l root -P /usr/share/wordlists/rockyou.txt 10.0.0.5 ssh");
    return;
  }
  const stamp = new Date().toTimeString().slice(0, 8);
  print(`[DATA] attacking ${target.service}://${target.host}:${target.port}/`);
  print(
    `[STATUS] starting attack against ${target.host} — ${USERS.length} logins, ${PASSWORDS.length} passwords (simulation)`,
  );

  // Pick a "winning" combination deterministically-ish at runtime.
  const winUser = USERS[Math.floor(Math.random() * USERS.length)];
  const winPass = PASSWORDS[Math.floor(Math.random() * (PASSWORDS.length - 2)) + 2];

  let tried = 0;
  for (const pass of PASSWORDS) {
    const user = USERS[tried % USERS.length];
    tried += 1;
    await sleep(140);
    if (user === winUser && pass === winPass) {
      print(
        `[${target.port}][${target.service}] host: ${target.host}   login: ${user}   password: ${pass}`,
      );
      print('[STATUS] valid pair found — halting remaining attempts');
      break;
    }
    print(`[ATTEMPT] target ${target.host} - login "${user}" - pass "${pass}" - ${tried}/${PASSWORDS.length}`);
  }

  print('');
  print(`1 of 1 target successfully completed, 1 valid password found`);
  print(
    `Hydra (https://github.com/vanhauser-thc/thc-hydra) finished at ${stamp} (simulation — no real login occurred)`,
  );
}

function handle(cmd: string, print: (t: string) => void): void | Promise<void> {
  const trimmed = cmd.trim();
  const [c, ...rest] = trimmed.split(/\s+/);
  const arg = rest.join(' ');
  switch (c) {
    case 'help':
    case '?':
      print('Commands: hydra <opts> <host> <service>, services, wordlists, banner, clear, exit');
      print('Options: -l <user>  -L <userlist>  -P <passlist>  -t <tasks>  -V');
      break;
    case 'hydra':
      return runAttack(arg, print);
    case 'services':
      print('Supported (simulated) modules:');
      print('  ssh ftp telnet smtp http-get mysql rdp postgres smb');
      break;
    case 'wordlists':
      print('Available wordlists (simulated):');
      print('  /usr/share/wordlists/rockyou.txt        (14,344,392 entries)');
      print('  /usr/share/wordlists/fasttrack.txt      (262 entries)');
      print('  /usr/share/wordlists/metasploit/unix_passwords.txt');
      break;
    case 'banner':
      print(BANNER);
      break;
    case 'clear':
      print('(use the window controls; history retained in simulation)');
      break;
    case 'exit':
    case 'quit':
      print('Use the window close button to exit.');
      break;
    default:
      print(`[ERROR] unknown command: ${c}. Try 'help' or run 'hydra -l root -P rockyou.txt 10.0.0.5 ssh'.`);
  }
}

function Hydra() {
  return (
    <ToolConsole
      banner={BANNER}
      prompt="hydra$"
      intro="Type 'help'. Try: hydra -l root -P /usr/share/wordlists/rockyou.txt 10.0.0.5 ssh"
      onCommand={handle}
    />
  );
}

export const hydraApp: AppDefinition = {
  id: 'hydra',
  title: 'THC-Hydra',
  icon: '🐍',
  category: 'Password Attacks',
  component: Hydra,
  description: 'THC-Hydra parallel login cracker (simulation)',
  defaultSize: { width: 760, height: 480 },
  minSize: { width: 440, height: 300 },
  launchCommands: ['hydra', 'thc-hydra'],
};

export default Hydra;
