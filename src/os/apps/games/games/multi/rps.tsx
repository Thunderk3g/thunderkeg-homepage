'use client';

import type { GameDefinition, GameProps } from '../../../../types';
import { useGameRoom } from '../../../../net/realtime';
import { RoomBar } from '../../RoomBar';

type Hand = 'rock' | 'paper' | 'scissors';
type Pick = Hand | null;

interface RPSState {
  /** secret picks for the current round (null = not yet submitted) */
  picks: [Pick, Pick];
  /** revealed picks of the last resolved round (null until first reveal) */
  reveal: [Hand, Hand] | null;
  /** winner of the last resolved round: 0, 1, or 'tie' */
  last: 0 | 1 | 'tie' | null;
  scores: [number, number];
  round: number;
  /** match winner once a seat reaches WIN_TARGET */
  champ: 0 | 1 | null;
}

type Move = { type: 'pick'; seat: 0 | 1; hand: Hand } | { type: 'reset' };

const WIN_TARGET = 3; // best-of-5
const HANDS: Hand[] = ['rock', 'paper', 'scissors'];
const GLYPH: Record<Hand, string> = { rock: '✊', paper: '✋', scissors: '✌️' };
const SEAT_LABEL = ['P1', 'P2'];

const initial: RPSState = {
  picks: [null, null],
  reveal: null,
  last: null,
  scores: [0, 0],
  round: 1,
  champ: null,
};

/** returns 0 if a beats b, 1 if b beats a, 'tie' if equal */
function roundWinner(a: Hand, b: Hand): 0 | 1 | 'tie' {
  if (a === b) return 'tie';
  const aBeatsB =
    (a === 'rock' && b === 'scissors') ||
    (a === 'paper' && b === 'rock') ||
    (a === 'scissors' && b === 'paper');
  return aBeatsB ? 0 : 1;
}

function reduce(state: RPSState, move: Move): RPSState {
  if (move.type === 'reset') return initial;
  if (state.champ !== null) return state;
  if (state.picks[move.seat] !== null) return state; // already locked in

  const picks: [Pick, Pick] = [state.picks[0], state.picks[1]];
  picks[move.seat] = move.hand;

  // Both submitted → resolve the round.
  if (picks[0] !== null && picks[1] !== null) {
    const a = picks[0];
    const b = picks[1];
    const result = roundWinner(a, b);
    const scores: [number, number] = [state.scores[0], state.scores[1]];
    if (result !== 'tie') scores[result] += 1;
    const champ = scores[0] >= WIN_TARGET ? 0 : scores[1] >= WIN_TARGET ? 1 : null;
    return {
      picks: [null, null],
      reveal: [a, b],
      last: result,
      scores,
      round: champ === null ? state.round + 1 : state.round,
      champ,
    };
  }

  return { ...state, picks };
}

function Hands({ disabled, onPick }: { disabled: boolean; onPick: (h: Hand) => void }) {
  return (
    <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
      {HANDS.map((h) => (
        <button
          key={h}
          className="kos-game-btn"
          disabled={disabled}
          onClick={() => onPick(h)}
          style={{ fontSize: 30, width: 64, height: 64, padding: 0, opacity: disabled ? 0.4 : 1 }}
          aria-label={h}
        >
          {GLYPH[h]}
        </button>
      ))}
    </div>
  );
}

function RockPaperScissors({ room }: GameProps) {
  const { state, dispatch, reset, peers, mySeat, status } = useGameRoom<RPSState, Move>({
    gameId: 'rps',
    room: room ?? 'public',
    initialState: initial,
    reduce,
  });

  const solo = peers.length < 2;
  const spectator = mySeat >= 2;
  const over = state.champ !== null;

  // Solo: drive whichever seat still needs a pick. Online: your own seat.
  const activeSeat: 0 | 1 = solo ? (state.picks[0] === null ? 0 : 1) : (mySeat as 0 | 1);
  const myWaiting = !solo && mySeat < 2 && state.picks[mySeat] !== null && !over;
  const canPick = !over && !spectator && (solo || (!myWaiting && state.picks[activeSeat] === null));

  const statusText = over
    ? `${SEAT_LABEL[state.champ as 0 | 1]} wins the match! 🏆`
    : spectator
      ? 'Spectating'
      : solo
        ? `Hot-seat — ${SEAT_LABEL[activeSeat]} pick secretly (open another tab to play online)`
        : myWaiting
          ? 'Locked in — waiting for opponent…'
          : 'Pick your hand (hidden until both lock in)';

  const lastText =
    state.reveal === null
      ? null
      : `Round ${state.round - (over ? 0 : 1)}: ${GLYPH[state.reveal[0]]} vs ${GLYPH[state.reveal[1]]} — ` +
        (state.last === 'tie' ? 'tie' : `${SEAT_LABEL[state.last as 0 | 1]} takes it`);

  return (
    <div className="kos-game" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <RoomBar room={room ?? 'public'} peers={peers} status={status} seats={['✊', '✋']} />

      <div className="kos-game-hud" style={{ display: 'flex', justifyContent: 'center', gap: 24, fontSize: 18 }}>
        <span>
          {SEAT_LABEL[0]} <b>{state.scores[0]}</b>
        </span>
        <span style={{ opacity: 0.6 }}>best of {WIN_TARGET * 2 - 1}</span>
        <span>
          <b>{state.scores[1]}</b> {SEAT_LABEL[1]}
        </span>
      </div>

      <div style={{ textAlign: 'center', minHeight: 22 }}>{statusText}</div>

      {!over && (
        <Hands
          disabled={!canPick}
          onPick={(h) => dispatch({ type: 'pick', seat: activeSeat, hand: h })}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'center', gap: 10, fontSize: 13, opacity: 0.85 }}>
        <span>{state.picks[0] !== null ? '✊ locked' : '… waiting'}</span>
        <span>•</span>
        <span>{state.picks[1] !== null ? '✋ locked' : '… waiting'}</span>
      </div>

      {lastText && (
        <div className="kos-game-hint" style={{ textAlign: 'center' }}>
          {lastText}
        </div>
      )}

      {over && (
        <button
          className="kos-game-btn"
          style={{ alignSelf: 'center' }}
          onClick={() => (solo ? reset() : dispatch({ type: 'reset' }))}
        >
          Play again
        </button>
      )}
    </div>
  );
}

export const rpsGame: GameDefinition = {
  id: 'rps',
  name: 'Rock-Paper-Scissors',
  icon: '✊',
  tagline: 'Secret picks, instant reveal, best-of-5 vs another player.',
  kind: 'multi',
  players: '2',
  tags: ['turn-based', 'classic', 'duel'],
  component: RockPaperScissors,
  weight: 75,
};
