'use client';

import { useEffect, useRef, useState } from 'react';
import { useOS } from '../store';
import { AppIcon } from '../icons';
import { isTypingTarget } from './layout';

/**
 * xfwm4 Alt+Tab cycler: hold Alt, tap Tab (Shift+Tab backwards), release Alt
 * to switch. Lists the current workspace's windows, most recent first.
 */
export function AltTab() {
  const [order, setOrder] = useState<string[] | null>(null);
  const [idx, setIdx] = useState(0);
  const state = useRef({ order: null as string[] | null, idx: 0 });
  const windows = useOS((s) => s.windows);

  useEffect(() => {
    const commit = () => {
      const { order: o, idx: i } = state.current;
      if (o && o[i]) {
        const s = useOS.getState();
        const w = s.windows.find((x) => x.id === o[i]);
        if (w?.minimized) s.toggleMinimize(w.id);
        else if (w) s.focus(w.id);
      }
      state.current = { order: null, idx: 0 };
      setOrder(null);
    };
    const onDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !e.altKey || e.ctrlKey || e.metaKey) return;
      if (isTypingTarget(e.target) === 'xterm') return;
      e.preventDefault();
      e.stopPropagation();
      const dir = e.shiftKey ? -1 : 1;
      if (!state.current.order) {
        const s = useOS.getState();
        const list = s.windows
          .filter((w) => (w.workspace ?? 0) === s.activeWorkspace && !w.closing)
          .sort((a, b) => {
            // minimised windows go last, otherwise stacking order
            if (a.minimized !== b.minimized) return a.minimized ? 1 : -1;
            return b.z - a.z;
          })
          .map((w) => w.id);
        if (!list.length) return;
        const start = list.length > 1 ? (dir > 0 ? 1 : list.length - 1) : 0;
        state.current = { order: list, idx: start };
      } else {
        const n = state.current.order.length;
        state.current.idx = (state.current.idx + dir + n) % n;
      }
      setOrder(state.current.order);
      setIdx(state.current.idx);
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt' && state.current.order) commit();
    };
    const onBlur = () => state.current.order && commit();
    window.addEventListener('keydown', onDown, true);
    window.addEventListener('keyup', onUp, true);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onDown, true);
      window.removeEventListener('keyup', onUp, true);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  if (!order) return null;
  const items = order.map((id) => windows.find((w) => w.id === id)).filter(Boolean);

  return (
    <div className="kos-alttab-overlay" aria-live="polite">
      <div className="kos-alttab" role="listbox" aria-label="Switch windows">
        {items.map((w, i) => (
          <div
            key={w!.id}
            role="option"
            aria-selected={i === idx}
            className={'kos-alttab-item' + (i === idx ? ' sel' : '') + (w!.minimized ? ' min' : '')}
            onPointerDown={(e) => {
              e.preventDefault();
              state.current.idx = i;
              setIdx(i);
            }}
          >
            <AppIcon id={w!.appId} size={48} fallback={w!.icon} />
            <span className="kos-alttab-title">{w!.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
