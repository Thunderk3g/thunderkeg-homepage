import type { PaperHit } from '../types';
import { UPSTREAM_UA, UpstreamError } from './cache';
import { ARXIV_ID } from './arxiv';
import { untex } from './xml';

/**
 * Hugging Face papers: the community-curated daily list (with upvotes) and a
 * keyword search. The API echoes CORS, but it is proxied anyway so responses
 * are normalised to PaperHit and cached. It replaces Papers with Code, which
 * shut down in July 2025.
 */

interface HfPaper {
  id: string;
  title?: string;
  summary?: string;
  authors?: { name?: string; hidden?: boolean }[];
  publishedAt?: string;
  upvotes?: number;
  ai_summary?: string;
}

interface HfRow {
  paper?: HfPaper;
  title?: string;
  summary?: string;
  publishedAt?: string;
}

function toHit(row: HfRow): PaperHit | null {
  const p = row.paper;
  if (!p || !ARXIV_ID.test(p.id)) return null;
  const title = untex((p.title ?? row.title ?? '').replace(/\s+/g, ' ').trim());
  if (!title) return null;
  return {
    id: `arxiv:${p.id}`,
    arxivId: p.id,
    title,
    authors: (p.authors ?? []).filter((a) => a.name && !a.hidden).map((a) => a.name!),
    abstract: untex((p.summary ?? row.summary ?? '').replace(/\s+/g, ' ').trim()),
    published: p.publishedAt ?? row.publishedAt ?? '',
    categories: [],
    absUrl: `https://arxiv.org/abs/${p.id}`,
    pdfUrl: `https://arxiv.org/pdf/${p.id}`,
    source: 'hf',
    upvotes: typeof p.upvotes === 'number' ? p.upvotes : 0,
    aiSummary: p.ai_summary || undefined,
  };
}

async function getRows(url: string): Promise<HfRow[]> {
  const res = await fetch(url, {
    headers: { 'user-agent': UPSTREAM_UA, accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
    cache: 'no-store',
  });
  if (!res.ok) throw new UpstreamError(`Hugging Face: HTTP ${res.status}`, res.status);
  const data = (await res.json()) as unknown;
  return Array.isArray(data) ? (data as HfRow[]) : [];
}

export async function hfDaily(date?: string): Promise<PaperHit[]> {
  const params = new URLSearchParams({ limit: '50' });
  if (date) params.set('date', date);
  const rows = await getRows(`https://huggingface.co/api/daily_papers?${params}`);
  return rows
    .map(toHit)
    .filter((x): x is PaperHit => !!x)
    .sort((a, b) => (b.upvotes ?? 0) - (a.upvotes ?? 0));
}

export async function hfSearch(q: string): Promise<PaperHit[]> {
  const rows = await getRows(`https://huggingface.co/api/papers/search?${new URLSearchParams({ q })}`);
  return rows.map(toHit).filter((x): x is PaperHit => !!x).slice(0, 40);
}
