'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameDefinition, GameProps } from '../../../../types';

const W = 360;
const H = 460;
const BIRD_X = 90;
const BIRD_R = 12;
const GRAVITY = 0.42;
const FLAP = -7;
const PIPE_W = 54;
const GAP = 140;
const SPEED = 2.3;
const SPAWN = 1500; // ms between pipes

type Pipe = { x: number; gapY: number; passed: boolean };

function Flappy({ onScore }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [dead, setDead] = useState(false);
  const [started, setStarted] = useState(false);

  // mutable game state lives in refs so rAF reads fresh values without re-binding
  const birdY = useRef(H / 2);
  const vel = useRef(0);
  const pipes = useRef<Pipe[]>([]);
  const lastSpawn = useRef(0);
  const scoreRef = useRef(0);
  const deadRef = useRef(false);
  const startedRef = useRef(false);

  const reset = useCallback(() => {
    birdY.current = H / 2;
    vel.current = 0;
    pipes.current = [];
    lastSpawn.current = 0;
    scoreRef.current = 0;
    deadRef.current = false;
    startedRef.current = false;
    setScore(0);
    setDead(false);
    setStarted(false);
  }, []);

  const flap = useCallback(() => {
    if (deadRef.current) return;
    if (!startedRef.current) {
      startedRef.current = true;
      setStarted(true);
    }
    vel.current = FLAP;
  }, []);

  // input: pointer + keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') {
        e.preventDefault();
        flap();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flap]);

  // main loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let prev = performance.now();

    const draw = () => {
      // sky
      ctx.fillStyle = '#0b1622';
      ctx.fillRect(0, 0, W, H);
      // pipes
      ctx.fillStyle = '#2bd4a8';
      for (const p of pipes.current) {
        ctx.fillRect(p.x, 0, PIPE_W, p.gapY);
        ctx.fillRect(p.x, p.gapY + GAP, PIPE_W, H - p.gapY - GAP);
      }
      // ground line
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.beginPath();
      ctx.moveTo(0, H - 1);
      ctx.lineTo(W, H - 1);
      ctx.stroke();
      // bird
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(BIRD_X, birdY.current, BIRD_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#04121f';
      ctx.beginPath();
      ctx.arc(BIRD_X + 4, birdY.current - 3, 2.4, 0, Math.PI * 2);
      ctx.fill();
    };

    const tick = (now: number) => {
      const dt = Math.min(2, (now - prev) / 16.67); // normalize to ~60fps steps
      prev = now;

      if (startedRef.current && !deadRef.current) {
        vel.current += GRAVITY * dt;
        birdY.current += vel.current * dt;

        // spawn a new pipe on a fixed interval (first one immediately)
        if (lastSpawn.current === 0 || now - lastSpawn.current > SPAWN) {
          lastSpawn.current = now;
          const gapY = 50 + Math.random() * (H - GAP - 100);
          pipes.current.push({ x: W, gapY, passed: false });
        }

        // move pipes + scoring
        for (const p of pipes.current) {
          p.x -= SPEED * dt;
          if (!p.passed && p.x + PIPE_W < BIRD_X) {
            p.passed = true;
            scoreRef.current += 1;
            setScore(scoreRef.current);
          }
        }
        pipes.current = pipes.current.filter((p) => p.x + PIPE_W > 0);

        // collisions
        let hit = birdY.current + BIRD_R > H || birdY.current - BIRD_R < 0;
        for (const p of pipes.current) {
          const inX = BIRD_X + BIRD_R > p.x && BIRD_X - BIRD_R < p.x + PIPE_W;
          const inGap = birdY.current - BIRD_R > p.gapY && birdY.current + BIRD_R < p.gapY + GAP;
          if (inX && !inGap) hit = true;
        }
        if (hit) {
          deadRef.current = true;
          setDead(true);
          onScore?.(scoreRef.current);
        }
      }

      draw();
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onScore]);

  const onCanvasPointer = (e: React.PointerEvent) => {
    e.preventDefault();
    if (deadRef.current) return;
    flap();
  };

  return (
    <div className="kos-game">
      <div className="kos-game-hud">
        <span>Score: {score}</span>
        {dead && (
          <button className="kos-game-btn primary" onClick={reset}>
            Restart
          </button>
        )}
        <span className="kos-game-hint">Click / Space to flap</span>
      </div>
      <div style={{ position: 'relative', width: W, height: H }}>
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          onPointerDown={onCanvasPointer}
          style={{
            display: 'block',
            borderRadius: 10,
            border: '1px solid var(--kos-border)',
            cursor: 'pointer',
            touchAction: 'none',
          }}
        />
        {!started && !dead && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: 8,
              color: 'var(--kos-text)',
              fontSize: '0.9rem',
              pointerEvents: 'none',
            }}
          >
            <strong style={{ fontSize: '1.1rem' }}>Flappy</strong>
            <span style={{ color: 'var(--kos-dim)' }}>Click or press Space to start</span>
          </div>
        )}
      </div>
      {dead && <div className="kos-game-over">Game Over — score {score}</div>}
    </div>
  );
}

export const flappyGame: GameDefinition = {
  id: 'flappy',
  name: 'Flappy',
  icon: '🐤',
  tagline: 'Flap through the pipes, do not fall.',
  kind: 'solo',
  tags: ['arcade', 'reflex'],
  component: Flappy,
  weight: 85,
};
