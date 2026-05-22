"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface UseAudioReturn {
  ref: React.RefObject<HTMLAudioElement>;
  playing: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  loop: boolean;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (seconds: number) => void;
  setVolume: (v: number) => void;
  toggleLoop: () => void;
}

/**
 * useAudio — wraps an HTMLAudioElement ref and exposes a small reactive API.
 * Attach the returned `ref` to a hidden <audio> element.
 */
export function useAudio(initialVolume = 0.7): UseAudioReturn {
  const ref = useRef<HTMLAudioElement>(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(initialVolume);
  const [loop, setLoop] = useState(false);

  // Sync DOM <-> state via element events
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => setPlaying(false);
    const onTime = () => setCurrentTime(el.currentTime || 0);
    const onMeta = () => setDuration(Number.isFinite(el.duration) ? el.duration : 0);
    const onVol = () => setVolumeState(el.volume);

    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnded);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("durationchange", onMeta);
    el.addEventListener("volumechange", onVol);

    // Apply initial volume + loop in case the element was just mounted
    el.volume = initialVolume;
    el.loop = false;

    return () => {
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("durationchange", onMeta);
      el.removeEventListener("volumechange", onVol);
    };
  }, [initialVolume]);

  const play = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    void el.play().catch(() => {
      // Autoplay or user-gesture issues — surface as paused.
      setPlaying(false);
    });
  }, []);

  const pause = useCallback(() => {
    ref.current?.pause();
  }, []);

  const toggle = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    if (el.paused) {
      void el.play().catch(() => setPlaying(false));
    } else {
      el.pause();
    }
  }, []);

  const seek = useCallback((seconds: number) => {
    const el = ref.current;
    if (!el) return;
    const max = Number.isFinite(el.duration) ? el.duration : seconds;
    const clamped = Math.max(0, Math.min(seconds, max));
    el.currentTime = clamped;
    setCurrentTime(clamped);
  }, []);

  const setVolume = useCallback((v: number) => {
    const el = ref.current;
    const clamped = Math.max(0, Math.min(1, v));
    if (el) el.volume = clamped;
    setVolumeState(clamped);
  }, []);

  const toggleLoop = useCallback(() => {
    setLoop((prev) => {
      const next = !prev;
      if (ref.current) ref.current.loop = next;
      return next;
    });
  }, []);

  return {
    ref,
    playing,
    currentTime,
    duration,
    volume,
    loop,
    play,
    pause,
    toggle,
    seek,
    setVolume,
    toggleLoop,
  };
}
