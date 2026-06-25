'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { AppDefinition, AppProps } from '../../types';
import { getSupabase, getClientId } from '../../net/supabase';

const CHANNEL = 'kos:wb:board';
const COLORS = ['#33ff99', '#ff4d6d', '#4dabf7', '#ffd43b', '#ff922b', '#e599f7', '#ffffff', '#111111'];

interface Segment {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  color: string;
  width: number;
}

function drawSegment(ctx: CanvasRenderingContext2D, s: Segment) {
  ctx.strokeStyle = s.color;
  ctx.lineWidth = s.width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(s.x0, s.y0);
  ctx.lineTo(s.x1, s.y1);
  ctx.stroke();
}

function WhiteboardApp(_props: AppProps) {
  void _props;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  const [color, setColor] = useState<string>(COLORS[0]);
  const [width, setWidth] = useState<number>(3);
  const [online, setOnline] = useState<boolean>(false);
  const clientId = useRef<string>('');

  // Set up the drawing context once mounted.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctxRef.current = ctx;
    ctx.fillStyle = '#1a1f2b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  // Subscribe to the shared Supabase broadcast channel (degrade to local-only).
  useEffect(() => {
    clientId.current = getClientId();
    const supabase = getSupabase();
    if (!supabase) {
      setOnline(false);
      return;
    }
    const channel = supabase.channel(CHANNEL, { config: { broadcast: { self: false } } });
    channelRef.current = channel;

    channel.on('broadcast', { event: 'stroke' }, ({ payload }) => {
      const ctx = ctxRef.current;
      const seg = payload as Segment | null;
      if (!ctx || !seg) return;
      drawSegment(ctx, seg);
    });
    channel.on('broadcast', { event: 'clear' }, () => {
      const ctx = ctxRef.current;
      const canvas = canvasRef.current;
      if (!ctx || !canvas) return;
      ctx.fillStyle = '#1a1f2b';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    });

    channel.subscribe((s) => {
      setOnline(s === 'SUBSCRIBED');
    });

    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, []);

  const pointOf = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  }, []);

  const onDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      drawing.current = true;
      last.current = pointOf(e);
    },
    [pointOf],
  );

  const onMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawing.current || !last.current) return;
      const ctx = ctxRef.current;
      if (!ctx) return;
      const p = pointOf(e);
      const seg: Segment = {
        x0: last.current.x,
        y0: last.current.y,
        x1: p.x,
        y1: p.y,
        color,
        width,
      };
      drawSegment(ctx, seg);
      channelRef.current?.send({ type: 'broadcast', event: 'stroke', payload: seg });
      last.current = p;
    },
    [pointOf, color, width],
  );

  const onUp = useCallback(() => {
    drawing.current = false;
    last.current = null;
  }, []);

  const clear = useCallback(() => {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    ctx.fillStyle = '#1a1f2b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    channelRef.current?.send({ type: 'broadcast', event: 'clear', payload: {} });
  }, []);

  return (
    <div
      className="kos-game"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#0d1017',
        color: '#cdd6e4',
      }}
    >
      <div
        className="kos-game-hud"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 10px',
          flexWrap: 'wrap',
          borderBottom: '1px solid #1f2633',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600 }}>🎨 Whiteboard</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {COLORS.map((c) => (
            <button
              key={c}
              aria-label={'color ' + c}
              onClick={() => setColor(c)}
              style={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: c,
                border: color === c ? '2px solid #fff' : '2px solid #2a3242',
                cursor: 'pointer',
                padding: 0,
              }}
            />
          ))}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          size
          <input
            type="range"
            min={1}
            max={24}
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
            style={{ width: 90 }}
          />
        </label>
        <button
          className="kos-game-btn"
          onClick={clear}
          style={{
            marginLeft: 'auto',
            padding: '4px 12px',
            background: '#23314a',
            color: '#e6edf7',
            border: '1px solid #344767',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          Clear
        </button>
        <span
          className="kos-game-hint"
          style={{ fontSize: 11, color: online ? '#33ff99' : '#7a8494' }}
        >
          {online ? '● live' : '○ local-only'}
        </span>
      </div>
      <div style={{ flex: 1, minHeight: 0, padding: 8 }}>
        <canvas
          ref={canvasRef}
          width={960}
          height={600}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={onUp}
          style={{
            width: '100%',
            height: '100%',
            borderRadius: 8,
            border: '1px solid #1f2633',
            touchAction: 'none',
            cursor: 'crosshair',
            display: 'block',
          }}
        />
      </div>
    </div>
  );
}

export const whiteboardApp: AppDefinition = {
  id: 'whiteboard',
  title: 'Whiteboard',
  icon: '🎨',
  category: 'Accessories',
  component: WhiteboardApp,
  description: 'Shared multiplayer whiteboard',
  defaultSize: { width: 820, height: 600 },
  minSize: { width: 420, height: 340 },
  launchCommands: ['whiteboard', 'draw'],
};

export default WhiteboardApp;
