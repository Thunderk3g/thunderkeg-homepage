'use client';

import { useState } from 'react';
import type { GameDefinition, GameProps } from '../../../../types';
import { useGameRoom } from '../../../../net/realtime';
import { RoomBar } from '../../RoomBar';

const TARGET = 3; // best of 5

const WORDS = [
  'javascript', 'typescript', 'react', 'kubernetes', 'docker',
  'terminal', 'compiler', 'database', 'algorithm', 'function',
  'variable', 'firewall', 'protocol', 'frontend', 'backend',
  'keyboard', 'monitor', 'network', 'browser', 'pointer',
] as const;

interface WRState {
  word: string; // the current answer (host-authoritative)
  scramble: string; // shown to players
  revealed: boolean; // round has started, accepting answers
  roundWinner: 0 | 1 | null; // who solved it
  wins: [number, number];
  round: number;
}

type Move =
  | { type: 'reveal'; word: string; scramble: string }
  | { type: 'guess'; seat: 0 | 1; text: string }
  | { type: 'next' }
  | { type: 'rematch' };

const initial: WRState = {
  word: '',
  scramble: '',
  revealed: false,
  roundWinner: null,
  wins: [0, 0],
  round: 1,
};

function shuffle(word: string): string {
  const letters = word.split('');
  for (let i = letters.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [letters[i], letters[j]] = [letters[j], letters[i]];
  }
  const result = letters.join('');
  return result === word ? shuffle(word) : result;
}

function reduce(state: WRState, move: Move): WRState {
  switch (move.type) {
    case 'reveal':
      if (state.revealed || state.roundWinner !== null) return state;
      return { ...state, word: move.word, scramble: move.scramble, revealed: true };
    case 'guess': {
      if (!state.revealed || state.roundWinner !== null) return state;
      if (move.text.trim().toLowerCase() !== state.word) return state;
      const wins: [number, number] = [...state.wins];
      wins[move.seat] += 1;
      return { ...state, revealed: false, roundWinner: move.seat, wins };
    }
    case 'next': {
      if (state.roundWinner === null) return state;
      if (Math.max(state.wins[0], state.wins[1]) >= TARGET) return state;
      return { ...initial, wins: state.wins, round: state.round + 1 };
    }
    case 'rematch':
      return initial;
    default:
      return state;
  }
}

const SEATS = ['🟢 P1', '🟠 P2'];

function WordRace({ room }: GameProps) {
  const { state, dispatch, peers, mySeat, status } = useGameRoom<WRState, Move>({
    gameId: 'wordrace',
    room: room ?? 'public',
    initialState: initial,
    reduce,
  });

  const [draft, setDraft] = useState('');
  const solo = peers.length < 2;
  const isHost = solo || mySeat === 0;
  const matchOver = Math.max(state.wins[0], state.wins[1]) >= TARGET;
  const matchWinner: 0 | 1 = state.wins[0] >= TARGET ? 0 : 1;

  const reveal = () => {
    const word = WORDS[Math.floor(Math.random() * WORDS.length)];
    dispatch({ type: 'reveal', word, scramble: shuffle(word) });
  };

  const canGuess = state.revealed && (solo || mySeat < 2);
  const submit = () => {
    if (!canGuess || !draft.trim()) return;
    const seat: 0 | 1 = solo ? 0 : mySeat === 1 ? 1 : 0;
    dispatch({ type: 'guess', seat, text: draft });
    setDraft('');
  };

  const banner = matchOver
    ? `${SEATS[matchWinner]} wins the match! 🏆`
    : state.roundWinner !== null
      ? `${SEATS[state.roundWinner]} solved it — the word was “${state.word}”`
      : state.revealed
        ? 'Unscramble it — first correct wins the round!'
        : isHost
          ? 'Press REVEAL to scramble a new word'
          : 'Waiting for host to reveal…';

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
          minHeight: 150,
          borderRadius: 12,
          background: '#0f172a',
          color: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: 16,
          userSelect: 'none',
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>{banner}</div>

        {state.revealed && (
          <div
            style={{
              fontSize: 34,
              fontWeight: 900,
              letterSpacing: 8,
              textTransform: 'uppercase',
              color: '#38bdf8',
            }}
          >
            {state.scramble}
          </div>
        )}

        {state.revealed && canGuess && (
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
              }}
              placeholder="type the word…"
              style={{
                fontSize: 16,
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid #334155',
                background: '#1e293b',
                color: '#f8fafc',
                outline: 'none',
              }}
            />
            <button className="kos-game-btn" onClick={submit} disabled={!draft.trim()}>
              Race!
            </button>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        {!state.revealed && state.roundWinner === null && !matchOver && isHost && (
          <button className="kos-game-btn" onClick={reveal}>
            ✦ Reveal word
          </button>
        )}
        {state.roundWinner !== null && !matchOver && isHost && (
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

export const wordRaceGame: GameDefinition = {
  id: 'wordrace',
  name: 'Word Race',
  icon: '🔤',
  tagline: 'Unscramble the tech word — first to type it wins. Best of 5.',
  kind: 'multi',
  players: '2',
  tags: ['typing', 'realtime', 'words'],
  component: WordRace,
  weight: 65,
};
