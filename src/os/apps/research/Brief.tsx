'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BriefPick, BriefResponse } from '@/research/server/brief';
import type { NewsItem } from '../../ai/news';
import { streamChat } from '../../ai/stream';
import { useResearch } from '@/research/store';
import { STATUS_SHORT } from '@/research/types';
import { TRACKS, trackOf, type TrackId } from '@/research/tracks';

const today = () => new Date().toISOString().slice(0, 10);
const KEY = (t: TrackId) => `kos:research:brief:${t}`;

interface Saved {
  day: string;
  data?: BriefResponse;
  summary?: string;
}

function readSaved(t: TrackId): Saved | null {
  try {
    const raw = localStorage.getItem(KEY(t));
    const s = raw ? (JSON.parse(raw) as Saved) : null;
    return s && s.day === today() ? s : null;
  } catch {
    return null;
  }
}

function writeSaved(t: TrackId, patch: Partial<Saved>) {
  try {
    const prev = readSaved(t) ?? { day: today() };
    localStorage.setItem(KEY(t), JSON.stringify({ ...prev, ...patch, day: today() }));
  } catch {
    /* the brief still works, it just isn't remembered */
  }
}

function ago(iso: string): string {
  if (!iso) return '';
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

const age = (d: number) => (d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d}d ago`);
const authors = (a: string[]) => (a.length > 3 ? `${a.slice(0, 3).join(', ')} et al.` : a.join(', '));
const clip = (s: string, n: number) => (s.length <= n ? s : s.slice(0, n - 1).trimEnd() + '…');

/** What gets sent to the model: the ranked list and the wire, nothing else. */
function promptFor(track: TrackId, data: BriefResponse, rqs: string[]): string {
  const papers = data.picks
    .map(
      (p, i) =>
        `${i + 1}. "${p.hit.title}" — topic: ${p.topicLabel}${p.rqShort ? `; bears on ${p.rqShort}` : ''}; ${age(p.ageDays)}\n   ${clip(p.hit.aiSummary || p.hit.abstract, 420)}`,
    )
    .join('\n');
  const news = data.news.map((n) => `- [${n.lane}] ${n.title} (${n.source}${n.date ? `, ${ago(n.date)}` : ''})`).join('\n');
  return [
    `Area: ${trackOf(track).label}.`,
    rqs.length ? `Research questions:\n${rqs.map((q) => `- ${q}`).join('\n')}` : '',
    `New papers, ranked:\n${papers || '(none this week)'}`,
    `Headlines:\n${news || '(none)'}`,
    'Write my brief.',
  ]
    .filter(Boolean)
    .join('\n\n');
}

/** Used when no model is configured: the same sections, assembled from the ranking. */
function offlineBrief(track: TrackId, data: BriefResponse): string {
  const out: string[] = [];
  const topics = [...new Set(data.picks.map((p) => p.topicLabel))].slice(0, 4);
  out.push('THIS WEEK');
  if (topics.length) out.push(`• New work landed in ${topics.join(', ')}.`);
  data.news.slice(0, 2).forEach((n) => out.push(`• ${n.title} (${n.source})`));
  out.push('', 'READ FIRST');
  data.picks.slice(0, 3).forEach((p) =>
    out.push(`• ${p.hit.title}`, `  ${p.topicLabel}${p.rqShort ? ` · ${p.rqShort}` : ''} · matched ${p.matched.slice(0, 4).join(', ')}`),
  );
  if (data.picks.length > 3) {
    out.push('', 'SKIM');
    data.picks.slice(3, 6).forEach((p) => out.push(`• ${p.hit.title}`));
  }
  if (data.news.length) {
    out.push('', 'ON THE WIRE');
    data.news.slice(0, 3).forEach((n) => out.push(`• ${n.title} — ${n.source}`));
  }
  if (data.picks[0]) out.push('', `If you only read one thing: ${data.picks[0].hit.title}`);
  out.push('', `(No LLM_API_KEY on this deployment — this is the ${trackOf(track).label} ranking, not a model summary.)`);
  return out.join('\n');
}

export function Brief({
  track,
  onOpenPaper,
  onShowNews,
}: {
  track: TrackId;
  onOpenPaper: (id: string) => void;
  onShowNews: () => void;
}) {
  const label = trackOf(track).label;
  const papers = useResearch((s) => s.papers);
  const savePaper = useResearch((s) => s.savePaper);
  const allRqs = useResearch((s) => s.rqs);
  const rqs = useMemo(() => allRqs.filter((q) => (q.track ?? 'core') === track), [allRqs, track]);

  const [data, setData] = useState<BriefResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState('');
  const [summarising, setSummarising] = useState(false);
  const [open, setOpen] = useState<Set<string>>(new Set());

  const load = useCallback(
    (force = false) => {
      const saved = force ? null : readSaved(track);
      if (saved?.data) {
        setData(saved.data);
        setSummary(saved.summary ?? '');
        return () => {};
      }
      let live = true;
      setLoading(true);
      setError(null);
      if (force) setSummary('');
      fetch(`/api/research/brief?track=${track}`, force ? { cache: 'reload' } : undefined)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((d: BriefResponse & { error?: string }) => {
          if (!live) return;
          setData(d);
          if (d.error && !d.picks.length) setError(d.error);
          // a partial scan is shown but not remembered for the day
          if (d.picks.length && !d.missed.length) writeSaved(track, { data: d, summary: force ? '' : undefined });
        })
        .catch((e: Error) => live && setError(e.message))
        .finally(() => live && setLoading(false));
      return () => {
        live = false;
      };
    },
    [track],
  );

  useEffect(() => load(), [load]);

  const summarise = async () => {
    if (!data || summarising) return;
    setSummarising(true);
    setSummary('');
    let acc = '';
    const { text } = await streamChat(
      [{ role: 'user', content: promptFor(track, data, rqs.map((q) => q.question)) }],
      (d) => {
        acc += d;
        setSummary(acc);
      },
      { mode: 'digest', offline: () => offlineBrief(track, data) },
    );
    writeSaved(track, { summary: text || acc });
    setSummarising(false);
  };

  // your own queue: unread papers that belong to this track
  const queue = useMemo(() => {
    const otherTags = TRACKS.filter((t) => t.id !== track && t.tag).map((t) => t.tag!);
    const own = trackOf(track).tag;
    const rqIds = new Set(rqs.map((q) => q.id));
    return papers
      .filter((p) => ['inbox', 'pass1', 'pass2', 'pass3'].includes(p.status))
      .filter((p) =>
        own
          ? p.tags.includes(own) || p.rqIds.some((r) => rqIds.has(r))
          : !p.tags.some((t) => otherTags.includes(t)) && !p.rqIds.some((r) => /^rq-[dm]/.test(r)),
      )
      .slice(0, 4);
  }, [papers, track, rqs]);

  const saved = useMemo(() => new Set(papers.map((p) => p.id)), [papers]);
  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const save = (p: BriefPick) => {
    const tag = trackOf(track).tag;
    savePaper(p.hit, { rqIds: p.rqId ? [p.rqId] : [], tags: tag ? [tag] : [] });
  };

  return (
    <div className="rsx-brief">
      <div className="rsx-brief-head">
        <div>
          <h2 className="rsx-brief-title">This week in {label}</h2>
          <p className="lrn-dim rsx-brief-meta">
            {data
              ? `${data.considered} papers weighed across ${data.scanned.length} topic${data.scanned.length === 1 ? '' : 's'} · ${data.news.length} headlines · built ${ago(data.fetchedAt) || 'just now'}`
              : loading
                ? `Scanning every ${label} topic on arXiv — arXiv allows one query every 3 s, so a cold brief takes ~30 s. After that it is cached for everyone.`
                : ''}
          </p>
        </div>
        <span className="rsx-spacer" />
        <button className="lrn-btn tiny" onClick={() => load(true)} disabled={loading} title="Rebuild from the sources">
          ⟳ Refresh
        </button>
        <button className="lrn-btn primary rsx-brief-ai" onClick={summarise} disabled={!data?.picks.length || summarising}>
          {summarising ? 'Summarising…' : summary ? '✦ Re-summarise' : '✦ Summarise for me'}
        </button>
      </div>

      {data && data.missed.length > 0 && (
        <p className="rsx-error">Not scanned this time (arXiv was slow): {data.missed.join(', ')}. Refresh in a minute for the full list.</p>
      )}
      {error && <p className="rsx-error">The brief could not be built ({error}). Try Refresh in a minute.</p>}

      {summary && (
        <pre className="rsx-brief-summary">
          {summary}
          {summarising && <span className="kos-assistant-caret">▋</span>}
        </pre>
      )}

      {loading && !data && (
        <ol className="rsx-brief-list" aria-busy="true">
          {Array.from({ length: 4 }, (_, i) => (
            <li key={i} className="rsx-brief-row skeleton" />
          ))}
        </ol>
      )}

      {data && (
        <>
          <h3 className="rsx-h">Read this week</h3>
          {data.picks.length === 0 ? (
            <p className="lrn-empty">No new papers matched this week. Try Refresh, or browse the Papers tab.</p>
          ) : (
            <ol className="rsx-brief-list">
              {data.picks.map((p, i) => {
                const inLib = saved.has(p.hit.id);
                const expanded = open.has(p.hit.id);
                return (
                  <li key={p.hit.id} className="rsx-brief-row">
                    <span className="rsx-brief-n">{i + 1}</span>
                    <div className="rsx-brief-body">
                      <div className="rsx-row-head">
                        <a className="rsx-brief-paper" href={p.hit.absUrl} target="_blank" rel="noreferrer">
                          {p.hit.title}
                        </a>
                        {inLib ? (
                          <button className="lrn-btn tiny ok rsx-save" onClick={() => onOpenPaper(p.hit.id)}>
                            In library ✓
                          </button>
                        ) : (
                          <button className="lrn-btn tiny rsx-save" onClick={() => save(p)}>
                            Save
                          </button>
                        )}
                      </div>
                      <p className="rsx-row-meta">
                        {authors(p.hit.authors)} · {age(p.ageDays)}
                        {typeof p.hit.upvotes === 'number' && ` · ▲ ${p.hit.upvotes}`}
                      </p>
                      <p className="rsx-matched">
                        <span className="rsx-why">{p.topicLabel}</span>
                        {p.rqShort && <span className="lrn-tag">{p.rqShort}</span>}
                        {p.matched.slice(0, 5).map((m) => (
                          <span key={m} className="rsx-kw">
                            {m}
                          </span>
                        ))}
                      </p>
                      <p
                        className={'rsx-abstract' + (expanded ? ' open' : '')}
                        onClick={() => toggle(p.hit.id)}
                        title={expanded ? 'collapse' : 'expand abstract'}
                      >
                        {expanded ? p.hit.abstract || p.hit.aiSummary : p.hit.aiSummary || p.hit.abstract}
                      </p>
                      <p className="rsx-links">
                        {p.hit.pdfUrl && (
                          <a href={p.hit.pdfUrl} target="_blank" rel="noreferrer">
                            pdf
                          </a>
                        )}
                        {p.hit.arxivId && (
                          <a href={`https://www.alphaxiv.org/abs/${p.hit.arxivId}`} target="_blank" rel="noreferrer">
                            alphaXiv
                          </a>
                        )}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          {queue.length > 0 && (
            <>
              <h3 className="rsx-h">Still in your queue</h3>
              <ul className="rsx-brief-queue">
                {queue.map((p) => (
                  <li key={p.id}>
                    <button className="rsx-link-btn" onClick={() => onOpenPaper(p.id)}>
                      {p.title}
                    </button>
                    <span className="lrn-dim"> · {STATUS_SHORT[p.status]}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {data.news.length > 0 && (
            <>
              <h3 className="rsx-h">On the wire</h3>
              <ul className="rsx-brief-news">
                {data.news.map((n: NewsItem) => (
                  <li key={n.url}>
                    <span className={'kos-news-lane ' + n.lane}>{n.lane}</span>
                    <a href={n.url} target="_blank" rel="noreferrer">
                      {n.title}
                    </a>
                    <span className="lrn-dim">
                      {' '}
                      · {n.source}
                      {n.date && ` · ${ago(n.date)}`}
                    </span>
                  </li>
                ))}
              </ul>
              <button className="lrn-btn tiny" onClick={onShowNews}>
                All {label} news →
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}
