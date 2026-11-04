/**
 * Server-side cache and the arXiv request gate.
 *
 * Upstream fetches use `cache: 'no-store'` and are cached here instead: the
 * Next.js Data Cache would hide whether a request actually went upstream,
 * which is exactly what the gate has to know.
 *
 * State lives on globalThis so every route bundle (and dev-mode HMR) shares one
 * cache and, more importantly, one gate — arXiv counts requests per machine.
 */

/** Descriptive, no personal contact details; arXiv asks bots to identify themselves. */
export const UPSTREAM_UA = 'diwakar-portfolio/2.1 (+https://github.com/Thunderk3g)';

const MAX_ENTRIES = 200;
const ARXIV_GAP_MS = 3100;

interface Entry {
  at: number;
  data: unknown;
}

interface Shared {
  store: Map<string, Entry>;
  inflight: Map<string, Promise<unknown>>;
  arxivChain: Promise<unknown>;
  arxivLastStart: number;
}

const g = globalThis as typeof globalThis & { __researchCache?: Shared };
const shared: Shared = (g.__researchCache ??= {
  store: new Map(),
  inflight: new Map(),
  arxivChain: Promise.resolve(),
  arxivLastStart: 0,
});

/** An upstream HTTP failure, keeping the status so 429/503 can be told apart. */
export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * arXiv: "no more than 1 request every 3 seconds, a single connection at a
 * time". Every arXiv call goes through this promise chain, so calls start at
 * least 3.1 s apart and never overlap.
 */
export function arxivGate<T>(fn: () => Promise<T>): Promise<T> {
  const run = shared.arxivChain.then(async () => {
    const wait = shared.arxivLastStart + ARXIV_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    shared.arxivLastStart = Date.now();
    return fn();
  });
  // a failed call must not wedge the queue
  shared.arxivChain = run.catch(() => undefined);
  return run;
}

function touch(key: string, e: Entry) {
  shared.store.delete(key);
  shared.store.set(key, e);
}

function put(key: string, data: unknown) {
  shared.store.delete(key);
  shared.store.set(key, { at: Date.now(), data });
  // Map iterates in insertion order, so the first key is least recently used
  while (shared.store.size > MAX_ENTRIES) {
    const oldest = shared.store.keys().next().value;
    if (oldest === undefined) break;
    shared.store.delete(oldest);
  }
}

export interface Cached<T> {
  data: T;
  cached: boolean;
  error?: string;
}

/**
 * Fresh entry → served from memory. Otherwise fetch, with identical
 * concurrent requests sharing one upstream call. On failure, a stale entry is
 * better than nothing: it is served with an `error` saying so.
 */
export async function cached<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
  opts: { label?: string; keep?: (data: T) => boolean } = {},
): Promise<Cached<T>> {
  const hit = shared.store.get(key);
  if (hit && Date.now() - hit.at < ttlMs) {
    touch(key, hit);
    return { data: hit.data as T, cached: true };
  }

  let pending = shared.inflight.get(key) as Promise<T> | undefined;
  if (!pending) {
    pending = fn();
    shared.inflight.set(key, pending);
    pending.then(
      () => shared.inflight.delete(key),
      () => shared.inflight.delete(key),
    );
  }

  try {
    const data = await pending;
    if (!opts.keep || opts.keep(data)) put(key, data);
    return { data, cached: false };
  } catch (err) {
    if (!hit) throw err;
    const status = err instanceof UpstreamError ? err.status : undefined;
    const label = opts.label ?? 'upstream';
    return {
      data: hit.data as T,
      cached: true,
      error:
        status === 429 || status === 503
          ? `${label} is throttling; showing cached results`
          : `${label} unreachable; showing cached results`,
    };
  }
}
