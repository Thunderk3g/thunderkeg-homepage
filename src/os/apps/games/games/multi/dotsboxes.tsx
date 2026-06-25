'use client';

import type { GameDefinition, GameProps } from '../../../../types';
import { useGameRoom } from '../../../../net/realtime';
import { RoomBar } from '../../RoomBar';

// 4x4 dots → 3x3 boxes.
const SIZE = 3; // boxes per side
const H_COUNT = (SIZE + 1) * SIZE; // horizontal edges: 4 rows × 3
const V_COUNT = SIZE * (SIZE + 1); // vertical edges:   3 rows × 4
const EDGES = H_COUNT + V_COUNT; // 24 total
const SEAT_LABEL = ['Red', 'Blue'];
const SEAT_COLOR = ['#ff5d6c', '#4da3ff'];

type Owner = 0 | 1 | null;

interface DBState {
  edges: Owner[]; // who drew each edge (null = open)
  boxes: Owner[]; // who owns each of the 9 boxes
  turn: 0 | 1;
  over: boolean;
}

type Move = { type: 'draw'; edge: number } | { type: 'reset' };

const initial: DBState = {
  edges: Array<Owner>(EDGES).fill(null),
  boxes: Array<Owner>(SIZE * SIZE).fill(null),
  turn: 0,
  over: false,
};

const hIdx = (r: number, c: number) => r * SIZE + c; // 0..H_COUNT-1
const vIdx = (r: number, c: number) => H_COUNT + r * (SIZE + 1) + c; // H_COUNT..EDGES-1

/** the 4 edge indices around box (r,c). */
function boxEdges(r: number, c: number): [number, number, number, number] {
  return [hIdx(r, c), hIdx(r + 1, c), vIdx(r, c), vIdx(r, c + 1)];
}

function reduce(state: DBState, move: Move): DBState {
  if (move.type === 'reset') return initial;
  if (state.over || state.edges[move.edge] !== null) return state;

  const edges = state.edges.slice();
  edges[move.edge] = state.turn;
  const boxes = state.boxes.slice();

  let completed = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const b = r * SIZE + c;
      if (boxes[b] !== null) continue;
      if (boxEdges(r, c).every((e) => edges[e] !== null)) {
        boxes[b] = state.turn;
        completed++;
      }
    }
  }

  const over = boxes.every((b) => b !== null);
  // Completing a box earns another turn; otherwise pass.
  const turn: 0 | 1 = completed > 0 ? state.turn : state.turn === 0 ? 1 : 0;
  return { edges, boxes, turn, over };
}

function DotsAndBoxes({ room }: GameProps) {
  const { state, dispatch, reset, peers, mySeat, status } = useGameRoom<DBState, Move>({
    gameId: 'dotsboxes',
    room: room ?? 'public',
    initialState: initial,
    reduce,
  });

  const solo = peers.length < 2;
  const spectator = mySeat >= 2;
  const myTurn = solo || (mySeat < 2 && state.turn === mySeat);
  const canPlay = !state.over && !spectator && myTurn;

  const scores: [number, number] = [
    state.boxes.filter((b) => b === 0).length,
    state.boxes.filter((b) => b === 1).length,
  ];
  const winner: Owner | 'draw' = state.over
    ? scores[0] === scores[1]
      ? 'draw'
      : scores[0] > scores[1]
        ? 0
        : 1
    : null;

  const statusText = state.over
    ? winner === 'draw'
      ? "It's a draw!"
      : `${SEAT_LABEL[winner as 0 | 1]} wins ${Math.max(...scores)}–${Math.min(...scores)}! 🏆`
    : spectator
      ? 'Spectating'
      : solo
        ? `Hot-seat — ${SEAT_LABEL[state.turn]} to move (open another tab to play online)`
        : myTurn
          ? `Your move (${SEAT_LABEL[mySeat]})`
          : `Waiting for ${SEAT_LABEL[state.turn]}…`;

  const drawEdge = (e: number) => {
    if (canPlay && state.edges[e] === null) dispatch({ type: 'draw', edge: e });
  };

  const GAP = 56; // px between dots
  const DOT = 12;
  const board = GAP * SIZE + DOT;

  const edgeStyle = (owner: Owner): React.CSSProperties => ({
    position: 'absolute',
    background: owner !== null ? SEAT_COLOR[owner] : 'rgba(255,255,255,0.12)',
    borderRadius: 4,
    border: 'none',
    padding: 0,
    cursor: owner === null && canPlay ? 'pointer' : 'default',
    transition: 'background 0.15s',
  });

  const cells: React.ReactNode[] = [];
  const edgeBtn = (e: number, box: React.CSSProperties) =>
    cells.push(
      <button
        key={`e-${e}`}
        aria-label={`edge ${e}`}
        disabled={!canPlay || state.edges[e] !== null}
        onClick={() => drawEdge(e)}
        style={{ ...edgeStyle(state.edges[e]), ...box }}
      />,
    );

  for (let r = 0; r <= SIZE; r++) {
    for (let c = 0; c <= SIZE; c++) {
      const owner = r < SIZE && c < SIZE ? state.boxes[r * SIZE + c] : null;
      if (owner !== null) {
        cells.push(
          <div
            key={`box-${r}-${c}`}
            style={{ position: 'absolute', left: DOT / 2 + c * GAP + 4, top: DOT / 2 + r * GAP + 4, width: GAP - 8, height: GAP - 8, background: SEAT_COLOR[owner], opacity: 0.22, borderRadius: 6 }}
          />,
        );
      }
      if (c < SIZE) edgeBtn(hIdx(r, c), { left: DOT + c * GAP, top: r * GAP + DOT / 2 - 3, width: GAP - DOT, height: 6 });
      if (r < SIZE) edgeBtn(vIdx(r, c), { left: c * GAP + DOT / 2 - 3, top: DOT + r * GAP, width: 6, height: GAP - DOT });
      cells.push(
        <div
          key={`d-${r}-${c}`}
          style={{ position: 'absolute', left: c * GAP, top: r * GAP, width: DOT, height: DOT, borderRadius: '50%', background: '#e8edf2' }}
        />,
      );
    }
  }

  return (
    <div className="kos-game" style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
      <RoomBar room={room ?? 'public'} peers={peers} status={status} seats={['🔴', '🔵']} />

      <div className="kos-game-hud" style={{ display: 'flex', justifyContent: 'center', gap: 24, fontSize: 17 }}>
        <span style={{ color: SEAT_COLOR[0], fontWeight: state.turn === 0 && !state.over ? 700 : 400 }}>
          {SEAT_LABEL[0]} <b>{scores[0]}</b>
        </span>
        <span style={{ opacity: 0.6 }}>boxes</span>
        <span style={{ color: SEAT_COLOR[1], fontWeight: state.turn === 1 && !state.over ? 700 : 400 }}>
          <b>{scores[1]}</b> {SEAT_LABEL[1]}
        </span>
      </div>

      <div style={{ textAlign: 'center', minHeight: 22 }}>{statusText}</div>

      <div style={{ position: 'relative', width: board, height: board, margin: '4px auto' }}>{cells}</div>

      {state.over && (
        <button className="kos-game-btn" onClick={() => (solo ? reset() : dispatch({ type: 'reset' }))}>
          Play again
        </button>
      )}
      <div className="kos-game-hint" style={{ textAlign: 'center' }}>
        Complete a box to score and take another turn.
      </div>
    </div>
  );
}

export const dotsBoxesGame: GameDefinition = {
  id: 'dotsboxes',
  name: 'Dots and Boxes',
  icon: '⬜',
  tagline: 'Claim edges, close boxes, own the most. Live vs another player.',
  kind: 'multi',
  players: '2',
  tags: ['turn-based', 'classic', 'strategy'],
  component: DotsAndBoxes,
  weight: 70,
};
