'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameDefinition, GameProps } from '../../../../types';

const W = 560;
const H = 400;
const PADDLE_H = 70;
const PADDLE_W = 10;
const BALL = 8;
const WIN_SCORE = 7;
const PLAYER_X = 24;
const CPU_X = W - 24 - PADDLE_W;

type Ball = { x: number; y: number; vx: number; vy: number };

function makeBall(toLeft: boolean): Ball {
  const angle = (Math.random() * 0.6 - 0.3) * Math.PI;
  const speed = 4.4;
  return {
    x: W / 2,
    y: H / 2,
    vx: Math.cos(angle) * speed * (toLeft ? -1 : 1),
    vy: Math.sin(angle) * speed,
  };
}

function PongCpu({ onScore }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [playerScore, setPlayerScore] = useState(0);
  const [cpuScore, setCpuScore] = useState(0);
  const [over, setOver] = useState(false);
  const [round, setRound] = useState(0);

  // Mutable game state lives in refs so the rAF loop never goes stale.
  const playerY = useRef((H - PADDLE_H) / 2);
  const cpuY = useRef((H - PADDLE_H) / 2);
  const ball = useRef<Ball>(makeBall(false));
  const pScore = useRef(0);
  const cScore = useRef(0);
  const finished = useRef(false);
  const keys = useRef({ up: false, down: false });

  const reset = useCallback(() => {
    playerY.current = (H - PADDLE_H) / 2;
    cpuY.current = (H - PADDLE_H) / 2;
    ball.current = makeBall(Math.random() < 0.5);
    pScore.current = 0;
    cScore.current = 0;
    finished.current = false;
    setPlayerScore(0);
    setCpuScore(0);
    setOver(false);
    setRound((r) => r + 1);
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') keys.current.up = true;
      else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') keys.current.down = true;
      else return;
      e.preventDefault();
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') keys.current.up = false;
      else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') keys.current.down = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const ratio = H / rect.height;
      const y = (e.clientY - rect.top) * ratio - PADDLE_H / 2;
      playerY.current = Math.max(0, Math.min(H - PADDLE_H, y));
    };
    canvas.addEventListener('mousemove', onMove);

    const step = () => {
      if (!finished.current) {
        // Keyboard paddle movement.
        if (keys.current.up) playerY.current -= 6;
        if (keys.current.down) playerY.current += 6;
        playerY.current = Math.max(0, Math.min(H - PADDLE_H, playerY.current));

        // CPU tracks the ball with a capped reaction speed (gives it beatable lag).
        const cpuCenter = cpuY.current + PADDLE_H / 2;
        const diff = ball.current.y - cpuCenter;
        cpuY.current += Math.max(-4.6, Math.min(4.6, diff));
        cpuY.current = Math.max(0, Math.min(H - PADDLE_H, cpuY.current));

        const b = ball.current;
        b.x += b.vx;
        b.y += b.vy;

        // Top / bottom walls.
        if (b.y - BALL < 0) {
          b.y = BALL;
          b.vy = Math.abs(b.vy);
        } else if (b.y + BALL > H) {
          b.y = H - BALL;
          b.vy = -Math.abs(b.vy);
        }

        // Player paddle.
        if (
          b.vx < 0 &&
          b.x - BALL <= PLAYER_X + PADDLE_W &&
          b.x - BALL >= PLAYER_X &&
          b.y >= playerY.current &&
          b.y <= playerY.current + PADDLE_H
        ) {
          b.x = PLAYER_X + PADDLE_W + BALL;
          b.vx = Math.abs(b.vx) * 1.05;
          b.vy += ((b.y - (playerY.current + PADDLE_H / 2)) / (PADDLE_H / 2)) * 2.4;
        }

        // CPU paddle.
        if (
          b.vx > 0 &&
          b.x + BALL >= CPU_X &&
          b.x + BALL <= CPU_X + PADDLE_W &&
          b.y >= cpuY.current &&
          b.y <= cpuY.current + PADDLE_H
        ) {
          b.x = CPU_X - BALL;
          b.vx = -Math.abs(b.vx) * 1.05;
          b.vy += ((b.y - (cpuY.current + PADDLE_H / 2)) / (PADDLE_H / 2)) * 2.4;
        }

        // Scoring.
        if (b.x < -BALL) {
          cScore.current += 1;
          setCpuScore(cScore.current);
          if (cScore.current >= WIN_SCORE) {
            finished.current = true;
            setOver(true);
            onScore?.(pScore.current);
          } else {
            ball.current = makeBall(false);
          }
        } else if (b.x > W + BALL) {
          pScore.current += 1;
          setPlayerScore(pScore.current);
          if (pScore.current >= WIN_SCORE) {
            finished.current = true;
            setOver(true);
            onScore?.(pScore.current);
          } else {
            ball.current = makeBall(true);
          }
        }
      }

      // ── Render ──
      ctx.fillStyle = '#0a0e14';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(120, 220, 160, 0.25)';
      ctx.setLineDash([8, 12]);
      ctx.beginPath();
      ctx.moveTo(W / 2, 0);
      ctx.lineTo(W / 2, H);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#6ee7a8';
      ctx.fillRect(PLAYER_X, playerY.current, PADDLE_W, PADDLE_H);
      ctx.fillStyle = '#f78c8c';
      ctx.fillRect(CPU_X, cpuY.current, PADDLE_W, PADDLE_H);

      ctx.fillStyle = '#e8eef2';
      ctx.beginPath();
      ctx.arc(ball.current.x, ball.current.y, BALL, 0, Math.PI * 2);
      ctx.fill();

      raf = window.requestAnimationFrame(step);
    };
    raf = window.requestAnimationFrame(step);

    return () => {
      window.cancelAnimationFrame(raf);
      canvas.removeEventListener('mousemove', onMove);
    };
  }, [onScore, round]);

  const playerWon = playerScore >= WIN_SCORE;

  return (
    <div className="kos-game">
      <div className="kos-game-hud">
        <span style={{ color: '#6ee7a8' }}>You {playerScore}</span>
        <span style={{ opacity: 0.6 }}>—</span>
        <span style={{ color: '#f78c8c' }}>{cpuScore} CPU</span>
        {over && (
          <button className="kos-game-btn" onClick={reset}>
            Restart
          </button>
        )}
        <span className="kos-game-hint">Mouse or W/S · Arrow keys · first to {WIN_SCORE}</span>
      </div>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        style={{
          width: '100%',
          maxWidth: W,
          aspectRatio: `${W} / ${H}`,
          borderRadius: 8,
          border: '1px solid rgba(120, 220, 160, 0.25)',
          cursor: 'none',
          display: 'block',
        }}
      />
      {over && (
        <div className="kos-game-over">
          {playerWon ? 'You win!' : 'CPU wins'} — {playerScore} : {cpuScore}
        </div>
      )}
    </div>
  );
}

export const pongCpuGame: GameDefinition = {
  id: 'pongcpu',
  name: 'Pong vs CPU',
  icon: '🏓',
  tagline: 'Outvolley the machine — first to 7 takes it.',
  kind: 'solo',
  tags: ['arcade', 'classic'],
  component: PongCpu,
  weight: 80,
};
