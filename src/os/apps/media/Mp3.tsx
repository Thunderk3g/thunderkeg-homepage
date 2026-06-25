'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { AppDefinition } from '../../types';

interface Track {
  id: string;
  title: string;
  artist: string;
  src: string;
}

const PLAYLIST: Track[] = [
  { id: 't1', title: 'SoundHelix Song 1', artist: 'T. Schürger', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { id: 't2', title: 'SoundHelix Song 2', artist: 'T. Schürger', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
  { id: 't3', title: 'SoundHelix Song 3', artist: 'T. Schürger', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
];

const ACCENT = '#62a0ea';
const BG = '#1d1f21';
const PANEL = '#26282b';
const BORDER = '#3a3d41';
const MUTED = '#9aa0a6';

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function Mp3App() {
  const ref = useRef<HTMLAudioElement>(null);
  const [index, setIndex] = useState(0);
  const [custom, setCustom] = useState<Track | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVol] = useState(0.7);

  const current = custom ?? PLAYLIST[index] ?? PLAYLIST[0];

  // Sync DOM <-> state via element events.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => setPlaying(false);
    const onTime = () => setCurrentTime(el.currentTime || 0);
    const onMeta = () => setDuration(Number.isFinite(el.duration) ? el.duration : 0);
    const onVol = () => setVol(el.volume);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('ended', onEnded);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('loadedmetadata', onMeta);
    el.addEventListener('durationchange', onMeta);
    el.addEventListener('volumechange', onVol);
    el.volume = volume;
    return () => {
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('loadedmetadata', onMeta);
      el.removeEventListener('durationchange', onMeta);
      el.removeEventListener('volumechange', onVol);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset position when the source changes.
  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
  }, [current.src]);

  const toggle = () => {
    const el = ref.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => setPlaying(false));
    else el.pause();
  };

  const seek = (seconds: number) => {
    const el = ref.current;
    if (!el) return;
    const max = Number.isFinite(el.duration) ? el.duration : seconds;
    const clamped = Math.max(0, Math.min(seconds, max));
    el.currentTime = clamped;
    setCurrentTime(clamped);
  };

  const setVolume = (v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    if (ref.current) ref.current.volume = clamped;
    setVol(clamped);
  };

  const select = (i: number) => {
    setCustom(null);
    setIndex(i);
  };

  const step = (dir: number) => {
    setCustom(null);
    setIndex((i) => (i + dir + PLAYLIST.length) % PLAYLIST.length);
  };

  const loadUrl = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    setCustom({ id: 'custom', title: 'Custom URL', artist: trimmed, src: trimmed });
  };

  const pct = duration > 0 ? (Math.min(currentTime, duration) / duration) * 100 : 0;
  const timeLabel = useMemo(
    () => `${formatTime(currentTime)} / ${formatTime(duration)}`,
    [currentTime, duration],
  );

  const fill = `linear-gradient(90deg, ${ACCENT} ${pct}%, ${BORDER} ${pct}%)`;
  const isActive = (i: number) => custom === null && i === index;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', background: BG, color: '#e8eaed', fontFamily: 'system-ui, sans-serif', fontSize: 13 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '18px 16px', borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ width: 132, height: 132, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: PANEL, fontSize: 56 }} aria-hidden>
          🎵
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 600 }}>{current.title}</div>
          <div style={{ fontSize: 11, color: MUTED, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{current.artist}</div>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', borderBottom: `1px solid ${BORDER}` }}>
        {PLAYLIST.map((track, i) => {
          const active = isActive(i);
          return (
            <button
              key={track.id}
              type="button"
              onClick={() => select(i)}
              style={{
                display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                padding: '8px 14px', textAlign: 'left', border: 'none', cursor: 'pointer',
                background: active ? PANEL : 'transparent', color: active ? ACCENT : '#e8eaed', font: 'inherit',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                <span style={{ width: 14 }}>{active && playing ? '⏸' : '▶'}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.title}</span>
              </span>
              <span style={{ fontSize: 11, color: MUTED, flexShrink: 0 }}>{track.artist}</span>
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 6, padding: '8px 14px', borderBottom: `1px solid ${BORDER}` }}>
        <input
          type="text"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') loadUrl(); }}
          placeholder="Paste an audio URL…"
          aria-label="Audio URL"
          style={{ flex: 1, minWidth: 0, padding: '6px 8px', borderRadius: 4, border: `1px solid ${BORDER}`, background: BG, color: '#e8eaed', font: 'inherit' }}
        />
        <button type="button" onClick={loadUrl} style={{ padding: '6px 12px', borderRadius: 4, border: `1px solid ${BORDER}`, background: PANEL, color: ACCENT, cursor: 'pointer', font: 'inherit' }}>
          Load
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 14px 14px' }}>
        <input
          type="range" min={0} max={duration || 1} step={0.01} value={Math.min(currentTime, duration || 1)}
          onChange={(e) => seek(Number(e.target.value))}
          disabled={duration <= 0} aria-label="Seek"
          style={{ width: '100%', height: 6, cursor: duration > 0 ? 'pointer' : 'default', accentColor: ACCENT, background: fill, borderRadius: 4, appearance: 'none', WebkitAppearance: 'none' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button type="button" onClick={() => step(-1)} aria-label="Previous track" style={btn}>⏮</button>
            <button type="button" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'} style={{ ...btn, background: PANEL, color: ACCENT, fontSize: 16 }}>
              {playing ? '⏸' : '▶'}
            </button>
            <button type="button" onClick={() => step(1)} aria-label="Next track" style={btn}>⏭</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button type="button" onClick={() => setVolume(volume > 0 ? 0 : 0.7)} aria-label={volume === 0 ? 'Unmute' : 'Mute'} style={{ ...btn, fontSize: 13 }}>
              {volume === 0 ? '🔇' : '🔊'}
            </button>
            <input
              type="range" min={0} max={1} step={0.01} value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              aria-label="Volume"
              style={{ width: 80, height: 4, cursor: 'pointer', accentColor: ACCENT }}
            />
            <span style={{ minWidth: 86, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 11, color: MUTED }}>{timeLabel}</span>
          </div>
        </div>
      </div>

      <audio ref={ref} src={current.src} preload="metadata" style={{ display: 'none' }} />
    </div>
  );
}

const btn: React.CSSProperties = {
  border: `1px solid ${BORDER}`, background: 'transparent', color: '#e8eaed',
  borderRadius: 6, padding: '6px 9px', cursor: 'pointer', font: 'inherit', lineHeight: 1,
};

export const mp3App: AppDefinition = {
  id: 'mp3',
  title: 'Music',
  icon: '🎵',
  category: 'Accessories',
  component: Mp3App,
  description: 'MP3 music player with a built-in playlist',
  defaultSize: { width: 360, height: 560 },
  minSize: { width: 300, height: 460 },
  desktop: false,
  launchCommands: ['mp3', 'music', 'audacious'],
};

export default Mp3App;
