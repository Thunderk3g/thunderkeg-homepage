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
const PER_ADDRESS = 20;
/** every address together, per instance */
const PER_INSTANCE = 200;

const byAddress = new Map<string, number[]>();
let everyone: number[] = [];

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
export function withinRate(address: string, now = Date.now()): Verdict {
  const since = now - WINDOW_MS;
  everyone = everyone.filter((t) => t > since);
  const mine = (byAddress.get(address) ?? []).filter((t) => t > since);
  const retryAfter = (oldest: number) => Math.max(1, Math.ceil((oldest + WINDOW_MS - now) / 1000));
  if (mine.length >= PER_ADDRESS) {
    byAddress.set(address, mine);
    return { ok: false, status: 429, reason: 'rate', retryAfter: retryAfter(mine[0]) };
  }
  if (everyone.length >= PER_INSTANCE) return { ok: false, status: 429, reason: 'busy', retryAfter: retryAfter(everyone[0]) };
  mine.push(now);
  everyone.push(now);
  byAddress.set(address, mine);
  // addresses that have gone quiet are dropped, so the map cannot grow without bound
  if (byAddress.size > 5_000) for (const [k, v] of byAddress) if (!v.some((t) => t > since)) byAddress.delete(k);
  return { ok: true };
}

/** For tests. */
export function resetGuard(): void {
  byAddress.clear();
  everyone = [];
}
