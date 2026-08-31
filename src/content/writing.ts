/**
 * Publishing pipeline. Every post, article and paper note is a markdown file
 * in /content — write one, commit it, it is live. No CMS, no database.
 *
 * Server-only: this reads the filesystem. Client surfaces (the Writing app,
 * the terminal `blog` command) fetch /api/content, which is prerendered at
 * build time from exactly this module.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export type EntryKind = 'post' | 'paper';

export interface Entry {
  slug: string;
  kind: EntryKind;
  title: string;
  /** ISO date, YYYY-MM-DD */
  date: string;
  summary: string;
  tags: string[];
  /** markdown body, frontmatter stripped */
  body: string;
  /** papers only */
  authors?: string;
  venue?: string;
  link?: string;
  /** papers only: reading / read / referenced */
  status?: string;
  /** posts only: hide from the index while drafting */
  draft?: boolean;
}

const CONTENT_DIR = join(process.cwd(), 'content');

/**
 * Minimal frontmatter: `key: value` lines between two `---` fences.
 * ponytail: not YAML — no nesting, no quoting rules. Lists are comma-separated.
 * Swap in a real parser only if a post ever needs structure this cannot express.
 */
function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const text = raw.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  if (!text.startsWith('---\n')) return { meta: {}, body: text };
  const end = text.indexOf('\n---', 4);
  if (end === -1) return { meta: {}, body: text };

  const meta: Record<string, string> = {};
  for (const line of text.slice(4, end).split('\n')) {
    const colon = line.indexOf(':');
    if (colon <= 0) continue;
    meta[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
  }
  return { meta, body: text.slice(end + 4).replace(/^\n+/, '') };
}

function toEntry(file: string): Entry | null {
  const { meta, body } = parseFrontmatter(readFileSync(join(CONTENT_DIR, file), 'utf8'));
  if (!meta.title) return null;
  return {
    slug: file.replace(/\.md$/, ''),
    kind: meta.kind === 'paper' ? 'paper' : 'post',
    title: meta.title,
    date: meta.date ?? '',
    summary: meta.summary ?? '',
    tags: meta.tags ? meta.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
    body,
    authors: meta.authors || undefined,
    venue: meta.venue || undefined,
    link: meta.link || undefined,
    status: meta.status || undefined,
    draft: meta.draft === 'true',
  };
}

/** Newest first. Drafts excluded. */
export function allEntries(): Entry[] {
  if (!existsSync(CONTENT_DIR)) return [];
  return readdirSync(CONTENT_DIR)
    .filter((f) => f.endsWith('.md'))
    .map(toEntry)
    .filter((e): e is Entry => e !== null && !e.draft)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function entriesOfKind(kind: EntryKind): Entry[] {
  return allEntries().filter((e) => e.kind === kind);
}

export function getEntry(slug: string): Entry | undefined {
  return allEntries().find((e) => e.slug === slug);
}
