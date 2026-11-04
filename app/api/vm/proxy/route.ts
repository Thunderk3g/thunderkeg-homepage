/**
 * Tiny CORS proxy for the Virtual Machine app's network card.
 *
 * v86's `fetch` network backend turns every HTTP request the guest Linux makes
 * on port 80 into a browser `fetch()` of `/api/vm/proxy?url=<encoded url>`.
 * This route only forwards GETs to a fixed allowlist of hosts, caps responses
 * at 2 MB and 10 s, sends no cookies or credentials, and follows redirects
 * itself (re-checking every hop against the allowlist).
 *
 * Requests for this site itself (guest `wget http://portfolio/...`, or the
 * site's own hostname) are answered with a same-origin redirect, so the
 * browser fetches them directly.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_HOSTS = new Set([
  'export.arxiv.org',
  'api.semanticscholar.org',
  'huggingface.co',
  'example.com',
  'www.example.com',
  'www.kali.org',
  'raw.githubusercontent.com',
]);

/** Guest-side names that mean "the site hosting this VM". */
const SELF_HOSTS = new Set(['portfolio', 'site', 'host', 'localhost']);

const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 4;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

function text(status: number, body: string): Response {
  return new Response(body + '\n', {
    status,
    headers: { ...CORS, 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get('url');
  if (!raw) return text(400, 'vm-proxy: missing ?url=');

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return text(400, 'vm-proxy: invalid url');
  }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    return text(400, 'vm-proxy: only http(s) urls');
  }

  const selfHost = new URL(req.url).hostname;
  if (SELF_HOSTS.has(target.hostname) || target.hostname === selfHost) {
    // same-origin: let the browser fetch it directly
    return new Response(null, {
      status: 307,
      headers: { ...CORS, Location: target.pathname + target.search, 'Cache-Control': 'no-store' },
    });
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    let url = target;
    let res: Response | null = null;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (!ALLOWED_HOSTS.has(url.hostname)) {
        return text(
          403,
          `vm-proxy: ${url.hostname} is not on the allowlist.\nallowed: ${[...ALLOWED_HOSTS].join(', ')}, and this site (http://portfolio/)`,
        );
      }
      res = await fetch(url, {
        method: 'GET',
        redirect: 'manual',
        credentials: 'omit',
        cache: 'no-store',
        signal: ctrl.signal,
        headers: { 'User-Agent': 'kali-os-vm-proxy/1.0 (+v86 guest)', Accept: '*/*' },
      });
      const loc = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null;
      if (!loc) break;
      url = new URL(loc, url);
      res = null;
    }
    if (!res) return text(508, 'vm-proxy: too many redirects');

    const declared = Number(res.headers.get('content-length') ?? '0');
    if (declared > MAX_BYTES) return text(413, 'vm-proxy: response larger than 2 MB');

    const chunks: Uint8Array[] = [];
    let size = 0;
    if (res.body) {
      const reader = res.body.getReader();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_BYTES) {
          await reader.cancel();
          return text(413, 'vm-proxy: response larger than 2 MB');
        }
        chunks.push(value);
      }
    }
    const body = new Uint8Array(size);
    let off = 0;
    for (const c of chunks) {
      body.set(c, off);
      off += c.byteLength;
    }
    return new Response(body, {
      status: res.status,
      headers: {
        ...CORS,
        'Content-Type': res.headers.get('content-type') ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
        'X-Proxied-Url': url.href,
      },
    });
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    return text(aborted ? 504 : 502, `vm-proxy: ${aborted ? 'upstream timed out after 10 s' : 'upstream fetch failed'}`);
  } finally {
    clearTimeout(timer);
  }
}
