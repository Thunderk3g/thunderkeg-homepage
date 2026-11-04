'use client';

import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { STATUS_ORDER, STATUS_SHORT, type ReadStatus } from '@/research/types';
import { useResearch } from '@/research/store';
import { isoDay } from '@/research/schedule';
import { toBibtexAll } from '@/research/bibtex';
import { download } from '@/research/client';
import { PaperDetail } from './PaperDetail';

/**
 * Library: filterable list on the left, the open paper on the right. Under
 * 640px of window width (a phone, or a narrow window) it is one pane at a time.
 */
export function Library({ openId, onOpen }: { openId: string | null; onOpen: (id: string | null) => void }) {
  const papers = useResearch((s) => s.papers);
  const cards = useResearch((s) => s.cards);
  const rqs = useResearch((s) => s.rqs);
  const exportJson = useResearch((s) => s.exportJson);
  const importJson = useResearch((s) => s.importJson);

  const [status, setStatus] = useState<ReadStatus | 'all' | 'active'>('all');
  const [rq, setRq] = useState('');
  const [tag, setTag] = useState('');
  const [text, setText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const today = isoDay();
  const cardStats = useMemo(() => {
    const m = new Map<string, { n: number; due: number }>();
    for (const c of cards) {
      const s = m.get(c.paperId) ?? { n: 0, due: 0 };
      s.n++;
      if (!c.suspended && c.due <= today) s.due++;
      m.set(c.paperId, s);
    }
    return m;
  }, [cards, today]);

  const allTags = useMemo(() => [...new Set(papers.flatMap((p) => p.tags))].sort(), [papers]);

  const filtered = useMemo(() => {
    const q = text.trim().toLowerCase();
    return papers
      .filter((p) =>
        status === 'all'
          ? true
          : status === 'active'
            ? ['pass1', 'pass2', 'pass3'].includes(p.status)
            : p.status === status,
      )
      .filter((p) => !rq || p.rqIds.includes(rq))
      .filter((p) => !tag || p.tags.includes(tag))
      .filter(
        (p) =>
          !q ||
          p.title.toLowerCase().includes(q) ||
          p.authors.join(' ').toLowerCase().includes(q) ||
          p.id.includes(q),
      )
      .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || b.savedAt.localeCompare(a.savedAt));
  }, [papers, status, rq, tag, text]);

  const open = openId ? papers.find((p) => p.id === openId) : undefined;

  const onImport = async (file: File) => {
    const r = importJson(await file.text());
    if (r.ok) toast.success('Research library imported');
    else toast.error(r.error ?? 'Import failed');
  };

  return (
    <div className={'rsx-lib' + (open ? ' has-detail' : '')}>
      <section className="rsx-lib-list" aria-label="Library">
        <div className="rsx-filters">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="filter title / author / id…"
            aria-label="filter library"
          />
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="status">
            <option value="all">All statuses</option>
            <option value="active">Reading (pass 1–3)</option>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_SHORT[s]}
              </option>
            ))}
          </select>
          <select value={rq} onChange={(e) => setRq(e.target.value)} aria-label="research question">
            <option value="">All RQs</option>
            {rqs.map((q) => (
              <option key={q.id} value={q.id}>
                {q.short}
              </option>
            ))}
          </select>
          <select value={tag} onChange={(e) => setTag(e.target.value)} aria-label="tag">
            <option value="">All tags</option>
            {allTags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="lrn-btn-row rsx-bulk">
          <button
            className="lrn-btn tiny"
            disabled={!filtered.length}
            onClick={() => download(`library-${today}.bib`, toBibtexAll(filtered) + '\n', 'application/x-bibtex')}
          >
            Export BibTeX ({filtered.length})
          </button>
          <button className="lrn-btn tiny" onClick={() => download(`research-${today}.json`, exportJson(), 'application/json')}>
            Export JSON
          </button>
          <button className="lrn-btn tiny" onClick={() => fileRef.current?.click()}>
            Import JSON
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onImport(f);
              e.target.value = '';
            }}
          />
        </div>

        {papers.length === 0 ? (
          <p className="lrn-empty">Save papers from the Feed — or your published paper notes will import automatically.</p>
        ) : filtered.length === 0 ? (
          <p className="lrn-empty">Nothing matches those filters.</p>
        ) : (
          <ul className="rsx-lib-rows">
            {filtered.map((p) => {
              const st = cardStats.get(p.id);
              return (
                <li key={p.id}>
                  <button className={'rsx-lib-row' + (p.id === openId ? ' open' : '')} onClick={() => onOpen(p.id)}>
                    <span className={`rsx-pill st-${p.status}`}>{STATUS_SHORT[p.status]}</span>
                    <span className="rsx-lib-title">{p.title}</span>
                    <span className="rsx-lib-meta">
                      {p.rqIds.map((r) => (
                        <span key={r} className="rsx-rq">
                          {r.toUpperCase()}
                        </span>
                      ))}
                      <span title="recall cards">{st?.n ?? 0} cards</span>
                      {st?.due ? <span className="rsx-due">{st.due} due</span> : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rsx-lib-detail" aria-label="Paper">
        {open ? (
          <PaperDetail key={open.id} paper={open} onBack={() => onOpen(null)} onOpenPaper={onOpen} />
        ) : (
          <p className="lrn-empty rsx-pick">Pick a paper to read, annotate and write recall cards for.</p>
        )}
      </section>
    </div>
  );
}
