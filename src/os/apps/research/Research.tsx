'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { AppDefinition, AppProps } from '../../types';
import { counts, useResearch, useResearchHydrated } from '@/research/store';
import { Feed } from './Feed';
import { Library, type LibraryFilter, type LibraryView } from './Library';
import { ReviewDeck } from './ReviewDeck';
import { Today } from './Today';
import { Radar } from './Radar';
import { isTyping } from './PaperDetail';
import './research.css';

type Tab = 'today' | 'feed' | 'library' | 'review' | 'radar';
const TABS: Tab[] = ['today', 'feed', 'library', 'review', 'radar'];

const SHORTCUTS: { group: string; keys: [string, string][] }[] = [
  {
    group: 'Paper (Library)',
    keys: [
      ['1 / 2 / 3', 'set pass 1 / 2 / 3'],
      ['r', 'Read mode on / off'],
      ['Esc', 'leave Read mode'],
      ['n', 'focus the notes for the current pass'],
      ['c', 'new recall card'],
      ['h', 'new highlight (paste a sentence)'],
      ['j / k', 'next / previous paper in the list'],
    ],
  },
  {
    group: 'Review',
    keys: [
      ['Enter / Space', 'reveal the answer'],
      ['1 2 3 4', 'again / hard / good / easy'],
    ],
  },
  {
    group: 'Anywhere in Research',
    keys: [
      ['g then t f l v a', 'go to Today, Feed, Library, Review, Radar'],
      ['?', 'this sheet'],
    ],
  },
];

/**
 * Research — the study plan, paper feeds for the research questions, the
 * library with a reader and a literature matrix, spaced recall, and the AI
 * Radar. Opening state comes from launch args:
 *   arg 'today' | 'review' | 'library' | 'matrix' | 'radar' | 'feed' → that tab;
 *   any other string → Feed search; paperId → that paper's detail view.
 */
function ResearchApp({ args }: AppProps) {
  const hydrated = useResearchHydrated();
  const papers = useResearch((s) => s.papers);
  const cards = useResearch((s) => s.cards);
  const setReadMode = useResearch((s) => s.setReadMode);
  const c = useMemo(() => counts({ papers, cards }), [papers, cards]);

  const [tab, setTab] = useState<Tab>('today');
  const [openId, setOpenId] = useState<string | null>(null);
  const [search, setSearch] = useState<{ q: string; nonce: number } | null>(null);
  const [view, setView] = useState<LibraryView>('list');
  const [filter, setFilter] = useState<LibraryFilter | null>(null);
  const [sheet, setSheet] = useState(false);
  // a fresh review session per visit to the tab, so its queue is current
  const [reviewKey, setReviewKey] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const gPending = useRef(0);

  // launch args arrive on first open and again whenever the app is re-launched
  useEffect(() => {
    if (!args) return;
    const arg = typeof args.arg === 'string' ? args.arg.trim() : '';
    if (typeof args.paperId === 'string') {
      setOpenId(args.paperId);
      setView('list');
      setTab('library');
    } else if (arg === 'matrix') {
      setView('matrix');
      setTab('library');
    } else if ((TABS as string[]).includes(arg)) setTab(arg as Tab);
    else if (arg === 'news' || arg === 'ainews') setTab('radar');
    else if (arg) {
      setSearch({ q: arg, nonce: Date.now() });
      setTab('feed');
    }
  }, [args]);

  useEffect(() => {
    rootRef.current?.focus({ preventScroll: true });
  }, []);

  const go = (t: Tab) => {
    if (t === 'review') setReviewKey((k) => k + 1);
    setTab(t);
  };

  const openPaper = (id: string) => {
    setOpenId(id);
    setView('list');
    setTab('library');
  };

  const readPaper = (id: string) => {
    const mode = useResearch.getState().prefs.readMode[id];
    if (!mode || mode === 'off') setReadMode(id, 'split');
    openPaper(id);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
    if (e.key === '?') {
      e.preventDefault();
      setSheet((v) => !v);
      return;
    }
    if (e.key === 'Escape' && sheet) {
      e.preventDefault();
      setSheet(false);
      return;
    }
    if (e.key === 'g') {
      gPending.current = Date.now();
      return;
    }
    if (Date.now() - gPending.current < 1200) {
      const t = ({ t: 'today', f: 'feed', l: 'library', v: 'review', a: 'radar' } as Record<string, Tab>)[e.key];
      gPending.current = 0;
      if (t) {
        e.preventDefault();
        go(t);
      }
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'feed', label: 'Feed' },
    { id: 'library', label: `Library (${c.papers})` },
    { id: 'review', label: `Review (${c.due})` },
    { id: 'radar', label: 'Radar' },
  ];

  return (
    <div className="rsx" ref={rootRef} tabIndex={-1} onKeyDown={onKeyDown}>
      <nav className="rsx-tabs" role="tablist" aria-label="Research">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={'lrn-tab' + (tab === t.id ? ' active' : '')}
            onClick={() => go(t.id)}
          >
            {t.label}
          </button>
        ))}
        <span className="rsx-tabs-meta">
          {c.reading} reading · {c.cards} cards
        </span>
        <button className="rsx-help-btn" onClick={() => setSheet((v) => !v)} title="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts">
          ?
        </button>
      </nav>

      <div className={'rsx-body' + (tab === 'library' ? ' flush' : '')}>
        {!hydrated ? (
          <p className="lrn-empty">Loading your library…</p>
        ) : tab === 'today' ? (
          <Today
            onReview={() => go('review')}
            onRead={readPaper}
            onFeed={() => go('feed')}
            onLibrary={(f) => {
              setFilter({ ...f, nonce: Date.now() });
              setOpenId(null);
              setView('list');
              setTab('library');
            }}
          />
        ) : tab === 'feed' ? (
          <Feed search={search} onOpenPaper={openPaper} />
        ) : tab === 'library' ? (
          <Library openId={openId} onOpen={setOpenId} view={view} onView={setView} filter={filter} />
        ) : tab === 'review' ? (
          <ReviewDeck key={reviewKey} onOpenPaper={openPaper} />
        ) : (
          <Radar onOpenPaper={openPaper} />
        )}
      </div>

      {sheet && (
        <div className="rsx-sheet" role="dialog" aria-label="Keyboard shortcuts" onClick={() => setSheet(false)}>
          <div className="rsx-sheet-card" onClick={(e) => e.stopPropagation()}>
            <div className="rsx-sheet-head">
              <h3 className="rsx-panel-h">Keyboard shortcuts</h3>
              <button className="lrn-btn tiny" onClick={() => setSheet(false)}>
                Close <kbd>Esc</kbd>
              </button>
            </div>
            {SHORTCUTS.map((g) => (
              <section key={g.group}>
                <p className="rsx-answer-label">{g.group}</p>
                <dl className="rsx-keys">
                  {g.keys.map(([k, d]) => (
                    <div key={k}>
                      <dt>
                        {k.split(' ').map((x, i) =>
                          ['/', 'then'].includes(x) ? (
                            <span key={i}> {x} </span>
                          ) : (
                            <kbd key={i}>{x}</kbd>
                          ),
                        )}
                      </dt>
                      <dd>{d}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
            <p className="lrn-dim">Shortcuts are off while typing in a field. The PDF viewer keeps its own keys while it has focus — click the notes side to come back.</p>
          </div>
        </div>
      )}
    </div>
  );
}

export const researchApp: AppDefinition = {
  id: 'research',
  title: 'Research',
  icon: '🔬',
  category: 'Development',
  component: ResearchApp,
  description: 'Study plan, paper feeds, a reader with highlights, a literature matrix, spaced recall and the AI Radar',
  defaultSize: { width: 1100, height: 720 },
  minSize: { width: 420, height: 360 },
  desktop: true,
  launchCommands: ['research', 'scholar'],
};

export default ResearchApp;
