'use client';

import { useEffect, useState } from 'react';
import type { GameDefinition, GameProps } from '../../../../types';
import { useGameRoom } from '../../../../net/realtime';
import { RoomBar } from '../../RoomBar';

type Owner = 0 | 1;
interface Piece {
  owner: Owner;
  king: boolean;
}
type Square = Piece | null;

interface CheckersState {
  board: Square[]; // 64, index = row * 8 + col, row 0 = top
  turn: Owner;
  winner: Owner | null;
  /** if mid-multi-jump, the index the active piece must continue from */
  chain: number | null;
}

type Move = { type: 'move'; from: number; to: number } | { type: 'reset' };

const SIZE = 8;
const idx = (r: number, c: number): number => r * SIZE + c;
const rowOf = (i: number): number => Math.floor(i / SIZE);
const colOf = (i: number): number => i % SIZE;
const inBounds = (r: number, c: number): boolean => r >= 0 && r < SIZE && c >= 0 && c < SIZE;

function makeBoard(): Square[] {
  const b: Square[] = Array<Square>(64).fill(null);
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      if ((r + c) % 2 !== 1) continue; // only dark squares
      if (r < 3) b[idx(r, c)] = { owner: 1, king: false }; // black on top
      else if (r > 4) b[idx(r, c)] = { owner: 0, king: false }; // red on bottom
    }
  }
  return b;
}

const initial: CheckersState = { board: makeBoard(), turn: 0, winner: null, chain: null };

/** Forward row deltas a piece may step toward (red moves up, black moves down). */
function dirsFor(p: Piece): number[] {
  if (p.king) return [-1, 1];
  return p.owner === 0 ? [-1] : [1];
}

interface Step {
  to: number;
  captured: number | null;
}

/** Legal single steps for the piece at `from` (simple moves + jumps). */
function stepsFor(board: Square[], from: number): Step[] {
  const p = board[from];
  if (!p) return [];
  const r = rowOf(from);
  const c = colOf(from);
  const out: Step[] = [];
  for (const dr of dirsFor(p)) {
    for (const dc of [-1, 1]) {
      const sr = r + dr;
      const sc = c + dc;
      if (!inBounds(sr, sc)) continue;
      const si = idx(sr, sc);
      const occ = board[si];
      if (!occ) {
        out.push({ to: si, captured: null });
        continue;
      }
      if (occ.owner === p.owner) continue;
      const jr = r + dr * 2;
      const jc = c + dc * 2;
      if (inBounds(jr, jc) && board[idx(jr, jc)] === null) {
        out.push({ to: idx(jr, jc), captured: si });
      }
    }
  }
  return out;
}

function hasAnyMove(board: Square[], owner: Owner): boolean {
  for (let i = 0; i < board.length; i += 1) {
    const p = board[i];
    if (p && p.owner === owner && stepsFor(board, i).length > 0) return true;
  }
  return false;
}

function applyStep(board: Square[], from: number, step: Step): Square[] {
  const next = board.slice();
  const p = next[from];
  if (!p) return next;
  next[from] = null;
  if (step.captured !== null) next[step.captured] = null;
  const becameKing = !p.king && (rowOf(step.to) === 0 || rowOf(step.to) === SIZE - 1);
  next[step.to] = { owner: p.owner, king: p.king || becameKing };
  return next;
}

function reduce(state: CheckersState, move: Move): CheckersState {
  if (move.type === 'reset') return initial;
  if (state.winner !== null) return state;
  const p = state.board[move.from];
  if (!p || p.owner !== state.turn) return state;
  if (state.chain !== null && state.chain !== move.from) return state;
  const step = stepsFor(state.board, move.from).find((s) => s.to === move.to);
  if (!step) return state;
  // Mid-chain, only further captures are legal.
  if (state.chain !== null && step.captured === null) return state;

  const board = applyStep(state.board, move.from, step);
  // A piece that just got crowned ends its turn even if more jumps exist.
  const justKinged = !p.king && (rowOf(move.to) === 0 || rowOf(move.to) === SIZE - 1);

  // Multi-jump: if a capture happened and another jump is available, keep turn.
  if (step.captured !== null && !justKinged) {
    const more = stepsFor(board, move.to).some((s) => s.captured !== null);
    if (more) return { board, turn: state.turn, winner: null, chain: move.to };
  }

  const next: Owner = state.turn === 0 ? 1 : 0;
  const opponentLost =
    board.every((sq) => sq === null || sq.owner !== next) || !hasAnyMove(board, next);
  return { board, turn: next, winner: opponentLost ? state.turn : null, chain: null };
}

const LABEL = ['Red', 'Black'];
const COLOR = ['#d94646', '#222'];
const RING = ['#ffb3b3', '#888'];

function Checkers({ room }: GameProps) {
  const { state, dispatch, reset, peers, mySeat, status } = useGameRoom<CheckersState, Move>({
    gameId: 'checkers',
    room: room ?? 'public',
    initialState: initial,
    reduce,
  });
  const [sel, setSel] = useState<number | null>(null);

  // During a forced multi-jump, keep the jumping piece selected.
  useEffect(() => {
    if (state.chain !== null) setSel(state.chain);
  }, [state.chain]);

  const solo = peers.length < 2;
  const myTurn = solo || (mySeat < 2 && state.turn === mySeat);
  const canPlay = state.winner === null && myTurn && mySeat < 2;
  const rawTargets = sel !== null ? stepsFor(state.board, sel) : [];
  const targets = state.chain !== null ? rawTargets.filter((s) => s.captured !== null) : rawTargets;

  const onSquare = (i: number) => {
    if (!canPlay) return;
    const piece = state.board[i];
    const tgt = targets.find((s) => s.to === i);
    if (tgt && sel !== null) {
      dispatch({ type: 'move', from: sel, to: i });
      setSel(null);
      return;
    }
    if (piece && piece.owner === state.turn && (state.chain === null || state.chain === i)) {
      setSel(i);
    } else {
      setSel(null);
    }
  };

  const statusText =
    state.winner !== null
      ? `${LABEL[state.winner]} wins!`
      : solo
        ? `Hot-seat — ${LABEL[state.turn]}'s turn (open another tab to play online)`
        : mySeat >= 2
          ? 'Spectating'
          : myTurn
            ? `Your move (${LABEL[mySeat]})`
            : `Waiting for ${LABEL[state.turn]}…`;

  return (
    <div className="kos-game" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <RoomBar room={room ?? 'public'} peers={peers} status={status} seats={['🔴', '⚫']} />
      <div className="kos-game-hint">{statusText}</div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${SIZE}, 40px)`,
          gridTemplateRows: `repeat(${SIZE}, 40px)`,
          border: '3px solid #3a2a1a',
          boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
        }}
      >
        {state.board.map((sq, i) => {
          const dark = (rowOf(i) + colOf(i)) % 2 === 1;
          const isSel = sel === i;
          const isTarget = targets.some((s) => s.to === i);
          return (
            <div
              key={i}
              onClick={() => onSquare(i)}
              style={{
                width: 40,
                height: 40,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: isSel ? '#6b8e23' : dark ? '#7a5230' : '#e8d2a6',
                cursor: canPlay && (isTarget || (sq && sq.owner === state.turn)) ? 'pointer' : 'default',
                boxShadow: isTarget ? 'inset 0 0 0 3px #4caf50' : undefined,
              }}
            >
              {sq && (
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: COLOR[sq.owner],
                    border: `2px solid ${RING[sq.owner]}`,
                    boxShadow: 'inset 0 -3px 5px rgba(0,0,0,0.45)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffd700',
                    fontSize: 16,
                    fontWeight: 700,
                  }}
                >
                  {sq.king ? '♛' : ''}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {state.winner !== null && (
        <div className="kos-game-over" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div>{statusText}</div>
          <button
            className="kos-game-btn"
            onClick={() => {
              setSel(null);
              if (solo) reset();
              else dispatch({ type: 'reset' });
            }}
          >
            Play again
          </button>
        </div>
      )}
    </div>
  );
}

export const checkersGame: GameDefinition = {
  id: 'checkers',
  name: 'Checkers',
  icon: '🔴',
  tagline: 'Draughts on an 8×8 board — capture, king, and win live vs another player.',
  kind: 'multi',
  players: '2',
  tags: ['turn-based', 'classic'],
  component: Checkers,
  weight: 76,
};
