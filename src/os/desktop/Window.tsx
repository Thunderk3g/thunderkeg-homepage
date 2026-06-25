'use client';

import { useRef } from 'react';
import type { WindowState } from '../types';
import { useOS } from '../store';
import { getApp } from '../registry';

const PANEL_H = 36;

export function Window({ win }: { win: WindowState }) {
  const focus = useOS((s) => s.focus);
  const close = useOS((s) => s.close);
  const minimize = useOS((s) => s.minimize);
  const toggleMaximize = useOS((s) => s.toggleMaximize);
  const move = useOS((s) => s.move);
  const setBounds = useOS((s) => s.setBounds);
  const focusedId = useOS((s) => s.focusedId);

  const app = getApp(win.appId);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const resize = useRef<{ sx: number; sy: number; sw: number; sh: number } | null>(null);

  if (!app) return null;
  const Body = app.component;
  const focused = focusedId === win.id;

  const startDrag = (e: React.PointerEvent) => {
    if (win.maximized) return;
    focus(win.id);
    drag.current = { dx: e.clientX - win.x, dy: e.clientY - win.y };
    const onMove = (ev: PointerEvent) => {
      if (!drag.current) return;
      const x = Math.max(-win.width + 80, Math.min(window.innerWidth - 80, ev.clientX - drag.current.dx));
      const y = Math.max(PANEL_H, Math.min(window.innerHeight - 40, ev.clientY - drag.current.dy));
      move(win.id, x, y);
    };
    const onUp = () => {
      drag.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const startResize = (e: React.PointerEvent) => {
    e.stopPropagation();
    focus(win.id);
    resize.current = { sx: e.clientX, sy: e.clientY, sw: win.width, sh: win.height };
    const min = app.minSize ?? { width: 280, height: 180 };
    const onMove = (ev: PointerEvent) => {
      if (!resize.current) return;
      const w = Math.max(min.width, resize.current.sw + (ev.clientX - resize.current.sx));
      const h = Math.max(min.height, resize.current.sh + (ev.clientY - resize.current.sy));
      setBounds(win.id, { width: w, height: h });
    };
    const onUp = () => {
      resize.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const style: React.CSSProperties = win.maximized
    ? { left: 0, top: PANEL_H, width: '100%', height: `calc(100% - ${PANEL_H}px)`, zIndex: win.z }
    : { left: win.x, top: win.y, width: win.width, height: win.height, zIndex: win.z };

  return (
    <div
      className={'kos-window' + (focused ? ' focused' : '') + (win.minimized ? ' minimized' : '')}
      style={style}
      onPointerDown={() => focus(win.id)}
      role="dialog"
      aria-label={win.title}
    >
      <div className="kos-titlebar" onPointerDown={startDrag} onDoubleClick={() => toggleMaximize(win.id)}>
        <span className="kos-title-icon">{win.icon}</span>
        <span className="kos-title-text">{win.title}</span>
        <div className="kos-title-actions" onPointerDown={(e) => e.stopPropagation()}>
          <button className="kos-tb-btn min" onClick={() => minimize(win.id)} aria-label="minimize">─</button>
          <button className="kos-tb-btn max" onClick={() => toggleMaximize(win.id)} aria-label="maximize">▢</button>
          <button className="kos-tb-btn close" onClick={() => close(win.id)} aria-label="close">✕</button>
        </div>
      </div>
      <div className="kos-window-body">
        <Body windowId={win.id} args={win.args} />
      </div>
      {!win.maximized && <div className="kos-resize-handle" onPointerDown={startResize} />}
    </div>
  );
}
