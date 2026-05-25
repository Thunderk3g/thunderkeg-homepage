import OpenAI from "openai";

const baseURL = process.env.LLM_BASE_URL ?? "https://api.groq.com/openai/v1/";
const timeout = Number(process.env.LLM_REQUEST_TIMEOUT_S ?? 60) * 1000;

export const DEFAULT_MODEL = process.env.LLM_MODEL ?? "openai/gpt-oss-120b";

export function isLlmConfigured(): boolean {
  return Boolean(process.env.LLM_API_KEY && process.env.LLM_API_KEY.length > 0);
}

let _llm: OpenAI | null = null;

/**
 * Lazy OpenAI client. We DON'T instantiate at import time because the SDK
 * constructor throws on missing / empty `apiKey`, which would break the build
 * whenever the env var isn't set (e.g. during `next build` collecting page
 * data on a fresh checkout).
 */
export function getLlm(): OpenAI {
  if (_llm) return _llm;
  if (!isLlmConfigured()) {
    throw new Error("LLM_API_KEY is not set");
  }
  _llm = new OpenAI({
    apiKey: process.env.LLM_API_KEY,
    baseURL,
    timeout,
  });
  return _llm;
}
