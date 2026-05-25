"use client";

/**
 * Fake filesystem for the Code Editor app.
 *
 * Mirrors the file tree exposed by the Terminal app (rooted at `~/`) but
 * returns each file as a buffer suitable for a code editor: a name, a
 * language tag, and the full text content.
 *
 * Self-contained: we fetch `/resume.json` directly rather than importing
 * from `terminal/shell.ts`, so the editor can evolve independently.
 */

import { useEffect, useState } from "react";

export type EditorLang = "json" | "md" | "ts" | "text";

export interface EditorFile {
  /** Pretty path, e.g. `~/about.txt`. Used as the canonical id. */
  id: string;
  /** Just the basename: `about.txt`. */
  name: string;
  lang: EditorLang;
  content: string;
}

export interface UseFakeFs {
  files: Record<string, EditorFile>;
  /** Stable, display-ordered list of file ids. */
  order: string[];
  loading: boolean;
  error: string | null;
}

interface RawResume {
  personal: {
    full_name: string;
    title: string;
    email: string;
    phone: string;
    location: string;
    linkedin?: string;
    github?: string;
    twitter?: string;
  };
  summary: string;
  skills: string[];
  projects: Array<{ name: string; blurb: string; tech?: string[]; link?: string }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Module-level cache so re-opening the editor doesn't refetch.

let cachedResume: RawResume | null = null;
let cachedPromise: Promise<RawResume> | null = null;

function fetchResume(): Promise<RawResume> {
  if (cachedResume) return Promise.resolve(cachedResume);
  if (cachedPromise) return cachedPromise;

  cachedPromise = (async () => {
    const res = await fetch("/resume.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load resume.json (${res.status})`);
    const data = (await res.json()) as RawResume;
    cachedResume = data;
    return data;
  })();

  cachedPromise.catch(() => {
    cachedPromise = null;
  });

  return cachedPromise;
}

// ─────────────────────────────────────────────────────────────────────────────
// Content builders

const README_MD = `# Sandboxed Code Editor

Welcome to the read-only code editor inside the Kali desktop portfolio.

* Browse files from the simulated \`~/\` home directory on the left.
* Open multiple files in tabs; close any tab with the × button.
* Edits are disabled — press **Cmd/Ctrl + S** to download the current buffer.
* Resume data is fetched from \`/resume.json\` and rendered as plain text or JSON.
`;

function projectSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function buildAboutTxt(r: RawResume): string {
  return [
    r.personal.full_name,
    r.personal.title,
    r.personal.location,
    "",
    r.summary,
  ].join("\n");
}

function buildSocialTxt(r: RawResume): string {
  return [
    `Email:    ${r.personal.email}`,
    `Phone:    ${r.personal.phone}`,
    `LinkedIn: ${r.personal.linkedin ?? "—"}`,
    `GitHub:   ${r.personal.github ?? "—"}`,
    `Twitter:  ${r.personal.twitter ?? "—"}`,
  ].join("\n");
}

function buildSkillsTxt(r: RawResume): string {
  return r.skills.join("\n");
}

function buildProjectFile(p: RawResume["projects"][number]): string {
  const heading = p.name;
  const underline = "=".repeat(Math.max(3, heading.length));
  const lines = [heading, underline, "", p.blurb];
  if (p.tech && p.tech.length > 0) {
    lines.push("", `Tech: ${p.tech.join(", ")}`);
  }
  if (p.link) {
    lines.push("", `Link: ${p.link}`);
  }
  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Assemble the file map

function buildFiles(resume: RawResume | null): {
  files: Record<string, EditorFile>;
  order: string[];
} {
  const files: Record<string, EditorFile> = {};
  const order: string[] = [];

  const add = (file: EditorFile) => {
    files[file.id] = file;
    order.push(file.id);
  };

  add({
    id: "~/README.md",
    name: "README.md",
    lang: "md",
    content: README_MD,
  });

  if (resume) {
    add({
      id: "~/resume.json",
      name: "resume.json",
      lang: "json",
      content: JSON.stringify(resume, null, 2),
    });
    add({
      id: "~/about.txt",
      name: "about.txt",
      lang: "text",
      content: buildAboutTxt(resume),
    });
    add({
      id: "~/social.txt",
      name: "social.txt",
      lang: "text",
      content: buildSocialTxt(resume),
    });
    add({
      id: "~/skills.txt",
      name: "skills.txt",
      lang: "text",
      content: buildSkillsTxt(resume),
    });
    for (const project of resume.projects) {
      const slug = projectSlug(project.name) || "project";
      add({
        id: `~/projects/${slug}.txt`,
        name: `${slug}.txt`,
        lang: "text",
        content: buildProjectFile(project),
      });
    }
  }

  return { files, order };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook

export function useFakeFs(): UseFakeFs {
  const [resume, setResume] = useState<RawResume | null>(cachedResume);
  const [loading, setLoading] = useState<boolean>(cachedResume === null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (cachedResume) {
      setLoading(false);
      return;
    }

    fetchResume()
      .then((data) => {
        if (cancelled) return;
        setResume(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const { files, order } = buildFiles(resume);
  return { files, order, loading, error };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers

/** Guess the language from a file id's extension. Used as a fallback. */
export function langFromId(id: string): EditorLang {
  if (id.endsWith(".json")) return "json";
  if (id.endsWith(".md")) return "md";
  if (id.endsWith(".ts") || id.endsWith(".js") || id.endsWith(".tsx") || id.endsWith(".jsx")) {
    return "ts";
  }
  return "text";
}
