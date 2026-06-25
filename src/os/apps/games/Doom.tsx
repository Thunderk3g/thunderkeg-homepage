'use client';

import { useEffect, useRef, useState } from 'react';
import type { AppDefinition, AppProps } from '../../types';

/**
 * DOOM — runs the classic shareware build inside a dos.zone player iframe.
 *
 * The embed URL and the iframe `allow`/`sandbox` attributes are carried over
 * verbatim from the original portfolio implementation
 * (src/components/apps/games/doom/DoomApp.tsx), which used dos.zone — the
 * proven-working setup. We only swap Tailwind classes for inline styles so the
 * component is self-contained and matches the Kali OS app contract.
 */
const DOOM_EMBED_URL =
  'https://dos.zone/player/?bundleUrl=https%3A%2F%2Fcdn.dos.zone%2Fcustom%2Fdos%2Fdoom.jsdos&anonymous=1';

const MOBILE_BREAKPOINT_PX = 768;

function DoomApp(_props: AppProps) {
  // null = viewport not yet measured (SSR / first client paint). We avoid
  // flashing either branch until the effect resolves the real width.
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const update = () => setIsDesktop(window.innerWidth >= MOBILE_BREAKPOINT_PX);
    update();

    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const fill: React.CSSProperties = {
    width: '100%',
    height: '100%',
    boxSizing: 'border-box',
  };

  // Still measuring — render an inert filler so the window stays sized.
  if (isDesktop === null) {
    return <div style={{ ...fill, background: '#000' }} />;
  }

  if (!isDesktop) {
    return (
      <div
        style={{
          ...fill,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          padding: 24,
          textAlign: 'center',
          background: '#0a0a0a',
          color: '#e6e6e6',
        }}
      >
        <div aria-hidden style={{ fontSize: 48, lineHeight: 1 }}>
          💀
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <p style={{ margin: 0, fontFamily: 'monospace', fontSize: '1rem' }}>
            Best played on desktop
          </p>
          <p
            style={{
              margin: 0,
              fontFamily: 'monospace',
              fontSize: '0.78rem',
              opacity: 0.7,
            }}
          >
            DOOM needs a keyboard. Tap below to launch the game in a new tab.
          </p>
        </div>
        <a
          href={DOOM_EMBED_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="kos-game-btn primary"
          style={{ textDecoration: 'none' }}
        >
          Open in a new tab
        </a>
      </div>
    );
  }

  return (
    <div style={{ ...fill, position: 'relative', overflow: 'hidden', background: '#000' }}>
      <iframe
        ref={iframeRef}
        src={DOOM_EMBED_URL}
        title="DOOM (dos.zone)"
        allow="autoplay; fullscreen; gamepad; pointer-lock"
        sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-popups allow-forms"
        style={{ display: 'block', width: '100%', height: '100%', border: 0 }}
      />
    </div>
  );
}

export const doomApp: AppDefinition = {
  id: 'doom',
  title: 'DOOM',
  icon: '💀',
  category: 'Games',
  component: DoomApp,
  description: 'The 1993 classic, running in your browser',
  defaultSize: { width: 800, height: 600 },
  minSize: { width: 420, height: 320 },
  desktop: true,
  launchCommands: ['doom'],
};
