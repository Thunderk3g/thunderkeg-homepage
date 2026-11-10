/**
 * Same-origin reader proxy for arXiv: the PDF (so the browser's own PDF viewer
 * renders it inside an iframe — arxiv.org sends no frame-friendly CORS) and the
 * arXiv HTML rendering (LaTeXML), cleaned up for a sandboxed iframe.
 *
 * Self-contained on purpose (no path aliases, no Next imports) so it can be
 * exercised directly with `node --experimental-strip-types`.
 *
 * Safety: the upstream URL is built from a validated id on a fixed host, every
 * redirect hop is re-checked against the allow-list, and bodies are capped.
 */

export const MAX_BYTES = 25 * 1024 * 1024;
export const ALLOWED_HOSTS = new Set(['arxiv.org', 'www.arxiv.org', 'export.arxiv.org']);
const UA = 'diwakar-portfolio/2.1 (+https://github.com/Thunderk3g)';
const MAX_REDIRECTS = 4;

export type ReaderFormat = 'pdf' | 'html';
/** off: plain page · results: only result sentences tinted · all: goal / method / result */
export type Facets = 'off' | 'results' | 'all';

const NEW_ID = /^\d{4}\.\d{4,5}(v\d{1,3})?$/;
const OLD_ID = /^[a-z][a-z-]*(\.[A-Z]{2})?\/\d{7}(v\d{1,3})?$/;

/** Accepts `2606.02548`, `2606.02548v2`, `arXiv:2606.02548`, `hep-th/9901001`. Anything else → null. */
export function parseArxivId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const id = raw.trim().replace(/^arxiv:/i, '');
  if (id.length > 40) return null;
  return NEW_ID.test(id) || OLD_ID.test(id) ? id : null;
}

export function upstreamUrl(id: string, format: ReaderFormat): string {
  return `https://arxiv.org/${format}/${id}`;
}

export function isAllowedUrl(u: string | URL): boolean {
  try {
    const url = typeof u === 'string' ? new URL(u) : u;
    return url.protocol === 'https:' && ALLOWED_HOSTS.has(url.hostname) && !url.username && !url.password && (url.port === '' || url.port === '443');
  } catch {
    return false;
  }
}

type FetchImpl = (input: string, init?: RequestInit) => Promise<Response>;

export class ProxyError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** fetch with manual redirects, each hop held to the allow-list. */
export async function fetchAllowed(
  url: string,
  init: { method?: 'GET' | 'HEAD'; signal?: AbortSignal } = {},
  fetchImpl: FetchImpl = fetch,
): Promise<{ res: Response; finalUrl: string }> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!isAllowedUrl(current)) throw new ProxyError(`refusing to fetch ${new URL(current).hostname}`, 400);
    const res = await fetchImpl(current, {
      method: init.method ?? 'GET',
      redirect: 'manual',
      signal: init.signal,
      headers: { 'user-agent': UA, accept: 'application/pdf,text/html;q=0.9,*/*;q=0.5' },
      cache: 'no-store',
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) throw new ProxyError('redirect without location', 502);
      current = new URL(loc, current).toString();
      continue;
    }
    return { res, finalUrl: current };
  }
  throw new ProxyError('too many redirects', 502);
}

const typeOk = (format: ReaderFormat, ct: string | null) =>
  format === 'pdf' ? /application\/(pdf|x-pdf)|octet-stream/i.test(ct ?? '') : /text\/html/i.test(ct ?? '');

/** Counts bytes through the stream and errors it past the cap. */
export function capped(body: ReadableStream<Uint8Array>, max = MAX_BYTES): ReadableStream<Uint8Array> {
  let seen = 0;
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, ctl) {
        seen += chunk.byteLength;
        if (seen > max) ctl.error(new ProxyError(`over the ${Math.round(max / 1048576)} MB cap`, 413));
        else ctl.enqueue(chunk);
      },
    }),
  );
}

async function readCapped(res: Response, max = MAX_BYTES): Promise<string> {
  if (!res.body) return '';
  const reader = capped(res.body, max).getReader();
  const parts: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(parts));
}

/* ───────────────────────── HTML clean-up + faceted skim ───────────────────────── */

const FACET_RULES: { facet: 'goal' | 'method' | 'result'; re: RegExp }[] = [
  {
    facet: 'result',
    re: /\b(we (find|found|observe|show)|results? (show|indicate|suggest)|outperform|improv(es|ed|ement)|reduc(es|ed|tion)|achiev(es|ed)|accuracy of|significant(ly)?|\d+(\.\d+)?\s?(%|pp|points)|relative (gain|reduction))\b/i,
  },
  {
    facet: 'method',
    re: /\b(we (use|train|fine-tune|apply|compute|implement|design|construct|build|introduce)|our (approach|method|model|pipeline|system|framework)|is computed|we follow|dataset|baseline|architecture|algorithm)\b/i,
  },
  {
    facet: 'goal',
    re: /\b(in this (paper|work)|we (propose|present|study|investigate|ask|address|aim)|our goal|the goal|research question|this paper|we argue|motivat)/i,
  },
];

const strip = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ');

export function classifyParagraph(text: string): 'goal' | 'method' | 'result' | null {
  // the first rule to match wins; results first because they are what gets cited
  for (const r of FACET_RULES) if (r.re.test(text)) return r.facet;
  return null;
}

const FACET_CSS = `
.rsx-f-goal{background:rgba(216,178,106,.13);box-shadow:inset 3px 0 0 #d8b26a}
.rsx-f-method{background:rgba(74,168,255,.11);box-shadow:inset 3px 0 0 #4aa8ff}
.rsx-f-result{background:rgba(143,214,180,.15);box-shadow:inset 3px 0 0 #8fd6b4}
.rsx-f-goal,.rsx-f-method,.rsx-f-result{padding-left:8px;border-radius:2px}
.rsx-f-legend{position:sticky;top:0;z-index:9;display:flex;gap:12px;padding:4px 10px;font:12px/1.6 system-ui,sans-serif;background:#1b1e24;color:#d3d8e0;border-bottom:1px solid #333844}
.rsx-f-legend b{font-weight:600;padding:0 6px;border-radius:2px}
`;

/** Strip scripts and handlers, pin relative URLs to arXiv, optionally tint paragraphs by facet. */
export function prepareHtml(html: string, baseHref: string, facets: Facets): string {
  let out = html
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<script\b[^>]*\/?>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/<base\b[^>]*>/gi, '')
    .replace(/<meta[^>]+http-equiv=["']?refresh[^>]*>/gi, '');

  const counts = { goal: 0, method: 0, result: 0 };
  if (facets !== 'off') {
    out = out.replace(/<p\b([^>]*)>([\s\S]*?)<\/p>/gi, (whole, attrs: string, inner: string) => {
      const facet = classifyParagraph(strip(inner));
      if (!facet || (facets === 'results' && facet !== 'result')) return whole;
      counts[facet]++;
      const cls = `rsx-f-${facet}`;
      const withClass = /\bclass\s*=\s*"/i.test(attrs)
        ? attrs.replace(/\bclass\s*=\s*"/i, `class="${cls} `)
        : `${attrs} class="${cls}"`;
      return `<p${withClass}>${inner}</p>`;
    });
  }

  const head = `<base href="${baseHref.replace(/"/g, '%22')}"><style>${FACET_CSS}</style>`;
  out = /<head\b[^>]*>/i.test(out) ? out.replace(/<head\b[^>]*>/i, (m) => m + head) : head + out;
  if (facets !== 'off') {
    const legend =
      `<div class="rsx-f-legend">Faceted skim (keyword heuristic, not a model):` +
      (facets === 'all' ? ` <b class="rsx-f-goal">goal ${counts.goal}</b> <b class="rsx-f-method">method ${counts.method}</b>` : '') +
      ` <b class="rsx-f-result">result ${counts.result}</b></div>`;
    out = /<body\b[^>]*>/i.test(out) ? out.replace(/<body\b[^>]*>/i, (m) => m + legend) : legend + out;
  }
  return out;
}

/* ───────────────────────── handlers ───────────────────────── */

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

const versioned = (id: string) => /v\d+$/.test(id);
const cacheFor = (id: string) =>
  versioned(id)
    ? 'public, max-age=86400, s-maxage=31536000, immutable'
    : 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800';

export interface ProxyParams {
  id: string | null;
  format: string | null;
  check?: boolean;
  facets?: string | null;
}

/** The whole GET handler, minus Next. Returns a Response for every input. */
export async function handleReader(p: ProxyParams, fetchImpl: FetchImpl = fetch): Promise<Response> {
  const id = parseArxivId(p.id);
  if (!id) return json({ error: 'id must be an arXiv id like 2606.02548 or hep-th/9901001' }, 400);
  const format: ReaderFormat = p.format === 'html' ? 'html' : 'pdf';
  if (p.format && p.format !== 'html' && p.format !== 'pdf') return json({ error: 'format must be pdf or html' }, 400);
  const facets: Facets = p.facets === 'all' || p.facets === 'results' ? p.facets : 'off';

  try {
    if (p.check) {
      // HEAD is cheap and arXiv answers it; some mirrors do not, so fall back to a GET we abort
      let { res } = await fetchAllowed(upstreamUrl(id, format), { method: 'HEAD', signal: AbortSignal.timeout(8000) }, fetchImpl);
      if (res.status === 405) {
        const ctl = new AbortController();
        ({ res } = await fetchAllowed(upstreamUrl(id, format), { signal: ctl.signal }, fetchImpl));
        ctl.abort();
      }
      const len = Number(res.headers.get('content-length')) || undefined;
      const ok = res.ok && typeOk(format, res.headers.get('content-type')) && (!len || len <= MAX_BYTES);
      return json(
        { ok, format, status: res.status, bytes: len, error: ok ? undefined : len && len > MAX_BYTES ? 'too large' : `upstream ${res.status}` },
        200,
        { 'cache-control': ok ? 'public, max-age=600, s-maxage=3600' : 'no-store' },
      );
    }

    const { res, finalUrl } = await fetchAllowed(upstreamUrl(id, format), { signal: AbortSignal.timeout(20000) }, fetchImpl);
    if (!res.ok) return json({ error: `arXiv answered ${res.status}` }, res.status === 404 ? 404 : 502, { 'cache-control': 'no-store' });
    const ct = res.headers.get('content-type');
    if (!typeOk(format, ct)) return json({ error: `arXiv sent ${ct ?? 'no content-type'}, not ${format}` }, 502, { 'cache-control': 'no-store' });
    const len = Number(res.headers.get('content-length')) || 0;
    if (len > MAX_BYTES) return json({ error: 'over the 25 MB cap' }, 413, { 'cache-control': 'no-store' });

    if (format === 'pdf') {
      const headers: Record<string, string> = {
        'content-type': 'application/pdf',
        'content-disposition': `inline; filename="${id.replace(/\//g, '_')}.pdf"`,
        'cache-control': cacheFor(id),
        'x-content-type-options': 'nosniff',
      };
      if (len) headers['content-length'] = String(len);
      return new Response(res.body ? capped(res.body) : null, { status: 200, headers });
    }

    const html = await readCapped(res);
    // LaTeXML pages live at /html/<id>v<n>/ and use relative asset paths
    const base = finalUrl.endsWith('/') ? finalUrl : finalUrl + '/';
    return new Response(prepareHtml(html, base, facets), {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': cacheFor(id),
        'x-content-type-options': 'nosniff',
        // no scripts, no same-origin: the page cannot touch the app around it
        'content-security-policy': "sandbox allow-popups allow-popups-to-escape-sandbox; script-src 'none'; object-src 'none'",
      },
    });
  } catch (err) {
    if (err instanceof ProxyError) return json({ error: err.message }, err.status, { 'cache-control': 'no-store' });
    const msg = err instanceof Error ? err.message : String(err);
    return json({ error: `upstream unreachable: ${msg}` }, 502, { 'cache-control': 'no-store' });
  }
}
