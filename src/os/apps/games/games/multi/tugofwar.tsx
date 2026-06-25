'use client';

import type { GameDefinition, GameProps } from '../../../../types';
import { useGameRoom } from '../../../../net/realtime';
import { RoomBar } from '../../RoomBar';

type Side = 0 | 1;
interface TugState {
  /** rope marker position: -EDGE..+EDGE, 0 = center. <0 favours side 0, >0 side 1 */
  pos: number;
  winner: Side | null;
}
type Move = { type: 'pull'; side: Side } | { type: 'reset' };

const EDGE = 100;
const STEP = 4;

const initial: TugState = { pos: 0, winner: null };

function reduce(state: TugState, move: Move): TugState {
  if (move.type === 'reset') return initial;
  if (state.winner !== null) return state;
  // side 0 pulls toward -EDGE, side 1 toward +EDGE
  const next = state.pos + (move.side === 1 ? STEP : -STEP);
  const clamped = Math.max(-EDGE, Math.min(EDGE, next));
  const winner: Side | null = clamped <= -EDGE ? 0 : clamped >= EDGE ? 1 : null;
  return { pos: clamped, winner };
}

const SEATS = ['🟦', '🟥'];
const NAMES = ['Blue', 'Red'];

function TugOfWar({ room }: GameProps) {
  const { state, dispatch, reset, peers, mySeat, status } = useGameRoom<TugState, Move>({
    gameId: 'tugofwar',
    room: room ?? 'public',
    initialState: initial,
    reduce,
  });

  const solo = peers.length < 2;
  const playing = state.winner === null;
  const mineSide: Side | null = mySeat === 0 ? 0 : mySeat === 1 ? 1 : null;

  // marker offset as a 0..100 percentage across the track
  const pct = ((state.pos + EDGE) / (EDGE * 2)) * 100;

  const statusText =
    state.winner !== null
      ? `${SEATS[state.winner]} ${NAMES[state.winner]} wins the pull!`
      : solo
        ? 'Hot-seat — mash both buttons (open another tab to play online)'
        : mySeat >= 2
          ? 'Spectating'
          : `You are ${SEATS[mySeat]} ${NAMES[mySeat]} — click as fast as you can!`;

  const pull = (side: Side) => {
    if (!playing) return;
    dispatch({ type: 'pull', side });
  };

  const canPull = (side: Side) =>
    playing && (solo || (mineSide !== null && mineSide === side));

  const renderPull = (side: Side) => {
    const enabled = canPull(side);
    return (
      <button
        className="kos-game-btn"
        disabled={!enabled}
        onClick={() => pull(side)}
        style={{
          flex: 1,
          padding: '18px 12px',
          fontSize: 18,
          fontWeight: 700,
          background: side === 0 ? '#1d4ed8' : '#b91c1c',
          color: '#fff',
          opacity: enabled ? 1 : 0.45,
          cursor: enabled ? 'pointer' : 'default',
        }}
      >
        {SEATS[side]} PULL {NAMES[side]}
      </button>
    );
  };

  return (
    <div className="kos-game" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <RoomBar room={room ?? 'public'} peers={peers} status={status} seats={SEATS} />

      <div className="kos-game-hud" style={{ textAlign: 'center', minHeight: 22 }}>
        {statusText}
      </div>

      {/* rope track */}
      <div
        style={{
          position: 'relative',
          height: 56,
          borderRadius: 28,
          background: 'linear-gradient(90deg,#1d4ed8 0%,#1d4ed8 8%,#0a0a14 50%,#b91c1c 92%,#b91c1c 100%)',
          border: '2px solid #2a2a3a',
          overflow: 'hidden',
        }}
      >
        {/* center line */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: 0,
            bottom: 0,
            width: 2,
            background: 'rgba(255,255,255,0.35)',
            transform: 'translateX(-1px)',
          }}
        />
        {/* rope marker */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: `${pct}%`,
            transform: 'translate(-50%,-50%)',
            transition: 'left 90ms linear',
            fontSize: 30,
            filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.6))',
          }}
        >
          🪢
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, opacity: 0.7 }}>
        <span>{SEATS[0]} edge</span>
        <span>{SEATS[1]} edge</span>
      </div>

      {state.winner === null ? (
        <div style={{ display: 'flex', gap: 12 }}>
          {renderPull(0)}
          {renderPull(1)}
        </div>
      ) : (
        <div className="kos-game-over" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 20, marginBottom: 10 }}>
            {SEATS[state.winner]} {NAMES[state.winner]} won!
          </div>
          <button
            className="kos-game-btn"
            onClick={() => (solo ? reset() : dispatch({ type: 'reset' }))}
          >
            Rematch
          </button>
        </div>
      )}

      <div className="kos-game-hint" style={{ textAlign: 'center' }}>
        Click faster than your rival to drag the rope past your edge.
      </div>
    </div>
  );
}

export const tugOfWarGame: GameDefinition = {
  id: 'tugofwar',
  name: 'Tug of War',
  icon: '🪢',
  tagline: 'Mash to drag the rope to your side — fastest clicker wins.',
  kind: 'multi',
  players: '2',
  tags: ['real-time', 'clicker'],
  component: TugOfWar,
  weight: 70,
};
