"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSpeechRecognition } from "./useSpeechRecognition";
import { useTts } from "./useTts";
import { useChatStream } from "@/lib/agent/useChatStream";

type Status = "idle" | "recording" | "thinking" | "speaking" | "error";

/**
 * VoiceApp — press-and-hold mic, stream Groq response, speak it back sentence-by-sentence.
 *
 * Streaming is delegated to the shared `useChatStream` hook in `src/lib/agent`,
 * which owns the SSE parser and AbortController previously inlined here.
 */
export default function VoiceApp() {
  const sr = useSpeechRecognition("en-US");
  const tts = useTts("en-US");
  const stream = useChatStream();

  const [status, setStatus] = useState<Status>("idle");
  const [reply, setReply] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Track how much of the streamed reply we've already routed into TTS so each
  // sentence is spoken exactly once as new tokens arrive.
  const spokenIdxRef = useRef<number>(0);

  // Reset the streaming cursor whenever we begin a fresh exchange.
  const resetTtsCursor = useCallback(() => {
    spokenIdxRef.current = 0;
  }, []);

  // Pull complete sentences out of the streamed text and speak them.
  // A "complete sentence" is anything terminated by . ! or ? followed by whitespace.
  const flushSentences = useCallback(
    (full: string, opts: { final?: boolean } = {}) => {
      const unspoken = full.slice(spokenIdxRef.current);
      if (!unspoken) return;
      // Match sentence boundaries while keeping the punctuation attached.
      const boundary = /[.!?](?:\s+|$)/g;
      let lastEnd = 0;
      let match: RegExpExecArray | null;
      while ((match = boundary.exec(unspoken)) !== null) {
        const end = match.index + match[0].length;
        const sentence = unspoken.slice(lastEnd, end).trim();
        if (sentence) tts.speak(sentence);
        lastEnd = end;
      }
      if (opts.final && lastEnd < unspoken.length) {
        const tail = unspoken.slice(lastEnd).trim();
        if (tail) tts.speak(tail);
        lastEnd = unspoken.length;
      }
      spokenIdxRef.current += lastEnd;
    },
    [tts],
  );

  const sendToAgent = useCallback(
    async (transcript: string) => {
      const text = transcript.trim();
      if (!text) {
        setStatus("idle");
        return;
      }
      // Supersede any previous in-flight request.
      stream.abort();

      setStatus("thinking");
      setReply("");
      setErrorMsg(null);
      resetTtsCursor();

      let assembled = "";
      let errored = false;
      let started = false;

      await stream.send(
        // Single-turn for voice — do NOT carry conversation history.
        [{ role: "user", content: text }],
        undefined,
        {
          onDelta: (delta) => {
            if (!started) {
              started = true;
              setStatus("speaking");
            }
            assembled += delta;
            setReply(assembled);
            flushSentences(assembled);
          },
          onError: (msg) => {
            errored = true;
            setErrorMsg(msg);
            setReply(msg);
            setStatus("error");
            tts.speak(msg);
          },
          onDone: () => {
            if (errored) return;
            // Flush any trailing text once the stream has closed.
            flushSentences(assembled, { final: true });
            setStatus("idle");
          },
        },
      );
    },
    [flushSentences, resetTtsCursor, stream, tts],
  );

  // Press-and-hold handlers. We capture pointer events so a drag off the
  // button still releases cleanly.
  const holdingRef = useRef<boolean>(false);

  const beginHold = useCallback(() => {
    if (!sr.supported) return;
    if (holdingRef.current) return;
    holdingRef.current = true;
    tts.cancel();
    sr.start();
    setStatus("recording");
    setReply("");
    setErrorMsg(null);
  }, [sr, tts]);

  const endHold = useCallback(() => {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    sr.stop();
    // Give the recognition engine a beat to finalise the last result.
    const transcript = sr.finalTranscript;
    // We can't read state after stop synchronously, so defer.
    window.setTimeout(() => {
      const t = (sr.finalTranscript || transcript || "").trim();
      if (t) void sendToAgent(t);
      else setStatus("idle");
    }, 120);
  }, [sendToAgent, sr]);

  // Safety: cancel any in-flight request on unmount.
  useEffect(() => {
    return () => {
      stream.abort();
      tts.cancel();
    };
  }, [stream, tts]);

  if (!sr.supported) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-bg p-6">
        <div className="max-w-sm rounded-lg border border-border bg-elevated p-6 text-center">
          <div className="mb-2 font-sans text-lg font-semibold text-fg">
            Voice not supported
          </div>
          <p className="font-sans text-sm text-muted">
            Chrome or Edge desktop only. Your browser does not expose
            <code className="mx-1 font-mono text-accent">SpeechRecognition</code>.
          </p>
        </div>
      </div>
    );
  }

  const isRecording = status === "recording";
  const liveLine = sr.interim || (isRecording ? "Listening…" : "");

  return (
    <div className="flex h-full w-full flex-col items-center justify-between gap-4 bg-bg p-6">
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <div className="relative flex h-44 w-44 items-center justify-center">
          {isRecording ? (
            <>
              <span
                aria-hidden
                className="absolute inset-0 rounded-full border border-accent/40 animate-pulse2"
              />
              <span
                aria-hidden
                className="absolute inset-2 rounded-full border border-accent/20 animate-pulse2"
              />
            </>
          ) : null}
          <button
            type="button"
            aria-label="Hold to talk"
            aria-pressed={isRecording}
            onPointerDown={(e) => {
              e.preventDefault();
              (e.currentTarget as HTMLButtonElement).setPointerCapture?.(e.pointerId);
              beginHold();
            }}
            onPointerUp={(e) => {
              e.preventDefault();
              endHold();
            }}
            onPointerCancel={() => endHold()}
            onPointerLeave={() => endHold()}
            onContextMenu={(e) => e.preventDefault()}
            className={[
              "relative z-10 flex h-[140px] w-[140px] items-center justify-center rounded-full",
              "border-2 transition-colors select-none",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              isRecording
                ? "border-accent bg-elevated text-accent shadow-window"
                : "border-border bg-surface text-fg hover:border-accent/60 hover:text-accent",
            ].join(" ")}
          >
            <MicIcon active={isRecording} />
          </button>
        </div>

        <div className="min-h-[1.5rem] text-center">
          <p className="font-mono text-sm text-muted">
            {liveLine || (status === "thinking" ? "Thinking…" : status === "speaking" ? "Speaking…" : "Press and hold to talk")}
          </p>
        </div>
      </div>

      <div className="w-full max-w-2xl rounded-md border border-border bg-elevated p-4">
        <div className="mb-2 flex items-center justify-between font-mono text-xs uppercase tracking-wider text-muted">
          <span>Reply</span>
          <span className={status === "error" ? "text-danger" : "text-muted"}>
            {status}
          </span>
        </div>
        <div className="min-h-[6rem] whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-fg">
          {errorMsg && status === "error" ? (
            <span className="text-danger">{errorMsg}</span>
          ) : reply ? (
            reply
          ) : (
            <span className="text-muted">Your assistant's reply will appear here.</span>
          )}
        </div>
      </div>
    </div>
  );
}

function MicIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="56"
      height="56"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.25 : 1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  );
}
