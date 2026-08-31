/**
 * AI news aggregator — server-side only.
 *
 * The assistant runs on Groq (an inference host for open-weight models). It has
 * no web access and its weights have a training cutoff, so it cannot tell you
 * what shipped this week. This module does: it pulls public RSS/Atom/JSON feeds,
 * normalises them, and hands back a merged timeline. No API keys, no accounts.
 */

export interface NewsItem {
  title: string;
  url: string;
  source: string;
  /** ISO timestamp, or '' when the feed omits one */
  date: string;
  /** research | industry | community */
  lane: 'research' | 'industry' | 'community';
  summary?: string;
}

interface Feed {
  source: string;
  url: string;
  lane: NewsItem['lane'];
  kind: 'rss' | 'atom' | 'hn';
}

const FEEDS: Feed[] = [
  { source: 'arXiv cs.CL', url: 'http://export.arxiv.org/api/query?search_query=cat:cs.CL&sortBy=submittedDate&sortOrder=descending&max_results=10', lane: 'research', kind: 'atom' },
  { source: 'arXiv cs.AI', url: 'http://export.arxiv.org/api/query?search_query=cat:cs.AI&sortBy=submittedDate&sortOrder=descending&max_results=10', lane: 'research', kind: 'atom' },
  { source: 'Hugging Face', url: 'https://huggingface.co/blog/feed.xml', lane: 'community', kind: 'atom' },
  { source: 'Simon Willison', url: 'https://simonwillison.net/atom/everything/', lane: 'community', kind: 'atom' },
  { source: 'Hacker News', url: 'https://hn.algolia.com/api/v1/search?tags=story&query=AI%20OR%20LLM%20OR%20OpenAI%20OR%20Anthropic&hitsPerPage=20', lane: 'community', kind: 'hn' },
  { source: 'TechCrunch AI', url: 'https://techcrunch.com/category/artificial-intelligence/feed/', lane: 'industry', kind: 'rss' },
  { source: 'The Verge AI', url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', lane: 'industry', kind: 'rss' },
  { source: 'MIT Tech Review', url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed/', lane: 'industry', kind: 'rss' },
  { source: 'Google Research', url: 'https://research.google/blog/rss/', lane: 'research', kind: 'rss' },
];

/* ───────────────────────── tiny XML helpers ─────────────────────────
   ponytail: regex, not a DOM parser. These are well-formed public feeds and we
   only ever read four fields out of them. If a feed ever needs namespaces or
   CDATA-in-attributes, install fast-xml-parser instead of growing this. */

const decode = (s: string) =>
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
    .replace(/\s+/g, ' ')
    .trim();

const tag = (xml: string, name: string): string => {
  const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i').exec(xml);
  return m ? decode(m[1]) : '';
};

/** Atom links live in an attribute, RSS links in the element body. */
const atomLink = (xml: string): string => {
  const alt = /<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i.exec(xml);
  if (alt) return alt[1];
  const any = /<link[^>]*href=["']([^"']+)["']/i.exec(xml);
  return any ? any[1] : tag(xml, 'link');
};

const entries = (xml: string, name: string): string[] =>
  xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>[\\s\\S]*?</${name}>`, 'gi')) ?? [];

const iso = (raw: string): string => {
  if (!raw) return '';
  const t = Date.parse(raw);
  return Number.isNaN(t) ? '' : new Date(t).toISOString();
};

const clip = (s: string, n: number) => (s.length <= n ? s : s.slice(0, n - 1).trimEnd() + '…');

/* ───────────────────────── per-feed parsing ───────────────────────── */

function parse(feed: Feed, text: string): NewsItem[] {
  if (feed.kind === 'hn') {
    const data = JSON.parse(text) as {
      hits?: { title?: string; url?: string; story_text?: string; objectID: string; created_at: string; points?: number }[];
    };
    return (data.hits ?? [])
      .filter((h) => h.title)
      .map((h) => ({
        title: h.title!,
        url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
        source: feed.source,
        date: iso(h.created_at),
        lane: feed.lane,
        summary: h.points != null ? `${h.points} points on Hacker News` : undefined,
      }));
  }

  const nodes = feed.kind === 'atom' ? entries(text, 'entry') : entries(text, 'item');
  return nodes
    .map((node) => ({
      title: tag(node, 'title'),
      url: feed.kind === 'atom' ? atomLink(node) : tag(node, 'link') || atomLink(node),
      source: feed.source,
      date: iso(tag(node, 'published') || tag(node, 'updated') || tag(node, 'pubDate') || tag(node, 'dc:date')),
      lane: feed.lane,
      summary: clip(tag(node, 'summary') || tag(node, 'description') || tag(node, 'content'), 260) || undefined,
    }))
    .filter((i) => i.title && i.url);
}

async function pull(feed: Feed): Promise<NewsItem[]> {
  const res = await fetch(feed.url, {
    headers: { 'user-agent': 'diwakar-portfolio/2.1 (+https://github.com/Thunderk3g)' },
    signal: AbortSignal.timeout(7000),
    next: { revalidate: 1800 },
  });
  if (!res.ok) throw new Error(`${feed.source}: HTTP ${res.status}`);
  return parse(feed, await res.text()).slice(0, 12);
}

export interface NewsPayload {
  items: NewsItem[];
  /** feeds that failed this fetch — surfaced rather than hidden */
  unreachable: string[];
  fetchedAt: string;
}

/** Merge every feed. A dead feed is reported, never fatal. */
export async function fetchAiNews(): Promise<NewsPayload> {
  const settled = await Promise.allSettled(FEEDS.map(pull));

  const items: NewsItem[] = [];
  const unreachable: string[] = [];
  settled.forEach((r, i) => {
    if (r.status === 'fulfilled') items.push(...r.value);
    else unreachable.push(FEEDS[i].source);
  });

  // de-duplicate by URL, then by normalised title (the same story gets syndicated)
  const seen = new Set<string>();
  const deduped = items.filter((i) => {
    const keys = [i.url.replace(/[?#].*$/, ''), i.title.toLowerCase().replace(/[^a-z0-9]/g, '')];
    if (keys.some((k) => seen.has(k))) return false;
    keys.forEach((k) => seen.add(k));
    return true;
  });

  deduped.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return { items: deduped.slice(0, 90), unreachable, fetchedAt: new Date().toISOString() };
}
