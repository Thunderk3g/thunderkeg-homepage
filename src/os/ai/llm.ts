import OpenAI from 'openai';

/**
 * OpenAI-compatible chat, defaulting to Groq's free tier.
 *
 * Models are tried in order. The first is the best free model Groq serves
 * (OpenAI's open-weight gpt-oss-120b); if it is rate-limited, retired or
 * unavailable, the next one answers instead — Groq meters each model
 * separately, so a 429 on one usually leaves the others open.
 *
 *   LLM_API_KEY          required; without it the app stays on its offline fallbacks
 *   LLM_BASE_URL         default https://api.groq.com/openai/v1
 *   LLM_MODEL            default openai/gpt-oss-120b
 *   LLM_FALLBACK_MODELS  comma-separated; default qwen/qwen3.8-27b,openai/gpt-oss-20b
 */
const baseURL = process.env.LLM_BASE_URL ?? 'https://api.groq.com/openai/v1';
const isGroq = /api\.groq\.com/.test(baseURL);

export const DEFAULT_MODEL = process.env.LLM_MODEL || 'openai/gpt-oss-120b';
const FALLBACKS = (process.env.LLM_FALLBACK_MODELS ?? 'qwen/qwen3.8-27b,openai/gpt-oss-20b')
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);
export const MODELS = [...new Set([DEFAULT_MODEL, ...FALLBACKS])];

export function isLlmConfigured(): boolean {
  return Boolean(process.env.LLM_API_KEY && process.env.LLM_API_KEY.length > 0);
}

let _client: OpenAI | null = null;

/** Lazy client — never instantiated at import time (SDK throws on empty key,
 *  which would break `next build` on a checkout without the env var set). */
export function getLlm(): OpenAI {
  if (_client) return _client;
  if (!isLlmConfigured()) throw new Error('LLM_API_KEY is not set');
  _client = new OpenAI({ apiKey: process.env.LLM_API_KEY, baseURL, maxRetries: 0 });
  return _client;
}

/**
 * Per-model request extras. Reasoning models think before they answer; for a
 * chat widget that thinking should be short and never shown, so gpt-oss runs
 * at low effort with its reasoning withheld, and Qwen 3 hides its <think> block.
 * These are Groq's parameters, so they're only sent to Groq.
 */
function extras(model: string): Record<string, unknown> {
  if (!isGroq) return {};
  if (model.startsWith('openai/gpt-oss')) return { reasoning_effort: 'low', include_reasoning: false };
  if (model.startsWith('qwen/qwen3')) return { reasoning_format: 'hidden' };
  return {};
}

/** Worth trying the next model: rate-limited, retired, unknown or temporarily down. */
function shouldFallBack(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  const code = String((err as { code?: string; error?: { code?: string } })?.code ?? (err as { error?: { code?: string } })?.error?.code ?? '');
  return status === 429 || status === 404 || status === 503 || status === 500 || /decommission|not_found|model/i.test(code);
}

type Msg = { role: 'user' | 'assistant' | 'system'; content: string };

/** Open a streaming completion on the first model that accepts the request. */
export async function streamChatCompletion(messages: Msg[], temperature = 0.4) {
  let last: unknown;
  for (const model of MODELS) {
    try {
      const stream = await getLlm().chat.completions.create({
        model,
        messages,
        stream: true,
        temperature,
        ...extras(model),
      } as OpenAI.Chat.ChatCompletionCreateParamsStreaming);
      return { stream, model };
    } catch (err) {
      last = err;
      if (!shouldFallBack(err)) break;
    }
  }
  throw last instanceof Error ? last : new Error('No model accepted the request');
}

/**
 * Removes a leading <think>…</think> block from streamed text, for providers
 * or models that inline their reasoning. Feed it each delta; it returns what
 * is safe to show.
 */
export function thinkStripper() {
  let buf = '';
  let state: 'start' | 'thinking' | 'open' = 'start';
  return (delta: string): string => {
    if (state === 'open') return delta;
    buf += delta;
    if (state === 'start') {
      const t = buf.trimStart();
      if (t.length < 7 && '<think>'.startsWith(t)) return '';
      if (!t.startsWith('<think>')) {
        state = 'open';
        const out = buf;
        buf = '';
        return out;
      }
      state = 'thinking';
    }
    const end = buf.indexOf('</think>');
    if (end < 0) return '';
    state = 'open';
    const out = buf.slice(end + 8).trimStart();
    buf = '';
    return out;
  };
}
