/**
 * "What do you want to study?" — search by a learning goal, not by syntax.
 *
 * Two keyless sources, fused:
 *  - Hugging Face paper search: semantic, so a sentence like "keeping a
 *    config-heavy LLM app healthy in production" finds papers that never use
 *    those exact words.
 *  - arXiv, relevance-sorted, over the goal's key terms: exhaustive, and it
 *    catches papers HF hasn't indexed.
 * Results are merged by reciprocal-rank fusion plus a keyword bonus, then
 * citation counts are added from Semantic Scholar when it answers (anonymous
 * use is often rate-limited; S2_API_KEY lifts that).
 */

import type { PaperHit } from '../types';
import { relevance } from '../rank';
import { UPSTREAM_UA } from './cache';
import { arxivRelevance } from './arxiv';
import { hfSearch } from './hf';
const RRF_K = 50;

export interface SearchHit extends PaperHit {
  score: number;
  matched: string[];
  /** which sources returned it */
  via: ('semantic' | 'arxiv')[];
  citations?: number;
}

export interface SearchResponse {
  q: string;
  terms: string[];
  arxivQuery: string;
  items: SearchHit[];
  citationsAvailable: boolean;
  /** sources that failed this time */
  missed: string[];
  fetchedAt: string;
}

const STOP = new Set(
  `a about above after again against all am an and any are as at be because been before being below between both but by
  can could did do does doing down during each few for from further had has have having he her here hers how i if in into
  is it its itself just learn like me more most my myself no nor not now of off on once only or other our out over
  own papers paper research same she should so some study studying such than that the their them then there these they
  this those through to too under until up very want was we were what when where which while who whom why will with would
  you your understand know get make use using used way ways best good new recent kind kinds lot lots stuff thing things
  topic topics area areas field read reading`.split(/\s+/),
);

/** Lowercase key terms from a free-text goal: quoted phrases first, then content words in order. */
export function goalTerms(q: string): string[] {
  const phrases = [...q.matchAll(/"([^"]+)"/g)].map((m) => m[1].trim().toLowerCase()).filter(Boolean);
  const words = q
    .replace(/"[^"]*"/g, ' ')
    .split(/[^\p{L}\p{N}/+#.-]+/u)
    .map((w) => w.replace(/^[.-]+|[.-]+$/g, ''))
    .filter((w) => w && !STOP.has(w.toLowerCase()))
    // keep acronyms (LLM, CI/CD, RL) even when short
    .filter((w) => w.length >= 3 || /^[A-Z0-9/+]{2,}$/.test(w))
    .map((w) => w.toLowerCase());
  return [...new Set([...phrases, ...words])].slice(0, 10);
}

/** Up to four terms, AND-ed: arXiv's relevance sort does the rest. */
export function arxivQueryFor(terms: string[], take = 4): string {
  return terms
    .slice(0, take)
    .map((t) => (/\s/.test(t) ? `all:"${t}"` : `all:${t.replace(/[^\p{L}\p{N}-]/gu, '')}`))
    .filter((t) => t !== 'all:')
    .join(' AND ');
}

/** One batch call for every arXiv id; returns null when S2 doesn't answer. */
async function citations(ids: string[]): Promise<Map<string, number> | null> {
  if (!ids.length) return new Map();
  const headers: Record<string, string> = { 'user-agent': UPSTREAM_UA, 'content-type': 'application/json' };
  if (process.env.S2_API_KEY) headers['x-api-key'] = process.env.S2_API_KEY;
  try {
    const res = await fetch('https://api.semanticscholar.org/graph/v1/paper/batch?fields=citationCount', {
      method: 'POST',
      headers,
      body: JSON.stringify({ ids: ids.map((id) => `ARXIV:${id}`) }),
      signal: AbortSignal.timeout(6000),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as ({ citationCount?: number } | null)[];
    const out = new Map<string, number>();
    rows.forEach((r, i) => typeof r?.citationCount === 'number' && out.set(ids[i], r.citationCount));
    return out;
  } catch {
    return null;
  }
}

export async function searchGoal(q: string): Promise<SearchResponse> {
  const terms = goalTerms(q);
  const missed: string[] = [];
  let aq = arxivQueryFor(terms);

  const [semantic, arxiv] = await Promise.all([
    hfSearch(q.slice(0, 250)).catch(() => {
      missed.push('Hugging Face');
      return [] as PaperHit[];
    }),
    (async () => {
      if (!aq) return [] as PaperHit[];
      try {
        let r = await arxivRelevance(aq, 40);
        // a long goal AND-ed together can match nothing; loosen once
        if (r.items.length < 8 && terms.length > 2) {
          aq = arxivQueryFor(terms, 2);
          const loose = await arxivRelevance(aq, 40);
          if (loose.items.length > r.items.length) r = loose;
        }
        return r.items;
      } catch {
        missed.push('arXiv');
        return [] as PaperHit[];
      }
    })(),
  ]);

  const byId = new Map<string, SearchHit>();
  const add = (list: PaperHit[], via: 'semantic' | 'arxiv') =>
    list.forEach((hit, rank) => {
      const rrf = 1 / (RRF_K + rank);
      const prev = byId.get(hit.id);
      if (prev) {
        prev.score += rrf;
        prev.via.push(via);
        // arXiv's abstract is the full one; HF may carry upvotes and an AI summary
        prev.abstract ||= hit.abstract;
        prev.upvotes ??= hit.upvotes;
        prev.aiSummary ??= hit.aiSummary;
      } else byId.set(hit.id, { ...hit, score: rrf, matched: [], via: [via] });
    });
  add(semantic, 'semantic');
  add(arxiv, 'arxiv');

  const items = [...byId.values()];
  for (const it of items) {
    const rel = relevance(it, terms);
    it.matched = rel.matched;
    // a paper that actually uses the goal's words gets a nudge over a near-miss
    it.score = Math.round((it.score + 0.0025 * Math.min(rel.score, 12)) * 10000) / 10000;
  }
  items.sort((a, b) => b.score - a.score);
  const top = items.slice(0, 40);

  const cites = await citations(top.map((h) => h.arxivId).filter((x): x is string => !!x));
  if (cites) top.forEach((h) => h.arxivId && cites.has(h.arxivId) && (h.citations = cites.get(h.arxivId)));

  return { q, terms, arxivQuery: aq, items: top, citationsAvailable: !!cites, missed, fetchedAt: new Date().toISOString() };
}
