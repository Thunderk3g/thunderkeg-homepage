import type { NextRequest } from 'next/server';
import { clientAddress, sameOrigin, withinRate, type RateLimits } from '@/os/ai/guard';
import { isLlmConfigured, streamChatCompletion, thinkStripper } from '@/os/ai/llm';
import { chatMessages, joinSeam } from '@/steer/prompting';
import { steerFile, steerModels } from '@/steer/server/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * One continuation for the steering canvas (Tier A): the dial values and pins
 * arrive as numbers and phrases, are compiled into a style block here, and the
 * model's stream is passed back as server-sent events.
 *
 * The canvas cancels constantly (every dial change abandons a request), so the
 * one thing this route must get right is hanging up: when the browser aborts,
 * the stream to the provider is closed and it stops generating.
 */

const MAX_TEXT_CHARS = 24_000;
const MAX_BODY_BYTES = 40_000;
const MAX_TOKENS = 200;
const MAX_PINS = 16;
const MAX_PIN_CHARS = 200;

/** A hand on a dial sends many small requests; this bucket is separate from the assistant's. */
const LIMITS: RateLimits = {
  bucket: 'steer',
  perAddress: Number(process.env.STEER_RATE_PER_ADDRESS) || 150,
  perInstance: Number(process.env.STEER_RATE_PER_INSTANCE) || 900,
};

interface Body {
  text?: unknown;
  dials?: unknown;
  pins?: unknown;
  max_tokens?: unknown;
  seed?: unknown;
  task?: unknown;
}

export async function POST(req: NextRequest) {
  // 200, not 503: "no key configured" is a supported state; the canvas runs simulated
  if (!isLlmConfigured()) return Response.json({ llm: 'unconfigured' });

  const refuse = (status: number, reason: string, retryAfter?: number) =>
    Response.json({ llm: 'refused', reason }, { status, headers: retryAfter ? { 'retry-after': String(retryAfter) } : undefined });
  if (!sameOrigin(req.headers)) return refuse(403, 'origin');

  let body: Body;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) return refuse(413, 'size');
    body = JSON.parse(raw);
  } catch {
    return refuse(400, 'json');
  }

  const file = steerFile();
  const text = typeof body.text === 'string' ? body.text : '';
  if (text.length > MAX_TEXT_CHARS) return refuse(413, 'size');
  const maxTokens = Math.min(MAX_TOKENS, Math.max(1, Math.floor(Number(body.max_tokens) || 0)));
  // only dials this site defines, only values on the arc
  const dials: Record<string, number> = {};
  if (body.dials && typeof body.dials === 'object') {
    for (const d of file.dims) {
      const v = (body.dials as Record<string, unknown>)[d.name];
      if (typeof v === 'number' && v >= 0 && v <= 1) dials[d.name] = v;
    }
  }
  const pins = (Array.isArray(body.pins) ? body.pins : [])
    .slice(0, MAX_PINS)
    .map((p) => p as { weight?: unknown; text?: unknown })
    .filter((p) => typeof p?.text === 'string' && typeof p?.weight === 'number')
    .map((p) => ({ weight: Math.min(1, Math.max(0, p.weight as number)), text: (p.text as string).slice(0, MAX_PIN_CHARS) }));
  const task = file.tasks.find((t) => t.id === body.task) ?? file.tasks[0];

  const rate = withinRate(clientAddress(req.headers), Date.now(), LIMITS);
  if (!rate.ok) return refuse(rate.status, rate.reason, rate.retryAfter);

  const abort = new AbortController();
  req.signal.addEventListener('abort', () => abort.abort(), { once: true });

  let opened: Awaited<ReturnType<typeof streamChatCompletion>>;
  try {
    opened = await streamChatCompletion(chatMessages(file.dims, { text, dials, pins, maxTokens, framing: task?.framing }), 0.8, {
      models: steerModels(),
      // a display token is roughly a word; leave room for the model's own tokens and any hidden reasoning
      maxTokens: Math.round(maxTokens * 1.6) + 200,
      seed: typeof body.seed === 'number' ? Math.abs(Math.floor(body.seed)) % 2 ** 31 : undefined,
      signal: abort.signal,
    });
  } catch (err) {
    if (abort.signal.aborted) return new Response(null, { status: 499 });
    return Response.json({ llm: 'unavailable', error: err instanceof Error ? err.message : String(err) });
  }
  const { stream, model } = opened;
  const strip = thinkStripper();
  const encoder = new TextEncoder();
  let first = true;

  const readable = new ReadableStream({
    async start(controller) {
      const push = (data: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      try {
        for await (const part of stream) {
          if (abort.signal.aborted) break;
          let delta = strip(part.choices?.[0]?.delta?.content ?? '');
          if (!delta) continue;
          if (first) {
            delta = joinSeam(text, delta);
            first = false;
          }
          push({ delta });
        }
        if (!abort.signal.aborted) push({ done: true });
      } catch (err) {
        if (!abort.signal.aborted) push({ error: err instanceof Error ? err.message : String(err) });
      } finally {
        try {
          controller.close();
        } catch {
          /* the reader already left */
        }
      }
    },
    cancel() {
      // the browser hung up: so do we
      abort.abort();
    },
  });

  return new Response(readable, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      'x-accel-buffering': 'no',
      'x-llm-model': model,
    },
  });
}
