import type { Paper, ResearchQuestion } from './types';
import { STATUS_SHORT } from './types';
import { paperYear } from './bibtex';

/**
 * Literature matrix (synthesis table): one row per paper, one column per thing
 * a related-work section has to say about it.
 *
 * The structured note fields win. Papers imported from the published notes
 * keep everything in `freeform`, under bold run-in labels ("**The finding.**"),
 * so those paragraphs fill the gaps — flagged `derived` so the table can show
 * which cells he has not written himself.
 */

export type MatrixKey = 'title' | 'rqs' | 'status' | 'year' | 'venue' | 'method' | 'result' | 'critique' | 'delta';

export const MATRIX_COLS: { key: MatrixKey; label: string }[] = [
  { key: 'title', label: 'Paper' },
  { key: 'rqs', label: 'RQs' },
  { key: 'status', label: 'Status' },
  { key: 'year', label: 'Year' },
  { key: 'venue', label: 'Venue' },
  { key: 'method', label: 'Method' },
  { key: 'result', label: 'Key result' },
  { key: 'critique', label: 'My critique' },
  { key: 'delta', label: 'Delta' },
];

export interface Cell {
  text: string;
  derived?: boolean;
}

export interface MatrixRow {
  id: string;
  bibKey: string;
  title: string;
  rqIds: string[];
  status: Paper['status'];
  year: string;
  venue: string;
  method: Cell;
  result: Cell;
  critique: Cell;
  delta: Cell;
}

const LABELS: Record<'method' | 'result' | 'critique' | 'delta', RegExp> = {
  method: /^(what it (does|owns)\b(?! not)|method|approach|how it works)/i,
  result: /^(the finding|the result|what i measured|results?|key result)/i,
  critique: /^(where its core assumption breaks|the uncomfortable part|caveats|critique|risk|what is wrong)/i,
  delta: /^(my surviving delta|the gap it leaves|what it does not (cover|give)|what i hold|where i can still differentiate|what is left|delta)/i,
};

const flat = (s: string) => s.replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1').replace(/\s+/g, ' ').trim();

/** "**Label.** text…" paragraphs of a markdown body. */
function labelled(md: string): { label: string; text: string }[] {
  return md
    .split(/\n\s*\n/)
    .map((para) => /^\*\*([^*]+?)\*\*\s*([\s\S]*)$/.exec(para.trim()))
    .filter((m): m is RegExpExecArray => !!m)
    .map((m) => ({ label: m[1].replace(/[.:]\s*$/, '').trim(), text: flat(m[2].replace(/\*\*/g, '')) }));
}

const firstSentence = (s: string) => flat(s).split(/(?<=[.!?])\s+(?=[A-Z0-9(])/)[0] ?? '';

export function deriveNote(p: Paper): Pick<MatrixRow, 'method' | 'result' | 'critique' | 'delta'> {
  const n = p.note;
  const paras = labelled(n.freeform ?? '');
  const from = (k: keyof typeof LABELS) => paras.find((x) => LABELS[k].test(x.label))?.text ?? '';
  const pick = (own: string, k: keyof typeof LABELS, ...more: string[]): Cell => {
    if (own.trim()) return { text: flat(own) };
    const d = [from(k), ...more].find((x) => x && x.trim());
    return d ? { text: flat(d), derived: true } : { text: '' };
  };
  return {
    method: pick(n.method, 'method', n.fiveCs.category),
    // a seeded note's summary is the one-line result by construction
    result: pick(n.results, 'result', n.fiveCs.contributions, p.source === 'note' ? p.abstract : firstSentence(p.abstract)),
    critique: pick(n.critique, 'critique', n.limitations),
    delta: pick(n.delta, 'delta'),
  };
}

export function venueOf(p: Paper): string {
  if (p.venue) return p.venue;
  if (p.arxivId) return `arXiv${p.primaryCategory ? ` ${p.primaryCategory}` : ''}`;
  return p.source === 'hf' ? 'HF Papers' : '';
}

export function matrixRows(papers: Paper[]): MatrixRow[] {
  return papers.map((p) => ({
    id: p.id,
    bibKey: p.bibKey,
    title: p.title,
    rqIds: p.rqIds,
    status: p.status,
    year: paperYear(p),
    venue: venueOf(p),
    ...deriveNote(p),
  }));
}

const STATUS_RANK: Record<Paper['status'], number> = { done: 0, pass3: 1, pass2: 2, pass1: 3, inbox: 4, dropped: 5 };

export function cellValue(r: MatrixRow, k: MatrixKey): string {
  switch (k) {
    case 'rqs':
      return r.rqIds.map((x) => x.toUpperCase()).sort().join(' ');
    case 'status':
      return STATUS_SHORT[r.status];
    case 'method':
    case 'result':
    case 'critique':
    case 'delta':
      return r[k].text;
    default:
      return r[k];
  }
}

export function sortRows(rows: MatrixRow[], key: MatrixKey, dir: 1 | -1): MatrixRow[] {
  const cmp = (a: MatrixRow, b: MatrixRow) => {
    if (key === 'status') return STATUS_RANK[a.status] - STATUS_RANK[b.status];
    const x = cellValue(a, key);
    const y = cellValue(b, key);
    // empty cells sink whichever way the column is sorted
    if (!x !== !y) return !x ? 1 * dir : -1 * dir;
    return x.localeCompare(y, undefined, { numeric: true, sensitivity: 'base' });
  };
  return [...rows].sort((a, b) => cmp(a, b) * dir || a.title.localeCompare(b.title));
}

export const truncate = (s: string, n: number) => (s.length <= n ? s : s.slice(0, n - 1).trimEnd() + '…');

/* ───────────────────────── exports ───────────────────────── */

const mdCell = (s: string) => s.replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim() || '—';

/** GitHub-flavoured Markdown table. Long cells are clipped to keep it readable. */
export function matrixMarkdown(rows: MatrixRow[], clip = 220): string {
  const head = `| ${MATRIX_COLS.map((c) => c.label).join(' | ')} |`;
  const rule = `| ${MATRIX_COLS.map((c) => (c.key === 'year' ? '---:' : '---')).join(' | ')} |`;
  const body = rows.map(
    (r) =>
      `| ${MATRIX_COLS.map((c) => {
        const v = cellValue(r, c.key);
        return mdCell(c.key === 'title' ? `${v} [@${r.bibKey}]` : truncate(v, clip));
      }).join(' | ')} |`,
  );
  return [head, rule, ...body].join('\n') + '\n';
}

const csvCell = (s: string) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/** RFC 4180 CSV, full cell text, plus id and bibkey columns for joins. */
export function matrixCsv(rows: MatrixRow[]): string {
  const head = ['id', 'bibkey', ...MATRIX_COLS.map((c) => c.label), 'derived_from_freeform'];
  const lines = rows.map((r) =>
    [
      r.id,
      r.bibKey,
      ...MATRIX_COLS.map((c) => cellValue(r, c.key)),
      (['method', 'result', 'critique', 'delta'] as const).filter((k) => r[k].derived).join(' '),
    ]
      .map(csvCell)
      .join(','),
  );
  return [head.map(csvCell).join(','), ...lines].join('\r\n') + '\r\n';
}

/** Fixed-width text table for the terminal. */
export function matrixText(rows: MatrixRow[], width = 118): string {
  const cols: { key: MatrixKey; w: number }[] = [
    { key: 'title', w: 34 },
    { key: 'rqs', w: 9 },
    { key: 'status', w: 7 },
    { key: 'year', w: 4 },
    { key: 'result', w: 0 },
  ];
  const fixed = cols.reduce((a, c) => a + c.w + 2, 0);
  cols[cols.length - 1].w = Math.max(20, width - fixed);
  const pad = (s: string, n: number) => {
    const t = truncate(s.replace(/\s+/g, ' '), n);
    return t + ' '.repeat(Math.max(0, n - t.length));
  };
  const label = (k: MatrixKey) => MATRIX_COLS.find((c) => c.key === k)!.label.toUpperCase();
  const line = (cells: string[]) => cells.map((c, i) => pad(c, cols[i].w)).join('  ').trimEnd();
  return [
    line(cols.map((c) => label(c.key))),
    line(cols.map((c) => '-'.repeat(c.w))),
    ...rows.map((r) => line(cols.map((c) => cellValue(r, c.key) || '—'))),
  ].join('\n');
}

/**
 * A related-work draft grouped by research question: one paragraph per paper
 * with its one-line result and his critique, cited by BibTeX key. A draft to
 * rewrite, not prose to paste.
 */
export function relatedWorkMarkdown(rows: MatrixRow[], rqs: ResearchQuestion[], titleOf?: (id: string) => string): string {
  const out: string[] = ['# Related work (draft)', '', `_Generated from the literature matrix on ${new Date().toISOString().slice(0, 10)}. Citations are BibTeX keys; export the .bib alongside._`, ''];
  const live = rows.filter((r) => r.status !== 'dropped');
  const groups: { title: string; rows: MatrixRow[] }[] = rqs.map((q) => ({
    title: `${q.id.toUpperCase()} — ${q.question}`,
    rows: live.filter((r) => r.rqIds.includes(q.id)),
  }));
  groups.push({ title: 'Not yet linked to a research question', rows: live.filter((r) => r.rqIds.length === 0) });
  for (const g of groups) {
    if (!g.rows.length) continue;
    out.push(`## ${g.title}`, '');
    for (const r of sortRows(g.rows, 'status', 1)) {
      const title = titleOf?.(r.id) ?? r.title;
      const result = r.result.text ? truncate(r.result.text, 320) : 'Result not yet noted.';
      const crit = r.critique.text ? ` **Critique:** ${truncate(r.critique.text, 320)}` : '';
      const delta = r.delta.text ? ` **Left open:** ${truncate(r.delta.text, 240)}` : '';
      const where = [r.venue, r.year].filter(Boolean).join(', ');
      out.push(`- **${title}** [@${r.bibKey}]${where ? ` (${where})` : ''}. ${result}${crit}${delta}`, '');
    }
  }
  if (out.length <= 4) out.push('_No papers yet._', '');
  return out.join('\n').trimEnd() + '\n';
}
