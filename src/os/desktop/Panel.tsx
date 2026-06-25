'use client';

import { useState } from 'react';
import { useOS } from '../store';
import { WhiskerMenu } from './WhiskerMenu';
import { SystemTray } from './SystemTray';

export function Panel() {
  const windows = useOS((s) => s.windows);
  const focusedId = useOS((s) => s.focusedId);
  const toggleMinimize = useOS((s) => s.toggleMinimize);
  const focus = useOS((s) => s.focus);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <div className="kos-panel">
        <button
          className={'kos-panel-menu' + (menuOpen ? ' open' : '')}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span className="kos-panel-dragon">🐉</span> Applications
        </button>

        <div className="kos-taskbar">
          {windows.map((w) => (
            <button
              key={w.id}
              className={
                'kos-task' +
                (focusedId === w.id ? ' active' : '') +
                (w.minimized ? ' minimized' : '')
              }
              onClick={() => {
                if (focusedId === w.id && !w.minimized) toggleMinimize(w.id);
                else if (w.minimized) toggleMinimize(w.id);
                else focus(w.id);
              }}
              title={w.title}
            >
              <span>{w.icon}</span>
              <span className="kos-task-label">{w.title}</span>
            </button>
          ))}
        </div>

        <SystemTray />
      </div>
      {menuOpen && <WhiskerMenu onClose={() => setMenuOpen(false)} />}
    </>
  );
}
