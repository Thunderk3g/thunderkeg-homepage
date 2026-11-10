'use client';

import { useEffect, type CSSProperties } from 'react';
import { Toaster } from 'sonner';
import { useOS, isUndercover } from './store';
import { BootScreen } from './boot/BootScreen';
import { Greeter } from './boot/Greeter';
import { PowerOff } from './boot/PowerOff';
import { Desktop } from './desktop/Desktop';
import { CommandPalette } from './desktop/CommandPalette';
import { Shortcuts } from './desktop/Shortcuts';
import { AltTab } from './desktop/AltTab';
import { Teardown } from './teardown/Teardown';
import { panelHeight } from './desktop/layout';
import { getTheme } from './themes';

export default function KaliOS() {
  const phase = useOS((s) => s.phase);
  const accent = useOS((s) => s.settings.accent);
  const reduced = useOS((s) => s.settings.reducedMotion);
  const termOpacity = useOS((s) => s.settings.terminalOpacity);
  const themeId = useOS((s) => s.settings.theme);
  const hidpi = useOS((s) => s.settings.hidpi);
  const undercover = useOS(isUndercover);

  // HiDPI: the shell sizes most chrome in rem, so scale the root as well as .kos
  useEffect(() => {
    document.documentElement.style.fontSize = hidpi ? '114.3%' : '';
    return () => {
      document.documentElement.style.fontSize = '';
    };
  }, [hidpi]);

  const theme = getTheme(themeId);
  const style = {
    ...theme.vars,
    '--kos-accent': accent,
    '--kos-term-opacity': String(termOpacity),
  } as CSSProperties;

  const showDesktop = phase === 'desktop' || phase === 'locked';

  return (
    <div
      className="kos"
      style={style}
      data-theme={themeId}
      data-undercover={undercover ? 'true' : 'false'}
      data-reduced={reduced ? 'true' : 'false'}
      data-hidpi={hidpi ? 'true' : 'false'}
      data-phase={phase}
    >
      {phase === 'boot' && <BootScreen />}
      {showDesktop && <Desktop />}
      {(phase === 'login' || phase === 'locked') && <Greeter mode={phase === 'locked' ? 'lock' : 'login'} />}
      {phase === 'off' && <PowerOff />}
      {phase === 'desktop' && <CommandPalette />}
      {phase === 'desktop' && <AltTab />}
      {phase === 'desktop' && !undercover && <Teardown />}
      <Shortcuts />
      {/* xfce4-notifyd lives top-right under the panel; Undercover mode mutes it */}
      {!undercover && (
        <Toaster
          theme="dark"
          position="top-right"
          offset={{ top: panelHeight(false) + 10, right: 12 }}
          gap={8}
          visibleToasts={4}
          toastOptions={{
            unstyled: true,
            classNames: {
              toast: 'kos-notify',
              title: 'kos-notify-title',
              description: 'kos-notify-desc',
              icon: 'kos-notify-icon',
              actionButton: 'kos-notify-action',
              cancelButton: 'kos-notify-action',
            },
          }}
        />
      )}
    </div>
  );
}
