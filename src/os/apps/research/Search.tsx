'use client';

import { useEffect, useMemo, useState } from 'react';
import type { SearchHit, SearchResponse } from '@/research/server/search';
import type { Topic } from '@/research/types';
import { useResearch } from '@/research/store';
import { relevance } from '@/research/rank';
import { TRACKS, trackOf, type TrackId } from '@/research/tracks';

type Sort = 'match' | 'newest' | 'cited';

/** Results survive tab switches for the session; the server caches six hours. */
const memo = new Map<string, SearchResponse>();

const authorLine = (a: string[]) => (a.length > 3 ? `${a.slice(0, 3).join(', ')} et al.` : a.join(', '));

/** The built-in topic a paper fits best, if it plainly fits one — decides its track tag when saved. */
function bestTopic(hit: Pick<SearchHit, 'title' | 'abstract'>, topics: Topic[]): Topic | undefined {
  let best: Topic | undefined;
  let top = 0;
  for (const t of topics) {
    const s = relevance(hit, t.keywords).score;
    if (s > top) {
      top = s;
      best = t;
    }
  }
  return top >= 4 ? best : undefined;
}

export function Search({
  q,
  onOpenPaper,
  onOpenTopic,
}: {
  q: string;
  onOpenPaper: (id: string) => void;
  onOpenTopic: (track: TrackId, topicId: string) => void;
}) {
  const topics = useResearch((s) => s.topics);
  const papers = useResearch((s) => s.papers);
  const savePaper = useResearch((s) => s.savePaper);
  const [data, setData] = useState<SearchResponse | null>(() => memo.get(q) ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>('match');
  const [open, setOpen] = useState<Set<string>>(new Set());

  useEffect(() => {
    const hit = memo.get(q);
    if (hit) {
      setData(hit);
      return;
    }
    let live = true;
    setData(null);
    setError(null);
    setLoading(true);
    fetch(`/api/research/search?${new URLSearchParams({ q })}`)
      .then((r) => r.json() as Promise<SearchResponse & { error?: string }>)
      .then((d) => {
        if (!live) return;
        if (d.items?.length && !d.missed?.length) memo.set(q, d);
        setData(d);
        if (d.error) setError(d.error);
      })
      .catch((e: Error) => live && setError(e.message))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [q]);

  // the topics this goal overlaps, across every track — one click into their live feeds.
  // Keywords shared by many topics ("agent", "llm") say nothing about which one fits.
  const related = useMemo(() => {
    const goal = { title: q, abstract: q };
    const df = new Map<string, number>();
    topics.forEach((t) => new Set(t.keywords).forEach((k) => df.set(k, (df.get(k) ?? 0) + 1)));
    const inLabel = (w: string, label: string) => new RegExp(`(^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(label);
    const labels = topics.map((t) => t.label.toLowerCase());
    const words = q
      .toLowerCase()
      .split(/[^\p{L}\p{N}/+-]+/u)
      .filter((w) => w.length >= 2 && labels.filter((l) => inLabel(w, l)).length <= 2);
    return topics
      .map((t) => {
        const rel = relevance(goal, t.keywords.filter((k) => (df.get(k) ?? 0) <= 2));
        const label = t.label.toLowerCase();
        const named = words.filter((w) => inLabel(w, label)).length;
        return { t, score: rel.score + 3 * named };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);
  }, [q, topics]);

  const rows = useMemo(() => {
    const items = [...(data?.items ?? [])];
    if (sort === 'newest') items.sort((a, b) => b.published.localeCompare(a.published));
    else if (sort === 'cited') items.sort((a, b) => (b.citations ?? -1) - (a.citations ?? -1));
    return items;
  }, [data, sort]);

  const saved = useMemo(() => new Set(papers.map((p) => p.id)), [papers]);
  const builtins = useMemo(() => topics.filter((t) => t.builtin), [topics]);

  const save = (hit: SearchHit) => {
    const t = bestTopic(hit, builtins);
    const tag = t ? trackOf(t.track).tag : undefined;
    savePaper(hit, { rqIds: t?.rqId ? [t.rqId] : [], tags: tag ? [tag] : [] });
  };
  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="rsx-searchres">
      <div className="rsx-feed-head">
        <span className="rsx-feed-title">Papers for “{q}”</span>
        {data && <span className="lrn-dim">{data.items.length} found</span>}
        <span className="rsx-spacer" />
        <label className="rsx-sort">
          <span>Sort</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="match">Best match</option>
            <option value="newest">Newest</option>
            <option value="cited" disabled={!data?.citationsAvailable}>
              Most cited{data && !data.citationsAvailable ? ' (unavailable)' : ''}
            </option>
          </select>
        </label>
      </div>

      {data && data.terms.length > 0 && (
        <p className="rsx-matched">
          <span>searched for:</span>
          {data.terms.map((t) => (
            <span key={t} className="rsx-kw">
              {t}
            </span>
          ))}
        </p>
      )}

      {related.length > 0 && (
        <p className="rsx-related">
          <span className="lrn-dim">Follow this in a live feed:</span>
          {related.map(({ t }) => (
            <button key={t.id} className="lrn-chip" onClick={() => onOpenTopic(t.track ?? 'core', t.id)}>
              {TRACKS.find((x) => x.id === (t.track ?? 'core'))?.label} · {t.label}
            </button>
          ))}
        </p>
      )}

      {data && data.missed.length > 0 && (
        <p className="rsx-error">
          {data.missed.join(' and ')} didn’t answer this time, so results may be thinner than usual. Search again in a minute.
        </p>
      )}
      {error && !data?.items.length && <p className="rsx-error">Search failed ({error}).</p>}

      <div className="rsx-list">
        {loading && (
          <p className="lrn-empty">Searching Hugging Face (semantic match) and arXiv (relevance) — a few seconds…</p>
        )}
        {!loading && data && data.items.length === 0 && (
          <p className="lrn-empty">Nothing matched. Try describing the goal differently, or with fewer words.</p>
        )}
        {rows.map((hit) => {
          const inLib = saved.has(hit.id);
          const expanded = open.has(hit.id);
          return (
            <article key={hit.id} className="rsx-row">
              <div className="rsx-row-head">
                <h3 className="rsx-row-title">
                  <a href={hit.absUrl} target="_blank" rel="noreferrer">
                    {hit.title}
                  </a>
                </h3>
                {inLib ? (
                  <button className="lrn-btn tiny ok rsx-save" onClick={() => onOpenPaper(hit.id)}>
                    In library ✓
                  </button>
                ) : (
                  <button className="lrn-btn tiny rsx-save" onClick={() => save(hit)}>
                    Save
                  </button>
                )}
              </div>
              <p className="rsx-row-meta">
                {authorLine(hit.authors)}
                {hit.published && ` · ${hit.published.slice(0, 10)}`}
                {typeof hit.citations === 'number' && ` · ${hit.citations.toLocaleString()} citations`}
                {typeof hit.upvotes === 'number' && hit.upvotes > 0 && ` · ▲ ${hit.upvotes}`}
                {hit.via.includes('semantic') && hit.via.includes('arxiv') && ' · both sources'}
              </p>
              {hit.matched.length > 0 && (
                <p className="rsx-matched">
                  <span>matched:</span>
                  {hit.matched.slice(0, 6).map((m) => (
                    <span key={m} className="rsx-kw">
                      {m}
                    </span>
                  ))}
                </p>
              )}
              {(hit.aiSummary || hit.abstract) && (
                <p className={'rsx-abstract' + (expanded ? ' open' : '')} onClick={() => toggle(hit.id)}>
                  {expanded ? hit.abstract || hit.aiSummary : hit.aiSummary || hit.abstract}
                </p>
              )}
              <p className="rsx-links">
                <button className="rsx-link-btn" onClick={() => toggle(hit.id)}>
                  {expanded ? 'less ▴' : 'abstract ▾'}
                </button>
                {hit.pdfUrl && (
                  <a href={hit.pdfUrl} target="_blank" rel="noreferrer">
                    pdf
                  </a>
                )}
                {hit.arxivId && (
                  <a href={`https://www.alphaxiv.org/abs/${hit.arxivId}`} target="_blank" rel="noreferrer">
                    alphaXiv
                  </a>
                )}
              </p>
            </article>
          );
        })}
      </div>
      <p className="rsx-foot">Semantic search by Hugging Face Papers; relevance search by arXiv; citations by Semantic Scholar when it answers.</p>
    </div>
  );
}
