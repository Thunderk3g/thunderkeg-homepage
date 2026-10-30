'use client';

import { useOS } from '../store';
import { desktopApps } from '../registry';
import { Panel } from './Panel';
import { Window } from './Window';
import { WelcomeCard } from './WelcomeCard';

/** Touch screens have no comfortable double-click, so a single tap opens. */
const isCoarsePointer = () =>
  typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

export function Desktop() {
  const windows = useOS((s) => s.windows);
  const launch = useOS((s) => s.launch);
  const wallpaper = useOS((s) => s.settings.wallpaper);
  // the welcome card steps aside while an app is on screen
  const hasOpenWindow = windows.some((w) => !w.minimized);

  return (
    <div className={'kos-desktop wall-' + wallpaper}>
      <Panel />

      <div className={'kos-desktop-surface' + (hasOpenWindow ? ' has-windows' : '')}>
        <div className="kos-desktop-icons">
          {desktopApps.map((a) => (
            <button
              key={a.id}
              className="kos-desk-icon"
              // detail === 0 means the click came from the keyboard (Enter / Space)
              onClick={(e) => {
                if (e.detail === 0 || isCoarsePointer()) launch(a.id);
              }}
              onDoubleClick={() => launch(a.id)}
              title={`Open ${a.title}`}
            >
              <span className="kos-desk-icon-glyph">{a.icon}</span>
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
    </div>
  );
}
