import type { Command } from '../../../types';
import type { PapersResponse } from '@/research/types';
import { STATUS_ORDER, STATUS_SHORT, type ReadStatus } from '@/research/types';
import { dueCards, ensureSeeded, useResearch } from '@/research/store';
import { toBibtex, toBibtexAll } from '@/research/bibtex';
import { buildArxivQuery } from '@/research/client';
import { planText, studyPlan } from '@/research/plan';
import { matrixRows, matrixText, sortRows } from '@/research/matrix';
import type { Paper } from '@/research/types';

/**
 * Research app from the shell. Local data comes straight from the store;
 * remote searches go through /api/research/papers (and so through its arXiv
 * rate gate). `research` / `scholar` themselves are the app's launchCommands.
 */

const pad = (s: string, n: number) => (s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length));
const clip = (s: string, n: number) => (s.length <= n ? s : s.slice(0, n - 1) + '…');

/** argv after the command name, with quotes kept (the tokenizer strips them). */
const rest = (raw: string, name: string) => raw.trim().replace(new RegExp(`^${name}\\s*`), '');

/** Library lookup by id, arXiv id, bibkey, slug, or a unique fragment of any of those. */
function findPaper(q: string): Paper | undefined {
  const k = q.toLowerCase().replace(/^arxiv:/, '');
  const papers = useResearch.getState().papers;
  return (
    papers.find((p) => p.id.toLowerCase() === q.toLowerCase() || p.arxivId === k || p.bibKey === k || p.contentSlug === k) ??
    papers.find((p) => p.id.toLowerCase().includes(k) || p.bibKey.includes(k))
  );
}

/** `highlight <id> "text" [@ p. 4]` → id and text; quotes are optional. */
export function parseHighlightArgs(raw: string): { id: string; text: string; where?: string } | null {
  const body = rest(raw, 'highlight');
  const m = /^(\S+)\s+([\s\S]+)$/.exec(body);
  if (!m) return null;
  let text = m[2].trim();
  let where: string | undefined;
  const at = /\s+@\s*([^"“”]+)$/.exec(text);
  if (at) {
    where = at[1].trim();
    text = text.slice(0, at.index).trim();
  }
  text = text.replace(/^["“']([\s\S]*)["”']$/, '$1').trim();
  return text ? { id: m[1], text, where } : null;
}

export const researchCommands: Command[] = [
  {
    name: 'today',
    summary: 'the study plan: due cards, reading queue with time budgets, week, RQ coverage',
    usage: 'today',
    category: 'research',
    run: async () => {
      await ensureSeeded();
      const s = useResearch.getState();
      const plan = studyPlan(s);
      const title = (id: string) => s.papers.find((p) => p.id === id)?.title ?? id;
      return planText(plan, title) + '\n\nopen the GUI:  research today';
    },
  },
  {
    name: 'matrix',
    summary: 'the literature matrix as a text table (optionally one RQ)',
    usage: 'matrix [rq1..rq5]',
    category: 'research',
    run: async ({ args }) => {
      await ensureSeeded();
      const s = useResearch.getState();
      const rq = (args[0] ?? '').toLowerCase();
      if (rq && !s.rqs.some((q) => q.id === rq)) return `matrix: unknown research question '${args[0]}' (${s.rqs.map((q) => q.id).join(', ')})`;
      const papers = s.papers.filter((p) => p.status !== 'dropped' && (!rq || p.rqIds.includes(rq)));
      if (!papers.length) return rq ? `no papers linked to ${rq.toUpperCase()}.` : 'library is empty.';
      const rows = sortRows(matrixRows(papers), 'status', 1);
      return [
        matrixText(rows),
        '',
        `${rows.length} paper(s)${rq ? ` on ${rq.toUpperCase()}` : ''} · full table with method, critique and delta: research matrix`,
      ].join('\n');
    },
    complete: ({ args }) => useResearch.getState().rqs.map((q) => q.id).filter((k) => k.startsWith(args[0] ?? '')),
  },
  {
    name: 'highlight',
    summary: 'add a highlight (a sentence you would quote) to a library paper',
    usage: 'highlight <paperId|bibkey> "<text>" [@ p. 4]',
    category: 'research',
    run: async ({ raw }) => {
      await ensureSeeded();
      const parsed = parseHighlightArgs(raw);
      if (!parsed) return 'usage: highlight <paperId|bibkey> "<text>" [@ p. 4]';
      const paper = findPaper(parsed.id);
      if (!paper) return `highlight: no library paper matching '${parsed.id}' (try \`library\`)`;
      useResearch.getState().addHighlight({ paperId: paper.id, text: parsed.text, where: parsed.where });
      const n = useResearch.getState().highlights.filter((h) => h.paperId === paper.id).length;
      return `highlighted in ${clip(paper.title, 60)}${parsed.where ? ` (${parsed.where})` : ''} — ${n} highlight(s). Make it a card in the GUI: research library`;
    },
    complete: ({ args }) =>
      args.length <= 1 ? useResearch.getState().papers.map((p) => p.bibKey).filter((k) => k.startsWith(args[0] ?? '')) : [],
  },
  {
    name: 'radar',
    summary: 'open the AI Radar (live AI headlines) inside Research',
    usage: 'radar',
    category: 'research',
    run: ({ shell }) => {
      shell.launch('research', { arg: 'radar' });
      return 'opening Research → Radar…';
    },
  },
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
