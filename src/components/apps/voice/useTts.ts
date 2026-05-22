"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface UseTts {
  supported: boolean;
  speaking: boolean;
  speak(text: string): void;
  cancel(): void;
}

/**
 * Lightweight wrapper around the browser's speechSynthesis API.
 * - `speak(text)` enqueues an utterance; multiple calls queue naturally.
 * - `cancel()` flushes the queue and stops any in-progress utterance.
 * - `speaking` reflects whether the synth currently has work to do.
 */
export function useTts(lang: string = "en-US"): UseTts {
  const [supported, setSupported] = useState<boolean>(false);
  const [speaking, setSpeaking] = useState<boolean>(false);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const synth = window.speechSynthesis;
    if (!synth) {
      setSupported(false);
      return;
    }
    setSupported(true);
    synthRef.current = synth;
    // Poll the synth state since per-utterance events are flaky on Chrome.
    pollRef.current = window.setInterval(() => {
      setSpeaking(synth.speaking || synth.pending);
    }, 200);
    return () => {
      if (pollRef.current != null) window.clearInterval(pollRef.current);
      pollRef.current = null;
      try {
        synth.cancel();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const speak = useCallback(
    (text: string) => {
      const synth = synthRef.current;
      if (!synth) return;
      const trimmed = text.trim();
      if (!trimmed) return;
      const utter = new SpeechSynthesisUtterance(trimmed);
      utter.lang = lang;
      utter.rate = 1;
      utter.pitch = 1;
      synth.speak(utter);
      setSpeaking(true);
    },
    [lang],
  );

  const cancel = useCallback(() => {
    const synth = synthRef.current;
    if (!synth) return;
    try {
      synth.cancel();
    } catch {
      /* ignore */
    }
    setSpeaking(false);
  }, []);

  return { supported, speaking, speak, cancel };
}
