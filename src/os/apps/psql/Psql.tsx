'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppDefinition, AppProps } from '../../types';
import { getDb, useDbStatus } from '../../db/workspace';
import { mirrorSettled, startResearchMirror } from '../../db/mirror';
import {
  cellText,
  errorText,
  isNumericType,
  runInput,
  timingOn,
  toCsv,
  type ResultSet,
  type SqlError,
} from '../../db/sql';
import './psql.css';

// The mirror only writes once the database is up, so starting it here is free.
if (typeof window !== 'undefined') startResearchMirror();

const SAVED: { label: string; sql: string }[] = [
  {
    label: 'papers by RQ',
    sql: `select rq, count(*) as papers,
       count(*) filter (where status in ('pass2', 'pass3', 'done')) as past_skim,
       string_agg(left(title, 48), ' · ' order by year desc nulls last) as titles
from papers, unnest(case when rq_ids = '{}' then array['(none)'] else rq_ids end) as rq
group by rq
order by rq;`,
  },
  {
    label: 'cards due this week',
    sql: `select c.due, left(c.prompt, 70) as prompt, left(p.title, 40) as paper, c.interval_days, c.reps
from cards c join papers p on p.id = c.paper_id
where not c.suspended and c.due < current_date + 7
order by c.due, p.title;`,
  },
  {
    label: 'review accuracy by paper',
    sql: `select left(p.title, 50) as paper, count(r.*) as reviews,
       round(100.0 * count(*) filter (where r.grade <> 'again') / nullif(count(r.*), 0), 1) as pct_recalled,
       count(*) filter (where r.typed_recall) as typed
from papers p
join cards c on c.paper_id = p.id
left join reviews r on r.card_id = c.id
group by p.id
order by pct_recalled nulls last, reviews desc;`,
  },
  {
    label: 'papers per venue/year',
    sql: `select coalesce(venue, '(none)') as venue, year, count(*) as papers,
       string_agg(status, ', ' order by status) as statuses
from papers
group by venue, year
order by year desc nulls last, papers desc;`,
  },
  {
    label: 'highlights for a paper',
    sql: `-- change the title filter
select h.location, h.text, h.why, h.card_id is not null as carded, h.created_at
from highlights h join papers p on p.id = h.paper_id
where p.title ilike '%WER%'
order by h.created_at;`,
  },
  {
    label: 'notes with no critique',
    sql: `select left(p.title, 60) as paper, p.status
from papers p join paper_notes n on n.paper_id = p.id
where p.status in ('pass2', 'pass3', 'done') and n.critique = ''
order by p.status;`,
  },
  { label: '\\dt', sql: '\\dt' },
];

interface TableInfo {
  name: string;
  rows: number;
  columns?: { name: string; type: string }[];
  open?: boolean;
}

type Output =
  | { kind: 'none' }
  | { kind: 'result'; set: ResultSet; ms: number; count: number }
  | { kind: 'text'; text: string; ms: number }
  | { kind: 'error'; text: string; ms: number };

const HISTORY_KEY = 'kos:psql:history';

function loadHistory(): string[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

function PsqlApp({ args }: AppProps) {
  const status = useDbStatus();
  const [sql, setSql] = useState<string>(
    typeof args?.sql === 'string'
      ? (args.sql as string)
      : 'select status, count(*) as papers, sum(cardinality(rq_ids)) as rq_links\nfrom papers\ngroup by status\norder by papers desc;',
  );
  const [out, setOut] = useState<Output>({ kind: 'none' });
  const [running, setRunning] = useState(false);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const history = useRef<string[]>([]);
  const hIdx = useRef(-1);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    history.current = loadHistory();
    getDb().catch(() => {});
  }, []);

  const refreshTables = useCallback(async () => {
    try {
      const db = await getDb();
      const t = await db.query<{ name: string }>(
        `select tablename as name from pg_tables where schemaname = 'public' order by tablename`,
      );
      if (t.rows.length === 0) return setTables([]);
      const counts = await db.query<{ name: string; n: number }>(
        t.rows.map((r) => `select '${r.name}' as name, count(*)::int as n from "${r.name}"`).join(' union all '),
      );
      const byName = new Map(counts.rows.map((r) => [r.name, r.n]));
      setTables((prev) =>
        t.rows.map((r) => {
          const old = prev.find((p) => p.name === r.name);
          return { name: r.name, rows: byName.get(r.name) ?? 0, columns: old?.columns, open: old?.open };
        }),
      );
    } catch {
      /* boot error is shown by the overlay */
    }
  }, []);

  useEffect(() => {
    if (status.phase === 'ready') void refreshTables();
  }, [status.phase, refreshTables]);

  const run = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || running) return;
      setRunning(true);
      if (history.current[history.current.length - 1] !== q) {
        history.current.push(q);
        history.current = history.current.slice(-100);
        try {
          localStorage.setItem(HISTORY_KEY, JSON.stringify(history.current));
        } catch {
          /* private mode */
        }
      }
      hIdx.current = -1;
      const t0 = performance.now();
      try {
        // let a pending mirror write land first, so a fresh card shows up
        await mirrorSettled();
        const r = await runInput(q);
        const last = [...r.results].reverse().find((s) => s.columns.length > 0) ?? r.results[r.results.length - 1];
        if (r.text) setOut({ kind: 'text', text: r.text, ms: r.ms });
        else if (last) setOut({ kind: 'result', set: last, ms: r.ms, count: r.results.length });
        else setOut({ kind: 'text', text: 'Query returned no result set.', ms: r.ms });
      } catch (e) {
        setOut({ kind: 'error', text: errorText(e as SqlError, q), ms: Math.round(performance.now() - t0) });
      } finally {
        setRunning(false);
        void refreshTables();
      }
    },
    [running, refreshTables],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      void run(sql);
      return;
    }
    const single = !sql.includes('\n');
    if (single && e.key === 'ArrowUp' && history.current.length) {
      e.preventDefault();
      const h = history.current;
      hIdx.current = hIdx.current < 0 ? h.length - 1 : Math.max(0, hIdx.current - 1);
      setSql(h[hIdx.current]);
    } else if (single && e.key === 'ArrowDown' && hIdx.current >= 0) {
      e.preventDefault();
      const h = history.current;
      hIdx.current++;
      if (hIdx.current >= h.length) {
        hIdx.current = -1;
        setSql('');
      } else setSql(h[hIdx.current]);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.currentTarget;
      const { selectionStart: s, selectionEnd: en } = ta;
      const next = sql.slice(0, s) + '  ' + sql.slice(en);
      setSql(next);
      requestAnimationFrame(() => ta.setSelectionRange(s + 2, s + 2));
    }
  };

  const openTable = (name: string) => {
    const q = `select * from ${name} limit 100;`;
    setSql(q);
    void run(q);
  };

  const toggleColumns = async (name: string) => {
    const t = tables.find((x) => x.name === name);
    if (!t) return;
    if (t.open) return setTables((ts) => ts.map((x) => (x.name === name ? { ...x, open: false } : x)));
    let cols = t.columns;
    if (!cols) {
      const db = await getDb();
      const r = await db.query<{ name: string; type: string }>(
        `select a.attname as name, format_type(a.atttypid, a.atttypmod) as type
         from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
         where c.relname = $1 and n.nspname = 'public' and a.attnum > 0 and not a.attisdropped order by a.attnum`,
        [name],
      );
      cols = r.rows;
    }
    setTables((ts) => ts.map((x) => (x.name === name ? { ...x, open: true, columns: cols } : x)));
  };

  const exportCsv = () => {
    if (out.kind !== 'result') return;
    const blob = new Blob([toCsv(out.set)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `query-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const downloadDb = async () => {
    const db = await getDb();
    const blob = await db.dumpDataDir('gzip');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kali-workspace.tar.gz';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const statusLine = (() => {
    const v = status.shortVersion ?? 'PostgreSQL';
    if (status.phase !== 'ready') return `${status.phase} · ${v}`;
    const t = timingOn() && out.kind !== 'none' ? ` · ${out.ms} ms` : '';
    if (out.kind === 'result') {
      const s = out.set;
      const what = s.columns.length
        ? `${s.rows.length} row${s.rows.length === 1 ? '' : 's'}`
        : s.command === 'INSERT'
          ? `INSERT 0 ${s.affected}`
          : `${s.command}${s.affected ? ' ' + s.affected : ''}`;
      return `${what}${out.count > 1 ? ` (last of ${out.count} statements)` : ''}${t} · ${v}`;
    }
    if (out.kind === 'error') return `error${t} · ${v}`;
    return `ready · ${v} · idb://kali-workspace`;
  })();

  return (
    <div className="kos-psql">
      <aside className="kos-psql-side" aria-label="schema browser">
        <div className="kos-psql-side-head">
          <span>public</span>
          <button className="kos-psql-icon-btn" onClick={() => void refreshTables()} title="Refresh">
            <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden>
              <path d="M13 8a5 5 0 1 1-1.5-3.6M13 2.5V5h-2.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        </div>
        <ul className="kos-psql-tables">
          {tables.map((t) => (
            <li key={t.name}>
              <div className="kos-psql-table">
                <button
                  className="kos-psql-caret"
                  aria-label={`${t.open ? 'collapse' : 'expand'} ${t.name}`}
                  onClick={() => void toggleColumns(t.name)}
                >
                  {t.open ? '▾' : '▸'}
                </button>
                <button className="kos-psql-tname" onClick={() => openTable(t.name)} title={`select * from ${t.name} limit 100`}>
                  {t.name}
                </button>
                <span className="kos-psql-count">{t.rows}</span>
              </div>
              {t.open && t.columns && (
                <ul className="kos-psql-cols">
                  {t.columns.map((c) => (
                    <li key={c.name}>
                      <span>{c.name}</span>
                      <span className="kos-psql-ctype">{c.type}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
        <div className="kos-psql-side-foot">
          Real PostgreSQL in WebAssembly, stored in this browser&apos;s IndexedDB. papers, paper_notes, highlights, cards and reviews mirror the Research app one way — edit there, query here.
        </div>
      </aside>

      <section className="kos-psql-main">
        <div className="kos-psql-chips" role="toolbar" aria-label="saved queries">
          <span className="kos-psql-chips-label">Saved queries</span>
          {SAVED.map((q) => (
            <button
              key={q.label}
              className="kos-psql-chip"
              onClick={() => {
                setSql(q.sql);
                void run(q.sql);
              }}
            >
              {q.label}
            </button>
          ))}
        </div>
        <div className="kos-psql-editor">
          <div className="kos-psql-prompt" aria-hidden>
            research=#
          </div>
          <textarea
            ref={taRef}
            className="kos-psql-sql"
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            onKeyDown={onKeyDown}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            aria-label="SQL editor"
            placeholder="select version();"
          />
          <div className="kos-psql-actions">
            <button className="kos-psql-run" onClick={() => void run(sql)} disabled={running || status.phase !== 'ready'}>
              {running ? 'Running' : 'Run'} <kbd>Ctrl+Enter</kbd>
            </button>
            <button className="kos-psql-btn" onClick={() => void downloadDb()} disabled={status.phase !== 'ready'} title="pg data directory as a tarball (PGlite dumpDataDir)">
              Download database
            </button>
            <button className="kos-psql-btn" onClick={exportCsv} disabled={out.kind !== 'result' || out.set.columns.length === 0}>
              Export CSV
            </button>
          </div>
        </div>

        <div className="kos-psql-results" data-testid="psql-results">
          {out.kind === 'none' && (
            <div className="kos-psql-empty">
              Ctrl+Enter runs the editor. Try a saved query, click a table, or type <code>\?</code>.
            </div>
          )}
          {out.kind === 'text' && <pre className="kos-psql-text">{out.text}</pre>}
          {out.kind === 'error' && <pre className="kos-psql-error">{out.text}</pre>}
          {out.kind === 'result' && out.set.columns.length === 0 && (
            <pre className="kos-psql-text">
              {out.set.command === 'INSERT' ? `INSERT 0 ${out.set.affected}` : `${out.set.command} ${out.set.affected || ''}`}
            </pre>
          )}
          {out.kind === 'result' && out.set.columns.length > 0 && <Grid set={out.set} />}
        </div>

        <div className="kos-psql-status" data-testid="psql-status">
          {statusLine}
        </div>
      </section>

      {status.phase !== 'ready' && <BootOverlay />}
    </div>
  );
}

function Grid({ set }: { set: ResultSet }) {
  return (
    <div className="kos-psql-grid-wrap">
      {set.title && <div className="kos-psql-grid-title">{set.title}</div>}
      <table className="kos-psql-grid">
        <thead>
          <tr>
            <th className="kos-psql-rownum">#</th>
            {set.columns.map((c, i) => (
              <th key={i}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {set.rows.map((r, i) => (
            <tr key={i}>
              <td className="kos-psql-rownum">{i + 1}</td>
              {r.map((v, j) => {
                if (v === null || v === undefined)
                  return (
                    <td key={j} className="kos-psql-null">
                      NULL
                    </td>
                  );
                const isObj = typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date) && !(v instanceof Uint8Array);
                return (
                  <td key={j} className={isNumericType(set.types[j]) ? 'kos-psql-num' : isObj ? 'kos-psql-json' : undefined}>
                    {isObj ? <pre>{cellText(v, true)}</pre> : cellText(v)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BootOverlay() {
  const s = useDbStatus();
  return (
    <div className="kos-psql-boot" role="status" aria-live="polite" data-testid="psql-boot">
      <div className="kos-psql-boot-card">
        <svg viewBox="0 0 48 48" width="40" height="40" aria-hidden className="kos-psql-boot-logo">
          <ellipse cx="24" cy="12" rx="14" ry="5" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M10 12v24c0 2.8 6.3 5 14 5s14-2.2 14-5V12M10 24c0 2.8 6.3 5 14 5s14-2.2 14-5" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
        {s.phase === 'error' ? (
          <>
            <div className="kos-psql-boot-title">PostgreSQL failed to start</div>
            <pre className="kos-psql-error">{s.error}</pre>
            <button className="kos-psql-run" onClick={() => getDb().catch(() => {})}>
              Retry
            </button>
          </>
        ) : (
          <>
            <div className="kos-psql-boot-title">Starting PostgreSQL 18 (PGlite)</div>
            <div className="kos-psql-boot-ms">{(s.elapsed / 1000).toFixed(1)} s</div>
            <div className="kos-psql-boot-note">
              First run downloads about 3 MB of WebAssembly, then initdb runs in this tab. The database lives in
              IndexedDB (<code>idb://kali-workspace</code>), so later visits only reopen it.
            </div>
            <div className="kos-psql-bar">
              <span />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export const psqlApp: AppDefinition = {
  id: 'psql',
  title: 'psql',
  icon: '🐘',
  category: 'Development',
  component: PsqlApp,
  description: 'Real PostgreSQL 18 (WebAssembly) over my research library — query papers, notes, cards and reviews with SQL',
  defaultSize: { width: 920, height: 600 },
  minSize: { width: 520, height: 340 },
  desktop: true,
  launchCommands: ['psql', 'pgcli'],
};

export default PsqlApp;
