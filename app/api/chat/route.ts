import type { NextRequest } from 'next/server';
import { getLlm, DEFAULT_MODEL, isLlmConfigured } from '@/os/ai/llm';
import { coachSystemPrompt, newsSystemPrompt, systemPrompt } from '@/os/ai/prompts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function POST(req: NextRequest) {
  // 200, not 503: "no key configured" is a supported deployment state with a
  // working client-side fallback, not a failure. A 5xx here only buys a red
  // line in every visitor's console.
  if (!isLlmConfigured()) {
    return Response.json({ llm: 'unconfigured' });
  }

  const body = (await req.json()) as {
    messages?: ChatMessage[];
    model?: string;
    /** swaps the system prompt: résumé grounding, news digest, or learning coach */
    mode?: 'resume' | 'news' | 'coach';
  };
  const userMessages = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
  const system =
    body.mode === 'news' ? newsSystemPrompt() : body.mode === 'coach' ? coachSystemPrompt() : systemPrompt();

  const stream = await getLlm().chat.completions.create({
    model: body.model ?? DEFAULT_MODEL,
    messages: [system, ...userMessages],
    stream: true,
    temperature: 0.4,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const part of stream) {
          const delta = part.choices?.[0]?.delta?.content ?? '';
          if (delta) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`));
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      'x-accel-buffering': 'no',
    },
  });
}
