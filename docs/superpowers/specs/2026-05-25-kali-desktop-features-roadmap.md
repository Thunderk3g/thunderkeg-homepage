# Kali Desktop Feature Roadmap

**Date:** 2026-05-25
**Owner:** Diwakar Adhikari
**Status:** Approved (in-conversation), implementation underway

A themed-sprint roadmap building 14 features across three PRs over ~2-3 weeks.

---

## PR α — "Desktop OS feel"
*Goal: the desktop stops feeling like a portfolio with apps glued on and starts feeling like a real OS.*

1. **Cmd+K command palette** — global fuzzy search over apps, files, slash commands, resume sections. Bound to Cmd/Ctrl+K. Powers "open about", "search 'compliance'", "switch theme", "/voice". Library: [cmdk](https://github.com/pacocoursey/cmdk).
2. **File Manager (Nautilus-lite)** — visual browser over the same fake `~/` filesystem the Terminal shell already uses (`src/components/apps/terminal/shell.ts`). Double-click opens in the linked app. Sidebar with Home / Projects / Media / Games.
3. **Theme switcher** — right-click desktop → Themes → Kali Purple (default), Tokyo Night, Dracula, Solarized Dark. Live-swaps CSS tokens via a CSS-variable layer. Persists to localStorage.
4. **Code Editor** — CodeMirror app. Opens `.json` / `.md` / `.ts` files from the fake FS. Read-only by default. Ships `resume.json` + project READMEs as openable files. Library: `@uiw/react-codemirror` (~300kB; Monaco is ~3MB).
5. **Notification toasts** — bottom-right transient stack. Used by the shell on long-running ops, by Cmd+K on actions ("Theme set to Tokyo Night"), by apps for non-blocking errors. Library: [sonner](https://github.com/emilkowalski/sonner).

## PR β — "Hacker arsenal"
*Goal: own the Kali identity. All faux — no real exploitation. Visitors should feel like they're watching a demo reel.*

1. **`nmap` scanner app** — paste a hostname, see a fake port scan animate (~10s, deterministic results). Output styled like real `nmap -A`.
2. **Password-strength cracker demo** — type a password, watch a brute-force animation estimate crack time, ASCII progress bar. Educational + entertaining.
3. **Matrix screensaver** — after 90s of desktop idle, falling green code rain. Click to dismiss. Toggleable via Settings.
4. **SSH "connect to server" sim** — `ssh diwakar@compliance-agent.bajaj.internal` in the Terminal kicks off a fake handshake (banner, MOTD with project stats), drops into a sub-shell exposing more `cat`-able project files.
5. **CTF puzzle** — a hidden file (`~/secrets/.flag`) that needs the right commands to unlock (`chmod +r`, then `cat`). Three difficulty levels, leaderboard local-only.

## PR γ — "Portfolio depth"
*Goal: when a recruiter spends 5 minutes here, they leave with a concrete sense of impact.*

1. **Case-study viewer** — opens from Projects. Each project gets a long-form page: problem, architecture diagram, tech rationale, scale numbers, video/screenshot, link out. compliance-agent / Moshi / Aetherflow each get one.
2. **GitHub activity widget** — sidebar pulling the GitHub public API. Last 30 days commits, top repos, contribution heatmap. Server-side cached.
3. **Contact form app** — Name + email + message → sends via API route (Resend). Rate-limited.
4. **Talks & papers app** — list of conference talks + SustainAI paper, each opens to a slide deck or PDF.

---

## Cross-cutting concerns

- **Theme tokens are the source of truth** — all new features consume `src/lib/theme/tokens.cjs` via Tailwind class names. No raw hex.
- **Window manager API stays stable** — new apps register through `src/components/apps/registry.tsx`.
- **Mobile parity** — features should at minimum NOT break on 390×844. Heavy apps (Code Editor, nmap) may show a "best on desktop" overlay below 768px.
- **No backend persistence** — local state via `localStorage`. Contact form is the one exception (single rate-limited POST).

## Out of scope (someday)

- Real-time multi-user (cursor sharing)
- Auth / personalisation
- AI desktop assistant beyond the Terminal
- Native app installer (Flatpak parody)
