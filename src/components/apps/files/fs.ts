/**
 * Fake filesystem for the File Manager app.
 *
 * Re-implements the same shape used by the Terminal's shell.ts so the two apps
 * stay logically in sync without sharing module-level imports across sibling
 * app folders. Keep this module small (~50 LOC) and intentionally duplicative.
 *
 * Roots at `~` and is constructed from /resume.json content via `buildFs()`.
 */

import type { AppKind } from "@/types/window";
import type { Resume } from "@/lib/resume/schema";

export type FsEntry =
  | { kind: "dir"; children: Record<string, FsEntry> }
  | { kind: "file"; content: string }
  | { kind: "app"; app: AppKind; description: string };

export function buildFs(resume: Resume | null): FsEntry {
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

  const skillsText = resume ? resume.skills.join("\n") : "Loading skills…";

  const socialText = resume
    ? [
        `Email:    ${resume.personal.email}`,
        `Phone:    ${resume.personal.phone}`,
        `LinkedIn: ${resume.personal.linkedin ?? "—"}`,
        `GitHub:   ${resume.personal.github ?? "—"}`,
      ].join("\n")
    : "Loading social links…";

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
// Path utilities

export function splitPath(path: string): string[] {
  return path.split("/").filter((s) => s.length > 0);
}

/** Resolve a `~/...` path against the FS root. Returns null on miss. */
export function resolvePath(root: FsEntry, path: string): FsEntry | null {
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

/** Build all ancestor paths for a given path. `~/a/b` → ["~", "~/a", "~/a/b"]. */
export function ancestorPaths(path: string): string[] {
  const parts = splitPath(path);
  if (parts.length === 0 || parts[0] !== "~") return ["~"];
  const out: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    out.push(parts.slice(0, i + 1).join("/"));
  }
  return out;
}
