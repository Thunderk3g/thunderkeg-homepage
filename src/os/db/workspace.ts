'use client';

import { useSyncExternalStore } from 'react';
import type { PGlite } from '@electric-sql/pglite';
import { MIGRATIONS } from './schema';

/**
 * The Elephant — a real PostgreSQL 18 (PGlite, WebAssembly) living in the
 * visitor's browser and persisted to IndexedDB.
 *
 * Nothing here runs until something asks for the database: the ~3 MB wasm is a
 * dynamic import, so it never lands in the main bundle and a visitor who never
 * opens psql never downloads it. The research tables are filled by the mirror
 * (./mirror.ts) from the Research app's local store.
 */

export const DATA_DIR = 'idb://kali-workspace';

export type DbPhase = 'idle' | 'starting' | 'ready' | 'error';

export interface DbStatus {
  phase: DbPhase;
  /** ms since boot started (frozen once ready/error) */
  elapsed: number;
  startedAt: number | null;
  /** e.g. "PostgreSQL 18.6 (PGlite 0.5.15) on wasm32-unknown-emscripten…" */
  version: string | null;
  /** "PostgreSQL 18.6" */
  shortVersion: string | null;
  error: string | null;
  /** true when this boot created the schema / seed (first visit) */
  fresh: boolean;
}

let status: DbStatus = {
  phase: 'idle',
  elapsed: 0,
  startedAt: null,
  version: null,
  shortVersion: null,
  error: null,
  fresh: false,
};
const listeners = new Set<() => void>();
let ticker: ReturnType<typeof setInterval> | null = null;

function setStatus(patch: Partial<DbStatus>) {
  status = { ...status, ...patch };
  listeners.forEach((l) => l());
}

export function getDbStatus(): DbStatus {
  return status;
}

export function subscribeDbStatus(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const SERVER_STATUS = status;

/** React hook: the live boot state of the workspace database. */
export function useDbStatus(): DbStatus {
  return useSyncExternalStore(subscribeDbStatus, getDbStatus, () => SERVER_STATUS);
}

let dbPromise: Promise<PGlite> | null = null;

/** Lazy singleton. Client only; rejects during SSR. */
export function getDb(): Promise<PGlite> {
  if (typeof window === 'undefined') return Promise.reject(new Error('PGlite is client-only'));
  if (dbPromise) return dbPromise;
  const startedAt = performance.now();
  setStatus({ phase: 'starting', startedAt, elapsed: 0, error: null });
  ticker = setInterval(() => setStatus({ elapsed: Math.round(performance.now() - startedAt) }), 100);

  dbPromise = (async () => {
    const { PGlite } = await import('@electric-sql/pglite');
    const db = await PGlite.create({ dataDir: DATA_DIR, relaxedDurability: true });
    const fresh = await migrate(db);
    const v = await db.query<{ version: string }>('select version()');
    const version = v.rows[0]?.version ?? 'PostgreSQL';
    return { db, fresh, version };
  })().then(
    ({ db, fresh, version }) => {
      if (ticker) clearInterval(ticker);
      const elapsed = Math.round(performance.now() - startedAt);
      setStatus({
        phase: 'ready',
        elapsed,
        version,
        shortVersion: /PostgreSQL [\d.]+/.exec(version)?.[0] ?? 'PostgreSQL',
        fresh,
      });
      void flushPending(db);
      void startWatchers();
      return db;
    },
    (e: unknown) => {
      if (ticker) clearInterval(ticker);
      dbPromise = null; // allow a retry
      setStatus({
        phase: 'error',
        elapsed: Math.round(performance.now() - startedAt),
        error: e instanceof Error ? e.message : String(e),
      });
      throw e;
    },
  );
  return dbPromise;
}

/** Already-booted db, or null — for callers that must not trigger the download. */
export function dbIfReady(): Promise<PGlite> | null {
  return status.phase === 'ready' ? dbPromise : null;
}

/** Idempotent schema. Returns true on the first boot of this schema version. */
async function migrate(db: PGlite): Promise<boolean> {
  await db.exec(MIGRATIONS);
  const seen = await db.query<{ n: number }>(`select count(*)::int as n from events where kind = 'db.init.research'`);
  if ((seen.rows[0]?.n ?? 0) > 0) return false;
  await db.query(`insert into events (kind, detail) values ('db.init.research', $1)`, [
    { note: 'research schema created; tables mirror the Research app', dataDir: DATA_DIR },
  ]);
  return true;
}

/* ───────────────────────── event log ───────────────────────── */

interface PendingEvent {
  kind: string;
  detail: unknown;
  at: string;
}
const pending: PendingEvent[] = [];
const PENDING_CAP = 200;

/**
 * Append to the `events` table. Never boots the database by itself: events
 * logged before PGlite is up are buffered (bounded) and flushed when it starts,
 * so logging an app launch never costs a visitor a 3 MB download.
 */
export function log(kind: string, detail: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined') return;
  const ev = { kind, detail, at: new Date().toISOString() };
  const ready = dbIfReady();
  if (ready) {
    void ready.then((db) => insertEvent(db, ev)).catch(() => {});
  } else {
    pending.push(ev);
    if (pending.length > PENDING_CAP) pending.shift();
  }
}

function insertEvent(db: PGlite, ev: PendingEvent) {
  return db.query(`insert into events (kind, detail, at) values ($1, $2, $3)`, [ev.kind, ev.detail, ev.at]);
}

async function flushPending(db: PGlite) {
  while (pending.length) {
    const ev = pending.shift()!;
    try {
      await insertEvent(db, ev);
    } catch {
      /* ignore */
    }
  }
}

/* ───────────────────────── watchers ───────────────────────── */

let watchersStarted = false;

/** App-launch logging + the research mirror; started once the db is up. */
async function startWatchers() {
  if (watchersStarted) return;
  watchersStarted = true;
  const { startResearchMirror } = await import('./mirror');
  startResearchMirror();
}

let launchWatch = false;
/** Record every window the OS opens (buffered until the db boots). */
export function watchLaunches(): void {
  if (launchWatch || typeof window === 'undefined') return;
  launchWatch = true;
  void import('../store').then(({ useOS }) => {
    let seen = new Set(useOS.getState().windows.map((w) => w.id));
    useOS.subscribe((s) => {
      if (s.windows.length === 0 && seen.size === 0) return;
      const next = new Set<string>();
      for (const w of s.windows) {
        next.add(w.id);
        if (!seen.has(w.id)) log('app.launch', { app: w.appId, window: w.id });
      }
      seen = next;
    });
  });
}

if (typeof window !== 'undefined') {
  // debug/test handle, like window.__os
  (window as unknown as { __db: unknown }).__db = { getDb, log, getDbStatus };
  // defer: the OS store may still be initialising when this module is evaluated
  setTimeout(watchLaunches, 0);
}
