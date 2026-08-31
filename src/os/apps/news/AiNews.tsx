'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AppDefinition, AppProps } from '../../types';
import type { NewsItem, NewsPayload } from '../../ai/news';
import { streamChat } from '../../ai/stream';

type Lane = NewsItem['lane'];
const LANES: { id: Lane | 'all'; label: string }[] = [
  { id: 'all', label: 'Everything' },
  { id: 'research', label: 'Research' },
  { id: 'industry', label: 'Industry' },
  { id: 'community', label: 'Community' },
];

function ago(iso: string): string {
  if (!iso) return '';
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** Deterministic digest used when no LLM key is configured. */
function localBrief(items: NewsItem[]): string {
  const out: string[] = ['Catch-up brief — top items per lane', ''];
  for (const lane of ['research', 'industry', 'community'] as Lane[]) {
    const top = items.filter((i) => i.lane === lane).slice(0, 3);
    if (!top.length) continue;
    out.push(lane.toUpperCase());
    top.forEach((i) => out.push(`• ${i.title}  (${i.source}${i.date ? `, ${ago(i.date)}` : ''})`));
    out.push('');
  }
  out.push('(No LLM_API_KEY set — this is the raw top-of-feed, not a model summary.)');
  return out.join('\n');
}

function AiNewsApp(_props: AppProps) {
  const [data, setData] = useState<NewsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lane, setLane] = useState<Lane | 'all'>('all');
  const [query, setQuery] = useState('');
  const [brief, setBrief] = useState('');
  const [briefing, setBriefing] = useState(false);

  const load = useCallback(() => {
    setError(null);
    setData(null);
    fetch('/api/ai-news')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  const items = useMemo(() => {
    const all = data?.items ?? [];
    const q = query.trim().toLowerCase();
    return all.filter(
      (i) =>
        (lane === 'all' || i.lane === lane) &&
        (!q || i.title.toLowerCase().includes(q) || i.source.toLowerCase().includes(q)),
    );
  }, [data, lane, query]);

  const briefMe = async () => {
    const source = (data?.items ?? []).slice(0, 40);
    if (!source.length || briefing) return;
    setBriefing(true);
    setBrief('');
    const headlines = source
      .map((i) => `- [${i.lane}] ${i.title} (${i.source}${i.date ? `, ${ago(i.date)}` : ''})`)
      .join('\n');
    let acc = '';
    await streamChat(
      [{ role: 'user', content: `Here are the live headlines. Brief me.\n\n${headlines}` }],
      (d) => {
        acc += d;
        setBrief(acc);
      },
      { mode: 'news', offline: () => localBrief(source) },
    );
    setBriefing(false);
  };

  return (
    <div className="kos-news">
      <div className="kos-news-bar">
        {LANES.map((l) => (
          <button
            key={l.id}
            className={'kos-news-chip' + (lane === l.id ? ' active' : '')}
            onClick={() => setLane(l.id)}
          >
            {l.label}
          </button>
        ))}
        <input
          className="kos-news-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="filter…"
          aria-label="filter headlines"
        />
        <button className="kos-game-btn" onClick={load} title="refetch feeds">
          ⟳
        </button>
        <button className="kos-game-btn primary" onClick={briefMe} disabled={!data?.items.length || briefing}>
          {briefing ? 'Briefing…' : 'Brief me'}
        </button>
      </div>

      {brief && (
        <pre className="kos-news-brief">
          {brief}
          {briefing && <span className="kos-assistant-caret">▋</span>}
        </pre>
      )}

      <div className="kos-news-list">
        {!data && !error && <p className="kos-news-empty">Pulling feeds…</p>}
        {error && (
          <p className="kos-news-empty">
            Couldn&rsquo;t reach the news endpoint ({error}). It fetches public RSS/JSON feeds
            server-side — a corporate DNS filter will block them.
          </p>
        )}
        {data && items.length === 0 && <p className="kos-news-empty">Nothing matches that filter.</p>}
        {items.map((i) => (
          <a key={i.url} className="kos-news-item" href={i.url} target="_blank" rel="noreferrer">
            <span className={'kos-news-lane ' + i.lane}>{i.lane}</span>
            <span className="kos-news-title">{i.title}</span>
            <span className="kos-news-meta">
              {i.source}
              {i.date && ` · ${ago(i.date)}`}
            </span>
            {i.summary && <span className="kos-news-summary">{i.summary}</span>}
          </a>
        ))}
      </div>

      {data && (
        <div className="kos-news-foot">
          {data.items.length} items · fetched {ago(data.fetchedAt) || 'just now'} · cached 30 min
          {data.unreachable.length > 0 && (
            <span className="kos-news-warn"> · unreachable: {data.unreachable.join(', ')}</span>
          )}
        </div>
      )}
    </div>
  );
}

export const aiNewsApp: AppDefinition = {
  id: 'ainews',
  title: 'AI Radar',
  icon: '📡',
  category: 'Internet',
  component: AiNewsApp,
  description: 'Live AI research, industry and community headlines — with a one-click catch-up brief',
  defaultSize: { width: 880, height: 640 },
  minSize: { width: 420, height: 340 },
  desktop: true,
  launchCommands: ['radar', 'ainews'],
};

export default AiNewsApp;
