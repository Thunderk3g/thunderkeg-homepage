'use client';

import type { GameDefinition, GameProps } from '../../../../types';
import { useGameRoom } from '../../../../net/realtime';
import { RoomBar } from '../../RoomBar';

const SIZE = 7;
const CELLS = SIZE * SIZE;
const FLEET = [3, 2, 2]; // ship lengths
const TOTAL_SHIP_CELLS = FLEET.reduce((a, b) => a + b, 0);

interface Board {
  ships: number[]; // cell index -> ship id (-1 = empty)
  shots: boolean[]; // cell index -> has been fired at
}
interface BSState {
  boards: [Board, Board]; // boards[seat] is that seat's OWN fleet (opponent fires at it)
  turn: 0 | 1;
  winner: 0 | 1 | null;
  started: boolean;
}
type Move = { type: 'fire'; seat: 0 | 1; cell: number } | { type: 'reset' };

function emptyBoard(): Board {
  return { ships: Array<number>(CELLS).fill(-1), shots: Array<boolean>(CELLS).fill(false) };
}

/** Randomly place the fleet; only runs host-side inside a handler, never at module load. */
function placeFleet(): Board {
  const board = emptyBoard();
  FLEET.forEach((len, shipId) => {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const horizontal = Math.random() < 0.5;
      const r = Math.floor(Math.random() * (horizontal ? SIZE : SIZE - len + 1));
      const c = Math.floor(Math.random() * (horizontal ? SIZE - len + 1 : SIZE));
      const cells: number[] = [];
      for (let i = 0; i < len; i += 1) {
        cells.push(horizontal ? r * SIZE + (c + i) : (r + i) * SIZE + c);
      }
      if (cells.every((cell) => board.ships[cell] === -1)) {
        cells.forEach((cell) => {
          board.ships[cell] = shipId;
        });
        break;
      }
    }
  });
  return board;
}

function freshState(): BSState {
  return { boards: [placeFleet(), placeFleet()], turn: 0, winner: null, started: true };
}

const initial: BSState = {
  boards: [emptyBoard(), emptyBoard()],
  turn: 0,
  winner: null,
  started: false,
};

/** Is shipId fully hit on the given board? */
function shipSunk(board: Board, shipId: number): boolean {
  for (let i = 0; i < CELLS; i += 1) {
    if (board.ships[i] === shipId && !board.shots[i]) return false;
  }
  return true;
}

function hitsOn(board: Board): number {
  let n = 0;
  for (let i = 0; i < CELLS; i += 1) {
    if (board.shots[i] && board.ships[i] >= 0) n += 1;
  }
  return n;
}

function reduce(state: BSState, move: Move): BSState {
  if (move.type === 'reset') return freshState();
  if (!state.started) return state;
  if (state.winner !== null) return state;
  if (move.seat !== state.turn) return state;
  const target = move.seat === 0 ? 1 : 0; // you fire at the opponent's board
  const enemy = state.boards[target];
  if (enemy.shots[move.cell]) return state; // already fired here
  const shots = enemy.shots.slice();
  shots[move.cell] = true;
  const nextEnemy: Board = { ships: enemy.ships, shots };
  const boards: [Board, Board] = move.seat === 0 ? [state.boards[0], nextEnemy] : [nextEnemy, state.boards[1]];
  const wonAll = hitsOn(nextEnemy) >= TOTAL_SHIP_CELLS;
  const hit = nextEnemy.ships[move.cell] >= 0;
  return {
    boards,
    // Fire again on a hit, otherwise pass the turn (classic salvo-on-hit rule).
    turn: wonAll ? state.turn : hit ? state.turn : state.turn === 0 ? 1 : 0,
    winner: wonAll ? move.seat : null,
    started: true,
  };
}

function Grid({
  board,
  reveal,
  canFire,
  onFire,
}: {
  board: Board;
  reveal: boolean; // show un-hit ships (your own grid)
  canFire: boolean;
  onFire: (cell: number) => void;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${SIZE}, 30px)`, gap: 3 }}>
      {board.ships.map((ship, i) => {
        const shot = board.shots[i];
        const isHit = shot && ship >= 0;
        const isMiss = shot && ship < 0;
        const sunk = isHit && shipSunk(board, ship);
        let bg = '#0d2540';
        if (reveal && ship >= 0 && !shot) bg = '#3a5e7a';
        if (isMiss) bg = '#16324f';
        if (isHit) bg = sunk ? '#7a1d1d' : '#d9483b';
        return (
          <button
            key={i}
            disabled={!canFire || shot}
            onClick={() => onFire(i)}
            aria-label={`cell ${i}`}
            style={{
              width: 30,
              height: 30,
              border: '1px solid #163a5c',
              borderRadius: 4,
              background: bg,
              color: '#fff',
              fontSize: 14,
              cursor: canFire && !shot ? 'pointer' : 'default',
              boxShadow: isHit ? 'inset 0 0 6px rgba(0,0,0,0.6)' : 'none',
            }}
          >
            {isHit ? (sunk ? '☠' : '✸') : isMiss ? '•' : ''}
          </button>
        );
      })}
    </div>
  );
}

function Battleship({ room }: GameProps) {
  const { state, dispatch, reset, peers, mySeat, status } = useGameRoom<BSState, Move>({
    gameId: 'battleship',
    room: room ?? 'public',
    initialState: initial,
    reduce,
  });

  const solo = peers.length < 2;
  const seat: 0 | 1 = solo ? state.turn : mySeat === 1 ? 1 : 0;
  const spectator = !solo && mySeat >= 2;
  const myTurn = solo || (!spectator && state.turn === seat);
  const canFire = state.started && state.winner === null && myTurn && !spectator;
  const enemyBoard = state.boards[seat === 0 ? 1 : 0];
  const myBoard = state.boards[seat];

  const statusText = !state.started
    ? 'Press Start to deploy the fleets.'
    : state.winner !== null
      ? `Player ${state.winner + 1} wins — fleet destroyed!`
      : spectator
        ? 'Spectating'
        : solo
          ? `Hot-seat — Player ${state.turn + 1}, fire at the enemy grid (open another tab for online)`
          : myTurn
            ? 'Your turn — fire!'
            : `Waiting for Player ${state.turn + 1}…`;

  const doFire = (cell: number) => {
    if (canFire) dispatch({ type: 'fire', seat, cell });
  };
  const restart = () => (solo ? reset(freshState()) : dispatch({ type: 'reset' }));

  return (
    <div className="kos-game" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <RoomBar room={room ?? 'public'} peers={peers} status={status} seats={['P1', 'P2']} />
      <div className="kos-game-hint">{statusText}</div>

      {!state.started ? (
        <button className="kos-game-btn" onClick={restart}>
          Start battle
        </button>
      ) : (
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
            <span className="kos-game-hud">Enemy waters</span>
            <Grid board={enemyBoard} reveal={false} canFire={canFire} onFire={doFire} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
            <span className="kos-game-hud">Your fleet</span>
            <Grid board={myBoard} reveal canFire={false} onFire={() => undefined} />
          </div>
        </div>
      )}

      {state.winner !== null && (
        <div className="kos-game-over" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div>{statusText}</div>
          <button className="kos-game-btn" onClick={restart}>
            Play again
          </button>
        </div>
      )}
    </div>
  );
}

export const battleshipGame: GameDefinition = {
  id: 'battleship',
  name: 'Battleship',
  icon: '🚢',
  tagline: 'Auto-deploy your fleet and sink the enemy — live vs another player.',
  kind: 'multi',
  players: '2',
  tags: ['turn-based', 'strategy'],
  component: Battleship,
  weight: 76,
};
