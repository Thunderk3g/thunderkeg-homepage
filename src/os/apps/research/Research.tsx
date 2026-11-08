'use client';

import { useEffect, useMemo, useState } from 'react';
import type { AppDefinition, AppProps } from '../../types';
import { counts, useResearch, useResearchHydrated } from '@/research/store';
import { TRACKS, isTrackId, trackFromWord, trackOf, type TrackId } from '@/research/tracks';
import { Brief } from './Brief';
import { Feed } from './Feed';
import { News } from './News';
import { Library } from './Library';
import { ReviewDeck } from './ReviewDeck';

type Tab = 'brief' | 'feed' | 'news' | 'library' | 'review';

const TRACK_KEY = 'kos:research:track';

function storedTrack(): TrackId {
  try {
    const v = localStorage.getItem(TRACK_KEY);
    return isTrackId(v) ? v : 'core';
  } catch {
    return 'core';
  }
}

function rememberTrack(t: TrackId) {
  try {
    localStorage.setItem(TRACK_KEY, t);
  } catch {
    /* private mode — the choice just isn't remembered */
  }
}

/**
 * Research — three tracks (AI/ML, Defense AI, Trading & Markets), each with a
 * weekly brief (what to read now, optionally summarised by the model), arXiv
 * topic feeds, an essentials reading list and a live news wire; plus
 * one shared library with three-pass notes and spaced recall.
 *
 * Launch args:
 *   arg 'brief' | 'review' | 'library' | 'news' → that tab;
 *   arg naming a track ('defense', 'markets', 'trading', 'ml'…) → that track's brief;
 *   any other arg → Feed search; paperId → that paper's detail view;
 *   track → that track (combines with tab: 'news').
 */
function ResearchApp({ args }: AppProps) {
  const hydrated = useResearchHydrated();
  const papers = useResearch((s) => s.papers);
  const cards = useResearch((s) => s.cards);
  const c = useMemo(() => counts({ papers, cards }), [papers, cards]);

  const [track, setTrackState] = useState<TrackId>('core');
  const [tab, setTab] = useState<Tab>('brief');
  const [openId, setOpenId] = useState<string | null>(null);
  const [search, setSearch] = useState<{ q: string; nonce: number } | null>(null);

  const setTrack = (t: TrackId) => {
    setTrackState(t);
    rememberTrack(t);
  };

  // launch args arrive on first open and again whenever the app is re-launched;
  // with no track in them, fall back to the remembered one (read after mount
  // so server and client markup agree)
  useEffect(() => {
    const arg = typeof args?.arg === 'string' ? args.arg.trim() : '';
    const named = arg ? trackFromWord(arg) : undefined;
    const t = isTrackId(args?.track) ? args.track : named;
    if (t) setTrack(t);
    else setTrackState(storedTrack());
    if (!args) return;

    if (typeof args.paperId === 'string') {
      setOpenId(args.paperId);
      setTab('library');
    } else if (arg === 'review' || arg === 'library' || arg === 'news' || arg === 'brief') setTab(arg);
    else if (named) {
      setSearch(null);
      setTab('brief');
    }
    else if (arg) {
      setSearch({ q: arg, nonce: Date.now() });
      setTab('feed');
    } else if (args.tab === 'news' || args.tab === 'brief') setTab(args.tab);
  }, [args]);

  const openPaper = (id: string) => {
    setOpenId(id);
    setTab('library');
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'brief', label: '✦ Brief' },
    { id: 'feed', label: 'Papers' },
    { id: 'news', label: 'News' },
    { id: 'library', label: `Library (${c.papers})` },
    { id: 'review', label: `Review (${c.due})` },
  ];

  // the library and recall deck are shared; the track bar scopes brief, papers and news
  const scoped = tab === 'brief' || tab === 'feed' || tab === 'news';

  return (
    <div className="rsx">
      <div className="rsx-tracks" role="group" aria-label="Research track">
        {TRACKS.map((t) => (
          <button
            key={t.id}
            aria-pressed={track === t.id}
            className={'rsx-track' + (track === t.id ? ' on' : '') + (scoped ? '' : ' muted')}
            onClick={() => {
              setTrack(t.id);
              setSearch(null);
              if (!scoped) setTab('brief');
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

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

      {(tab === 'feed' || tab === 'news') && <p className="rsx-track-blurb">{trackOf(track).blurb}</p>}

      <div className={'rsx-body' + (tab === 'library' || tab === 'news' ? ' flush' : '')}>
        {!hydrated ? (
          <p className="lrn-empty">Loading your library…</p>
        ) : tab === 'brief' ? (
          <Brief key={track} track={track} onOpenPaper={openPaper} onShowNews={() => setTab('news')} />
        ) : tab === 'feed' ? (
          <Feed key={track} track={track} search={search} onOpenPaper={openPaper} />
        ) : tab === 'news' ? (
          <News key={track} track={track} />
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
  description: 'AI/ML, Defense AI and Trading & Markets — paper feeds, essentials, live news, notes and spaced recall',
  defaultSize: { width: 1100, height: 720 },
  minSize: { width: 420, height: 360 },
  desktop: true,
  launchCommands: ['research', 'scholar'],
};

export default ResearchApp;
