'use client';

import { useEffect, useRef } from 'react';
import { useOS } from '../store';
import { SysIcon } from '../icons';

/** xfce4-session-logout: "Log out kali" with Lock / Log Out / Restart / Shut Down. */
export function SessionDialog() {
  const user = useOS((s) => s.user);
  const close = useOS((s) => s.setSessionDialog);
  const lock = useOS((s) => s.lock);
  const logout = useOS((s) => s.logout);
  const restart = useOS((s) => s.restart);
  const shutdown = useOS((s) => s.shutdown);
  const first = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  const actions = [
    { id: 'logout', label: 'Log Out', icon: 'logout', run: logout },
    { id: 'restart', label: 'Restart', icon: 'restart', run: restart },
    { id: 'shutdown', label: 'Shut Down', icon: 'power', run: shutdown },
    { id: 'lock', label: 'Lock Screen', icon: 'lock', run: lock },
  ];

  return (
    <div className="kos-session-overlay" onPointerDown={() => close(false)}>
      <div
        className="kos-session"
        role="dialog"
        aria-modal="true"
        aria-label={`Log out ${user}`}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <h2>Log out {user}</h2>
        <div className="kos-session-actions">
          {actions.map((a, i) => (
            <button
              key={a.id}
              ref={i === 0 ? first : undefined}
              className={'kos-session-btn ' + a.id}
              onClick={() => {
                close(false);
                a.run();
              }}
            >
              <span className="kos-session-ico">
                <SysIcon name={a.icon} size={22} />
              </span>
              {a.label}
            </button>
          ))}
        </div>
        <div className="kos-session-foot">
          <button className="kos-btn" onClick={() => close(false)}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
