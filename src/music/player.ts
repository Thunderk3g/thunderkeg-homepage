'use client';

import { create } from 'zustand';
import type { Track } from './types';

/**
 * One <audio> element for the whole desktop, owned by this store rather than
 * by the Music window, so closing the window doesn't stop the music and the
 * panel's tray control can drive it. Created lazily on first play.
 */

const VOL_KEY = 'kos:music:volume';

interface PlayerState {
  queue: Track[];
  index: number;
  playing: boolean;
  loading: boolean;
  time: number;
  duration: number;
  volume: number;
  error?: string;

  /** replace the queue and start at `index` */
  playList: (tracks: Track[], index: number) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (seconds: number) => void;
  setVolume: (v: number) => void;
  stop: () => void;
}

let audio: HTMLAudioElement | null = null;
/** which of the current track's mirrors is loaded */
let srcIdx = 0;

function readVolume(): number {
  try {
    const v = Number(localStorage.getItem(VOL_KEY));
    return Number.isFinite(v) && v > 0 && v <= 1 ? v : 0.8;
  } catch {
    return 0.8;
  }
}

export const current = (s: Pick<PlayerState, 'queue' | 'index'>): Track | undefined => s.queue[s.index];

export const usePlayer = create<PlayerState>()((set, get) => {
  function el(): HTMLAudioElement {
    if (audio) return audio;
    const a = new Audio();
    a.preload = 'none';
    a.volume = get().volume;
    a.addEventListener('playing', () => set({ playing: true, loading: false, error: undefined }));
    a.addEventListener('pause', () => set({ playing: false }));
    a.addEventListener('waiting', () => set({ loading: true }));
    a.addEventListener('canplay', () => set({ loading: false }));
    a.addEventListener('timeupdate', () => set({ time: a.currentTime }));
    a.addEventListener('durationchange', () => set({ duration: Number.isFinite(a.duration) ? a.duration : 0 }));
    a.addEventListener('ended', () => get().next());
    a.addEventListener('error', () => {
      const t = current(get());
      if (!t || !a.getAttribute('src')) return;
      // radio mirrors: try the next one before giving up
      if (srcIdx + 1 < t.srcs.length) {
        srcIdx += 1;
        a.src = t.srcs[srcIdx];
        void a.play().catch(() => {});
        return;
      }
      set({ playing: false, loading: false, error: `Couldn't play “${t.title}” — the stream is unavailable.` });
    });
    audio = a;
    bindMediaSession();
    return a;
  }

  function load(index: number) {
    const { queue } = get();
    const t = queue[index];
    if (!t) return;
    const a = el();
    srcIdx = 0;
    set({ index, time: 0, duration: t.duration ?? 0, loading: true, error: undefined });
    a.src = t.srcs[0];
    a.play().catch((err: unknown) => {
      // autoplay refusal leaves the track loaded and paused; anything else surfaces via 'error'
      if (err instanceof DOMException && err.name === 'NotAllowedError') set({ loading: false, playing: false });
    });
    updateMetadata(t);
  }

  function bindMediaSession() {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    ms.setActionHandler('play', () => get().toggle());
    ms.setActionHandler('pause', () => get().toggle());
    ms.setActionHandler('nexttrack', () => get().next());
    ms.setActionHandler('previoustrack', () => get().prev());
  }

  return {
    queue: [],
    index: 0,
    playing: false,
    loading: false,
    time: 0,
    duration: 0,
    volume: typeof window === 'undefined' ? 0.8 : readVolume(),

    playList: (tracks, index) => {
      if (!tracks[index]) return;
      set({ queue: tracks });
      load(index);
    },

    toggle: () => {
      const a = audio;
      const t = current(get());
      if (!a || !t) return;
      if (a.paused) {
        // a live stream resumed after a pause should be live again, not minutes behind
        if (t.kind === 'radio') a.src = t.srcs[srcIdx];
        void a.play().catch(() => {});
      } else a.pause();
    },

    next: () => {
      const { index, queue } = get();
      if (queue.length) load((index + 1) % queue.length);
    },

    prev: () => {
      const { index, queue, time } = get();
      if (!queue.length) return;
      // like every player: early in a track, go back; later, restart it
      if (time > 4 && queue[index]?.kind === 'track' && audio) audio.currentTime = 0;
      else load((index - 1 + queue.length) % queue.length);
    },

    seek: (s) => {
      if (audio && current(get())?.kind === 'track') audio.currentTime = s;
    },

    setVolume: (v) => {
      const vol = Math.max(0, Math.min(1, v));
      if (audio) audio.volume = vol;
      set({ volume: vol });
      try {
        localStorage.setItem(VOL_KEY, String(vol));
      } catch {
        /* not remembered */
      }
    },

    stop: () => {
      if (audio) {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      }
      set({ queue: [], index: 0, playing: false, loading: false, time: 0, duration: 0, error: undefined });
    },
  };
});

function updateMetadata(t: Track) {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: t.title,
    artist: t.artist,
    artwork: t.art ? [{ src: t.art, sizes: '480x480' }] : [],
  });
}

export function fmtTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}
