'use client';

import type { PGlite } from '@electric-sql/pglite';
import { useResearch } from '@/research/store';
import type { Paper } from '@/research/types';
import { getDbStatus, getDb, subscribeDbStatus } from './workspace';

/**
 * One-way mirror: Research app (zustand, localStorage) → `papers` table.
 *
 * Read-only with respect to the research store: it only subscribes. Writes
 * happen only once the database is up (it never boots PGlite on its own), and
 * every sync is a full diff against what was last written, so a missed update
 * heals on the next one.
 */

let started = false;
let written = new Map<string, string>(); // id → fingerprint of the row last written
let dbSeen = false; // first sync after boot reconciles against the table itself
let chain: Promise<void> = Promise.resolve();

function dateOrNull(s: string | undefined): string | null {
  const m = s ? /^\d{4}-\d{2}-\d{2}/.exec(s) : null;
  return m ? m[0] : null;
}

function rowOf(p: Paper) {
  return [
    p.id,
    p.title,
    p.authors ?? [],
    dateOrNull(p.published),
    p.status,
    p.tags ?? [],
    p.abstract ?? '',
    p.savedAt ?? null,
  ] as const;
}

async function sync(db: PGlite, papers: Paper[]) {
  if (!dbSeen) {
    const r = await db.query<{ id: string }>('select id from papers');
    written = new Map(r.rows.map((x) => [x.id, '']));
    dbSeen = true;
  }
  const keep = new Set<string>();
  for (const p of papers) {
    keep.add(p.id);
    const row = rowOf(p);
    const fp = JSON.stringify(row);
    if (written.get(p.id) === fp) continue;
    await db.query(
      `insert into papers (id, title, authors, published, status, tags, abstract, saved_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       on conflict (id) do update set title = excluded.title, authors = excluded.authors,
         published = excluded.published, status = excluded.status, tags = excluded.tags,
         abstract = excluded.abstract, saved_at = excluded.saved_at`,
      [...row],
    );
    written.set(p.id, fp);
  }
  const gone = [...written.keys()].filter((id) => !keep.has(id));
  if (gone.length) {
    await db.query('delete from papers where id = any($1::text[])', [gone]);
    gone.forEach((id) => written.delete(id));
  }
}

function schedule() {
  if (getDbStatus().phase !== 'ready') return;
  const papers = useResearch.getState().papers;
  chain = chain
    .then(() => getDb())
    .then((db) => sync(db, papers))
    .catch((e) => console.warn('[papers mirror]', e));
}

/** Idempotent. Cheap to call before the db exists: it just waits for it. */
export function startResearchMirror(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  let last = useResearch.getState().papers;
  useResearch.subscribe((s) => {
    if (s.papers === last) return;
    last = s.papers;
    schedule();
  });
  subscribeDbStatus(() => {
    if (getDbStatus().phase === 'ready' && !dbSeen) schedule();
  });
  schedule();
}
