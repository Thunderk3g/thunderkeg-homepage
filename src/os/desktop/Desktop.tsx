'use client';

import { useOS } from '../store';
import { desktopApps } from '../registry';
import { Panel } from './Panel';
import { Window } from './Window';

export function Desktop() {
  const windows = useOS((s) => s.windows);
  const launch = useOS((s) => s.launch);
  const wallpaper = useOS((s) => s.settings.wallpaper);

  return (
    <div className={'kos-desktop wall-' + wallpaper}>
      <Panel />

      <div className="kos-desktop-icons">
        {desktopApps.map((a) => (
          <button
            key={a.id}
            className="kos-desk-icon"
            onDoubleClick={() => launch(a.id)}
            title={`Open ${a.title}`}
          >
            <span className="kos-desk-icon-glyph">{a.icon}</span>
            <span className="kos-desk-icon-label">{a.title}</span>
          </button>
        ))}
      </div>

      <div className="kos-windows">
        {windows.map((w) => (
          <Window key={w.id} win={w} />
        ))}
      </div>
    </div>
  );
}
