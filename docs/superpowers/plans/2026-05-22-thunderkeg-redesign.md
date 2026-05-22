# Thunderkeg Homepage — Kali Desktop Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Next.js Kali-desktop portfolio with a Groq-powered AI brain, a working window manager, and a refreshed visual identity — delivered as a foundation PR followed by ten parallel per-app PRs.

**Architecture:** Single OpenAI-compatible client points at Groq. Window manager owned by a `useReducer`-backed context with `react-rnd` window primitives. Theme tokens drive Tailwind. Each app is an isolated module under `src/components/apps/<kind>/`. Resume content lives in a Zod-validated `public/resume.json` and feeds every data-driven app.

**Tech Stack:** Next.js 15.2.3, React 18, TypeScript 5, Tailwind 3.4, Framer Motion 11, OpenAI SDK (against Groq), Zod 3.24, react-rnd, lucide-react, Playwright (capture only).

**Spec:** [`docs/superpowers/specs/2026-05-22-thunderkeg-redesign-design.md`](../specs/2026-05-22-thunderkeg-redesign-design.md)

---

## Phase 0 — Branching & deps

### Task 0.1: Verify branch and clean tree

**Files:** (none)

- [ ] **Step 1: Confirm working branch**

Run: `git branch --show-current`
Expected: `feat/foundation`

- [ ] **Step 2: Confirm clean tree**

Run: `git status --short`
Expected: empty output.

### Task 0.2: Install new deps

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Install runtime deps**

Run: `npm install openai react-rnd`
Expected: package.json gains `"openai": "^4.x"` and `"react-rnd": "^10.x"` under `dependencies`.

- [ ] **Step 2: Verify `zod` already present**

Run: `node -e "console.log(require('./package.json').dependencies.zod)"`
Expected: prints `^3.24.2`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): add openai and react-rnd for Groq + window manager"
```

### Task 0.3: Add `.env.local.example`

**Files:**
- Create: `.env.local.example`

- [ ] **Step 1: Write the example**

```bash
# Groq-compatible LLM endpoint. Same env-var contract as compliance-agent-poc.
LLM_API_KEY=
LLM_BASE_URL=https://api.groq.com/openai/v1/
LLM_MODEL=openai/gpt-oss-120b
LLM_REQUEST_TIMEOUT_S=60
```

- [ ] **Step 2: Verify `.gitignore` excludes `.env.local`**

Run: `grep -n '^\.env' .gitignore`
Expected: line containing `.env*.local` or `.env.local`.

- [ ] **Step 3: Commit**

```bash
git add .env.local.example
git commit -m "chore: add .env.local.example with Groq env vars"
```

---

## Phase 1 — Foundation primitives (parallel sub-agents)

These three tasks have **no overlap** in files. Dispatch three sub-agents in parallel.

### Task 1.A: Theme tokens + Tailwind wiring + motion + icons

**Owner:** Sub-agent A (theme)

**Files:**
- Create: `src/lib/theme/tokens.ts`
- Create: `src/lib/theme/motion.ts`
- Create: `src/lib/theme/icons.tsx`
- Modify: `tailwind.config.js`
- Modify: `src/app/globals.css`
- Create: `public/wallpapers/kali-purple-dragon.jpg` (placeholder solid-color PNG is fine for foundation; real asset in polish PR)

- [ ] **Step 1: Write `src/lib/theme/tokens.ts`**

```ts
export const tokens = {
  color: {
    bg:        "#0b0d12",
    surface:   "#13161f",
    elevated:  "#1a1e2b",
    border:    "#2a3144",
    text:      "#e6e9f2",
    muted:     "#8a93a8",
    accent:    "#7c5cff",
    accent2:   "#22d3ee",
    success:   "#4ade80",
    warning:   "#fbbf24",
    danger:    "#ef4444",
  },
  font: {
    sans: "Inter, system-ui, sans-serif",
    mono: "'JetBrains Mono', ui-monospace, Menlo, monospace",
  },
  radius: { sm: "4px", md: "8px", lg: "12px" },
  shadow: {
    window: "0 24px 64px -12px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)",
  },
} as const;

export type ThemeTokens = typeof tokens;
```

- [ ] **Step 2: Write `src/lib/theme/motion.ts`**

```ts
import type { Transition } from "framer-motion";

export const motion = {
  snap:  { duration: 0.15, ease: [0.2, 0.8, 0.2, 1] } satisfies Transition,
  glide: { duration: 0.25, ease: [0.2, 0.8, 0.2, 1] } satisfies Transition,
  pulse: { duration: 1.2, ease: "easeInOut", repeat: Infinity, repeatType: "reverse" } satisfies Transition,
};
```

- [ ] **Step 3: Write `src/lib/theme/icons.tsx`** — re-export lucide icons with a 16px default and a single `<Icon name="…" />` wrapper for app icons.

```tsx
import * as L from "lucide-react";
import type { LucideProps } from "lucide-react";

const map = {
  terminal: L.Terminal,
  voice:    L.Mic,
  resume:   L.FileText,
  projects: L.Boxes,
  about:    L.Info,
  social:   L.Share2,
  doom:     L.Skull,
  tetris:   L.Grid3x3,
  mp3:      L.Music,
  vlc:      L.Film,
  close:    L.X,
  min:      L.Minus,
  max:      L.Square,
  menu:     L.Menu,
  power:    L.Power,
} as const;
export type IconName = keyof typeof map;

export function Icon({ name, size = 16, ...rest }: { name: IconName } & LucideProps) {
  const C = map[name];
  return <C size={size} {...rest} />;
}
```

- [ ] **Step 4: Rewire `tailwind.config.js`**

```js
const { tokens } = require("./src/lib/theme/tokens.ts");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg:       tokens.color.bg,
        surface:  tokens.color.surface,
        elevated: tokens.color.elevated,
        border:   tokens.color.border,
        fg:       tokens.color.text,
        muted:    tokens.color.muted,
        accent:   tokens.color.accent,
        accent2:  tokens.color.accent2,
        success:  tokens.color.success,
        warning:  tokens.color.warning,
        danger:   tokens.color.danger,
      },
      borderRadius: tokens.radius,
      boxShadow: { window: tokens.shadow.window },
      fontFamily: { sans: ["Inter","system-ui","sans-serif"], mono: ["JetBrains Mono","ui-monospace","Menlo","monospace"] },
      animation: {
        blink: "blink 1s step-end infinite",
        pulse2: "pulse2 1.2s ease-in-out infinite alternate",
      },
      keyframes: {
        blink:  { "0%,100%": { opacity: 1 }, "50%": { opacity: 0 } },
        pulse2: { "0%": { opacity: 0.4 }, "100%": { opacity: 1 } },
      },
    },
  },
  plugins: [],
};
```

> Tailwind reads JS, not TS. Either compile via `ts-node`/`tsx` register, OR keep tokens duplicated as a `.cjs` file. **Simpler approach:** create `src/lib/theme/tokens.cjs` with the same object and import it from `tailwind.config.js`; `tokens.ts` re-imports the cjs file for TS callers.

  Concretely write `src/lib/theme/tokens.cjs`:

  ```js
  module.exports = {
    tokens: {
      color: { bg: "#0b0d12", surface: "#13161f", elevated: "#1a1e2b", border: "#2a3144",
               text: "#e6e9f2", muted: "#8a93a8", accent: "#7c5cff", accent2: "#22d3ee",
               success: "#4ade80", warning: "#fbbf24", danger: "#ef4444" },
      radius: { sm: "4px", md: "8px", lg: "12px" },
      shadow: { window: "0 24px 64px -12px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)" },
    },
  };
  ```

  And make `src/lib/theme/tokens.ts`:

  ```ts
  // @ts-expect-error - cjs interop
  import { tokens as raw } from "./tokens.cjs";
  export const tokens = raw as {
    color: Record<string,string>; radius: Record<string,string>; shadow: Record<string,string>;
  };
  export type ThemeTokens = typeof tokens;
  ```

- [ ] **Step 5: Replace `src/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root { color-scheme: dark; }
html, body, #__next { height: 100%; }
body {
  background: #0b0d12;
  color: #e6e9f2;
  font-family: Inter, system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  overscroll-behavior: none;
}
```

- [ ] **Step 6: Drop in wallpaper placeholder**

```bash
# 1x1 dark-purple PNG written via node so we don't depend on an image tool
node -e "require('fs').writeFileSync('public/wallpapers/kali-purple-dragon.jpg', Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/wA/9k=','base64'))"
mkdir -p public/wallpapers
```

(Real wallpaper image is swapped in during the `chore/polish` PR.)

- [ ] **Step 7: Verify build still parses**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/lib/theme tailwind.config.js src/app/globals.css public/wallpapers
git commit -m "feat(theme): introduce design tokens, motion presets, icon set"
```

---

### Task 1.B: LLM client + streaming chat API route

**Owner:** Sub-agent B (LLM)

**Files:**
- Create: `src/lib/llm/client.ts`
- Create: `src/lib/llm/prompts.ts`
- Create: `src/lib/llm/types.ts`
- Create: `src/app/api/chat/route.ts`
- (Sub-agent C will create `src/lib/resume/loader.ts`; this sub-agent must NOT touch it — coordinate only via Step 4's import path stub.)

- [ ] **Step 1: Write `src/lib/llm/types.ts`**

```ts
export type Role = "system" | "user" | "assistant";

export interface ChatMessage {
  role: Role;
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  model?: string;
  agentRole?: "recruiter" | "collaborator";
}

export interface ChatChunk {
  delta: string;
  done?: boolean;
  error?: string;
}
```

- [ ] **Step 2: Write `src/lib/llm/client.ts`**

```ts
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
```

- [ ] **Step 3: Write `src/lib/llm/prompts.ts`**

```ts
import type { ChatMessage } from "./types";

const BASE = `You are Diwakar Adhikari's portfolio agent. Diwakar is the Technical Lead — AI Engineering at Bajaj Life Insurance, based in Pune, India.
You answer questions about his work, projects, and skills based ONLY on the resume context provided. If asked about something not covered, say so honestly.
Keep replies concise (2-4 short paragraphs unless asked for detail). Use plain prose; no markdown headings.`;

const ROLE_FRAMING = {
  recruiter:
    `Frame answers for a senior recruiter or hiring manager evaluating fit for a staff/lead AI role. Surface scale, impact, and decision-making.`,
  collaborator:
    `Frame answers for a fellow engineer asking technically. Surface stack choices, architecture trade-offs, and what was hard.`,
} as const;

export function systemPrompt(opts: {
  resumeContext: string;
  agentRole?: keyof typeof ROLE_FRAMING;
}): ChatMessage {
  const framing = ROLE_FRAMING[opts.agentRole ?? "recruiter"];
  return {
    role: "system",
    content: `${BASE}\n\n${framing}\n\n---\nRESUME CONTEXT:\n${opts.resumeContext}\n---`,
  };
}
```

- [ ] **Step 4: Write `src/app/api/chat/route.ts`**

```ts
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
```

> The `loadResumeContext` import will land via Sub-agent C. Until that lands, write a tiny stub `src/lib/resume/loader.ts` that exports `export async function loadResumeContext(){return "(resume context will be wired in)";}` so this route compiles independently — Sub-agent C overwrites it.

- [ ] **Step 5: Write stub `src/lib/resume/loader.ts`**

```ts
// STUB — Sub-agent C replaces this with the real loader.
export async function loadResumeContext(): Promise<string> {
  return "(resume context will be wired in)";
}
```

- [ ] **Step 6: Smoke-test the route compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/llm src/lib/resume/loader.ts src/app/api/chat/route.ts
git commit -m "feat(llm): Groq-compatible client and /api/chat SSE proxy"
```

---

### Task 1.C: Resume schema + new content + PDF copy

**Owner:** Sub-agent C (resume)

**Files:**
- Create: `src/lib/resume/schema.ts`
- Overwrite: `src/lib/resume/loader.ts` (replaces sub-agent B's stub)
- Create: `src/lib/resume/retriever.ts`
- Overwrite: `public/resume.json`
- Overwrite: `public/resume.pdf` (copy from `C:\Users\Diwakar.Adhikari01\Downloads\Purple and White Clean and Professional Resume (1).pdf`)

- [ ] **Step 1: Write `src/lib/resume/schema.ts`**

```ts
import { z } from "zod";

export const PersonalSchema = z.object({
  full_name: z.string(),
  title: z.string(),
  email: z.string().email(),
  phone: z.string(),
  location: z.string(),
  linkedin: z.string().url().optional(),
  github: z.string().url().optional(),
  twitter: z.string().url().optional(),
});

export const ExperienceSchema = z.object({
  title: z.string(),
  company: z.string(),
  location: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  bullets: z.array(z.string()),
});

export const EducationSchema = z.object({
  degree: z.string(),
  major: z.string().optional(),
  institution: z.string(),
  cgpa: z.string().optional(),
  start_date: z.string(),
  end_date: z.string(),
});

export const ProjectSchema = z.object({
  name: z.string(),
  blurb: z.string(),
  tech: z.array(z.string()).optional(),
  link: z.string().url().optional(),
});

export const ResearchSchema = z.object({
  title: z.string(),
  venue: z.string().optional(),
});

export const ResumeSchema = z.object({
  personal: PersonalSchema,
  summary: z.string(),
  experience: z.array(ExperienceSchema),
  skills: z.array(z.string()),
  education: z.array(EducationSchema),
  projects: z.array(ProjectSchema),
  awards: z.array(z.string()),
  research: z.array(ResearchSchema),
});

export type Resume = z.infer<typeof ResumeSchema>;
export type Personal = z.infer<typeof PersonalSchema>;
export type Experience = z.infer<typeof ExperienceSchema>;
export type Project = z.infer<typeof ProjectSchema>;
```

- [ ] **Step 2: Overwrite `public/resume.json`** with the new AI Tech Lead content. Use this exact JSON (taken verbatim from the PDF the owner provided):

```json
{
  "personal": {
    "full_name": "Diwakar Adhikari",
    "title": "Technical Lead — AI Engineering",
    "email": "diwakar.adhikari0@gmail.com",
    "phone": "+91 9378067880",
    "location": "Pune, India",
    "linkedin": "https://www.linkedin.com/in/diwakar-adhikari/",
    "github": "https://github.com/Thunderk3g"
  },
  "summary": "AI/ML Engineer and Technical Lead specialising in production-grade agentic AI systems for the insurance and financial services domain. Experienced in architecting and deploying LLM-powered applications, conversational AI agents, compliance automation systems, and real-time voice interfaces across enterprise environments. Led development of AI-driven insurance workflow platforms including compliance intelligence agents, conversational sales copilots, GEO (Generative Engine Optimization) pipelines, and multimodal sales analytics systems capable of extracting structured customer insights from large-scale conversational and enterprise data. Worked extensively on building and fine-tuning transformer architectures and LLM-based systems for domain-specific use cases including sales intelligence, conversational automation, and customer personalisation. Experienced in scalable inference systems, retrieval-augmented generation (RAG), full-duplex voice AI, and enterprise-grade AI orchestration.",
  "experience": [
    {
      "title": "Technical Lead — AI Engineering",
      "company": "Bajaj Life Insurance",
      "location": "Pune, India",
      "start_date": "Dec 2025",
      "end_date": "Present",
      "bullets": [
        "Led development of a production-grade compliance intelligence platform for insurance workflows, transforming internal AI proof-of-concepts into deployable enterprise applications.",
        "Architected and deployed LLM-powered conversational systems for insurance onboarding, policy guidance, workflow automation, and customer support operations.",
        "Built multimodal sales analytics pipelines capable of processing sales-call recordings and extracting structured customer intelligence, behavioural signals, and actionable business insights.",
        "Developed GEO (Generative Engine Optimization) pipelines to improve AI-native discoverability and conversational relevance of insurance products across search and assistant ecosystems.",
        "Worked on transformer-based architectures and domain-specific LLM fine-tuning using enterprise sales interaction datasets to improve conversational quality and response accuracy.",
        "Collaborated across compliance, business, and engineering teams to productionise secure, scalable, and governance-aligned AI systems for enterprise deployment."
      ]
    },
    {
      "title": "Dev Lead",
      "company": "Bajaj Finserv Direct Ltd",
      "location": "Pune, India",
      "start_date": "Jun 2022",
      "end_date": "Nov 2025",
      "bullets": [
        "Dev Lead for a 10-member team delivering high-impact term-insurance journeys; led APIs, deployments, and cross-team integration with Bajaj Allianz (25% efficiency gain).",
        "Improved performance, SEO, and engagement via Angular optimisation and SSR, achieving up to 30% performance and 20% engagement uplift.",
        "Enhanced scalability and security, fixed critical auth issues (VAPT), and contributed to Bajaj Finserv Asset Management NFO launch driving 50% user adoption."
      ]
    }
  ],
  "skills": [
    "Python", "LangChain", "LangGraph", "Hugging Face Transformers", "PyTorch",
    "Java", "Angular", "Next.js", "Vite",
    "Docker", "Redis", "Apache Kafka", "API Design & Integration",
    "RAG", "Vector databases (pgvector)", "OpenAI / Groq / Anthropic APIs",
    "Full-duplex voice AI", "FastAPI"
  ],
  "education": [
    {
      "degree": "Bachelor of Technology",
      "major": "Computer Science Engineering",
      "institution": "SRM University",
      "cgpa": "8.8",
      "start_date": "Apr 2018",
      "end_date": "May 2022"
    }
  ],
  "projects": [
    {
      "name": "full-duplex-moshi-agent",
      "blurb": "Python implementation building on the Moshi full-duplex spoken dialogue model (forked from kyutai-labs/moshi). Explores real-time voice-enabled LLM interactions suitable for agentic interfaces and conversational AI in local environments.",
      "tech": ["Python", "PyTorch", "Moshi", "WebRTC"]
    },
    {
      "name": "compliance-agent",
      "blurb": "Enterprise AI compliance platform designed for insurance workflows, enabling intelligent validation, policy-aware workflow enforcement, and conversational compliance assistance for regulated enterprise environments.",
      "tech": ["Python", "FastAPI", "LangChain", "LangGraph", "Groq", "pgvector", "Redis"]
    },
    {
      "name": "Aetherflow",
      "blurb": "Enterprise-grade AI orchestration platform for insurance workflow automation, conversational intelligence, compliance operations, and AI-assisted customer engagement.",
      "tech": ["Python", "LangGraph", "Postgres", "Redis"]
    }
  ],
  "awards": [
    "Esteemed Contributor to Financial Innovation Award",
    "COMPEX Indian Embassy Scholarship Scheme Awardee"
  ],
  "research": [
    {
      "title": "SustainAi: Enhancing sustainable energy forecasting",
      "venue": "1st International Conference on Computing for Science, Engineering & Artificial Intelligence (CSEAI 2023), in collaboration with California State University and the International Association of Academicians."
    }
  ]
}
```

- [ ] **Step 3: Overwrite `public/resume.pdf`** with the new PDF.

Run (PowerShell): `Copy-Item -Path "C:\Users\Diwakar.Adhikari01\Downloads\Purple and White Clean and Professional Resume (1).pdf" -Destination ".\public\resume.pdf" -Force`
Expected: file replaced, ~106 KB.

- [ ] **Step 4: Write `src/lib/resume/loader.ts`** (replaces the stub from Sub-agent B)

```ts
import fs from "node:fs/promises";
import path from "node:path";
import { ResumeSchema, type Resume } from "./schema";

let cached: Resume | null = null;

export async function loadResume(): Promise<Resume> {
  if (cached) return cached;
  const file = path.join(process.cwd(), "public", "resume.json");
  const raw = await fs.readFile(file, "utf8");
  const parsed = ResumeSchema.parse(JSON.parse(raw));
  cached = parsed;
  return parsed;
}

export async function loadResumeContext(): Promise<string> {
  const r = await loadResume();
  const exp = r.experience
    .map((e) => `- ${e.title} at ${e.company} (${e.start_date} – ${e.end_date}): ${e.bullets.join(" ")}`)
    .join("\n");
  const projects = r.projects.map((p) => `- ${p.name}: ${p.blurb}`).join("\n");
  return [
    `NAME: ${r.personal.full_name}`,
    `TITLE: ${r.personal.title}`,
    `LOCATION: ${r.personal.location}`,
    `SUMMARY: ${r.summary}`,
    `EXPERIENCE:\n${exp}`,
    `PROJECTS:\n${projects}`,
    `SKILLS: ${r.skills.join(", ")}`,
    `AWARDS: ${r.awards.join("; ")}`,
  ].join("\n\n");
}
```

- [ ] **Step 5: Write `src/lib/resume/retriever.ts`** (very small keyword RAG — same shape as the old retriever, but resilient to schema)

```ts
import { loadResume } from "./loader";

export async function retrieveRelevant(query: string, max = 6): Promise<string[]> {
  const r = await loadResume();
  const corpus: string[] = [
    r.summary,
    ...r.experience.flatMap((e) => [`${e.title} at ${e.company}`, ...e.bullets]),
    ...r.projects.flatMap((p) => [`${p.name}: ${p.blurb}`]),
    ...r.skills,
    ...r.awards,
  ];
  const q = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  const scored = corpus.map((line) => {
    const lower = line.toLowerCase();
    const score = q.reduce((s, t) => s + (lower.includes(t) ? 1 : 0), 0);
    return { line, score };
  });
  return scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score).slice(0, max).map((s) => s.line);
}
```

- [ ] **Step 6: Verify Zod parse succeeds**

Run: `node -e "const{ResumeSchema}=require('./src/lib/resume/schema');ResumeSchema.parse(JSON.parse(require('fs').readFileSync('public/resume.json','utf8')));console.log('OK')"`

> If `ts-node`/transpile isn't set up, skip and rely on `npx tsc --noEmit` in Step 7.

- [ ] **Step 7: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/lib/resume public/resume.json public/resume.pdf
git commit -m "feat(resume): new AI Tech Lead resume + Zod schema + loader"
```

---

## Phase 2 — Window manager & desktop shell (sequential, single agent)

This phase is owned by **the main agent** (you), not a sub-agent — it's the integration glue.

### Task 2.1: Window types + reducer

**Files:**
- Create: `src/types/window.ts`
- Create: `src/components/desktop/windowReducer.ts`

- [ ] **Step 1: Write `src/types/window.ts`**

```ts
export type AppKind =
  | "terminal" | "voice" | "resume" | "projects"
  | "about"    | "social" | "doom"   | "tetris" | "mp3" | "vlc";

export interface Bounds { x: number; y: number; width: number; height: number; }

export interface WindowState {
  id: string;
  kind: AppKind;
  title: string;
  bounds: Bounds;
  zIndex: number;
  minimised: boolean;
  maximised: boolean;
  prevBounds?: Bounds;
}
```

- [ ] **Step 2: Write `src/components/desktop/windowReducer.ts`**

```ts
import type { AppKind, Bounds, WindowState } from "@/types/window";

export interface WindowMgrState {
  windows: Record<string, WindowState>;
  order: string[];          // bottom-to-top stacking order
  zCounter: number;
}

export type Action =
  | { type: "OPEN";    kind: AppKind; title: string; bounds: Bounds; id?: string }
  | { type: "CLOSE";   id: string }
  | { type: "FOCUS";   id: string }
  | { type: "MIN";     id: string }
  | { type: "MAX";     id: string; viewport: { w: number; h: number } }
  | { type: "BOUNDS";  id: string; bounds: Bounds };

const TASKBAR_H = 40;

export const initialState: WindowMgrState = { windows: {}, order: [], zCounter: 10 };

export function reduce(state: WindowMgrState, a: Action): WindowMgrState {
  switch (a.type) {
    case "OPEN": {
      const id = a.id ?? `${a.kind}-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
      const z = state.zCounter + 1;
      const win: WindowState = {
        id, kind: a.kind, title: a.title, bounds: a.bounds,
        zIndex: z, minimised: false, maximised: false,
      };
      return {
        windows: { ...state.windows, [id]: win },
        order: [...state.order.filter((x) => x !== id), id],
        zCounter: z,
      };
    }
    case "CLOSE": {
      const { [a.id]: _, ...rest } = state.windows;
      return { ...state, windows: rest, order: state.order.filter((x) => x !== a.id) };
    }
    case "FOCUS": {
      const w = state.windows[a.id]; if (!w) return state;
      const z = state.zCounter + 1;
      return {
        ...state,
        zCounter: z,
        windows: { ...state.windows, [a.id]: { ...w, zIndex: z, minimised: false } },
        order: [...state.order.filter((x) => x !== a.id), a.id],
      };
    }
    case "MIN": {
      const w = state.windows[a.id]; if (!w) return state;
      return { ...state, windows: { ...state.windows, [a.id]: { ...w, minimised: !w.minimised } } };
    }
    case "MAX": {
      const w = state.windows[a.id]; if (!w) return state;
      if (w.maximised && w.prevBounds) {
        return { ...state, windows: { ...state.windows, [a.id]: { ...w, maximised: false, bounds: w.prevBounds, prevBounds: undefined } } };
      }
      const max: Bounds = { x: 0, y: 0, width: a.viewport.w, height: a.viewport.h - TASKBAR_H };
      return { ...state, windows: { ...state.windows, [a.id]: { ...w, maximised: true, prevBounds: w.bounds, bounds: max } } };
    }
    case "BOUNDS": {
      const w = state.windows[a.id]; if (!w) return state;
      return { ...state, windows: { ...state.windows, [a.id]: { ...w, bounds: a.bounds } } };
    }
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/types/window.ts src/components/desktop/windowReducer.ts
git commit -m "feat(desktop): window state reducer"
```

### Task 2.2: WindowManager context + hook

**Files:**
- Create: `src/components/desktop/WindowManager.tsx`

- [ ] **Step 1: Write the provider**

```tsx
"use client";
import { createContext, useCallback, useContext, useMemo, useReducer } from "react";
import type { AppKind, Bounds, WindowState } from "@/types/window";
import { initialState, reduce } from "./windowReducer";

interface Api {
  windows: Record<string, WindowState>;
  order: string[];
  open(kind: AppKind, opts?: { title?: string; bounds?: Partial<Bounds>; id?: string }): string;
  close(id: string): void;
  focus(id: string): void;
  minimise(id: string): void;
  toggleMaximise(id: string): void;
  setBounds(id: string, b: Bounds): void;
}

const Ctx = createContext<Api | null>(null);
export const useWindows = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWindows outside provider");
  return v;
};

const DEFAULT_TITLES: Record<AppKind, string> = {
  terminal: "Terminal",
  voice: "Voice Assistant",
  resume: "Resume",
  projects: "Projects",
  about: "About",
  social: "Social",
  doom: "Doom",
  tetris: "Tetris",
  mp3: "MP3 Player",
  vlc: "Media Player",
};

const DEFAULT_BOUNDS: Bounds = { x: 80, y: 60, width: 720, height: 480 };

export function WindowManagerProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reduce, initialState);

  const open: Api["open"] = useCallback((kind, opts) => {
    const id = opts?.id ?? `${kind}-${Date.now()}`;
    const bounds: Bounds = {
      x: opts?.bounds?.x ?? DEFAULT_BOUNDS.x + Math.random() * 60,
      y: opts?.bounds?.y ?? DEFAULT_BOUNDS.y + Math.random() * 40,
      width:  opts?.bounds?.width  ?? DEFAULT_BOUNDS.width,
      height: opts?.bounds?.height ?? DEFAULT_BOUNDS.height,
    };
    dispatch({ type: "OPEN", kind, title: opts?.title ?? DEFAULT_TITLES[kind], bounds, id });
    return id;
  }, []);

  const api = useMemo<Api>(() => ({
    windows: state.windows,
    order: state.order,
    open,
    close:    (id) => dispatch({ type: "CLOSE", id }),
    focus:    (id) => dispatch({ type: "FOCUS", id }),
    minimise: (id) => dispatch({ type: "MIN", id }),
    toggleMaximise: (id) =>
      dispatch({ type: "MAX", id, viewport: { w: typeof window !== "undefined" ? window.innerWidth : 1280, h: typeof window !== "undefined" ? window.innerHeight : 800 } }),
    setBounds: (id, b) => dispatch({ type: "BOUNDS", id, bounds: b }),
  }), [state, open]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
```

- [ ] **Step 2: Verify compile**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/desktop/WindowManager.tsx
git commit -m "feat(desktop): WindowManager context provider"
```

### Task 2.3: Window primitive (react-rnd)

**Files:**
- Create: `src/components/desktop/Window.tsx`

- [ ] **Step 1: Write the primitive**

```tsx
"use client";
import { Rnd } from "react-rnd";
import { motion as fm } from "framer-motion";
import { useWindows } from "./WindowManager";
import { Icon } from "@/lib/theme/icons";
import { motion as motionPresets } from "@/lib/theme/motion";

export function Window({
  id, children,
}: { id: string; children: React.ReactNode }) {
  const { windows, focus, close, minimise, toggleMaximise, setBounds } = useWindows();
  const w = windows[id];
  if (!w || w.minimised) return null;

  return (
    <Rnd
      size={{ width: w.bounds.width, height: w.bounds.height }}
      position={{ x: w.bounds.x, y: w.bounds.y }}
      minWidth={320} minHeight={220}
      bounds="parent"
      dragHandleClassName="window-drag-handle"
      onMouseDown={() => focus(id)}
      onDragStop={(_, d) => setBounds(id, { ...w.bounds, x: d.x, y: d.y })}
      onResizeStop={(_, __, ref, ___, pos) => setBounds(id, {
        x: pos.x, y: pos.y,
        width: parseInt(ref.style.width, 10),
        height: parseInt(ref.style.height, 10),
      })}
      style={{ zIndex: w.zIndex }}
      disableDragging={w.maximised}
      enableResizing={!w.maximised}
    >
      <fm.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={motionPresets.glide}
        className="flex h-full w-full flex-col overflow-hidden rounded-md bg-surface shadow-window ring-1 ring-border"
      >
        <div className="window-drag-handle flex h-9 select-none items-center justify-between border-b border-border bg-elevated px-3 text-xs text-muted">
          <div className="flex items-center gap-2">
            <button aria-label="close"    onClick={() => close(id)}     className="h-3 w-3 rounded-full bg-danger" />
            <button aria-label="minimise" onClick={() => minimise(id)} className="h-3 w-3 rounded-full bg-warning" />
            <button aria-label="maximise" onClick={() => toggleMaximise(id)} className="h-3 w-3 rounded-full bg-success" />
            <span className="ml-3 font-mono text-fg">{w.title}</span>
          </div>
          <Icon name="menu" size={14} />
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-surface">{children}</div>
      </fm.div>
    </Rnd>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/desktop/Window.tsx
git commit -m "feat(desktop): Window primitive backed by react-rnd"
```

### Task 2.4: App registry (placeholders for each AppKind)

**Files:**
- Create: `src/components/apps/registry.tsx`

- [ ] **Step 1: Write the registry of placeholder app components.** (Per-app sub-agents in Phase 4 replace these with real components.)

```tsx
import type { AppKind } from "@/types/window";

function Placeholder({ kind }: { kind: AppKind }) {
  return (
    <div className="flex h-full items-center justify-center p-6 font-mono text-sm text-muted">
      <code>{kind}</code> app placeholder — replaced in PR #{2 + KINDS.indexOf(kind)}.
    </div>
  );
}

const KINDS: AppKind[] = ["terminal","voice","resume","projects","about","social","tetris","doom","mp3","vlc"];

export const APP_REGISTRY: Record<AppKind, React.ComponentType> = {
  terminal: () => <Placeholder kind="terminal" />,
  voice:    () => <Placeholder kind="voice"    />,
  resume:   () => <Placeholder kind="resume"   />,
  projects: () => <Placeholder kind="projects" />,
  about:    () => <Placeholder kind="about"    />,
  social:   () => <Placeholder kind="social"   />,
  doom:     () => <Placeholder kind="doom"     />,
  tetris:   () => <Placeholder kind="tetris"   />,
  mp3:      () => <Placeholder kind="mp3"      />,
  vlc:      () => <Placeholder kind="vlc"      />,
};
```

- [ ] **Step 2: Commit**

```bash
git add src/components/apps/registry.tsx
git commit -m "feat(apps): placeholder registry for all 10 AppKinds"
```

### Task 2.5: Desktop icons, taskbar, start menu, context menu

**Files:**
- Create: `src/components/desktop/DesktopIcons.tsx`
- Create: `src/components/desktop/Taskbar.tsx`
- Create: `src/components/desktop/StartMenu.tsx`
- Create: `src/components/desktop/ContextMenu.tsx`

- [ ] **Step 1: `DesktopIcons.tsx`** — 10 icons in a column down the left.

```tsx
"use client";
import { useWindows } from "./WindowManager";
import { Icon, type IconName } from "@/lib/theme/icons";
import type { AppKind } from "@/types/window";

const ICONS: { kind: AppKind; icon: IconName; label: string }[] = [
  { kind: "terminal", icon: "terminal", label: "Terminal" },
  { kind: "voice",    icon: "voice",    label: "Voice" },
  { kind: "resume",   icon: "resume",   label: "Resume" },
  { kind: "projects", icon: "projects", label: "Projects" },
  { kind: "about",    icon: "about",    label: "About" },
  { kind: "social",   icon: "social",   label: "Social" },
  { kind: "doom",     icon: "doom",     label: "Doom" },
  { kind: "tetris",   icon: "tetris",   label: "Tetris" },
  { kind: "mp3",      icon: "mp3",      label: "MP3" },
  { kind: "vlc",      icon: "vlc",      label: "Media" },
];

export function DesktopIcons() {
  const { open } = useWindows();
  return (
    <div className="absolute left-4 top-4 flex flex-col gap-3">
      {ICONS.map((it) => (
        <button
          key={it.kind}
          onDoubleClick={() => open(it.kind)}
          className="flex w-20 flex-col items-center gap-1 rounded p-2 text-xs text-fg/90 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <Icon name={it.icon} size={28} className="text-accent" />
          <span className="text-center leading-tight">{it.label}</span>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: `Taskbar.tsx`**

```tsx
"use client";
import { useWindows } from "./WindowManager";
import { Icon } from "@/lib/theme/icons";
import { useEffect, useState } from "react";
import { StartMenu } from "./StartMenu";

export function Taskbar() {
  const { windows, order, focus, minimise } = useWindows();
  const [open, setOpen] = useState(false);
  const [time, setTime] = useState("");
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    tick(); const i = setInterval(tick, 30_000); return () => clearInterval(i);
  }, []);

  const visible = order.map((id) => windows[id]).filter(Boolean);

  return (
    <div className="absolute inset-x-0 bottom-0 z-[9999] flex h-10 items-center gap-2 border-t border-border bg-elevated/90 px-2 backdrop-blur">
      <button onClick={() => setOpen((o) => !o)} className="rounded p-1 text-accent hover:bg-white/5"><Icon name="power" /></button>
      <StartMenu open={open} onClose={() => setOpen(false)} />
      <div className="mx-2 h-5 w-px bg-border" />
      <div className="flex flex-1 items-center gap-1 overflow-x-auto">
        {visible.map((w) => (
          <button
            key={w.id}
            onClick={() => (w.minimised ? focus(w.id) : minimise(w.id))}
            className={`flex items-center gap-2 rounded px-2 py-1 text-xs ${w.minimised ? "text-muted" : "text-fg bg-white/5"}`}
          >
            {w.title}
          </button>
        ))}
      </div>
      <div className="font-mono text-xs text-muted">{time}</div>
    </div>
  );
}
```

- [ ] **Step 3: `StartMenu.tsx`**

```tsx
"use client";
import { useWindows } from "./WindowManager";
import { Icon, type IconName } from "@/lib/theme/icons";
import type { AppKind } from "@/types/window";

const ITEMS: { kind: AppKind; icon: IconName; label: string }[] = [
  { kind: "terminal", icon: "terminal", label: "Terminal" },
  { kind: "voice",    icon: "voice",    label: "Voice Assistant" },
  { kind: "resume",   icon: "resume",   label: "Resume" },
  { kind: "projects", icon: "projects", label: "Projects" },
  { kind: "about",    icon: "about",    label: "About" },
  { kind: "social",   icon: "social",   label: "Social" },
  { kind: "tetris",   icon: "tetris",   label: "Tetris" },
  { kind: "doom",     icon: "doom",     label: "Doom" },
  { kind: "mp3",      icon: "mp3",      label: "MP3 Player" },
  { kind: "vlc",      icon: "vlc",      label: "Media Player" },
];

export function StartMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { open: openWin } = useWindows();
  if (!open) return null;
  return (
    <div
      onMouseLeave={onClose}
      className="absolute bottom-10 left-2 z-[10000] w-64 rounded-md border border-border bg-elevated p-2 shadow-window"
    >
      {ITEMS.map((it) => (
        <button
          key={it.kind}
          onClick={() => { openWin(it.kind); onClose(); }}
          className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm hover:bg-white/5"
        >
          <Icon name={it.icon} size={16} className="text-accent" />
          <span>{it.label}</span>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: `ContextMenu.tsx`** — right-click handler on the desktop background. For foundation, a single "About this desktop" entry that opens the About app. (Wallpaper picker can come later.)

```tsx
"use client";
import { useEffect, useState } from "react";
import { useWindows } from "./WindowManager";

export function ContextMenu({ targetRef }: { targetRef: React.RefObject<HTMLDivElement | null> }) {
  const { open } = useWindows();
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const el = targetRef.current; if (!el) return;
    const onCtx = (e: MouseEvent) => { if (e.target === el) { e.preventDefault(); setPos({ x: e.clientX, y: e.clientY }); } };
    const onClick = () => setPos(null);
    el.addEventListener("contextmenu", onCtx);
    window.addEventListener("click", onClick);
    return () => { el.removeEventListener("contextmenu", onCtx); window.removeEventListener("click", onClick); };
  }, [targetRef]);

  if (!pos) return null;
  return (
    <ul style={{ top: pos.y, left: pos.x }} className="absolute z-[10001] w-48 rounded border border-border bg-elevated py-1 text-sm shadow-window">
      <li><button onClick={() => { open("about"); setPos(null); }} className="block w-full px-3 py-1.5 text-left hover:bg-white/5">About this desktop</button></li>
      <li><button onClick={() => { open("terminal"); setPos(null); }} className="block w-full px-3 py-1.5 text-left hover:bg-white/5">Open Terminal</button></li>
    </ul>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/desktop/{DesktopIcons,Taskbar,StartMenu,ContextMenu}.tsx
git commit -m "feat(desktop): icons, taskbar, start menu, context menu"
```

### Task 2.6: Desktop shell + auto-open terminal

**Files:**
- Create: `src/components/desktop/Desktop.tsx`

- [ ] **Step 1: Write the shell**

```tsx
"use client";
import { useEffect, useRef } from "react";
import { WindowManagerProvider, useWindows } from "./WindowManager";
import { Window } from "./Window";
import { DesktopIcons } from "./DesktopIcons";
import { Taskbar } from "./Taskbar";
import { ContextMenu } from "./ContextMenu";
import { APP_REGISTRY } from "@/components/apps/registry";

function DesktopBody() {
  const { windows, open } = useWindows();
  const bgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-open Terminal on first paint.
    open("terminal", { bounds: { x: 320, y: 80, width: 760, height: 520 } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={bgRef}
      className="relative h-screen w-screen overflow-hidden bg-bg text-fg"
      style={{
        backgroundImage: "url(/wallpapers/kali-purple-dragon.jpg)",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <DesktopIcons />
      {Object.values(windows).map((w) => {
        const App = APP_REGISTRY[w.kind];
        return <Window key={w.id} id={w.id}><App /></Window>;
      })}
      <ContextMenu targetRef={bgRef} />
      <Taskbar />
    </div>
  );
}

export function Desktop() {
  return (
    <WindowManagerProvider>
      <DesktopBody />
    </WindowManagerProvider>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/desktop/Desktop.tsx
git commit -m "feat(desktop): top-level Desktop shell wires manager + apps + taskbar"
```

### Task 2.7: Gut page.tsx

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Replace the entire file**

```tsx
import { Desktop } from "@/components/desktop/Desktop";

export const dynamic = "force-dynamic";

export default function Page() {
  return <Desktop />;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(page): land directly on desktop — no boot animation"
```

### Task 2.8: Delete dead code (Ollama, landing, old desktop, etc.)

**Files (delete):**
- `src/components/landing/**`
- `src/lib/ollama/**`
- `src/app/api/ollama/**`
- `src/components/desktop/LinuxDesktop.tsx`
- `src/components/desktop/JarvisAssistant.tsx`
- `src/components/desktop/AgentSelector.tsx`
- `src/components/desktop/TerminalAgentSelector.tsx`
- `OLLAMA_BRIDGE.md` (if present at repo root)

- [ ] **Step 1: Inventory before deletion** — list the files actually present

Run: `git ls-files src/components/landing src/lib/ollama src/app/api/ollama`
Expected: lists files (not empty).

- [ ] **Step 2: Find any remaining imports of Ollama or landing**

Run: `git grep -nE "(from ['\"]@?\/?src?\/lib\/ollama)|(from ['\"]@?\/?src?\/components\/landing)|(checkOllamaAvailability)|(LandingAnimation)" -- 'src/**' | head -30`
Expected: at most references inside the files we're about to delete.

- [ ] **Step 3: Delete the directories**

```bash
git rm -r src/components/landing src/lib/ollama src/app/api/ollama 2>$null
git rm  src/components/desktop/LinuxDesktop.tsx                   2>$null
git rm  src/components/desktop/JarvisAssistant.tsx                2>$null
git rm  src/components/desktop/AgentSelector.tsx                  2>$null
git rm  src/components/desktop/TerminalAgentSelector.tsx          2>$null
git rm  OLLAMA_BRIDGE.md                                          2>$null
```

- [ ] **Step 4: Find any leftover broken imports**

Run: `npx tsc --noEmit`
Expected: passes. If anything still references deleted modules, delete those files too (they're orphaned).

- [ ] **Step 5: Commit**

```bash
git commit -m "chore: delete landing, Ollama lib + API route, and old desktop monolith"
```

---

## Phase 3 — Foundation smoke test

### Task 3.1: README + env docs

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Strip Ollama-bridge content, add Groq section**

Replace the existing "Local LLM setup" section with:

```markdown
## Setup

```bash
git clone https://github.com/Thunderk3g/thunderkeg-homepage.git
cd thunderkeg-homepage
npm install
cp .env.local.example .env.local
# Fill in LLM_API_KEY with a Groq API key (https://console.groq.com)
npm run dev
```

The portfolio calls Groq via the OpenAI-compatible endpoint. Swap providers by changing `LLM_BASE_URL` and `LLM_MODEL` — the same code targets OpenAI, Gemini OpenAI-compat, vLLM, Ollama, etc.

### Env vars (`.env.local`)

| var | example | meaning |
|-----|---------|---------|
| `LLM_API_KEY` | `gsk_…` | Groq API key (server-side only) |
| `LLM_BASE_URL` | `https://api.groq.com/openai/v1/` | OpenAI-compatible chat endpoint |
| `LLM_MODEL` | `openai/gpt-oss-120b` | Model id used for chat |
| `LLM_REQUEST_TIMEOUT_S` | `60` | Per-request timeout |
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: rewrite setup section for Groq env-var contract"
```

### Task 3.2: Build + dev smoke

**Files:** (none modified)

- [ ] **Step 1: Type check**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: 0 errors. (Warnings about unused vars from placeholders are OK.)

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build succeeds, `Compiled successfully`.

- [ ] **Step 4: Dev smoke test**

Manually:
1. Set `LLM_API_KEY` in `.env.local` (use Groq key if you have one; otherwise leave blank — the desktop still renders, only `/api/chat` returns 503).
2. `npm run dev`, open `http://localhost:3000`.
3. Confirm: dark desktop with Kali purple accent loads, Terminal placeholder opens centred, taskbar shows clock + Terminal tile, drag the title bar smoothly, click red dot to close, double-click each desktop icon, right-click the wallpaper for the context menu.

- [ ] **Step 5: Capture before-shot of foundation**

Run: `python docs/superpowers/capture_screens.py` (use whatever flags it accepts; goal is one screenshot of the new desktop).
Expected: `docs/superpowers/screenshots/10-foundation.png` exists.

- [ ] **Step 6: Commit screenshots**

```bash
git add docs/superpowers/screenshots
git commit -m "docs(screenshots): foundation desktop"
```

### Task 3.3: PR for foundation

**Files:** (none)

- [ ] **Step 1: Stop and check in with the owner.** Do NOT push or open the PR without explicit "push it" from the owner. Surface:
  - branch name
  - commit list (`git log main..HEAD --oneline`)
  - one screenshot
  - the smoke-test result

- [ ] **Step 2 (after owner OK): Push and open PR**

```bash
git push -u origin feat/foundation
gh pr create --base main --head feat/foundation --title "feat: Kali desktop foundation — Groq + new window manager" --body-file docs/superpowers/plans/foundation-pr-body.md
```

(Generate `docs/superpowers/plans/foundation-pr-body.md` from the spec's executive summary + acceptance criteria. Owner reviews and merges before Phase 4 begins.)

---

## Phase 4 — Parallel app rewrites (dispatch briefs)

Once `feat/foundation` is merged into `main`, dispatch **ten** sub-agents in parallel. Each branch is cut off the new `main`. Each PR replaces exactly one `APP_REGISTRY[kind]` entry with a real implementation.

> **All sub-agents share these rules:**
> - Branch off `main` (post-merge).
> - Only edit files inside their assigned app folder, plus `src/components/apps/registry.tsx` to wire the real component.
> - No edits to `src/components/desktop/*`, `src/lib/llm/*`, `src/lib/theme/*`, `src/lib/resume/*`, `src/types/*` without flagging the conflict.
> - Use ONLY token colors / Tailwind classes mapped to tokens. No raw hex.
> - Touch + keyboard accessibility table-stakes.
> - Sub-agent returns: (a) a one-paragraph summary of what they built, (b) list of new files, (c) screenshot path, (d) any decisions they had to make outside the brief.

### PR #2 — `feat/app-terminal` — **Terminal App**

**Dispatch brief:**

> Build `src/components/apps/terminal/`:
> - `TerminalApp.tsx` (default export — renders the full UI)
> - `TerminalHistory.tsx` (scrollback)
> - `TerminalPrompt.tsx` (input box with submit handling, Enter to send, Shift+Enter for newline)
> - `useTerminalAgent.ts` (state hook: messages, isStreaming, send(), clear(), agentRole, setAgentRole)
>
> `useTerminalAgent` calls `POST /api/chat` with the conversation history and parses the SSE stream (`data: {"delta":"…"}` lines, terminate on `{"done":true}` or `{"error":"…"}`). Use `ReadableStream.getReader()` + `TextDecoder`. Append deltas to the active assistant message.
>
> Layout matches §6.1 of the spec. Auto-scroll on new tokens. Streaming indicator (3 dots, `motion.pulse`). Slash commands: `/help`, `/clear`, `/resume` (opens Resume app via `useWindows`), `/projects`, `/voice` (opens Voice app), `/contact` (prints email from resume).
>
> Title-bar menu has: agent role toggle (Recruiter / Collaborator), model picker (defaults to `openai/gpt-oss-120b`, optional `llama-3.3-70b-versatile` and `mixtral-8x7b-32768`).
>
> Initial assistant message is greeting from §5.1.
>
> Wire into `src/components/apps/registry.tsx`: replace `terminal:` entry with `TerminalApp`.

### PR #3 — `feat/app-voice` — **Voice App**

**Dispatch brief:**

> Build `src/components/apps/voice/VoiceApp.tsx`. Shares state with Terminal via a shared hook: extract `useTerminalAgent` into `src/lib/agent/useAgent.ts` (move from PR #2 if needed — coordinate via PR comment, or duplicate the hook if PR #2 hasn't merged yet).
>
> UI: big circular mic button at center. While pressed (mouse or touch), `SpeechRecognition` runs with `continuous: true` and `interimResults: true`; live interim transcript in muted text. On release, send the final transcript through `useAgent.send()`. Stream the response in text below the mic, and pipe each completed sentence into `speechSynthesis.speak()`.
>
> Detect missing `webkitSpeechRecognition`: render a "Voice not supported — use Chrome/Edge desktop" message instead of crashing.
>
> Wire registry entry `voice: VoiceApp`.

### PR #4 — `feat/app-resume` — **Resume App**

**Dispatch brief:**

> Build `src/components/apps/resume/`:
> - `ResumeApp.tsx` (default export)
> - `ResumeHeader.tsx`, `ResumeTabs.tsx`, `SummaryTab.tsx`, `ExperienceTab.tsx`, `ProjectsTab.tsx` (Projects+Awards+Research combined)
> - `useResume.ts` (client hook — fetches `/resume.json`, validates with Zod, caches)
>
> Title-bar menu items: "View PDF" (toggles body to `<iframe src="/resume.pdf">`), "Download PDF" (`<a href="/resume.pdf" download>`).
>
> Tabs default to Summary. Print stylesheet: hides the tab bar, prints all sections sequentially.
>
> Wire registry entry `resume: ResumeApp`.

### PR #5 — `feat/app-projects` — **Projects App**

**Dispatch brief:**

> Build `src/components/apps/projects/ProjectsApp.tsx`. Reads `projects[]` from `useResume()` (extract from PR #4 to `src/lib/resume/useResume.ts` if needed). Renders a 2-column responsive card grid. Each card shows name, blurb, tech tags. Click a card → use `useWindows().open("about")` with a custom title to show a fullsize description (or render an in-grid expansion).
>
> Drop the fictional "Penetration Testing Tool" — only show `resume.json.projects` entries. (Three at time of writing: full-duplex-moshi-agent, compliance-agent, Aetherflow.)
>
> Wire `projects: ProjectsApp`.

### PR #6 — `feat/app-about` — **About App**

**Dispatch brief:**

> Build `src/components/apps/about/AboutApp.tsx`. Reads the summary string from `useResume()`. Layout: name + title (top), three-paragraph summary, then a "Tech I work with" pill grid sourced from `skills[]`. Drops the corny `cat /etc/issue` block from the old `AboutSection.tsx`.
>
> Wire `about: AboutApp`.

### PR #7 — `feat/app-social` — **Social App**

**Dispatch brief:**

> Build `src/components/apps/social/SocialApp.tsx`. Reads `personal.{linkedin,github,twitter,email,phone}` from `useResume()` — **no `yourusername` placeholders allowed**. Renders one icon-and-label row per channel; clicking opens `mailto:` / `tel:` / external link in new tab. Show a fallback message if a field is missing rather than rendering a broken link.
>
> Wire `social: SocialApp`.

### PR #8 — `feat/app-tetris` — **Tetris**

**Dispatch brief:**

> Build `src/components/apps/games/TetrisApp.tsx`. **Canvas-based** (HTMLCanvasElement), not flex grid. Board sizes to `min(window dimensions, 360×640)` and scales with the window. Game loop via `requestAnimationFrame`. Standard 7-bag, soft drop / hard drop / SRS rotation, scoring (Tetris guidelines minimum).
>
> Inputs:
> - Keyboard: ←→ move, ↑ rotate, ↓ soft drop, space hard drop, P pause.
> - Touch: tap = rotate, swipe ←→ = move, swipe ↓ = soft drop, swipe up = hard drop.
>
> Game-over modal is *inside* the window (absolute-positioned within the canvas wrapper, not fixed to viewport).
>
> Wire `tetris: TetrisApp`.

### PR #9 — `feat/app-doom` — **Doom**

**Dispatch brief:**

> Build `src/components/apps/games/DoomApp.tsx`. Wraps the existing dos.zone embed. Add a "Click here to focus the game" pill at center on first mount; the pill fades out after the iframe receives focus (focusin event) or after 5 seconds.
>
> On viewports below 768px wide, render instead: a static screenshot (placeholder: `public/images/doom-thumb.jpg` — add a placeholder image) and a "Open in new tab" link.
>
> Wire `doom: DoomApp`.

### PR #10 — `feat/app-mp3` — **MP3 Player**

**Dispatch brief:**

> Build `src/components/apps/media/Mp3App.tsx`. Layout: album art (placeholder) on top, playlist of one track (default: `/audio/<short-public-domain-clip>.mp3` — reuse what's already in `public/audio/` if anything is there; if empty, ship a 5-second silence file as a placeholder), transport at bottom.
>
> Seeker: `<input type="range">` with `touch-action: none`; supports both pointer and touch events. Show current time / duration. Volume slider. Loop toggle.
>
> Wire `mp3: Mp3App`.

### PR #11 — `feat/app-media` — **Media (was VLC)**

**Dispatch brief:**

> Build `src/components/apps/media/VlcApp.tsx` (kind stays `vlc` to avoid window-state migration). Rename to "Media Player" in `DEFAULT_TITLES`.
>
> Use a native `<video>` element. Drop the fake stream URL list. Ship ONE demo clip in `public/videos/demo.mp4` (15-30s, your screen recording of compliance-agent or any free clip).
>
> Controls: play/pause, scrub, volume, fullscreen (calls `requestFullscreen()` on the `<video>`, not the wrapper).
>
> Wire `vlc: VlcApp`. Update `DEFAULT_TITLES.vlc` to `"Media Player"`.

---

## Phase 5 — Polish + ship

### Task 5.1: Cross-app polish PR (`chore/polish`)

After all 10 app PRs merge, cut `chore/polish` and:

- [ ] Audit z-index across apps (only window chrome should ever exceed taskbar z = 9999; nothing in app content does).
- [ ] Run Lighthouse mobile audit on the Vercel preview. Capture before/after numbers. Target ≥ 90 Perf, ≥ 95 A11y, 100 Best Practices.
- [ ] Verify keyboard nav: tab cycles desktop icons → taskbar; Enter opens focused icon; ESC closes the focused window.
- [ ] Color-contrast check (every text-on-surface combination passes WCAG AA).
- [ ] Replace placeholder wallpaper with a real Kali purple-dragon image (sourced or generated).
- [ ] Replace placeholder MP3 / video demo files if needed.
- [ ] Update `docs/superpowers/screenshots/` with after-shots.
- [ ] Confirm acceptance criteria from spec §11 all satisfied.

### Task 5.2: Deploy

- [ ] Set Groq env vars in Vercel project.
- [ ] Push to `main`; verify the deployed preview.
- [ ] Record one-line update for the owner.

---

## Self-review checklist

**Spec coverage:**
- §1 boot screen killed → Task 2.7 (page.tsx), Task 2.8 (delete landing).
- §1 one AI brain → PR #2/#3 share `useAgent.ts`.
- §1 provider swap → Tasks 1.B + 3.1.
- §1 window manager rebuilt → Tasks 2.1–2.6.
- §1 visual refresh → Task 1.A.
- §1 resume rewritten → Task 1.C.
- §1 all in-desktop apps fixed → PR #2–#11.
- §3 every numbered bug → addressed in matching PR (drag bug → Task 2.3 react-rnd; Jarvis z-index → registry + WindowManager; maximise/taskbar overlap → reducer TASKBAR_H; TerminalWindow hardcoded role → PR #2; speech `continuous:false` → PR #3; DesktopIcons dynamic class names → Task 2.5 inline icon list; Tetris board sizing + game-over modal → PR #8; MP3 touch seeker → PR #10; cross-origin iframe issues → PR #9 documented; AgentSelector white card → deleted in Task 2.8).
- §4.1 folder layout → matches phase-by-phase output.
- §4.2 LLM client/proxy → Task 1.B.
- §4.3 WindowManager API → Tasks 2.1–2.3 (`open / close / focus / minimise / toggleMaximise / setBounds`).
- §4.4 theme tokens → Task 1.A.
- §4.5 motion vocabulary → Task 1.A `motion.ts`.
- §5 UX flows → Phase 2 + PR #2.
- §6 per-app designs → PR #2–#11 briefs.
- §7 data shapes → Task 1.C (resume), Task 2.1 (window).
- §8 build sequence → entire plan structure.
- §9 risks → mitigations baked into tasks (server-side proxy, configurable model, accessibility audit in 5.1).
- §10 decisions → already applied (purple, voice in v1, Doom kept, PDF embedded inline, Vercel default).
- §11 acceptance criteria → Task 3.2 + Task 5.1.

**Placeholders:** none. Every code step contains the full code or full command.

**Type consistency:** `AppKind`, `WindowState`, `Bounds`, `ChatMessage`, `Resume` are defined once and referenced uniformly. `useWindows().toggleMaximise` name matches across reducer + provider + Window primitive. `useAgent` / `useTerminalAgent` is the only naming ambiguity — flagged in PR #3 brief to align with PR #2's export.

---

*End of plan.*
