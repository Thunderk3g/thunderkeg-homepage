"use client";
import { useCallback, useMemo, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/llm/types";

export type AgentRole = "recruiter" | "collaborator";

export const GREETING =
  "Hi — I'm Diwakar's portfolio agent. Ask me about my work on compliance-agent, Moshi, or Aetherflow, or type /help.";

export interface TerminalMessage extends ChatMessage {
  id: string;
  /** True while this assistant message is still receiving streamed tokens. */
  streaming?: boolean;
  /** Optional rendering hint — non-chat output (e.g. slash command echoes). */
  kind?: "chat" | "system";
}

interface SendOptions {
  /** Override model for this single call. */
  model?: string;
}

export interface UseTerminalAgent {
  messages: TerminalMessage[];
  isStreaming: boolean;
  agentRole: AgentRole;
  model: string;
  setAgentRole: (role: AgentRole) => void;
  setModel: (model: string) => void;
  send: (input: string, opts?: SendOptions) => Promise<void>;
  clear: () => void;
  /** Append a local-only system/echo message without round-tripping the API. */
  pushSystem: (content: string) => void;
}

export const DEFAULT_MODEL = "openai/gpt-oss-120b";

const makeId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const initialMessages = (): TerminalMessage[] => [
  {
    id: makeId(),
    role: "assistant",
    content: GREETING,
    kind: "chat",
  },
];

export function useTerminalAgent(): UseTerminalAgent {
  const [messages, setMessages] = useState<TerminalMessage[]>(initialMessages);
  const [isStreaming, setIsStreaming] = useState(false);
  const [agentRole, setAgentRole] = useState<AgentRole>("recruiter");
  const [model, setModel] = useState<string>(DEFAULT_MODEL);

  // Track the id of the currently-streaming assistant message so we can mutate it
  // imperatively as tokens arrive without depending on stale closures.
  const activeIdRef = useRef<string | null>(null);

  const appendDelta = useCallback((id: string, delta: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, content: m.content + delta } : m,
      ),
    );
  }, []);

  const finalize = useCallback((id: string, errorText?: string) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        const next: TerminalMessage = { ...m, streaming: false };
        if (errorText) {
          next.content =
            (m.content ? m.content + "\n\n" : "") +
            `[error] ${errorText}`;
        }
        return next;
      }),
    );
    setIsStreaming(false);
    activeIdRef.current = null;
  }, []);

  const send = useCallback(
    async (input: string, opts?: SendOptions) => {
      const trimmed = input.trim();
      if (!trimmed || isStreaming) return;

      const userMsg: TerminalMessage = {
        id: makeId(),
        role: "user",
        content: trimmed,
        kind: "chat",
      };
      const assistantId = makeId();
      const assistantMsg: TerminalMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        streaming: true,
        kind: "chat",
      };

      // Snapshot the chat history we send to the API: existing user/assistant
      // chat messages plus the new user prompt.
      const history: ChatMessage[] = messages
        .filter((m) => m.kind !== "system")
        .map(({ role, content }) => ({ role, content }));
      history.push({ role: "user", content: trimmed });

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);
      activeIdRef.current = assistantId;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            messages: history,
            model: opts?.model ?? model,
            agentRole,
          }),
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
            detail +=
              " — set LLM_API_KEY in .env.local (Groq) and restart the dev server.";
          }
          finalize(assistantId, detail);
          return;
        }

        if (!res.body) {
          finalize(assistantId, "Empty response body.");
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let aborted = false;

        // SSE framing: events are separated by a blank line; each event has one
        // or more `data: …` lines. Per the API contract every payload is a
        // single JSON object, so we extract the JSON after the `data:` prefix.
        // Termination: a chunk with {done:true} OR {error:"…"}.
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
                parsed = JSON.parse(payload);
              } catch {
                continue;
              }
              if (parsed.error) {
                finalize(assistantId, parsed.error);
                aborted = true;
                break;
              }
              if (parsed.delta) {
                appendDelta(assistantId, parsed.delta);
              }
              if (parsed.done) {
                aborted = true;
                break;
              }
            }
            if (aborted) break;
          }
          if (aborted) break;
        }

        if (!aborted) {
          // Stream closed without an explicit done marker — flush anything left
          // in the buffer that might be a trailing event without its blank line.
          const tail = buffer.trim();
          if (tail.startsWith("data:")) {
            try {
              const parsed = JSON.parse(tail.slice(5).trim()) as {
                delta?: string;
                error?: string;
              };
              if (parsed.delta) appendDelta(assistantId, parsed.delta);
              if (parsed.error) {
                finalize(assistantId, parsed.error);
                return;
              }
            } catch {
              /* drop malformed trailing event */
            }
          }
        }

        finalize(assistantId);
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        finalize(assistantId, detail);
      }
    },
    [agentRole, appendDelta, finalize, isStreaming, messages, model],
  );

  const clear = useCallback(() => {
    setMessages(initialMessages());
    activeIdRef.current = null;
    setIsStreaming(false);
  }, []);

  const pushSystem = useCallback((content: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: makeId(),
        role: "assistant",
        content,
        kind: "system",
      },
    ]);
  }, []);

  return useMemo(
    () => ({
      messages,
      isStreaming,
      agentRole,
      model,
      setAgentRole,
      setModel,
      send,
      clear,
      pushSystem,
    }),
    [messages, isStreaming, agentRole, model, send, clear, pushSystem],
  );
}
