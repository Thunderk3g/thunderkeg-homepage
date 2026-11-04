import type { FiveCs, PaperHit, ResearchQuestion } from './types';
import { relevance } from './rank';

/**
 * The LLM side of paper study: prompt builders, the parser for card
 * suggestions, and deterministic fallbacks for when no LLM_API_KEY is set.
 * Nothing here writes to the store — every output is a draft he accepts.
 */

const ABSTRACT_CLIP = 4000;
const clip = (s: string) => (s.length <= ABSTRACT_CLIP ? s : s.slice(0, ABSTRACT_CLIP) + '…');

type PaperText = Pick<PaperHit, 'title' | 'abstract' | 'categories' | 'primaryCategory' | 'authors' | 'published'>;

const sentences = (text: string) =>
  text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z0-9(])/)
    .map((s) => s.trim())
    .filter(Boolean);

function rqList(rqs: ResearchQuestion[]): string {
  return rqs.map((q) => `${q.id.toUpperCase()}: ${q.question}`).join('\n');
}

export function firstPassPrompt(p: PaperText, rqs: ResearchQuestion[]): string {
  return [
    'First pass (Keshav, 5–10 minutes) on this paper. Output exactly these lines:',
    'Category: …',
    'Context: …',
    'Correctness: …',
    'Contributions: …',
    'Clarity: …',
    'Relevance: <RQ ids it bears on> — why, one line',
    'Read further? yes/no — one reason',
    '',
    `Title: ${p.title}`,
    `Categories: ${p.categories.join(', ') || 'unknown'}`,
    `Abstract: ${clip(p.abstract)}`,
    '',
    'My research questions:',
    rqList(rqs),
  ].join('\n');
}

export function cardsPrompt(p: PaperText): string {
  return [
    'Write exactly 4 recall cards that test the most load-bearing claims of this abstract',
    '(numbers, mechanisms, conditions). One per line, in the form:',
    'Q: <question> || A: <short answer>',
    'No other text.',
    '',
    `Title: ${p.title}`,
    `Abstract: ${clip(p.abstract)}`,
  ].join('\n');
}

export interface CardDraft {
  prompt: string;
  answer: string;
}

export function parseCardLines(text: string): CardDraft[] {
  const out: CardDraft[] = [];
  for (const line of text.split('\n')) {
    const m = /Q:\s*(.+?)\s*\|\|\s*A:\s*(.+)$/i.exec(line.trim());
    if (m) out.push({ prompt: m[1].trim(), answer: m[2].trim() });
  }
  return out.slice(0, 6);
}

/** Pull `Category: …` style lines out of a first-pass answer. */
export function parseFiveCs(text: string): Partial<FiveCs> {
  const out: Partial<FiveCs> = {};
  for (const key of ['category', 'context', 'correctness', 'contributions', 'clarity'] as const) {
    const m = new RegExp(`^\\s*[-*•]?\\s*\\**${key}\\**\\s*:\\s*(.+)$`, 'im').exec(text);
    if (m && !/^\[you:/.test(m[1].trim())) out[key] = m[1].trim();
  }
  return out;
}

const CATEGORY_NAMES: Record<string, string> = {
  'cs.CL': 'computation & language',
  'cs.IR': 'information retrieval',
  'cs.AI': 'artificial intelligence',
  'cs.LG': 'machine learning',
  'cs.SD': 'sound',
  'eess.AS': 'audio & speech processing',
  'cs.DB': 'databases',
  'cs.LO': 'logic in CS',
  'cs.CY': 'computers & society',
};

/** Template first pass: fills what can be read mechanically, leaves the rest to him. */
export function offlineFirstPass(p: PaperText, rqs: ResearchQuestion[]): string {
  const sents = sentences(p.abstract);
  const contrib = sents.filter((s) => /\bwe (propose|present|introduce|show|find)/i.test(s)).slice(0, 2);
  const cat = p.primaryCategory ?? p.categories[0];
  const kind = /\b(benchmark|dataset|corpus)\b/i.test(p.abstract)
    ? 'resource / benchmark'
    : /\b(survey|review)\b/i.test(p.title)
      ? 'survey'
      : /\b(we (measure|analy[sz]e|evaluate|study))\b/i.test(p.abstract)
        ? 'measurement / analysis'
        : 'new method';
  const rel = rqs
    .map((q) => ({ q, r: relevance(p, q.keywords) }))
    .filter((x) => x.r.score > 0)
    .sort((a, b) => b.r.score - a.r.score)
    .slice(0, 2);

  return [
    `Category: ${kind}${cat ? ` · ${cat}${CATEGORY_NAMES[cat] ? ` (${CATEGORY_NAMES[cat]})` : ''}` : ''}`,
    'Context: [you: which prior work does it build on? skim the related-work headings]',
    'Correctness: [you: are the assumptions valid? what would break the result?]',
    `Contributions: ${contrib.length ? contrib.join(' ') : '[you: no "we propose/present/show" sentence in the abstract]'}`,
    'Clarity: [you: is it well written? decide after the figures]',
    `Relevance: ${
      rel.length
        ? rel.map((x) => `${x.q.id.toUpperCase()} (matches ${x.r.matched.slice(0, 4).join(', ')})`).join('; ')
        : 'no keyword overlap with RQ1–RQ5'
    }`,
    `Read further? ${rel.length ? 'probably — it touches an RQ; confirm on the figures' : 'not unless the figures surprise you'}`,
    '',
    '(offline template — no LLM_API_KEY)',
  ].join('\n');
}

/** Cloze cards from sentences with numbers: the first number becomes the blank. */
export function offlineCards(p: Pick<PaperHit, 'abstract'>): CardDraft[] {
  const out: CardDraft[] = [];
  for (const s of sentences(p.abstract)) {
    if (!/\d|%/.test(s)) continue;
    const m = /\d[\d,.]*\s*(%|×|x\b|points?\b|pp\b)?/.exec(s);
    if (!m) continue;
    const answer = m[0].trim().replace(/[.,]+$/, '');
    out.push({ prompt: s.slice(0, m.index) + '____' + s.slice(m.index + answer.length), answer });
    if (out.length === 3) break;
  }
  return out;
}
