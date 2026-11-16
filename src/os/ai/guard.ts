/**
 * Abuse guard for the endpoints that spend the model API key.
 *
 * Three cheap checks, in the order they run:
 *
 *   origin   a browser on another site cannot call the endpoint
 *   size     a request cannot carry more text than the site's own apps send
 *   rate     one address cannot send more than a visitor plausibly would
 *
 * What this is not: the counters live in memory, so on a serverless host
 * each instance counts on its own and a determined caller with many
 * addresses gets through. It stops scripts and accidents. The hard ceiling
 * on spend belongs at the provider (a monthly budget on the key).
 */

/** per message, and for the whole request; the longest caller is a paper note with its abstract */
export const MAX_MESSAGE_CHARS = 16_000;
export const MAX_TOTAL_CHARS = 32_000;
export const MAX_BODY_BYTES = 96_000;

const WINDOW_MS = 5 * 60_000;

/**
 * How many requests fit in the window. Each endpoint that spends the key has
 * its own bucket, so a visitor turning a steering dial (many small requests)
 * does not use up the assistant's allowance, or the other way round.
 */
export interface RateLimits {
  bucket: string;
  perAddress: number;
  /** every address together, per instance */
  perInstance: number;
}

export const CHAT_LIMITS: RateLimits = { bucket: 'chat', perAddress: 20, perInstance: 200 };

const buckets = new Map<string, { byAddress: Map<string, number[]>; everyone: number[] }>();

function bucketFor(name: string) {
  let b = buckets.get(name);
  if (!b) buckets.set(name, (b = { byAddress: new Map(), everyone: [] }));
  return b;
}

export type Verdict = { ok: true } | { ok: false; status: 403 | 413 | 429; reason: string; retryAfter?: number };

export function clientAddress(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  return (forwarded ? forwarded.split(',')[0] : headers.get('x-real-ip') ?? '').trim() || 'unknown';
}

/** A request with an Origin must come from this site; one without (curl, a server) is left to the rate limit. */
export function sameOrigin(headers: Headers): boolean {
  const site = headers.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') return false;
  const origin = headers.get('origin');
  if (!origin) return true;
  try {
    const host = new URL(origin).host;
    return host === headers.get('host') || host === headers.get('x-forwarded-host');
  } catch {
    return false;
  }
}

export function withinSize(messages: { content: unknown }[]): boolean {
  let total = 0;
  for (const m of messages) {
    if (typeof m.content !== 'string' || m.content.length > MAX_MESSAGE_CHARS) return false;
    total += m.content.length;
  }
  return total <= MAX_TOTAL_CHARS;
}

/** Sliding window. Counts the request when it is allowed. */
export function withinRate(address: string, now = Date.now(), limits: RateLimits = CHAT_LIMITS): Verdict {
  const b = bucketFor(limits.bucket);
  const since = now - WINDOW_MS;
  b.everyone = b.everyone.filter((t) => t > since);
  const mine = (b.byAddress.get(address) ?? []).filter((t) => t > since);
  const retryAfter = (oldest: number) => Math.max(1, Math.ceil((oldest + WINDOW_MS - now) / 1000));
  if (mine.length >= limits.perAddress) {
    b.byAddress.set(address, mine);
    return { ok: false, status: 429, reason: 'rate', retryAfter: retryAfter(mine[0]) };
  }
  if (b.everyone.length >= limits.perInstance) return { ok: false, status: 429, reason: 'busy', retryAfter: retryAfter(b.everyone[0]) };
  mine.push(now);
  b.everyone.push(now);
  b.byAddress.set(address, mine);
  // addresses that have gone quiet are dropped, so the map cannot grow without bound
  if (b.byAddress.size > 5_000) for (const [k, v] of b.byAddress) if (!v.some((t) => t > since)) b.byAddress.delete(k);
  return { ok: true };
}

/** For tests. */
export function resetGuard(): void {
  buckets.clear();
}
