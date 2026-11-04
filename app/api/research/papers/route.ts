import type { NextRequest } from 'next/server';
import type { PaperHit, PapersResponse } from '@/research/types';
import { cached } from '@/research/server/cache';
import { ARXIV_ID, arxivByIds, arxivSearch } from '@/research/server/arxiv';
import { hfDaily, hfSearch } from '@/research/server/hf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HOUR = 60 * 60 * 1000;
const CACHE_HEADERS = { 'cache-control': 'public, s-maxage=900, stale-while-revalidate=3600' };

const bad = (error: string) => Response.json({ error }, { status: 400 });

/**
 * Paper search proxy for the Research app and the terminal.
 *
 *   ?source=arxiv&q=<search_query>&start=0&max=25
 *   ?source=arxiv&ids=2606.02548,2507.05488
 *   ?source=hf-daily[&date=YYYY-MM-DD]
 *   ?source=hf-search&q=<text>
 *
 * Same contract as /api/ai-news: an upstream failure is a 200 with `error`,
 * never a 5xx. 400 is reserved for parameters we refuse to forward.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const source = sp.get('source') ?? '';
  const q = (sp.get('q') ?? '').trim();

  let key: string;
  let ttl = HOUR;
  let label = 'arXiv';
  let run: () => Promise<{ items: PaperHit[]; total?: number }>;

  if (source === 'arxiv') {
    const idsRaw = (sp.get('ids') ?? '').trim();
    if (idsRaw) {
      const ids = [...new Set(idsRaw.split(',').map((s) => s.trim().replace(/^arxiv:/i, '').replace(/v\d+$/, '')))];
      if (ids.length > 20 || ids.some((id) => !ARXIV_ID.test(id))) {
        return bad('ids must be up to 20 arXiv ids like 2507.05488');
      }
      key = `arxiv:ids:${ids.sort().join(',')}`;
      run = () => arxivByIds(ids);
    } else {
      if (!q) return bad('q is required for source=arxiv');
      if (q.length > 400) return bad('q is limited to 400 characters');
      const start = Math.max(0, Math.min(10000, Number(sp.get('start')) || 0));
      const max = Math.max(1, Math.min(50, Number(sp.get('max')) || 25));
      key = `arxiv:q:${q}:${start}:${max}`;
      run = () => arxivSearch(q, start, max);
    }
  } else if (source === 'hf-daily') {
    const date = sp.get('date') ?? '';
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return bad('date must be YYYY-MM-DD');
    key = `hf:daily:${date}`;
    ttl = HOUR / 2;
    label = 'Hugging Face';
    run = async () => ({ items: await hfDaily(date || undefined) });
  } else if (source === 'hf-search') {
    if (!q) return bad('q is required for source=hf-search');
    if (q.length > 250) return bad('q is limited to 250 characters');
    key = `hf:search:${q.toLowerCase()}`;
    label = 'Hugging Face';
    run = async () => ({ items: await hfSearch(q) });
  } else {
    return bad('source must be one of arxiv, hf-daily, hf-search');
  }

  try {
    const r = await cached(key, ttl, run, { label });
    const body: PapersResponse = {
      items: r.data.items,
      total: r.data.total,
      source,
      fetchedAt: new Date().toISOString(),
      cached: r.cached,
      error: r.error,
    };
    return Response.json(body, { headers: r.error ? { 'cache-control': 'no-store' } : CACHE_HEADERS });
  } catch (err) {
    const body: PapersResponse = {
      items: [],
      source,
      fetchedAt: new Date().toISOString(),
      cached: false,
      error: err instanceof Error ? err.message : String(err),
    };
    return Response.json(body, { headers: { 'cache-control': 'no-store' } });
  }
}
