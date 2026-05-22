# Thunderkeg Homepage — Kali Desktop Redesign Spec

**Date:** 2026-05-22
**Owner:** Diwakar Adhikari (Technical Lead — AI Engineering, Bajaj Life Insurance)
**Status:** Draft for review

---

## 1. Executive summary

Rework the existing Next.js / Kali-Linux-themed portfolio (`thunderkeg-homepage`) into a polished, bug-free, Groq-powered showcase aligned with the owner's new AI Tech Lead positioning. The Kali desktop metaphor stays — windows, taskbar, apps, wallpaper — but every layer underneath gets rewritten:

- **Boot screen killed.** Page load goes straight to the desktop with the AI Terminal pre-opened.
- **One AI brain.** "Jarvis" and the AI Terminal become the same agent under different surfaces (text terminal + optional voice). One Groq client, one prompt system, one resume context.
- **Provider swap.** Ollama → Groq via OpenAI-compatible endpoint, mirroring the four-env-var pattern from `compliance-agent-poc/backend/app/services/llm_service.py`.
- **Window manager rebuilt.** Drag, focus, z-index, resize, and mobile/touch all work correctly.
- **Visual refresh.** Tokenised theme (recommend Kali Default + Tokyo-Night-Storm dark accents), real wallpaper, JetBrains Mono + Inter typography, smooth motion.
- **Resume rewritten** to the new AI/ML Tech Lead bio.
- **All in-desktop apps fixed:** Terminal, Resume Viewer, Voice Assistant (formerly Jarvis), Doom, Tetris, MP3, VLC, About, Projects, Social Links.

Delivered as a **foundation PR followed by parallel per-app PRs** dispatched to sub-agents.

---

## 2. Goals & non-goals

### Goals
1. Visitor lands on a working desktop in <1.5s with no boot animation gate.
2. Every window can be dragged, focused, resized, minimised, maximised, and closed without bugs on desktop + mobile.
3. Conversational resume runs on Groq (`openai/gpt-oss-120b` default) with streamed responses.
4. New resume content reflects current role (Technical Lead — AI Engineering at Bajaj Life Insurance) and projects (compliance-agent, full-duplex-moshi-agent, Aetherflow).
5. Visual quality reads as "senior AI engineer's polished portfolio" — not "AI-generated demo."
6. Every desktop app works or is removed. No half-broken UIs.
7. Code is reorganised so each app is independently buildable/testable by a sub-agent.

### Non-goals
- Server-side auth, persistence, or analytics (it's a personal portfolio).
- Mobile parity for *every* app — games and media players target tablet+; touch drag of windows works on phones but heavy apps degrade gracefully.
- Real-time voice (Moshi-style full-duplex) — the Voice Assistant uses browser SpeechRecognition + Groq text completion + browser TTS. A future PR can swap in `full-duplex-moshi-agent`.
- Multi-user / shared sessions.
- Internationalisation.

---

## 3. Current state — what's broken

Catalogued from a full source audit (see `docs/superpowers/screenshots/_console-errors.txt` for runtime errors). Top issues:

### 3.1 Window manager (`src/components/desktop/LinuxDesktop.tsx` — 1232 lines, single file)
- **L663-668, L679-709:** Drag uses both `dragOffset` state and a `dragRef` mutable ref, and `handleDragMove` closes over a stale `isDragging` value. Dragging is jumpy and sometimes stops mid-motion. **This is the "can't move around the screen properly" the owner reported.**
- **L1204:** Jarvis window hard-codes its own z-index outside the windows array — it floats on top permanently and steals focus.
- **L854:** Maximise targets `y: 30` but the taskbar is `h-10` (40px), so maximised windows overlap the taskbar.
- **L625:** Maximise/restore toggle uses a fragile aspect-ratio heuristic.
- **L702-705:** Windows clamp at left/top edges only — title bars can slide off right/bottom and become unreachable.
- No touch events anywhere; window dragging is mouse-only.

### 3.2 LLM integration (`src/lib/ollama/*`, `src/app/api/{chat,ollama}/*`)
- Hardcoded `http://localhost:11434` Ollama calls. On any deployed URL or visitor without local Ollama, the AI fails silently. Console proves it: four CORS-blocked Ollama probes every page load.
- "Ollama Bridge" Chrome extension as the production story is a non-starter — recruiters won't install a browser extension.
- Model selector lists Ollama tags; user has to know `llama3:latest`.

### 3.3 Boot / landing flow (`src/components/landing/LandingAnimation.tsx`, `src/app/page.tsx`)
- Two-stage animation (`Terminal` hero → `FeatureSection`) gates the desktop behind ~2 button clicks.
- `LinuxDesktop` mounts in parallel and tries to auto-open a terminal *while* the landing is still visible — race condition.
- After dismissal, the user is dumped into a `TerminalAgentSelector` ("Recruiter vs Collaborator") that has poor visual contrast and breaks the desktop metaphor.

### 3.4 Per-app bugs (excerpts from full catalog)
- **TerminalWindow.tsx L9:** Hardcoded `agentType='recruiter'` — agent never switches to collaborator regardless of selection.
- **JarvisAssistant.tsx L81:** Speech recognition `continuous: false` — only first utterance captured.
- **DesktopIcons.tsx L166:** Tailwind dynamic class names (`col-start-${n}`) don't generate at runtime — icons end up in default grid order.
- **Doom.tsx, VLCPlayer.tsx:** Cross-origin iframes can't be focused or reloaded programmatically; existing controls silently fail.
- **Tetris.tsx L256-265:** Board is 50px wide on big screens, unplayable. Game-over modal covers entire desktop, not just window.
- **MP3Player.tsx L256:** Seeker only handles mouse events, broken on touch.
- **JSONResumeViewer.tsx:** Hidden DOM pages cause confused zoom + page state.
- **AgentSelector.tsx:** White card on dark desktop — visually jarring.

### 3.5 Data
- `resume.json` is the 2022 Senior SWE bio. New resume is AI Tech Lead with completely different work history, skills, and projects. Full rewrite needed (schema below).

---

## 4. Architecture

### 4.1 Folder layout (target)

```
src/
  app/
    layout.tsx                       (unchanged)
    page.tsx                         (gut to ~30 lines — just renders <Desktop/>)
    api/
      chat/route.ts                  (Groq streaming proxy)
      resume/route.ts                (serves resume.json)
  components/
    desktop/
      Desktop.tsx                    (was LinuxDesktop, now ~150 lines)
      WindowManager.tsx              (NEW — pure-state hook + provider)
      Window.tsx                     (NEW — single window primitive w/ react-rnd)
      Taskbar.tsx                    (rewritten)
      StartMenu.tsx                  (NEW — extracted from LinuxDesktop)
      DesktopIcons.tsx               (rewritten, inline-style grid positions)
      ContextMenu.tsx                (NEW — wallpaper + future entries)
    apps/
      terminal/
        TerminalApp.tsx              (main shell, hosts chat + AI)
        TerminalPrompt.tsx
        TerminalHistory.tsx
        useTerminalAgent.ts          (Groq streaming hook)
      voice/
        VoiceApp.tsx                 (was Jarvis — shares useTerminalAgent)
      resume/
        ResumeApp.tsx                (was JSONResumeViewer, redesigned)
        ResumeSection.tsx
      projects/
        ProjectsApp.tsx              (rewritten — compliance-agent, Moshi, Aetherflow)
      about/
        AboutApp.tsx
      social/
        SocialApp.tsx
      games/
        DoomApp.tsx                  (or removed if iframe issues unresolvable)
        TetrisApp.tsx                (rewritten with responsive board + touch)
      media/
        Mp3App.tsx                   (rewritten with touch seeker)
        VlcApp.tsx                   (rewritten — see §6.8)
  lib/
    llm/
      client.ts                      (NEW — single OpenAI-compatible client)
      prompts.ts                     (system prompts, resume context builder)
      types.ts
    resume/
      schema.ts                      (NEW — Zod schema)
      loader.ts                      (loads /resume.json, validates)
      retriever.ts                   (simple keyword RAG, unchanged in spirit)
    theme/
      tokens.ts                      (NEW — color/spacing/typography tokens)
      icons.tsx                      (NEW — wraps lucide-react w/ size defaults)
  types/
    window.ts                        (Window, AppKind, WindowState)
    chat.ts                          (Message, Role, ChatStreamChunk)
public/
  resume.json                        (regenerated)
  resume.pdf                         (the PDF the owner provided — downloadable)
  wallpapers/
    kali-default.jpg
    kali-purple-dragon.jpg
    tokyo-night.jpg
  icons/                             (custom SVG icon set)
docs/
  superpowers/
    specs/2026-05-22-thunderkeg-redesign-design.md     (this file)
    screenshots/                                       (Playwright captures)
    capture_screens.py
```

The old `src/components/landing/`, `src/components/ui/Linux*`, `src/lib/ollama/`, and `src/app/api/ollama/` directories get deleted in PR #1.

### 4.2 LLM provider — Groq via OpenAI-compatible endpoint

Mirror `compliance-agent-poc/backend/app/services/llm_service.py` exactly:

**Env vars (same names as the reference repo so config is portable):**

```bash
LLM_API_KEY=...                              # Groq API key
LLM_BASE_URL=https://api.groq.com/openai/v1/
LLM_MODEL=openai/gpt-oss-120b                # default chat model
LLM_REQUEST_TIMEOUT_S=60
```

**Client (`src/lib/llm/client.ts`):**

```ts
import OpenAI from "openai";

export const llm = new OpenAI({
  apiKey: process.env.LLM_API_KEY,
  baseURL: process.env.LLM_BASE_URL ?? "https://api.groq.com/openai/v1/",
  timeout: Number(process.env.LLM_REQUEST_TIMEOUT_S ?? 60) * 1000,
});

export const DEFAULT_MODEL = process.env.LLM_MODEL ?? "openai/gpt-oss-120b";
```

**Streaming proxy (`src/app/api/chat/route.ts`):** accepts `{ messages, model? }`, server-side calls `llm.chat.completions.create({ ..., stream: true })`, returns an SSE/edge response. Server-side only — the browser never sees `LLM_API_KEY`.

**Client hook (`useTerminalAgent`):** holds messages state, calls `/api/chat`, parses SSE chunks, appends to the active message. Both `TerminalApp` and `VoiceApp` consume the same hook — one brain, two surfaces.

### 4.3 Window manager rewrite

Replace the hand-rolled drag/resize logic with **`react-rnd`** (already widely used, ~7kb, full touch support, declarative).

**`WindowManager.tsx`** exposes a context provider with:

```ts
interface WindowManagerApi {
  windows: Record<string, WindowState>;
  open(kind: AppKind, opts?: { focus?: boolean }): string;
  close(id: string): void;
  focus(id: string): void;
  minimise(id: string): void;
  toggleMaximise(id: string): void;
  setBounds(id: string, bounds: Bounds): void;
}
```

State lives in a single `useReducer` so all transitions are atomic. Z-index = a single monotonic counter (no more competing local indices). Focus = whichever window has the highest z. Minimised windows are kept in state but not rendered.

**`Window.tsx`** wraps `<Rnd>` and renders the chrome (title bar, three dots, resize handles come for free). Each app gets `<Window id=... kind="terminal">{children}</Window>`.

Bounds are clamped to viewport on every drag/resize: title-bar always at least 32px visible from each edge so a window can't be lost.

### 4.4 Theme system

`src/lib/theme/tokens.ts` exports a flat token object consumed by Tailwind via the config:

```ts
export const tokens = {
  color: {
    bg:        "#0b0d12",   // base desktop
    surface:   "#13161f",   // window background
    elevated:  "#1a1e2b",   // title bar / taskbar
    border:    "#2a3144",
    text:      "#e6e9f2",
    muted:     "#8a93a8",
    accent:    "#7c5cff",   // Kali purple, modernised
    accent2:   "#22d3ee",   // cyan secondary
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
};
```

`tailwind.config.js` reads from `tokens` so changing a token is one place. Wallpapers ship as `public/wallpapers/*.jpg` — kali-default, kali-purple-dragon, tokyo-night.

### 4.5 Motion language

Framer Motion is already a dep. Standardise on three named transitions:

- **`snap`** (`0.15s ease-out`) — window focus, button presses.
- **`glide`** (`0.25s [0.2,0.8,0.2,1]`) — window open/close, taskbar reveal.
- **`pulse`** (`1.2s ease-in-out infinite alternate`) — typing dots, voice indicator.

Document in `src/lib/theme/motion.ts`.

---

## 5. UX flows

### 5.1 First load
1. Browser hits `/`.
2. `<Desktop>` mounts, wallpaper loads, taskbar appears, desktop icons fade in.
3. Terminal app auto-opens centered, focused, with a streamed greeting from the Groq agent:
   > `Hi — I'm Diwakar's portfolio agent. Ask me about my work on compliance-agent, Moshi, or Aetherflow, or type 'help'.`
4. No clicks required. Total time to interactive: target <1.5s on Vercel cold.

### 5.2 Talking to the agent
- Plain text input — no Vim mode by default (toggle via `:vim` slash command for nostalgia).
- Slash commands: `/help`, `/clear`, `/resume`, `/projects`, `/voice`, `/contact`.
- `/voice` opens the Voice App which shares the same agent state — the conversation continues.
- Streaming tokens render at ~60fps with a blinking cursor at the cursor position.

### 5.3 Window interactions
- Drag from title bar → window follows pointer (mouse OR touch).
- Click any visible part of an inactive window → focus + raise.
- Close (red dot) / minimise (yellow) / maximise (green) — standard Kali behavior.
- Taskbar shows every open window; click to focus, click again to minimise.
- Right-click desktop → context menu (Change Wallpaper, About).

### 5.4 Mobile
- Below 768px, windows snap to fullscreen by default. Title bar still has the close dot.
- Taskbar collapses to a single "apps" button that opens a launcher sheet.
- Games and VLC show a "best viewed on desktop" overlay if the viewport is too small.

---

## 6. App-by-app design

### 6.1 Terminal App (the AI agent)

The hero feature. New layout:

```
┌──────────────────────────────────────────────────────┐
│ ● ● ●     diwakar@kali ~ — terminal           ───┐  │
├──────────────────────────────────────────────────────┤
│                                                      │
│  $ Hi — I'm Diwakar's portfolio agent...             │
│                                                      │
│  > Tell me about compliance-agent                    │
│                                                      │
│  ● ● ●  (streaming)                                  │
│  compliance-agent is an enterprise AI platform...    │
│                                                      │
├──────────────────────────────────────────────────────┤
│ [ ▸ ] Ask me anything                          ⏎     │
└──────────────────────────────────────────────────────┘
```

- Prompt context = system prompt + serialised relevant resume chunks (keyword RAG, unchanged).
- Model picker in the title-bar menu (defaults to `openai/gpt-oss-120b`; lists Groq's text models when API key is present).
- "Recruiter vs Collaborator" agent roles **stay** but become a single dropdown inside the terminal, not a separate fullscreen selector screen.

### 6.2 Voice App (was Jarvis)

Same agent backend as Terminal — `useTerminalAgent` shared. Differences:
- Big circular mic button. Press to talk; release to send.
- `continuous: true` SpeechRecognition with interim transcript shown live.
- Browser TTS reads the streamed response, sentence by sentence, with the visible text following the synth cursor.
- Falls back to a "Voice not supported" message on Firefox if WebSpeech isn't available.

### 6.3 Resume App

- Header: photo (if added later), name, role, email, phone, location, social links.
- Three tabs: **Summary**, **Experience**, **Projects & Recognition**.
- Each section renders from `resume.json` — no PDF embed in the default view (the resume PDF link sits in the title-bar menu as "Download PDF").
- Print stylesheet so File → Print produces something legible.

### 6.4 Projects App

Card grid showcasing:
- **compliance-agent** — short blurb + tech tags (LangChain, LangGraph, Groq, pgvector, FastAPI).
- **full-duplex-moshi-agent** — full-duplex voice LLM fork.
- **Aetherflow** — AI orchestration.
- **(secondary)** SustainAi paper, COMPEX scholarship.

Each card opens a `<Window>` with a longer description and links. No fake projects (the current "Penetration Testing Tool" is fictional and must go).

### 6.5 About App

Short narrative version of the summary section of the resume, plus a "Tech I work with" grid (Python/LangChain/PyTorch/Next.js/Docker/Redis/Kafka). Drops the corny `cat /etc/issue` block.

### 6.6 Social App

GitHub, LinkedIn, Email, optionally X/Twitter. The current `yourusername` placeholders **must be replaced** — `resume.json` is the single source of truth for these handles.

### 6.7 Games — Doom & Tetris

- **Doom (DOSPlayer):** keep the dos.zone iframe but add a visible "click here to focus the game" hint that fades after first click. Drop the broken refresh button. Accept that fullscreen and key-rebinds won't work cross-origin — document it in-app.
- **Tetris:** rewrite to render on `<canvas>` (not flex grid) at viewport-relative scale. Add touch controls — tap to rotate, swipe left/right to move, swipe down to drop. Game-over modal is scoped to the window, not the desktop.

### 6.8 Media — MP3 & VLC

- **MP3:** single page; album art on top, playlist below, transport at bottom. Touch-friendly seeker (use `<input type="range">` with `touch-action: none`). Ship a single short demo MP3 (or reuse an open-licensed track) in `public/`.
- **VLC:** rename to "Media Player". Local `<video>` element with a curated demo clip (could be a screen recording of compliance-agent or Aetherflow). Drop the fake stream URLs. Fullscreen calls `requestFullscreen` on the video element, not the wrapper div.

---

## 7. Data shapes

### 7.1 `resume.json` — new schema (Zod-validated)

```ts
import { z } from "zod";

export const Resume = z.object({
  personal: z.object({
    full_name: z.string(),
    title: z.string(),                        // "Technical Lead — AI Engineering"
    email: z.string().email(),
    phone: z.string(),
    location: z.string(),
    linkedin: z.string().url().optional(),
    github: z.string().url().optional(),
  }),
  summary: z.string(),                        // The three-paragraph AI/ML bio
  experience: z.array(z.object({
    title: z.string(),
    company: z.string(),
    location: z.string(),
    start_date: z.string(),
    end_date: z.string(),
    bullets: z.array(z.string()),
  })),
  skills: z.array(z.string()),
  education: z.array(z.object({
    degree: z.string(),
    major: z.string().optional(),
    institution: z.string(),
    cgpa: z.string().optional(),
    start_date: z.string(),
    end_date: z.string(),
  })),
  projects: z.array(z.object({
    name: z.string(),
    blurb: z.string(),
    tech: z.array(z.string()).optional(),
    link: z.string().url().optional(),
  })),
  awards: z.array(z.string()),
  research: z.array(z.object({
    title: z.string(),
    venue: z.string().optional(),
  })),
});
```

The new content (verbatim from the PDF the owner shared, mapped into this schema) gets generated in PR #1.

### 7.2 Window state

```ts
type AppKind =
  | "terminal" | "voice" | "resume" | "projects"
  | "about" | "social" | "doom" | "tetris" | "mp3" | "vlc";

interface WindowState {
  id: string;
  kind: AppKind;
  title: string;
  bounds: { x: number; y: number; width: number; height: number };
  zIndex: number;
  minimised: boolean;
  maximised: boolean;
  prevBounds?: WindowState["bounds"];     // for restore-from-maximise
}
```

---

## 8. Build sequence — branches & PRs

Branch off `main`. Every commit is signed/conventional.

### PR #1 — `feat/foundation` (single PR, ~1 day, sequential)
The owner reviews & merges this first; everything else builds on it.
1. Delete `src/components/landing/**`, `src/lib/ollama/**`, `src/app/api/ollama/**`, `OLLAMA_BRIDGE.md`.
2. Add `openai` npm dep.
3. Build `src/lib/llm/{client,prompts,types}.ts` and `src/app/api/chat/route.ts` (Groq streaming proxy).
4. Build `src/lib/theme/{tokens,motion,icons}.ts` and rewire `tailwind.config.js`.
5. Build `src/components/desktop/{Desktop,WindowManager,Window,Taskbar,StartMenu,DesktopIcons,ContextMenu}.tsx` (no app contents yet — app slots accept a placeholder).
6. Rewrite `src/app/page.tsx` to ~30 lines mounting `<Desktop/>`.
7. Replace `public/resume.json` with the new schema + new content.
8. Add `public/resume.pdf` (the file the owner shared).
9. Add `.env.local.example` with `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`, `LLM_REQUEST_TIMEOUT_S`.
10. Smoke test: dev server starts; desktop renders; empty windows can be opened/closed/dragged/maximised; chat API streams.
11. Update README to remove Ollama-bridge content and document Groq env vars.

### PR #2 onwards — parallel per-app branches
Each branch off `feat/foundation`. Each is one sub-agent's responsibility:

| PR | Branch | App | Sub-agent brief |
|----|--------|-----|-----------------|
| #2 | `feat/app-terminal` | Terminal | Build `apps/terminal/*`, `useTerminalAgent`, slash commands, model picker. |
| #3 | `feat/app-voice` | Voice | Build `apps/voice/*` sharing `useTerminalAgent`. WebSpeech in, browser TTS out. |
| #4 | `feat/app-resume` | Resume | Build `apps/resume/*`. Three tabs, print CSS, PDF download. |
| #5 | `feat/app-projects` | Projects | Card grid from `resume.json.projects`. |
| #6 | `feat/app-about` | About | Short bio + tech grid. |
| #7 | `feat/app-social` | Social | Real links from `resume.json.personal`. |
| #8 | `feat/app-tetris` | Tetris | Canvas-based, touch controls, scoped game-over modal. |
| #9 | `feat/app-doom` | Doom | DOS iframe with the focus-hint UX; or drop it if it can't be made decent. |
| #10 | `feat/app-mp3` | MP3 | Touch seeker, single demo track. |
| #11 | `feat/app-media` | VLC/Media | Rename, real `<video>` element, demo clip. |

Each PR is small (~150-400 LOC) and reviewable in isolation. Sub-agents are dispatched once `feat/foundation` is merged.

### PR #12 — `chore/polish`
After all app PRs merge: cross-app review, fix any z-index/style inconsistencies, accessibility audit (focus rings, keyboard nav, color contrast), Lighthouse pass, deploy preview verification on Vercel.

---

## 9. Risks & mitigations

| Risk | Mitigation |
|------|-----------|
| Groq API key leak via client bundle | Streaming proxy lives in `app/api/chat/route.ts` — server-side only. Never ship `LLM_API_KEY` to the client. |
| `openai/gpt-oss-120b` rate limits on Groq free tier | Make model configurable via `LLM_MODEL` env var; document fallback to `llama-3.3-70b-versatile` in README. |
| Cross-origin iframe games break on mobile | Doom degrades to a static screenshot + "open dos.zone" link on small viewports. Tetris is native canvas so it's unaffected. |
| Sub-agents diverge on visual style | All apps must consume `src/lib/theme/tokens.ts`. No raw hex colors in app code. Code review enforces. |
| The new "single brain" prompt regresses recruiter UX | Keep the role-switch dropdown in-terminal so a visitor can still pick "Recruiter" framing — the system prompt branches on role. |
| Boot-screen loyalists (unlikely) | Document a `?boot=1` URL flag in PR #1 that re-enables a 1.5s splash, off by default. |

---

## 10. Decisions (resolved 2026-05-22)

1. **Visual theme.** Kali purple — `#7c5cff` accent on `#0b0d12` bg. Tokens in §4.4 already reflect this.
2. **Voice app — ships in v1.** Browser SpeechRecognition + browser TTS, gated behind a Chrome-only banner on Firefox/Safari. Shares the `useTerminalAgent` Groq hook with the Terminal.
3. **Doom — kept.** Cross-origin iframe with a clear "click here to focus the game" hint on first load; the hint fades after the iframe has received focus once. Doom degrades to a static screenshot + "open in new tab" link on viewports <768px.
4. **Resume PDF — embedded inline.** The Resume app opens with the structured `resume.json` tabs visible by default; a "View PDF" toggle in the title-bar menu swaps the body to an embedded `<iframe src="/resume.pdf">` (or `<embed>`) viewer. A "Download PDF" link is always present.
5. **Custom domain.** Defaulting to fresh Vercel deploy (no custom domain configured yet). README will document the deploy steps. (Owner: flag if a domain already exists and we'll wire CNAME instructions in.)

---

## 11. Acceptance criteria (definition of done for the redesign as a whole)

- [ ] `npm run dev` boots cleanly with **no console errors or warnings** on first paint.
- [ ] Visiting `/` shows the desktop with the Terminal pre-opened and streaming a greeting from Groq.
- [ ] Every window in the system can be dragged smoothly with both mouse and touch on a 1440×900 viewport and a 390×844 viewport.
- [ ] Closing every window leaves a clean desktop. Opening every window via Start Menu, double-click, and taskbar restores them correctly.
- [ ] `resume.json` validates against the new Zod schema. The Resume app, Projects app, Social app, and About app all source from it.
- [ ] No code in `src/` imports from `src/lib/ollama/**`. `npm run build` produces no Ollama references.
- [ ] `npm run build` succeeds. `npm run lint` produces no errors.
- [ ] A Lighthouse mobile audit on the deployed preview scores ≥ 90 for Performance, ≥ 95 for Accessibility, ≥ 100 for Best Practices.
- [ ] The previous PRs are squash-merged with conventional commit titles. `main` always passes `npm run build`.

---

## Appendix A — Visual mockup (ASCII)

```
┌────────────────────────────────────────────────────────────────────────┐
│                       (kali purple-dragon wallpaper)                   │
│                                                                        │
│  🟦 Terminal                                                           │
│  📄 Resume          ┌── ● ● ●    diwakar@kali  ~/portfolio ──── ─ □ × ┐│
│  📦 Projects        │                                                 ││
│  ℹ️  About           │  $ whoami                                       ││
│  🔗 Social          │  > Diwakar — AI Tech Lead, Bajaj Life Insurance ││
│  🎮 Doom            │                                                 ││
│  🎵 MP3             │  $ ls projects/                                 ││
│  🎬 Media           │  > compliance-agent  moshi-agent  aetherflow    ││
│                     │                                                 ││
│                     │  $ ▍                                            ││
│                     │                                                 ││
│                     ├─────────────────────────────────────────────────┤│
│                     │ [ ▸ ] Ask me anything                       ⏎  ││
│                     └─────────────────────────────────────────────────┘│
│                                                                        │
│                                                                        │
├────────────────────────────────────────────────────────────────────────┤
│ ⏻  ▸ Terminal · 🟢 Resume · 📦 Projects                       🔊 ⓘ 21:43│
└────────────────────────────────────────────────────────────────────────┘
```

---

*End of spec.*
