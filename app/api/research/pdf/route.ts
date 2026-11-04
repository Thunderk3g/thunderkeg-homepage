import type { NextRequest } from 'next/server';
import { handleReader } from '@/research/server/pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Reader proxy for the Research app's Read mode.
 *
 *   ?id=2606.02548                 the PDF, streamed (application/pdf, inline)
 *   ?id=2606.02548&format=html     arXiv's HTML rendering, scripts stripped, sandboxed
 *        &facets=all|results       … with goal / method / result paragraphs tinted
 *   ?id=…&check=1                  JSON { ok, status, bytes } — probes without downloading
 *
 * Only arxiv.org is ever fetched (the id is validated and every redirect is
 * re-checked); bodies are capped at 25 MB. See src/research/server/pdf.ts.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  return handleReader({
    id: sp.get('id'),
    format: sp.get('format'),
    check: sp.get('check') === '1',
    facets: sp.get('facets'),
  });
}
