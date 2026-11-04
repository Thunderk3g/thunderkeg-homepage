'use client';

import type { AppDefinition } from '../../types';
import { ToolConsole } from './ToolConsole';
import { getDb, getDbStatus } from '../../db/workspace';
import {
  addWorkspace,
  currentWorkspace,
  deleteWorkspace,
  hostsInWorkspace,
  listWorkspaces,
  msfTable,
  notesInWorkspace,
  recordScan,
  servicesInWorkspace,
  switchWorkspace,
  upsertHost,
} from '../../db/msf';
import { fakeAddress, scanServices } from './nmap';

const BANNER = String.raw`
       =[ metasploit v6.4.0-dev                          ]
+ -- --=[ 2398 exploits - 1235 auxiliary - 422 post       ]
+ -- --=[ 1391 payloads - 46 encoders - 11 nops           ]
+ -- --=[ 9 evasion                                        ]

   ⚠  Simulation only — for portfolio/education. No real targets.
`;

const MODULES = [
  'exploit/windows/smb/ms17_010_eternalblue',
  'exploit/multi/handler',
  'auxiliary/scanner/portscan/tcp',
  'exploit/unix/ftp/vsftpd_234_backdoor',
];

const DB_COMMANDS = new Set(['db_status', 'hosts', 'services', 'workspace', 'notes', 'db_nmap']);

/* The database commands are real: they query PostgreSQL 18 (PGlite) in this browser. */
async function handleDb(c: string, rest: string[], print: (t: string) => void) {
  if (getDbStatus().phase !== 'ready') print('[*] Connecting to the workspace database (PGlite)...');
  try {
    await getDb();
  } catch (e) {
    print(`[-] Database not available: ${e instanceof Error ? e.message : String(e)}`);
    print('[*] Continuing without a database (canned output only).');
    return;
  }
  const ws = currentWorkspace();
  switch (c) {
    case 'db_status': {
      const db = await getDb();
      const v = await db.query<{ version: string }>('select version()');
      print(`[*] Connected to msf. Connection type: postgresql (PGlite, in-browser).`);
      print(`[*] ${v.rows[0]?.version}`);
      print(`[*] Current workspace: ${ws}`);
      break;
    }
    case 'workspace': {
      if (rest[0] === '-a' && rest[1]) {
        await addWorkspace(rest[1]);
        print(`[*] Added workspace: ${rest[1]}\n[*] Workspace: ${rest[1]}`);
      } else if (rest[0] === '-d' && rest[1]) {
        if (rest[1] === 'portfolio') print('[-] Refusing to delete the default workspace.');
        else print((await deleteWorkspace(rest[1])) ? `[*] Deleted workspace: ${rest[1]}` : `[-] Workspace not found: ${rest[1]}`);
      } else if (rest[0] && !rest[0].startsWith('-')) {
        print((await switchWorkspace(rest[0])) ? `[*] Workspace: ${rest[0]}` : `[-] Workspace not found: ${rest[0]}`);
      } else {
        const all = await listWorkspaces();
        print(all.map((w) => (w === currentWorkspace() ? `* ${w}` : `  ${w}`)).join('\n'));
      }
      break;
    }
    case 'hosts': {
      if (rest[0] === '-a') {
        const addrs = rest.slice(1);
        if (!addrs.length) return print('Usage: hosts -a <addr> [addr ...]');
        for (const a of addrs) {
          try {
            await upsertHost({ address: a, comments: 'added from msfconsole (simulated lab)' });
            print(`[*] Time: ${new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC Host: host=${a}`);
          } catch (e) {
            print(`[-] ${a}: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
        break;
      }
      const rows = await hostsInWorkspace();
      print(
        msfTable(
          'Hosts',
          ['address', 'name', 'os_name', 'os_flavor', 'svcs', 'comments'],
          rows.map((h) => [h.address, h.name, h.os_name, h.os_flavor, h.svcs, h.comments]),
        ),
      );
      break;
    }
    case 'services': {
      const rows = await servicesInWorkspace();
      print(
        msfTable(
          'Services',
          ['host', 'port', 'proto', 'name', 'state', 'info'],
          rows.map((s) => [s.host, s.port, s.proto, s.name, s.state, s.info]),
        ),
      );
      break;
    }
    case 'notes': {
      const rows = await notesInWorkspace();
      print(
        msfTable(
          'Notes',
          ['Time', 'Host', 'Type', 'Data'],
          rows.map((n) => [String(n.created_at).slice(0, 19), n.host, n.ntype, JSON.stringify(n.data)]),
        ),
      );
      break;
    }
    case 'db_nmap': {
      const target = rest.filter((a) => !a.startsWith('-')).pop();
      if (!target) return print('Usage: db_nmap [nmap options] <target>');
      const flags = rest.filter((a) => a.startsWith('-')).join(' ');
      const profile = /-A|-sV/.test(flags) ? 'intense' : 'regular';
      const address = fakeAddress(target);
      const svcs = scanServices(profile);
      print(`[*] Nmap: Starting Nmap 7.94 ( https://nmap.org ) -- simulation, no packets sent`);
      print(`[*] Nmap: Nmap scan report for ${target}${target === address ? '' : ` (${address})`}`);
      print(`[*] Nmap: PORT     STATE SERVICE  VERSION`);
      for (const s of svcs) print(`[*] Nmap: ${`${s.port}/${s.proto}`.padEnd(8)} open  ${(s.name ?? '').padEnd(8)} ${s.info ?? ''}`.trimEnd());
      await recordScan(target, address, svcs, { os_name: 'Linux', source: 'db_nmap', flags });
      print(`[*] Nmap: Nmap done: 1 IP address (1 host up) scanned`);
      print(`[+] Saved ${address} and ${svcs.length} services to workspace '${ws}'. Try: hosts, services`);
      break;
    }
  }
}

async function handle(cmd: string, print: (t: string) => void) {
  const [c, ...rest] = cmd.split(/\s+/);
  const arg = rest.join(' ');
  if (DB_COMMANDS.has(c)) {
    try {
      await handleDb(c, rest, print);
    } catch (e) {
      print(`[-] ${e instanceof Error ? e.message : String(e)}`);
    }
    return;
  }
  switch (c) {
    case 'help':
    case '?':
      print('Core Commands: help, search, use, show, set, exploit, sessions, banner, exit');
      print('Database Backend Commands (real PostgreSQL in your browser):');
      print('  db_status, workspace [-a|-d] <name>, hosts [-a <addr>], services, notes, db_nmap <target>');
      break;
    case 'search':
      print('Matching Modules\n================\n');
      MODULES.filter((m) => !arg || m.includes(arg)).forEach((m, i) =>
        print(`   ${i}  ${m}   excellent  ${m.includes('eternalblue') ? 'Yes' : 'No'}  simulated module`),
      );
      break;
    case 'use':
      print(arg ? `[*] Using configured module ${arg}` : 'Usage: use <module>');
      break;
    case 'show':
      if (arg === 'options')
        print(
          'Module options:\n   Name    Current Setting  Required  Description\n   RHOSTS                   yes       target host(s)\n   RPORT   445              yes       target port',
        );
      else print('[*] (simulated) ' + (arg || 'options'));
      break;
    case 'set':
      print(`${rest[0]} => ${rest.slice(1).join(' ')}`);
      break;
    case 'exploit':
    case 'run':
      print('[*] Started reverse TCP handler');
      print('[*] (simulation) sending stage...');
      print('[+] meterpreter session 1 opened — but this is a demo, so nothing real happened. 😉');
      break;
    case 'sessions':
      print('Active sessions\n===============\n   No active sessions (simulation).');
      break;
    case 'banner':
      print(BANNER);
      break;
    case 'exit':
    case 'quit':
      print('Use the window close button to exit.');
      break;
    default:
      print(`[-] Unknown command: ${c}. Try 'help'.`);
  }
}

function Msfconsole() {
  return (
    <ToolConsole
      banner={BANNER}
      prompt="msf6 >"
      intro="Type 'help' for commands. Try: search eternalblue · db_status · hosts · db_nmap -sV 10.10.10.40"
      onCommand={handle}
    />
  );
}

export const msfconsoleApp: AppDefinition = {
  id: 'msfconsole',
  title: 'msfconsole',
  icon: '🎯',
  category: 'Exploitation Tools',
  component: Msfconsole,
  description: 'Metasploit Framework (simulation)',
  defaultSize: { width: 720, height: 460 },
  minSize: { width: 420, height: 280 },
  launchCommands: ['msfconsole', 'metasploit'],
};

export default Msfconsole;
