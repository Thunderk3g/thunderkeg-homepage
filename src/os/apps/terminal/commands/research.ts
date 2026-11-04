import type { Command } from '../../../types';
import type { PapersResponse } from '@/research/types';
import { STATUS_ORDER, STATUS_SHORT, type ReadStatus } from '@/research/types';
import { dueCards, ensureSeeded, useResearch } from '@/research/store';
import { toBibtex, toBibtexAll } from '@/research/bibtex';
import { buildArxivQuery } from '@/research/client';

/**
 * Research app from the shell. Local data comes straight from the store;
 * remote searches go through /api/research/papers (and so through its arXiv
 * rate gate). `research` / `scholar` themselves are the app's launchCommands.
 */

const pad = (s: string, n: number) => (s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length));
const clip = (s: string, n: number) => (s.length <= n ? s : s.slice(0, n - 1) + '…');

/** argv after the command name, with quotes kept (the tokenizer strips them). */
const rest = (raw: string, name: string) => raw.trim().replace(new RegExp(`^${name}\\s*`), '');

export const researchCommands: Command[] = [
  {
    name: 'arxiv',
    summary: 'search arXiv (newest first) for papers',
    usage: 'arxiv <words | "phrase" | abs:… cat:…>',
    category: 'research',
    run: async ({ raw, print }) => {
      const text = rest(raw, 'arxiv');
      if (!text) return 'usage: arxiv <query>   e.g. arxiv code-switching asr';
      const q = buildArxivQuery(text);
      print(`querying arXiv for ${q} …`);
      try {
        const res = await fetch(`/api/research/papers?${new URLSearchParams({ source: 'arxiv', q: q.slice(0, 400), max: '8' })}`);
        const body = (await res.json()) as PapersResponse & { error?: string };
        if (!res.ok) return `arxiv: ${body.error ?? `HTTP ${res.status}`}`;
        if (!body.items.length) return body.error ? `arxiv: ${body.error}` : 'arxiv: no results.';
        const lines = body.items.map((p) => `  ${pad(p.id, 17)} ${p.published.slice(0, 10)}  ${clip(p.title, 70)}`);
        return [
          `${body.items.length}${body.total ? ` of ${body.total}` : ''} results${body.cached ? ' (cached)' : ''}:`,
          '',
          ...lines,
          '',
          `open in the GUI:  research "${text.replace(/"/g, "'")}"`,
          ...(body.error ? [`note: ${body.error}`] : []),
        ].join('\n');
      } catch (err) {
        return `arxiv: could not reach the search proxy (${err instanceof Error ? err.message : String(err)}).`;
      }
    },
  },
  {
    name: 'library',
    summary: 'list papers in the research library',
    usage: `library [${STATUS_ORDER.join('|')}]`,
    category: 'research',
    run: async ({ args }) => {
      await ensureSeeded();
      const st = args[0] as ReadStatus | undefined;
      if (st && !STATUS_ORDER.includes(st)) return `library: unknown status '${st}' (${STATUS_ORDER.join(', ')})`;
      const papers = useResearch
        .getState()
        .papers.filter((p) => !st || p.status === st)
        .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));
      if (!papers.length) return st ? `no papers with status ${st}.` : 'library is empty — save papers from `research`.';
      return [
        `${pad('STATUS', 9)}${pad('ID', 26)}TITLE`,
        ...papers.map((p) => `${pad(STATUS_SHORT[p.status], 9)}${pad(p.id, 26)}${clip(p.title, 64)}`),
        '',
        `${papers.length} paper(s) · open the GUI: research library`,
      ].join('\n');
    },
    complete: ({ args }) => STATUS_ORDER.filter((s) => s.startsWith(args[0] ?? '')),
  },
  {
    name: 'due',
    summary: 'recall cards due for review today',
    usage: 'due',
    category: 'research',
    run: () => {
      const due = dueCards(useResearch.getState());
      if (!due.length) return 'nothing due. write cards from a paper in `research library`.';
      return [
        `${due.length} card(s) due:`,
        ...due.slice(0, 5).map((c) => `  • ${clip(c.prompt, 90)}`),
        ...(due.length > 5 ? [`  … and ${due.length - 5} more`] : []),
        '',
        'review them:  research review',
      ].join('\n');
    },
  },
  {
    name: 'bibtex',
    summary: 'print BibTeX for a library paper, or all of them',
    usage: 'bibtex <arxiv-id | bibkey | all>',
    category: 'research',
    run: async ({ args }) => {
      await ensureSeeded();
      const papers = useResearch.getState().papers;
      const q = (args[0] ?? '').toLowerCase();
      if (!q) return 'usage: bibtex <id|all>';
      if (q === 'all') return papers.length ? toBibtexAll(papers) : 'library is empty.';
      const hit = papers.find(
        (p) =>
          p.id.toLowerCase() === q ||
          p.arxivId === q.replace(/^arxiv:/, '') ||
          p.bibKey === q ||
          p.contentSlug === q ||
          p.id.toLowerCase().includes(q),
      );
      return hit ? toBibtex(hit) : `bibtex: no library paper matching '${args[0]}' (try \`library\`)`;
    },
    complete: ({ args }) =>
      ['all', ...useResearch.getState().papers.map((p) => p.bibKey)].filter((k) => k.startsWith(args[0] ?? '')),
  },
];
