"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Music,
  Pause,
  Play,
  Repeat,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useAudio } from "./useAudio";
import { Seeker } from "./Seeker";

interface Track {
  id: string;
  title: string;
  artist: string;
  src: string;
}

// Default playlist — track metadata carried over from the original portfolio's
// MP3 player (5e2b7ed / 8acffbd). The 5th track ("Binary Sunset") referenced a
// missing sample5.mp3 file, so it's dropped here.
const DEFAULT_PLAYLIST: Track[] = [
  { id: "t1", title: "Synth Voyage",     artist: "Pixel Collective", src: "/audio/sample1.mp3" },
  { id: "t2", title: "Neural Pathways",  artist: "Quantum Logic",    src: "/audio/sample2.mp3" },
  { id: "t3", title: "Encrypted Beats",  artist: "Code Artisans",    src: "/audio/sample3.mp3" },
  { id: "t4", title: "Command Sequence", artist: "Silicon Wave",     src: "/audio/sample4.mp3" },
];

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function Mp3App() {
  const playlist = DEFAULT_PLAYLIST;
  const [index, setIndex] = useState(0);
  const current = playlist[index] ?? playlist[0];

  const {
    ref,
    playing,
    currentTime,
    duration,
    volume,
    loop,
    toggle,
    seek,
    setVolume,
    toggleLoop,
  } = useAudio(0.7);

  const handlePrev = useCallback(() => {
    setIndex((i) => (i - 1 + playlist.length) % playlist.length);
  }, [playlist.length]);

  const handleNext = useCallback(() => {
    setIndex((i) => (i + 1) % playlist.length);
  }, [playlist.length]);

  const timeLabel = useMemo(
    () => `${formatTime(currentTime)} / ${formatTime(duration)}`,
    [currentTime, duration],
  );

  return (
    <div className="flex h-full w-full flex-col bg-surface text-fg">
      {/* HEADER: album art + title/artist */}
      <header className="flex flex-col items-center gap-3 border-b border-border px-4 py-5">
        <div
          className="flex h-[240px] w-[240px] items-center justify-center rounded-md bg-elevated"
          aria-hidden
        >
          <Music size={96} className="text-muted" />
        </div>
        <div className="text-center">
          <div className="font-sans text-base font-semibold text-fg">
            {current?.title ?? "Untitled"}
          </div>
          <div className="font-sans text-xs text-muted">
            {current?.artist ?? "Unknown artist"}
          </div>
        </div>
      </header>

      {/* MIDDLE: playlist */}
      <section className="min-h-0 flex-1 overflow-y-auto border-b border-border">
        <ul className="divide-y divide-border" role="listbox" aria-label="Playlist">
          {playlist.map((track, i) => {
            const active = i === index;
            return (
              <li key={track.id} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => setIndex(i)}
                  className={[
                    "flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm transition-colors",
                    active
                      ? "bg-elevated text-accent"
                      : "text-fg hover:bg-elevated/60",
                  ].join(" ")}
                >
                  <span className="flex items-center gap-2">
                    {active && playing ? (
                      <Pause size={14} className="text-accent" />
                    ) : (
                      <Play size={14} className={active ? "text-accent" : "text-muted"} />
                    )}
                    <span className="truncate">{track.title}</span>
                  </span>
                  <span className="truncate text-xs text-muted">{track.artist}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* BOTTOM: transport + seeker */}
      <footer className="flex flex-col gap-3 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          {/* Transport buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Previous track"
              className="rounded p-2 text-fg hover:bg-elevated focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <SkipBack size={18} />
            </button>
            <button
              type="button"
              onClick={toggle}
              aria-label={playing ? "Pause" : "Play"}
              className="rounded-full bg-elevated p-2 text-accent hover:bg-elevated/80 focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {playing ? <Pause size={20} /> : <Play size={20} />}
            </button>
            <button
              type="button"
              onClick={handleNext}
              aria-label="Next track"
              className="rounded p-2 text-fg hover:bg-elevated focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <SkipForward size={18} />
            </button>
            <button
              type="button"
              onClick={toggleLoop}
              aria-label={loop ? "Disable loop" : "Enable loop"}
              aria-pressed={loop}
              className={[
                "rounded p-2 hover:bg-elevated focus:outline-none focus:ring-2 focus:ring-accent",
                loop ? "text-accent" : "text-muted",
              ].join(" ")}
            >
              <Repeat size={18} />
            </button>
          </div>

          {/* Volume + time */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setVolume(volume > 0 ? 0 : 0.7)}
                aria-label={volume === 0 ? "Unmute" : "Mute"}
                className="rounded p-1 text-muted hover:text-fg focus:outline-none focus:ring-2 focus:ring-accent"
              >
                {volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                aria-label="Volume"
                className="h-1 w-24 cursor-pointer appearance-none bg-transparent accent-accent"
                style={{ touchAction: "none" }}
              />
            </div>
            <span className="min-w-[88px] text-right font-mono text-xs text-muted">
              {timeLabel}
            </span>
          </div>
        </div>

        {/* Seeker */}
        <Seeker
          value={currentTime}
          max={duration}
          onSeek={seek}
          disabled={duration <= 0}
        />
      </footer>

      {/* Hidden audio element — driven by useAudio's ref */}
      <audio
        ref={ref}
        src={current?.src}
        preload="metadata"
        className="hidden"
      />
    </div>
  );
}
