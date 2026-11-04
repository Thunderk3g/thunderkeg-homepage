'use client';

import type { PGlite, Transaction } from '@electric-sql/pglite';
import { useResearch } from '@/research/store';
import { LADDER } from '@/research/schedule';
import { paperYear } from '@/research/bibtex';
import { venueOf } from '@/research/matrix';
import type { ResearchState } from '@/research/types';
import { getDbStatus, getDb, subscribeDbStatus } from './workspace';

/**
 * One-way mirror: Research app (zustand, localStorage) → papers, paper_notes,
 * highlights, cards, reviews.
 *
 * Read-only with respect to the research store: it only subscribes. Writes
 * happen only once the database is up (it never boots PGlite on its own), and
 * every sync is a diff against what was last written, so a missed update heals
 * on the next one. Each sync runs in one transaction, parents before children.
 */

type Row = readonly unknown[];

interface TableSpec {
  table: string;
  /** primary-key columns, in `cols` order, first */
  key: string[];
  cols: string[];
  /** extra cast per column for the upsert ($n::type) */
  casts?: Record<string, string>;
  rows: (s: ResearchState) => { key: string; row: Row }[];
}

const dateOrNull = (s: string | undefined): string | null => {
  const m = s ? /^\d{4}-\d{2}-\d{2}/.exec(s) : null;
  return m ? m[0] : null;
};

const intOrNull = (s: string) => (/^\d{4}$/.test(s) ? Number(s) : null);

function ease(s: ResearchState): Map<string, number> {
  const by = new Map<string, { n: number; ok: number }>();
  for (const l of s.log) {
    const e = by.get(l.cardId) ?? { n: 0, ok: 0 };
    e.n++;
    if (l.grade !== 'again') e.ok++;
    by.set(l.cardId, e);
  }
  return new Map([...by].map(([id, e]) => [id, Math.round((e.ok / e.n) * 1000) / 1000]));
}

const SPECS: TableSpec[] = [
  {
    table: 'papers',
    key: ['id'],
    cols: ['id', 'title', 'authors', 'published', 'status', 'tags', 'abstract', 'saved_at', 'rq_ids', 'venue', 'year', 'citation_count', 'arxiv_id', 'bib_key', 'source', 'status_changed_at'],
    rows: (s) =>
      s.papers.map((p) => ({
        key: p.id,
        row: [
          p.id,
          p.title,
          p.authors ?? [],
          dateOrNull(p.published),
          p.status,
          p.tags ?? [],
          p.abstract ?? '',
          p.savedAt ?? null,
          p.rqIds ?? [],
          venueOf(p) || null,
          intOrNull(paperYear(p)),
          typeof p.citationCount === 'number' ? p.citationCount : null,
          p.arxivId ?? null,
          p.bibKey ?? null,
          p.source,
          p.statusChangedAt ?? null,
        ],
      })),
  },
  {
    table: 'paper_notes',
    key: ['paper_id'],
    cols: ['paper_id', 'five_cs', 'problem', 'method', 'results', 'limitations', 'critique', 'delta', 'freeform'],
    rows: (s) =>
      s.papers.map((p) => {
        const n = p.note;
        return {
          key: p.id,
          row: [p.id, n.fiveCs, n.problem, n.method, n.results, n.limitations, n.critique, n.delta, n.freeform],
        };
      }),
  },
  {
    table: 'highlights',
    key: ['id'],
    cols: ['id', 'paper_id', 'text', 'location', 'why', 'card_id', 'created_at'],
    rows: (s) => {
      const have = new Set(s.papers.map((p) => p.id));
      return s.highlights
        .filter((h) => have.has(h.paperId))
        .map((h) => ({ key: h.id, row: [h.id, h.paperId, h.text, h.where ?? null, h.why ?? null, h.cardId ?? null, h.createdAt] }));
    },
  },
  {
    table: 'cards',
    key: ['id'],
    cols: ['id', 'paper_id', 'prompt', 'answer', 'elaboration', 'rq_ids', 'origin', 'due', 'interval_days', 'step', 'ease', 'reps', 'lapses', 'suspended', 'created_at', 'last_reviewed'],
    rows: (s) => {
      const have = new Set(s.papers.map((p) => p.id));
      const e = ease(s);
      return s.cards
        .filter((c) => have.has(c.paperId))
        .map((c) => ({
          key: c.id,
          row: [
            c.id,
            c.paperId,
            c.prompt,
            c.answer,
            c.elaboration ?? null,
            c.rqIds ?? [],
            c.origin,
            c.due,
            LADDER[Math.min(c.step, LADDER.length - 1)],
            c.step,
            e.get(c.id) ?? null,
            c.reps,
            c.lapses,
            !!c.suspended,
            c.createdAt ?? null,
            c.lastReviewed ?? null,
          ],
        }));
    },
  },
  {
    table: 'reviews',
    key: ['card_id', 'at'],
    cols: ['card_id', 'at', 'grade', 'typed_recall'],
    rows: (s) => {
      const have = new Set(s.cards.map((c) => c.id));
      return s.log
        .filter((l) => have.has(l.cardId))
        .map((l) => ({ key: `${l.cardId}|${l.date}`, row: [l.cardId, l.date, l.grade, l.typedRecall] }));
    },
  },
];

let started = false;
/** table → (key → fingerprint of the row last written) */
let written = new Map<string, Map<string, string>>();
let dbSeen = false; // first sync after boot reconciles against the tables themselves
let chain: Promise<void> = Promise.resolve();

const keyExpr = (spec: TableSpec) => (spec.key.length === 1 ? `${spec.key[0]}::text` : `${spec.key.map((k) => `${k}::text`).join(` || '|' || `)}`);

async function reconcile(db: PGlite) {
  written = new Map();
  for (const spec of SPECS) {
    // timestamps come back as Date; render them the way the store writes them
    const expr = spec.table === 'reviews' ? `card_id || '|' || to_char(at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')` : keyExpr(spec);
    const r = await db.query<{ k: string }>(`select ${expr} as k from ${spec.table}`);
    written.set(spec.table, new Map(r.rows.map((x) => [x.k, ''])));
  }
  dbSeen = true;
}

async function syncTable(tx: Transaction, spec: TableSpec, s: ResearchState) {
  const seen = written.get(spec.table) ?? new Map<string, string>();
  const keep = new Set<string>();
  const ph = spec.cols.map((c, i) => `$${i + 1}${spec.casts?.[c] ? `::${spec.casts[c]}` : ''}`).join(', ');
  const updates = spec.cols.filter((c) => !spec.key.includes(c)).map((c) => `${c} = excluded.${c}`);
  const sql =
    `insert into ${spec.table} (${spec.cols.join(', ')}) values (${ph}) on conflict (${spec.key.join(', ')}) ` +
    (updates.length ? `do update set ${updates.join(', ')}` : 'do nothing');
  for (const { key, row } of spec.rows(s)) {
    keep.add(key);
    const fp = JSON.stringify(row);
    if (seen.get(key) === fp) continue;
    await tx.query(sql, [...row]);
    seen.set(key, fp);
  }
  const gone = [...seen.keys()].filter((k) => !keep.has(k));
  if (gone.length) {
    if (spec.key.length === 1) await tx.query(`delete from ${spec.table} where ${spec.key[0]} = any($1::text[])`, [gone]);
    else await tx.query(`delete from reviews where card_id || '|' || to_char(at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') = any($1::text[])`, [gone]);
    gone.forEach((k) => seen.delete(k));
  }
  written.set(spec.table, seen);
}

async function sync(db: PGlite, s: ResearchState) {
  if (!dbSeen) await reconcile(db);
  const before = new Map([...written].map(([t, m]) => [t, new Map(m)]));
  try {
    await db.transaction(async (tx) => {
      // deletes cascade from papers/cards, so children are written after parents
      for (const spec of SPECS) await syncTable(tx, spec, s);
    });
  } catch (e) {
    written = before; // the transaction rolled back; so does our memory of it
    throw e;
  }
}

function schedule() {
  if (getDbStatus().phase !== 'ready') return;
  const s = useResearch.getState();
  chain = chain
    .then(() => getDb())
    .then((db) => sync(db, s))
    .catch((e) => console.warn('[research mirror]', e));
}

/** Resolves once every sync scheduled so far has run (for psql's first query). */
export function mirrorSettled(): Promise<void> {
  return chain;
}

let timer: ReturnType<typeof setTimeout> | null = null;
const debounced = () => {
  if (timer) clearTimeout(timer);
  // notes are typed a keystroke at a time; one write per pause is plenty
  timer = setTimeout(schedule, 400);
};

/** Idempotent. Cheap to call before the db exists: it just waits for it. */
export function startResearchMirror(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  let last = useResearch.getState();
  useResearch.subscribe((s) => {
    if (s.papers === last.papers && s.cards === last.cards && s.log === last.log && s.highlights === last.highlights) return;
    last = s;
    debounced();
  });
  subscribeDbStatus(() => {
    if (getDbStatus().phase === 'ready' && !dbSeen) schedule();
  });
  schedule();
}
