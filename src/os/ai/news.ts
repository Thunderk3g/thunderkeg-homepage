/**
 * AI news aggregator — server-side only.
 *
 * The assistant runs on Groq (an inference host for open-weight models). It has
 * no web access and its weights have a training cutoff, so it cannot tell you
 * what shipped this week. This module does: it pulls public RSS/Atom/JSON feeds,
 * normalises them, and hands back a merged timeline. No API keys, no accounts.
 */

import { atomLink, entries, iso, tag } from '@/research/server/xml';
import { UPSTREAM_UA, arxivGate } from '@/research/server/cache';

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
  { source: 'arXiv cs.CL', url: 'https://export.arxiv.org/api/query?search_query=cat:cs.CL&sortBy=submittedDate&sortOrder=descending&max_results=10', lane: 'research', kind: 'atom' },
  { source: 'arXiv cs.AI', url: 'https://export.arxiv.org/api/query?search_query=cat:cs.AI&sortBy=submittedDate&sortOrder=descending&max_results=10', lane: 'research', kind: 'atom' },
  { source: 'Hugging Face', url: 'https://huggingface.co/blog/feed.xml', lane: 'community', kind: 'atom' },
  { source: 'Simon Willison', url: 'https://simonwillison.net/atom/everything/', lane: 'community', kind: 'atom' },
  { source: 'Hacker News', url: 'https://hn.algolia.com/api/v1/search?tags=story&query=AI%20OR%20LLM%20OR%20OpenAI%20OR%20Anthropic&hitsPerPage=20', lane: 'community', kind: 'hn' },
  { source: 'TechCrunch AI', url: 'https://techcrunch.com/category/artificial-intelligence/feed/', lane: 'industry', kind: 'rss' },
  { source: 'The Verge AI', url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', lane: 'industry', kind: 'rss' },
  { source: 'MIT Tech Review', url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed/', lane: 'industry', kind: 'rss' },
  { source: 'Google Research', url: 'https://research.google/blog/rss/', lane: 'research', kind: 'rss' },
];

/* XML helpers are shared with the Research app's arXiv client. */

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
  const go = async () => {
    const res = await fetch(feed.url, {
      headers: { 'user-agent': UPSTREAM_UA },
      signal: AbortSignal.timeout(7000),
      next: { revalidate: 1800 },
    });
    if (!res.ok) throw new Error(`${feed.source}: HTTP ${res.status}`);
    return res.text();
  };
  // arXiv counts every request from this machine, so its feeds queue behind the
  // Research app's gate instead of firing alongside it
  const text = feed.url.includes('export.arxiv.org') ? await arxivGate(go) : await go();
  return parse(feed, text).slice(0, 12);
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
