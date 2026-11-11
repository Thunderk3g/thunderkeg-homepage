/**
 * Can the Firefox app frame this page? GET ?url=<allow-listed https URL>
 * → { embeddable: boolean }. Only hosts in EMBED_HOSTS are checked; the
 * answer comes from the page's own X-Frame-Options / CSP frame-ancestors.
 * Results are cached in memory for an hour per URL.
 */
import { framingAllowed, isEmbedHost } from '@/os/apps/browser/embeds';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, { at: number; embeddable: boolean }>();

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, max-age=300' },
  });

export async function GET(req: Request) {
  const self = new URL(req.url);
  const raw = self.searchParams.get('url');
  let target: URL;
  try {
    target = new URL(raw ?? '');
  } catch {
    return json({ error: 'invalid url' }, 400);
  }
  if (target.protocol !== 'https:' || !isEmbedHost(target.hostname)) return json({ embeddable: false });

  const key = target.toString();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return json({ embeddable: hit.embeddable });

  try {
    const res = await fetch(key, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Mozilla/5.0 (portfolio frame check)' },
    });
    // a redirect off the allow-list is treated as not embeddable
    const embeddable = res.ok && isEmbedHost(new URL(res.url).hostname) && framingAllowed(res.headers, self.origin);
    await res.body?.cancel();
    cache.set(key, { at: Date.now(), embeddable });
    return json({ embeddable });
  } catch {
    return json({ embeddable: false, error: 'unreachable' });
  }
}
