'use client';

import type { CSSProperties } from 'react';
import { useOS } from './store';
import { BootScreen } from './boot/BootScreen';
import { Desktop } from './desktop/Desktop';

export default function KaliOS() {
  const phase = useOS((s) => s.phase);
  const accent = useOS((s) => s.settings.accent);
  const reduced = useOS((s) => s.settings.reducedMotion);
  const termOpacity = useOS((s) => s.settings.terminalOpacity);

  const style = {
    '--kos-accent': accent,
    '--kos-term-opacity': String(termOpacity),
  } as CSSProperties;

  return (
    <div className="kos" style={style} data-reduced={reduced ? 'true' : 'false'}>
      {phase === 'boot' && <BootScreen />}
      {phase !== 'boot' && <Desktop />}
    </div>
  );
}
