'use client';

import type { AppDefinition } from '../../types';
import { ToolConsole } from './ToolConsole';

const BANNER = String.raw`
- Nikto v2.5.0  (simulation)
---------------------------------------------------------------------------
   ⚠  Educational demo only — no real requests are ever sent.
`;

interface Finding {
  id: string;
  osvdb: string;
  text: string;
}

const SERVERS = [
  'Apache/2.4.49 (Unix) OpenSSL/1.0.2k-fips PHP/5.6.40',
  'nginx/1.14.2',
  'Microsoft-IIS/8.5',
  'Apache/2.2.34 (Amazon)',
];

const FINDINGS: Finding[] = [
  { id: 'headers', osvdb: '0', text: 'The anti-clickjacking X-Frame-Options header is not present.' },
  { id: 'xss', osvdb: '0', text: 'The X-XSS-Protection header is not defined. This can allow reflected XSS.' },
  { id: 'ctype', osvdb: '0', text: 'The X-Content-Type-Options header is not set (MIME-sniffing possible).' },
  { id: 'outdated', osvdb: '0', text: 'Apache/2.4.49 appears outdated (current is at least 2.4.62). CVE-2021-41773 path traversal possible.' },
  { id: 'php', osvdb: '3092', text: 'PHP/5.6.40 is EOL and no longer receives security updates.' },
  { id: 'etag', osvdb: '0', text: 'Server may leak inodes via ETags, header found with file /, fields: 0x1234 0x59a.' },
  { id: 'icons', osvdb: '3268', text: '/icons/: Directory indexing found.' },
  { id: 'readme', osvdb: '3092', text: '/readme.html: Default file found, may reveal software version.' },
  { id: 'phpinfo', osvdb: '3233', text: '/phpinfo.php: Output from the phpinfo() function was found, exposing configuration.' },
  { id: 'admin', osvdb: '3268', text: '/admin/: This might be interesting (login or admin console).' },
  { id: 'gitcfg', osvdb: '0', text: '/.git/config: Git config file may expose repository metadata.' },
  { id: 'backup', osvdb: '0', text: '/backup.zip: Potential backup archive accessible without authentication.' },
];

const HELP = [
  'Usage:',
  '  scan <url>     run a simulated scan against a target (e.g. scan http://demo.test)',
  '  -h <host>      alias for scan',
  '  findings       list the canned checks this build can report',
  '  banner         reprint the banner',
  '  clear          (use the window button to reset)',
  '  help           show this message',
].join('\n');

function delay(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function normalizeTarget(raw: string): { host: string; url: string; ip: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  let host = withScheme.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0];
  if (!host) host = 'demo.test';
  const ip = `${10 + (host.length % 200)}.0.${host.length % 255}.${(host.charCodeAt(0) || 80) % 255}`;
  return { host, url: withScheme, ip };
}

async function runScan(target: string, print: (t: string) => void): Promise<void> {
  const t = normalizeTarget(target);
  if (!t) {
    print('[-] No target supplied. Try: scan http://demo.test');
    return;
  }
  const server = pick(SERVERS);
  const port = t.url.startsWith('https') ? 443 : 80;
  print(`+ Target IP:          ${t.ip}`);
  print(`+ Target Hostname:    ${t.host}`);
  print(`+ Target Port:        ${port}`);
  print('+ Start Time:         ' + new Date().toISOString().replace('T', ' ').slice(0, 19));
  print('---------------------------------------------------------------------------');
  await delay(220);
  print(`+ Server: ${server}`);
  await delay(160);

  const count = 5 + Math.floor(Math.random() * 4);
  const shuffled = [...FINDINGS].sort(() => Math.random() - 0.5).slice(0, count);
  let n = 0;
  for (const f of shuffled) {
    n += 1;
    await delay(140);
    print(`+ OSVDB-${f.osvdb}: ${f.text}`);
  }
  await delay(180);
  print('---------------------------------------------------------------------------');
  print(`+ ${n} host(s) tested — ${n} interesting item(s) reported.`);
  print('+ End Time: ' + new Date().toISOString().replace('T', ' ').slice(0, 19) + '  (simulation)');
}

function handle(cmd: string, print: (t: string) => void): void | Promise<void> {
  const [c, ...rest] = cmd.split(/\s+/);
  const arg = rest.join(' ');
  switch (c.toLowerCase()) {
    case 'help':
    case '?':
      print(HELP);
      return;
    case 'scan':
    case 'nikto':
      return runScan(arg, print);
    case '-h':
    case '--host':
      return runScan(arg, print);
    case 'findings':
      print('Canned checks in this build:');
      FINDINGS.forEach((f, i) => print(`  ${String(i + 1).padStart(2, ' ')}. ${f.text}`));
      return;
    case 'banner':
      print(BANNER);
      return;
    case 'clear':
      print('[*] Use the window controls to start a fresh session.');
      return;
    case 'exit':
    case 'quit':
      print('Use the window close button to exit.');
      return;
    default:
      print(`[-] Unknown command: ${c}. Type 'help'. Try: scan http://demo.test`);
      return;
  }
}

function Nikto() {
  return (
    <ToolConsole
      banner={BANNER}
      prompt="nikto >"
      intro="Type 'help' for usage. Try: scan http://demo.test"
      onCommand={handle}
    />
  );
}

export const niktoApp: AppDefinition = {
  id: 'nikto',
  title: 'nikto',
  icon: '🕷️',
  category: 'Web Application Analysis',
  component: Nikto,
  description: 'Nikto web server scanner (simulation)',
  defaultSize: { width: 760, height: 480 },
  minSize: { width: 440, height: 300 },
  launchCommands: ['nikto'],
};

export default Nikto;
