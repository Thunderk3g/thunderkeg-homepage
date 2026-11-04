'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { PaperHit, PapersResponse, Topic } from '@/research/types';
import { useResearch } from '@/research/store';
import { feedbackBoost, feedbackKeywords, feedbackWeights, relevance, queryKeywords } from '@/research/rank';
import { buildArxivQuery, searchPapers, type SearchParams } from '@/research/client';

type Sel = { kind: 'topic'; id: string } | { kind: 'hf-daily' } | { kind: 'search'; q: string; source: 'arxiv' | 'hf-search' };
type Sort = 'default' | 'relevance';

const PAGE = 25;

/**
 * Results survive tab switches for the session. The server caches for an hour
 * too, but this avoids even the round trip (and the loading flash).
 */
const memo = new Map<string, PapersResponse>();

function paramsFor(sel: Sel, topics: Topic[]): SearchParams | null {
  if (sel.kind === 'hf-daily') return { source: 'hf-daily' };
  if (sel.kind === 'search') {
    if (sel.source === 'hf-search') return { source: 'hf-search', q: sel.q.slice(0, 250) };
    const q = buildArxivQuery(sel.q);
    return q ? { source: 'arxiv', q: q.slice(0, 400), max: PAGE } : null;
  }
  const t = topics.find((x) => x.id === sel.id);
  return t ? { source: 'arxiv', q: t.arxivQuery, max: PAGE } : null;
}

const fmtDate = (iso: string) => (iso ? iso.slice(0, 10) : '');
const authorLine = (a: string[]) => (a.length > 3 ? `${a.slice(0, 3).join(', ')} et al.` : a.join(', '));

export function Feed({
  search,
  onOpenPaper,
}: {
  search: { q: string; nonce: number } | null;
  onOpenPaper: (id: string) => void;
}) {
  const topics = useResearch((s) => s.topics);
  const rqs = useResearch((s) => s.rqs);
  const papers = useResearch((s) => s.papers);
  const savePaper = useResearch((s) => s.savePaper);
  const markTopicSeen = useResearch((s) => s.markTopicSeen);
  const ratings = useResearch((s) => s.ratings);
  const rate = useResearch((s) => s.rate);
  const [showHidden, setShowHidden] = useState(false);

  const [sel, setSel] = useState<Sel>(() =>
    search ? { kind: 'search', q: search.q, source: 'arxiv' } : { kind: 'topic', id: topics[0]?.id ?? '' },
  );
  const [text, setText] = useState(search?.q ?? '');
  const [source, setSource] = useState<'arxiv' | 'hf-search'>('arxiv');
  const [data, setData] = useState<PapersResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [more, setMore] = useState(false);
  const [sort, setSort] = useState<Sort>('default');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<'new' | string | null>(null);
  const [baseline, setBaseline] = useState<string>('');
  const reqSeq = useRef(0);

  // a terminal `research "<query>"` lands here as a fresh search
  useEffect(() => {
    if (!search) return;
    setText(search.q);
    setSel({ kind: 'search', q: search.q, source: 'arxiv' });
  }, [search]);

  const topic = sel.kind === 'topic' ? topics.find((t) => t.id === sel.id) : undefined;

  // a deleted topic falls back to the first one
  useEffect(() => {
    if (sel.kind === 'topic' && !topic && topics[0]) setSel({ kind: 'topic', id: topics[0].id });
  }, [sel, topic, topics]);
  const params = useMemo(() => paramsFor(sel, topics), [sel, topics]);
  const reqKey = params ? JSON.stringify(params) : '';
  const seenKey = sel.kind === 'topic' ? sel.id : sel.kind === 'hf-daily' ? 'hf-daily' : '';
  const isArxiv = params?.source === 'arxiv';

  useEffect(() => {
    if (!params) {
      setData(null);
      return;
    }
    const seq = ++reqSeq.current;
    // NEW is relative to the previous visit, frozen now so the badges don't vanish when we mark seen
    setBaseline(seenKey ? useResearch.getState().topicSeenAt[seenKey] ?? '' : '');
    const hit = memo.get(reqKey);
    if (hit) {
      setData(hit);
      setLoading(false);
      return;
    }
    setData(null);
    setLoading(true);
    void searchPapers(params).then((r) => {
      if (seq !== reqSeq.current) return;
      if (!r.error || r.items.length) memo.set(reqKey, r);
      setData(r);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reqKey]);

  // mark the topic seen a moment after its results are on screen
  useEffect(() => {
    if (!seenKey || !data?.items.length) return;
    const newest = data.items.reduce((m, i) => (i.published > m ? i.published : m), '');
    const t = setTimeout(() => newest && markTopicSeen(seenKey, newest), 2000);
    return () => clearTimeout(t);
  }, [data, seenKey, markTopicSeen]);

  const keywords = useMemo(() => {
    if (topic) return topic.keywords;
    if (sel.kind === 'search') return queryKeywords(sel.q);
    // HF Daily is everyone's trending list; rank it against all of my questions
    return [...new Set(rqs.flatMap((q) => q.keywords))];
  }, [topic, sel, rqs]);

  const saved = useMemo(() => new Set(papers.map((p) => p.id)), [papers]);

  const weights = useMemo(() => feedbackWeights(ratings), [ratings]);
  const { rows, hidden } = useMemo(() => {
    const all = (data?.items ?? []).map((hit, i) => {
      const r = relevance(hit, keywords);
      const boost = feedbackBoost(hit, weights);
      return { hit, i, ...r, boost, score: Math.max(0, r.score + boost), rating: ratings[hit.id]?.r };
    });
    const items = showHidden ? all : all.filter((x) => x.rating !== -1);
    if (sort === 'relevance') items.sort((a, b) => b.score - a.score || a.i - b.i);
    return { rows: items, hidden: all.length - all.filter((x) => x.rating !== -1).length };
  }, [data, keywords, sort, weights, ratings, showHidden]);

  const loadMore = async () => {
    if (!params || params.source !== 'arxiv' || !('q' in params) || !data) return;
    setMore(true);
    const r = await searchPapers({ ...params, start: data.items.length });
    const have = new Set(data.items.map((i) => i.id));
    const next = { ...data, items: [...data.items, ...r.items.filter((i) => !have.has(i.id))], error: r.error };
    memo.set(reqKey, next);
    setData(next);
    setMore(false);
  };

  const runSearch = () => {
    const q = text.trim();
    if (!q) return;
    setSel({ kind: 'search', q, source });
  };

  const save = (hit: PaperHit) => savePaper(hit, { rqIds: topic?.rqId ? [topic.rqId] : [] });

  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="rsx-feed">
      <div className="rsx-chips" role="group" aria-label="Topics">
        {topics.map((t) => (
          <button
            key={t.id}
            className={'lrn-chip' + (sel.kind === 'topic' && sel.id === t.id ? ' on' : '')}
            onClick={() => {
              setSel({ kind: 'topic', id: t.id });
              setEditing(null);
            }}
            title={t.arxivQuery}
          >
            {t.label}
          </button>
        ))}
        <button
          className={'lrn-chip' + (sel.kind === 'hf-daily' ? ' on' : '')}
          onClick={() => {
            setSel({ kind: 'hf-daily' });
            setEditing(null);
          }}
        >
          HF Daily
        </button>
        <button className="lrn-chip" onClick={() => setEditing('new')} title="Add a topic">
          + Topic
        </button>
      </div>

      <form
        className="rsx-search"
        onSubmit={(e) => {
          e.preventDefault();
          runSearch();
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={source === 'arxiv' ? 'search arXiv — words, "phrases", or raw abs:/ti:/cat: syntax' : 'search Hugging Face papers'}
          aria-label="search papers"
        />
        <select value={source} onChange={(e) => setSource(e.target.value as 'arxiv' | 'hf-search')} aria-label="search source">
          <option value="arxiv">arXiv</option>
          <option value="hf-search">HF</option>
        </select>
        <button className="lrn-btn primary" type="submit" disabled={!text.trim()}>
          Search
        </button>
      </form>

      {editing && (
        <TopicForm
          key={editing}
          topic={editing === 'new' ? undefined : topics.find((t) => t.id === editing)}
          onDone={(id) => {
            setEditing(null);
            if (id) {
              memo.clear();
              setSel({ kind: 'topic', id });
            }
          }}
        />
      )}

      <div className="rsx-feed-head">
        <span className="rsx-feed-title">
          {sel.kind === 'topic' && topic ? (
            <>
              {topic.label}
              {topic.rqId && <span className="lrn-tag">{topic.rqId.toUpperCase()}</span>}
            </>
          ) : sel.kind === 'hf-daily' ? (
            'Hugging Face Daily — community-curated'
          ) : sel.kind === 'search' ? (
            <>Search: “{sel.q}”</>
          ) : null}
        </span>
        {data && (
          <span className="lrn-dim">
            {data.items.length}
            {data.total ? ` of ${data.total}` : ''}
            {data.cached ? ' · cached' : ''}
          </span>
        )}
        <span className="rsx-spacer" />
        {topic && !editing && (
          <button className="lrn-btn tiny" onClick={() => setEditing(topic.id)}>
            Edit topic
          </button>
        )}
        <label className="rsx-sort">
          <span>Sort</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="default">{sel.kind === 'hf-daily' ? 'Upvotes' : 'Newest'}</option>
            <option value="relevance">Relevance</option>
          </select>
        </label>
        {hidden > 0 && (
          <button className="rsx-link-btn" onClick={() => setShowHidden((v) => !v)}>
            {showHidden ? 'hide' : 'show'} {hidden} not relevant
          </button>
        )}
      </div>

      {data?.error && <p className="rsx-error">{data.error}</p>}

      <div className="rsx-list">
        {loading && (
          <p className="lrn-empty">
            {isArxiv
              ? 'Querying arXiv… (arXiv asks for ≤1 request / 3 s, so cold topics take a few seconds)'
              : 'Fetching Hugging Face papers…'}
          </p>
        )}
        {!loading && data && data.items.length === 0 && (
          <p className="lrn-empty">
            {data.error
              ? 'Nothing to show — the source did not answer. Try again in a minute, or switch topic.'
              : 'No papers matched. Loosen the query, or edit the topic.'}
          </p>
        )}
        {!loading && !params && sel.kind === 'search' && <p className="lrn-empty">Type something to search.</p>}

        {rows.map(({ hit, score, matched, boost, rating }) => {
          const isNew = !!baseline && hit.published > baseline;
          const expanded = open.has(hit.id);
          const inLib = saved.has(hit.id);
          return (
            <article key={hit.id} className={'rsx-row' + (score === 0 ? ' dim' : '')}>
              <div className="rsx-row-head">
                <h3 className="rsx-row-title">
                  {isNew && <span className="rsx-new">NEW</span>}
                  <a href={hit.absUrl} target="_blank" rel="noreferrer">
                    {hit.title}
                  </a>
                </h3>
                {inLib ? (
                  <button className="lrn-btn tiny ok rsx-save" onClick={() => onOpenPaper(hit.id)} title="Open in library">
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
                {hit.published && ` · ${fmtDate(hit.published)}`}
                {hit.primaryCategory && ` · ${hit.primaryCategory}`}
                {typeof hit.upvotes === 'number' && ` · ▲ ${hit.upvotes}`}
              </p>
              {matched.length > 0 && (
                <p className="rsx-matched">
                  <span>matched:</span>
                  {matched.slice(0, 6).map((m) => (
                    <span key={m} className="rsx-kw">
                      {m}
                    </span>
                  ))}
                </p>
              )}
              {(hit.aiSummary || hit.abstract) && (
                <p
                  className={'rsx-abstract' + (expanded ? ' open' : '')}
                  onClick={() => toggle(hit.id)}
                  title={expanded ? 'collapse' : 'expand abstract'}
                >
                  {expanded ? hit.abstract || hit.aiSummary : hit.aiSummary || hit.abstract}
                </p>
              )}
              <p className="rsx-links">
                <button className="rsx-link-btn" onClick={() => toggle(hit.id)}>
                  {expanded ? 'less ▴' : 'abstract ▾'}
                </button>
                <a href={hit.absUrl} target="_blank" rel="noreferrer">
                  abs
                </a>
                {hit.pdfUrl && (
                  <a href={hit.pdfUrl} target="_blank" rel="noreferrer">
                    pdf
                  </a>
                )}
                {hit.arxivId && (
                  <a href={`https://alphaxiv.org/abs/${hit.arxivId}`} target="_blank" rel="noreferrer">
                    discuss on alphaXiv ↗
                  </a>
                )}
                <span className="rsx-rate" role="group" aria-label="feedback">
                  <button
                    className={'rsx-rate-btn' + (rating === 1 ? ' on' : '')}
                    aria-pressed={rating === 1}
                    title="More like this — boosts its keywords in ranking"
                    onClick={() => rate(hit.id, rating === 1 ? null : 1, feedbackKeywords(hit, matched))}
                  >
                    + relevant
                  </button>
                  <button
                    className={'rsx-rate-btn bad' + (rating === -1 ? ' on' : '')}
                    aria-pressed={rating === -1}
                    title="Not relevant — hides it and down-weights its keywords"
                    onClick={() => rate(hit.id, rating === -1 ? null : -1, feedbackKeywords(hit, matched))}
                  >
                    − not relevant
                  </button>
                  {boost !== 0 && <span className="lrn-dim">{boost > 0 ? `+${boost}` : boost} from ratings</span>}
                </span>
              </p>
            </article>
          );
        })}

        {!loading && isArxiv && data && data.total !== undefined && data.items.length < data.total && data.items.length > 0 && (
          <button className="lrn-btn rsx-more" onClick={loadMore} disabled={more}>
            {more ? 'Querying arXiv…' : `Load ${PAGE} more`}
          </button>
        )}
      </div>

      <p className="rsx-foot">Metadata from arXiv (CC0) and Hugging Face. Not affiliated.</p>
    </div>
  );
}

function TopicForm({ topic, onDone }: { topic?: Topic; onDone: (id?: string) => void }) {
  const addTopic = useResearch((s) => s.addTopic);
  const patchTopic = useResearch((s) => s.patchTopic);
  const removeTopic = useResearch((s) => s.removeTopic);
  const rqs = useResearch((s) => s.rqs);
  const [label, setLabel] = useState(topic?.label ?? '');
  const [query, setQuery] = useState(topic?.arxivQuery ?? '');
  const [kw, setKw] = useState(topic?.keywords.join(', ') ?? '');
  const [rqId, setRqId] = useState(topic?.rqId ?? '');

  const submit = () => {
    const keywords = kw.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean);
    const body = { label: label.trim(), arxivQuery: query.trim(), keywords, rqId: rqId || undefined };
    if (!body.label || !body.arxivQuery) return;
    if (topic) {
      patchTopic(topic.id, body);
      onDone(topic.id);
    } else onDone(addTopic(body));
  };

  return (
    <form
      className="lrn-form rsx-topic-form"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="rsx-form-row">
        <label className="lrn-field">
          Label
          <input value={label} onChange={(e) => setLabel(e.target.value)} required />
        </label>
        <label className="lrn-field">
          Research question
          <select value={rqId} onChange={(e) => setRqId(e.target.value)}>
            <option value="">— none —</option>
            {rqs.map((q) => (
              <option key={q.id} value={q.id}>
                {q.short}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="lrn-field">
        arXiv query{' '}
        <a href="https://info.arxiv.org/help/api/user-manual.html#query_details" target="_blank" rel="noreferrer">
          (syntax ↗)
        </a>
        <textarea rows={3} value={query} onChange={(e) => setQuery(e.target.value)} required maxLength={400} />
      </label>
      <label className="lrn-field">
        Ranking keywords (comma-separated, lowercase stems)
        <input value={kw} onChange={(e) => setKw(e.target.value)} placeholder="wer, normalis, code-switch" />
      </label>
      <div className="lrn-btn-row">
        <button className="lrn-btn primary" type="submit">
          {topic ? 'Save topic' : 'Add topic'}
        </button>
        <button className="lrn-btn" type="button" onClick={() => onDone()}>
          Cancel
        </button>
        {topic && !topic.builtin && (
          <button
            className="lrn-btn bad"
            type="button"
            onClick={() => {
              removeTopic(topic.id);
              onDone();
            }}
          >
            Delete
          </button>
        )}
      </div>
    </form>
  );
}
