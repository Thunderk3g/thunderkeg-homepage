import type { PaperHit } from './types';

/**
 * BibTeX, generated locally. arXiv serves the same `@misc{…eprint…}` shape at
 * /bibtex/{id}, but that would be one more rate-limited request per paper for
 * fields we already hold.
 */

type BibSource = Pick<PaperHit, 'title' | 'authors' | 'published' | 'arxivId' | 'primaryCategory' | 'categories' | 'absUrl' | 'venue' | 'doi'> & {
  bibKey?: string;
};

const fold = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');

/** arXiv ids encode the submission month (YYMM.NNNNN), which beats a note's date. */
export function paperYear(p: Pick<PaperHit, 'arxivId' | 'published' | 'venue'>): string {
  if (p.arxivId) return `20${p.arxivId.slice(0, 2)}`;
  const fromVenue = /\b(19|20)\d{2}\b/.exec(p.venue ?? '');
  if (fromVenue) return fromVenue[0];
  return (p.published || '').slice(0, 4) || 'nd';
}

/** e.g. `pattnayak2026snwer`; pass the keys already taken to get a/b suffixes. */
export function bibKey(p: BibSource, taken: Iterable<string> = []): string {
  const first = p.authors[0] ?? '';
  const surname = fold(first.trim().split(/\s+/).pop() ?? '') || 'anon';
  const word = p.title.split(/[^A-Za-zÀ-ÿ0-9-]+/).map((w) => fold(w)).find((w) => w.length >= 4) ?? 'paper';
  const base = `${surname}${paperYear(p)}${word}`;
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let i = 0; i < 26; i++) {
    const k = base + String.fromCharCode(97 + i);
    if (!used.has(k)) return k;
  }
  return `${base}${used.size}`;
}

const esc = (s: string) => s.replace(/([{}%&_#])/g, '\\$1');

export function toBibtex(p: BibSource, key = p.bibKey || bibKey(p)): string {
  const fields: [string, string][] = [
    ['title', `{${esc(p.title)}}`],
    ['author', esc(p.authors.join(' and ') || 'Anonymous')],
    ['year', paperYear(p)],
  ];
  if (p.arxivId) {
    fields.push(
      ['eprint', p.arxivId],
      ['archivePrefix', 'arXiv'],
      ['primaryClass', p.primaryCategory ?? p.categories[0] ?? 'cs.CL'],
      ['url', p.absUrl],
    );
  } else {
    if (p.doi) fields.push(['doi', p.doi]);
    if (p.venue) fields.push(['note', esc(p.venue)]);
    fields.push(['howpublished', `\\url{${p.absUrl}}`]);
  }
  return `@misc{${key},\n${fields.map(([k, v]) => `  ${k}={${v}}`).join(',\n')}\n}`;
}

/** Re-keys on collision so the exported file never has duplicate keys. */
export function toBibtexAll(papers: BibSource[]): string {
  const taken = new Set<string>();
  return papers
    .map((p) => {
      const key = p.bibKey && !taken.has(p.bibKey) ? p.bibKey : bibKey(p, taken);
      taken.add(key);
      return toBibtex(p, key);
    })
    .join('\n\n');
}
