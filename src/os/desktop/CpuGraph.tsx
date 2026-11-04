'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * xfce4-cpugraph in Kali's configuration: 128px wide, bar mode, #2777FF → #00FFE0.
 * The "load" is real-ish: event-loop lag (how late our timer fires) plus a little
 * jitter, so it twitches when the page is busy. Memory uses performance.memory
 * where Chromium exposes it.
 */
const W = 128;
const SAMPLES = 64;

interface PerfMemory {
  usedJSHeapSize: number;
  jsHeapSizeLimit: number;
}

export function CpuGraph({ height = 22 }: { height?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const hist = useRef<number[]>(Array.from({ length: SAMPLES }, () => 0.06 + Math.random() * 0.1));
  const [label, setLabel] = useState('CPU 4% · Mem —');

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    el.width = W * dpr;
    el.height = height * dpr;
    const ctx = el.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const PERIOD = 500;
    let last = performance.now();
    let smooth = 0.1;

    const draw = () => {
      ctx.clearRect(0, 0, W, height);
      const grad = ctx.createLinearGradient(0, height, 0, 0);
      grad.addColorStop(0, '#2777ff');
      grad.addColorStop(1, '#00ffe0');
      ctx.fillStyle = grad;
      const bw = W / SAMPLES;
      hist.current.forEach((v, i) => {
        const h = Math.max(1, Math.round(v * (height - 2)));
        ctx.fillRect(i * bw, height - h, Math.max(1, bw - 0.5), h);
      });
    };

    const tick = () => {
      const now = performance.now();
      const lag = Math.max(0, now - last - PERIOD);
      last = now;
      const target = Math.min(0.95, 0.07 + lag / 120 + Math.random() * 0.1 + (Math.random() < 0.08 ? 0.22 + Math.random() * 0.2 : 0));
      smooth = smooth * 0.55 + target * 0.45;
      hist.current = [...hist.current.slice(1), smooth];
      draw();
      const mem = (performance as unknown as { memory?: PerfMemory }).memory;
      const memText = mem ? `${Math.round(mem.usedJSHeapSize / 1048576)} MiB` : '—';
      setLabel(`CPU ${Math.round(smooth * 100)}% · Mem ${memText}`);
    };

    draw();
    const iv = setInterval(tick, PERIOD);
    return () => clearInterval(iv);
  }, [height]);

  return (
    <div className="kos-cpugraph" title={label} aria-label={label} role="img">
      <canvas ref={canvas} style={{ width: W, height }} />
    </div>
  );
}
