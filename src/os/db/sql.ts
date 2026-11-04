import { getDb } from './workspace';

/**
 * Shared SQL runner for the psql app, the terminal `psql -c` and msfconsole:
 * psql meta-commands (\dt, \d, \l, \?, \timing) are translated to catalog
 * queries; everything else goes straight to PostgreSQL.
 */

export interface ResultSet {
  /** column names (duplicates allowed, as in real psql) */
  columns: string[];
  /** pg type oids, parallel to columns */
  types: number[];
  rows: unknown[][];
  /** "SELECT", "INSERT", … or a meta-command title */
  command: string;
  affected: number;
  title?: string;
}

export interface RunOutcome {
  results: ResultSet[];
  /** plain text output (\?, \timing) */
  text?: string;
  ms: number;
}

export interface SqlError {
  message: string;
  position?: number;
  code?: string;
  detail?: string;
  hint?: string;
}

/** Keep date/time types as PostgreSQL's own text so output matches psql. */
const RAW = (v: string) => v;
export const TEXT_PARSERS: Record<number, (v: string) => unknown> = {
  1082: RAW, // date
  1083: RAW, // time
  1114: RAW, // timestamp
  1184: RAW, // timestamptz
  1266: RAW, // timetz
  1186: RAW, // interval
};

let timing = true;
export function timingOn() {
  return timing;
}

export const META_HELP = `General
  \\?                 show this help
  \\timing [on|off]   toggle display of query timing
Informational
  \\dt                list tables
  \\d [NAME]          describe table (or list relations)
  \\l                 list databases
Anything else is sent to PostgreSQL 18 as SQL. Multiple statements are fine;
the last result set is shown.`;

function ident(name: string): string {
  return name.replace(/^"|"$/g, '');
}

const DT_SQL = `select n.nspname as "Schema", c.relname as "Name",
  case c.relkind when 'r' then 'table' when 'p' then 'partitioned table' when 'v' then 'view' else c.relkind::text end as "Type",
  pg_get_userbyid(c.relowner) as "Owner"
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('r','p','v') and n.nspname not in ('pg_catalog','information_schema') and n.nspname !~ '^pg_toast'
order by 1, 2`;

const D_SQL = `select a.attname as "Column",
  format_type(a.atttypid, a.atttypmod) as "Type",
  case when a.attnotnull then 'not null' else '' end as "Nullable",
  coalesce(pg_get_expr(d.adbin, d.adrelid), '') as "Default"
from pg_attribute a
join pg_class c on c.oid = a.attrelid
join pg_namespace n on n.oid = c.relnamespace
left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
where c.relname = $1 and n.nspname = 'public' and a.attnum > 0 and not a.attisdropped
order by a.attnum`;

const L_SQL = `select d.datname as "Name", pg_get_userbyid(d.datdba) as "Owner",
  pg_encoding_to_char(d.encoding) as "Encoding", d.datcollate as "Collate"
from pg_database d order by 1`;

/** Run a psql-style input (SQL or a backslash meta-command). Throws SqlError. */
export async function runInput(input: string): Promise<RunOutcome> {
  const db = await getDb();
  const text = input.trim();
  const t0 = performance.now();
  try {
    if (text.startsWith('\\')) {
      const [cmd, ...rest] = text.split(/\s+/);
      const arg = rest.join(' ').replace(/;$/, '');
      const done = (results: ResultSet[], txt?: string) => ({
        results,
        text: txt,
        ms: Math.round((performance.now() - t0) * 100) / 100,
      });
      switch (cmd) {
        case '\\?':
          return done([], META_HELP);
        case '\\timing':
          timing = arg === 'on' ? true : arg === 'off' ? false : !timing;
          return done([], `Timing is ${timing ? 'on' : 'off'}.`);
        case '\\dt':
          return done([await one(DT_SQL, [], 'List of relations')]);
        case '\\l':
          return done([await one(L_SQL, [], 'List of databases')]);
        case '\\d':
          if (!arg) return done([await one(DT_SQL, [], 'List of relations')]);
          {
            const r = await one(D_SQL, [ident(arg)], `Table "public.${ident(arg)}"`);
            if (r.rows.length === 0) throw { message: `Did not find any relation named "${arg}".` } as SqlError;
            return done([r]);
          }
        default:
          throw { message: `invalid command ${cmd}\nTry \\? for help.` } as SqlError;
      }
    }
    const res = await db.exec(text, { rowMode: 'array', parsers: TEXT_PARSERS });
    const results = res.map(toSet);
    return { results, ms: Math.round((performance.now() - t0) * 100) / 100 };
  } catch (e) {
    throw toSqlError(e);
  }

  async function one(sql: string, params: unknown[], title: string): Promise<ResultSet> {
    const r = await db.query(sql, params, { rowMode: 'array', parsers: TEXT_PARSERS });
    return { ...toSet(r), title };
  }
}

function toSet(r: { rows: unknown[]; fields: { name: string; dataTypeID: number }[]; command?: string; affectedRows?: number }): ResultSet {
  return {
    columns: r.fields.map((f) => f.name),
    types: r.fields.map((f) => f.dataTypeID),
    rows: r.rows as unknown[][],
    command: r.command ?? 'SELECT',
    affected: r.affectedRows ?? 0,
  };
}

export function toSqlError(e: unknown): SqlError {
  if (e && typeof e === 'object' && 'message' in e) {
    const o = e as { message: string; position?: string | number; code?: string; detail?: string; hint?: string };
    const pos = o.position !== undefined ? Number(o.position) : undefined;
    return { message: o.message, position: Number.isFinite(pos) ? pos : undefined, code: o.code, detail: o.detail, hint: o.hint };
  }
  return { message: String(e) };
}

/** psql's error caret: "LINE 1: select * fro h\n                     ^" */
export function errorText(err: SqlError, sql?: string): string {
  const out = [`ERROR:  ${err.message}`];
  if (err.position && sql) {
    let offset = 0;
    const lines = sql.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (err.position <= offset + lines[i].length + 1) {
        const prefix = `LINE ${i + 1}: `;
        out.push(prefix + lines[i]);
        out.push(' '.repeat(prefix.length + err.position - offset - 1) + '^');
        break;
      }
      offset += lines[i].length + 1;
    }
  }
  if (err.detail) out.push(`DETAIL:  ${err.detail}`);
  if (err.hint) out.push(`HINT:  ${err.hint}`);
  return out.join('\n');
}

/* ───────────────────────── formatting ───────────────────────── */

const NUMERIC = new Set([20, 21, 23, 26, 700, 701, 1700]);

/** One cell as psql would print it. */
export function cellText(v: unknown, pretty = false): string {
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) return '{' + v.map((x) => (x === null ? 'NULL' : arrayElem(x))).join(',') + '}';
  if (v instanceof Date) return v.toISOString();
  if (v instanceof Uint8Array) return '\\x' + [...v].map((b) => b.toString(16).padStart(2, '0')).join('');
  if (typeof v === 'object') return pretty ? JSON.stringify(v, null, 2) : JSON.stringify(v);
  if (typeof v === 'boolean') return v ? 't' : 'f';
  return String(v);
}

function arrayElem(x: unknown): string {
  const s = cellText(x);
  return /[\s,{}"\\]/.test(s) || s === '' ? '"' + s.replace(/["\\]/g, '\\$&') + '"' : s;
}

export function isNumericType(oid: number) {
  return NUMERIC.has(oid);
}

/** Aligned text table, like psql's default `aligned` format. */
export function formatTable(set: ResultSet): string {
  if (set.columns.length === 0) {
    const c = set.command;
    if (c === 'INSERT') return `INSERT 0 ${set.affected}`;
    if (c === 'UPDATE' || c === 'DELETE' || c === 'MERGE') return `${c} ${set.affected}`;
    return c;
  }
  const cells = set.rows.map((r) => r.map((v) => cellText(v).replace(/\n/g, '\\n')));
  const widths = set.columns.map((c, i) => Math.max(c.length, ...cells.map((r) => r[i].length)));
  const lines: string[] = [];
  if (set.title) {
    const total = widths.reduce((a, b) => a + b + 3, -1);
    const pad = Math.max(0, Math.floor((total - set.title.length) / 2));
    lines.push(' '.repeat(pad) + set.title);
  }
  lines.push(
    set.columns
      .map((c, i) => {
        const left = Math.floor((widths[i] - c.length) / 2);
        return ' ' + ' '.repeat(left) + c + ' '.repeat(widths[i] - c.length - left) + ' ';
      })
      .join('|')
      .replace(/\s+$/, ''),
  );
  lines.push(widths.map((w) => '-'.repeat(w + 2)).join('+'));
  for (const r of cells) {
    lines.push(
      r
        .map((v, i) => ' ' + (isNumericType(set.types[i]) ? v.padStart(widths[i]) : v.padEnd(widths[i])) + ' ')
        .join('|')
        .replace(/\s+$/, ''),
    );
  }
  const n = set.rows.length;
  lines.push(`(${n} row${n === 1 ? '' : 's'})`);
  return lines.join('\n');
}

/** Results → CSV (RFC 4180 quoting). */
export function toCsv(set: ResultSet): string {
  const q = (s: string) => (/[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s);
  return [set.columns.map(q).join(','), ...set.rows.map((r) => r.map((v) => q(cellText(v))).join(','))].join('\r\n') + '\r\n';
}
