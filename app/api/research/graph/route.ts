import type { NextRequest } from 'next/server';
import type { GraphResponse } from '@/research/types';
import { cached } from '@/research/server/cache';
import { s2Graph } from '@/research/server/s2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DAY = 24 * 60 * 60 * 1000;
const ID = /^(arXiv:\d{4}\.\d{4,5}|DOI:10\..+)$/;

const empty = (reason: GraphResponse['reason']): GraphResponse => ({
  available: false,
  reason,
  references: [],
  citations: [],
  recommendations: [],
});

/**
 * Semantic Scholar bundle for one paper: `?id=arXiv:2507.05488` or `?id=DOI:10.…`.
 * Always 200 with `available`; the panel degrades to a link when S2 is down.
 * Only answers with something in them are cached, so a total 429 is retried
 * on the next open; a partial bundle is cached but not shared via the CDN as long.
 */
export async function GET(req: NextRequest) {
  const id = (req.nextUrl.searchParams.get('id') ?? '').trim();
  if (!ID.test(id) || id.length > 200) {
    return Response.json({ error: 'id must look like arXiv:2507.05488 or DOI:10.xxxx/…' }, { status: 400 });
  }
  try {
    const r = await cached(`s2:${id}`, DAY, () => s2Graph(id), {
      label: 'Semantic Scholar',
      keep: (d) => d.available,
    });
    return Response.json(r.data, {
      headers: {
        'cache-control': !r.data.available
          ? 'no-store'
          : r.data.reason
            ? 'public, s-maxage=600'
            : 'public, s-maxage=86400, stale-while-revalidate=86400',
      },
    });
  } catch {
    return Response.json(empty('unreachable'), { headers: { 'cache-control': 'no-store' } });
  }
}
