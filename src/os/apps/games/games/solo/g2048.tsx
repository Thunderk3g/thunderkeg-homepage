'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameDefinition, GameProps } from '../../../../types';

const SIZE = 4;
type Grid = number[][];
type Dir = 'up' | 'down' | 'left' | 'right';

const TILE_COLORS: Record<number, { bg: string; fg: string }> = {
  0: { bg: '#1d2330', fg: '#1d2330' },
  2: { bg: '#3a4256', fg: '#e8edf7' },
  4: { bg: '#46506a', fg: '#e8edf7' },
  8: { bg: '#5b6f3a', fg: '#f3f7e8' },
  16: { bg: '#6f7d2c', fg: '#f3f7e8' },
  32: { bg: '#8a7b22', fg: '#fbf6e3' },
  64: { bg: '#a86a1f', fg: '#fbf0e3' },
  128: { bg: '#c25a36', fg: '#fdeee6' },
  256: { bg: '#cf4949', fg: '#fdeaea' },
  512: { bg: '#b23c8a', fg: '#fbe9f5' },
  1024: { bg: '#7b46c2', fg: '#efe9fb' },
  2048: { bg: '#3a8acf', fg: '#e6f2fd' },
};

function emptyGrid(): Grid {
  return Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => 0));
}

function clone(g: Grid): Grid {
  return g.map((row) => row.slice());
}

function spawn(g: Grid): Grid {
  const free: Array<[number, number]> = [];
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      if (g[r][c] === 0) free.push([r, c]);
    }
  }
  if (free.length === 0) return g;
  const [r, c] = free[Math.floor(Math.random() * free.length)];
  const next = clone(g);
  next[r][c] = Math.random() < 0.9 ? 2 : 4;
  return next;
}

/** Slide + merge a single row to the left; returns the new row and points gained. */
function collapse(row: number[]): { row: number[]; gained: number } {
  const filled = row.filter((v) => v !== 0);
  const merged: number[] = [];
  let gained = 0;
  for (let i = 0; i < filled.length; i += 1) {
    if (i + 1 < filled.length && filled[i] === filled[i + 1]) {
      const sum = filled[i] * 2;
      merged.push(sum);
      gained += sum;
      i += 1;
    } else {
      merged.push(filled[i]);
    }
  }
  while (merged.length < SIZE) merged.push(0);
  return { row: merged, gained };
}

function rotateCW(g: Grid): Grid {
  const next = emptyGrid();
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      next[c][SIZE - 1 - r] = g[r][c];
    }
  }
  return next;
}

function rotateCCW(g: Grid): Grid {
  const next = emptyGrid();
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      next[SIZE - 1 - c][r] = g[r][c];
    }
  }
  return next;
}

function move(g: Grid, dir: Dir): { grid: Grid; gained: number; moved: boolean } {
  let work = g;
  if (dir === 'up') work = rotateCCW(g);
  else if (dir === 'down') work = rotateCW(g);
  else if (dir === 'right') work = work.map((row) => row.slice().reverse());

  let gained = 0;
  const collapsed = work.map((row) => {
    const res = collapse(row);
    gained += res.gained;
    return res.row;
  });

  let result = collapsed;
  if (dir === 'up') result = rotateCW(collapsed);
  else if (dir === 'down') result = rotateCCW(collapsed);
  else if (dir === 'right') result = collapsed.map((row) => row.slice().reverse());

  const moved = JSON.stringify(result) !== JSON.stringify(g);
  return { grid: result, gained, moved };
}

function hasMoves(g: Grid): boolean {
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      if (g[r][c] === 0) return true;
      if (c + 1 < SIZE && g[r][c] === g[r][c + 1]) return true;
      if (r + 1 < SIZE && g[r][c] === g[r + 1][c]) return true;
    }
  }
  return false;
}

const KEY_DIRS: Record<string, Dir> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

function Game2048({ onScore }: GameProps) {
  const [grid, setGrid] = useState<Grid>(() => spawn(spawn(emptyGrid())));
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);
  const won = grid.some((row) => row.some((v) => v >= 2048));
  const overRef = useRef(over);
  overRef.current = over;

  const apply = useCallback(
    (dir: Dir) => {
      if (overRef.current) return;
      setGrid((prev) => {
        const { grid: next, gained, moved } = move(prev, dir);
        if (!moved) return prev;
        const spawned = spawn(next);
        if (gained > 0) setScore((s) => s + gained);
        if (!hasMoves(spawned)) {
          setOver(true);
          overRef.current = true;
          setScore((s) => {
            onScore?.(s);
            return s;
          });
        }
        return spawned;
      });
    },
    [onScore],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const dir = KEY_DIRS[e.key];
      if (!dir) return;
      e.preventDefault();
      apply(dir);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [apply]);

  const restart = () => {
    setGrid(spawn(spawn(emptyGrid())));
    setScore(0);
    setOver(false);
    overRef.current = false;
  };

  return (
    <div className="kos-game" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div className="kos-game-hud">
        <span>Score: {score}</span>
        <button className="kos-game-btn" onClick={restart}>
          New Game
        </button>
        <span className="kos-game-hint">Arrow keys to slide</span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${SIZE}, 84px)`,
          gridTemplateRows: `repeat(${SIZE}, 84px)`,
          gap: 10,
          padding: 12,
          background: '#10141d',
          borderRadius: 12,
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.05)',
        }}
      >
        {grid.flatMap((row, r) =>
          row.map((value, c) => {
            const color = TILE_COLORS[value] ?? { bg: '#2b8fce', fg: '#eef6fd' };
            return (
              <div
                key={`${r}-${c}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 8,
                  background: color.bg,
                  color: color.fg,
                  fontSize: value >= 1024 ? 26 : value >= 128 ? 30 : 34,
                  fontWeight: 700,
                  fontFamily: 'system-ui, sans-serif',
                  transition: 'background 120ms ease, color 120ms ease',
                  userSelect: 'none',
                }}
              >
                {value !== 0 ? value : ''}
              </div>
            );
          }),
        )}
      </div>

      {won && !over && <div className="kos-game-hint">2048 reached — keep going!</div>}
      {over && <div className="kos-game-over">Game Over — score {score}</div>}
    </div>
  );
}

export const g2048Game: GameDefinition = {
  id: '2048',
  name: '2048',
  icon: '🔢',
  tagline: 'Slide and merge tiles to reach 2048.',
  kind: 'solo',
  tags: ['puzzle', 'classic'],
  component: Game2048,
  weight: 85,
};
