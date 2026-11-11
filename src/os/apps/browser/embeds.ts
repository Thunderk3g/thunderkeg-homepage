/**
 * External pages the Firefox app may try to show inside its own frame.
 * Anything else typed in the address bar opens in a real browser tab.
 * Whether an allow-listed page actually lets itself be framed is decided at
 * runtime by /api/browser/frame-check (X-Frame-Options / CSP frame-ancestors),
 * since sites change those headers without notice.
 */
export const EMBED_HOSTS = ['arxiv.org', 'huggingface.co', 'scholar.google.com'] as const;

/** The page probed per host to decide frameability (the headers are site-wide in practice). */
export const EMBED_PROBES: Record<(typeof EMBED_HOSTS)[number], string> = {
  'arxiv.org': 'https://arxiv.org/abs/2301.00001',
  'huggingface.co': 'https://huggingface.co/papers',
  'scholar.google.com': 'https://scholar.google.com/',
};

export const embedHostKey = (host: string) => host.toLowerCase().replace(/^www\./, '');

export function isEmbedHost(host: string): boolean {
  return (EMBED_HOSTS as readonly string[]).includes(embedHostKey(host));
}

/**
 * Whether response headers allow framing by `origin`. Conservative: anything
 * we can't positively read as permitted counts as refused.
 */
export function framingAllowed(headers: Headers, origin: string): boolean {
  const xfo = headers.get('x-frame-options')?.trim().toLowerCase();
  if (xfo && (xfo === 'deny' || xfo === 'sameorigin' || xfo.startsWith('allow-from'))) return false;
  const csp = headers.get('content-security-policy') ?? '';
  const fa = csp
    .split(';')
    .map((d) => d.trim())
    .find((d) => d.toLowerCase().startsWith('frame-ancestors'));
  if (!fa) return true;
  const sources = fa.split(/\s+/).slice(1);
  if (sources.includes('*')) return true;
  const o = origin.toLowerCase();
  return sources.some((s) => s.toLowerCase() === o);
}
