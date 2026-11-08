import type { NextRequest } from 'next/server';
import { cached } from '@/research/server/cache';
import { audiusSearch, audiusTrending, radioByTag, somafm } from '@/music/server';
import type { MusicResponse, Track } from '@/music/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MIN = 60 * 1000;

const bad = (error: string) => Response.json({ error }, { status: 400 });

/**
 * Catalogue proxy for the Music app.
 *
 *   ?source=trending[&genre=Electronic][&time=week|month|allTime]
 *   ?source=search&q=<text>
 *   ?source=somafm
 *   ?source=radio&tag=<tag>
 *
 * Same contract as the research routes: upstream failure is a 200 with `error`.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const source = sp.get('source') ?? '';
  let key: string;
  let ttl: number;
  let label: string;
  let run: () => Promise<Track[]>;

  if (source === 'trending') {
    const genre = (sp.get('genre') ?? '').slice(0, 40);
    const time = sp.get('time') ?? 'week';
    if (!['week', 'month', 'allTime'].includes(time)) return bad('time must be week, month or allTime');
    key = `music:trending:${genre}:${time}`;
    ttl = 30 * MIN;
    label = 'Audius';
    run = () => audiusTrending(genre || undefined, time);
  } else if (source === 'search') {
    const q = (sp.get('q') ?? '').trim();
    if (!q) return bad('q is required');
    if (q.length > 100) return bad('q is limited to 100 characters');
    key = `music:search:${q.toLowerCase()}`;
    ttl = 15 * MIN;
    label = 'Audius';
    run = () => audiusSearch(q);
  } else if (source === 'somafm') {
    key = 'music:somafm';
    ttl = 5 * MIN; // "now playing" goes stale fast
    label = 'SomaFM';
    run = somafm;
  } else if (source === 'radio') {
    const tag = (sp.get('tag') ?? '').trim().toLowerCase();
    if (!/^[a-z0-9 &-]{1,30}$/.test(tag)) return bad('tag must be a short word');
    key = `music:radio:${tag}`;
    ttl = 6 * 60 * MIN;
    label = 'Radio Browser';
    run = () => radioByTag(tag);
  } else {
    return bad('source must be one of trending, search, somafm, radio');
  }

  try {
    const r = await cached(key, ttl, run, { label, keep: (d) => d.length > 0 });
    const body: MusicResponse = { items: r.data, source, cached: r.cached, error: r.error };
    return Response.json(body, {
      headers: r.error ? { 'cache-control': 'no-store' } : { 'cache-control': `public, s-maxage=${ttl / 1000}, stale-while-revalidate=3600` },
    });
  } catch (err) {
    const body: MusicResponse = { items: [], source, cached: false, error: err instanceof Error ? err.message : String(err) };
    return Response.json(body, { headers: { 'cache-control': 'no-store' } });
  }
}
