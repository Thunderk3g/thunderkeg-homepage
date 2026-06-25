'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameDefinition, GameProps } from '../../../../types';

const W = 480;
const H = 420;
const COLS = 9;
const ROWS = 5;
const BRICK_H = 18;
const BRICK_GAP = 4;
const PADDLE_W = 78;
const PADDLE_H = 12;
const BALL_R = 6;
const BRICK_W = (W - BRICK_GAP) / COLS - BRICK_GAP;
const ROW_COLORS = ['#ff5d73', '#ffa14a', '#ffe14a', '#5dd6a0', '#5db8ff'];

type Brick = { x: number; y: number; alive: boolean; color: string };
type State = {
  paddleX: number;
  ballX: number;
  ballY: number;
  vx: number;
  vy: number;
  bricks: Brick[];
};

function makeBricks(): Brick[] {
  const list: Brick[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      list.push({
        x: BRICK_GAP + c * (BRICK_W + BRICK_GAP),
        y: 36 + r * (BRICK_H + BRICK_GAP),
        alive: true,
        color: ROW_COLORS[r % ROW_COLORS.length],
      });
    }
  }
  return list;
}

function freshState(): State {
  return {
    paddleX: W / 2 - PADDLE_W / 2,
    ballX: W / 2,
    ballY: H - 60,
    vx: 3,
    vy: -3.4,
    bricks: makeBricks(),
  };
}

function Breakout({ onScore }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<State>(freshState());
  const runningRef = useRef(true);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [phase, setPhase] = useState<'play' | 'won' | 'lost'>('play');
  const scoreRef = useRef(0);
  const livesRef = useRef(3);

  const reset = useCallback(() => {
    stateRef.current = freshState();
    scoreRef.current = 0;
    livesRef.current = 3;
    runningRef.current = true;
    setScore(0);
    setLives(3);
    setPhase('play');
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const movePaddle = (clientX: number) => {
      const rect = canvas.getBoundingClientRect();
      const local = ((clientX - rect.left) / rect.width) * W;
      const s = stateRef.current;
      s.paddleX = Math.max(0, Math.min(W - PADDLE_W, local - PADDLE_W / 2));
    };
    const onMove = (e: MouseEvent) => movePaddle(e.clientX);
    const onKey = (e: KeyboardEvent) => {
      const s = stateRef.current;
      if (e.key === 'ArrowLeft') s.paddleX = Math.max(0, s.paddleX - 26);
      else if (e.key === 'ArrowRight') s.paddleX = Math.min(W - PADDLE_W, s.paddleX + 26);
    };
    canvas.addEventListener('mousemove', onMove);
    window.addEventListener('keydown', onKey);

    let raf = 0;
    const loop = () => {
      const s = stateRef.current;
      if (runningRef.current) {
        s.ballX += s.vx;
        s.ballY += s.vy;

        if (s.ballX < BALL_R) {
          s.ballX = BALL_R;
          s.vx = Math.abs(s.vx);
        } else if (s.ballX > W - BALL_R) {
          s.ballX = W - BALL_R;
          s.vx = -Math.abs(s.vx);
        }
        if (s.ballY < BALL_R) {
          s.ballY = BALL_R;
          s.vy = Math.abs(s.vy);
        }

        const paddleY = H - PADDLE_H - 6;
        if (
          s.vy > 0 &&
          s.ballY + BALL_R >= paddleY &&
          s.ballY + BALL_R <= paddleY + PADDLE_H + 4 &&
          s.ballX >= s.paddleX &&
          s.ballX <= s.paddleX + PADDLE_W
        ) {
          const hit = (s.ballX - (s.paddleX + PADDLE_W / 2)) / (PADDLE_W / 2);
          const speed = Math.min(6.5, Math.hypot(s.vx, s.vy) + 0.08);
          s.vx = hit * speed;
          s.vy = -Math.sqrt(Math.max(1, speed * speed - s.vx * s.vx));
          s.ballY = paddleY - BALL_R;
        }

        for (const b of s.bricks) {
          if (!b.alive) continue;
          if (
            s.ballX + BALL_R > b.x &&
            s.ballX - BALL_R < b.x + BRICK_W &&
            s.ballY + BALL_R > b.y &&
            s.ballY - BALL_R < b.y + BRICK_H
          ) {
            b.alive = false;
            const overlapX = Math.min(s.ballX + BALL_R - b.x, b.x + BRICK_W - (s.ballX - BALL_R));
            const overlapY = Math.min(s.ballY + BALL_R - b.y, b.y + BRICK_H - (s.ballY - BALL_R));
            if (overlapX < overlapY) s.vx = -s.vx;
            else s.vy = -s.vy;
            scoreRef.current += 10;
            setScore(scoreRef.current);
            break;
          }
        }

        if (!s.bricks.some((b) => b.alive)) {
          runningRef.current = false;
          setPhase('won');
          onScore?.(scoreRef.current);
        } else if (s.ballY - BALL_R > H) {
          livesRef.current -= 1;
          setLives(livesRef.current);
          if (livesRef.current <= 0) {
            runningRef.current = false;
            setPhase('lost');
            onScore?.(scoreRef.current);
          } else {
            s.ballX = W / 2;
            s.ballY = H - 60;
            s.vx = 3 * (Math.random() < 0.5 ? -1 : 1);
            s.vy = -3.4;
          }
        }
      }

      ctx.fillStyle = '#0b1220';
      ctx.fillRect(0, 0, W, H);
      for (const b of s.bricks) {
        if (!b.alive) continue;
        ctx.fillStyle = b.color;
        ctx.fillRect(b.x, b.y, BRICK_W, BRICK_H);
      }
      ctx.fillStyle = '#39ff88';
      ctx.fillRect(s.paddleX, H - PADDLE_H - 6, PADDLE_W, PADDLE_H);
      ctx.beginPath();
      ctx.fillStyle = '#ffffff';
      ctx.arc(s.ballX, s.ballY, BALL_R, 0, Math.PI * 2);
      ctx.fill();

      raf = window.requestAnimationFrame(loop);
    };
    raf = window.requestAnimationFrame(loop);

    return () => {
      window.cancelAnimationFrame(raf);
      canvas.removeEventListener('mousemove', onMove);
      window.removeEventListener('keydown', onKey);
    };
  }, [onScore]);

  return (
    <div className="kos-game">
      <div className="kos-game-hud">
        <span>Score: {score}</span>
        <span>Lives: {lives}</span>
        {phase !== 'play' && (
          <button className="kos-game-btn" onClick={reset}>
            Restart
          </button>
        )}
        <span className="kos-game-hint">Move mouse or ← → to steer</span>
      </div>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        style={{ width: W, height: H, borderRadius: 8, background: '#0b1220', cursor: 'none' }}
      />
      {phase !== 'play' && (
        <div className="kos-game-over">
          {phase === 'won' ? 'You cleared the wall! ' : 'Game Over — '}score {score}
        </div>
      )}
    </div>
  );
}

export const breakoutGame: GameDefinition = {
  id: 'breakout',
  name: 'Breakout',
  icon: '🧱',
  tagline: 'Bounce, smash every brick, do not drop the ball.',
  kind: 'solo',
  tags: ['arcade', 'classic'],
  component: Breakout,
  weight: 85,
};
