# Diwakar Adhikari: portfolio

A portfolio you boot. It opens as a Kali Linux desktop (the Xfce panel, real
windows, a terminal) running in the browser, and everything on it is either
my work or a tool I use to study.

Live: https://portfolio-flame-five.vercel.app

If you only want the facts, skip the desktop: [`/resume`](https://portfolio-flame-five.vercel.app/resume),
[`/resume.pdf`](https://portfolio-flame-five.vercel.app/resume.pdf),
[`/writing`](https://portfolio-flame-five.vercel.app/writing) and
[`/hire`](https://portfolio-flame-five.vercel.app/hire) are plain pages.
[`/steer`](https://portfolio-flame-five.vercel.app/steer) is the steerable canvas on its own.

## What is on the desktop

| App | What it is |
| --- | --- |
| Work with me | What I take on, and a brief form that reaches my inbox |
| Terminal | A shell over an in-memory file system, with commands for the résumé, research and the apps |
| Firefox | Real tabs over the site's own pages: Résumé, Writing, Stacks |
| Research | A paper desk: weekly brief, search, a reading queue with three passes, notes, recall cards |
| Stacks | The record of what I have learnt: each thing built, measured, studied or written, by subject and by year |
| Steerable Canvas | Steer a model while it writes: a focus monitor, attention locks, six dials and a knob that scrubs through continuations. Simulated unless a model key is set |
| Writing | Posts, paper notes and a composer |
| Dolphin | File manager over the same file system as the terminal |
| Linux VM | A real Linux kernel in an x86 emulator (v86, WebAssembly) |
| psql | Real PostgreSQL (PGlite, WebAssembly) over my research library |
| AI Assistant | Answers questions about my work; offline unless a model key is set |
| Music, Settings, a code editor | What they say |

Three things are worth trying:

- **Stacks.** The wallpaper is the record itself: a board of cubes, one per
  thing I built, measured, studied or wrote. A field is a lane, a subject is
  a stack. The year strip under it replays the record as it grew.
- **Teardown** (`Ctrl+Alt+X`, or the layers button in the panel). The running
  desktop is tilted and pulled apart into its layers, and continues under the
  wallpaper into the display, the session, the file system, the kernel and
  the hardware. Point at a layer to leaf the stack open; click one to give it
  a screen of its own, where it comes apart in its own way. Keys `1`, `2`, `3`
  read the same stack as Kali Linux, as this site, or as an LLM system.

- **Steerable Canvas** (`steer` in the terminal, or [`/steer`](https://portfolio-flame-five.vercel.app/steer)).
  Text is written while you turn dials for tone, pace, tension, surprise,
  focus and mode. Select a phrase to pin it, drag the bar at the bottom to
  scrub back and forward through what was written, and turn a dial at the new
  point to take the text somewhere else from there. The footer says what is
  writing: with no model key it is a simulation, and it says so. How it works,
  and the Python backend for a local model with real activation steering, are
  in [`steering/README.md`](steering/README.md).

Useful keys: `Ctrl+K` command palette, `Super` applications menu,
`Ctrl+Alt+T` terminal, `Super+Left/Right` tile a window, `Ctrl+Alt+Left/Right`
change workspace.

## Run it

Node 18.18 or newer (it is built and tested on 22).

```bash
npm install
```

```bash
npm run dev
```

The dev server is on http://localhost:3017. `npm install` also copies the
emulator's WebAssembly files into `public/vm`.

For a production build:

```bash
npm run build
```

```bash
npm start
```

## Configuration

Everything works with no configuration; each key below switches one feature
from its offline fallback to the real thing. Copy `.env.local.example` to
`.env.local` and fill in what you want.

| Variable | What it turns on | Without it |
| --- | --- | --- |
| `LLM_API_KEY` (and optional `LLM_BASE_URL`, `LLM_MODEL`, `LLM_FALLBACK_MODELS`) | The assistant, the research summaries and the steerable canvas, through any OpenAI-compatible endpoint | The assistant says it is offline; the canvas runs simulated |
| `STEER_MODEL`, `STEER_SPECULATE`, `STEER_REVEAL_TOK_S`, `STEER_RATE_PER_ADDRESS` (all optional) | A faster model for the canvas only; speculative generation; how many words a second go on screen (`0` shows text as it arrives); its own rate limit | The site's model chain, no speculation, 40 words a second, 150 requests per address in five minutes |
| `NEXT_PUBLIC_STEER_WS_URL` | The canvas connects to the Python backend in `steering/` (a local model, a proxy focus monitor) | The engine runs in the page |
| `S2_API_KEY` | Semantic Scholar lookups in Research without the shared rate limit | The panel links out when it is limited |
| `SMTP_USER`, `SMTP_PASS` (and optional `SMTP_HOST`, `SMTP_PORT`, `HIRE_TO`, `HIRE_FROM`) | The brief form sends mail | The form opens the visitor's own mail app |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | The "who is online" indicator in the panel | It shows as offline |
| `NEXT_PUBLIC_SITE_URL` | The address used in feeds, the sitemap and the PDFs, when a custom domain is attached | The Vercel production address is used |

Server-side keys must never be given a `NEXT_PUBLIC_` prefix.

## Where things are

```
app/                 routes: the desktop (/), the plain pages, the PDFs, the API
content/             posts and paper notes, one Markdown file each
docs/                research notes behind the design decisions
scripts/             tests, and the script that copies the emulator files
src/data/resume.ts   the one source for every résumé surface
src/data/record.ts   the curated part of the Stacks record
src/os/              the desktop: panel, windows, apps, terminal, Teardown
src/stacks/          the Stacks board model and its page
src/research/        the Research store
src/steer/           the steerable canvas: the component, its engine, the protocol
steering/            the canvas's Python backend, and the YAML that defines its dials
src/content/         the plain pages' shared pieces and the PDF builder
```

Three things are worth knowing before changing anything:

- **The résumé has one source.** `src/data/resume.ts` feeds the page, both
  PDFs, the terminal, the file system and the assistant. Its header states
  which kinds of figure may be published; read it before adding a number.
- **Publishing is a file.** A Markdown file in `content/` with front matter
  becomes a post or a paper note, and a `stack:` line puts it on the Stacks
  board.
- **The PDFs are built at build time** from the same data
  (`/resume.pdf`, two pages; `/cv.pdf`, the academic arrangement).
- **The canvas's dials are a file.** `steering/dimensions.yaml` defines every
  dial for both the web app and the Python backend. The engine exists twice
  (`src/steer/engine.ts` in the page, `steering/steerable/engine.py` behind a
  WebSocket) and the two are held to the same rules by their tests.

## Tests

There is no test runner; each test is a script.

```bash
for f in scripts/*.test.mts; do npx tsx "$f" || break; done
```

| Script | What it holds to |
| --- | --- |
| `resume-pdf.test.mts` | The résumé PDF is exactly two pages and reads correctly |
| `stacks-model.test.mts` | How entries, posts and papers become the board |
| `teardown-camera.test.mts` | The 3D arithmetic: projection, fitting, leaders that never cross |
| `teardown-breakdowns.test.mts` | Each layer's own move, and that a layer is never faded while its pieces are out |
| `teardown-anatomy.test.mts` | Every layer has all three readings, and every link in them exists |
| `teardown-css.test.mts` | The stylesheet rules that keep Teardown fast |
| `research-pdf-proxy.test.mts` | The PDF proxy only fetches what it should |
| `chat-guard.test.mts` | The endpoints that spend the model key answer only this site, at a visitor's pace |
| `steer.test.mts` | The canvas's engine: cache, cancellation, scrubbing, speculation, and that it agrees with the Python backend on layout and scoring |

The Python backend has its own suite; see [`steering/README.md`](steering/README.md).

## Notes behind the design

- [`docs/kali-desktop-research.md`](docs/kali-desktop-research.md): what a
  real Kali desktop looks like, checked against Kali's own packaging.
- [`docs/teardown-research.md`](docs/teardown-research.md): prior art for
  exploded views, what CSS 3D does and does not do, and the traces behind
  each performance fix.

## Deploying

The site is deployed by Vercel from `main`. Set the variables above in the
project's environment settings; nothing else is needed.
