import type { PaperHit } from './types';

/**
 * Keyword relevance. arXiv's field search is fuzzy (`abs:WER` also matches
 * "were" stems in some indexes, and OR-heavy queries drift), so results are
 * re-ranked here against the topic's own keywords.
 *
 * ponytail: substring counting, not BM25. The keyword lists are short stems
 * written by hand for exactly this; reach for a real scorer only if they grow.
 */
export function relevance(
  hit: Pick<PaperHit, 'title' | 'abstract'>,
  keywords: string[],
): { score: number; matched: string[] } {
  const title = hit.title.toLowerCase();
  const abs = hit.abstract.toLowerCase();
  let score = 0;
  const matched: string[] = [];
  for (const raw of keywords) {
    const k = raw.trim().toLowerCase();
    if (!k) continue;
    // short acronyms (wer, asr, rag) must stand alone, or "were" counts as WER
    const re = k.length <= 3 ? new RegExp(`\\b${escapeRe(k)}\\b`, 'g') : new RegExp(escapeRe(k), 'g');
    const inTitle = (title.match(re) ?? []).length;
    const inAbs = (abs.match(re) ?? []).length;
    if (inTitle + inAbs === 0) continue;
    matched.push(k);
    score += Math.min(inTitle, 2) * 3 + Math.min(inAbs, 3);
  }
  return { score, matched };
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Words from a free-text search, used as ranking keywords. */
export function queryKeywords(q: string): string[] {
  const phrases = [...q.matchAll(/"([^"]+)"/g)].map((m) => m[1].toLowerCase());
  const words = q
    .replace(/"[^"]*"/g, ' ')
    .replace(/\b(AND|OR|ANDNOT)\b/g, ' ')
    .replace(/\b(ti|abs|au|all|cat|co|jr):/gi, ' ')
    .split(/[^\p{L}\p{N}-]+/u)
    .map((w) => w.toLowerCase())
    .filter((w) => w.length >= 3);
  return [...new Set([...phrases, ...words])];
}

/* ───────────────────────── explicit feedback ───────────────────────── */

const STOP = new Set(
  'about above after again against among based being between both could does doing during each from have having into more most other over same should some such than that their them then there these they this those through under until very what when where which while with would your using towards via without large language model models'.split(' '),
);

/** What a rating remembers about a paper: the keywords it matched plus its title's content words. */
export function feedbackKeywords(hit: Pick<PaperHit, 'title'>, matched: string[]): string[] {
  const words = hit.title
    .toLowerCase()
    .split(/[^\p{L}\p{N}-]+/u)
    .filter((w) => w.length >= 5 && !STOP.has(w));
  return [...new Set([...matched, ...words])].slice(0, 20);
}

/** Per-keyword weights learned from ± ratings (Scholar Inbox-style, but just counts). */
export function feedbackWeights(ratings: Record<string, { r: 1 | -1; keywords: string[] }>): Map<string, number> {
  const w = new Map<string, number>();
  for (const { r, keywords } of Object.values(ratings)) for (const k of keywords) w.set(k, (w.get(k) ?? 0) + r);
  return w;
}

/** A bounded nudge: ±2 per net-rated keyword present, clipped to ±8. */
export function feedbackBoost(hit: Pick<PaperHit, 'title' | 'abstract'>, weights: Map<string, number>): number {
  if (!weights.size) return 0;
  const text = `${hit.title} ${hit.abstract}`.toLowerCase();
  let b = 0;
  for (const [k, v] of weights) if (v && text.includes(k)) b += Math.sign(v) * Math.min(2, Math.abs(v));
  return Math.max(-8, Math.min(8, b));
}
