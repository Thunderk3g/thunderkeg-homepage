import type { NextRequest } from 'next/server';
import { fetchNews, type NewsPayload } from '@/os/ai/news';
import { cached } from '@/research/server/cache';
import { isTrackId } from '@/research/tracks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HALF_HOUR = 30 * 60 * 1000;

/**
 * Live headlines for one research track: ?track=core|defense|markets.
 * Feeds are polled at most twice an hour per track; every visitor shares the
 * same cache. An upstream failure is a 200 with `error`, never a 5xx.
 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('track') ?? 'core';
  if (!isTrackId(raw)) return Response.json({ error: 'track must be one of core, defense, markets' }, { status: 400 });

  try {
    // a payload where every feed failed is not worth caching
    const r = await cached(`news:${raw}`, HALF_HOUR, () => fetchNews(raw), { label: 'news feeds', keep: (d) => d.items.length > 0 });
    return Response.json(r.error ? { ...r.data, error: r.error } : r.data, {
      headers: { 'cache-control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
    });
  } catch (err) {
    const body: NewsPayload & { error: string } = {
      track: raw,
      items: [],
      unreachable: ['all'],
      fetchedAt: new Date().toISOString(),
      error: err instanceof Error ? err.message : String(err),
    };
    return Response.json(body, { headers: { 'cache-control': 'no-store' } });
  }
}
