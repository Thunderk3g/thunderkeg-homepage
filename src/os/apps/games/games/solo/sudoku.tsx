'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { GameDefinition, GameProps } from '../../../../types';

// One fixed valid puzzle (0 = empty) and its unique solution.
const PUZZLE: readonly number[] = [
  5, 3, 0, 0, 7, 0, 0, 0, 0,
  6, 0, 0, 1, 9, 5, 0, 0, 0,
  0, 9, 8, 0, 0, 0, 0, 6, 0,
  8, 0, 0, 0, 6, 0, 0, 0, 3,
  4, 0, 0, 8, 0, 3, 0, 0, 1,
  7, 0, 0, 0, 2, 0, 0, 0, 6,
  0, 6, 0, 0, 0, 0, 2, 8, 0,
  0, 0, 0, 4, 1, 9, 0, 0, 5,
  0, 0, 0, 0, 8, 0, 0, 7, 9,
];

const SOLUTION: readonly number[] = [
  5, 3, 4, 6, 7, 8, 9, 1, 2,
  6, 7, 2, 1, 9, 5, 3, 4, 8,
  1, 9, 8, 3, 4, 2, 5, 6, 7,
  8, 5, 9, 7, 6, 1, 4, 2, 3,
  4, 2, 6, 8, 5, 3, 7, 9, 1,
  7, 1, 3, 9, 2, 4, 8, 5, 6,
  9, 6, 1, 5, 3, 7, 2, 8, 4,
  2, 8, 7, 4, 1, 9, 6, 3, 5,
  3, 4, 5, 2, 8, 6, 1, 7, 9,
];

const FIXED: readonly boolean[] = PUZZLE.map((v) => v !== 0);

type Conflicts = ReadonlySet<number>;

function findConflicts(board: readonly number[]): Conflicts {
  const bad = new Set<number>();
  const scan = (idxs: number[]) => {
    const seen = new Map<number, number>();
    for (const i of idxs) {
      const v = board[i];
      if (v === 0) continue;
      const prev = seen.get(v);
      if (prev !== undefined) {
        bad.add(prev);
        bad.add(i);
      } else {
        seen.set(v, i);
      }
    }
  };
  for (let r = 0; r < 9; r++) scan(Array.from({ length: 9 }, (_, c) => r * 9 + c));
  for (let c = 0; c < 9; c++) scan(Array.from({ length: 9 }, (_, r) => r * 9 + c));
  for (let br = 0; br < 3; br++) {
    for (let bc = 0; bc < 3; bc++) {
      const cells: number[] = [];
      for (let dr = 0; dr < 3; dr++)
        for (let dc = 0; dc < 3; dc++) cells.push((br * 3 + dr) * 9 + (bc * 3 + dc));
      scan(cells);
    }
  }
  return bad;
}

function Sudoku({ onScore }: GameProps) {
  const [board, setBoard] = useState<number[]>(() => [...PUZZLE]);
  const [selected, setSelected] = useState<number>(-1);
  const [won, setWon] = useState(false);
  const [moves, setMoves] = useState(0);

  const conflicts = useMemo(() => findConflicts(board), [board]);
  const filled = useMemo(() => board.filter((v) => v !== 0).length, [board]);

  const place = useCallback(
    (idx: number, value: number) => {
      if (won || idx < 0 || FIXED[idx]) return;
      setBoard((prev) => {
        if (prev[idx] === value) return prev;
        const next = [...prev];
        next[idx] = value;
        return next;
      });
      setMoves((m) => m + 1);
    },
    [won],
  );

  // Win check: every cell filled and matches the solution.
  useEffect(() => {
    if (won) return;
    if (board.every((v, i) => v === SOLUTION[i])) {
      setWon(true);
      const score = Math.max(100, 1000 - moves * 5);
      onScore?.(score);
    }
  }, [board, won, moves, onScore]);

  // Keyboard: arrows to move selection, 1-9 to fill, 0/Backspace/Delete to clear.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (won) return;
      let sel = selected < 0 ? 40 : selected;
      let r = Math.floor(sel / 9);
      let c = sel % 9;
      if (e.key === 'ArrowUp') r = (r + 8) % 9;
      else if (e.key === 'ArrowDown') r = (r + 1) % 9;
      else if (e.key === 'ArrowLeft') c = (c + 8) % 9;
      else if (e.key === 'ArrowRight') c = (c + 1) % 9;
      else if (/^[1-9]$/.test(e.key)) {
        place(selected, Number(e.key));
        return;
      } else if (e.key === '0' || e.key === 'Backspace' || e.key === 'Delete') {
        place(selected, 0);
        return;
      } else {
        return;
      }
      e.preventDefault();
      sel = r * 9 + c;
      setSelected(sel);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, place, won]);

  const restart = () => {
    setBoard([...PUZZLE]);
    setSelected(-1);
    setWon(false);
    setMoves(0);
  };

  const selVal = selected >= 0 ? board[selected] : 0;
  const selRow = selected >= 0 ? Math.floor(selected / 9) : -1;
  const selCol = selected >= 0 ? selected % 9 : -1;

  return (
    <div className="kos-game" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: '#cde' }}>
      <div className="kos-game-hud" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <span>Filled: {filled}/81</span>
        <span>Moves: {moves}</span>
        <button className="kos-game-btn" onClick={restart}>New</button>
        <span className="kos-game-hint">Click a cell, type 1-9 (0 clears)</span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(9, 38px)',
          gridTemplateRows: 'repeat(9, 38px)',
          background: '#0a0e14',
          padding: 4,
          borderRadius: 6,
          boxShadow: '0 0 0 2px #2a3a4a',
        }}
      >
        {board.map((v, i) => {
          const r = Math.floor(i / 9);
          const c = i % 9;
          const isSel = i === selected;
          const isPeer = r === selRow || c === selCol ||
            (Math.floor(r / 3) === Math.floor(selRow / 3) && Math.floor(c / 3) === Math.floor(selCol / 3));
          const sameVal = selVal !== 0 && v === selVal;
          const bad = conflicts.has(i);
          const fixed = FIXED[i];
          let bg = '#121a24';
          if (isSel) bg = '#2d4f6b';
          else if (sameVal) bg = '#244055';
          else if (isPeer && selected >= 0) bg = '#18222e';
          if (bad) bg = '#5a1f24';
          return (
            <div
              key={i}
              onClick={() => setSelected(i)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
                fontWeight: fixed ? 700 : 400,
                cursor: fixed ? 'default' : 'pointer',
                color: bad ? '#ff8a8a' : fixed ? '#e8eef5' : '#7fd0ff',
                background: bg,
                borderRight: `${c % 3 === 2 && c !== 8 ? 2 : 1}px solid ${c % 3 === 2 && c !== 8 ? '#3a5a72' : '#1d2935'}`,
                borderBottom: `${r % 3 === 2 && r !== 8 ? 2 : 1}px solid ${r % 3 === 2 && r !== 8 ? '#3a5a72' : '#1d2935'}`,
                userSelect: 'none',
              }}
            >
              {v !== 0 ? v : ''}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button
            key={n}
            className="kos-game-btn"
            disabled={won || selected < 0 || FIXED[selected]}
            onClick={() => place(selected, n)}
            style={{ width: 34, height: 34, padding: 0, fontSize: 16 }}
          >
            {n}
          </button>
        ))}
        <button
          className="kos-game-btn"
          disabled={won || selected < 0 || FIXED[selected]}
          onClick={() => place(selected, 0)}
          style={{ height: 34, padding: '0 10px' }}
        >
          Erase
        </button>
      </div>

      {won && (
        <div className="kos-game-over">
          Solved in {moves} moves!
          <button className="kos-game-btn" onClick={restart} style={{ marginLeft: 12 }}>
            Play again
          </button>
        </div>
      )}
    </div>
  );
}

export const sudokuGame: GameDefinition = {
  id: 'sudoku',
  name: 'Sudoku',
  icon: '🔢',
  tagline: 'Fill the grid, no repeats in row, column or box.',
  kind: 'solo',
  tags: ['puzzle', 'logic', 'classic'],
  component: Sudoku,
  weight: 70,
};
