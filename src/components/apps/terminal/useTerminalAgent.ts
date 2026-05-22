"use client";
import { useCallback, useMemo, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/llm/types";
import { useChatStream } from "@/lib/agent/useChatStream";

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

  const stream = useChatStream();

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

      let errorSeen: string | null = null;

      await stream.send(
        history,
        { model: opts?.model ?? model, agentRole },
        {
          onDelta: (delta) => appendDelta(assistantId, delta),
          onError: (msg) => {
            errorSeen = msg;
          },
          onDone: () => {
            finalize(assistantId, errorSeen ?? undefined);
          },
        },
      );
    },
    [agentRole, appendDelta, finalize, isStreaming, messages, model, stream],
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
