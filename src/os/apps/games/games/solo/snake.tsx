'use client';

import { useEffect, useRef, useState } from 'react';
import type { GameDefinition, GameProps } from '../../../../types';

const N = 17;
type P = { x: number; y: number };
const eq = (a: P, b: P) => a.x === b.x && a.y === b.y;

function Snake({ onScore }: GameProps) {
  const [snake, setSnake] = useState<P[]>([{ x: 8, y: 8 }]);
  const [food, setFood] = useState<P>({ x: 12, y: 8 });
  const [dir, setDir] = useState<P>({ x: 1, y: 0 });
  const [dead, setDead] = useState(false);
  const [score, setScore] = useState(0);
  const dirRef = useRef(dir);
  dirRef.current = dir;
  const runningRef = useRef(true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const d = dirRef.current;
      if (e.key === 'ArrowUp' && d.y !== 1) setDir({ x: 0, y: -1 });
      else if (e.key === 'ArrowDown' && d.y !== -1) setDir({ x: 0, y: 1 });
      else if (e.key === 'ArrowLeft' && d.x !== 1) setDir({ x: -1, y: 0 });
      else if (e.key === 'ArrowRight' && d.x !== -1) setDir({ x: 1, y: 0 });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (dead) return;
    const t = setInterval(() => {
      if (!runningRef.current) return;
      setSnake((prev) => {
        const d = dirRef.current;
        const head = { x: prev[0].x + d.x, y: prev[0].y + d.y };
        if (head.x < 0 || head.y < 0 || head.x >= N || head.y >= N || prev.some((s) => eq(s, head))) {
          setDead(true);
          runningRef.current = false;
          onScore?.(score);
          return prev;
        }
        const next = [head, ...prev];
        if (eq(head, food)) {
          setScore((s) => {
            const ns = s + 1;
            return ns;
          });
          let nf: P;
          do {
            nf = { x: Math.floor(Math.random() * N), y: Math.floor(Math.random() * N) };
          } while (next.some((s) => eq(s, nf)));
          setFood(nf);
        } else {
          next.pop();
        }
        return next;
      });
    }, 110);
    return () => clearInterval(t);
  }, [dead, food, score, onScore]);

  const restart = () => {
    setSnake([{ x: 8, y: 8 }]);
    setFood({ x: 12, y: 8 });
    setDir({ x: 1, y: 0 });
    setScore(0);
    setDead(false);
    runningRef.current = true;
  };

  return (
    <div className="kos-game kos-snake">
      <div className="kos-game-hud">
        <span>Score: {score}</span>
        {dead && <button className="kos-game-btn" onClick={restart}>Restart</button>}
        <span className="kos-game-hint">Arrow keys to move</span>
      </div>
      <div className="kos-snake-board" style={{ gridTemplateColumns: `repeat(${N}, 1fr)` }}>
        {Array.from({ length: N * N }).map((_, i) => {
          const x = i % N;
          const y = Math.floor(i / N);
          const isSnake = snake.some((s) => s.x === x && s.y === y);
          const isHead = snake[0].x === x && snake[0].y === y;
          const isFood = food.x === x && food.y === y;
          return (
            <div
              key={i}
              className={'kos-snake-cell' + (isHead ? ' head' : isSnake ? ' body' : isFood ? ' food' : '')}
            />
          );
        })}
      </div>
      {dead && <div className="kos-game-over">Game Over — score {score}</div>}
    </div>
  );
}

export const snakeGame: GameDefinition = {
  id: 'snake',
  name: 'Snake',
  icon: '🐍',
  tagline: 'Eat, grow, do not bite yourself.',
  kind: 'solo',
  tags: ['arcade', 'classic'],
  component: Snake,
  weight: 90,
};
