import OpenAI from 'openai';

// OpenAI-compatible endpoint. Defaults to Groq (fast, free tier). Override with
// LLM_BASE_URL / LLM_MODEL / LLM_API_KEY in .env.local. See .env.local.example.
const baseURL = process.env.LLM_BASE_URL ?? 'https://api.groq.com/openai/v1';
export const DEFAULT_MODEL = process.env.LLM_MODEL ?? 'llama-3.3-70b-versatile';

export function isLlmConfigured(): boolean {
  return Boolean(process.env.LLM_API_KEY && process.env.LLM_API_KEY.length > 0);
}

let _client: OpenAI | null = null;

/** Lazy client — never instantiated at import time (SDK throws on empty key,
 *  which would break `next build` on a checkout without the env var set). */
export function getLlm(): OpenAI {
  if (_client) return _client;
  if (!isLlmConfigured()) throw new Error('LLM_API_KEY is not set');
  _client = new OpenAI({ apiKey: process.env.LLM_API_KEY, baseURL });
  return _client;
}
