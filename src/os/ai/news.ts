/**
 * News aggregator for the Research app's tracks — server-side only.
 *
 * The assistant runs on an open-weight model hosted by Groq. It has no web
 * access and its weights have a training cutoff, so it cannot tell you
 * what shipped this week. This module does: it pulls public RSS/Atom/JSON feeds
 * for one track, normalises them, and hands back a merged timeline. No API
 * keys, no accounts.
 */

import { atomLink, entries, iso, tag } from '@/research/server/xml';
import { UPSTREAM_UA, arxivGate, cached } from '@/research/server/cache';
import type { TrackId } from '@/research/tracks';

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
  /**
   * Keep only items whose title or summary match. General defense press and
   * Hacker News search (which prefix-matches "AI" against "aid") need it;
   * specialist feeds don't.
   */
  focus?: RegExp;
  /** match `focus` against the headline only — for feeds whose blurbs are boilerplate */
  titleOnly?: boolean;
}

/** AI and the technology around it, as defense press writes about it. */
const DEFENSE_TECH =
  /\b(ai|a\.i\.|artificial intelligence|machine learning|autonom\w*|drones?|uavs?|uas|counter-(?:uas|drone)|unmanned|swarm\w*|robot\w*|algorithm\w*|cyber\w*|software|compute|chips?|semiconductor\w*|electronic warfare|jamm\w*|sensors?|isr|jadc2|llms?|language models?|palantir|anduril|openai|anthropic|scale ai|cdao|diu|darpa|replicator|autonomy)\b/i;

/** Security stories that involve AI, agents or models. */
const CYBER_AI =
  /\b(ai|llms?|language models?|agents?|agentic|prompt injection|jailbreak\w*|model|gpt|claude|gemini|copilot|mcp|autonomous|machine learning)\b/i;

/** Ops and delivery stories that involve AI, agents or LLM applications. */
const OPS_AI =
  /\b(ai|llms?|llmops|mlops|aiops|agents?|agentic|copilot|language models?|model|inference|eval\w*|prompt\w*|rag|mcp|machine learning)\b/i;

/** Trading, quant and markets technology. */
const MARKETS_TECH =
  /\b(trad(?:e|es|er|ers|ing)|quant\w*|algo\w*|hedge funds?|hft|high-frequency|backtest\w*|portfolio|stocks?|equit(?:y|ies)|options|market\w*|invest\w*|fintech|broker\w*|exchange|crypto\w*|alpha|volatility)\b/i;

const arxivFeed = (q: string) =>
  `https://export.arxiv.org/api/query?search_query=${encodeURIComponent(q)}&sortBy=submittedDate&sortOrder=descending&max_results=10`;
/** newest HN stories for a query, with a small points floor to skip spam */
const hnFeed = (q: string) =>
  `https://hn.algolia.com/api/v1/search_by_date?tags=story&query=${encodeURIComponent(q)}&numericFilters=points%3E3&hitsPerPage=15`;

/** Every URL here answered with a parseable feed when it was added. */
const FEEDS: Record<TrackId, Feed[]> = {
  core: [
    { source: 'arXiv cs.CL', url: arxivFeed('cat:cs.CL'), lane: 'research', kind: 'atom' },
    { source: 'arXiv cs.AI', url: arxivFeed('cat:cs.AI'), lane: 'research', kind: 'atom' },
    { source: 'Google Research', url: 'https://research.google/blog/rss/', lane: 'research', kind: 'rss' },
    { source: 'Hugging Face', url: 'https://huggingface.co/blog/feed.xml', lane: 'community', kind: 'atom' },
    { source: 'Simon Willison', url: 'https://simonwillison.net/atom/everything/', lane: 'community', kind: 'atom' },
    { source: 'Hacker News', url: 'https://hn.algolia.com/api/v1/search?tags=story&query=AI%20OR%20LLM%20OR%20OpenAI%20OR%20Anthropic&hitsPerPage=20', lane: 'community', kind: 'hn' },
    { source: 'TechCrunch AI', url: 'https://techcrunch.com/category/artificial-intelligence/feed/', lane: 'industry', kind: 'rss' },
    { source: 'The Verge AI', url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', lane: 'industry', kind: 'rss' },
    { source: 'MIT Tech Review', url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed/', lane: 'industry', kind: 'rss' },
  ],
  defense: [
    { source: 'War on the Rocks', url: 'https://warontherocks.com/feed/', lane: 'research', kind: 'rss', focus: DEFENSE_TECH },
    { source: 'CSET Georgetown', url: 'https://cset.georgetown.edu/feed/', lane: 'research', kind: 'rss' },
    { source: 'DefenseScoop', url: 'https://defensescoop.com/feed/', lane: 'industry', kind: 'rss' },
    { source: 'Defense One', url: 'https://www.defenseone.com/rss/all/', lane: 'industry', kind: 'rss', focus: DEFENSE_TECH },
    { source: 'Breaking Defense', url: 'https://breakingdefense.com/feed/', lane: 'industry', kind: 'rss', focus: DEFENSE_TECH },
    { source: 'C4ISRNET', url: 'https://www.c4isrnet.com/feed/', lane: 'industry', kind: 'rss', focus: DEFENSE_TECH },
    { source: 'Hacker News', url: hnFeed('military AI'), lane: 'community', kind: 'hn', focus: DEFENSE_TECH },
    { source: 'Hacker News', url: hnFeed('drone warfare'), lane: 'community', kind: 'hn', focus: DEFENSE_TECH },
  ],
  cyber: [
    { source: 'arXiv cs.CR', url: arxivFeed('cat:cs.CR AND (abs:LLM OR abs:agent OR abs:"language model")'), lane: 'research', kind: 'atom' },
    { source: 'Project Zero', url: 'https://googleprojectzero.blogspot.com/feeds/posts/default', lane: 'research', kind: 'atom' },
    { source: 'Schneier on Security', url: 'https://www.schneier.com/feed/atom/', lane: 'research', kind: 'atom' },
    { source: 'The Hacker News', url: 'https://feeds.feedburner.com/TheHackersNews', lane: 'industry', kind: 'rss' },
    { source: 'BleepingComputer', url: 'https://www.bleepingcomputer.com/feed/', lane: 'industry', kind: 'rss' },
    { source: 'Dark Reading', url: 'https://www.darkreading.com/rss.xml', lane: 'industry', kind: 'rss' },
    { source: 'Krebs on Security', url: 'https://krebsonsecurity.com/feed/', lane: 'community', kind: 'rss' },
    { source: 'Hacker News', url: hnFeed('prompt injection'), lane: 'community', kind: 'hn', focus: CYBER_AI },
    { source: 'Hacker News', url: hnFeed('AI security agent'), lane: 'community', kind: 'hn', focus: CYBER_AI },
  ],
  aiops: [
    { source: 'arXiv cs.SE', url: arxivFeed('cat:cs.SE AND (abs:LLM OR abs:agent OR abs:"language model")'), lane: 'research', kind: 'atom' },
    { source: 'Chip Huyen', url: 'https://huyenchip.com/feed.xml', lane: 'research', kind: 'rss' },
    { source: 'Martin Fowler', url: 'https://martinfowler.com/feed.atom', lane: 'research', kind: 'atom', focus: OPS_AI },
    { source: 'The New Stack', url: 'https://thenewstack.io/feed/', lane: 'industry', kind: 'rss', focus: OPS_AI },
    { source: 'InfoQ', url: 'https://feed.infoq.com/', lane: 'industry', kind: 'rss', focus: OPS_AI },
    { source: 'GitHub Blog', url: 'https://github.blog/feed/', lane: 'industry', kind: 'rss' },
    { source: 'Latent Space', url: 'https://www.latent.space/feed', lane: 'community', kind: 'rss' },
    { source: 'Hacker News', url: hnFeed('LLMOps'), lane: 'community', kind: 'hn', focus: OPS_AI },
    { source: 'Hacker News', url: hnFeed('AI agents DevOps'), lane: 'community', kind: 'hn', focus: OPS_AI },
  ],
  markets: [
    { source: 'arXiv q-fin', url: arxivFeed('cat:q-fin.TR OR cat:q-fin.CP OR cat:q-fin.PM OR cat:q-fin.ST'), lane: 'research', kind: 'atom' },
    { source: 'Quantocracy', url: 'https://quantocracy.com/feed/', lane: 'research', kind: 'rss' },
    { source: 'Alpha Architect', url: 'https://alphaarchitect.com/feed/', lane: 'research', kind: 'rss' },
    { source: 'QuantInsti', url: 'https://blog.quantinsti.com/rss/', lane: 'research', kind: 'rss' },
    { source: 'Bloomberg Markets', url: 'https://feeds.bloomberg.com/markets/news.rss', lane: 'industry', kind: 'rss', focus: MARKETS_TECH, titleOnly: true },
    { source: 'Hacker News', url: hnFeed('algorithmic trading'), lane: 'community', kind: 'hn', focus: MARKETS_TECH },
    { source: 'Hacker News', url: hnFeed('quant trading'), lane: 'community', kind: 'hn', focus: MARKETS_TECH },
    { source: 'Hacker News', url: hnFeed('LLM trading'), lane: 'community', kind: 'hn', focus: MARKETS_TECH },
  ],
};

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
  const items = parse(feed, text);
  const { focus } = feed;
  const kept = focus ? items.filter((i) => focus.test(feed.titleOnly ? i.title : `${i.title} ${i.summary ?? ''}`)) : items;
  return kept.slice(0, 12);
}

export interface NewsPayload {
  track: TrackId;
  items: NewsItem[];
  /** feeds that failed this fetch — surfaced rather than hidden */
  unreachable: string[];
  fetchedAt: string;
}

/** Merge every feed of one track. A dead feed is reported, never fatal. */
export async function fetchNews(track: TrackId): Promise<NewsPayload> {
  const feeds = FEEDS[track];
  const settled = await Promise.allSettled(feeds.map(pull));

  const items: NewsItem[] = [];
  const unreachable: string[] = [];
  settled.forEach((r, i) => {
    if (r.status === 'fulfilled') items.push(...r.value);
    else unreachable.push(feeds[i].source);
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
  return { track, items: deduped.slice(0, 90), unreachable: [...new Set(unreachable)], fetchedAt: new Date().toISOString() };
}

/**
 * One track's merged timeline, shared by /api/news and the research brief so
 * both hit upstream at most twice an hour. A payload where every feed failed
 * is not worth caching.
 */
export function cachedNews(track: TrackId) {
  return cached(`news:${track}`, 30 * 60 * 1000, () => fetchNews(track), {
    label: 'news feeds',
    keep: (d) => d.items.length > 0,
  });
}
