import { fetchAiNews } from '@/os/ai/news';

export const runtime = 'nodejs';
/** Feeds are polled at most twice an hour; every visitor shares the same cache. */
export const revalidate = 1800;

export async function GET() {
  try {
    const payload = await fetchAiNews();
    return Response.json(payload, {
      headers: { 'cache-control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
    });
  } catch (err) {
    return Response.json(
      {
        items: [],
        unreachable: ['all'],
        fetchedAt: new Date().toISOString(),
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 200 },
    );
  }
}
