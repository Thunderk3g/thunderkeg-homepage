import type { Card, Highlight, Paper } from './types';
import { isoDay } from './schedule';

/**
 * A paper as a `content/*.md` note in the existing frontmatter (see
 * src/content/writing.ts): flat `key: value` lines, comma-separated lists.
 * Commit the file and it publishes as a paper note on /writing.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Frontmatter values are single lines; keep them that way. */
const one = (s: string) => s.replace(/\s+/g, ' ').trim();

const STATUS_FOR_CONTENT: Record<Paper['status'], string> = {
  inbox: 'to read',
  pass1: 'reading',
  pass2: 'reading',
  pass3: 'reading',
  done: 'read',
  dropped: 'dropped',
};

export function contentSlug(p: Pick<Paper, 'title' | 'contentSlug'>): string {
  if (p.contentSlug) return p.contentSlug;
  const words = p.title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6);
  return `paper-${words.join('-')}`;
}

function venue(p: Paper): string {
  if (p.arxivId) {
    const yy = p.arxivId.slice(0, 2);
    const mm = Number(p.arxivId.slice(2, 4));
    return `arXiv:${p.arxivId} (${MONTHS[mm - 1] ?? ''} 20${yy})`;
  }
  return p.venue ?? '';
}

export function toContentMarkdown(
  p: Paper,
  extra: { highlights?: Highlight[]; cards?: Card[] } = {},
): string {
  const n = p.note;
  const summary = n.delta.split('\n').find((l) => l.trim()) || n.fiveCs.contributions || p.abstract.slice(0, 200);
  const front = [
    '---',
    'kind: paper',
    `title: ${one(p.title)}`,
    `date: ${isoDay()}`,
    `authors: ${one(p.authors.join(', '))}`,
    `venue: ${one(venue(p))}`,
    `link: ${p.absUrl}`,
    `status: ${STATUS_FOR_CONTENT[p.status]}`,
    `summary: ${one(summary)}`,
    `tags: ${p.tags.join(', ')}`,
    '---',
  ];

  const section = (title: string, body: string) => (body.trim() ? [`## ${title}`, '', body.trim(), ''] : []);
  const cs = n.fiveCs;
  const fiveCs = [
    ['Category', cs.category],
    ['Context', cs.context],
    ['Correctness', cs.correctness],
    ['Contributions', cs.contributions],
    ['Clarity', cs.clarity],
  ]
    .filter(([, v]) => v.trim())
    .map(([k, v]) => `- **${k}.** ${one(v)}`)
    .join('\n');

  const body = [
    ...section('First pass', fiveCs),
    ...section('Problem', n.problem),
    ...section('Method', n.method),
    ...section('Results', n.results),
    ...section('Limitations', n.limitations),
    ...section('Critique', n.critique),
    ...section('What is left for my work', n.delta),
    ...(n.freeform.trim() ? [n.freeform.trim(), ''] : []),
    ...section('Highlights', highlightsMd(extra.highlights ?? [])),
    ...section('Recall cards', cardsMd(extra.cards ?? [])),
  ];

  return [...front, '', ...body].join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

function highlightsMd(hs: Highlight[]): string {
  return hs
    .map((h) => {
      const where = h.where ? ` (${one(h.where)})` : '';
      const why = h.why ? `\n  — ${one(h.why)}` : '';
      return `- > ${one(h.text)}${where}${why}`;
    })
    .join('\n');
}

function cardsMd(cs: Card[]): string {
  return cs
    .filter((c) => !c.suspended)
    .map((c) => `- **Q.** ${one(c.prompt)}\n  **A.** ${one(c.answer)}`)
    .join('\n');
}
