'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GameDefinition, GameProps } from '../../../../types';

const EMOJI = ['🦊', '🐼', '🐙', '🦋', '🐢', '🦉', '🐝', '🦄'] as const;
const PAIRS = EMOJI.length; // 8 pairs -> 16 cards (4x4)
const SIZE = PAIRS * 2;

interface Card {
  id: number;
  emoji: string;
  flipped: boolean;
  matched: boolean;
}

function shuffled(): Card[] {
  const emojis = [...EMOJI, ...EMOJI];
  for (let i = emojis.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [emojis[i], emojis[j]] = [emojis[j], emojis[i]];
  }
  // id === array index so flip(idx) can match by id reliably.
  return emojis.map((emoji, id) => ({ id, emoji, flipped: false, matched: false }));
}

function Memory({ onScore }: GameProps) {
  const [cards, setCards] = useState<Card[]>(() => shuffled());
  const [picked, setPicked] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [won, setWon] = useState(false);
  const lockRef = useRef(false);
  const startRef = useRef<number | null>(null);
  const reportedRef = useRef(false);

  const matchedCount = useMemo(() => cards.filter((c) => c.matched).length, [cards]);

  // Timer: starts on first flip, stops on win.
  useEffect(() => {
    if (won || startRef.current === null) return;
    const t = setInterval(() => {
      if (startRef.current !== null) {
        setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
      }
    }, 250);
    return () => clearInterval(t);
  }, [won, moves]);

  // Win detection + score report.
  useEffect(() => {
    if (matchedCount === SIZE && !won) {
      setWon(true);
      if (!reportedRef.current) {
        reportedRef.current = true;
        const secs = startRef.current ? Math.floor((Date.now() - startRef.current) / 1000) : 0;
        const score = Math.max(50, 2000 - moves * 25 - secs * 5);
        onScore?.(score);
      }
    }
  }, [matchedCount, won, moves, onScore]);

  const flip = useCallback(
    (idx: number) => {
      if (lockRef.current || won) return;
      setCards((prev) => {
        const card = prev[idx];
        if (card.flipped || card.matched) return prev;
        const open = prev.filter((c) => c.flipped && !c.matched);
        if (open.length >= 2) return prev;
        if (startRef.current === null) startRef.current = Date.now();
        const next = prev.map((c) => (c.id === idx ? { ...c, flipped: true } : c));
        const nowOpen = next.filter((c) => c.flipped && !c.matched);
        if (nowOpen.length === 2) {
          setMoves((m) => m + 1);
          setPicked(nowOpen.map((c) => c.id));
          lockRef.current = true;
          const [a, b] = nowOpen;
          if (a.emoji === b.emoji) {
            window.setTimeout(() => {
              setCards((cur) =>
                cur.map((c) => (c.id === a.id || c.id === b.id ? { ...c, matched: true } : c)),
              );
              setPicked([]);
              lockRef.current = false;
            }, 320);
          } else {
            window.setTimeout(() => {
              setCards((cur) =>
                cur.map((c) => (c.id === a.id || c.id === b.id ? { ...c, flipped: false } : c)),
              );
              setPicked([]);
              lockRef.current = false;
            }, 760);
          }
        }
        return next;
      });
    },
    [won],
  );

  const restart = useCallback(() => {
    setCards(shuffled());
    setPicked([]);
    setMoves(0);
    setElapsed(0);
    setWon(false);
    lockRef.current = false;
    startRef.current = null;
    reportedRef.current = false;
  }, []);

  // Keyboard: number/letter row not practical; support Enter/Space to restart on win.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (won && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        restart();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [won, restart]);

  const mmss = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;

  return (
    <div className="kos-game" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div className="kos-game-hud">
        <span>Moves: {moves}</span>
        <span>Time: {mmss}</span>
        <span>Pairs: {matchedCount / 2}/{PAIRS}</span>
        <button className="kos-game-btn" onClick={restart}>Restart</button>
      </div>

      <div
        role="grid"
        aria-label="Memory match grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 10,
          width: 360,
          maxWidth: '90%',
        }}
      >
        {cards.map((card, idx) => {
          const face = card.flipped || card.matched;
          const justPicked = picked.includes(card.id);
          return (
            <button
              key={card.id}
              role="gridcell"
              aria-label={face ? `Card ${card.emoji}` : 'Hidden card'}
              onClick={() => flip(idx)}
              disabled={face || won}
              style={{
                aspectRatio: '1 / 1',
                fontSize: 34,
                lineHeight: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: face || won ? 'default' : 'pointer',
                border: card.matched
                  ? '2px solid #34d399'
                  : justPicked
                    ? '2px solid #f472b6'
                    : '2px solid #2a3550',
                borderRadius: 10,
                background: face
                  ? 'linear-gradient(160deg, #1c2740, #131b2e)'
                  : 'linear-gradient(160deg, #2c3a5c, #1a2236)',
                color: '#e8eefc',
                opacity: card.matched ? 0.78 : 1,
                transition: 'border-color 120ms, opacity 200ms, transform 120ms',
                transform: face ? 'none' : 'scale(0.98)',
                userSelect: 'none',
              }}
            >
              {face ? card.emoji : ''}
            </button>
          );
        })}
      </div>

      {won && (
        <div className="kos-game-over">
          Cleared in {moves} moves and {mmss}! Press Enter to play again.
        </div>
      )}
      {!won && <div className="kos-game-hint">Flip two cards to find matching pairs.</div>}
    </div>
  );
}

export const memoryGame: GameDefinition = {
  id: 'memory',
  name: 'Memory Match',
  icon: '🧠',
  tagline: 'Flip the cards, find the pairs.',
  kind: 'solo',
  tags: ['puzzle', 'classic', 'memory'],
  component: Memory,
  weight: 80,
};
