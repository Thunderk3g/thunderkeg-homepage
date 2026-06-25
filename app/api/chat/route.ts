import type { NextRequest } from 'next/server';
import { getLlm, DEFAULT_MODEL, isLlmConfigured } from '@/os/ai/llm';
import { systemPrompt } from '@/os/ai/prompts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function POST(req: NextRequest) {
  if (!isLlmConfigured()) {
    return new Response(
      JSON.stringify({ error: 'LLM_API_KEY not configured on the server.' }),
      { status: 503, headers: { 'content-type': 'application/json' } },
    );
  }

  const body = (await req.json()) as { messages?: ChatMessage[]; model?: string };
  const userMessages = Array.isArray(body.messages) ? body.messages.slice(-12) : [];

  const stream = await getLlm().chat.completions.create({
    model: body.model ?? DEFAULT_MODEL,
    messages: [systemPrompt(), ...userMessages],
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
