'use client';

import { useEffect } from 'react';
import type { GameDefinition, GameProps } from '../../../../types';
import { useGameRoom } from '../../../../net/realtime';
import { RoomBar } from '../../RoomBar';

type Phase = 'idle' | 'armed' | 'go' | 'result';
const TARGET = 3; // best of 5

interface RState {
  phase: Phase;
  goAt: number; // timestamp (ms) the screen turned green
  roundWinner: 0 | 1 | null;
  falseStart: 0 | 1 | null;
  rt: number; // winning reaction time in ms
  wins: [number, number];
  round: number;
}

type Move =
  | { type: 'start' }
  | { type: 'go'; at: number }
  | { type: 'click'; seat: 0 | 1; at: number }
  | { type: 'next' }
  | { type: 'rematch' };

const initial: RState = {
  phase: 'idle',
  goAt: 0,
  roundWinner: null,
  falseStart: null,
  rt: 0,
  wins: [0, 0],
  round: 1,
};

function reduce(state: RState, move: Move): RState {
  switch (move.type) {
    case 'start':
      if (state.phase !== 'idle') return state;
      return { ...state, phase: 'armed', goAt: 0, roundWinner: null, falseStart: null, rt: 0 };
    case 'go':
      if (state.phase !== 'armed') return state;
      return { ...state, phase: 'go', goAt: move.at };
    case 'click': {
      if (state.phase === 'armed') {
        // false start — the other seat takes the round
        const winner: 0 | 1 = move.seat === 0 ? 1 : 0;
        const wins: [number, number] = [...state.wins];
        wins[winner] += 1;
        return { ...state, phase: 'result', roundWinner: winner, falseStart: move.seat, wins };
      }
      if (state.phase !== 'go') return state;
      const wins: [number, number] = [...state.wins];
      wins[move.seat] += 1;
      return { ...state, phase: 'result', roundWinner: move.seat, rt: Math.max(0, move.at - state.goAt), wins };
    }
    case 'next': {
      if (state.phase !== 'result') return state;
      if (Math.max(state.wins[0], state.wins[1]) >= TARGET) return state;
      return { ...initial, wins: state.wins, round: state.round + 1, phase: 'idle' };
    }
    case 'rematch':
      return initial;
    default:
      return state;
  }
}

const SEATS = ['🔵 P1', '🔴 P2'];

function ReactionDuel({ room }: GameProps) {
  const { state, dispatch, peers, mySeat, status } = useGameRoom<RState, Move>({
    gameId: 'reaction',
    room: room ?? 'public',
    initialState: initial,
    reduce,
  });

  const solo = peers.length < 2;
  const isHost = solo || mySeat === 0;
  const matchOver = Math.max(state.wins[0], state.wins[1]) >= TARGET;
  const matchWinner: 0 | 1 = state.wins[0] >= TARGET ? 0 : 1;

  // Host schedules the red→green flip with a random delay.
  useEffect(() => {
    if (!isHost || state.phase !== 'armed') return;
    const delay = 1200 + Math.floor(Math.random() * 2600);
    const t = setTimeout(() => dispatch({ type: 'go', at: Date.now() }), delay);
    return () => clearTimeout(t);
  }, [isHost, state.phase, state.round, dispatch]);

  const canClick = (seat: 0 | 1) =>
    (solo || mySeat === seat) && (state.phase === 'armed' || state.phase === 'go');

  const click = (seat: 0 | 1) => {
    if (!canClick(seat)) return;
    dispatch({ type: 'click', seat, at: Date.now() });
  };

  const bg =
    state.phase === 'go' ? '#16a34a' : state.phase === 'armed' ? '#b91c1c' : state.phase === 'result' ? '#1e293b' : '#0f172a';

  const banner =
    state.phase === 'idle'
      ? matchOver
        ? `${SEATS[matchWinner]} wins the match!`
        : isHost
          ? 'Press START to begin the round'
          : 'Waiting for host to start…'
      : state.phase === 'armed'
        ? 'Wait for GREEN…'
        : state.phase === 'go'
          ? 'CLICK NOW!'
          : state.falseStart !== null
            ? `False start by ${SEATS[state.falseStart]} — ${SEATS[state.roundWinner ?? 0]} takes the round`
            : `${SEATS[state.roundWinner ?? 0]} wins the round in ${state.rt} ms`;

  return (
    <div className="kos-game" style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12 }}>
      <RoomBar room={room ?? 'public'} peers={peers} status={status} seats={SEATS} />

      <div className="kos-game-hud" style={{ justifyContent: 'space-between' }}>
        <span>Round {Math.min(state.round, 5)} · Best of 5</span>
        <span style={{ fontWeight: 700 }}>
          {state.wins[0]} <span style={{ opacity: 0.6 }}>–</span> {state.wins[1]}
        </span>
        <span className="kos-game-hint">{solo ? 'hot-seat: drive both' : `you are ${SEATS[mySeat] ?? 'spectator'}`}</span>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 180,
          borderRadius: 12,
          background: bg,
          color: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          transition: 'background 80ms',
          userSelect: 'none',
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 0.5, marginBottom: 12 }}>{banner}</div>

        {(state.phase === 'armed' || state.phase === 'go') && (
          <div style={{ display: 'flex', gap: 14 }}>
            {([0, 1] as const).map((seat) => (
              <button
                key={seat}
                className="kos-game-btn"
                disabled={!canClick(seat)}
                onClick={() => click(seat)}
                style={{
                  minWidth: 110,
                  fontSize: 16,
                  opacity: canClick(seat) ? 1 : 0.4,
                  cursor: canClick(seat) ? 'pointer' : 'default',
                }}
              >
                {SEATS[seat]}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        {state.phase === 'idle' && !matchOver && isHost && (
          <button className="kos-game-btn" onClick={() => dispatch({ type: 'start' })}>
            ▶ Start round
          </button>
        )}
        {state.phase === 'result' && !matchOver && isHost && (
          <button className="kos-game-btn" onClick={() => dispatch({ type: 'next' })}>
            Next round →
          </button>
        )}
        {matchOver && isHost && (
          <button className="kos-game-btn" onClick={() => dispatch({ type: 'rematch' })}>
            ⟳ New match
          </button>
        )}
      </div>

      {matchOver && <div className="kos-game-over">{SEATS[matchWinner]} wins! 🏆</div>}
    </div>
  );
}

export const reactionGame: GameDefinition = {
  id: 'reaction',
  name: 'Reaction Duel',
  icon: '⚡',
  tagline: 'Wait for green, then click first. Best of 5.',
  kind: 'multi',
  players: '2',
  tags: ['reflex', 'realtime'],
  component: ReactionDuel,
  weight: 70,
};
