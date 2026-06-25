'use client';

import type { AppDefinition } from '../../types';
import { ToolConsole } from './ToolConsole';

const BANNER = String.raw`
   __  ___  _  _   _  _
  |__||  )||\| _|.   the Ripper  1.9.0-jumbo (simulation)
  John, the simulated edition — portfolio/education only.
  No real hashes are cracked here; output is canned.
`;

interface SimHash {
  user: string;
  hash: string;
  password: string;
  format: string;
}

const HASHES: SimHash[] = [
  { user: 'admin', hash: '5f4dcc3b5aa765d61d8327deb882cf99', password: 'password', format: 'raw-MD5' },
  { user: 'root', hash: '7c6a180b36896a0a8c02787eeafb0e4c', password: 'password1', format: 'raw-MD5' },
  { user: 'jsmith', hash: '0d107d09f5bbe40cade3de5c71e9e9b7', password: 'letmein', format: 'raw-MD5' },
  { user: 'guest', hash: '8621ffdbc5698829397d97767ac13db3', password: 'dragon', format: 'raw-MD5' },
  { user: 'svc_backup', hash: 'e10adc3949ba59abbe56e057f20f883e', password: '123456', format: 'raw-MD5' },
  { user: 'mwallace', hash: 'fcea920f7412b5da7be0cf42b8c93759', password: '1234567', format: 'raw-MD5' },
];

const WORDLIST = [
  '123456',
  'password',
  '12345678',
  'qwerty',
  'abc123',
  'password1',
  'letmein',
  'monkey',
  '1234567',
  'dragon',
];

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function showHashes(print: (t: string) => void) {
  print('hashes.txt (simulated):');
  HASHES.forEach((h) => print(`  ${h.user}:${h.hash}`));
}

function showWordlist(print: (t: string) => void) {
  print(`rockyou.txt (simulated, ${WORDLIST.length} entries shown):`);
  WORDLIST.forEach((w) => print(`  ${w}`));
}

async function crack(print: (t: string) => void) {
  print('Using default input encoding: UTF-8');
  print('Loaded 6 password hashes with no different salts (raw-MD5 [MD5 256/256 AVX2])');
  print('Proceeding with wordlist:rockyou.txt (simulated)');
  print('Press any key to abort... (simulation auto-runs)');
  print('');

  const start = Date.now();
  let cracked = 0;

  for (const h of HASHES) {
    await delay(420 + Math.floor(Math.random() * 360));
    cracked += 1;
    const elapsed = ((Date.now() - start) / 1000).toFixed(2);
    // John prints "password (username)" for each cracked hash.
    print(`${h.password.padEnd(14)}(${h.user})`);
    print(`     ↳ ${h.format}  guesses: ${cracked}  time: ${elapsed}s  ${cracked}/${HASHES.length} done`);
  }

  await delay(260);
  print('');
  print(`Session completed. ${cracked}/${HASHES.length} hashes cracked (simulation).`);
  print('Use the "--show" command to display cracked passwords.');
}

function show(print: (t: string) => void) {
  print('Cracked passwords (simulation):');
  HASHES.forEach((h) => print(`${h.user}:${h.password}`));
  print('');
  print(`${HASHES.length} password hashes cracked, 0 left`);
}

async function handle(cmd: string, print: (t: string) => void) {
  const [c] = cmd.split(/\s+/);
  switch (c) {
    case 'help':
    case '?':
      print('Commands (simulation):');
      print('  crack            run the wordlist attack against hashes.txt');
      print('  --show           display already-cracked passwords');
      print('  hashes           list the loaded (fake) hashes');
      print('  wordlist         preview the (fake) rockyou.txt');
      print('  status           show session status');
      print('  formats          list a few supported hash formats');
      print('  clear            (use window controls) / banner');
      break;
    case 'crack':
    case 'run':
    case 'john':
      await crack(print);
      break;
    case '--show':
    case 'show':
      show(print);
      break;
    case 'hashes':
      showHashes(print);
      break;
    case 'wordlist':
      showWordlist(print);
      break;
    case 'status':
      print('0g 0:00:00:00 DONE (simulation) — idle. Run "crack" to start.');
      break;
    case 'formats':
      print('Supported (subset, simulated): raw-MD5, NT, sha512crypt, bcrypt, descrypt, raw-SHA1, LM');
      break;
    case 'banner':
      print(BANNER);
      break;
    case 'exit':
    case 'quit':
      print('Use the window close button to exit.');
      break;
    default:
      print(`Unknown command: ${c || '(empty)'}. Try 'help'.`);
  }
}

function JohnConsole() {
  return (
    <ToolConsole
      banner={BANNER}
      prompt="john >"
      intro="Type 'help' for commands. Try: crack"
      onCommand={handle}
    />
  );
}

export const johnApp: AppDefinition = {
  id: 'john',
  title: 'John the Ripper',
  icon: '🔓',
  category: 'Password Attacks',
  component: JohnConsole,
  description: 'John the Ripper password cracker (simulation)',
  defaultSize: { width: 720, height: 460 },
  minSize: { width: 420, height: 280 },
  launchCommands: ['john', 'johntheripper'],
};

export default JohnConsole;
