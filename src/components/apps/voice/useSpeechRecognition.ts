"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Minimal structural types for the browser's SpeechRecognition API.
// The constructor itself is sourced via an `as any` cast (see `getCtor`)
// so we keep the wider code type-safe without pulling in lib.dom additions.
interface SRAlternative {
  transcript: string;
  confidence: number;
}
interface SRResult {
  isFinal: boolean;
  0: SRAlternative;
  length: number;
}
interface SRResultList {
  length: number;
  item(index: number): SRResult;
  [index: number]: SRResult;
}
interface SREvent {
  resultIndex: number;
  results: SRResultList;
}
interface SRErrorEvent {
  error: string;
  message?: string;
}
interface SRInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((ev: SREvent) => void) | null;
  onerror: ((ev: SRErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SRCtor = new () => SRInstance;

function getCtor(): SRCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as SRCtor | null;
}

export interface UseSpeechRecognition {
  supported: boolean;
  listening: boolean;
  interim: string;
  finalTranscript: string;
  error: string | null;
  start(): void;
  stop(): void;
  reset(): void;
}

export function useSpeechRecognition(lang: string = "en-US"): UseSpeechRecognition {
  const [supported, setSupported] = useState<boolean>(false);
  const [listening, setListening] = useState<boolean>(false);
  const [interim, setInterim] = useState<string>("");
  const [finalTranscript, setFinalTranscript] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const recogRef = useRef<SRInstance | null>(null);
  const finalRef = useRef<string>("");

  useEffect(() => {
    const Ctor = getCtor();
    if (!Ctor) {
      setSupported(false);
      return;
    }
    setSupported(true);
    const recog = new Ctor();
    recog.lang = lang;
    recog.continuous = true;
    recog.interimResults = true;
    recog.maxAlternatives = 1;

    recog.onresult = (ev: SREvent) => {
      let interimChunk = "";
      let appended = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        const text = r[0]?.transcript ?? "";
        if (r.isFinal) appended += text;
        else interimChunk += text;
      }
      if (appended) {
        finalRef.current = (finalRef.current + " " + appended).replace(/\s+/g, " ").trim();
        setFinalTranscript(finalRef.current);
      }
      setInterim(interimChunk);
    };

    recog.onerror = (ev: SRErrorEvent) => {
      setError(ev.error || "speech recognition error");
    };

    recog.onend = () => {
      setListening(false);
      setInterim("");
    };

    recog.onstart = () => {
      setListening(true);
      setError(null);
    };

    recogRef.current = recog;
    return () => {
      try {
        recog.abort();
      } catch {
        /* ignore */
      }
      recogRef.current = null;
    };
  }, [lang]);

  const start = useCallback(() => {
    const recog = recogRef.current;
    if (!recog) return;
    finalRef.current = "";
    setFinalTranscript("");
    setInterim("");
    setError(null);
    try {
      recog.start();
    } catch {
      // Calling start() while already started throws; ignore.
    }
  }, []);

  const stop = useCallback(() => {
    const recog = recogRef.current;
    if (!recog) return;
    try {
      recog.stop();
    } catch {
      /* ignore */
    }
  }, []);

  const reset = useCallback(() => {
    finalRef.current = "";
    setFinalTranscript("");
    setInterim("");
    setError(null);
  }, []);

  return { supported, listening, interim, finalTranscript, error, start, stop, reset };
}
