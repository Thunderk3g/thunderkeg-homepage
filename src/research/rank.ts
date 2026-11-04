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
