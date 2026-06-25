'use client';

import { Maximize, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { AppDefinition, AppProps } from '../../types';

const ACCENT = '#ff8800';
const SAMPLES: { title: string; src: string }[] = [
  {
    title: 'Big Buck Bunny',
    src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  },
  {
    title: 'W3C Sample',
    src: 'https://www.w3schools.com/html/mov_bbb.mp4',
  },
];

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function VlcApp(_props: AppProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const [src, setSrc] = useState(SAMPLES[0].src);
  const [title, setTitle] = useState(SAMPLES[0].title);
  const [urlInput, setUrlInput] = useState('');
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTime = () => setCurrentTime(v.currentTime);
    const onMeta = () => setDuration(Number.isFinite(v.duration) ? v.duration : 0);
    const onVol = () => {
      setVolume(v.volume);
      setMuted(v.muted);
    };
    const onError = () => setHasError(true);
    const onEnded = () => setPlaying(false);

    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('loadedmetadata', onMeta);
    v.addEventListener('durationchange', onMeta);
    v.addEventListener('volumechange', onVol);
    v.addEventListener('error', onError);
    v.addEventListener('ended', onEnded);

    return () => {
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('loadedmetadata', onMeta);
      v.removeEventListener('durationchange', onMeta);
      v.removeEventListener('volumechange', onVol);
      v.removeEventListener('error', onError);
      v.removeEventListener('ended', onEnded);
    };
  }, []);

  // Reset transient state whenever the source changes.
  useEffect(() => {
    setHasError(false);
    setCurrentTime(0);
    setDuration(0);
    setPlaying(false);
  }, [src]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      void v.play().catch(() => setHasError(true));
    } else {
      v.pause();
    }
  }, []);

  const seek = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (!v) return;
    const next = Number(e.target.value);
    v.currentTime = next;
    setCurrentTime(next);
  }, []);

  const changeVolume = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (!v) return;
    const clamped = Math.max(0, Math.min(1, Number(e.target.value)));
    v.volume = clamped;
    v.muted = clamped === 0;
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (typeof document === 'undefined') return;
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    } else {
      void el.requestFullscreen().catch(() => undefined);
    }
  }, []);

  const loadUrl = useCallback(() => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    setSrc(trimmed);
    setTitle(trimmed.split('/').pop() || trimmed);
  }, [urlInput]);

  const pickSample = useCallback((sample: { title: string; src: string }) => {
    setSrc(sample.src);
    setTitle(sample.title);
  }, []);

  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const scrubMax = safeDuration > 0 ? safeDuration : 1;

  const iconBtn: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 30,
    height: 30,
    border: 'none',
    borderRadius: 6,
    background: 'transparent',
    color: '#eee',
    cursor: 'pointer',
  };
  const range: React.CSSProperties = {
    height: 4,
    cursor: 'pointer',
    accentColor: ACCENT,
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        background: '#101010',
        color: '#eee',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 13,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 10px',
          background: '#1c1c1c',
          borderBottom: `2px solid ${ACCENT}`,
        }}
      >
        <span style={{ fontSize: 16 }} aria-hidden="true">
          🎬
        </span>
        <strong style={{ color: ACCENT }}>VLC</strong>
        <span
          style={{
            marginLeft: 4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: '#bbb',
          }}
        >
          {title}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {SAMPLES.map((s) => (
            <button
              key={s.src}
              type="button"
              onClick={() => pickSample(s)}
              style={{
                border: `1px solid ${s.src === src ? ACCENT : '#444'}`,
                borderRadius: 6,
                background: s.src === src ? ACCENT : 'transparent',
                color: s.src === src ? '#101010' : '#ccc',
                fontSize: 11,
                padding: '3px 8px',
                cursor: 'pointer',
              }}
            >
              {s.title}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={wrapRef}
        style={{
          position: 'relative',
          flex: 1,
          minHeight: 0,
          background: '#000',
          display: 'flex',
        }}
      >
        {hasError ? (
          <div
            style={{
              margin: 'auto',
              textAlign: 'center',
              color: '#999',
              padding: 24,
            }}
          >
            <div style={{ fontSize: 40 }} aria-hidden="true">
              🎬
            </div>
            <p style={{ fontWeight: 600, color: '#ddd' }}>Could not load this video</p>
            <p style={{ fontSize: 12, maxWidth: 320 }}>
              Pick a built-in sample above or paste a direct, CORS-enabled video URL below.
            </p>
          </div>
        ) : (
          <video
            ref={videoRef}
            src={src}
            style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
            playsInline
            preload="metadata"
            onClick={togglePlay}
          />
        )}
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          padding: '8px 10px',
          background: '#1c1c1c',
        }}
      >
        <input
          type="range"
          min={0}
          max={scrubMax}
          step={0.01}
          value={Math.min(currentTime, scrubMax)}
          onChange={seek}
          aria-label="Seek"
          disabled={safeDuration === 0}
          style={{ ...range, width: '100%' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'} style={iconBtn}>
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <span style={{ fontVariantNumeric: 'tabular-nums', color: '#aaa', fontSize: 12 }}>
            <span style={{ color: '#eee' }}>{formatTime(currentTime)}</span>
            <span style={{ margin: '0 4px' }}>/</span>
            <span>{formatTime(safeDuration)}</span>
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            <button type="button" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'} style={iconBtn}>
              {muted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={muted ? 0 : volume}
              onChange={changeVolume}
              aria-label="Volume"
              style={{ ...range, width: 90 }}
            />
            <button type="button" onClick={toggleFullscreen} aria-label="Fullscreen" style={iconBtn}>
              <Maximize size={16} />
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') loadUrl();
            }}
            placeholder="Paste a direct video URL (.mp4) and press Load"
            spellCheck={false}
            style={{
              flex: 1,
              minWidth: 0,
              border: '1px solid #444',
              borderRadius: 6,
              background: '#101010',
              color: '#eee',
              fontSize: 12,
              padding: '5px 8px',
              outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={loadUrl}
            style={{
              border: 'none',
              borderRadius: 6,
              background: ACCENT,
              color: '#101010',
              fontWeight: 600,
              fontSize: 12,
              padding: '5px 14px',
              cursor: 'pointer',
            }}
          >
            Load
          </button>
        </div>
      </div>
    </div>
  );
}

export const vlcApp: AppDefinition = {
  id: 'vlc',
  title: 'Video',
  icon: '🎬',
  category: 'Accessories',
  component: VlcApp,
  description: 'VLC-style video player',
  defaultSize: { width: 640, height: 480 },
  minSize: { width: 380, height: 320 },
  desktop: false,
  launchCommands: ['vlc', 'video', 'mpv'],
};

export default VlcApp;
