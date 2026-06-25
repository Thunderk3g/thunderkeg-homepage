'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameDefinition, GameProps } from '../../../../types';

type Pad = 0 | 1 | 2 | 3;
type Phase = 'idle' | 'showing' | 'input' | 'over';

interface PadStyle {
  base: string;
  lit: string;
  freq: number;
}

const PADS: PadStyle[] = [
  { base: '#1f7a3f', lit: '#5cff96', freq: 415.30 }, // green
  { base: '#9a1f2f', lit: '#ff6b7a', freq: 311.13 }, // red
  { base: '#a98a14', lit: '#ffe066', freq: 252.00 }, // yellow
  { base: '#1f4f9a', lit: '#6db3ff', freq: 209.94 }, // blue
];

const FLASH_MS = 360;
const GAP_MS = 200;

function Simon({ onScore }: GameProps) {
  const [sequence, setSequence] = useState<Pad[]>([]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [active, setActive] = useState<Pad | null>(null);
  const [step, setStep] = useState(0);
  const [best, setBest] = useState(0);

  const timers = useRef<number[]>([]);
  const audioRef = useRef<AudioContext | null>(null);
  const mutedRef = useRef(false);
  const [muted, setMuted] = useState(false);

  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);

  const beep = useCallback((pad: Pad) => {
    if (mutedRef.current) return;
    try {
      type AC = typeof AudioContext;
      const Ctor: AC | undefined =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: AC }).webkitAudioContext;
      if (!Ctor) return;
      const ctx = audioRef.current ?? new Ctor();
      audioRef.current = ctx;
      if (ctx.state === 'suspended') void ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = PADS[pad].freq;
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.34);
    } catch {
      /* audio not available — flashing still works */
    }
  }, []);

  const flash = useCallback(
    (pad: Pad) => {
      beep(pad);
      setActive(pad);
      const t = window.setTimeout(() => setActive(null), FLASH_MS - 60);
      timers.current.push(t);
    },
    [beep],
  );

  const playSequence = useCallback(
    (seq: Pad[]) => {
      clearTimers();
      setPhase('showing');
      setStep(0);
      seq.forEach((pad, i) => {
        const t = window.setTimeout(() => {
          flash(pad);
          if (i === seq.length - 1) {
            const done = window.setTimeout(() => setPhase('input'), FLASH_MS);
            timers.current.push(done);
          }
        }, i * (FLASH_MS + GAP_MS) + 500);
        timers.current.push(t);
      });
    },
    [clearTimers, flash],
  );

  const extend = useCallback(
    (prev: Pad[]) => {
      const next: Pad[] = [...prev, Math.floor(Math.random() * 4) as Pad];
      setSequence(next);
      playSequence(next);
      return next;
    },
    [playSequence],
  );

  const start = useCallback(() => {
    clearTimers();
    setSequence([]);
    setStep(0);
    setActive(null);
    extend([]);
  }, [clearTimers, extend]);

  const fail = useCallback(() => {
    clearTimers();
    setActive(null);
    setPhase('over');
    const reached = sequence.length - 1; // rounds fully completed before the miss
    const finalScore = reached < 0 ? 0 : reached;
    setBest((b) => (finalScore > b ? finalScore : b));
    onScore?.(finalScore);
  }, [clearTimers, onScore, sequence.length]);

  const press = useCallback(
    (pad: Pad) => {
      if (phase !== 'input') return;
      flash(pad);
      if (sequence[step] !== pad) {
        fail();
        return;
      }
      const nextStep = step + 1;
      if (nextStep === sequence.length) {
        setStep(0);
        const t = window.setTimeout(() => extend(sequence), 650);
        timers.current.push(t);
      } else {
        setStep(nextStep);
      }
    },
    [phase, flash, sequence, step, fail, extend],
  );

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase === 'idle' || phase === 'over') {
        if (e.key === 'Enter' || e.key === ' ') start();
        return;
      }
      const map: Record<string, Pad> = { '1': 0, '2': 1, '3': 2, '4': 3 };
      const pad = map[e.key];
      if (pad !== undefined) press(pad);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, press, start]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const score = sequence.length === 0 ? 0 : sequence.length - 1;
  const canClick = phase === 'input';

  return (
    <div className="kos-game">
      <div className="kos-game-hud">
        <span>Round: {sequence.length}</span>
        <span>Best: {best}</span>
        <button className="kos-game-btn" onClick={() => setMuted((m) => !m)}>
          {muted ? '🔇 Muted' : '🔊 Sound'}
        </button>
        <span className="kos-game-hint">
          {phase === 'showing' ? 'Watch…' : phase === 'input' ? 'Your turn (keys 1-4)' : 'Press Start'}
        </span>
      </div>

      <div
        style={{
          position: 'relative',
          width: 320,
          height: 320,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: '1fr 1fr',
          gap: 10,
          borderRadius: '50%',
          padding: 14,
          background: 'rgba(255,255,255,0.04)',
          boxShadow: 'inset 0 0 24px rgba(0,0,0,0.5)',
        }}
      >
        {([0, 1, 2, 3] as Pad[]).map((pad) => {
          const lit = active === pad;
          const radii = ['100% 0 0 0', '0 100% 0 0', '0 0 0 100%', '0 0 100% 0'];
          return (
            <button
              key={pad}
              aria-label={`pad ${pad + 1}`}
              disabled={!canClick}
              onClick={() => press(pad)}
              style={{
                border: 'none',
                cursor: canClick ? 'pointer' : 'default',
                borderRadius: radii[pad],
                background: lit ? PADS[pad].lit : PADS[pad].base,
                boxShadow: lit ? `0 0 26px 4px ${PADS[pad].lit}` : 'inset 0 0 14px rgba(0,0,0,0.45)',
                opacity: lit ? 1 : 0.85,
                transition: 'background 90ms linear, box-shadow 90ms linear, opacity 90ms linear',
                outline: 'none',
              }}
            />
          );
        })}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            margin: 'auto',
            width: 96,
            height: 96,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            background: 'var(--kos-bg, #0b1622)',
            border: '1px solid var(--kos-border, #2a3a4a)',
            fontSize: '1.6rem',
            fontWeight: 700,
            color: 'var(--kos-text, #dfe9f3)',
            pointerEvents: 'none',
          }}
        >
          {score}
          <span style={{ fontSize: '0.6rem', fontWeight: 400, opacity: 0.6 }}>SCORE</span>
        </div>
      </div>

      {(phase === 'idle' || phase === 'over') && (
        <button className="kos-game-btn primary" onClick={start}>
          {phase === 'over' ? 'Restart' : 'Start'}
        </button>
      )}
      {phase === 'over' && <div className="kos-game-over">Game Over — score {score}</div>}
    </div>
  );
}

export const simonGame: GameDefinition = {
  id: 'simon',
  name: 'Simon',
  icon: '🎶',
  tagline: 'Watch the pattern, repeat it, watch it grow.',
  kind: 'solo',
  tags: ['memory', 'arcade', 'classic'],
  component: Simon,
  weight: 70,
};
