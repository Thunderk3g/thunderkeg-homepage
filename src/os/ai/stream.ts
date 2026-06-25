'use client';

export interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

/** Streams /api/chat (SSE). Calls onDelta per token; resolves with full text or an error. */
export async function streamChat(
  messages: ChatMsg[],
  onDelta: (t: string) => void,
): Promise<{ text: string; error?: string }> {
  let res: Response;
  try {
    res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages }),
    });
  } catch {
    return { text: '', error: 'Network error reaching the assistant.' };
  }

  if (res.status === 503) {
    return {
      text: '',
      error: 'Assistant offline — set LLM_API_KEY in .env.local (Groq or OpenAI compatible).',
    };
  }
  if (!res.ok || !res.body) return { text: '', error: `Request failed (${res.status}).` };

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
