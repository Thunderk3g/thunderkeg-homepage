'use client';

import type { CSSProperties } from 'react';
import { Toaster } from 'sonner';
import { useOS } from './store';
import { BootScreen } from './boot/BootScreen';
import { Desktop } from './desktop/Desktop';
import { CommandPalette } from './desktop/CommandPalette';
import { getTheme } from './themes';

export default function KaliOS() {
  const phase = useOS((s) => s.phase);
  const accent = useOS((s) => s.settings.accent);
  const reduced = useOS((s) => s.settings.reducedMotion);
  const termOpacity = useOS((s) => s.settings.terminalOpacity);
  const themeId = useOS((s) => s.settings.theme);

  const theme = getTheme(themeId);
  const style = {
    ...theme.vars,
    '--kos-accent': accent,
    '--kos-term-opacity': String(termOpacity),
  } as CSSProperties;

  return (
    <div className="kos" style={style} data-reduced={reduced ? 'true' : 'false'}>
      {phase === 'boot' && <BootScreen />}
      {phase !== 'boot' && <Desktop />}
      {phase !== 'boot' && <CommandPalette />}
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{ style: { fontFamily: 'var(--font-ubuntu), sans-serif' } }}
      />
    </div>
  );
}
