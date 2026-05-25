"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/llm/types";

export interface StreamHandlers {
  onDelta(delta: string): void;
  onError(message: string): void;
  onDone(): void;
}

export interface SendOptions {
  model?: string;
  agentRole?: "recruiter" | "collaborator";
}

export interface UseChatStream {
  send(
    messages: ChatMessage[],
    opts?: SendOptions,
    handlers?: StreamHandlers,
  ): Promise<void>;
  abort(): void;
  isStreaming: boolean;
}

const LLM_KEY_HINT =
  "set LLM_API_KEY in .env.local (Groq) and restart the dev server.";

const noop = () => {};

/**
 * Shared SSE client for the /api/chat endpoint.
 *
 * Owns an AbortController so consumers can cancel an in-flight stream via
 * `abort()` (e.g. on unmount or when a new request supersedes the old one).
 *
 * The SSE parser is the same buffered implementation used by the Terminal
 * agent: events are separated by a blank line; each event has one or more
 * `data:` lines whose payload is a JSON object. Termination is an explicit
 * `{done:true}` chunk or an `{error}` chunk; otherwise the parser flushes a
 * trailing `data:` event left in the buffer when the stream closes.
 */
export function useChatStream(): UseChatStream {
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  // Cancel any in-flight stream when the consumer unmounts.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const send = useCallback(
    async (
      messages: ChatMessage[],
      opts?: SendOptions,
      handlers?: StreamHandlers,
    ) => {
      const onDelta = handlers?.onDelta ?? noop;
      const onError = handlers?.onError ?? noop;
      const onDone = handlers?.onDone ?? noop;

      // Supersede any previous in-flight request.
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setIsStreaming(true);

      const body: Record<string, unknown> = { messages };
      if (opts?.model) body.model = opts.model;
      if (opts?.agentRole) body.agentRole = opts.agentRole;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        });

        if (!res.ok) {
          let detail = `HTTP ${res.status}`;
          try {
            const data = (await res.json()) as { error?: string };
            if (data?.error) detail = data.error;
          } catch {
            /* ignore parse errors */
          }
          if (res.status === 503) {
            detail = `${LLM_KEY_HINT} ${detail}`;
          }
          onError(detail);
          onDone();
          return;
        }

        if (!res.body) {
          onError("Empty response body.");
          onDone();
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let terminated = false;

        // SSE framing: events are separated by a blank line; each event has
        // one or more `data: …` lines. Per the API contract every payload is
        // a single JSON object. Termination: {done:true} OR {error:"…"}.
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let sepIdx: number;
          while ((sepIdx = buffer.indexOf("\n\n")) !== -1) {
            const rawEvent = buffer.slice(0, sepIdx);
            buffer = buffer.slice(sepIdx + 2);

            for (const line of rawEvent.split("\n")) {
              if (!line.startsWith("data:")) continue;
              const payload = line.slice(5).trim();
              if (!payload) continue;
              let parsed: { delta?: string; done?: boolean; error?: string };
              try {
                parsed = JSON.parse(payload) as {
                  delta?: string;
                  done?: boolean;
                  error?: string;
                };
              } catch {
                continue;
              }
              if (parsed.error) {
                onError(parsed.error);
                terminated = true;
                break;
              }
              if (parsed.delta) {
                onDelta(parsed.delta);
              }
              if (parsed.done) {
                terminated = true;
                break;
              }
            }
            if (terminated) break;
          }
          if (terminated) break;
        }

        if (!terminated) {
          // Stream closed without an explicit done marker — flush anything
          // left in the buffer that might be a trailing event without its
          // blank line.
          const tail = buffer.trim();
          if (tail.startsWith("data:")) {
            try {
              const parsed = JSON.parse(tail.slice(5).trim()) as {
                delta?: string;
                error?: string;
              };
              if (parsed.delta) onDelta(parsed.delta);
              if (parsed.error) {
                onError(parsed.error);
                onDone();
                return;
              }
            } catch {
              /* drop malformed trailing event */
            }
          }
        }

        onDone();
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") {
          // Abort is a normal control-flow signal, not an error worth
          // surfacing. We still call onDone so callers can clear streaming
          // state, mirroring the original Terminal behaviour on abort.
          onDone();
          return;
        }
        const detail = err instanceof Error ? err.message : String(err);
        onError(detail);
        onDone();
      } finally {
        // Only clear the ref if this is still the active controller; a newer
        // send() may have already swapped it.
        if (abortRef.current === ctrl) abortRef.current = null;
        setIsStreaming(false);
      }
    },
    [],
  );

  return { send, abort, isStreaming };
}
