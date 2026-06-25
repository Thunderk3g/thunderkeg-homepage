'use client';

import { useCallback, useRef } from 'react';
import type { AppDefinition } from '../../types';
import { ToolConsole } from './ToolConsole';

const BANNER = String.raw`
    _/_/_/    _/_/_/    _/_/_/    _/_/    _/      _/        _/      _/    _/_/_/
   _/    _/  _/        _/        _/  _/  _/_/    _/        _/_/    _/  _/
  _/_/_/    _/_/      _/        _/    _/  _/  _/  _/      _/  _/  _/  _/  _/_/
 _/    _/  _/        _/        _/  _/    _/    _/_/      _/    _/_/  _/    _/
_/    _/  _/_/_/_/    _/_/_/    _/_/    _/      _/        _/      _/    _/_/_/

[recon-ng v5.1.2, Tim Tomes (@lanmaster53)]   (simulation)
   ⚠  Educational simulation only — no real OSINT is collected.
`;

const MODULES = [
  'recon/domains-hosts/brute_hosts',
  'recon/domains-hosts/hackertarget',
  'recon/domains-contacts/whois_pocs',
  'recon/companies-contacts/bing_linkedin_cache',
  'recon/hosts-hosts/resolve',
  'reporting/csv',
];

const HOST_POOL = ['www', 'mail', 'vpn', 'dev', 'api', 'staging', 'git', 'ns1', 'portal', 'autodiscover'];
const FIRST = ['john', 'sarah', 'mike', 'priya', 'liam', 'noah', 'emma', 'raj', 'ana', 'omar'];
const LAST = ['doe', 'khan', 'smith', 'patel', 'jones', 'lee', 'garcia', 'novak', 'osei', 'reyes'];
const TITLES = ['IT Admin', 'DevOps Engineer', 'HR Manager', 'CFO', 'Security Analyst', 'Sysadmin'];

interface ReconState {
  workspace: string;
  domain: string;
  module: string | null;
  hosts: string[];
  contacts: string[];
}

function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length);
}

function tableHosts(hosts: string[], print: (t: string) => void) {
  if (!hosts.length) {
    print('[*] No hosts in the database yet. Run a domains-hosts module first.');
    return;
  }
  print('  +' + '-'.repeat(54) + '+');
  print('  | ' + pad('host', 30) + '| ' + pad('ip_address', 20) + '|');
  print('  +' + '-'.repeat(54) + '+');
  hosts.forEach((h) => {
    const ip = '10.20.' + ((h.length * 7) % 255) + '.' + ((h.charCodeAt(0) * 3) % 255);
    print('  | ' + pad(h, 30) + '| ' + pad(ip, 20) + '|');
  });
  print('  +' + '-'.repeat(54) + '+');
  print(`[*] ${hosts.length} rows returned (simulation)`);
}

function tableContacts(contacts: string[], print: (t: string) => void) {
  if (!contacts.length) {
    print('[*] No contacts in the database yet. Run a contacts module first.');
    return;
  }
  contacts.forEach((c) => print('  ' + c));
  print(`[*] ${contacts.length} rows returned (simulation)`);
}

function runModule(st: ReconState, print: (t: string) => void) {
  if (!st.module) {
    print("[!] No module loaded. Use:  modules load <path>");
    return;
  }
  print(`[*] Running module ${st.module} (simulation)`);
  if (st.module.includes('domains-hosts')) {
    const n = 3 + Math.floor(Math.random() * 4);
    const added: string[] = [];
    for (let i = 0; i < n; i++) {
      const h = HOST_POOL[Math.floor(Math.random() * HOST_POOL.length)] + '.' + st.domain;
      if (!st.hosts.includes(h)) {
        st.hosts.push(h);
        added.push(h);
      }
    }
    added.forEach((h) => print(`[*] [host] ${h} (fabricated)`));
    print(`[+] ${added.length} total (${added.length} new) hosts found.`);
  } else if (st.module.includes('contacts')) {
    const n = 2 + Math.floor(Math.random() * 3);
    const added: string[] = [];
    for (let i = 0; i < n; i++) {
      const f = FIRST[Math.floor(Math.random() * FIRST.length)];
      const l = LAST[Math.floor(Math.random() * LAST.length)];
      const t = TITLES[Math.floor(Math.random() * TITLES.length)];
      const row = pad(`${f} ${l}`, 18) + pad(t, 18) + `${f}.${l}@${st.domain}`;
      if (!st.contacts.some((c) => c.includes(`${f}.${l}@`))) {
        st.contacts.push(row);
        added.push(row);
      }
    }
    added.forEach((c) => print(`[*] [contact] ${c} (fabricated)`));
    print(`[+] ${added.length} total (${added.length} new) contacts found.`);
  } else if (st.module.startsWith('reporting')) {
    print(`[*] ${st.hosts.length} rows of hosts and ${st.contacts.length} contacts written to '~/.recon-ng/report.csv'`);
  } else {
    print('[*] Module completed (no new records). (simulation)');
  }
}

function useReconHandler() {
  const stateRef = useRef<ReconState>({
    workspace: 'default',
    domain: 'megacorp.test',
    module: null,
    hosts: [],
    contacts: [],
  });

  return useCallback((cmd: string, print: (t: string) => void) => {
    const st = stateRef.current;
    const [c, ...rest] = cmd.split(/\s+/);
    const arg = rest.join(' ');
    switch (c) {
      case 'help':
      case '?':
        print('Commands: modules search/load <m>, options set SOURCE <domain>, info, run,');
        print('          show hosts|contacts|modules|workspaces, back, clear, exit');
        break;
      case 'modules':
        if (rest[0] === 'search' || rest[0] === 'list') {
          const q = rest.slice(1).join(' ');
          print('  Recon');
          print('  -----');
          MODULES.filter((m) => !q || m.includes(q)).forEach((m) => print('    ' + m));
        } else if (rest[0] === 'load' || rest[0] === 'use') {
          const m = MODULES.find((x) => x === rest[1] || x.endsWith('/' + rest[1]));
          if (m) {
            st.module = m;
            print(`[recon-ng][${st.workspace}][${m.split('/').pop()}] loaded.`);
          } else print(`[!] Invalid module path. Try: modules search ${rest[1] || ''}`.trim());
        } else print('Usage: modules search <q> | modules load <path>');
        break;
      case 'options':
        if (rest[0] === 'set' && rest[1] === 'SOURCE' && rest[2]) {
          st.domain = rest[2].replace(/^https?:\/\//, '').split('/')[0];
          print(`SOURCE => ${st.domain}`);
        } else print('Usage: options set SOURCE <domain>');
        break;
      case 'info':
        print(`  Module: ${st.module ?? '(none loaded)'}`);
        print(`  SOURCE: ${st.domain}    Workspace: ${st.workspace}`);
        print('  Note: this module is simulated; output is fabricated demo data.');
        break;
      case 'run':
      case 'exploit':
        runModule(st, print);
        break;
      case 'show':
        if (arg === 'hosts') tableHosts(st.hosts, print);
        else if (arg === 'contacts') tableContacts(st.contacts, print);
        else if (arg === 'modules') MODULES.forEach((m) => print('    ' + m));
        else if (arg === 'workspaces') print(`    ${st.workspace} (active)`);
        else print('Usage: show hosts | contacts | modules | workspaces');
        break;
      case 'back':
        st.module = null;
        print('[*] Unloaded current module.');
        break;
      case 'clear':
      case 'cls':
        print('\n\n');
        break;
      case 'exit':
      case 'quit':
        print('Use the window close button to exit.');
        break;
      default:
        print(`[!] Unknown command: ${c}. Type 'help'.`);
    }
  }, []);
}

function ReconNg() {
  const handle = useReconHandler();
  return (
    <ToolConsole
      banner={BANNER}
      prompt="[recon-ng][default] >"
      intro={"Try:  options set SOURCE megacorp.test  →  modules load hackertarget  →  run  →  show hosts"}
      onCommand={handle}
    />
  );
}

export const reconngApp: AppDefinition = {
  id: 'reconng',
  title: 'recon-ng',
  icon: '🛰️',
  category: 'Information Gathering',
  component: ReconNg,
  description: 'Web reconnaissance & OSINT framework (simulation)',
  defaultSize: { width: 760, height: 480 },
  minSize: { width: 440, height: 300 },
  launchCommands: ['recon-ng', 'reconng'],
};

export default ReconNg;
