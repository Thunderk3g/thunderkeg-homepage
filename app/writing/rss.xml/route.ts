import { allEntries } from '@/content/writing';
import { profile } from '@/data/resume';

export const dynamic = 'force-static';

/**
 * Absolute base for feed links. NEXT_PUBLIC_SITE_URL wins (set it when a custom
 * domain is attached); otherwise Vercel's own production hostname, which it
 * exposes at build time. (diwakar.dev is not this site.)
 */
const SITE =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'https://portfolio-thunderk3gs-projects.vercel.app');

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function GET() {
  const items = allEntries()
    .map(
      (e) => `    <item>
      <title>${escape(e.title)}</title>
      <link>${SITE}/writing/${e.slug}</link>
      <guid isPermaLink="true">${SITE}/writing/${e.slug}</guid>
      <pubDate>${e.date ? new Date(e.date).toUTCString() : ''}</pubDate>
      <category>${e.kind}</category>
      <description>${escape(e.summary)}</description>
    </item>`,
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escape(profile.name)} — Writing</title>
    <link>${SITE}/writing</link>
    <description>Posts, articles and paper notes on retrieval-grounded compliance AI and code-switched speech.</description>
    <language>en</language>
${items}
  </channel>
</rss>`;

  return new Response(xml, { headers: { 'content-type': 'application/rss+xml; charset=utf-8' } });
}
