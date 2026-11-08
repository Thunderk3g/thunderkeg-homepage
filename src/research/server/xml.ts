/* ───────────────────────── tiny XML helpers ─────────────────────────
   Shared by the research news feeds (src/os/ai/news.ts) and the arXiv client.
   ponytail: regex, not a DOM parser. These are well-formed public feeds and we
   only ever read a handful of fields out of them. If a feed ever needs
   namespaces or CDATA-in-attributes, install fast-xml-parser instead of
   growing this. */

export const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // numeric entities — WordPress feeds emit &#8217; for apostrophes constantly
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&')
    // double-escaped feeds (&amp;#x27;) only become real entities after &amp;
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    // some feeds escape their HTML (&lt;p&gt;) — strip it once it is real markup
    .replace(/<\/?[a-z][^>]*>/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const tag = (xml: string, name: string): string => {
  const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i').exec(xml);
  return m ? decode(m[1]) : '';
};

/** Atom links live in an attribute, RSS links in the element body. */
export const atomLink = (xml: string): string => {
  const alt = /<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i.exec(xml);
  if (alt) return alt[1];
  const any = /<link[^>]*href=["']([^"']+)["']/i.exec(xml);
  return any ? any[1] : tag(xml, 'link');
};

export const entries = (xml: string, name: string): string[] =>
  xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>[\\s\\S]*?</${name}>`, 'gi')) ?? [];

export const iso = (raw: string): string => {
  if (!raw) return '';
  const t = Date.parse(raw);
  return Number.isNaN(t) ? '' : new Date(t).toISOString();
};

/** arXiv titles and abstracts are raw LaTeX source: `25.7\%`, `\&`, `--`. Undo the common escapes. */
export const untex = (s: string) =>
  s
    .replace(/\\([%&_#$])/g, '$1')
    .replace(/(?<!-)---(?!-)/g, '—')
    .replace(/(?<![-!<])--(?![->])/g, '–')
    .replace(/``|''/g, '"');
