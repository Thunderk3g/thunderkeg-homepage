import type { Command } from '../../../types';
import { DATA_DIR, getDb, getDbStatus } from '../../../db/workspace';
import { cellText, errorText, formatTable, runInput, type SqlError } from '../../../db/sql';

/* psql / msfdb / pg_dump against the real in-browser PostgreSQL (PGlite). */

const FLAGS_WITH_VALUE = new Set(['-d', '-U', '-h', '-p', '--dbname', '--username', '--host', '--port']);

async function runAndFormat(sql: string): Promise<string> {
  try {
    const r = await runInput(sql);
    if (r.text) return r.text;
    return r.results.map(formatTable).join('\n\n');
  } catch (e) {
    return errorText(e as SqlError, sql);
  }
}

const psql: Command = {
  name: 'psql',
  summary: 'PostgreSQL 18 interactive terminal (real, in-browser via PGlite)',
  usage: 'psql [-c "<sql>"] | psql <sql…>   (no args opens the psql app)',
  category: 'database',
  run: async ({ args, shell, stdin }) => {
    let sql: string | null = null;
    const rest: string[] = [];
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === '-c' || a === '--command') sql = args[++i] ?? '';
      else if (a.startsWith('--command=')) sql = a.slice(10);
      else if (FLAGS_WITH_VALUE.has(a)) i++;
      else if (a === '--help' || a === '-?') return 'usage: psql [-c "<sql>"] [<sql…>]\nWith no arguments the psql app opens.';
      else if (a === '--version' || a === '-V') return `psql (PostgreSQL) ${(await version()).replace(/^PostgreSQL /, '')}`;
      else rest.push(a);
    }
    if (sql === null && rest.length) sql = rest.join(' ');
    if (sql === null && stdin) sql = stdin;
    if (sql === null) {
      shell.launch('psql');
      return 'opening psql — PostgreSQL 18 (PGlite)…';
    }
    return runAndFormat(sql);
  },
};

async function version(): Promise<string> {
  const db = await getDb();
  const r = await db.query<{ v: string }>(`select substring(version() from 'PostgreSQL [0-9.]+') as v`);
  return r.rows[0]?.v ?? 'PostgreSQL';
}

const msfdb: Command = {
  name: 'msfdb',
  summary: 'manage the Metasploit workspace database (real PostgreSQL via PGlite)',
  usage: 'msfdb status|init|run',
  category: 'database',
  run: async ({ args, shell }) => {
    const sub = args[0] ?? 'status';
    if (sub === 'run' || sub === 'console') {
      shell.launch('psql');
      return '[+] Starting database\n[*] opening psql against the msf workspace…';
    }
    if (sub === 'init' || sub === 'start' || sub === 'status') {
      const before = getDbStatus().phase;
      try {
        const db = await getDb();
        const st = getDbStatus();
        const v = await db.query<{ version: string }>('select version()');
        const counts = await db.query<{ t: string; n: number }>(
          ['workspaces', 'hosts', 'services', 'notes', 'loot', 'creds', 'papers', 'events']
            .map((t) => `select '${t}' as t, count(*)::int as n from ${t}`)
            .join(' union all '),
        );
        const out: string[] = [];
        if (sub === 'init') {
          out.push(st.fresh && before !== 'ready' ? '[+] Creating database schema and seeding the portfolio workspace' : '[i] Database already initialized');
        }
        out.push(
          '● msfdb — PostgreSQL in the browser (PGlite, WebAssembly)',
          `     Active: active (running) · booted in ${(st.elapsed / 1000).toFixed(2)} s`,
          `    Storage: ${DATA_DIR} (IndexedDB, this browser only)`,
          `    Version: ${v.rows[0]?.version}`,
          '',
          '  table        rows',
          '  ----------  -----',
          ...counts.rows.map((r) => `  ${r.t.padEnd(10)}  ${String(r.n).padStart(5)}`),
          '',
          '  Lab hosts are simulated training data; nothing is ever scanned.',
        );
        return out.join('\n');
      } catch (e) {
        return `[-] database failed to start: ${(e as Error).message}`;
      }
    }
    if (sub === 'stop' || sub === 'delete' || sub === 'reinit') {
      return `[i] msfdb ${sub}: not supported in the browser build. Clear site data to reset ${DATA_DIR}.`;
    }
    return 'Usage: msfdb status|init|run';
  },
  complete: ({ args }) => ['status', 'init', 'run'].filter((s) => s.startsWith(args[0] ?? '')),
};

const DUMP_LIMIT = 200;

function copyEscape(v: unknown): string {
  if (v === null || v === undefined) return '\\N';
  return cellText(v).replace(/\\/g, '\\\\').replace(/\t/g, '\\t').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
}

const pgDump: Command = {
  name: 'pg_dump',
  summary: 'dump tables of the in-browser PostgreSQL as COPY text (200 rows max per table)',
  usage: 'pg_dump [-t] [table…]',
  category: 'database',
  run: async ({ args }) => {
    const wanted = args.filter((a) => !a.startsWith('-'));
    try {
      const db = await getDb();
      const all = await db.query<{ name: string }>(
        `select tablename as name from pg_tables where schemaname = 'public' order by tablename`,
      );
      const names = all.rows.map((r) => r.name);
      const tables = wanted.length ? wanted : names;
      const out: string[] = [
        '--',
        '-- PostgreSQL database dump (PGlite, in-browser)',
        `-- Dumped from: ${(await version())}`,
        `-- Rows per table are capped at ${DUMP_LIMIT}.`,
        '--',
        '',
      ];
      for (const t of tables) {
        if (!names.includes(t)) {
          out.push(`pg_dump: error: no matching tables were found for "${t}"`);
          continue;
        }
        const r = await db.query(`select * from "${t}" order by 1 limit ${DUMP_LIMIT + 1}`, [], {
          rowMode: 'array',
          parsers: { 1082: (v: string) => v, 1114: (v: string) => v, 1184: (v: string) => v },
        });
        const rows = r.rows as unknown[][];
        out.push(`--\n-- Data for Name: ${t}; Type: TABLE DATA; Schema: public\n--\n`);
        out.push(`COPY public.${t} (${r.fields.map((f) => f.name).join(', ')}) FROM stdin;`);
        for (const row of rows.slice(0, DUMP_LIMIT)) out.push(row.map(copyEscape).join('\t'));
        out.push('\\.');
        if (rows.length > DUMP_LIMIT) out.push(`-- (truncated after ${DUMP_LIMIT} rows)`);
        out.push('');
      }
      out.push('--', '-- PostgreSQL database dump complete', '--');
      return out.join('\n');
    } catch (e) {
      return `pg_dump: error: ${(e as Error).message}`;
    }
  },
};

export const dbCommands: Command[] = [psql, msfdb, pgDump];
