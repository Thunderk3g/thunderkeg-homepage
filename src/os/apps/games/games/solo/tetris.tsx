'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameDefinition, GameProps } from '../../../../types';

const COLS = 10;
const ROWS = 20;
const CELL = 22;

type Cell = number; // 0 = empty, 1..7 = piece colour index
type Board = Cell[][];
type Shape = number[][]; // matrix of 0/1

interface Piece {
  shape: Shape;
  color: Cell;
  x: number;
  y: number;
}

const COLORS = ['', '#36cfd1', '#4f7cff', '#ff9f43', '#ffe14d', '#3ddc84', '#b86bff', '#ff5d6c'];

const SHAPES: Shape[] = [
  [[1, 1, 1, 1]], // I -> 1
  [[1, 0, 0], [1, 1, 1]], // J -> 2
  [[0, 0, 1], [1, 1, 1]], // L -> 3
  [[1, 1], [1, 1]], // O -> 4
  [[0, 1, 1], [1, 1, 0]], // S -> 5
  [[0, 1, 0], [1, 1, 1]], // T -> 6
  [[1, 1, 0], [0, 1, 1]], // Z -> 7
];

const emptyBoard = (): Board => Array.from({ length: ROWS }, () => Array<Cell>(COLS).fill(0));

const rotate = (s: Shape): Shape => {
  const h = s.length;
  const w = s[0].length;
  const out: Shape = Array.from({ length: w }, () => Array<number>(h).fill(0));
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) out[c][h - 1 - r] = s[r][c];
  return out;
};

const collides = (board: Board, p: Piece): boolean => {
  for (let r = 0; r < p.shape.length; r++) {
    for (let c = 0; c < p.shape[r].length; c++) {
      if (!p.shape[r][c]) continue;
      const x = p.x + c;
      const y = p.y + r;
      if (x < 0 || x >= COLS || y >= ROWS) return true;
      if (y >= 0 && board[y][x]) return true;
    }
  }
  return false;
};

function Tetris({ onScore }: GameProps) {
  const [board, setBoard] = useState<Board>(emptyBoard);
  const [piece, setPiece] = useState<Piece | null>(null);
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [over, setOver] = useState(false);

  const boardRef = useRef(board);
  boardRef.current = board;
  const pieceRef = useRef(piece);
  pieceRef.current = piece;
  const overRef = useRef(over);
  overRef.current = over;
  const scoreRef = useRef(score);
  scoreRef.current = score;

  const level = Math.floor(lines / 10) + 1;
  const spawn = useCallback((b: Board): Piece | null => {
    const i = Math.floor(Math.random() * SHAPES.length);
    const shape = SHAPES[i];
    const p: Piece = { shape, color: i + 1, x: Math.floor((COLS - shape[0].length) / 2), y: -1 };
    return collides(b, p) ? null : p;
  }, []);

  const merge = useCallback(
    (b: Board, p: Piece): Board => {
      const nb = b.map((row) => row.slice());
      for (let r = 0; r < p.shape.length; r++)
        for (let c = 0; c < p.shape[r].length; c++)
          if (p.shape[r][c] && p.y + r >= 0) nb[p.y + r][p.x + c] = p.color;
      return nb;
    },
    [],
  );

  const lockPiece = useCallback(
    (p: Piece) => {
      const merged = merge(boardRef.current, p);
      const remaining = merged.filter((row) => row.some((c) => c === 0));
      const cleared = ROWS - remaining.length;
      while (remaining.length < ROWS) remaining.unshift(Array<Cell>(COLS).fill(0));
      const gained = [0, 100, 300, 500, 800][cleared] * level;
      if (cleared > 0) {
        setScore((s) => s + gained);
        setLines((l) => l + cleared);
      }
      const next = spawn(remaining);
      setBoard(remaining);
      if (!next) {
        setOver(true);
        setPiece(null);
        onScore?.(scoreRef.current + gained);
      } else {
        setPiece(next);
      }
    },
    [merge, spawn, level, onScore],
  );

  const step = useCallback(() => {
    const p = pieceRef.current;
    if (!p || overRef.current) return;
    const moved = { ...p, y: p.y + 1 };
    if (collides(boardRef.current, moved)) lockPiece(p);
    else setPiece(moved);
  }, [lockPiece]);

  const move = useCallback((dx: number) => {
    const p = pieceRef.current;
    if (!p || overRef.current) return;
    const moved = { ...p, x: p.x + dx };
    if (!collides(boardRef.current, moved)) setPiece(moved);
  }, []);

  const turn = useCallback(() => {
    const p = pieceRef.current;
    if (!p || overRef.current) return;
    const rotated: Piece = { ...p, shape: rotate(p.shape) };
    for (const kick of [0, -1, 1, -2, 2]) {
      const test = { ...rotated, x: rotated.x + kick };
      if (!collides(boardRef.current, test)) {
        setPiece(test);
        return;
      }
    }
  }, []);

  // initial spawn
  useEffect(() => {
    setPiece(spawn(emptyBoard()));
  }, [spawn]);

  // gravity tick — speeds up with level
  useEffect(() => {
    if (over) return;
    const speed = Math.max(90, 600 - (level - 1) * 55);
    const t = setInterval(step, speed);
    return () => clearInterval(t);
  }, [over, level, step]);

  // keyboard controls
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (overRef.current) return;
      if (e.key === 'ArrowLeft') move(-1);
      else if (e.key === 'ArrowRight') move(1);
      else if (e.key === 'ArrowDown') step();
      else if (e.key === 'ArrowUp') turn();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [move, step, turn]);

  const restart = () => {
    const b = emptyBoard();
    setBoard(b);
    setScore(0);
    setLines(0);
    setOver(false);
    setPiece(spawn(b));
  };

  // render board + active piece overlay
  const view = board.map((row) => row.slice());
  if (piece)
    for (let r = 0; r < piece.shape.length; r++)
      for (let c = 0; c < piece.shape[r].length; c++)
        if (piece.shape[r][c] && piece.y + r >= 0) view[piece.y + r][piece.x + c] = piece.color;

  return (
    <div className="kos-game" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div className="kos-game-hud">
        <span>Score: {score}</span>
        <span>Lines: {lines}</span>
        <span>Level: {level}</span>
        {over && (
          <button className="kos-game-btn" onClick={restart}>
            Restart
          </button>
        )}
        <span className="kos-game-hint">← → move · ↑ rotate · ↓ drop</span>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${COLS}, ${CELL}px)`,
          gridTemplateRows: `repeat(${ROWS}, ${CELL}px)`,
          gap: 1,
          padding: 6,
          background: '#0b0f14',
          border: '1px solid #1d2733',
          borderRadius: 6,
          boxShadow: 'inset 0 0 24px rgba(0,0,0,0.6)',
        }}
      >
        {view.flatMap((row, y) =>
          row.map((cell, x) => (
            <div
              key={`${x}-${y}`}
              style={{
                width: CELL,
                height: CELL,
                borderRadius: 3,
                background: cell ? COLORS[cell] : 'rgba(255,255,255,0.03)',
                boxShadow: cell ? 'inset 0 0 0 1px rgba(255,255,255,0.25)' : 'none',
              }}
            />
          )),
        )}
      </div>
      {over && <div className="kos-game-over">Game Over — score {score}</div>}
    </div>
  );
}

export const tetrisGame: GameDefinition = {
  id: 'tetris',
  name: 'Tetris',
  icon: '🟦',
  tagline: 'Stack the blocks, clear the lines.',
  kind: 'solo',
  tags: ['arcade', 'classic', 'puzzle'],
  component: Tetris,
  weight: 95,
};
