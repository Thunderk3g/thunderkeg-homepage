/**
 * Mini Bash-like shell for the Terminal app.
 *
 * Implements a small, opinionated subset of Linux commands against a fake
 * filesystem rooted at `~/`. Unknown commands return `{ kind: "passthrough" }`
 * so the caller can forward to the AI agent.
 *
 * Stateless: cwd is passed in and a new cwd is returned in the result. The
 * caller (TerminalApp) holds the React state.
 */

import type { AppKind } from "@/types/window";

type FsEntry =
  | { kind: "dir"; children: Record<string, FsEntry> }
  | { kind: "file"; content: string }
  | { kind: "app"; app: AppKind; description: string };

export interface ShellContext {
  /** Open or focus an app window. */
  openApp(app: AppKind): void;
  /** Close the terminal window. */
  exit(): void;
  /** Loaded /resume.json (or null if still fetching). */
  resume: ResumeShape | null;
}

export interface ResumeShape {
  personal: {
    full_name: string;
    title: string;
    email: string;
    phone: string;
    location: string;
    linkedin?: string;
    github?: string;
  };
  summary: string;
  experience: Array<{
    title: string;
    company: string;
    start_date: string;
    end_date: string;
    bullets: string[];
  }>;
  projects: Array<{ name: string; blurb: string; tech?: string[] }>;
  skills: string[];
  awards: string[];
}

export type ShellResult =
  | { kind: "output"; lines: string[]; newCwd?: string }
  | { kind: "clear" }
  | { kind: "passthrough" };

// ─────────────────────────────────────────────────────────────────────────────
// Fake filesystem

function buildFs(resume: ResumeShape | null): FsEntry {
  const projects: Record<string, FsEntry> = {};
  if (resume) {
    for (const p of resume.projects) {
      const slug = p.name.toLowerCase().replace(/\s+/g, "-");
      const body = [
        p.name,
        "=".repeat(p.name.length),
        "",
        p.blurb,
        p.tech && p.tech.length > 0 ? `\nTech: ${p.tech.join(", ")}` : "",
      ].join("\n");
      projects[slug] = { kind: "file", content: body };
    }
  }

  const aboutText = resume
    ? [
        resume.personal.full_name,
        resume.personal.title,
        resume.personal.location,
        "",
        resume.summary,
      ].join("\n")
    : "Loading resume…";

  const socialText = resume
    ? [
        `Email:    ${resume.personal.email}`,
        `Phone:    ${resume.personal.phone}`,
        `LinkedIn: ${resume.personal.linkedin ?? "—"}`,
        `GitHub:   ${resume.personal.github ?? "—"}`,
      ].join("\n")
    : "Loading social links…";

  const skillsText = resume
    ? resume.skills.join("\n")
    : "Loading skills…";

  return {
    kind: "dir",
    children: {
      "about.txt":   { kind: "file", content: aboutText },
      "skills.txt":  { kind: "file", content: skillsText },
      "social.txt":  { kind: "file", content: socialText },
      "resume.json": { kind: "app", app: "resume", description: "Open the Resume app for the full document." },
      "projects": { kind: "dir", children: projects },
      "games": {
        kind: "dir",
        children: {
          "doom":   { kind: "app", app: "doom",   description: "Launch DOOM (cross-origin DOS emulator)." },
          "tetris": { kind: "app", app: "tetris", description: "Launch the Tetris app." },
        },
      },
      "media": {
        kind: "dir",
        children: {
          "mp3": { kind: "app", app: "mp3", description: "Open the MP3 player." },
          "vlc": { kind: "app", app: "vlc", description: "Open the Media player." },
        },
      },
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Path resolution

function splitPath(p: string): string[] {
  return p.split("/").filter((s) => s.length > 0);
}

function normalise(cwd: string, input: string): string {
  // cwd is "~", "~/projects", etc.
  if (input.startsWith("/")) return "/" + splitPath(input).join("/");
  let segments: string[];
  if (input.startsWith("~")) {
    segments = ["~", ...splitPath(input.slice(1))];
  } else {
    segments = [...splitPath(cwd), ...splitPath(input)];
  }
  const out: string[] = [];
  for (const seg of segments) {
    if (seg === "." || seg === "") continue;
    if (seg === "..") {
      if (out.length > 1) out.pop();
      continue;
    }
    out.push(seg);
  }
  if (out.length === 0 || out[0] !== "~") return "~";
  return out.join("/");
}

function resolve(root: FsEntry, path: string): FsEntry | null {
  const parts = splitPath(path);
  if (parts[0] !== "~") return null;
  let node: FsEntry = root;
  for (const part of parts.slice(1)) {
    if (node.kind !== "dir") return null;
    const next: FsEntry | undefined = node.children[part];
    if (!next) return null;
    node = next;
  }
  return node;
}

// ─────────────────────────────────────────────────────────────────────────────
// Commands

const HELP_LINES = [
  "Built-in commands:",
  "  whoami                 Print effective user",
  "  pwd                    Print working directory",
  "  ls [path]              List directory contents",
  "  cd <path>              Change directory",
  "  cat <file>             Print file (or open the linked app)",
  "  echo <text...>         Print arguments",
  "  date                   Show current date/time",
  "  uname [-a]             Show system info",
  "  neofetch               System summary with ASCII art",
  "  clear                  Clear the terminal",
  "  exit                   Close the terminal window",
  "  help                   Show this list",
  "",
  "Slash commands: /help /clear /resume /projects /voice /contact",
  "",
  "Anything else is sent to the AI agent.",
];

const NEOFETCH = (resume: ResumeShape | null): string[] => {
  const ascii = [
    "      ::::::::::::::::::::::::::::::      ",
    "       :::::::    KALI    :::::::         ",
    "      ::::                    ::::        ",
    "     :::    .-=*##*=-.          :::       ",
    "    :::   *##*+----+*#*-         :::      ",
    "   :::   *#*    --    *#*         :::     ",
    "   :::  *#*    *##*    *#*        :::     ",
    "    :::  *#*  *####*  *#*        :::      ",
    "     :::  *####****####*        :::       ",
    "      ::::                    ::::        ",
    "       :::::::          :::::::           ",
    "        ::::::::::::::::::::::            ",
  ];
  const user = "diwakar@kali";
  const info = [
    `${user}`,
    "─".repeat(user.length),
    `OS:       Kali Linux (Thunderkeg edition, simulated)`,
    `Host:     thunderkeg-homepage`,
    `Kernel:   6.6.0-kali-portfolio`,
    `Uptime:   ${Math.floor(performance.now() / 1000)}s since page load`,
    `Shell:    thunderkeg-sh 0.1 (faux-bash)`,
    `Resolution: ${typeof window !== "undefined" ? `${window.innerWidth}x${window.innerHeight}` : "n/a"}`,
    `Theme:    Kali Purple (#7c5cff on #0b0d12)`,
    `Terminal: thunderkeg`,
    resume
      ? `User:     ${resume.personal.full_name} — ${resume.personal.title}`
      : "User:     Diwakar Adhikari",
    resume
      ? `Location: ${resume.personal.location}`
      : "Location: Pune, India",
  ];
  // Pad ascii column to align text on the right.
  const width = Math.max(...ascii.map((l) => l.length));
  const lines: string[] = [];
  for (let i = 0; i < Math.max(ascii.length, info.length); i++) {
    const left = (ascii[i] ?? "").padEnd(width, " ");
    const right = info[i] ?? "";
    lines.push(`${left}  ${right}`);
  }
  return lines;
};

// ─────────────────────────────────────────────────────────────────────────────
// Entry point

const KNOWN_COMMANDS = new Set([
  "whoami", "pwd", "ls", "cd", "cat", "echo", "date", "uname",
  "neofetch", "clear", "exit", "help", "man", "history",
]);

export function runShell(
  input: string,
  cwd: string,
  ctx: ShellContext,
): ShellResult {
  const text = input.trim();
  if (!text || text.startsWith("/")) return { kind: "passthrough" };
  const argv = text.split(/\s+/);
  const cmd = argv[0]!.toLowerCase();
  const args = argv.slice(1);

  if (!KNOWN_COMMANDS.has(cmd)) return { kind: "passthrough" };

  const fs = buildFs(ctx.resume);

  switch (cmd) {
    case "whoami":
      return { kind: "output", lines: ["diwakar"] };

    case "pwd":
      return { kind: "output", lines: [cwd.replace("~", "/home/diwakar")] };

    case "ls": {
      const target = args[0] ? normalise(cwd, args[0]) : cwd;
      const node = resolve(fs, target);
      if (!node) return { kind: "output", lines: [`ls: cannot access '${args[0]}': No such file or directory`] };
      if (node.kind !== "dir") {
        return { kind: "output", lines: [args[0] ?? target] };
      }
      const entries = Object.entries(node.children)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, child]) => {
          if (child.kind === "dir") return `${name}/`;
          if (child.kind === "app") return `${name}*`;
          return name;
        });
      return { kind: "output", lines: entries.length > 0 ? [entries.join("  ")] : ["(empty)"] };
    }

    case "cd": {
      if (args.length === 0 || args[0] === "~") return { kind: "output", lines: [], newCwd: "~" };
      const target = normalise(cwd, args[0]!);
      const node = resolve(fs, target);
      if (!node) return { kind: "output", lines: [`cd: ${args[0]}: No such file or directory`] };
      if (node.kind !== "dir") return { kind: "output", lines: [`cd: ${args[0]}: Not a directory`] };
      return { kind: "output", lines: [], newCwd: target };
    }

    case "cat": {
      if (args.length === 0) return { kind: "output", lines: ["cat: missing operand"] };
      const out: string[] = [];
      for (const arg of args) {
        const target = normalise(cwd, arg);
        const node = resolve(fs, target);
        if (!node) {
          out.push(`cat: ${arg}: No such file or directory`);
          continue;
        }
        if (node.kind === "dir") {
          out.push(`cat: ${arg}: Is a directory`);
          continue;
        }
        if (node.kind === "app") {
          ctx.openApp(node.app);
          out.push(`Opening ${node.app}… (${node.description})`);
          continue;
        }
        out.push(...node.content.split("\n"));
      }
      return { kind: "output", lines: out };
    }

    case "echo":
      return { kind: "output", lines: [args.join(" ")] };

    case "date":
      return { kind: "output", lines: [new Date().toString()] };

    case "uname": {
      if (args.includes("-a")) {
        return {
          kind: "output",
          lines: ["Linux kali 6.6.0-kali-portfolio #1 SMP x86_64 GNU/Linux"],
        };
      }
      return { kind: "output", lines: ["Linux"] };
    }

    case "neofetch":
      return { kind: "output", lines: NEOFETCH(ctx.resume) };

    case "clear":
      return { kind: "clear" };

    case "exit":
      ctx.exit();
      return { kind: "output", lines: ["logout"] };

    case "help":
      return { kind: "output", lines: HELP_LINES };

    case "man": {
      if (args.length === 0) return { kind: "output", lines: ["What manual page do you want?"] };
      const target = args[0]!.toLowerCase();
      if (!KNOWN_COMMANDS.has(target)) {
        return { kind: "output", lines: [`No manual entry for ${target}`] };
      }
      const line = HELP_LINES.find((l) => l.trim().startsWith(target));
      return { kind: "output", lines: line ? [line.trim()] : [`${target}: built-in`] };
    }

    case "history":
      return { kind: "output", lines: ["(history not implemented — use ↑/↓ in the prompt)"] };

    default:
      return { kind: "passthrough" };
  }
}

/**
 * Format cwd for display in the prompt.
 * Examples: "~" → "~", "~/projects" → "~/projects".
 */
export function promptCwd(cwd: string): string {
  return cwd;
}
