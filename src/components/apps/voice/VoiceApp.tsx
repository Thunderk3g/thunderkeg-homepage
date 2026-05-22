"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSpeechRecognition } from "./useSpeechRecognition";
import { useTts } from "./useTts";

type Status = "idle" | "recording" | "thinking" | "speaking" | "error";

interface ChatChunk {
  delta?: string;
  done?: boolean;
  error?: string;
}

/**
 * VoiceApp — press-and-hold mic, stream Groq response, speak it back sentence-by-sentence.
 *
 * The streaming logic is intentionally inlined here rather than imported from the Terminal
 * app's `useTerminalAgent` because that hook is being built in a parallel sub-agent and may
 * not exist when this file is type-checked. Consolidation happens later in `chore/polish`.
 */
export default function VoiceApp() {
  const sr = useSpeechRecognition("en-US");
  const tts = useTts("en-US");

  const [status, setStatus] = useState<Status>("idle");
  const [reply, setReply] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Track how much of the streamed reply we've already routed into TTS so each
  // sentence is spoken exactly once as new tokens arrive.
  const spokenIdxRef = useRef<number>(0);
  const abortRef = useRef<AbortController | null>(null);

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
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      setStatus("thinking");
      setReply("");
      setErrorMsg(null);
      resetTtsCursor();

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          // Single-turn for voice — do NOT carry conversation history.
          body: JSON.stringify({ messages: [{ role: "user", content: text }] }),
          signal: ctrl.signal,
        });

        if (res.status === 503) {
          const msg = "AI not configured";
          setErrorMsg(msg);
          setReply(msg);
          setStatus("error");
          tts.speak(msg);
          return;
        }
        if (!res.ok || !res.body) {
          const msg = `Request failed (${res.status})`;
          setErrorMsg(msg);
          setStatus("error");
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let assembled = "";
        setStatus("speaking");

        // SSE frames: each event is `data: <json>\n\n`.
        // Pull frames out of the rolling buffer as they complete.
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let sep = buffer.indexOf("\n\n");
          while (sep !== -1) {
            const frame = buffer.slice(0, sep);
            buffer = buffer.slice(sep + 2);
            sep = buffer.indexOf("\n\n");
            const line = frame.split("\n").find((l) => l.startsWith("data:"));
            if (!line) continue;
            const payload = line.slice(5).trim();
            if (!payload) continue;
            let chunk: ChatChunk;
            try {
              chunk = JSON.parse(payload) as ChatChunk;
            } catch {
              continue;
            }
            if (chunk.error) {
              setErrorMsg(chunk.error);
              setStatus("error");
              continue;
            }
            if (chunk.delta) {
              assembled += chunk.delta;
              setReply(assembled);
              flushSentences(assembled);
            }
            if (chunk.done) {
              flushSentences(assembled, { final: true });
            }
          }
        }
        // Flush any trailing text once the stream has closed.
        flushSentences(assembled, { final: true });
        setStatus("idle");
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") return;
        const msg = (err as Error)?.message ?? "Unknown error";
        setErrorMsg(msg);
        setStatus("error");
      }
    },
    [flushSentences, resetTtsCursor, tts],
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
      abortRef.current?.abort();
      tts.cancel();
    };
  }, [tts]);

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
