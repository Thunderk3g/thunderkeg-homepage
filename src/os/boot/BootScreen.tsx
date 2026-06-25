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

export function BootScreen() {
  const finishBoot = useOS((s) => s.finishBoot);
  const reduced = useOS((s) => s.settings.reducedMotion);
  const [shown, setShown] = useState(0);
  const done = useRef(false);

  useEffect(() => {
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
