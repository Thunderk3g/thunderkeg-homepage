import OpenAI from "openai";

const apiKey  = process.env.LLM_API_KEY;
const baseURL = process.env.LLM_BASE_URL ?? "https://api.groq.com/openai/v1/";
const timeout = Number(process.env.LLM_REQUEST_TIMEOUT_S ?? 60) * 1000;

export const DEFAULT_MODEL = process.env.LLM_MODEL ?? "openai/gpt-oss-120b";

if (!apiKey && process.env.NODE_ENV !== "test") {
  // Log once at import time; the route handler returns a 503 if called without a key.
  console.warn("[llm] LLM_API_KEY is not set — /api/chat will return 503.");
}

export const llm = new OpenAI({
  apiKey: apiKey ?? "missing",
  baseURL,
  timeout,
});

export function isLlmConfigured(): boolean {
  return Boolean(apiKey);
}
