'use client';

import { offlineAnswer } from './offline';

export interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  /** which system prompt the server should use */
  mode?: 'resume' | 'news' | 'coach';
  /** what to answer with when no model is configured; defaults to the résumé retriever */
  offline?: (question: string) => string;
}

/** Emit a canned answer through onDelta so the UI still renders progressively. */
async function fallback(
  messages: ChatMsg[],
  onDelta: (t: string) => void,
  opts: ChatOptions,
): Promise<{ text: string }> {
  const question = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
  const text = (opts.offline ?? offlineAnswer)(question);
  for (let i = 0; i < text.length; i += 24) {
    onDelta(text.slice(i, i + 24));
    await new Promise((r) => setTimeout(r, 12));
  }
  return { text };
}

/**
 * Streams /api/chat (SSE). Calls onDelta per token; resolves with full text.
 * With no LLM key configured (503) or no network, falls back to the local
 * résumé retriever rather than surfacing a dead feature.
 */
export async function streamChat(
  messages: ChatMsg[],
  onDelta: (t: string) => void,
  opts: ChatOptions = {},
): Promise<{ text: string; error?: string }> {
  let res: Response;
  try {
    res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages, mode: opts.mode ?? 'resume' }),
    });
  } catch {
    return fallback(messages, onDelta, opts);
  }

  // JSON instead of an SSE stream means the server has no model configured.
  if (res.headers.get('content-type')?.includes('application/json')) {
    return fallback(messages, onDelta, opts);
  }
  if (!res.ok || !res.body) return fallback(messages, onDelta, opts);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  let error: string | undefined;

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split('\n\n');
    buffer = chunks.pop() ?? '';
    for (const chunk of chunks) {
      const line = chunk.trim();
      if (!line.startsWith('data:')) continue;
      try {
        const j = JSON.parse(line.slice(5).trim());
        if (j.delta) {
          text += j.delta;
          onDelta(j.delta);
        }
        if (j.error) error = j.error;
      } catch {
        /* ignore malformed keep-alive */
      }
    }
  }
  return { text, error };
}
