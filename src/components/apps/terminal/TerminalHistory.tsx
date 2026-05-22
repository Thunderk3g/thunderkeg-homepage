"use client";
import { useEffect, useRef } from "react";
import type { TerminalMessage } from "./useTerminalAgent";

interface Props {
  messages: TerminalMessage[];
  isStreaming: boolean;
}

/**
 * Scrollable transcript area. Renders one block per message and auto-scrolls
 * to the bottom whenever new tokens arrive. When isStreaming is true and the
 * latest message has no content yet, a three-dot pulse indicator is shown.
 */
export function TerminalHistory({ messages, isStreaming }: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // RAF so we measure after the latest token has been committed to the DOM.
    const id = requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
    return () => cancelAnimationFrame(id);
  }, [messages, isStreaming]);

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto px-4 py-3 font-mono text-sm leading-relaxed text-fg"
      aria-live="polite"
    >
      {messages.map((m) => (
        <MessageBlock key={m.id} message={m} />
      ))}
      {isStreaming && lastIsEmptyAssistant(messages) && <StreamingDots />}
    </div>
  );
}

function lastIsEmptyAssistant(messages: TerminalMessage[]): boolean {
  const last = messages[messages.length - 1];
  return !!last && last.role === "assistant" && last.content.length === 0;
}

function MessageBlock({ message }: { message: TerminalMessage }) {
  if (message.role === "user") {
    return (
      <div className="mb-2 whitespace-pre-wrap break-words">
        <span className="mr-2 select-none text-accent">{">"}</span>
        <span className="text-fg">{message.content}</span>
      </div>
    );
  }

  if (message.kind === "system") {
    return (
      <div className="mb-2 whitespace-pre-wrap break-words text-muted">
        {message.content}
      </div>
    );
  }

  // assistant chat message
  return (
    <div className="mb-3 whitespace-pre-wrap break-words">
      <span className="mr-2 select-none text-accent2">$</span>
      <span className="text-fg">{message.content}</span>
      {message.streaming && message.content.length > 0 && (
        <span
          className="ml-0.5 inline-block h-[1em] w-[0.55em] translate-y-[2px] bg-accent align-baseline animate-blink"
          aria-hidden
        />
      )}
    </div>
  );
}

function StreamingDots() {
  return (
    <div
      className="mb-3 flex items-center gap-1 text-muted"
      role="status"
      aria-label="Assistant is typing"
    >
      <span className="mr-2 select-none text-accent2">$</span>
      <span className="h-1.5 w-1.5 rounded-sm bg-muted animate-pulse2 [animation-delay:0ms]" />
      <span className="h-1.5 w-1.5 rounded-sm bg-muted animate-pulse2 [animation-delay:150ms]" />
      <span className="h-1.5 w-1.5 rounded-sm bg-muted animate-pulse2 [animation-delay:300ms]" />
    </div>
  );
}
