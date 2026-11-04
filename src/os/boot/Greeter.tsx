'use client';

import { useEffect, useRef, useState } from 'react';
import { useOS } from '../store';
import { SysIcon } from '../icons';
import { useClock } from '../desktop/useClock';
import { wallpaperFor } from '../desktop/wallpapers';

/**
 * LightDM GTK greeter, Kali-Light flavour: a light card on a blurred
 * wallpaper, indicator row top-right (host · session · a11y · clock · power).
 * Doubles as the lock screen (`mode="lock"`), which keeps the session and
 * shows a big clock.
 */
export function Greeter({ mode }: { mode: 'login' | 'lock' }) {
  const login = useOS((s) => s.login);
  const user = useOS((s) => s.user);
  const host = useOS((s) => s.host);
  const restart = useOS((s) => s.restart);
  const shutdown = useOS((s) => s.shutdown);
  const wallpaper = useOS((s) => wallpaperFor(s.settings));
  const clock24 = useOS((s) => s.settings.clock24);
  const now = useClock(1000);
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [powerOpen, setPowerOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, []);

  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: !clock24 });
  const indicator = `${now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}, ${time}`;
  const longDate = now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (busy) return;
    setBusy(true);
    // a beat of "authenticating", like PAM
    setTimeout(() => login(user), 260);
  };

  return (
    <div className={'kos-greeter mode-' + mode}>
      <div className={'kos-greeter-wall kos-wall wall-' + wallpaper} aria-hidden="true" />
      <div className="kos-greeter-bar">
        <span className="kos-greeter-host">{host}</span>
        <span className="kos-greeter-spacer" />
        <span className="kos-greeter-ind" title="Session: Xfce Session">
          <SysIcon name="desktop" size={14} />
        </span>
        <span className="kos-greeter-ind" title="Accessibility">
          <SysIcon name="a11y" size={14} />
        </span>
        <span className="kos-greeter-ind kos-greeter-clock">{indicator}</span>
        <span className="kos-greeter-power">
          <button className="kos-greeter-ind" aria-label="Power" onClick={() => setPowerOpen((o) => !o)}>
            <SysIcon name="power" size={14} />
          </button>
          {powerOpen && (
            <div className="kos-greeter-menu" role="menu">
              <button role="menuitem" onClick={restart}>
                <SysIcon name="restart" size={14} /> Restart
              </button>
              <button role="menuitem" onClick={shutdown}>
                <SysIcon name="power" size={14} /> Shut Down
              </button>
            </div>
          )}
        </span>
      </div>

      {mode === 'lock' && (
        <div className="kos-greeter-bigclock" aria-hidden="true">
          <div className="t">{time}</div>
          <div className="d">{longDate}</div>
        </div>
      )}

      <form className={'kos-greeter-card' + (busy ? ' busy' : '')} onSubmit={submit}>
        <div className="kos-avatar lg" aria-hidden="true">
          DA
        </div>
        <div className="kos-greeter-user">{user}</div>
        <div className="kos-greeter-sub">{mode === 'lock' ? 'This session is locked' : 'Diwakar Adhikari'}</div>
        <div className="kos-greeter-field">
          <input
            ref={inputRef}
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="Password"
            aria-label="Password"
            autoComplete="off"
          />
          <button type="submit" aria-label={mode === 'lock' ? 'Unlock' : 'Log in'}>
            <SysIcon name="forward" size={16} />
          </button>
        </div>
        <div className="kos-greeter-hint">any password works</div>
      </form>

      <div className="kos-greeter-foot">
        Kali-inspired web desktop · KALI LINUX ™ is a trademark of OffSec
      </div>
    </div>
  );
}
