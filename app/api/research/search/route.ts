import type { NextRequest } from 'next/server';
import { cached } from '@/research/server/cache';
import { searchGoal } from '@/research/server/search';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * Goal search for the Research app: ?q=<what you want to study>.
 * Cached six hours per goal; an upstream failure is a 200 with `missed`.
 */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim().replace(/\s+/g, ' ');
  if (!q) return Response.json({ error: 'q is required' }, { status: 400 });
  if (q.length > 300) return Response.json({ error: 'q is limited to 300 characters' }, { status: 400 });
  try {
    const r = await cached(`search:${q.toLowerCase()}`, 6 * 60 * 60 * 1000, () => searchGoal(q), {
      label: 'search',
      keep: (d) => d.items.length > 0 && d.missed.length === 0,
    });
    const partial = r.data.missed.length > 0 || !r.data.items.length;
    return Response.json(r.data, {
      headers: { 'cache-control': partial ? 'no-store' : 'public, s-maxage=21600, stale-while-revalidate=86400' },
    });
  } catch (err) {
    return Response.json(
      { q, terms: [], arxivQuery: '', items: [], citationsAvailable: false, missed: ['all'], fetchedAt: new Date().toISOString(), error: err instanceof Error ? err.message : String(err) },
      { headers: { 'cache-control': 'no-store' } },
    );
  }
}
