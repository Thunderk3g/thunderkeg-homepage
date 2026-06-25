'use client';

import { useCallback, useEffect, useState } from 'react';
import type { GameDefinition, GameProps } from '../../../../types';

/** Curated 5-letter, tech-themed answer pool. */
const WORDS = [
  'BYTES', 'CACHE', 'PROXY', 'TOKEN', 'LINUX',
  'SHELL', 'STACK', 'QUERY', 'ARRAY', 'LOGIN',
  'NODES', 'REGEX', 'DEBUG', 'PATCH', 'CLOUD',
  'MACRO', 'FRAME', 'PIXEL', 'EMAIL', 'CHMOD',
  'CRYPT', 'GHOST', 'PORTS', 'ROUTE', 'MODEM',
  'FLASH', 'VIRUS', 'BLOCK', 'INPUT', 'TABLE',
] as const;

const ROWS = 6;
const COLS = 5;
const KEY_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

type CellState = 'empty' | 'correct' | 'present' | 'absent';
type Cell = { letter: string; state: CellState };

const STATE_BG: Record<CellState, string> = {
  empty: 'transparent',
  correct: '#3aa655',
  present: '#c9a227',
  absent: '#3a3f4b',
};
const STATE_RANK: Record<CellState, number> = { empty: -1, absent: 0, present: 1, correct: 2 };

function emptyBoard(): Cell[][] {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({ letter: '', state: 'empty' as CellState })),
  );
}

function scoreGuess(guess: string, answer: string): CellState[] {
  const res: CellState[] = Array.from({ length: COLS }, () => 'absent');
  const counts: Record<string, number> = {};
  for (const ch of answer) counts[ch] = (counts[ch] ?? 0) + 1;
  for (let i = 0; i < COLS; i++) {
    if (guess[i] === answer[i]) {
      res[i] = 'correct';
      counts[guess[i]] -= 1;
    }
  }
  for (let i = 0; i < COLS; i++) {
    if (res[i] === 'correct') continue;
    const ch = guess[i];
    if ((counts[ch] ?? 0) > 0) {
      res[i] = 'present';
      counts[ch] -= 1;
    }
  }
  return res;
}

function Kalidle({ onScore }: GameProps) {
  const [answer, setAnswer] = useState<string>(WORDS[0]);
  const [board, setBoard] = useState<Cell[][]>(emptyBoard);
  const [row, setRow] = useState(0);
  const [current, setCurrent] = useState('');
  const [status, setStatus] = useState<'playing' | 'won' | 'lost'>('playing');
  const [keyStates, setKeyStates] = useState<Record<string, CellState>>({});
  const [flash, setFlash] = useState('');

  const pickWord = useCallback(() => WORDS[Math.floor(Math.random() * WORDS.length)], []);

  const newGame = useCallback(() => {
    setAnswer(pickWord());
    setBoard(emptyBoard());
    setRow(0);
    setCurrent('');
    setStatus('playing');
    setKeyStates({});
    setFlash('');
  }, [pickWord]);

  // Choose a random word once on mount (kept out of module scope per rules).
  useEffect(() => {
    setAnswer(pickWord());
  }, [pickWord]);

  const submit = useCallback(() => {
    if (status !== 'playing') return;
    if (current.length !== COLS) {
      setFlash('Need 5 letters');
      return;
    }
    const states = scoreGuess(current, answer);

    setBoard((prev) => {
      const next = prev.map((r) => r.map((c) => ({ ...c })));
      for (let i = 0; i < COLS; i++) next[row][i] = { letter: current[i], state: states[i] };
      return next;
    });

    setKeyStates((prev) => {
      const next = { ...prev };
      for (let i = 0; i < COLS; i++) {
        const ch = current[i];
        if (STATE_RANK[states[i]] > STATE_RANK[next[ch] ?? 'empty']) next[ch] = states[i];
      }
      return next;
    });

    if (current === answer) {
      setStatus('won');
      onScore?.((ROWS - row) * 100);
    } else if (row + 1 >= ROWS) {
      setStatus('lost');
      onScore?.(0);
    } else {
      setRow((r) => r + 1);
    }
    setCurrent('');
    setFlash('');
  }, [current, answer, row, status, onScore]);

  const press = useCallback(
    (key: string) => {
      if (status !== 'playing') return;
      if (key === 'ENTER') submit();
      else if (key === 'DEL') setCurrent((c) => c.slice(0, -1));
      else if (/^[A-Z]$/.test(key)) setCurrent((c) => (c.length < COLS ? c + key : c));
    },
    [status, submit],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') press('ENTER');
      else if (e.key === 'Backspace') press('DEL');
      else if (/^[a-zA-Z]$/.test(e.key)) press(e.key.toUpperCase());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press]);

  // Overlay the in-progress guess onto the active row.
  const view = board.map((r, ri) =>
    ri === row && status === 'playing'
      ? r.map((_, ci) => ({ letter: current[ci] ?? '', state: 'empty' as CellState }))
      : r,
  );

  return (
    <div
      className="kos-game"
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}
    >
      <div className="kos-game-hud">
        <span>Kalidle</span>
        {status !== 'playing' && (
          <button className="kos-game-btn" onClick={newGame}>
            Restart
          </button>
        )}
        <span className="kos-game-hint" aria-live="polite">
          {flash || 'Guess the 5-letter tech word'}
        </span>
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        {view.map((r, ri) => (
          <div key={ri} style={{ display: 'grid', gridTemplateColumns: `repeat(${COLS}, 1fr)`, gap: 6 }}>
            {r.map((c, ci) => (
              <div
                key={ci}
                style={{
                  width: 48,
                  height: 48,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 24,
                  fontWeight: 700,
                  color: c.state === 'empty' ? '#e6e6e6' : '#fff',
                  textTransform: 'uppercase',
                  border: `2px solid ${c.state === 'empty' ? '#4a4f5b' : STATE_BG[c.state]}`,
                  background: STATE_BG[c.state],
                  borderRadius: 4,
                  transition: 'background 0.15s, border-color 0.15s',
                }}
              >
                {c.letter}
              </div>
            ))}
          </div>
        ))}
      </div>

      {status === 'won' && <div className="kos-game-over">You got it! {answer}</div>}
      {status === 'lost' && <div className="kos-game-over">Out of tries — the word was {answer}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
        {KEY_ROWS.map((kr, ri) => (
          <div key={ri} style={{ display: 'flex', gap: 5 }}>
            {ri === 2 && <KeyBtn label="ENTER" wide onPress={() => press('ENTER')} />}
            {kr.split('').map((ch) => (
              <KeyBtn key={ch} label={ch} state={keyStates[ch]} onPress={() => press(ch)} />
            ))}
            {ri === 2 && <KeyBtn label="DEL" wide onPress={() => press('DEL')} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function KeyBtn({
  label,
  state,
  wide,
  onPress,
}: {
  label: string;
  state?: CellState;
  wide?: boolean;
  onPress: () => void;
}) {
  return (
    <button
      onClick={onPress}
      style={{
        minWidth: wide ? 52 : 30,
        height: 40,
        padding: '0 6px',
        border: 'none',
        borderRadius: 4,
        background: state ? STATE_BG[state] : '#5a6072',
        color: '#fff',
        fontWeight: 700,
        fontSize: wide ? 11 : 14,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

export const kalidleGame: GameDefinition = {
  id: 'kalidle',
  name: 'Kalidle',
  icon: '🟩',
  tagline: 'Guess the 5-letter tech word in six tries.',
  kind: 'solo',
  tags: ['word', 'puzzle'],
  component: Kalidle,
  weight: 85,
};
