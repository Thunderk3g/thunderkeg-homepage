import type { NextRequest } from 'next/server';
import { cached } from '@/research/server/cache';
import { buildBrief } from '@/research/server/brief';
import { isTrackId } from '@/research/tracks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** a cold brief queues one arXiv query per topic, ≥3 s apart (arXiv's rule) */
export const maxDuration = 60;

/**
 * What to read this week for one track: ?track=core|defense|markets.
 * Cached for an hour here and at the CDN, and served stale while it rebuilds,
 * so only the first visitor after a quiet spell waits for the arXiv scan.
 */
export async function GET(req: NextRequest) {
  const track = req.nextUrl.searchParams.get('track') ?? 'core';
  if (!isTrackId(track)) return Response.json({ error: 'track must be one of core, defense, markets' }, { status: 400 });
  try {
    const r = await cached(`brief:${track}`, 60 * 60 * 1000, () => buildBrief(track), {
      label: 'brief',
      keep: (d) => d.picks.length > 0 && d.missed.length === 0,
    });
    // a partial scan (a topic timed out) is worth showing but not worth pinning at the CDN for an hour
    const partial = r.data.missed.length > 0 || !!r.error;
    return Response.json(r.error ? { ...r.data, error: r.error } : r.data, {
      headers: {
        'cache-control': partial ? 'public, s-maxage=300' : 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (err) {
    return Response.json(
      { track, picks: [], news: [], scanned: [], missed: [], considered: 0, fetchedAt: new Date().toISOString(), error: err instanceof Error ? err.message : String(err) },
      { headers: { 'cache-control': 'no-store' } },
    );
  }
}
