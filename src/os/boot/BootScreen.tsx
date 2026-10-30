'use client';

import { useEffect, useRef, useState } from 'react';
import { useOS } from '../store';

const LINES = [
  'GRUB loading Kali GNU/Linux …',
  '[    0.000000] Linux version 6.8.0-kali3-amd64',
  '[  OK  ] Reached target Basic System.',
  '[  OK  ] Started D-Bus System Message Bus.',
  '[  OK  ] Started NetworkManager.',
  '[  OK  ] Mounted /home.',
  '[  OK  ] Started Realtime multiplayer bridge.',
  '[  OK  ] Reached target Graphical Interface.',
  '[  OK  ] Started Light Display Manager.',
  'starting Xfce session …',
];

/** The boot log is a one-time flourish: replay it at most once per browser session. */
const BOOTED_KEY = 'kos-booted';

function alreadyBooted(): boolean {
  try {
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
  const reduced = useOS((s) => s.settings.reducedMotion);
  const [shown, setShown] = useState(0);
  const done = useRef(false);
  // read once on first render, so a dev-mode effect re-run doesn't see its own flag
  const skip = useRef(alreadyBooted());

  useEffect(() => {
    if (skip.current) {
      finishBoot();
      return;
    }
    markBooted();
    const step = reduced ? 40 : 170;
    const t = setInterval(() => {
      setShown((n) => {
        if (n >= LINES.length) {
          clearInterval(t);
          if (!done.current) {
            done.current = true;
            setTimeout(finishBoot, reduced ? 150 : 600);
          }
          return n;
        }
        return n + 1;
      });
    }, step);
    return () => clearInterval(t);
  }, [finishBoot, reduced]);

  if (skip.current) return null;

  return (
    <div className="kos-boot" onClick={finishBoot} title="click to skip">
      <pre className="kos-boot-logo">{KALI_LOGO}</pre>
      <div className="kos-boot-log">
        {LINES.slice(0, shown).map((l, i) => (
          <div key={i} className={l.includes('[  OK  ]') ? 'ok' : ''}>
            {l.includes('[  OK  ]') ? (
              <>
                <span className="kos-boot-ok">[  OK  ]</span>
                {l.replace('[  OK  ]', '')}
              </>
            ) : (
              l
            )}
          </div>
        ))}
        <span className="kos-boot-cursor">▋</span>
      </div>
      <div className="kos-boot-skip">click anywhere to skip</div>
    </div>
  );
}

const KALI_LOGO = String.raw`
      ..,;:cc:.
   .;cccccccc:'.        K A L I
 .:ccccccccccc:.        ---------
.ccccc;'  ':ccc.        GNU/Linux Rolling
ccc'        'cc.        web edition
'cc.        .cc'        portfolio of
 ':ccccccccccc:'        Diwakar Adhikari
   ':cccccccc;'
      '::::'
`;
