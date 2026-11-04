import type { NextRequest } from 'next/server';
import type { RelatedResponse } from '@/research/types';
import { cached } from '@/research/server/cache';
import { s2Recommendations } from '@/research/server/s2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DAY = 24 * 60 * 60 * 1000;
const ID = /^(arXiv:\d{4}\.\d{4,5}|DOI:10\..+)$/;

/**
 * Semantic Scholar recommendations for one paper: `?id=arXiv:2507.05488`.
 * Same contract as /api/research/graph: always 200 with `available`; only
 * non-empty answers are cached, so a 429 is retried on the next open.
 */
export async function GET(req: NextRequest) {
  const id = (req.nextUrl.searchParams.get('id') ?? '').trim();
  if (!ID.test(id) || id.length > 200) {
    return Response.json({ error: 'id must look like arXiv:2507.05488 or DOI:10.xxxx/…' }, { status: 400 });
  }
  try {
    const r = await cached(`s2rec:${id}`, DAY, () => s2Recommendations(id), {
      label: 'Semantic Scholar',
      keep: (d) => d.available,
    });
    return Response.json(r.data, {
      headers: { 'cache-control': r.data.available ? 'public, s-maxage=86400, stale-while-revalidate=86400' : 'no-store' },
    });
  } catch {
    const body: RelatedResponse = { available: false, reason: 'unreachable', items: [] };
    return Response.json(body, { headers: { 'cache-control': 'no-store' } });
  }
}
