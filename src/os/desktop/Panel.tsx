'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useOS, isUndercover, WORKSPACE_COUNT } from '../store';
import { getApp } from '../registry';
import type { WindowState } from '../types';
import { AppIcon, KaliMark, SysIcon } from '../icons';
import { SystemTray } from './SystemTray';

/**
 * The Kali Xfce top panel (kali-defaults 2026.x), left → right:
 * Whisker · | · show desktop · places · launchers (editor, browser, terminal)
 * · | · pager · | · icon-only grouped tasklist · ⟷ · cpugraph · tray · clock · lock · logout.
 * In Undercover mode the same component becomes a Windows-style bottom taskbar.
 */
const LAUNCHERS = ['research', 'browser', 'terminal'];
const PLACES = [
  { label: 'Home', path: '/home/kali' },
  { label: 'Desktop', path: '/home/kali/Desktop' },
  { label: 'Documents', path: '/home/kali/Documents' },
  { label: 'Downloads', path: '/home/kali/Downloads' },
  { label: 'Projects', path: '/home/kali/projects' },
  { label: 'File System', path: '/' },
];

export function Panel() {
  const menuOpen = useOS((s) => s.menuOpen);
  const setMenuOpen = useOS((s) => s.setMenuOpen);
  const showDesktop = useOS((s) => s.showDesktop);
  const shownDesktop = useOS((s) => s.shownDesktop);
  const launch = useOS((s) => s.launch);
  const undercover = useOS(isUndercover);
  const [places, setPlaces] = useState(false);
  const placesRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!places) return;
    const onDown = (e: PointerEvent) => {
      if (!placesRef.current?.contains(e.target as Node)) setPlaces(false);
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [places]);

  return (
    <div className="kos-panel" role="toolbar" aria-label="Panel">
      <button
        className={'kos-panel-menu' + (menuOpen ? ' open' : '')}
        data-whisker-button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => setMenuOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        title={undercover ? 'Start' : 'Applications Menu (Super)'}
      >
        {undercover ? <AppIcon id="start" size={22} /> : <KaliMark size={20} className="kos-panel-mark" />}
        <span className="kos-panel-menu-label">{undercover ? '' : 'Applications'}</span>
      </button>

      {!undercover && (
        <>
          <span className="kos-panel-sep kos-hide-sm" />
          <button
            className={'kos-panel-btn kos-hide-sm' + (shownDesktop ? ' on' : '')}
            onClick={showDesktop}
            title="Show Desktop (Super+D)"
            aria-label="Show desktop"
          >
            <SysIcon name="show-desktop" size={16} />
          </button>
          <span className="kos-tray-pop kos-hide-sm" ref={placesRef}>
            <button
              className={'kos-panel-btn' + (places ? ' on' : '')}
              onClick={() => setPlaces((p) => !p)}
              title="Places"
              aria-label="Places"
            >
              <SysIcon name="folder" size={16} />
            </button>
            {places && (
              <div className="kos-popover left" role="menu">
                {PLACES.map((p) => (
                  <button
                    key={p.path}
                    role="menuitem"
                    className="kos-pop-item"
                    onClick={() => {
                      setPlaces(false);
                      launch('files', { path: p.path });
                    }}
                  >
                    <AppIcon id="folder" size={18} /> {p.label}
                  </button>
                ))}
              </div>
            )}
          </span>
          {LAUNCHERS.map((id) => {
            const app = getApp(id);
            if (!app) return null;
            return (
              <button
                key={id}
                className="kos-panel-btn kos-panel-launcher kos-hide-sm"
                onClick={() => launch(id)}
                title={app.title}
                aria-label={`Launch ${app.title}`}
              >
                <AppIcon id={id} size={20} fallback={app.icon} />
              </button>
            );
          })}
          <span className="kos-panel-sep kos-hide-sm" />
          <Pager />
          <span className="kos-panel-sep kos-hide-sm" />
        </>
      )}

      <TaskList />
      <SystemTray />
    </div>
  );
}

/** xfce4 workspace switcher with miniature window outlines. */
function Pager() {
  const active = useOS((s) => s.activeWorkspace);
  const setWorkspace = useOS((s) => s.setWorkspace);
  const windows = useOS((s) => s.windows);
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;

  return (
    <div className="kos-pager kos-hide-sm" role="tablist" aria-label="Workspaces">
      {Array.from({ length: WORKSPACE_COUNT }, (_, i) => {
        const ws = windows.filter((w) => (w.workspace ?? 0) === i && !w.minimized && !w.closing);
        return (
          <button
            key={i}
            role="tab"
            aria-selected={active === i}
            className={'kos-pager-ws' + (active === i ? ' active' : '')}
            onClick={() => setWorkspace(i)}
            title={`Workspace ${i + 1} (Ctrl+Alt+${i + 1})`}
          >
            {ws.map((w) => (
              <span
                key={w.id}
                className="kos-pager-win"
                style={{
                  left: `${(w.x / vw) * 100}%`,
                  top: `${(w.y / vh) * 100}%`,
                  width: `${(w.width / vw) * 100}%`,
                  height: `${(w.height / vh) * 100}%`,
                }}
              />
            ))}
            <span className="kos-pager-n">{i + 1}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Icon-only tasklist, grouped by application (Kali's default). */
function TaskList() {
  const windows = useOS((s) => s.windows);
  const active = useOS((s) => s.activeWorkspace);
  const focusedId = useOS((s) => s.focusedId);
  const toggleMinimize = useOS((s) => s.toggleMinimize);
  const focus = useOS((s) => s.focus);

  const groups = useMemo(() => {
    const map = new Map<string, WindowState[]>();
    for (const w of windows) {
      if ((w.workspace ?? 0) !== active || w.closing) continue;
      if (!map.has(w.appId)) map.set(w.appId, []);
      map.get(w.appId)!.push(w);
    }
    return [...map.entries()];
  }, [windows, active]);

  const activate = (group: WindowState[]) => {
    const focusedInGroup = group.find((w) => w.id === focusedId && !w.minimized);
    if (group.length === 1) {
      const w = group[0];
      if (focusedInGroup) toggleMinimize(w.id);
      else if (w.minimized) toggleMinimize(w.id);
      else focus(w.id);
      return;
    }
    // several windows: cycle through them, bottom-most first
    const sorted = [...group].sort((a, b) => a.z - b.z);
    const next = focusedInGroup ? sorted[0] : sorted[sorted.length - 1];
    if (next.minimized) toggleMinimize(next.id);
    else focus(next.id);
  };

  return (
    <div className="kos-taskbar" role="list">
      {groups.map(([appId, group]) => {
        const app = getApp(appId);
        const isActive = group.some((w) => w.id === focusedId && !w.minimized);
        const allMin = group.every((w) => w.minimized);
        const titles = group.map((w) => w.title).join('\n');
        return (
          <button
            key={appId}
            role="listitem"
            data-task-app={appId}
            className={'kos-task' + (isActive ? ' active' : '') + (allMin ? ' minimized' : '')}
            onClick={() => activate(group)}
            aria-label={titles}
          >
            <AppIcon id={appId} size={20} fallback={app?.icon ?? group[0].icon} />
            {group.length > 1 && <span className="kos-task-count">{group.length}</span>}
            <span className="kos-task-tip" role="tooltip">
              {group.map((w) => (
                <span key={w.id}>{w.title}</span>
              ))}
            </span>
          </button>
        );
      })}
    </div>
  );
}
