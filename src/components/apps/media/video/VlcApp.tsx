'use client';

import { Film } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import VideoControls from './VideoControls';

// Single curated demo clip. Metadata mirrors the original portfolio's
// "Kali Linux Tutorial" entry (8acffbd). Poster image is the original thumb.
const VIDEO_SRC = '/videos/sample1.mp4';
const VIDEO_POSTER = '/images/video-thumb1.jpg';
const VIDEO_TITLE = 'Kali Linux Tutorial';

export default function VlcApp() {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Sync DOM events back into React state.
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

  // Pause when the tab/window loses visibility.
  useEffect(() => {
    const onVisibility = () => {
      const v = videoRef.current;
      if (!v) return;
      if (document.visibilityState !== 'visible' && !v.paused) {
        v.pause();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const handleTogglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      void v.play().catch(() => setHasError(true));
    } else {
      v.pause();
    }
  }, []);

  const handleSeek = useCallback((next: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = next;
    setCurrentTime(next);
  }, []);

  const handleVolume = useCallback((next: number) => {
    const v = videoRef.current;
    if (!v) return;
    const clamped = Math.max(0, Math.min(1, next));
    v.volume = clamped;
    if (clamped === 0) {
      v.muted = true;
    } else if (v.muted) {
      v.muted = false;
    }
  }, []);

  const handleToggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
  }, []);

  const handleFullscreen = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    const fsEl = document.fullscreenElement;
    if (fsEl) {
      void document.exitFullscreen().catch(() => undefined);
    } else {
      // Fullscreen is requested on the <video> element itself, not a wrapper.
      void v.requestFullscreen().catch(() => undefined);
    }
  }, []);

  if (hasError) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-surface p-6 text-center text-fg">
        <Film size={48} className="text-muted" aria-hidden="true" />
        <p className="text-sm font-medium">No demo clip configured</p>
        <p className="max-w-sm text-xs text-muted">
          Drop a short <code className="font-mono text-fg">.mp4</code> into{' '}
          <code className="font-mono text-fg">public/videos/</code> and wire it up in{' '}
          <code className="font-mono text-fg">VlcApp.tsx</code>.
        </p>
      </div>
    );
  }

  return (
    <div className="relative flex h-full w-full flex-col bg-black">
      <div className="absolute left-3 top-3 z-10 rounded bg-elevated/80 px-2 py-1 font-mono text-xs text-fg backdrop-blur">
        {VIDEO_TITLE}
      </div>
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          src={VIDEO_SRC}
          poster={VIDEO_POSTER}
          className="h-full w-full bg-black object-contain"
          playsInline
          preload="metadata"
          onClick={handleTogglePlay}
        />
      </div>
      <VideoControls
        playing={playing}
        currentTime={currentTime}
        duration={duration}
        volume={volume}
        muted={muted}
        onTogglePlay={handleTogglePlay}
        onSeek={handleSeek}
        onVolume={handleVolume}
        onToggleMute={handleToggleMute}
        onFullscreen={handleFullscreen}
      />
    </div>
  );
}
