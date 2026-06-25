'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GameDefinition, GameProps } from '../../../../types';

const SIZE = 9;
const MINES = 10;
const TOTAL = SIZE * SIZE;
const SAFE = TOTAL - MINES;

interface Cell {
  mine: boolean;
  adj: number;
  revealed: boolean;
  flagged: boolean;
}

const NUM_COLORS = ['', '#4aa3ff', '#3ec46d', '#ff7a6c', '#b07aff', '#ffb454', '#3ec4c4', '#d0d0d0', '#9a9a9a'];

function neighbors(i: number): number[] {
  const r = Math.floor(i / SIZE);
  const c = i % SIZE;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE) out.push(nr * SIZE + nc);
    }
  }
  return out;
}

function emptyBoard(): Cell[] {
  return Array.from({ length: TOTAL }, () => ({ mine: false, adj: 0, revealed: false, flagged: false }));
}

/** Build a fresh board with mines placed everywhere except `safeIndex` and its neighbors. */
function buildBoard(safeIndex: number): Cell[] {
  const board = emptyBoard();
  const forbidden = new Set<number>([safeIndex, ...neighbors(safeIndex)]);
  let placed = 0;
  while (placed < MINES) {
    const idx = Math.floor(Math.random() * TOTAL);
    if (forbidden.has(idx) || board[idx].mine) continue;
    board[idx].mine = true;
    placed++;
  }
  for (let i = 0; i < TOTAL; i++) {
    if (board[i].mine) continue;
    board[i].adj = neighbors(i).filter((n) => board[n].mine).length;
  }
  return board;
}

type Status = 'idle' | 'playing' | 'won' | 'lost';

function Minesweeper({ onScore }: GameProps) {
  const [board, setBoard] = useState<Cell[]>(emptyBoard);
  const [status, setStatus] = useState<Status>('idle');
  const [time, setTime] = useState(0);
  const startedRef = useRef(false);

  const flags = useMemo(() => board.filter((c) => c.flagged).length, [board]);
  const remaining = MINES - flags;

  useEffect(() => {
    if (status !== 'playing') return;
    const t = setInterval(() => setTime((s) => Math.min(s + 1, 999)), 1000);
    return () => clearInterval(t);
  }, [status]);

  const reveal = useCallback((idx: number) => {
    if (status === 'won' || status === 'lost') return;

    setBoard((prev) => {
      let work = prev;
      // First click: generate a board guaranteeing the clicked cell is empty.
      if (!startedRef.current) {
        startedRef.current = true;
        work = buildBoard(idx);
        setStatus('playing');
        setTime(0);
      }
      const cell = work[idx];
      if (cell.revealed || cell.flagged) return work;

      const next = work.map((c) => ({ ...c }));
      if (next[idx].mine) {
        next.forEach((c) => {
          if (c.mine) c.revealed = true;
        });
        setStatus('lost');
        onScore?.(0);
        return next;
      }

      // Flood fill across zero-adjacency cells.
      const stack = [idx];
      while (stack.length) {
        const cur = stack.pop() as number;
        const cc = next[cur];
        if (cc.revealed || cc.flagged || cc.mine) continue;
        cc.revealed = true;
        if (cc.adj === 0) neighbors(cur).forEach((n) => stack.push(n));
      }

      const revealedCount = next.filter((c) => c.revealed).length;
      if (revealedCount >= SAFE) {
        next.forEach((c) => {
          if (c.mine) c.flagged = true;
        });
        setStatus('won');
      }
      return next;
    });
  }, [status, onScore]);

  // Report a score once when the player wins (time-based: faster = higher).
  const wonReportedRef = useRef(false);
  useEffect(() => {
    if (status === 'won' && !wonReportedRef.current) {
      wonReportedRef.current = true;
      onScore?.(Math.max(50, 1000 - time * 5));
    }
  }, [status, time, onScore]);

  const toggleFlag = useCallback((e: React.MouseEvent, idx: number) => {
    e.preventDefault();
    if (status === 'won' || status === 'lost' || !startedRef.current) return;
    setBoard((prev) => {
      const cell = prev[idx];
      if (cell.revealed) return prev;
      const next = prev.map((c) => ({ ...c }));
      next[idx].flagged = !next[idx].flagged;
      return next;
    });
  }, [status]);

  const restart = useCallback(() => {
    startedRef.current = false;
    wonReportedRef.current = false;
    setBoard(emptyBoard());
    setStatus('idle');
    setTime(0);
  }, []);

  const over = status === 'won' || status === 'lost';

  return (
    <div className="kos-game" onContextMenu={(e) => e.preventDefault()}>
      <div className="kos-game-hud">
        <span>💣 {remaining}</span>
        <span>⏱ {time}</span>
        <button className="kos-game-btn" onClick={restart}>{over ? 'Restart' : 'New'}</button>
        <span className="kos-game-hint">Left-click reveal · Right-click flag</span>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${SIZE}, 34px)`,
          gridTemplateRows: `repeat(${SIZE}, 34px)`,
          gap: 3,
          padding: 8,
          background: 'rgba(0,0,0,0.25)',
          borderRadius: 8,
          userSelect: 'none',
        }}
      >
        {board.map((cell, i) => {
          const showMine = over && cell.mine && !cell.flagged;
          const exploded = status === 'lost' && cell.mine && cell.revealed;
          const base: React.CSSProperties = {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.95rem',
            fontWeight: 700,
            cursor: over ? 'default' : 'pointer',
            borderRadius: 4,
            border: '1px solid rgba(255,255,255,0.08)',
          };
          const style: React.CSSProperties = cell.revealed
            ? {
                ...base,
                background: exploded ? '#ff4d3d' : 'rgba(255,255,255,0.04)',
                color: NUM_COLORS[cell.adj] || '#d0d0d0',
                cursor: 'default',
              }
            : {
                ...base,
                background: 'rgba(255,255,255,0.12)',
                boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.05)',
              };
          return (
            <div
              key={i}
              role="button"
              tabIndex={-1}
              style={style}
              onClick={() => !over && reveal(i)}
              onContextMenu={(e) => toggleFlag(e, i)}
            >
              {cell.flagged ? '🚩' : cell.revealed ? (cell.mine ? '💣' : cell.adj > 0 ? cell.adj : '') : showMine ? '💣' : ''}
            </div>
          );
        })}
      </div>
      {status === 'won' && <div className="kos-game-over" style={{ color: '#3ec46d' }}>Swept clean in {time}s! 🎉</div>}
      {status === 'lost' && <div className="kos-game-over">Boom! You hit a mine.</div>}
    </div>
  );
}

export const minesweeperGame: GameDefinition = {
  id: 'minesweeper',
  name: 'Minesweeper',
  icon: '💣',
  tagline: 'Clear the field without detonating a mine.',
  kind: 'solo',
  tags: ['puzzle', 'classic'],
  component: Minesweeper,
  weight: 85,
};
