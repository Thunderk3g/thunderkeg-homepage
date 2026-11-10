import type { Command } from '../../../types';
import { getDb } from '../../../db/workspace';
import { mirrorSettled, startResearchMirror } from '../../../db/mirror';
import { cellText, errorText, formatTable, runInput, type SqlError } from '../../../db/sql';

/* psql / pg_dump against the real in-browser PostgreSQL (PGlite): the research workspace. */

const FLAGS_WITH_VALUE = new Set(['-d', '-U', '-h', '-p', '--dbname', '--username', '--host', '--port']);

async function runAndFormat(sql: string): Promise<string> {
  try {
    startResearchMirror();
    await getDb();
    await mirrorSettled();
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

export const dbCommands: Command[] = [psql, pgDump];
