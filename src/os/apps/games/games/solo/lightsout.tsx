'use client';

import { useCallback, useEffect, useState } from 'react';
import type { GameDefinition, GameProps } from '../../../../types';

const N = 5;
const SIZE = N * N;

/** flip cell i and its orthogonal neighbours on an immutable board */
function toggle(board: boolean[], i: number): boolean[] {
  const next = board.slice();
  const x = i % N;
  const y = Math.floor(i / N);
  const flip = (cx: number, cy: number) => {
    if (cx < 0 || cy < 0 || cx >= N || cy >= N) return;
    const idx = cy * N + cx;
    next[idx] = !next[idx];
  };
  flip(x, y);
  flip(x - 1, y);
  flip(x + 1, y);
  flip(x, y - 1);
  flip(x, y + 1);
  return next;
}

/** scramble from an all-off board so the result is always solvable */
function scramble(): boolean[] {
  let board: boolean[] = Array.from({ length: SIZE }, () => false);
  const presses = 6 + Math.floor(Math.random() * 8);
  const seen = new Set<number>();
  for (let p = 0; p < presses; p++) {
    const i = Math.floor(Math.random() * SIZE);
    seen.add(i);
    board = toggle(board, i);
  }
  // guard against the (rare) all-off scramble
  if (board.every((c) => !c)) board = toggle(board, Math.floor(Math.random() * SIZE));
  return board;
}

function LightsOut({ onScore }: GameProps) {
  const [board, setBoard] = useState<boolean[]>(() => Array.from({ length: SIZE }, () => false));
  const [moves, setMoves] = useState(0);
  const [won, setWon] = useState(false);
  const [cursor, setCursor] = useState(0);

  const reset = useCallback(() => {
    setBoard(scramble());
    setMoves(0);
    setWon(false);
    setCursor(0);
  }, []);

  // initial scramble on mount (Math.random kept out of module top-level)
  useEffect(() => {
    reset();
  }, [reset]);

  const press = useCallback(
    (i: number) => {
      if (won) return;
      setBoard((prev) => {
        const next = toggle(prev, i);
        const cleared = next.every((c) => !c);
        if (cleared) {
          setWon(true);
          setMoves((m) => {
            const total = m + 1;
            // fewer moves = higher score; floor at 10
            onScore?.(Math.max(10, 600 - total * 20));
            return total;
          });
        } else {
          setMoves((m) => m + 1);
        }
        return next;
      });
    },
    [won, onScore],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setCursor((c) => (c - N + SIZE) % SIZE);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setCursor((c) => (c + N) % SIZE);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCursor((c) => (c % N === 0 ? c + N - 1 : c - 1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setCursor((c) => (c % N === N - 1 ? c - N + 1 : c + 1));
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        setCursor((c) => {
          press(c);
          return c;
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press]);

  const lit = board.reduce((acc, c) => acc + (c ? 1 : 0), 0);

  return (
    <div className="kos-game" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <div className="kos-game-hud">
        <span>Moves: {moves}</span>
        <span>Lit: {lit}</span>
        <button className="kos-game-btn" onClick={reset}>
          New Board
        </button>
        <span className="kos-game-hint">Click / arrows + space</span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${N}, 1fr)`,
          gap: 8,
          width: 360,
          height: 360,
          padding: 12,
          borderRadius: 14,
          background: '#0b0f1a',
          boxShadow: 'inset 0 0 0 1px rgba(120,160,255,0.18)',
        }}
        role="grid"
        aria-label="Lights Out board"
      >
        {board.map((on, i) => {
          const focused = i === cursor;
          return (
            <button
              key={i}
              type="button"
              role="gridcell"
              aria-pressed={on}
              onClick={() => {
                setCursor(i);
                press(i);
              }}
              disabled={won}
              style={{
                border: focused ? '2px solid #aee' : '2px solid transparent',
                borderRadius: 10,
                cursor: won ? 'default' : 'pointer',
                padding: 0,
                transition: 'background 120ms ease, box-shadow 120ms ease',
                background: on
                  ? 'radial-gradient(circle at 35% 30%, #ffe9a8, #ffb300 60%, #c97a00)'
                  : 'linear-gradient(160deg, #1b2440, #121a30)',
                boxShadow: on
                  ? '0 0 14px rgba(255,180,40,0.65), inset 0 0 6px rgba(255,240,200,0.6)'
                  : 'inset 0 0 0 1px rgba(120,160,255,0.12)',
              }}
            />
          );
        })}
      </div>

      {won && (
        <div className="kos-game-over">
          Solved in {moves} {moves === 1 ? 'move' : 'moves'}!
          <button className="kos-game-btn" onClick={reset} style={{ marginLeft: 12 }}>
            Restart
          </button>
        </div>
      )}
    </div>
  );
}

export const lightsoutGame: GameDefinition = {
  id: 'lightsout',
  name: 'Lights Out',
  icon: '💡',
  tagline: 'Switch every light off — neighbours flip too.',
  kind: 'solo',
  tags: ['puzzle', 'logic'],
  component: LightsOut,
  weight: 70,
};
