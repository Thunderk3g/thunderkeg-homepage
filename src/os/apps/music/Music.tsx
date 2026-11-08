'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { AppDefinition, AppProps } from '../../types';
import { AUDIUS_GENRES, RADIO_TAGS, type MusicResponse, type Track } from '@/music/types';
import { current, fmtTime, usePlayer } from '@/music/player';

type View = 'trending' | 'search' | 'soma' | 'radio' | 'queue';

const NAV: { id: View; label: string; hint: string }[] = [
  { id: 'trending', label: 'Trending', hint: 'What is climbing on Audius this week' },
  { id: 'search', label: 'Search', hint: 'Any track or artist on Audius' },
  { id: 'soma', label: 'SomaFM', hint: 'Commercial-free, listener-supported radio — great for focus' },
  { id: 'radio', label: 'World radio', hint: 'Open directory of internet radio stations' },
  { id: 'queue', label: 'Up next', hint: 'The current queue' },
];

/** Catalogue results survive view switches for the session. */
const memo = new Map<string, MusicResponse>();

function useCatalogue(qs: string | null) {
  const [data, setData] = useState<MusicResponse | null>(qs ? memo.get(qs) ?? null : null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!qs) {
      setData(null);
      return;
    }
    const hit = memo.get(qs);
    if (hit) {
      setData(hit);
      return;
    }
    let live = true;
    setLoading(true);
    setData(null);
    fetch(`/api/music?${qs}`)
      .then((r) => r.json() as Promise<MusicResponse>)
      .then((d) => {
        if (d.items?.length) memo.set(qs, d);
        if (live) setData({ items: d.items ?? [], source: d.source, cached: d.cached, error: d.error });
      })
      .catch((e: Error) => live && setData({ items: [], source: '', cached: false, error: e.message }))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [qs]);
  return { data, loading };
}

function Art({ t, size = 40 }: { t?: Track; size?: number }) {
  const [broken, setBroken] = useState(false);
  if (!t?.art || broken) {
    return (
      <span className="mus-art ph" style={{ width: size, height: size }} aria-hidden>
        {t?.kind === 'radio' ? '📻' : '♪'}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="mus-art"
      src={t.art}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
    />
  );
}

const compact = (n?: number) =>
  n === undefined ? '' : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}k` : String(n);

function TrackList({ items, label }: { items: Track[]; label: string }) {
  const playList = usePlayer((s) => s.playList);
  const toggle = usePlayer((s) => s.toggle);
  const nowId = usePlayer((s) => current(s)?.id);
  const playing = usePlayer((s) => s.playing);

  return (
    <ol className="mus-tracks" aria-label={label}>
      {items.map((t, i) => {
        const on = t.id === nowId;
        return (
          <li key={t.id} className={'mus-track' + (on ? ' on' : '')}>
            <button
              className="mus-track-main"
              onClick={() => (on ? toggle() : playList(items, i))}
              aria-label={on && playing ? `Pause ${t.title}` : `Play ${t.title}`}
            >
              <span className="mus-idx">{on && playing ? '❚❚' : on ? '▶' : i + 1}</span>
              <Art t={t} />
              <span className="mus-track-text">
                <span className="mus-track-title">{t.title}</span>
                <span className="mus-track-sub">{t.artist}</span>
              </span>
              <span className="mus-track-genre">{t.genre}</span>
              <span className="mus-track-plays">{t.plays ? `${compact(t.plays)} plays` : ''}</span>
              <span className="mus-track-dur">{t.duration ? fmtTime(t.duration) : ''}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function StationGrid({ items, label }: { items: Track[]; label: string }) {
  const playList = usePlayer((s) => s.playList);
  const toggle = usePlayer((s) => s.toggle);
  const nowId = usePlayer((s) => current(s)?.id);
  const playing = usePlayer((s) => s.playing);
  return (
    <div className="mus-grid" role="list" aria-label={label}>
      {items.map((t, i) => {
        const on = t.id === nowId;
        return (
          <button
            key={t.id}
            role="listitem"
            className={'mus-card' + (on ? ' on' : '')}
            onClick={() => (on ? toggle() : playList(items, i))}
            title={t.note ?? t.title}
          >
            <span className="mus-card-art">
              <Art t={t} size={96} />
              <span className="mus-card-play" aria-hidden>
                {on && playing ? '❚❚' : '▶'}
              </span>
            </span>
            <span className="mus-card-title">{t.title}</span>
            <span className="mus-card-sub">
              {t.genre}
              {t.plays ? ` · ${compact(t.plays)} listening` : ''}
            </span>
            {t.note && <span className="mus-card-note">{t.note}</span>}
          </button>
        );
      })}
    </div>
  );
}

function Status({ loading, data, empty }: { loading: boolean; data: MusicResponse | null; empty: string }) {
  if (loading) return <p className="mus-empty">Loading…</p>;
  if (data?.error && !data.items.length) return <p className="mus-empty">The catalogue didn’t answer ({data.error}). Try again in a minute.</p>;
  if (data && !data.items.length) return <p className="mus-empty">{empty}</p>;
  return null;
}

function PlayerBar() {
  const s = usePlayer();
  const t = current(s);
  const live = t?.kind === 'radio';
  return (
    <div className={'mus-bar' + (t ? '' : ' idle')}>
      <div className="mus-now">
        <Art t={t} size={46} />
        <div className="mus-now-text">
          <span className="mus-now-title">{t?.title ?? 'Nothing playing'}</span>
          <span className="mus-now-sub">
            {t ? (
              <>
                {t.artist}
                {t.link && (
                  <>
                    {' · '}
                    <a href={t.link} target="_blank" rel="noreferrer">
                      open ↗
                    </a>
                  </>
                )}
              </>
            ) : (
              'Pick a track or a station'
            )}
          </span>
        </div>
      </div>

      <div className="mus-ctl">
        <div className="mus-ctl-btns">
          <button onClick={s.prev} disabled={!t} aria-label="Previous">
            ⏮
          </button>
          <button className="mus-play" onClick={s.toggle} disabled={!t} aria-label={s.playing ? 'Pause' : 'Play'}>
            {s.loading ? '…' : s.playing ? '❚❚' : '▶'}
          </button>
          <button onClick={s.next} disabled={!t} aria-label="Next">
            ⏭
          </button>
        </div>
        <div className="mus-seek">
          {live ? (
            <span className="mus-live">● LIVE</span>
          ) : (
            <>
              <span>{fmtTime(s.time)}</span>
              <input
                type="range"
                min={0}
                max={Math.max(1, s.duration)}
                step={1}
                value={Math.min(s.time, s.duration || 0)}
                onChange={(e) => s.seek(+e.target.value)}
                disabled={!t}
                aria-label="Seek"
              />
              <span>{fmtTime(s.duration)}</span>
            </>
          )}
        </div>
        {s.error && <span className="mus-err">{s.error}</span>}
      </div>

      <div className="mus-vol">
        <span aria-hidden>{s.volume === 0 ? '🔇' : '🔊'}</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.02}
          value={s.volume}
          onChange={(e) => s.setVolume(+e.target.value)}
          aria-label="Volume"
        />
      </div>
    </div>
  );
}

function MusicApp({ args }: AppProps) {
  const [view, setView] = useState<View>('soma');
  const [genre, setGenre] = useState('');
  const [time, setTime] = useState<'week' | 'month' | 'allTime'>('week');
  const [tag, setTag] = useState<string>('lofi');
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const queue = usePlayer((s) => s.queue);
  const searchRef = useRef<HTMLInputElement>(null);

  // `music <words>` from the terminal searches; `music radio` / `music trending` pick a view
  useEffect(() => {
    const arg = typeof args?.arg === 'string' ? args.arg.trim() : '';
    if (!arg) return;
    const v = NAV.find((n) => n.id === arg.toLowerCase());
    if (v) setView(v.id);
    else {
      setText(arg);
      setQ(arg);
      setView('search');
    }
  }, [args]);

  useEffect(() => {
    if (view === 'search') searchRef.current?.focus();
  }, [view]);

  const qs = useMemo(() => {
    if (view === 'trending') return new URLSearchParams({ source: 'trending', time, ...(genre ? { genre } : {}) }).toString();
    if (view === 'search') return q ? new URLSearchParams({ source: 'search', q }).toString() : null;
    if (view === 'soma') return 'source=somafm';
    if (view === 'radio') return new URLSearchParams({ source: 'radio', tag }).toString();
    return null;
  }, [view, genre, time, q, tag]);
  const { data, loading } = useCatalogue(qs);
  const items = data?.items ?? [];
  const nav = NAV.find((n) => n.id === view)!;

  return (
    <div className="mus">
      <div className="mus-in">
        <aside className="mus-side">
          <div className="mus-brand">
            <span className="mus-logo" aria-hidden>
              ◉
            </span>
            Music
          </div>
          <nav aria-label="Music">
            {NAV.map((n) => (
              <button key={n.id} className={'mus-nav' + (view === n.id ? ' on' : '')} onClick={() => setView(n.id)}>
                {n.label}
                {n.id === 'queue' && queue.length > 0 && <span className="mus-count">{queue.length}</span>}
              </button>
            ))}
          </nav>
          <p className="mus-credit">
            Streams from{' '}
            <a href="https://audius.co" target="_blank" rel="noreferrer">
              Audius
            </a>
            ,{' '}
            <a href="https://somafm.com" target="_blank" rel="noreferrer">
              SomaFM
            </a>{' '}
            and{' '}
            <a href="https://www.radio-browser.info" target="_blank" rel="noreferrer">
              Radio Browser
            </a>
            . Open, keyless, free.
          </p>
        </aside>

        <main className="mus-main">
          <header className="mus-head">
            <h2>{nav.label}</h2>
            <p>{nav.hint}</p>
          </header>

          {view === 'trending' && (
            <div className="mus-filters">
              <div className="mus-chips" role="group" aria-label="Genre">
                <button className={'mus-chip' + (genre === '' ? ' on' : '')} onClick={() => setGenre('')}>
                  All
                </button>
                {AUDIUS_GENRES.map((g) => (
                  <button key={g} className={'mus-chip' + (genre === g ? ' on' : '')} onClick={() => setGenre(g)}>
                    {g}
                  </button>
                ))}
              </div>
              <select value={time} onChange={(e) => setTime(e.target.value as typeof time)} aria-label="Period">
                <option value="week">This week</option>
                <option value="month">This month</option>
                <option value="allTime">All time</option>
              </select>
            </div>
          )}

          {view === 'search' && (
            <form
              className="mus-search"
              onSubmit={(e) => {
                e.preventDefault();
                setQ(text.trim());
              }}
            >
              <input
                ref={searchRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Search tracks and artists…"
                aria-label="Search music"
              />
              <button type="submit" disabled={!text.trim()}>
                Search
              </button>
            </form>
          )}

          {view === 'radio' && (
            <div className="mus-chips" role="group" aria-label="Station tag">
              {RADIO_TAGS.map((t) => (
                <button key={t} className={'mus-chip' + (tag === t ? ' on' : '')} onClick={() => setTag(t)}>
                  {t}
                </button>
              ))}
            </div>
          )}

          <div className="mus-scroll">
            {view === 'queue' ? (
              queue.length ? (
                <TrackList items={queue} label="Up next" />
              ) : (
                <p className="mus-empty">The queue is empty — play something from Trending, Search or a station.</p>
              )
            ) : view === 'search' && !q ? (
              <p className="mus-empty">Try “lofi”, “synthwave”, “deep focus” or an artist name.</p>
            ) : (
              <>
                <Status loading={loading} data={data} empty="Nothing found." />
                {items.length > 0 &&
                  (view === 'soma' || view === 'radio' ? (
                    <StationGrid items={items} label={nav.label} />
                  ) : (
                    <TrackList items={items} label={nav.label} />
                  ))}
              </>
            )}
          </div>
        </main>

        <PlayerBar />
      </div>
    </div>
  );
}

export const musicApp: AppDefinition = {
  id: 'music',
  title: 'Music',
  icon: '🎧',
  category: 'Multimedia',
  component: MusicApp,
  description: 'Stream open music (Audius) and commercial-free radio (SomaFM, Radio Browser)',
  defaultSize: { width: 980, height: 660 },
  minSize: { width: 380, height: 420 },
  desktop: true,
  launchCommands: ['music', 'tunes'],
};

export default MusicApp;
