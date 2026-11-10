import type { GraphRef, GraphResponse, RelatedResponse } from '../types';
import { UPSTREAM_UA, UpstreamError } from './cache';

/**
 * Semantic Scholar: citations, references and TLDR (s2Graph), and
 * recommendations (s2Recommendations, a separate route so one 429 does not sink both).
 *
 * Optional by design. Anonymous traffic shares one global pool and the Graph
 * API routinely answers 429; a key (S2_API_KEY, server-only) is limited to
 * 1 request/second. So the three calls run one after another, a partial bundle
 * is a normal result, and nothing here ever throws.
 */

const GRAPH = 'https://api.semanticscholar.org/graph/v1/paper';
const RECS = 'https://api.semanticscholar.org/recommendations/v1/papers/forpaper';
const REF_FIELDS = 'title,year,externalIds,citationCount';
const LIMIT = 25;

interface S2Paper {
  paperId?: string | null;
  title?: string;
  year?: number | null;
  venue?: string;
  citationCount?: number;
  referenceCount?: number;
  externalIds?: Record<string, string> | null;
  tldr?: { text?: string } | null;
  url?: string;
}

const s2Url = (p: S2Paper) => (p.paperId ? `https://www.semanticscholar.org/paper/${p.paperId}` : p.url ?? '');

function toRef(p: S2Paper | undefined | null): GraphRef | null {
  if (!p?.title || !p.paperId) return null;
  return {
    title: p.title,
    year: p.year ?? undefined,
    arxivId: p.externalIds?.ArXiv,
    doi: p.externalIds?.DOI,
    citationCount: p.citationCount,
    s2Url: s2Url(p),
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function s2Graph(id: string): Promise<GraphResponse> {
  const key = process.env.S2_API_KEY;
  const headers: Record<string, string> = { 'user-agent': UPSTREAM_UA };
  if (key) headers['x-api-key'] = key;
  const pid = encodeURIComponent(id);

  const urls = [
    `${GRAPH}/${pid}?fields=title,year,venue,citationCount,referenceCount,tldr,externalIds`,
    `${GRAPH}/${pid}/references?fields=${REF_FIELDS}&limit=${LIMIT}`,
    `${GRAPH}/${pid}/citations?fields=${REF_FIELDS}&limit=${LIMIT}`,
  ];

  // sequential: anonymous calls share a pool, keyed calls are capped at 1 rps
  const settled: PromiseSettledResult<unknown>[] = [];
  for (const [i, url] of urls.entries()) {
    if (i > 0 && key) await sleep(1050);
    const [r] = await Promise.allSettled([
      fetch(url, { headers, signal: AbortSignal.timeout(8000), cache: 'no-store' }).then(async (res) => {
        if (!res.ok) throw new UpstreamError(`S2: HTTP ${res.status}`, res.status);
        return res.json() as Promise<unknown>;
      }),
    ]);
    settled.push(r);
  }

  const [paperR, refsR, citesR] = settled;
  const ok = <T>(r: PromiseSettledResult<unknown>) => (r.status === 'fulfilled' ? (r.value as T) : undefined);

  const p = ok<S2Paper>(paperR);
  const references = (ok<{ data?: { citedPaper?: S2Paper }[] }>(refsR)?.data ?? [])
    .map((d) => toRef(d.citedPaper))
    .filter((x): x is GraphRef => !!x);
  const citations = (ok<{ data?: { citingPaper?: S2Paper }[] }>(citesR)?.data ?? [])
    .map((d) => toRef(d.citingPaper))
    .filter((x): x is GraphRef => !!x);

  const statuses = settled.map((r) =>
    r.status === 'rejected' && r.reason instanceof UpstreamError ? r.reason.status : r.status === 'rejected' ? 0 : 200,
  );
  let reason: GraphResponse['reason'] = statuses.includes(429)
    ? 'rate-limited'
    : statuses.every((s) => s === 404)
      ? 'not-found'
      : statuses.some((s) => s === 0)
        ? 'unreachable'
        : undefined;

  const available = !!p?.title || references.length + citations.length > 0;
  if (!available && !reason) reason = 'unreachable';
  return {
    available,
    reason,
    paper: p?.title
      ? {
          title: p.title,
          year: p.year ?? undefined,
          venue: p.venue || undefined,
          citationCount: p.citationCount,
          referenceCount: p.referenceCount,
          tldr: p.tldr?.text,
          s2Url: s2Url(p),
        }
      : undefined,
    references,
    citations,
  };
}

/**
 * "Papers like this one" from the recommendations endpoint (SPECTER embeddings
 * over the S2 corpus). One call; never throws.
 */
export async function s2Recommendations(id: string): Promise<RelatedResponse> {
  const key = process.env.S2_API_KEY;
  const headers: Record<string, string> = { 'user-agent': UPSTREAM_UA };
  if (key) headers['x-api-key'] = key;
  const url = `${RECS}/${encodeURIComponent(id)}?fields=title,year,venue,externalIds,citationCount&limit=10`;
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(8000), cache: 'no-store' });
    if (res.status === 429) return { available: false, reason: 'rate-limited', items: [] };
    if (res.status === 404) return { available: false, reason: 'not-found', items: [] };
    if (!res.ok) return { available: false, reason: 'unreachable', items: [] };
    const body = (await res.json()) as { recommendedPapers?: S2Paper[] };
    const items = (body.recommendedPapers ?? [])
      .map((p): (GraphRef & { venue?: string }) | null => {
        const r = toRef(p);
        return r ? { ...r, venue: p.venue || undefined } : null;
      })
      .filter((x): x is GraphRef & { venue?: string } => !!x);
    return { available: true, items };
  } catch {
    return { available: false, reason: 'unreachable', items: [] };
  }
}
