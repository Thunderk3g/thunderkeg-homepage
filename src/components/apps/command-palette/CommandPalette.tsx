"use client";

import { Command } from "cmdk";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import * as L from "lucide-react";

import { useWindows } from "@/components/desktop/WindowManager";
import { DEFAULT_TITLES } from "@/components/desktop/WindowManager";
import { Icon, type IconName } from "@/lib/theme/icons";
import type { AppKind } from "@/types/window";

// ─────────────────────────────────────────────────────────────────────────────
// Types

interface CommandPaletteProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

/** Minimal subset of /resume.json we actually index. */
interface ResumeShape {
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
}

/** Mirrors shell.ts's `buildFs` output shape (locally so we don't import shell). */
type FsEntry =
  | { kind: "dir"; children: Record<string, FsEntry> }
  | { kind: "file"; content: string }
  | { kind: "app"; app: AppKind; description: string };

interface FsFile {
  /** Path-from-root, e.g. "~/about.txt" or "~/projects/aetherflow". */
  path: string;
  name: string;
  entry: FsEntry;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fake filesystem (mirrors src/components/apps/terminal/shell.ts::buildFs)

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

  const skillsText = resume ? resume.skills.join("\n") : "Loading skills…";

  return {
    kind: "dir",
    children: {
      "about.txt": { kind: "file", content: aboutText },
      "skills.txt": { kind: "file", content: skillsText },
      "social.txt": { kind: "file", content: socialText },
      "resume.json": {
        kind: "app",
        app: "resume",
        description: "Open the Resume app for the full document.",
      },
      "projects": { kind: "dir", children: projects },
      "games": {
        kind: "dir",
        children: {
          "doom": {
            kind: "app",
            app: "doom",
            description: "Launch DOOM (cross-origin DOS emulator).",
          },
          "tetris": {
            kind: "app",
            app: "tetris",
            description: "Launch the Tetris app.",
          },
        },
      },
      "media": {
        kind: "dir",
        children: {
          "mp3": {
            kind: "app",
            app: "mp3",
            description: "Open the MP3 player.",
          },
          "vlc": {
            kind: "app",
            app: "vlc",
            description: "Open the Media player.",
          },
        },
      },
    },
  };
}

function flattenFs(root: FsEntry, base = "~"): FsFile[] {
  const out: FsFile[] = [];
  const walk = (node: FsEntry, path: string): void => {
    if (node.kind === "dir") {
      for (const [name, child] of Object.entries(node.children)) {
        const childPath = `${path}/${name}`;
        if (child.kind === "dir") {
          walk(child, childPath);
        } else {
          out.push({ path: childPath, name, entry: child });
        }
      }
    }
  };
  walk(root, base);
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Static data

const APP_ICONS: Record<AppKind, IconName> = {
  terminal: "terminal",
  voice: "voice",
  resume: "resume",
  projects: "projects",
  about: "about",
  social: "social",
  doom: "doom",
  tetris: "tetris",
  mp3: "mp3",
  vlc: "vlc",
  files: "files",
  "code-editor": "code-editor",
};

const APP_KINDS: AppKind[] = [
  "terminal",
  "voice",
  "resume",
  "projects",
  "about",
  "social",
  "doom",
  "tetris",
  "mp3",
  "vlc",
];

interface SlashCommand {
  cmd: string;
  blurb: string;
}

const SLASH_COMMANDS: SlashCommand[] = [
  { cmd: "/help", blurb: "Show terminal command list" },
  { cmd: "/clear", blurb: "Clear the terminal" },
  { cmd: "/resume", blurb: "Open the resume" },
  { cmd: "/projects", blurb: "List portfolio projects" },
  { cmd: "/voice", blurb: "Start the voice assistant" },
  { cmd: "/contact", blurb: "Show contact information" },
];

type ResumeTab = "summary" | "experience" | "projects";

interface ResumeMatch {
  id: string;
  tab: ResumeTab;
  label: string;
  preview: string;
  keywords: string[];
}

function buildResumeMatches(resume: ResumeShape | null): ResumeMatch[] {
  if (!resume) return [];
  const out: ResumeMatch[] = [];

  out.push({
    id: "resume-summary",
    tab: "summary",
    label: "Summary",
    preview: resume.summary.slice(0, 140) + (resume.summary.length > 140 ? "…" : ""),
    keywords: ["summary", "about", "bio", "intro"],
  });

  resume.experience.forEach((exp, expIdx) => {
    exp.bullets.forEach((bullet, i) => {
      out.push({
        id: `resume-exp-${expIdx}-${i}`,
        tab: "experience",
        label: `${exp.company} — ${exp.title}`,
        preview: bullet,
        keywords: [exp.company, exp.title, "experience", "work", "job"],
      });
    });
  });

  resume.projects.forEach((p, i) => {
    out.push({
      id: `resume-proj-${i}`,
      tab: "projects",
      label: p.name,
      preview: p.blurb,
      keywords: [p.name, "project", ...(p.tech ?? [])],
    });
  });

  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Resume fetch (module-level singleton so re-opens are instant)

let resumePromise: Promise<ResumeShape> | null = null;
let resumeCache: ResumeShape | null = null;

function fetchResume(): Promise<ResumeShape> {
  if (resumeCache) return Promise.resolve(resumeCache);
  if (resumePromise) return resumePromise;
  resumePromise = (async () => {
    const res = await fetch("/resume.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`resume.json ${res.status}`);
    const json = (await res.json()) as ResumeShape;
    resumeCache = json;
    return json;
  })();
  resumePromise.catch(() => {
    resumePromise = null;
  });
  return resumePromise;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component

export default function CommandPalette({ open, setOpen }: CommandPaletteProps) {
  const { open: openApp } = useWindows();
  const [search, setSearch] = useState("");
  const [resume, setResume] = useState<ResumeShape | null>(resumeCache);

  // Lazy-load resume the first time the palette opens.
  useEffect(() => {
    if (!open || resume) return;
    let cancelled = false;
    fetchResume()
      .then((r) => {
        if (!cancelled) setResume(r);
      })
      .catch(() => {
        // Silently ignore — palette still works without resume data.
      });
    return () => {
      cancelled = true;
    };
  }, [open, resume]);

  // Reset search when closing so next open is fresh.
  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  const files = useMemo(() => flattenFs(buildFs(resume)), [resume]);
  const resumeMatches = useMemo(() => buildResumeMatches(resume), [resume]);

  const close = (): void => setOpen(false);

  const runApp = (kind: AppKind): void => {
    openApp(kind);
    close();
  };

  const runFile = (file: FsFile): void => {
    const { entry, path } = file;
    if (entry.kind === "app") {
      openApp(entry.app);
      toast.message(`Opening ${DEFAULT_TITLES[entry.app]}`, {
        description: entry.description,
      });
    } else if (entry.kind === "file") {
      // No editor wired up yet — surface the path via toast for now.
      toast.message(path, {
        description: entry.content.split("\n").slice(0, 4).join(" · "),
      });
    }
    close();
  };

  const runSlash = (slash: string): void => {
    openApp("terminal");
    toast.message(`Type "${slash}" in the terminal`, {
      description: "The Cmd+K palette can't pre-fill the prompt yet.",
    });
    close();
  };

  const runResume = (m: ResumeMatch): void => {
    // Hint to the Resume app which tab to focus. The ResumeApp doesn't yet
    // read this — wiring is done by the main integration agent.
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem("thunderkeg.resume.tab", m.tab);
      } catch {
        // localStorage may be disabled (private mode); not fatal.
      }
    }
    openApp("resume");
    close();
  };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Global command palette"
      shouldFilter
      loop
      overlayClassName="fixed inset-0 z-[100] bg-bg/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0"
      contentClassName="fixed left-1/2 top-[18%] z-[101] w-[90vw] max-w-2xl -translate-x-1/2 overflow-hidden rounded-lg border border-border bg-surface text-fg shadow-window outline-none"
    >
      {/* Input row */}
      <div className="flex items-center gap-2 border-b border-border px-3">
        <L.Search size={16} className="text-muted" aria-hidden />
        <Command.Input
          autoFocus
          value={search}
          onValueChange={setSearch}
          placeholder="Type a command, app, file, or search the resume…"
          className="h-12 flex-1 bg-transparent text-sm text-fg placeholder:text-muted focus:outline-none"
        />
        <kbd className="hidden rounded-sm border border-border bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-muted sm:inline-block">
          Esc
        </kbd>
      </div>

      <Command.List className="max-h-[60vh] overflow-y-auto p-2">
        <Command.Empty className="px-3 py-6 text-center text-sm text-muted">
          No results. Try &apos;about&apos; or &apos;compliance&apos;.
        </Command.Empty>

        {/* Apps */}
        <Command.Group
          heading="Apps"
          className="cmdk-group [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted"
        >
          {APP_KINDS.map((kind) => (
            <Command.Item
              key={`app-${kind}`}
              value={`app ${kind} ${DEFAULT_TITLES[kind]}`}
              onSelect={() => runApp(kind)}
              className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-sm text-fg aria-selected:bg-elevated aria-selected:text-accent data-[selected=true]:bg-elevated data-[selected=true]:text-accent"
            >
              <Icon name={APP_ICONS[kind]} size={14} />
              <span className="flex-1">{DEFAULT_TITLES[kind]}</span>
              <span className="font-mono text-[10px] text-muted">{kind}</span>
            </Command.Item>
          ))}
        </Command.Group>

        {/* Files */}
        <Command.Group
          heading="Files"
          className="cmdk-group [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted"
        >
          {files.map((f) => (
            <Command.Item
              key={`file-${f.path}`}
              value={`file ${f.path} ${f.name}`}
              onSelect={() => runFile(f)}
              className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-sm text-fg aria-selected:bg-elevated aria-selected:text-accent data-[selected=true]:bg-elevated data-[selected=true]:text-accent"
            >
              {f.entry.kind === "app" ? (
                <L.PlayCircle size={14} className="text-accent2" />
              ) : (
                <L.FileText size={14} className="text-muted" />
              )}
              <span className="flex-1 truncate">{f.name}</span>
              <span className="font-mono text-[10px] text-muted">{f.path}</span>
            </Command.Item>
          ))}
        </Command.Group>

        {/* Slash commands */}
        <Command.Group
          heading="Slash commands"
          className="cmdk-group [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted"
        >
          {SLASH_COMMANDS.map((s) => (
            <Command.Item
              key={`slash-${s.cmd}`}
              value={`slash ${s.cmd} ${s.blurb}`}
              onSelect={() => runSlash(s.cmd)}
              className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-sm text-fg aria-selected:bg-elevated aria-selected:text-accent data-[selected=true]:bg-elevated data-[selected=true]:text-accent"
            >
              <L.SlashSquare size={14} className="text-accent" />
              <span className="flex-1 font-mono">{s.cmd}</span>
              <span className="text-xs text-muted">{s.blurb}</span>
            </Command.Item>
          ))}
        </Command.Group>

        {/* Resume */}
        {resumeMatches.length > 0 && (
          <Command.Group
            heading="Resume"
            className="cmdk-group [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted"
          >
            {resumeMatches.map((m) => (
              <Command.Item
                key={m.id}
                value={`resume ${m.label} ${m.preview} ${m.keywords.join(" ")}`}
                keywords={m.keywords}
                onSelect={() => runResume(m)}
                className="flex cursor-pointer items-start gap-2 rounded-sm px-2 py-2 text-sm text-fg aria-selected:bg-elevated aria-selected:text-accent data-[selected=true]:bg-elevated data-[selected=true]:text-accent"
              >
                <L.BookOpen size={14} className="mt-0.5 text-muted" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate">{m.label}</span>
                  <span className="truncate text-xs text-muted">
                    {m.preview}
                  </span>
                </span>
                <span className="font-mono text-[10px] uppercase text-muted">
                  {m.tab}
                </span>
              </Command.Item>
            ))}
          </Command.Group>
        )}
      </Command.List>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-border bg-elevated/40 px-3 py-1.5 text-[10px] text-muted">
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <kbd className="rounded-sm border border-border bg-elevated px-1 py-0.5 font-mono">
              ↑↓
            </kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded-sm border border-border bg-elevated px-1 py-0.5 font-mono">
              ↵
            </kbd>
            select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded-sm border border-border bg-elevated px-1 py-0.5 font-mono">
              esc
            </kbd>
            close
          </span>
        </span>
        <span className="flex items-center gap-1">
          <kbd className="rounded-sm border border-border bg-elevated px-1 py-0.5 font-mono">
            {/* eslint-disable-next-line react/no-unescaped-entities */}⌘
          </kbd>
          <kbd className="rounded-sm border border-border bg-elevated px-1 py-0.5 font-mono">
            K
          </kbd>
        </span>
      </div>
    </Command.Dialog>
  );
}
