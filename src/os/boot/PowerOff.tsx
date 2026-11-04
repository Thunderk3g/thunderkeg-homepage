'use client';

import { useEffect, useState } from 'react';
import { useOS } from '../store';

/** After "Shut Down": a short systemd stop log, then the classic safe-to-close message. */
const STOP = [
  '[  OK  ] Stopped target graphical.target - Graphical Interface.',
  '[  OK  ] Stopped lightdm.service - Light Display Manager.',
  '[  OK  ] Stopped NetworkManager.service - Network Manager.',
  '[  OK  ] Unmounted home.mount - /home.',
  '[  OK  ] Reached target poweroff.target - System Power Off.',
];

export function PowerOff() {
  const restart = useOS((s) => s.restart);
  const [n, setN] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setN((x) => (x > STOP.length ? x : x + 1)), 140);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="kos-off">
      {n <= STOP.length ? (
        <div className="kos-boot-log">
          {STOP.slice(0, n).map((l, i) => (
            <div key={i} className="ok">
              [<span className="kos-boot-ok">  OK  </span>]{l.slice(8)}
            </div>
          ))}
        </div>
      ) : (
        <div className="kos-off-msg">
          <p>It is now safe to close this tab.</p>
          <button onClick={restart}>Power on</button>
        </div>
      )}
    </div>
  );
}
