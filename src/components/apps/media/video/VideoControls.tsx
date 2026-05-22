'use client';

import { Maximize, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import type { ChangeEvent } from 'react';

export interface VideoControlsProps {
  playing: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  onTogglePlay: () => void;
  onSeek: (next: number) => void;
  onVolume: (next: number) => void;
  onToggleMute: () => void;
  onFullscreen: () => void;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function VideoControls({
  playing,
  currentTime,
  duration,
  volume,
  muted,
  onTogglePlay,
  onSeek,
  onVolume,
  onToggleMute,
  onFullscreen,
}: VideoControlsProps) {
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const scrubMax = safeDuration > 0 ? safeDuration : 1;
  const scrubValue = Math.min(currentTime, scrubMax);

  const handleScrub = (e: ChangeEvent<HTMLInputElement>) => {
    onSeek(Number(e.target.value));
  };

  const handleVolume = (e: ChangeEvent<HTMLInputElement>) => {
    onVolume(Number(e.target.value));
  };

  return (
    <div
      className="pointer-events-auto flex w-full flex-col gap-2 bg-elevated/80 px-4 py-3 text-fg backdrop-blur"
      role="group"
      aria-label="Video controls"
    >
      <input
        type="range"
        min={0}
        max={scrubMax}
        step={0.01}
        value={scrubValue}
        onChange={handleScrub}
        aria-label="Seek"
        className="h-1 w-full cursor-pointer appearance-none rounded-full bg-border accent-accent"
        style={{ touchAction: 'none' }}
        disabled={safeDuration === 0}
      />
      <div className="flex items-center gap-3 text-xs">
        <button
          type="button"
          onClick={onTogglePlay}
          aria-label={playing ? 'Pause' : 'Play'}
          className="flex h-8 w-8 items-center justify-center rounded-md hover:text-accent"
        >
          {playing ? <Pause size={16} /> : <Play size={16} />}
        </button>

        <span className="font-mono tabular-nums text-muted">
          <span className="text-fg">{formatTime(currentTime)}</span>
          <span className="mx-1">/</span>
          <span>{formatTime(safeDuration)}</span>
        </span>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? 'Unmute' : 'Mute'}
            className="flex h-8 w-8 items-center justify-center rounded-md hover:text-accent"
          >
            {muted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={muted ? 0 : volume}
            onChange={handleVolume}
            aria-label="Volume"
            className="h-1 w-24 cursor-pointer appearance-none rounded-full bg-border accent-accent"
            style={{ touchAction: 'none' }}
          />
          <button
            type="button"
            onClick={onFullscreen}
            aria-label="Enter fullscreen"
            className="flex h-8 w-8 items-center justify-center rounded-md hover:text-accent"
          >
            <Maximize size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
