import type { NextRequest } from 'next/server';
import { isLlmConfigured, streamChatCompletion, thinkStripper } from '@/os/ai/llm';
import { coachSystemPrompt, digestSystemPrompt, newsSystemPrompt, paperSystemPrompt, systemPrompt } from '@/os/ai/prompts';

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
    /** swaps the system prompt: résumé grounding, news digest, learning coach, or paper reading */
    mode?: 'resume' | 'news' | 'digest' | 'coach' | 'paper';
  };
  const userMessages = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
  const system =
    body.mode === 'news'
      ? newsSystemPrompt()
      : body.mode === 'digest'
        ? digestSystemPrompt()
        : body.mode === 'coach'
          ? coachSystemPrompt()
          : body.mode === 'paper'
            ? paperSystemPrompt()
            : systemPrompt();

  // only user/assistant turns from the client; the system prompt is ours
  const turns = userMessages.filter((m) => m.role === 'user' || m.role === 'assistant');

  let opened: Awaited<ReturnType<typeof streamChatCompletion>>;
  try {
    opened = await streamChatCompletion([system, ...turns], 0.4);
  } catch (err) {
    // every model refused (rate limits, outage): the client falls back to its offline answer
    return Response.json({ llm: 'unavailable', error: err instanceof Error ? err.message : String(err) });
  }
  const { stream, model } = opened;
  const strip = thinkStripper();

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const part of stream) {
          const delta = strip(part.choices?.[0]?.delta?.content ?? '');
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
      // which model answered, for debugging the fallback chain
      'x-llm-model': model,
    },
  });
}
