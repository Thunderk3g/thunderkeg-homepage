/**
 * Stacks: the board as data.
 *
 * One rule holds everywhere: a cube is one dated thing I did, a stack is one
 * subject, a lane is one field. A stack's cubes are in the order they
 * happened, oldest at the bottom, so its colours read as how I came to know
 * the subject: studied, built, measured, wrote.
 *
 * Cubes come from three places and are merged here:
 *   - src/data/record.ts      work, projects and measurements
 *   - content/*.md            posts (wrote) and paper notes (studied)
 *   - the Research library    papers from Pass 1 on (studied); the inbox is
 *                             drawn as outlines waiting on top of a stack
 *
 * Pure functions only. The canvas (os/desktop/stacks), the welcome card, the
 * command palette and the Stacks app all draw what buildBoard() returns.
 */
import type { Entry } from '@/content/writing';
import {
  FIELDS,
  KINDS,
  RECORD,
  SUBJECTS,
  type CubeKind,
  type Field,
  type RecordEntry,
  type Subject,
} from '@/data/record';
import type { Card, Paper, ResearchQuestion } from '@/research/types';
import { STATUS_SHORT } from '@/research/types';
import { relevance } from '@/research/rank';

export type { CubeKind } from '@/data/record';

export interface Cube {
  id: string;
  kind: CubeKind;
  title: string;
  /** as written to a reader: '2022–25', '2026', 'Aug 2026' */
  when: string;
  /** the year it joins the board */
  year: number;
  /** months since year 0; orders the cubes of a stack */
  at: number;
  /** added within the last month */
  recent: boolean;
  /** a second line for the readout: authors, reading pass */
  detail?: string;
  /** opens inside the desktop: a paper in Research, a post in Writing */
  open?: { app: string; args: Record<string, unknown> };
  /** a public page outside it */
  href?: string;
}

export interface Stack {
  subject: Subject;
  field: Field;
  /** oldest first */
  cubes: Cube[];
  /** saved to the Research inbox, not yet read */
  queued: Cube[];
  /** recall cards due today on this stack's papers */
  due: number;
  /** holds the paper most recently moved along, among those still being read */
  reading: boolean;
  /** cell centre on the board grid, filled by layout() */
  gx: number;
  gy: number;
}

export interface Lane {
  field: Field;
  /** tallest first: back row to front row */
  stacks: Stack[];
  /** rows of two this lane fills */
  rows: number;
  /** footprint on the grid: x runs along the lane, y across the lanes */
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export interface Board {
  lanes: Lane[];
  stacks: Stack[];
  /** grid extent */
  w: number;
  h: number;
  /** where every lane's name plate starts and how long it is, along x */
  apron: { x0: number; x1: number };
  /** tallest stack, in cubes, queued outlines included */
  tallest: number;
  /** years in which anything was added, with how much */
  years: { year: number; count: number }[];
  totals: {
    cubes: number;
    subjects: number;
    fields: number;
    byKind: Record<CubeKind, number>;
    papers: number;
    reading: number;
    posts: number;
    queued: number;
    due: number;
    recent: number;
  };
}

/* ───────────────────────── dates ───────────────────────── */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 'YYYY', 'YYYY-MM', 'YYYY-MM-DD…' or a range 'YYYY–YY' (en dash). A range counts from its first year. */
export function parseWhen(when: string): { year: number; at: number; label: string } {
  const m = /^(\d{4})(?:-(\d{2}))?/.exec(when);
  if (!m) return { year: 0, at: 0, label: when };
  const year = +m[1];
  const range = /^\d{4}\s*–\s*\d{2,4}$/.test(when);
  const month = !range && m[2] ? +m[2] : 0;
  return {
    year,
    at: year * 12 + Math.max(0, month - 1) + (month ? 0.5 : 0),
    label: range ? when : month ? `${MONTHS[month - 1]} ${year}` : String(year),
  };
}

const monthsNow = () => {
  const d = new Date();
  return d.getUTCFullYear() * 12 + d.getUTCMonth() + 0.5;
};
const isoDay = () => new Date().toISOString().slice(0, 10);
const daysSince = (iso: string | undefined) =>
  iso ? (Date.now() - Date.parse(iso)) / 86400000 : Infinity;

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);

/* ───────────────────────── routing ───────────────────────── */

const subjectById = new Map(SUBJECTS.map((s) => [s.id, s]));
const fieldById = new Map(FIELDS.map((f) => [f.id, f]));

/**
 * The subject an untagged paper or post belongs under: a linked research
 * question counts for most, then the subject's own keywords. Two keyword hits
 * are needed without a question, the same bar the Research library uses.
 */
function route(text: { title: string; abstract: string }, rqIds: string[]): string | undefined {
  let best: { id: string; score: number } | undefined;
  for (const s of SUBJECTS) {
    const linked = !!s.rqIds?.some((q) => rqIds.includes(q));
    const r = relevance(text, s.keywords);
    if (!linked && r.matched.length < 2) continue;
    const score = r.score + (linked ? 6 : 0);
    if (!best || score > best.score) best = { id: s.id, score };
  }
  return best?.id;
}

const known = (id: string | undefined) => (id && subjectById.has(id) ? id : undefined);

/* ───────────────────────── cubes ───────────────────────── */

function recordCube(r: RecordEntry, i: number, now: number): Cube {
  const w = parseWhen(r.when);
  return {
    id: `rec:${i}`,
    kind: r.kind,
    title: r.title,
    when: w.label,
    year: w.year,
    at: w.at,
    // a year-only date says nothing about this month
    recent: /^\d{4}-\d{2}/.test(r.when) && now - w.at <= 1,
    href: r.href,
  };
}

function postCube(e: Entry): Cube {
  const w = parseWhen(e.date);
  return {
    id: 'post:' + e.slug,
    kind: 'wrote',
    title: e.title,
    when: w.label,
    year: w.year,
    at: w.at,
    recent: daysSince(e.date) <= 31,
    detail: 'Post' + (e.summary ? ': ' + clip(e.summary, 110) : ''),
    open: { app: 'writing', args: { slug: e.slug } },
    href: '/writing/' + e.slug,
  };
}

const NOTE_STATE = (status: string | undefined) =>
  status === 'reading' ? 'being read' : /^refer/.test(status ?? '') ? 'reference' : 'read';

/** A published paper note. `paper` is the same paper in the visitor's library, when it is there. */
function noteCube(e: Entry, paper: Paper | undefined): Cube {
  const w = parseWhen(e.date);
  return {
    id: 'note:' + e.slug,
    kind: 'studied',
    title: e.title,
    when: w.label,
    year: w.year,
    at: w.at,
    recent: daysSince(paper?.statusChangedAt ?? e.date) <= 31,
    detail: 'Paper, ' + (paper ? STATUS_SHORT[paper.status] : NOTE_STATE(e.status)) + (e.authors ? ' · ' + clip(e.authors, 70) : ''),
    open: paper ? { app: 'research', args: { paperId: paper.id } } : { app: 'writing', args: { slug: e.slug } },
    href: '/writing/' + e.slug,
  };
}

function paperCube(p: Paper): Cube {
  const iso = p.status === 'inbox' ? p.savedAt : p.statusChangedAt;
  const w = parseWhen(iso);
  const who = p.authors.slice(0, 2).join(', ') + (p.authors.length > 2 ? ' et al.' : '');
  return {
    id: 'paper:' + p.id,
    kind: 'studied',
    title: p.title,
    when: w.label,
    year: w.year,
    at: w.at,
    recent: daysSince(iso) <= 31,
    detail: 'Paper, ' + STATUS_SHORT[p.status] + (who ? ' · ' + clip(who, 70) : ''),
    open: { app: 'research', args: { paperId: p.id } },
  };
}

/* ───────────────────────── the board ───────────────────────── */

export interface BoardInput {
  entries: Entry[];
  papers: Paper[];
  cards: Card[];
  rqs: ResearchQuestion[];
}

/** Lane width in cells, the street between lanes, and the name plate in front of each lane. */
const LANE_W = 2;
const STREET = 0.7;
const APRON = 2.15;
/** A stack never draws taller than this many cubes; past it the cubes thin out instead. */
export const MAX_CUBES = 7;

export function buildBoard(input: BoardInput): Board {
  const now = monthsNow();
  const today = isoDay();

  const stacks = new Map<string, Stack>();
  for (const s of SUBJECTS) {
    stacks.set(s.id, {
      subject: s,
      field: fieldById.get(s.field) ?? FIELDS[0],
      cubes: [],
      queued: [],
      due: 0,
      reading: false,
      gx: 0,
      gy: 0,
    });
  }
  const put = (subjectId: string | undefined, cube: Cube, queued = false) => {
    const st = stacks.get(subjectId ?? '') ?? stacks.get('wider-reading');
    if (!st) return undefined;
    (queued ? st.queued : st.cubes).push(cube);
    return st;
  };

  RECORD.forEach((r, i) => put(known(r.subject), recordCube(r, i, now)));

  const dueByPaper = new Map<string, number>();
  for (const c of input.cards) {
    if (!c.suspended && c.due <= today) dueByPaper.set(c.paperId, (dueByPaper.get(c.paperId) ?? 0) + 1);
  }
  const inProgress = input.papers
    .filter((p) => p.status === 'pass1' || p.status === 'pass2' || p.status === 'pass3')
    .sort((a, b) => b.statusChangedAt.localeCompare(a.statusChangedAt))[0];
  const landed = (st: Stack | undefined, p: Paper | undefined) => {
    if (!st || !p) return;
    st.due += dueByPaper.get(p.id) ?? 0;
    if (p.id === inProgress?.id) st.reading = true;
  };

  // published posts and paper notes
  const bySlug = new Map(input.papers.filter((p) => p.contentSlug).map((p) => [p.contentSlug!, p]));
  const noted = new Set<string>();
  let posts = 0;
  for (const en of input.entries) {
    const text = { title: `${en.title} ${en.tags.join(' ')}`, abstract: `${en.summary} ${en.body.slice(0, 3000)}` };
    if (en.kind === 'post') {
      posts++;
      put(known(en.stack) ?? route(text, []) ?? 'research-practice', postCube(en));
    } else {
      const paper = bySlug.get(en.slug);
      if (paper) noted.add(paper.id);
      landed(put(known(en.stack) ?? route(text, paper?.rqIds ?? []), noteCube(en, paper)), paper);
    }
  }

  // the rest of the library: read papers are cubes, the inbox waits on top
  let reading = 0;
  for (const p of input.papers) {
    if (p.status === 'pass1' || p.status === 'pass2' || p.status === 'pass3') reading++;
    if (p.status === 'dropped' || noted.has(p.id)) continue;
    const text = { title: `${p.title} ${p.tags.join(' ')}`, abstract: p.abstract };
    landed(put(route(text, p.rqIds), paperCube(p), p.status === 'inbox'), p);
  }

  for (const st of stacks.values()) st.cubes.sort((a, b) => a.at - b.at);

  const live = [...stacks.values()].filter((s) => !s.subject.hideEmpty || s.cubes.length || s.queued.length);
  const { lanes, w, h, apron } = layout(live);

  const cubes = live.flatMap((s) => s.cubes);
  const perYear = new Map<number, number>();
  for (const c of cubes) perYear.set(c.year, (perYear.get(c.year) ?? 0) + 1);
  const byKind = Object.fromEntries(KINDS.map((k) => [k, cubes.filter((c) => c.kind === k).length])) as Record<CubeKind, number>;

  return {
    lanes,
    stacks: lanes.flatMap((l) => l.stacks),
    w,
    h,
    apron,
    tallest: Math.max(1, ...live.map((s) => Math.min(MAX_CUBES, s.cubes.length) + Math.min(2, s.queued.length))),
    years: [...perYear].map(([year, count]) => ({ year, count })).sort((a, b) => a.year - b.year),
    totals: {
      cubes: cubes.length,
      subjects: live.filter((s) => s.cubes.length).length,
      fields: lanes.length,
      byKind,
      papers: cubes.filter((c) => c.id.startsWith('note:') || c.id.startsWith('paper:')).length,
      reading,
      posts,
      queued: live.reduce((n, s) => n + s.queued.length, 0),
      due: live.reduce((n, s) => n + s.due, 0),
      recent: cubes.filter((c) => c.recent).length,
    },
  };
}

/**
 * Lanes lie side by side and every one ends at the same front edge, where its
 * name is painted on a plate of bare floor. Nothing can stand in front of
 * that edge, so no name is ever hidden, however tall the stacks grow. Inside
 * a lane the stacks stand two abreast, tallest at the back, and the lane is
 * only as long as it needs to be.
 *
 * Grid: x runs along a lane (0 is the back), y across the lanes. The first
 * field sits at the largest y, which is the left of the screen.
 */
function layout(stacks: Stack[]) {
  const groups = FIELDS.map((f) => ({ field: f, stacks: stacks.filter((s) => s.field.id === f.id) })).filter(
    (g) => g.stacks.length,
  );
  const rowsOf = (n: number) => Math.ceil(n / LANE_W);
  const maxRows = Math.max(1, ...groups.map((g) => rowsOf(g.stacks.length)));
  const pitch = LANE_W + STREET;

  const lanes: Lane[] = groups.map((g, i) => {
    const sorted = [...g.stacks].sort(
      (a, b) =>
        b.cubes.length - a.cubes.length ||
        b.queued.length - a.queued.length ||
        Number(!!a.subject.following) - Number(!!b.subject.following) ||
        a.subject.name.localeCompare(b.subject.name),
    );
    const rows = rowsOf(sorted.length);
    const y0 = (groups.length - 1 - i) * pitch;
    const back = maxRows - rows;
    sorted.forEach((s, k) => {
      s.gx = back + Math.floor(k / LANE_W) + 0.5;
      s.gy = y0 + (k % LANE_W) + 0.5;
    });
    return { field: g.field, stacks: sorted, rows, x0: back, x1: maxRows + APRON, y0, y1: y0 + LANE_W };
  });

  return {
    lanes,
    w: maxRows + APRON,
    h: groups.length * pitch - STREET,
    apron: { x0: maxRows, x1: maxRows + APRON },
  };
}

/* ───────────────────────── readers ───────────────────────── */

/** How many of a stack's cubes exist as of a year; null means now. */
export function cubesAsOf(stack: Stack, year: number | null): number {
  if (year === null) return stack.cubes.length;
  let n = 0;
  for (const c of stack.cubes) if (c.year <= year) n++;
  return n;
}

export function countsByKind(cubes: Cube[]): { kind: CubeKind; n: number }[] {
  return KINDS.map((kind) => ({ kind, n: cubes.filter((c) => c.kind === kind).length })).filter((k) => k.n);
}

/** The record as plain text, for the assistant's grounding context and the file system. */
export function recordText(board: Board): string {
  const out: string[] = [];
  for (const lane of board.lanes) {
    out.push(`## ${lane.field.name}`);
    for (const s of lane.stacks) {
      if (!s.cubes.length) {
        if (s.subject.following) out.push(`- ${s.subject.name}: following, nothing studied yet`);
        continue;
      }
      out.push(`- ${s.subject.name}`);
      for (const c of s.cubes) out.push(`    ${c.when} · ${c.kind} · ${c.title}`);
    }
    out.push('');
  }
  return out.join('\n').trim();
}
