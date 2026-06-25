'use client';

import type { AppDefinition } from '../../types';
import { ToolConsole } from './ToolConsole';

const BANNER = String.raw`
        ___
       __H__
 ___ ___[.]_____ ___ ___  {1.8#stable}
|_ -| . [,]     | .'| . |
|___|_  [.]_|_|_|__,|  _|
      |_|V...       |_|   simulation

   ⚠  Educational simulation only — no real requests are sent. (simulation)
`;

const DB_NAMES = ['information_schema', 'mysql', 'performance_schema', 'shopdb', 'webapp'];

const TABLES: Record<string, string[]> = {
  shopdb: ['customers', 'orders', 'products', 'payments'],
  webapp: ['users', 'sessions', 'audit_log'],
};

const FAKE_USERS = [
  '1, admin,   5f4dcc3b5aa765d61d8327deb882cf99,  admin@example.test',
  '2, j.doe,   e10adc3949ba59abbe56e057f20f883e,  jdoe@example.test',
  '3, m.smith, 25d55ad283aa400af464c76d713c07ad,  msmith@example.test',
];

function targetFromArg(arg: string): string | null {
  const m = arg.match(/-u\s+(\S+)/) ?? arg.match(/--url[=\s]+(\S+)/);
  if (m) return m[1].replace(/^['"]|['"]$/g, '');
  return null;
}

function paramFromUrl(url: string): string {
  const q = url.split('?')[1];
  if (!q) return 'id';
  return q.split('&')[0].split('=')[0] || 'id';
}

function scan(url: string, print: (t: string) => void) {
  const param = paramFromUrl(url);
  const host = url.replace(/^https?:\/\//, '').split('/')[0] || 'target.test';
  print(`[*] starting @ ${new Date().toLocaleTimeString()} (simulation)`);
  print(`[*] testing connection to the target URL: ${url}`);
  print(`[*] checking if the target is protected by some kind of WAF/IPS`);
  print(`[*] testing if the target URL content is stable`);
  print(`[*] testing if GET parameter '${param}' is dynamic`);
  print(`[+] GET parameter '${param}' appears to be dynamic`);
  print(`[*] heuristic (basic) test shows that GET parameter '${param}' might be injectable`);
  print(`[+] GET parameter '${param}' is 'AND boolean-based blind' injectable`);
  print(`[+] GET parameter '${param}' is 'MySQL UNION query (NULL) - 3 columns' injectable`);
  print('---');
  print(`Parameter: ${param} (GET)`);
  print('    Type: boolean-based blind');
  print(`    Payload: ${param}=1 AND 4271=4271`);
  print('    Type: UNION query');
  print(`    Payload: ${param}=1 UNION ALL SELECT NULL,CONCAT(0x71,user()),NULL-- -`);
  print('---');
  print(`[*] the back-end DBMS is MySQL >= 5.0.12 on host '${host}'`);
  print("[*] done — try: --dbs  |  -D <db> --tables  |  -D webapp -T users --dump");
}

function handle(cmd: string, print: (t: string) => void) {
  const lower = cmd.toLowerCase();

  if (lower === 'help' || lower === '-h' || lower === '?') {
    print('Usage (simulated): sqlmap -u <url> [options]');
    print('  -u/--url <url>     target URL with a query parameter');
    print('  --dbs              enumerate databases');
    print('  -D <db> --tables   enumerate tables in a database');
    print('  -D <db> -T <t> --dump   dump table rows');
    print('  --banner           show DBMS banner   |   clear, help');
    return;
  }
  if (lower === 'clear' || lower === 'cls') {
    print('\n'.repeat(2));
    return;
  }
  if (lower === '--banner') {
    print('[+] banner: 5.7.40-0ubuntu0 (simulated)');
    return;
  }

  const url = targetFromArg(cmd);

  if (lower.includes('--dump')) {
    if (!url) {
      print('[!] need a target: sqlmap -u <url> -D webapp -T users --dump');
      return;
    }
    const tbl = (cmd.match(/-T\s+(\S+)/) ?? [])[1] ?? 'users';
    print(`[*] fetching entries for table '${tbl}' (simulation)`);
    print(`Database: webapp   Table: ${tbl}`);
    print('+----+---------+----------------------------------+---------------------+');
    print('| id | user    | password (md5)                   | email               |');
    print('+----+---------+----------------------------------+---------------------+');
    FAKE_USERS.forEach((r) => print('| ' + r.split(', ').join(' | ') + ' |'));
    print('+----+---------+----------------------------------+---------------------+');
    print('[i] all rows above are fabricated demo data — nothing was queried.');
    return;
  }

  if (lower.includes('--tables')) {
    if (!url) {
      print('[!] need a target: sqlmap -u <url> -D shopdb --tables');
      return;
    }
    const db = (cmd.match(/-D\s+(\S+)/) ?? [])[1] ?? 'shopdb';
    const tables = TABLES[db] ?? ['users', 'settings'];
    print(`[*] fetching tables for database: '${db}' (simulation)`);
    print(`Database: ${db}`);
    print('+-------------+');
    tables.forEach((t) => print(`| ${t.padEnd(11)} |`));
    print('+-------------+');
    return;
  }

  if (lower.includes('--dbs')) {
    if (!url) {
      print('[!] need a target: sqlmap -u <url> --dbs');
      return;
    }
    print('[*] fetching database names (simulation)');
    print(`available databases [${DB_NAMES.length}]:`);
    DB_NAMES.forEach((d) => print(`[*] ${d}`));
    print("[*] now try:  -D shopdb --tables");
    return;
  }

  if (url) {
    scan(url, print);
    return;
  }

  print(`[!] no recognised target. Try: sqlmap -u "http://target.test/item.php?id=1" --dbs`);
  print("    or type 'help'.");
}

function Sqlmap() {
  return (
    <ToolConsole
      banner={BANNER}
      prompt="sqlmap >"
      intro={'Try:  sqlmap -u "http://target.test/item.php?id=1"   then  --dbs'}
      onCommand={handle}
    />
  );
}

export const sqlmapApp: AppDefinition = {
  id: 'sqlmap',
  title: 'sqlmap',
  icon: '💉',
  category: 'Web Application Analysis',
  component: Sqlmap,
  description: 'Automatic SQL injection & DB takeover tool (simulation)',
  defaultSize: { width: 760, height: 480 },
  minSize: { width: 440, height: 300 },
  launchCommands: ['sqlmap'],
};

export default Sqlmap;
