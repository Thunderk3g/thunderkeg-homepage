import type { PaperHit } from '../types';
import { UPSTREAM_UA, UpstreamError, arxivGate } from './cache';
import { decode, entries, iso, tag, untex } from './xml';

/**
 * arXiv API client — server-side only (the API sends no CORS headers, and the
 * gate only works if every request goes through this process). The metadata is
 * CC0; e-prints keep their own licences, so we link to them and never rehost.
 */

const API = 'https://export.arxiv.org/api/query';
export const ARXIV_ID = /^\d{4}\.\d{4,5}$/;

/** `http://arxiv.org/abs/2507.05488v2` → `2507.05488` */
const stripId = (url: string) => /(\d{4}\.\d{4,5})(v\d+)?\/?$/.exec(url)?.[1] ?? '';

function parseEntry(xml: string): PaperHit | null {
  const idUrl = tag(xml, 'id');
  const arxivId = stripId(idUrl);
  if (!arxivId) return null;
  const authors = entries(xml, 'author').map((a) => tag(a, 'name')).filter(Boolean);
  const categories = [...xml.matchAll(/<category[^>]*term=["']([^"']+)["']/gi)].map((m) => m[1]);
  const primary = /<arxiv:primary_category[^>]*term=["']([^"']+)["']/i.exec(xml)?.[1];
  const doi = tag(xml, 'arxiv:doi') || undefined;
  const journal = tag(xml, 'arxiv:journal_ref') || undefined;
  return {
    id: `arxiv:${arxivId}`,
    arxivId,
    doi,
    title: untex(tag(xml, 'title')),
    authors,
    abstract: untex(tag(xml, 'summary')),
    published: iso(tag(xml, 'published')),
    categories,
    primaryCategory: primary ?? categories[0],
    absUrl: `https://arxiv.org/abs/${arxivId}`,
    pdfUrl: `https://arxiv.org/pdf/${arxivId}`,
    source: 'arxiv',
    venue: journal,
  };
}

function parseFeed(xml: string): { items: PaperHit[]; total: number } {
  const nodes = entries(xml, 'entry');
  // malformed queries come back as a single entry whose id is an error URL
  const err = nodes.find((n) => /arxiv\.org\/api\/errors/.test(tag(n, 'id')));
  if (err) throw new UpstreamError(`arXiv rejected the query: ${tag(err, 'summary') || 'syntax error'}`, 400);
  const total = Number(decode(/<opensearch:totalResults[^>]*>([^<]*)</i.exec(xml)?.[1] ?? '0')) || 0;
  const items = nodes.map(parseEntry).filter((x): x is PaperHit => !!x && !!x.title);
  return { items, total };
}

async function get(params: URLSearchParams): Promise<{ items: PaperHit[]; total: number }> {
  return arxivGate(async () => {
    const res = await fetch(`${API}?${params}`, {
      headers: { 'user-agent': UPSTREAM_UA },
      signal: AbortSignal.timeout(12000),
      cache: 'no-store',
    });
    // a 400 carries an Atom error entry; parseFeed turns it into a readable message
    if (res.status === 400) parseFeed(await res.text());
    if (!res.ok) throw new UpstreamError(`arXiv: HTTP ${res.status}`, res.status);
    return parseFeed(await res.text());
  });
}

export function arxivSearch(q: string, start: number, max: number) {
  return get(
    new URLSearchParams({
      search_query: q,
      sortBy: 'submittedDate',
      sortOrder: 'descending',
      start: String(start),
      max_results: String(max),
    }),
  );
}

/** Best match first rather than newest first — for goal search. */
export function arxivRelevance(q: string, max: number) {
  return get(new URLSearchParams({ search_query: q, sortBy: 'relevance', sortOrder: 'descending', max_results: String(max) }));
}

export function arxivByIds(ids: string[]) {
  return get(new URLSearchParams({ id_list: ids.join(','), max_results: String(ids.length) }));
}
