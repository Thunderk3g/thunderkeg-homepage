'use client';

import type { GameDefinition, GameProps } from '../../../../types';
import { useGameRoom } from '../../../../net/realtime';
import { RoomBar } from '../../RoomBar';

type Cell = 0 | 1 | null;
interface TTTState {
  board: Cell[];
  turn: 0 | 1;
  winner: Cell | 'draw';
}
type Move = { type: 'play'; cell: number } | { type: 'reset' };

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

const initial: TTTState = { board: Array(9).fill(null), turn: 0, winner: null };

function winnerOf(b: Cell[]): Cell | 'draw' {
  for (const [a, c, d] of LINES) {
    if (b[a] !== null && b[a] === b[c] && b[c] === b[d]) return b[a];
  }
  return b.every((x) => x !== null) ? 'draw' : null;
}

function reduce(state: TTTState, move: Move): TTTState {
  if (move.type === 'reset') return initial;
  if (state.winner !== null) return state;
  if (state.board[move.cell] !== null) return state;
  const board = state.board.slice();
  board[move.cell] = state.turn;
  return { board, turn: state.turn === 0 ? 1 : 0, winner: winnerOf(board) };
}

const MARK = ['✕', '◯'];

function TicTacToe({ room }: GameProps) {
  const { state, dispatch, reset, peers, mySeat, status } = useGameRoom<TTTState, Move>({
    gameId: 'tictactoe',
    room: room ?? 'public',
    initialState: initial,
    reduce,
  });

  const solo = peers.length < 2;
  const myTurn = solo || (mySeat < 2 && state.turn === mySeat);
  const canPlay = state.winner === null && myTurn && mySeat < 2;

  const statusText =
    state.winner === 'draw'
      ? "It's a draw!"
      : state.winner !== null
        ? `${MARK[state.winner]} wins!`
        : solo
          ? `Hot-seat — ${MARK[state.turn]}'s turn (open another tab to play online)`
          : mySeat >= 2
            ? 'Spectating'
            : myTurn
              ? `Your move (${MARK[mySeat]})`
              : `Waiting for ${MARK[state.turn]}…`;

  return (
    <div className="kos-game kos-ttt">
      <RoomBar room={room ?? 'public'} peers={peers} status={status} seats={['✕', '◯']} />
      <div className="kos-ttt-status">{statusText}</div>
      <div className="kos-ttt-board">
        {state.board.map((c, i) => (
          <button
            key={i}
            className={'kos-ttt-cell' + (c !== null ? ' filled' : '')}
            disabled={!canPlay || c !== null}
            onClick={() => dispatch({ type: 'play', cell: i })}
          >
            {c !== null ? MARK[c] : ''}
          </button>
        ))}
      </div>
      {state.winner !== null && (
        <button className="kos-game-btn" onClick={() => (solo ? reset() : dispatch({ type: 'reset' }))}>
          Play again
        </button>
      )}
    </div>
  );
}

export const ticTacToeGame: GameDefinition = {
  id: 'tictactoe',
  name: 'Tic-Tac-Toe',
  icon: '⭕',
  tagline: 'Classic 3-in-a-row, live vs another player.',
  kind: 'multi',
  players: '2',
  tags: ['turn-based', 'classic'],
  component: TicTacToe,
  weight: 80,
};
