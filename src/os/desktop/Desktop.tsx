'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useOS } from '../store';
import { apps, getApp } from '../registry';
import type { AppDefinition } from '../types';
import { AppIcon, SysIcon } from '../icons';
import { Panel } from './Panel';
import { Window } from './Window';
import { WelcomeCard } from './WelcomeCard';
import { WhiskerMenu } from './WhiskerMenu';
import { SessionDialog } from './SessionDialog';
import { wallpaperFor } from './wallpapers';

/** Touch screens have no comfortable double-click, so a single tap opens. */
const isCoarsePointer = () =>
  typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

/**
 * Desktop launcher order. `vm` and `psql` are registered by other modules;
 * they show up here when present and are skipped silently when not.
 */
const DESKTOP_ORDER = [
  'terminal', 'files', 'browser', 'vm', 'psql', 'research', 'learning', 'writing',
  'ainews', 'assistant', 'code-editor', 'voice', 'games', 'doom',
];
const ALWAYS_ON_DESKTOP = new Set(['vm', 'psql']);

export function desktopLaunchers(): AppDefinition[] {
  const seen = new Set<string>();
  const out: AppDefinition[] = [];
  for (const id of DESKTOP_ORDER) {
    const a = getApp(id);
    if (a && (a.desktop || ALWAYS_ON_DESKTOP.has(id))) {
      out.push(a);
      seen.add(id);
    }
  }
  for (const a of apps) if (a.desktop && !seen.has(a.id)) out.push(a);
  return out;
}

interface Menu {
  x: number;
  y: number;
}

export function Desktop() {
  const windows = useOS((s) => s.windows);
  const activeWs = useOS((s) => s.activeWorkspace);
  const launch = useOS((s) => s.launch);
  const menuOpen = useOS((s) => s.menuOpen);
  const sessionDialog = useOS((s) => s.sessionDialog);
  const wallpaper = useOS((s) => wallpaperFor(s.settings));
  const [selected, setSelected] = useState<string | null>(null);
  const [ctx, setCtx] = useState<Menu | null>(null);
  const launchers = useMemo(desktopLaunchers, []);
  const iconsRef = useRef<HTMLDivElement>(null);

  // the welcome card steps aside while an app is on screen
  const hasOpenWindow = windows.some((w) => !w.minimized && !w.closing && (w.workspace ?? 0) === activeWs);

  useEffect(() => {
    if (!ctx) return;
    const close = () => setCtx(null);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
    };
  }, [ctx]);

  const onContext = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.kos-welcome')) return;
    e.preventDefault();
    const x = Math.min(e.clientX, window.innerWidth - 236);
    const y = Math.min(e.clientY, window.innerHeight - 280);
    setCtx({ x, y });
  };

  const run = (fn: () => void) => () => {
    setCtx(null);
    fn();
  };

  // arrow keys move the selection through the icon grid, Enter opens
  const onIconsKey = (e: React.KeyboardEvent) => {
    const idx = launchers.findIndex((a) => a.id === selected);
    const btns = iconsRef.current?.querySelectorAll<HTMLButtonElement>('.kos-desk-icon');
    if (!btns || !btns.length) return;
    let next = idx;
    if (e.key === 'ArrowDown') next = Math.min(launchers.length - 1, idx + 1);
    else if (e.key === 'ArrowUp') next = Math.max(0, idx - 1);
    else return;
    e.preventDefault();
    setSelected(launchers[next].id);
    btns[next].focus();
  };

  return (
    <div className="kos-desktop" onContextMenu={onContext}>
      <div className={'kos-wall wall-' + wallpaper} aria-hidden="true" />
      <Panel />

      <div
        className={'kos-desktop-surface' + (hasOpenWindow ? ' has-windows' : '')}
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) setSelected(null);
        }}
      >
        <div className="kos-desktop-icons" ref={iconsRef} onKeyDown={onIconsKey} role="list">
          {launchers.map((a, i) => (
            <button
              key={a.id}
              role="listitem"
              className={'kos-desk-icon' + (selected === a.id ? ' selected' : '')}
              style={{ ['--i' as string]: i }}
              onClick={(e) => {
                setSelected(a.id);
                // detail === 0 means the click came from the keyboard (Enter / Space)
                if (e.detail === 0 || isCoarsePointer()) launch(a.id);
              }}
              onDoubleClick={() => launch(a.id)}
              onFocus={() => setSelected(a.id)}
              title={a.description ? `${a.title} — ${a.description}` : a.title}
            >
              <AppIcon id={a.id} size={44} fallback={a.icon} className="kos-desk-icon-glyph" />
              <span className="kos-desk-icon-label">{a.title}</span>
            </button>
          ))}
        </div>

        <WelcomeCard />
      </div>

      <div className="kos-windows">
        {windows.map((w) => (
          <Window key={w.id} win={w} />
        ))}
      </div>

      {menuOpen && <WhiskerMenu />}
      {sessionDialog && <SessionDialog />}

      {ctx && (
        <div
          className="kos-ctx"
          role="menu"
          style={{ left: ctx.x, top: ctx.y }}
          onPointerDown={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <button role="menuitem" onClick={run(() => launch('terminal', { cwd: '/home/kali/Desktop' }))}>
            <SysIcon name="terminal" /> Open Terminal Here
          </button>
          <button
            role="menuitem"
            onClick={run(() => toast('Folder created', { description: '~/Desktop/Untitled Folder' }))}
          >
            <SysIcon name="folder-new" /> Create Folder…
          </button>
          <button role="menuitem" disabled>
            <SysIcon name="paste" /> Paste
          </button>
          <hr />
          <button role="menuitem" onClick={run(() => launch('settings', { page: 'wallpaper' }))}>
            <SysIcon name="image" /> Change Wallpaper…
          </button>
          <button role="menuitem" onClick={run(() => launch('settings', { page: 'appearance' }))}>
            <SysIcon name="desktop" /> Display Settings
          </button>
          <hr />
          <button role="menuitem" onClick={run(() => launch('settings', { page: 'about' }))}>
            <SysIcon name="info" /> About Kali OS
          </button>
        </div>
      )}
    </div>
  );
}
