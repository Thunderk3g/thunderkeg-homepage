'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameDefinition, GameProps } from '../../../../types';

const HOLES = 9;
const ROUND = 30;
const MISS_PENALTY = 1;

type Phase = 'ready' | 'playing' | 'over';

function WhackAMole({ onScore }: GameProps) {
  const [phase, setPhase] = useState<Phase>('ready');
  const [active, setActive] = useState<number>(-1);
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(ROUND);
  const [bonk, setBonk] = useState<number>(-1);

  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const scoreRef = useRef(score);
  scoreRef.current = score;

  // Game clock: tick down once per second, end the run at zero.
  useEffect(() => {
    if (phase !== 'playing') return;
    const t = setInterval(() => {
      setTime((s) => {
        if (s <= 1) {
          setPhase('over');
          setActive(-1);
          onScore?.(scoreRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [phase, onScore]);

  // Mole spawner: hop to a new hole on a shrinking-ish random interval.
  useEffect(() => {
    if (phase !== 'playing') return;
    let timer: ReturnType<typeof setTimeout>;
    const hop = () => {
      setActive((prev) => {
        let next = Math.floor(Math.random() * HOLES);
        if (next === prev) next = (next + 1) % HOLES;
        return next;
      });
      timer = setTimeout(hop, 550 + Math.floor(Math.random() * 500));
    };
    hop();
    return () => clearTimeout(timer);
  }, [phase]);

  const start = useCallback(() => {
    setScore(0);
    setTime(ROUND);
    setActive(-1);
    setBonk(-1);
    setPhase('playing');
  }, []);

  const whack = useCallback(
    (i: number) => {
      if (phaseRef.current !== 'playing') return;
      setBonk(i);
      window.setTimeout(() => setBonk((b) => (b === i ? -1 : b)), 130);
      setActive((cur) => {
        if (i === cur) {
          setScore((s) => s + 1);
          return -1; // mole was hit: clear until next hop
        }
        setScore((s) => Math.max(0, s - MISS_PENALTY));
        return cur;
      });
    },
    [],
  );

  // Keyboard: number keys 1-9 map to the grid, Enter/Space starts a round.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'Enter' || e.key === ' ') && phaseRef.current !== 'playing') {
        e.preventDefault();
        start();
        return;
      }
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= HOLES) whack(n - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [start, whack]);

  return (
    <div
      className="kos-game"
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, userSelect: 'none' }}
    >
      <div className="kos-game-hud">
        <span>Score: {score}</span>
        <span style={{ color: time <= 5 ? '#ff7676' : undefined }}>Time: {time}s</span>
        {phase !== 'playing' && (
          <button className="kos-game-btn" onClick={start}>
            {phase === 'over' ? 'Restart' : 'Start'}
          </button>
        )}
        <span className="kos-game-hint">Click moles · keys 1-9</span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 110px)',
          gridTemplateRows: 'repeat(3, 110px)',
          gap: 14,
          padding: 16,
          borderRadius: 16,
          background: 'radial-gradient(circle at 50% 30%, #2c5a2c, #173317)',
          boxShadow: 'inset 0 0 40px rgba(0,0,0,0.5)',
        }}
      >
        {Array.from({ length: HOLES }).map((_, i) => {
          const up = i === active && phase === 'playing';
          const hit = i === bonk;
          return (
            <button
              key={i}
              onMouseDown={() => whack(i)}
              aria-label={`hole ${i + 1}`}
              style={{
                position: 'relative',
                border: 'none',
                borderRadius: '50%',
                cursor: phase === 'playing' ? 'pointer' : 'default',
                background: 'radial-gradient(circle at 50% 75%, #1c1208 0%, #0c0804 70%)',
                boxShadow: 'inset 0 -8px 14px rgba(0,0,0,0.7)',
                overflow: 'hidden',
                padding: 0,
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: '70%',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'center',
                  fontSize: 52,
                  lineHeight: 1,
                  transform: up ? 'translateY(0%)' : 'translateY(110%)',
                  transition: 'transform 0.11s ease-out',
                  filter: hit ? 'brightness(1.6) saturate(0.4)' : undefined,
                }}
              >
                {hit && up ? '💥' : '🐹'}
              </span>
              <span
                style={{
                  position: 'absolute',
                  left: '14%',
                  right: '14%',
                  bottom: '8%',
                  height: '22%',
                  borderRadius: '50%',
                  background: 'rgba(0,0,0,0.55)',
                  pointerEvents: 'none',
                }}
              />
            </button>
          );
        })}
      </div>

      {phase === 'ready' && (
        <div className="kos-game-hint">Bonk every mole in 30 seconds. Misses cost a point.</div>
      )}
      {phase === 'over' && <div className="kos-game-over">Time! Final score {score}</div>}
    </div>
  );
}

export const whackamoleGame: GameDefinition = {
  id: 'whackamole',
  name: 'Whack-a-Mole',
  icon: '🐹',
  tagline: 'Bonk the moles before the clock runs out.',
  kind: 'solo',
  tags: ['arcade', 'reflex'],
  component: WhackAMole,
  weight: 80,
};
