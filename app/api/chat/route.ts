import type { NextRequest } from 'next/server';
import { clientAddress, MAX_BODY_BYTES, sameOrigin, withinRate, withinSize } from '@/os/ai/guard';
import { isLlmConfigured, streamChatCompletion, thinkStripper } from '@/os/ai/llm';
import { digestSystemPrompt, newsSystemPrompt, paperSystemPrompt, systemPrompt } from '@/os/ai/prompts';
import { allEntries } from '@/content/writing';
import { RQS } from '@/research/seed';
import { buildBoard, recordText } from '@/stacks/model';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/** The Stacks record as the assistant sees it: the curated record plus published posts and paper notes. */
function recordContext(): string {
  try {
    return recordText(buildBoard({ entries: allEntries(), papers: [], cards: [], rqs: RQS }));
  } catch {
    return ''; // the résumé context still answers most questions
  }
}

export async function POST(req: NextRequest) {
  // 200, not 503: "no key configured" is a supported deployment state with a
  // working client-side fallback, not a failure. A 5xx here only buys a red
  // line in every visitor's console.
  if (!isLlmConfigured()) {
    return Response.json({ llm: 'unconfigured' });
  }

  // This endpoint spends a paid key, so it answers only this site, only
  // requests the size its own apps send, and only at a visitor's pace
  // (src/os/ai/guard.ts). A refusal is JSON, which the client already treats
  // as "no model" and answers offline.
  const refuse = (status: number, reason: string, retryAfter?: number) =>
    Response.json({ llm: 'refused', reason }, { status, headers: retryAfter ? { 'retry-after': String(retryAfter) } : undefined });
  if (!sameOrigin(req.headers)) return refuse(403, 'origin');
  if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) return refuse(413, 'size');

  let body: {
    messages?: ChatMessage[];
    /** swaps the system prompt: résumé grounding, news digest, or paper reading */
    mode?: 'resume' | 'news' | 'digest' | 'paper';
  };
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) return refuse(413, 'size');
    body = JSON.parse(raw);
  } catch {
    return refuse(400, 'json');
  }
  const userMessages = Array.isArray(body?.messages) ? body.messages.slice(-12) : [];
  if (!userMessages.length || !userMessages.every((m) => m && typeof m === 'object') || !withinSize(userMessages)) return refuse(413, 'size');
  const rate = withinRate(clientAddress(req.headers));
  if (!rate.ok) return refuse(rate.status, rate.reason, rate.retryAfter);
  const system =
    body.mode === 'news'
      ? newsSystemPrompt()
      : body.mode === 'digest'
        ? digestSystemPrompt()
        : body.mode === 'paper'
          ? paperSystemPrompt()
          : systemPrompt(recordContext());

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
