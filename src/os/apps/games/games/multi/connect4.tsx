'use client';

import type { GameDefinition, GameProps } from '../../../../types';
import { useGameRoom } from '../../../../net/realtime';
import { RoomBar } from '../../RoomBar';

type Cell = 0 | 1 | null;
const COLS = 7;
const ROWS = 6;

interface C4State {
  board: Cell[]; // length 42, index = row * COLS + col, row 0 = top
  turn: 0 | 1;
  winner: Cell | 'draw';
  wins: number[]; // indices of the winning line (for highlight)
}
type Move = { type: 'drop'; col: number } | { type: 'reset' };

const initial: C4State = {
  board: Array<Cell>(COLS * ROWS).fill(null),
  turn: 0,
  winner: null,
  wins: [],
};

const DIRS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], // horizontal
  [1, 0], // vertical
  [1, 1], // diagonal down-right
  [1, -1], // diagonal down-left
];

function idx(r: number, c: number): number {
  return r * COLS + c;
}

/** Returns the winning line of 4 indices for the disc at (r,c), or null. */
function winningLine(board: Cell[], r: number, c: number): number[] | null {
  const who = board[idx(r, c)];
  if (who === null) return null;
  for (const [dr, dc] of DIRS) {
    const line = [idx(r, c)];
    for (let s = 1; s < 4; s += 1) {
      const nr = r + dr * s;
      const nc = c + dc * s;
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) break;
      if (board[idx(nr, nc)] !== who) break;
      line.push(idx(nr, nc));
    }
    for (let s = 1; s < 4; s += 1) {
      const nr = r - dr * s;
      const nc = c - dc * s;
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) break;
      if (board[idx(nr, nc)] !== who) break;
      line.unshift(idx(nr, nc));
    }
    if (line.length >= 4) return line.slice(0, 4);
  }
  return null;
}

function reduce(state: C4State, move: Move): C4State {
  if (move.type === 'reset') return initial;
  if (state.winner !== null) return state;
  // Find lowest empty row in the chosen column.
  let landRow = -1;
  for (let r = ROWS - 1; r >= 0; r -= 1) {
    if (state.board[idx(r, move.col)] === null) {
      landRow = r;
      break;
    }
  }
  if (landRow < 0) return state; // column full
  const board = state.board.slice();
  board[idx(landRow, move.col)] = state.turn;
  const line = winningLine(board, landRow, move.col);
  const full = board.every((x) => x !== null);
  return {
    board,
    turn: state.turn === 0 ? 1 : 0,
    winner: line ? state.turn : full ? 'draw' : null,
    wins: line ?? [],
  };
}

const DISC = ['🔴', '🟡'];
const SEAT_COLOR = ['#e8474c', '#f4c531'];

function ConnectFour({ room }: GameProps) {
  const { state, dispatch, reset, peers, mySeat, status } = useGameRoom<C4State, Move>({
    gameId: 'connect4',
    room: room ?? 'public',
    initialState: initial,
    reduce,
  });

  const solo = peers.length < 2;
  const myTurn = solo || (mySeat < 2 && state.turn === mySeat);
  const canPlay = state.winner === null && myTurn && mySeat < 2;

  const colFull = (c: number) => state.board[idx(0, c)] !== null;

  const statusText =
    state.winner === 'draw'
      ? "It's a draw!"
      : state.winner !== null
        ? `${DISC[state.winner]} wins!`
        : solo
          ? `Hot-seat — ${DISC[state.turn]}'s turn (open another tab to play online)`
          : mySeat >= 2
            ? 'Spectating'
            : myTurn
              ? `Your move (${DISC[mySeat]})`
              : `Waiting for ${DISC[state.turn]}…`;

  const winSet = new Set(state.wins);

  return (
    <div className="kos-game" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <RoomBar room={room ?? 'public'} peers={peers} status={status} seats={['🔴', '🟡']} />
      <div className="kos-game-hint">{statusText}</div>

      <div style={{ display: 'flex', gap: 6 }}>
        {Array.from({ length: COLS }, (_, c) => (
          <button
            key={`drop-${c}`}
            className="kos-game-btn"
            disabled={!canPlay || colFull(c)}
            onClick={() => dispatch({ type: 'drop', col: c })}
            style={{ width: 40, padding: '2px 0', opacity: !canPlay || colFull(c) ? 0.35 : 1 }}
            aria-label={`Drop in column ${c + 1}`}
          >
            ▼
          </button>
        ))}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${COLS}, 40px)`,
          gap: 6,
          padding: 10,
          background: '#1a3a8f',
          borderRadius: 12,
          boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.4)',
        }}
      >
        {state.board.map((cell, i) => {
          const isWin = winSet.has(i);
          return (
            <div
              key={`cell-${i}`}
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: cell === null ? '#0d1f4d' : SEAT_COLOR[cell],
                boxShadow: isWin
                  ? '0 0 0 3px #fff, 0 0 10px #fff'
                  : cell === null
                    ? 'inset 0 2px 4px rgba(0,0,0,0.5)'
                    : 'inset 0 -3px 5px rgba(0,0,0,0.35)',
                transition: 'background 120ms ease',
              }}
            />
          );
        })}
      </div>

      {state.winner !== null && (
        <div className="kos-game-over" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div>{statusText}</div>
          <button
            className="kos-game-btn"
            onClick={() => (solo ? reset() : dispatch({ type: 'reset' }))}
          >
            Play again
          </button>
        </div>
      )}
    </div>
  );
}

export const connect4Game: GameDefinition = {
  id: 'connect4',
  name: 'Connect Four',
  icon: '🔴',
  tagline: 'Drop discs, get four in a row — live vs another player.',
  kind: 'multi',
  players: '2',
  tags: ['turn-based', 'classic'],
  component: ConnectFour,
  weight: 78,
};
