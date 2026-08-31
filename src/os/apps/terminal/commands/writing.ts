import type { Command } from '../../../types';
import type { Entry } from '@/content/writing';

/** /api/content is prerendered at build time — one fetch, cached for the session. */
let cache: Promise<Entry[]> | null = null;

function load(): Promise<Entry[]> {
  if (!cache) {
    cache = fetch('/api/content')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: { entries: Entry[] }) => d.entries)
      .catch((e: Error) => {
        cache = null;
        throw e;
      });
  }
  return cache;
}

const pad = (s: string, n: number) => (s.length >= n ? s : s + ' '.repeat(n - s.length));

function list(entries: Entry[], label: string): string {
  if (entries.length === 0) return `no ${label} published yet.`;
  const rows = entries.map((e) => `  ${pad(e.date || '—', 12)}${e.title}\n${' '.repeat(14)}${e.slug}`);
  return [`${entries.length} ${label}:`, '', ...rows, '', `read one:  read <slug>      ·  web: /writing`].join('\n');
}

function show(entry: Entry): string {
  const head = [
    entry.title,
    '='.repeat(Math.min(entry.title.length, 72)),
    [entry.date, entry.authors, entry.venue, entry.status].filter(Boolean).join(' · '),
    entry.link ?? '',
    '',
  ].filter((l) => l !== undefined);
  return [...head, entry.body.trim()].join('\n');
}

async function withEntries(fn: (e: Entry[]) => string): Promise<string> {
  try {
    return fn(await load());
  } catch (err) {
    return `could not reach the content index (${err instanceof Error ? err.message : String(err)}).`;
  }
}

export const writingCommands: Command[] = [
  {
    name: 'blog',
    summary: 'list published posts and articles',
    usage: 'blog [slug]',
    category: 'writing',
    run: ({ args, shell }) =>
      withEntries((all) => {
        const posts = all.filter((e) => e.kind === 'post');
        if (!args[0]) {
          shell.launch('writing');
          return list(posts, 'posts');
        }
        const hit = posts.find((e) => e.slug === args[0] || e.slug.startsWith(args[0]));
        return hit ? show(hit) : `blog: no post matching '${args[0]}'`;
      }),
    complete: () => [],
  },
  {
    name: 'papers',
    summary: 'list the papers I am currently reading',
    usage: 'papers [slug]',
    category: 'writing',
    run: ({ args }) =>
      withEntries((all) => {
        const papers = all.filter((e) => e.kind === 'paper');
        if (!args[0]) return list(papers, 'paper notes');
        const hit = papers.find((e) => e.slug === args[0] || e.slug.startsWith(args[0]));
        return hit ? show(hit) : `papers: no note matching '${args[0]}'`;
      }),
  },
  {
    name: 'read',
    summary: 'print a post or paper note in full',
    usage: 'read <slug>',
    category: 'writing',
    run: ({ args }) =>
      withEntries((all) => {
        if (!args[0]) return 'usage: read <slug>   (run `blog` or `papers` for slugs)';
        const hit = all.find((e) => e.slug === args[0] || e.slug.startsWith(args[0]));
        return hit ? show(hit) : `read: no entry matching '${args[0]}'`;
      }),
  },
];
