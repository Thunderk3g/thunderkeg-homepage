'use client';

import { useEffect, useState } from 'react';

interface FocusHintProps {
  /**
   * Ref to the iframe element so we can attach focus listeners to its
   * contentWindow. The cross-origin embed may never fire `focus` on us,
   * so we also fall back to a 5s timer and a click-anywhere-in-wrapper
   * trigger handled by the parent.
   */
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  /**
   * Wrapper element that receives clicks; when the user clicks anywhere
   * inside the wrapper we treat the hint as dismissed.
   */
  wrapperRef: React.RefObject<HTMLElement | null>;
}

export default function FocusHint({ iframeRef, wrapperRef }: FocusHintProps) {
  const [visible, setVisible] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (dismissed) return;

    let timerId: number | undefined;
    let cleanedUp = false;

    const dismiss = () => {
      if (cleanedUp) return;
      setVisible(false);
      // After the opacity transition completes, fully remove from layout.
      window.setTimeout(() => setDismissed(true), 450);
    };

    // Fallback 1: dismiss after 5 seconds regardless of input.
    timerId = window.setTimeout(dismiss, 5000);

    // Fallback 2: any click inside the wrapper dismisses the hint.
    const wrapper = wrapperRef.current;
    const onWrapperClick = () => dismiss();
    wrapper?.addEventListener('click', onWrapperClick);

    // Primary: try to listen on the iframe's contentWindow focus event.
    // This frequently fails cross-origin, so we wrap in try/catch and rely
    // on the fallbacks above when it does.
    let iframeWindow: Window | null = null;
    const onIframeFocus = () => dismiss();
    try {
      iframeWindow = iframeRef.current?.contentWindow ?? null;
      iframeWindow?.addEventListener('focus', onIframeFocus);
    } catch {
      // Cross-origin access denied — that's fine, fallbacks handle it.
    }

    // Window blur is a decent proxy for "the iframe took focus" in modern
    // browsers, since clicking into a cross-origin iframe blurs the host.
    const onWindowBlur = () => {
      if (document.activeElement === iframeRef.current) {
        dismiss();
      }
    };
    window.addEventListener('blur', onWindowBlur);

    return () => {
      cleanedUp = true;
      if (timerId !== undefined) window.clearTimeout(timerId);
      wrapper?.removeEventListener('click', onWrapperClick);
      try {
        iframeWindow?.removeEventListener('focus', onIframeFocus);
      } catch {
        // ignore
      }
      window.removeEventListener('blur', onWindowBlur);
    };
  }, [iframeRef, wrapperRef, dismissed]);

  if (dismissed) return null;

  return (
    <div
      aria-hidden={!visible}
      className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none rounded-full border border-accent bg-elevated/80 px-4 py-2 font-mono text-sm text-fg backdrop-blur transition-opacity duration-[400ms]"
      style={{ opacity: visible ? 1 : 0 }}
    >
      Click here to focus the game · arrow keys + Ctrl to shoot
    </div>
  );
}
