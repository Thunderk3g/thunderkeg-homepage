"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useGame } from "@/game/store";

/**
 * Cache Match — a Redis-themed memory match game.
 *
 * Mechanics: a 4x4 grid (PAIRS = 8) of face-down "cache key" tiles. The player
 * flips two tiles per move. A match is a "cache hit" (tiles stay revealed); a
 * mismatch is a "cache miss" (tiles flip back after a short delay). The round is
 * won when every pair is matched.
 *
 * Scoring (recorded via setScore("cache-match", n)): a 0..1000 score that rewards
 * efficiency. Starts at 1000, then subtracts a penalty for extra moves beyond the
 * theoretical minimum (PAIRS moves) and a penalty for elapsed seconds. Clamped to
 * a floor of 50 so a win always banks something:
 *   score = clamp(1000 - (moves - PAIRS) * 30 - seconds * 2, 50, 1000)
 */

const PAIRS = 8; // 8 pairs -> 16 tiles -> 4x4 grid
const GRID_COLS = 4;
const FLIP_BACK_MS = 900;

interface CacheKey {
  /** unique pair identifier */
  id: string;
  /** the emoji/icon shown on the face */
  icon: string;
  /** the short redis-style key label */
  label: string;
}

interface CardTile {
  /** stable per-tile id (pair id + slot suffix) */
  tileId: string;
  /** which pair this tile belongs to */
  pairId: string;
  icon: string;
  label: string;
}

const CACHE_KEYS: readonly CacheKey[] = [
  { id: "user", icon: "🧑", label: "user:42" },
  { id: "session", icon: "🔑", label: "session:ab" },
  { id: "cart", icon: "🛒", label: "cart:7" },
  { id: "token", icon: "🎫", label: "token:x9" },
  { id: "feed", icon: "🔥", label: "feed:hot" },
  { id: "rate", icon: "⏱️", label: "rate:lim" },
  { id: "geo", icon: "📍", label: "geo:nyc" },
  { id: "lock", icon: "🔒", label: "lock:job" },
] as const;

/** Fisher–Yates shuffle producing a new array (no mutation of input). */
function shuffle<T>(input: readonly T[]): T[] {
  const arr = input.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

/** Build a freshly shuffled deck of 2 * PAIRS tiles. */
function buildDeck(): CardTile[] {
  const chosen = CACHE_KEYS.slice(0, PAIRS);
  const tiles: CardTile[] = [];
  for (const key of chosen) {
    tiles.push({
      tileId: `${key.id}-a`,
      pairId: key.id,
      icon: key.icon,
      label: key.label,
    });
    tiles.push({
      tileId: `${key.id}-b`,
      pairId: key.id,
      icon: key.icon,
      label: key.label,
    });
  }
  return shuffle(tiles);
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function CacheMatch() {
  const endMinigame = useGame((s) => s.endMinigame);
  const setScore = useGame((s) => s.setScore);

  const [deck, setDeck] = useState<CardTile[]>(() => buildDeck());
  // tileIds currently flipped face-up but not yet resolved (max 2)
  const [flipped, setFlipped] = useState<string[]>([]);
  // pairIds that have been matched (a cache hit)
  const [matched, setMatched] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  // becomes true once the player makes their first flip (starts the clock)
  const [started, setStarted] = useState(false);
  // true while two non-matching cards are showing and we wait to flip them back
  const [evaluating, setEvaluating] = useState(false);

  const flipBackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scoredRef = useRef(false);

  const won = matched.length === PAIRS;

  // --- timer: tick once per second while playing ---
  useEffect(() => {
    if (!started || won) return;
    const intervalId = setInterval(() => {
      setElapsed((e) => e + 1);
    }, 1000);
    return () => clearInterval(intervalId);
  }, [started, won]);

  // --- clean up any pending flip-back timer on unmount ---
  useEffect(() => {
    return () => {
      if (flipBackTimer.current !== null) {
        clearTimeout(flipBackTimer.current);
      }
    };
  }, []);

  const finalScore = useMemo(() => {
    const raw = 1000 - (moves - PAIRS) * 30 - elapsed * 2;
    return Math.max(50, Math.min(1000, Math.round(raw)));
  }, [moves, elapsed]);

  const hitRate = useMemo(() => {
    if (moves === 0) return 0;
    return Math.round((hits / moves) * 100);
  }, [hits, moves]);

  // --- record score once on win ---
  useEffect(() => {
    if (won && !scoredRef.current) {
      scoredRef.current = true;
      setScore("cache-match", finalScore);
    }
  }, [won, finalScore, setScore]);

  const handleFlip = useCallback(
    (tile: CardTile) => {
      // guard: don't allow a third flip while evaluating, re-flipping an
      // already up card, an already-matched card, or after the win.
      if (evaluating || won) return;
      if (matched.includes(tile.pairId)) return;
      if (flipped.includes(tile.tileId)) return;
      if (flipped.length >= 2) return;

      if (!started) setStarted(true);

      const nextFlipped = [...flipped, tile.tileId];
      setFlipped(nextFlipped);

      if (nextFlipped.length === 2) {
        setMoves((m) => m + 1);
        const [firstId, secondId] = nextFlipped;
        const first = deck.find((t) => t.tileId === firstId);
        const second = deck.find((t) => t.tileId === secondId);
        const isHit =
          first !== undefined &&
          second !== undefined &&
          first.pairId === second.pairId;

        if (isHit) {
          // cache hit: lock the pair in, clear the flipped buffer immediately
          setHits((h) => h + 1);
          setMatched((prev) => [...prev, first.pairId]);
          setFlipped([]);
        } else {
          // cache miss: show both briefly, then flip back
          setMisses((mi) => mi + 1);
          setEvaluating(true);
          flipBackTimer.current = setTimeout(() => {
            setFlipped([]);
            setEvaluating(false);
            flipBackTimer.current = null;
          }, FLIP_BACK_MS);
        }
      }
    },
    [evaluating, won, matched, flipped, started, deck]
  );

  const resetGame = useCallback(() => {
    if (flipBackTimer.current !== null) {
      clearTimeout(flipBackTimer.current);
      flipBackTimer.current = null;
    }
    scoredRef.current = false;
    setDeck(buildDeck());
    setFlipped([]);
    setMatched([]);
    setMoves(0);
    setHits(0);
    setMisses(0);
    setElapsed(0);
    setStarted(false);
    setEvaluating(false);
  }, []);

  return (
    <div className="cm-modal" role="dialog" aria-label="Cache Match game">
      <CacheMatchStyles />

      <button
        type="button"
        className="cm-close"
        aria-label="Close game"
        onClick={endMinigame}
      >
        ×
      </button>

      <header className="cm-header">
        <h2 className="cm-title">Cache Match</h2>
        <p className="cm-subtitle">Warm the cache — match every key.</p>
      </header>

      <div className="cm-stats" aria-live="polite">
        <span className="cm-stat cm-stat--hit">Hits {hits}</span>
        <span className="cm-stat cm-stat--miss">Misses {misses}</span>
        <span className="cm-stat">Moves {moves}</span>
        <span className="cm-stat">{formatTime(elapsed)}</span>
      </div>

      <div className="cm-board-wrap">
        <div
          className="cm-board"
          style={{ gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)` }}
        >
          {deck.map((tile) => {
            const isUp =
              flipped.includes(tile.tileId) || matched.includes(tile.pairId);
            const isMatched = matched.includes(tile.pairId);
            return (
              <button
                key={tile.tileId}
                type="button"
                className={`cm-card${isUp ? " is-up" : ""}${
                  isMatched ? " is-matched" : ""
                }`}
                aria-label={isUp ? tile.label : "Hidden cache key"}
                aria-pressed={isUp}
                disabled={isUp || evaluating || won}
                onClick={() => handleFlip(tile)}
              >
                <span className="cm-card-inner">
                  <span className="cm-face cm-face--back" aria-hidden="true">
                    <span className="cm-seal">RDS</span>
                  </span>
                  <span className="cm-face cm-face--front" aria-hidden="true">
                    <span className="cm-icon">{tile.icon}</span>
                    <span className="cm-key">{tile.label}</span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {won && (
          <div className="cm-result" role="alertdialog" aria-label="You won">
            <div className="cm-result-card">
              <span className="cm-result-spark">✨</span>
              <h3 className="cm-result-title">Cache warmed!</h3>
              <p className="cm-result-line">
                Hit rate <strong>{hitRate}%</strong> · Score{" "}
                <strong>{finalScore}</strong>
              </p>
              <p className="cm-result-line cm-result-sub">
                {moves} moves · {formatTime(elapsed)}
              </p>
              <div className="cm-result-btns">
                <button
                  type="button"
                  className="cm-btn cm-btn--primary"
                  onClick={resetGame}
                >
                  Play again
                </button>
                <button
                  type="button"
                  className="cm-btn"
                  onClick={endMinigame}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CacheMatchStyles() {
  return (
    <style>{`
      .cm-modal {
        position: relative;
        width: min(92vw, 520px);
        background: #f7f1e3;
        color: #4a3f35;
        border-radius: 18px;
        padding: 22px 22px 26px;
        box-shadow: 0 8px 24px rgba(74, 63, 53, .22);
        font-family: "Nunito", system-ui, sans-serif;
        border: 1px solid rgba(74, 63, 53, .12);
      }
      .cm-close {
        position: absolute;
        top: 12px;
        right: 14px;
        width: 32px;
        height: 32px;
        border: none;
        border-radius: 50%;
        background: rgba(74, 63, 53, .08);
        color: #4a3f35;
        font-size: 20px;
        line-height: 1;
        cursor: pointer;
        transition: transform .15s ease, background .15s ease;
      }
      .cm-close:hover { background: #c8745f; color: #f7f1e3; transform: scale(1.08); }
      .cm-header { text-align: center; margin: 2px 0 14px; }
      .cm-title {
        font-family: "Baloo 2", system-ui, sans-serif;
        font-size: 26px;
        margin: 0;
        color: #4a3f35;
        letter-spacing: .3px;
      }
      .cm-subtitle { margin: 2px 0 0; font-size: 13px; color: #8a7d6e; }
      .cm-stats {
        display: flex;
        justify-content: center;
        gap: 8px;
        flex-wrap: wrap;
        margin-bottom: 16px;
      }
      .cm-stat {
        font-family: "Baloo 2", system-ui, sans-serif;
        font-size: 13px;
        padding: 4px 12px;
        border-radius: 999px;
        background: #fff;
        box-shadow: 0 2px 6px rgba(74, 63, 53, .12);
      }
      .cm-stat--hit { background: #6fae6a; color: #fff; }
      .cm-stat--miss { background: #c8745f; color: #fff; }
      .cm-board-wrap { position: relative; }
      .cm-board {
        display: grid;
        gap: 10px;
      }
      .cm-card {
        position: relative;
        aspect-ratio: 1 / 1;
        border: none;
        background: transparent;
        padding: 0;
        cursor: pointer;
        perspective: 700px;
      }
      .cm-card:disabled { cursor: default; }
      .cm-card-inner {
        position: absolute;
        inset: 0;
        transition: transform .45s cubic-bezier(.4, .8, .3, 1.1);
        transform-style: preserve-3d;
      }
      .cm-card.is-up .cm-card-inner { transform: rotateY(180deg); }
      .cm-card:not(:disabled):hover .cm-card-inner { transform: scale(1.04); }
      .cm-card.is-up:not(:disabled):hover .cm-card-inner {
        transform: rotateY(180deg) scale(1.04);
      }
      .cm-face {
        position: absolute;
        inset: 0;
        border-radius: 12px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        backface-visibility: hidden;
        -webkit-backface-visibility: hidden;
        box-shadow: 0 4px 12px rgba(74, 63, 53, .18);
      }
      .cm-face--back {
        background:
          repeating-linear-gradient(45deg, #cdbce8 0 8px, #c3b1e2 8px 16px);
        border: 2px solid #fff;
      }
      .cm-seal {
        font-family: "Baloo 2", system-ui, sans-serif;
        font-size: 13px;
        font-weight: 700;
        color: #f7f1e3;
        background: #c8745f;
        border-radius: 50%;
        width: 38px;
        height: 38px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: inset 0 0 0 2px rgba(247, 241, 227, .5),
          0 2px 5px rgba(74, 63, 53, .3);
      }
      .cm-face--front {
        background: #bfe3f0;
        border: 2px solid #fff;
        transform: rotateY(180deg);
        gap: 4px;
      }
      .cm-icon { font-size: clamp(20px, 6vw, 30px); line-height: 1; }
      .cm-key {
        font-family: "Baloo 2", system-ui, sans-serif;
        font-size: clamp(9px, 2.6vw, 12px);
        color: #4a3f35;
        background: rgba(255, 255, 255, .6);
        padding: 1px 6px;
        border-radius: 6px;
      }
      .cm-card.is-matched .cm-face--front {
        background: #6fae6a;
        animation: cm-pop .4s ease;
      }
      .cm-card.is-matched .cm-key { color: #245a22; background: rgba(255,255,255,.75); }
      @keyframes cm-pop {
        0% { transform: rotateY(180deg) scale(1); }
        50% { transform: rotateY(180deg) scale(1.12); }
        100% { transform: rotateY(180deg) scale(1); }
      }
      .cm-result {
        position: absolute;
        inset: -10px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(247, 241, 227, .8);
        backdrop-filter: blur(3px);
        border-radius: 14px;
        animation: cm-fade .3s ease;
      }
      @keyframes cm-fade { from { opacity: 0; } to { opacity: 1; } }
      .cm-result-card {
        text-align: center;
        background: #fff;
        border-radius: 16px;
        padding: 24px 28px;
        box-shadow: 0 8px 24px rgba(74, 63, 53, .22);
        max-width: 320px;
      }
      .cm-result-spark { font-size: 34px; }
      .cm-result-title {
        font-family: "Baloo 2", system-ui, sans-serif;
        font-size: 24px;
        margin: 6px 0 8px;
        color: #6fae6a;
      }
      .cm-result-line { margin: 2px 0; font-size: 15px; color: #4a3f35; }
      .cm-result-sub { font-size: 13px; color: #8a7d6e; }
      .cm-result-btns {
        display: flex;
        gap: 10px;
        justify-content: center;
        margin-top: 16px;
      }
      .cm-btn {
        font-family: "Baloo 2", system-ui, sans-serif;
        font-size: 14px;
        padding: 9px 18px;
        border: none;
        border-radius: 12px;
        cursor: pointer;
        background: rgba(74, 63, 53, .08);
        color: #4a3f35;
        transition: transform .15s ease, box-shadow .15s ease;
      }
      .cm-btn:hover { transform: translateY(-2px); }
      .cm-btn--primary {
        background: #c8745f;
        color: #f7f1e3;
        box-shadow: 0 4px 12px rgba(200, 116, 95, .4);
      }
    `}</style>
  );
}
