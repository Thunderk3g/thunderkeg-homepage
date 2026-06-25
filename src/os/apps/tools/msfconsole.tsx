'use client';

import type { AppDefinition } from '../../types';
import { ToolConsole } from './ToolConsole';

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

function handle(cmd: string, print: (t: string) => void) {
  const [c, ...rest] = cmd.split(/\s+/);
  const arg = rest.join(' ');
  switch (c) {
    case 'help':
    case '?':
      print('Core Commands: help, search, use, show, set, exploit, sessions, banner, exit');
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
      intro="Type 'help' for commands. Try: search eternalblue"
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
