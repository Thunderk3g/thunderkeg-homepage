'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { PaperHit, PapersResponse, Topic } from '@/research/types';
import { useResearch } from '@/research/store';
import { relevance } from '@/research/rank';
import { searchPapers, type SearchParams } from '@/research/client';
import { trackOf, type TrackId } from '@/research/tracks';

type Sel = { kind: 'essentials' } | { kind: 'topic'; id: string } | { kind: 'hf-daily' };
type Sort = 'default' | 'relevance';

const PAGE = 25;

/**
 * Results survive tab switches for the session. The server caches for an hour
 * too, but this avoids even the round trip (and the loading flash).
 */
const memo = new Map<string, PapersResponse>();

const inTrack = (t: Topic, track: TrackId) => (t.track ?? 'core') === track;

function paramsFor(sel: Sel, topics: Topic[], track: TrackId): SearchParams | null {
  if (sel.kind === 'essentials') return { source: 'arxiv', ids: trackOf(track).essentials };
  if (sel.kind === 'hf-daily') return { source: 'hf-daily' };
  const t = topics.find((x) => x.id === sel.id);
  return t ? { source: 'arxiv', q: t.arxivQuery, max: PAGE } : null;
}

const fmtDate = (iso: string) => (iso ? iso.slice(0, 10) : '');
const authorLine = (a: string[]) => (a.length > 3 ? `${a.slice(0, 3).join(', ')} et al.` : a.join(', '));

export function Feed({
  track,
  initialTopic,
  onOpenPaper,
}: {
  track: TrackId;
  /** open on this topic (from a search's "matching topics") instead of the first */
  initialTopic?: string;
  onOpenPaper: (id: string) => void;
}) {
  const allTopics = useResearch((s) => s.topics);
  const topics = useMemo(() => allTopics.filter((t) => inTrack(t, track)), [allTopics, track]);
  const rqs = useResearch((s) => s.rqs);
  const papers = useResearch((s) => s.papers);
  const savePaper = useResearch((s) => s.savePaper);
  const markTopicSeen = useResearch((s) => s.markTopicSeen);

  const [sel, setSel] = useState<Sel>(() => {
    const first = topics.find((t) => t.id === initialTopic) ?? topics[0];
    return first ? { kind: 'topic', id: first.id } : { kind: 'essentials' };
  });
  const [data, setData] = useState<PapersResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [more, setMore] = useState(false);
  const [sort, setSort] = useState<Sort>('default');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<'new' | string | null>(null);
  const [baseline, setBaseline] = useState<string>('');
  const reqSeq = useRef(0);

  const topic = sel.kind === 'topic' ? topics.find((t) => t.id === sel.id) : undefined;

  // a deleted topic falls back to the first one
  useEffect(() => {
    if (sel.kind === 'topic' && !topic) setSel(topics[0] ? { kind: 'topic', id: topics[0].id } : { kind: 'essentials' });
  }, [sel, topic, topics]);
  const params = useMemo(() => paramsFor(sel, topics, track), [sel, topics, track]);
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
    if (sel.kind === 'essentials') return [...new Set(topics.flatMap((t) => t.keywords))];
    // HF Daily is everyone's trending list; rank it against all of my core questions
    return [...new Set(rqs.filter((q) => (q.track ?? 'core') === 'core').flatMap((q) => q.keywords))];
  }, [topic, sel, rqs, topics]);

  const saved = useMemo(() => new Set(papers.map((p) => p.id)), [papers]);

  const rows = useMemo(() => {
    const items = (data?.items ?? []).map((hit, i) => ({ hit, i, ...relevance(hit, keywords) }));
    if (sort === 'relevance') items.sort((a, b) => b.score - a.score || a.i - b.i);
    // essentials read best in the order they were written: foundations first
    else if (sel.kind === 'essentials') items.sort((a, b) => a.hit.published.localeCompare(b.hit.published));
    return items;
  }, [data, keywords, sort, sel.kind]);

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

  const trackTag = trackOf(track).tag;
  const save = (hit: PaperHit) =>
    savePaper(hit, { rqIds: topic?.rqId ? [topic.rqId] : [], tags: trackTag ? [trackTag] : [] });

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
        <button
          className={'lrn-chip essentials' + (sel.kind === 'essentials' ? ' on' : '')}
          onClick={() => {
            setSel({ kind: 'essentials' });
            setEditing(null);
          }}
          title="The papers to have read before the weekly feed makes sense"
        >
          ★ Essentials
        </button>
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
        {track === 'core' && (
          <button
            className={'lrn-chip' + (sel.kind === 'hf-daily' ? ' on' : '')}
            onClick={() => {
              setSel({ kind: 'hf-daily' });
              setEditing(null);
            }}
          >
            HF Daily
          </button>
        )}
        <button className="lrn-chip" onClick={() => setEditing('new')} title="Add a topic">
          + Topic
        </button>
      </div>

      {editing && (
        <TopicForm
          key={editing}
          track={track}
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
          {sel.kind === 'essentials' ? (
            <>Essentials — {trackOf(track).label}</>
          ) : sel.kind === 'topic' && topic ? (
            <>
              {topic.label}
              {topic.rqId && <span className="lrn-tag">{topic.rqId.toUpperCase()}</span>}
            </>
          ) : sel.kind === 'hf-daily' ? (
            'Hugging Face Daily — community-curated'
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
            <option value="default">
              {sel.kind === 'hf-daily' ? 'Upvotes' : sel.kind === 'essentials' ? 'Reading order' : 'Newest'}
            </option>
            <option value="relevance">Relevance</option>
          </select>
        </label>
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

        {rows.map(({ hit, score, matched }) => {
          const isNew = !!baseline && hit.published > baseline;
          const expanded = open.has(hit.id);
          const inLib = saved.has(hit.id);
          return (
            <article key={hit.id} className={'rsx-row' + (score === 0 && sel.kind !== 'essentials' ? ' dim' : '')}>
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
                  <a href={`https://www.alphaxiv.org/abs/${hit.arxivId}`} target="_blank" rel="noreferrer">
                    alphaXiv
                  </a>
                )}
              </p>
            </article>
          );
        })}

        {!loading && isArxiv && sel.kind !== 'essentials' && data && data.total !== undefined && data.items.length < data.total && data.items.length > 0 && (
          <button className="lrn-btn rsx-more" onClick={loadMore} disabled={more}>
            {more ? 'Querying arXiv…' : `Load ${PAGE} more`}
          </button>
        )}
      </div>

      <p className="rsx-foot">Metadata from arXiv (CC0) and Hugging Face. Not affiliated.</p>
    </div>
  );
}

function TopicForm({ track, topic, onDone }: { track: TrackId; topic?: Topic; onDone: (id?: string) => void }) {
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
    const body = { label: label.trim(), arxivQuery: query.trim(), keywords, rqId: rqId || undefined, track: topic?.track ?? track };
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
            {rqs.filter((q) => (q.track ?? 'core') === track).map((q) => (
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
