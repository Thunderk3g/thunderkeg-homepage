# Thunderkeg — Interactive Kali Desktop Portfolio

A Next.js portfolio rendered as a polished Kali Linux desktop. Open the Terminal app to chat with a Groq-powered AI agent that knows the resume; drag, resize, minimise, and maximise app windows; browse the Resume / Projects / About / Social apps; or fire up Doom, Tetris, or the media players.

## Tech stack

- **Framework:** Next.js 15 (App Router) + TypeScript
- **Styling:** Tailwind CSS (semantic tokens in `src/lib/theme/tokens.cjs`)
- **Motion:** Framer Motion
- **LLM:** Groq via the OpenAI-compatible endpoint (provider-agnostic by env var)
- **Windows:** `react-rnd` + a `useReducer`-backed `WindowManager` context
- **Validation:** Zod for the resume schema

## Setup

```bash
git clone https://github.com/Thunderk3g/thunderkeg-homepage.git
cd thunderkeg-homepage
npm install
cp .env.local.example .env.local
# Fill LLM_API_KEY with a Groq key from https://console.groq.com
npm run dev
```

Open http://localhost:3000.

## Env vars (`.env.local`)

| var | example | meaning |
|-----|---------|---------|
| `LLM_API_KEY` | `gsk_…` | Groq API key (server-side only) |
| `LLM_BASE_URL` | `https://api.groq.com/openai/v1/` | OpenAI-compatible chat endpoint |
| `LLM_MODEL` | `openai/gpt-oss-120b` | Default chat model |
| `LLM_REQUEST_TIMEOUT_S` | `60` | Per-request timeout |

The four-env-var contract is identical to the one in [compliance-agent-poc](https://github.com/Thunderk3g/compliance-agent-poc). To target a different provider, point `LLM_BASE_URL` at an OpenAI-compatible endpoint (OpenAI, Gemini OpenAI-compat, vLLM, local Ollama via OpenAI shim, etc.) and adjust `LLM_MODEL`. No code change needed.

## Architecture

```
src/
  app/
    page.tsx                       mounts <Desktop/>
    api/chat/route.ts              SSE Groq streaming proxy (server-only)
  components/
    desktop/                       WindowManager, Window, Taskbar, StartMenu, …
    apps/                          one folder per app — wired via registry.tsx
  lib/
    llm/                           OpenAI client targeting Groq + prompts
    resume/                        Zod schema + loader + keyword retriever
    theme/                         tokens + motion presets + icon wrapper
  types/window.ts                  AppKind, Bounds, WindowState
public/
  resume.json                      single source of truth — validated by Zod
  resume.pdf                       linkable download
  wallpapers/                      desktop backgrounds
```

## Deployment

Deploys cleanly to Vercel. Set the four `LLM_*` env vars in the Vercel project settings, point a domain at it (or use the free `*.vercel.app`), and push to `main`.

## License

MIT
