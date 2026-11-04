'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { SnapZone, WindowState } from '../types';
import { useOS, isUndercover } from '../store';
import { getApp } from '../registry';
import { AppIcon, SysIcon } from '../icons';
import { isPhone, prefersReducedMotion, snapRect, workArea, type Rect } from './layout';

/**
 * One xfwm4-style window. Dragging moves the element with a transform (no
 * store writes, no React renders per frame) and commits on release; edge
 * snapping previews the target; resizing works from all eight edges.
 * Open / close / minimise / restore are animated unless motion is reduced.
 */
type Edge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
const EDGES: Edge[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
const EDGE_HIT = 3; // px from the screen edge that triggers a snap

function useViewportTick() {
  const [, set] = useState(0);
  useEffect(() => {
    const on = () => set((n) => n + 1);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
}

export function Window({ win }: { win: WindowState }) {
  const focus = useOS((s) => s.focus);
  const close = useOS((s) => s.close);
  const minimize = useOS((s) => s.minimize);
  const toggleMaximize = useOS((s) => s.toggleMaximize);
  const snap = useOS((s) => s.snap);
  const unsnap = useOS((s) => s.unsnap);
  const move = useOS((s) => s.move);
  const setBounds = useOS((s) => s.setBounds);
  const focused = useOS((s) => s.focusedId === win.id);
  const activeWs = useOS((s) => s.activeWorkspace);
  const snapping = useOS((s) => s.settings.snapping);
  const reducedSetting = useOS((s) => s.settings.reducedMotion);
  const undercover = useOS(isUndercover);
  useViewportTick();

  const el = useRef<HTMLDivElement>(null);
  const [gesture, setGesture] = useState<'drag' | 'resize' | null>(null);
  const [preview, setPreview] = useState<SnapZone | null>(null);
  // lags win.minimized so the minimise animation can play before hiding
  const [hidden, setHidden] = useState(win.minimized);
  const restoring = useRef(false);

  const app = getApp(win.appId);
  const reduced = reducedSetting || prefersReducedMotion();
  const phone = isPhone();
  const tiled = win.maximized || phone ? 'max' : win.snapped;
  const rect: Rect = tiled ? snapRect(tiled, undercover) : win;

  /* ── minimise / restore animation (toward / from the tasklist button) ── */
  const taskRect = () => {
    const btn = document.querySelector<HTMLElement>(`[data-task-app="${CSS.escape(win.appId)}"]`);
    return btn?.getBoundingClientRect();
  };
  const genieTransform = () => {
    const t = taskRect();
    const node = el.current;
    if (!t || !node) return 'translateY(40px) scale(0.6)';
    const r = node.getBoundingClientRect();
    const dx = t.left + t.width / 2 - (r.left + r.width / 2);
    const dy = t.top + t.height / 2 - (r.top + r.height / 2);
    return `translate(${dx}px, ${dy}px) scale(${Math.max(0.06, t.width / r.width)})`;
  };

  useLayoutEffect(() => {
    const node = el.current;
    if (win.minimized && !hidden) {
      if (reduced || !node) return setHidden(true);
      const a = node.animate(
        [
          { transform: 'none', opacity: 1 },
          { transform: genieTransform(), opacity: 0 },
        ],
        { duration: 220, easing: 'cubic-bezier(.4,0,.2,1)' },
      );
      a.onfinish = () => setHidden(true);
      return () => a.cancel();
    }
    if (!win.minimized && hidden) {
      restoring.current = !reduced;
      setHidden(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [win.minimized]);

  useLayoutEffect(() => {
    if (hidden || !restoring.current || !el.current) return;
    restoring.current = false;
    el.current.animate(
      [
        { transform: genieTransform(), opacity: 0 },
        { transform: 'none', opacity: 1 },
      ],
      { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hidden]);

  if (!app) return null;
  const Body = app.component;
  const min = app.minSize ?? { width: 280, height: 180 };

  /* ── drag ── */
  const startDrag = (e: React.PointerEvent) => {
    if (e.button !== 0 || phone) return;
    if ((e.target as HTMLElement).closest('button')) return;
    const node = el.current;
    if (!node) return;
    focus(win.id);
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    const sx = e.clientX;
    const sy = e.clientY;
    let base: Rect = { ...rect };
    let started = false;
    let zone: SnapZone | null = null;
    const area = workArea(undercover);

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - sx;
      const dy = ev.clientY - sy;
      if (!started) {
        if (Math.abs(dx) + Math.abs(dy) < 4) return;
        started = true;
        setGesture('drag');
        if (tiled) {
          // pull a tiled window off the edge: restore its size under the pointer
          const rw = win.restore?.width ?? win.width;
          const rh = win.restore?.height ?? win.height;
          const ratio = (sx - base.x) / base.width;
          base = { x: Math.round(sx - rw * ratio), y: base.y, width: rw, height: rh };
          unsnap(win.id);
          setBounds(win.id, base);
        }
      }
      const nx = Math.max(-base.width + 80, Math.min(window.innerWidth - 80, base.x + dx));
      const ny = Math.max(area.y, Math.min(area.y + area.height - 34, base.y + dy));
      node.style.transform = `translate3d(${nx - base.x}px, ${ny - base.y}px, 0)`;
      let z: SnapZone | null = null;
      if (snapping) {
        if (ev.clientY <= area.y + EDGE_HIT || (undercover && ev.clientY <= EDGE_HIT)) z = 'max';
        else if (ev.clientX <= EDGE_HIT) z = 'left';
        else if (ev.clientX >= window.innerWidth - EDGE_HIT - 1) z = 'right';
      }
      if (z !== zone) {
        zone = z;
        setPreview(z);
      }
    };
    const onUp = (ev: PointerEvent) => {
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
      target.removeEventListener('pointercancel', onUp);
      node.style.transform = '';
      setPreview(null);
      setGesture(null);
      if (!started) return;
      if (zone) {
        snap(win.id, zone);
        return;
      }
      const dx = ev.clientX - sx;
      const dy = ev.clientY - sy;
      const nx = Math.max(-base.width + 80, Math.min(window.innerWidth - 80, base.x + dx));
      const ny = Math.max(area.y, Math.min(area.y + area.height - 34, base.y + dy));
      move(win.id, Math.round(nx), Math.round(ny));
    };
    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
    target.addEventListener('pointercancel', onUp);
  };

  /* ── resize from any edge ── */
  const startResize = (edge: Edge) => (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const node = el.current;
    if (!node) return;
    focus(win.id);
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    setGesture('resize');
    const sx = e.clientX;
    const sy = e.clientY;
    const b = { ...rect };
    const area = workArea(undercover);
    let out: Rect = b;

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - sx;
      const dy = ev.clientY - sy;
      let { x, y, width, height } = b;
      if (edge.includes('e')) width = Math.max(min.width, b.width + dx);
      if (edge.includes('s')) height = Math.max(min.height, b.height + dy);
      if (edge.includes('w')) {
        width = Math.max(min.width, b.width - dx);
        x = b.x + b.width - width;
      }
      if (edge.includes('n')) {
        const maxGrow = b.y - area.y;
        height = Math.max(min.height, Math.min(b.height + maxGrow, b.height - dy));
        y = b.y + b.height - height;
      }
      out = { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
      node.style.left = out.x + 'px';
      node.style.top = out.y + 'px';
      node.style.width = out.width + 'px';
      node.style.height = out.height + 'px';
    };
    const onUp = () => {
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
      target.removeEventListener('pointercancel', onUp);
      setGesture(null);
      setBounds(win.id, out);
    };
    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
    target.addEventListener('pointercancel', onUp);
  };

  const offWorkspace = (win.workspace ?? 0) !== activeWs;
  const style: React.CSSProperties = {
    left: rect.x,
    top: rect.y,
    width: rect.width,
    height: rect.height,
    zIndex: win.z,
  };
  const pv = preview ? snapRect(preview, undercover) : null;

  return (
    <>
      {pv && (
        <div
          className="kos-snap-preview"
          style={{ left: pv.x + 6, top: pv.y + 6, width: pv.width - 12, height: pv.height - 12, zIndex: win.z }}
          aria-hidden="true"
        />
      )}
      <div
        ref={el}
        className={
          'kos-window' +
          (focused ? ' focused' : '') +
          (hidden ? ' minimized' : '') +
          (offWorkspace ? ' off-ws' : '') +
          (tiled ? ' tiled tiled-' + tiled : '') +
          (gesture ? ' gesture' : '') +
          (win.closing ? ' closing' : '')
        }
        style={style}
        onPointerDownCapture={() => focus(win.id)}
        role="dialog"
        aria-label={win.title}
        aria-hidden={hidden || offWorkspace ? true : undefined}
        data-window-id={win.id}
        data-app={win.appId}
      >
        <div
          className="kos-titlebar"
          onPointerDown={startDrag}
          onDoubleClick={(e) => {
            if (!(e.target as HTMLElement).closest('button')) toggleMaximize(win.id);
          }}
        >
          <span className="kos-title-icon">
            <AppIcon id={win.appId} size={18} fallback={win.icon} />
          </span>
          <span className="kos-title-text">{win.title}</span>
          <div className="kos-title-actions">
            <button className="kos-tb-btn min" onClick={() => minimize(win.id)} aria-label="Minimize" title="Minimize">
              <SysIcon name="minimize" size={14} strokeWidth={2} />
            </button>
            <button
              className="kos-tb-btn max"
              onClick={() => toggleMaximize(win.id)}
              aria-label={win.maximized ? 'Restore' : 'Maximize'}
              title={win.maximized ? 'Restore' : 'Maximize'}
            >
              <SysIcon name={win.maximized ? 'restore' : 'maximize'} size={12} strokeWidth={2} />
            </button>
            <button className="kos-tb-btn close" onClick={() => close(win.id)} aria-label="Close" title="Close">
              <SysIcon name="close" size={15} strokeWidth={2} />
            </button>
          </div>
        </div>
        <div className="kos-window-body">
          <Body windowId={win.id} args={win.args} />
        </div>
        {!tiled &&
          EDGES.map((edge) => (
            <div key={edge} className={'kos-rz kos-rz-' + edge} onPointerDown={startResize(edge)} aria-hidden="true" />
          ))}
      </div>
    </>
  );
}
