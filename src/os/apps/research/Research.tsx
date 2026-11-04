'use client';

import { useEffect, useMemo, useState } from 'react';
import type { AppDefinition, AppProps } from '../../types';
import { counts, useResearch, useResearchHydrated } from '@/research/store';
import { Feed } from './Feed';
import { Library } from './Library';
import { ReviewDeck } from './ReviewDeck';

type Tab = 'feed' | 'library' | 'review';

/**
 * Research — paper feeds for the research questions, three-pass notes, and
 * spaced recall. Opening state comes from launch args:
 *   arg 'review' | 'library' → that tab; any other string → Feed search;
 *   paperId → that paper's detail view.
 */
function ResearchApp({ args }: AppProps) {
  const hydrated = useResearchHydrated();
  const papers = useResearch((s) => s.papers);
  const cards = useResearch((s) => s.cards);
  const c = useMemo(() => counts({ papers, cards }), [papers, cards]);

  const [tab, setTab] = useState<Tab>('feed');
  const [openId, setOpenId] = useState<string | null>(null);
  const [search, setSearch] = useState<{ q: string; nonce: number } | null>(null);

  // launch args arrive on first open and again whenever the app is re-launched
  useEffect(() => {
    if (!args) return;
    const arg = typeof args.arg === 'string' ? args.arg.trim() : '';
    if (typeof args.paperId === 'string') {
      setOpenId(args.paperId);
      setTab('library');
    } else if (arg === 'review') setTab('review');
    else if (arg === 'library') setTab('library');
    else if (arg) {
      setSearch({ q: arg, nonce: Date.now() });
      setTab('feed');
    }
  }, [args]);

  const openPaper = (id: string) => {
    setOpenId(id);
    setTab('library');
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'feed', label: 'Feed' },
    { id: 'library', label: `Library (${c.papers})` },
    { id: 'review', label: `Review (${c.due})` },
  ];

  return (
    <div className="rsx">
      <nav className="rsx-tabs" role="tablist" aria-label="Research">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={'lrn-tab' + (tab === t.id ? ' active' : '')}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
        <span className="rsx-tabs-meta">
          {c.reading} reading · {c.cards} cards
        </span>
      </nav>

      <div className={'rsx-body' + (tab === 'library' ? ' flush' : '')}>
        {!hydrated ? (
          <p className="lrn-empty">Loading your library…</p>
        ) : tab === 'feed' ? (
          <Feed search={search} onOpenPaper={openPaper} />
        ) : tab === 'library' ? (
          <Library openId={openId} onOpen={setOpenId} />
        ) : (
          <ReviewDeck onOpenPaper={openPaper} />
        )}
      </div>
    </div>
  );
}

export const researchApp: AppDefinition = {
  id: 'research',
  title: 'Research',
  icon: '🔬',
  category: 'Development',
  component: ResearchApp,
  description: 'Paper feeds for my research questions, three-pass notes, and spaced recall',
  defaultSize: { width: 1100, height: 720 },
  minSize: { width: 420, height: 360 },
  desktop: true,
  launchCommands: ['research', 'scholar'],
};

export default ResearchApp;
