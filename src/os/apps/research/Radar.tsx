'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { NewsItem, NewsPayload } from '@/os/ai/news';
import { streamChat } from '@/os/ai/stream';
import { useResearch } from '@/research/store';
import { searchPapers } from '@/research/client';

/**
 * AI Radar, folded into Research: live research / industry / community
 * headlines from public feeds (server-side, /api/ai-news), a "Brief me" digest,
 * and — new here — arXiv items can go straight into the library.
 */

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
    top.forEach((i) => out.push(`- ${i.title}  (${i.source}${i.date ? `, ${ago(i.date)}` : ''})`));
    out.push('');
  }
  out.push('(No LLM_API_KEY set — this is the raw top of the feed, not a model summary.)');
  return out.join('\n');
}

const ARXIV_URL = /arxiv\.org\/(?:abs|pdf)\/(\d{4}\.\d{4,5})/;

/** Session memo so switching tabs does not refetch. */
let memo: NewsPayload | null = null;

export function Radar({ onOpenPaper }: { onOpenPaper: (id: string) => void }) {
  const papers = useResearch((s) => s.papers);
  const savePaper = useResearch((s) => s.savePaper);
  const [data, setData] = useState<NewsPayload | null>(memo);
  const [error, setError] = useState<string | null>(null);
  const [lane, setLane] = useState<Lane | 'all'>('all');
  const [query, setQuery] = useState('');
  const [brief, setBrief] = useState('');
  const [briefing, setBriefing] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback((force = false) => {
    if (memo && !force) return;
    setError(null);
    setData(null);
    fetch('/api/ai-news')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: NewsPayload) => {
        memo = d;
        setData(d);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => load(), [load]);

  const items = useMemo(() => {
    const all = data?.items ?? [];
    const q = query.trim().toLowerCase();
    return all.filter(
      (i) => (lane === 'all' || i.lane === lane) && (!q || i.title.toLowerCase().includes(q) || i.source.toLowerCase().includes(q)),
    );
  }, [data, lane, query]);

  const saved = useMemo(() => new Set(papers.map((p) => p.id)), [papers]);

  const briefMe = async () => {
    const source = (data?.items ?? []).slice(0, 40);
    if (!source.length || briefing) return;
    setBriefing(true);
    setBrief('');
    const headlines = source.map((i) => `- [${i.lane}] ${i.title} (${i.source}${i.date ? `, ${ago(i.date)}` : ''})`).join('\n');
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

  const save = async (arxivId: string, title: string) => {
    setSaving(arxivId);
    const r = await searchPapers({ source: 'arxiv', ids: [arxivId] });
    const hit = r.items[0] ?? {
      id: `arxiv:${arxivId}`,
      arxivId,
      title,
      authors: [],
      abstract: '',
      published: '',
      categories: [],
      absUrl: `https://arxiv.org/abs/${arxivId}`,
      pdfUrl: `https://arxiv.org/pdf/${arxivId}`,
      source: 'arxiv' as const,
    };
    savePaper(hit);
    setSaving(null);
    toast.success('Saved to the library inbox');
  };

  return (
    <div className="rsx-radar">
      <div className="rsx-radar-bar">
        <div className="rsx-chips" role="group" aria-label="Lanes">
          {LANES.map((l) => (
            <button key={l.id} className={'lrn-chip' + (lane === l.id ? ' on' : '')} onClick={() => setLane(l.id)}>
              {l.label}
            </button>
          ))}
        </div>
        <input
          className="rsx-radar-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="filter headlines…"
          aria-label="filter headlines"
        />
        <button className="lrn-btn tiny" onClick={() => load(true)} title="Refetch the feeds">
          Refresh
        </button>
        <button className="lrn-btn tiny primary" onClick={briefMe} disabled={!data?.items.length || briefing}>
          {briefing ? 'Briefing…' : 'Brief me'}
        </button>
      </div>

      {brief && <pre className="rsx-ai-out rsx-radar-brief">{brief}</pre>}

      <div className="rsx-radar-list">
        {!data && !error && <p className="lrn-empty">Pulling feeds…</p>}
        {error && (
          <p className="rsx-error">
            Could not reach the feed aggregator ({error}). It fetches public RSS/JSON feeds server-side; a DNS filter or
            offline network blocks them.
          </p>
        )}
        {data && items.length === 0 && (
          <p className="lrn-empty">{data.items.length ? 'Nothing matches that filter.' : 'No feed answered — see the footer.'}</p>
        )}
        {items.map((i) => {
          const ax = ARXIV_URL.exec(i.url)?.[1];
          const pid = ax ? `arxiv:${ax}` : '';
          return (
            <article key={i.url} className="rsx-radar-item">
              <span className={'rsx-radar-lane ' + i.lane}>{i.lane}</span>
              <div className="rsx-radar-main">
                <a className="rsx-radar-title" href={i.url} target="_blank" rel="noreferrer">
                  {i.title}
                </a>
                <span className="rsx-row-meta">
                  {i.source}
                  {i.date && ` · ${ago(i.date)}`}
                </span>
                {i.summary && <span className="rsx-radar-summary">{i.summary}</span>}
              </div>
              {ax &&
                (saved.has(pid) ? (
                  <button className="lrn-btn tiny ok rsx-save" onClick={() => onOpenPaper(pid)}>
                    In library
                  </button>
                ) : (
                  <button className="lrn-btn tiny rsx-save" disabled={saving === ax} onClick={() => void save(ax, i.title)}>
                    {saving === ax ? 'Saving…' : 'Save'}
                  </button>
                ))}
            </article>
          );
        })}
      </div>

      {data && (
        <p className="rsx-foot">
          {data.items.length} items · fetched {ago(data.fetchedAt) || 'just now'} · cached 30 min
          {data.unreachable.length > 0 && <span className="rsx-due"> · unreachable: {data.unreachable.join(', ')}</span>}
        </p>
      )}
    </div>
  );
}
