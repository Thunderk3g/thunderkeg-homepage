'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { STATUS_ORDER, STATUS_SHORT, type ReadStatus } from '@/research/types';
import { useResearch } from '@/research/store';
import { isoDay } from '@/research/schedule';
import { toBibtexAll } from '@/research/bibtex';
import { download } from '@/research/client';
import { PaperDetail, isTyping, type KeyHandler } from './PaperDetail';
import { Matrix } from './Matrix';

export type LibraryView = 'list' | 'matrix';
export interface LibraryFilter {
  rq?: string;
  status?: string;
  nonce: number;
}

/**
 * Library: filterable list on the left, the open paper on the right. Under
 * 640px of window width (a phone, or a narrow window) it is one pane at a time.
 */
export function Library({
  openId,
  onOpen,
  view,
  onView,
  filter,
}: {
  openId: string | null;
  onOpen: (id: string | null) => void;
  view: LibraryView;
  onView: (v: LibraryView) => void;
  /** set from the Today tab (coverage grid, inbox) */
  filter?: LibraryFilter | null;
}) {
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
  const keysRef = useRef<KeyHandler | null>(null);
  const readMode = useResearch((s) => (openId ? s.prefs.readMode[openId] ?? 'off' : 'off'));

  useEffect(() => {
    if (!filter) return;
    setRq(filter.rq ?? '');
    setStatus((filter.status as typeof status) ?? 'all');
    setText('');
    setTag('');
  }, [filter]);

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
  const reading = !!open && readMode !== 'off';
  const rootRef = useRef<HTMLDivElement>(null);

  // take focus when a paper opens from elsewhere (Today, Review), so its keys work at once
  useEffect(() => {
    const a = document.activeElement;
    if (openId && rootRef.current && (!a || a === document.body || !rootRef.current.contains(a))) rootRef.current.focus({ preventScroll: true });
  }, [openId]);

  // j/k walk the filtered list; everything else goes to the open paper
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (view !== 'list') return;
    if (!e.ctrlKey && !e.metaKey && !e.altKey && !isTyping(e.target) && (e.key === 'j' || e.key === 'k')) {
      if (!filtered.length) return;
      const i = filtered.findIndex((p) => p.id === openId);
      const next = e.key === 'j' ? (i < 0 ? 0 : Math.min(filtered.length - 1, i + 1)) : i < 0 ? 0 : Math.max(0, i - 1);
      onOpen(filtered[next].id);
      e.preventDefault();
      e.stopPropagation();
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>(`[data-paper-row="${CSS.escape(filtered[next].id)}"]`)?.scrollIntoView({ block: 'nearest' }),
      );
      return;
    }
    if (open && keysRef.current?.(e)) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  if (view === 'matrix') {
    return (
      <div className="rsx-lib-matrix">
        <ViewToggle view={view} onView={onView} />
        <Matrix
          papers={papers}
          onOpen={(id) => {
            onOpen(id);
            onView('list');
          }}
        />
      </div>
    );
  }

  const onImport = async (file: File) => {
    const r = importJson(await file.text());
    if (r.ok) toast.success('Research library imported');
    else toast.error(r.error ?? 'Import failed');
  };

  return (
    <div className={'rsx-lib' + (open ? ' has-detail' : '') + (reading ? ' reading' : '')} onKeyDown={onKeyDown} ref={rootRef} tabIndex={-1}>
      <section className="rsx-lib-list" aria-label="Library">
        <ViewToggle view={view} onView={onView} />
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
                  <button
                    className={'rsx-lib-row' + (p.id === openId ? ' open' : '')}
                    onClick={() => onOpen(p.id)}
                    data-paper-row={p.id}
                  >
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
          <PaperDetail key={open.id} paper={open} onBack={() => onOpen(null)} onOpenPaper={onOpen} keysRef={keysRef} />
        ) : (
          <p className="lrn-empty rsx-pick">
            Pick a paper to read, annotate and write recall cards for. <kbd>j</kbd>/<kbd>k</kbd> walk the list, <kbd>?</kbd> lists
            every shortcut.
          </p>
        )}
      </section>
    </div>
  );
}

function ViewToggle({ view, onView }: { view: LibraryView; onView: (v: LibraryView) => void }) {
  return (
    <span className="rsx-seg rsx-view-toggle" role="group" aria-label="Library view">
      <button className={view === 'list' ? 'on' : ''} aria-pressed={view === 'list'} onClick={() => onView('list')}>
        List
      </button>
      <button className={view === 'matrix' ? 'on' : ''} aria-pressed={view === 'matrix'} onClick={() => onView('matrix')}>
        Matrix
      </button>
    </span>
  );
}
