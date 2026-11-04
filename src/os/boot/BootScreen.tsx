'use client';

import { useEffect, useRef, useState } from 'react';
import { useOS } from '../store';
import { KALI_MARK_PATH } from '../icons';
import { prefersReducedMotion } from '../desktop/layout';

/**
 * Boot: a Plymouth-style splash (the mark's outline draws itself and fills in
 * over a thin progress bar), then the systemd log, then the LightDM greeter.
 */
const LINES = [
  '[    0.000000] Linux version 6.8.11-amd64 (devel@kali.org) (gcc 13.2.0) #1 SMP PREEMPT_DYNAMIC',
  '[    0.412337] ACPI: PM-Timer IO Port: 0x608',
  '[  OK  ] Started systemd-journald.service - Journal Service.',
  '[  OK  ] Reached target local-fs.target - Local File Systems.',
  '[  OK  ] Started dbus.service - D-Bus System Message Bus.',
  '[  OK  ] Started NetworkManager.service - Network Manager.',
  '[  OK  ] Mounted home.mount - /home.',
  '[  OK  ] Mounted 9p portfolio share.',
  '[  OK  ] Started PostgreSQL 18 (PGlite).',
  '[  OK  ] Reached target graphical.target - Graphical Interface.',
  '[  OK  ] Started lightdm.service - Light Display Manager.',
];

/** The boot log is a one-time flourish: replay it at most once per browser session. */
const BOOTED_KEY = 'kos-booted';

function alreadyBooted(): boolean {
  try {
    if (new URLSearchParams(window.location.search).get('boot') === 'skip') return true;
    return sessionStorage.getItem(BOOTED_KEY) === '1';
  } catch {
    return false;
  }
}

function markBooted() {
  try {
    sessionStorage.setItem(BOOTED_KEY, '1');
  } catch {
    /* storage blocked — the boot just plays again next time */
  }
}

export function BootScreen() {
  const finishBoot = useOS((s) => s.finishBoot);
  const login = useOS((s) => s.login);
  const bootNonce = useOS((s) => s.bootNonce);
  const reducedSetting = useOS((s) => s.settings.reducedMotion);
  const [stage, setStage] = useState<'splash' | 'log'>('splash');
  const [shown, setShown] = useState(0);
  const done = useRef(false);
  // read once on first render, so a dev-mode effect re-run doesn't see its own flag;
  // a Restart (bootNonce > 0) always replays
  const skip = useRef(bootNonce === 0 && alreadyBooted());
  const reduced = reducedSetting || prefersReducedMotion();

  const finish = () => {
    if (done.current) return;
    done.current = true;
    finishBoot();
  };

  useEffect(() => {
    if (skip.current) {
      login();
      return;
    }
    markBooted();
    const t = setTimeout(() => setStage('log'), reduced ? 250 : 1500);
    return () => clearTimeout(t);
  }, [login, reduced]);

  useEffect(() => {
    if (stage !== 'log' || skip.current) return;
    const step = reduced ? 25 : 85;
    const t = setInterval(() => {
      setShown((n) => {
        if (n >= LINES.length) {
          clearInterval(t);
          setTimeout(finish, reduced ? 100 : 450);
          return n;
        }
        return n + 1;
      });
    }, step);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, reduced]);

  if (skip.current) return null;

  return (
    <div className={'kos-boot stage-' + stage} onClick={finish} title="click to skip">
      {stage === 'splash' ? (
        <div className="kos-splash" aria-label="Starting">
          <svg className="kos-splash-mark" viewBox="0 0 24 24" width="96" height="96" aria-hidden="true">
            <path className="kos-splash-fill" d={KALI_MARK_PATH} />
            <path className="kos-splash-line" d={KALI_MARK_PATH} pathLength={1} />
          </svg>
          <div className="kos-splash-bar">
            <span />
          </div>
        </div>
      ) : (
        <div className="kos-boot-log">
          {LINES.slice(0, shown).map((l, i) =>
            l.startsWith('[  OK  ]') ? (
              <div key={i} className="ok">
                [<span className="kos-boot-ok">  OK  </span>]{l.slice(8)}
              </div>
            ) : (
              <div key={i}>{l}</div>
            ),
          )}
          <span className="kos-boot-cursor">_</span>
        </div>
      )}
      <div className="kos-boot-skip">click to skip</div>
    </div>
  );
}
