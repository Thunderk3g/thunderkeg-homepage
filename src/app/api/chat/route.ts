import { NextRequest } from "next/server";
import { llm, DEFAULT_MODEL, isLlmConfigured } from "@/lib/llm/client";
import { systemPrompt } from "@/lib/llm/prompts";
import type { ChatRequest } from "@/lib/llm/types";
import { loadResumeContext } from "@/lib/resume/loader";

export const runtime = "nodejs"; // keep on Node so we can read public/resume.json
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isLlmConfigured()) {
    return new Response(
      JSON.stringify({ error: "LLM_API_KEY not configured on the server." }),
      { status: 503, headers: { "content-type": "application/json" } },
    );
  }

  const body = (await req.json()) as ChatRequest;
  const userMessages = Array.isArray(body.messages) ? body.messages : [];

  const resumeContext = await loadResumeContext();
  const sys = systemPrompt({ resumeContext, agentRole: body.agentRole });

  const stream = await llm.chat.completions.create({
    model: body.model ?? DEFAULT_MODEL,
    messages: [sys, ...userMessages],
    stream: true,
    temperature: 0.4,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const part of stream) {
          const delta = part.choices?.[0]?.delta?.content ?? "";
          if (delta) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`));
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
      } catch (err: any) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: String(err?.message ?? err) })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}
