'use client';

import { useEffect, useRef, useState } from 'react';
import { Skull } from 'lucide-react';
import FocusHint from './FocusHint';

// Iframe URL recovered from the prior implementation in
// src/components/desktop/games/Doom.tsx (deleted in commit 5275157).
// dos.zone embeds were the proven-working setup in the existing portfolio.
const DOOM_EMBED_URL =
  'https://dos.zone/player/?bundleUrl=https%3A%2F%2Fcdn.dos.zone%2Fcustom%2Fdos%2Fdoom.jsdos&anonymous=1';

const MOBILE_BREAKPOINT_PX = 768;

export default function DoomApp() {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Start as null so SSR renders nothing branch-specific; the effect below
  // resolves the actual viewport width on the client.
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const update = () => {
      setIsDesktop(window.innerWidth >= MOBILE_BREAKPOINT_PX);
    };
    update();

    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // While the viewport is still unknown (first SSR/client paint), render an
  // empty wrapper so we don't flash either branch.
  if (isDesktop === null) {
    return <div ref={wrapperRef} className="h-full w-full bg-bg" />;
  }

  if (!isDesktop) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-surface p-6 text-center">
        <Skull aria-hidden className="h-12 w-12 text-accent" />
        <div className="space-y-1">
          <p className="font-mono text-base text-fg">Best played on desktop</p>
          <p className="font-mono text-xs text-muted">
            DOOM needs a keyboard. Tap below to launch the game in a new tab.
          </p>
        </div>
        <a
          href={DOOM_EMBED_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-accent bg-elevated px-4 py-2 font-mono text-sm text-accent transition-colors hover:bg-accent hover:text-bg"
        >
          Open in a new tab
        </a>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="relative h-full w-full overflow-hidden bg-bg">
      <iframe
        ref={iframeRef}
        src={DOOM_EMBED_URL}
        title="DOOM (dos.zone)"
        allow="autoplay; fullscreen; gamepad; pointer-lock"
        sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-popups allow-forms"
        className="h-full w-full border-0"
      />
      <FocusHint iframeRef={iframeRef} wrapperRef={wrapperRef} />
    </div>
  );
}
