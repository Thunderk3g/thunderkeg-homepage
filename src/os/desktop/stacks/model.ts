/**
 * Stacks — the desktop wallpaper as a model of the work.
 *
 * Every column is one real item: a skill from the Learning OS, a paper from the
 * Research library, or a published post. Height is depth (knowledge state for
 * skills, reading pass for papers, length for posts), so the skyline rises as
 * evidence accumulates. Nothing here is decorative data.
 *
 * Pure functions only: the canvas in Stacks.tsx draws what this returns.
 */
import type { Entry } from '@/content/writing';
import type { LearningState, Skill } from '@/learning/types';
import { STATE_ORDER } from '@/learning/types';
import type { Card, Paper, ResearchQuestion } from '@/research/types';
import { STATUS_SHORT } from '@/research/types';
import { relevance } from '@/research/rank';

export type StackKind = 'skill' | 'paper' | 'post';

export interface Column {
  id: string;
  kind: StackKind;
  title: string;
  /** cubes in the stack, 0–5; 0 draws as an empty lot */
  level: number;
  /** skills only: passed (true) or failed (false) the AI-free check; null = untested */
  proven: boolean | null;
  /** something is due today: a skill review or a paper's recall cards */
  due: boolean;
  /** the one skill being studied right now */
  current: boolean;
  /** the paper most recently moved along, among those still being read */
  reading: boolean;
  /** touched in the last week (a skill practised, a paper moved on) or a post from the last month */
  recent: boolean;
  /** where the stack is headed, drawn as an outline above the current skill; 0 = none */
  target: number;
  /** one-line state for the hover readout */
  state: string;
  detail: string;
  open: { app: string; args: Record<string, unknown> };
  /** grid position, filled by layout() */
  gx: number;
  gy: number;
}

export interface District {
  id: string;
  label: string;
  wing: 'learning' | 'research';
  columns: Column[];
  gx: number;
  gy: number;
  w: number;
  h: number;
}

export interface City {
  districts: District[];
  /** grid extent */
  w: number;
  h: number;
  totals: { skills: number; proven: number; papers: number; posts: number; due: number; recent: number };
}

const PAPER_LEVEL: Record<string, number> = { inbox: 1, pass1: 2, pass2: 3, pass3: 4, done: 5 };

const isoDay = () => new Date().toISOString().slice(0, 10);
const daysAgo = (iso: string | undefined, today: string) =>
  iso ? Math.round((Date.parse(today) - Date.parse(iso.slice(0, 10))) / 86400000) : Infinity;
const ago = (d: number) => (d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`);
const INTERNALIZED = STATE_ORDER.indexOf('INTERNALIZED');

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);

function skillColumn(s: Skill, currentId: string, today: string): Column {
  const level = STATE_ORDER.indexOf(s.state);
  const practised = daysAgo(s.lastPracticed, today);
  const current = s.id === currentId;
  return {
    id: 'skill:' + s.id,
    kind: 'skill',
    title: s.name,
    level: Math.max(0, level),
    proven: s.independent,
    due: !!s.nextReview && s.nextReview <= today,
    current,
    reading: false,
    recent: practised <= 7,
    target: current && level < INTERNALIZED ? INTERNALIZED : 0,
    state:
      s.state.toLowerCase() +
      (s.independent === true ? ', proven without AI' : s.independent === false ? ', not yet proven without AI' : ', untested without AI') +
      (practised < 400 ? `, practised ${ago(practised)}` : ''),
    detail: s.objective,
    open: { app: 'learning', args: { skillId: s.id } },
    gx: 0,
    gy: 0,
  };
}

function paperColumn(p: Paper, dueByPaper: Map<string, number>, today: string): Column {
  const due = dueByPaper.get(p.id) ?? 0;
  return {
    id: 'paper:' + p.id,
    kind: 'paper',
    title: p.title,
    level: PAPER_LEVEL[p.status] ?? 1,
    proven: null,
    due: due > 0,
    current: false,
    reading: false,
    recent: daysAgo(p.statusChangedAt, today) <= 7,
    target: 0,
    state: STATUS_SHORT[p.status] + (due ? `, ${due} recall card${due === 1 ? '' : 's'} due` : ''),
    detail: clip(p.authors.slice(0, 3).join(', ') + (p.authors.length > 3 ? ' et al.' : '') + (p.venue ? ` — ${p.venue}` : ''), 110),
    open: { app: 'research', args: { paperId: p.id } },
    gx: 0,
    gy: 0,
  };
}

function postColumn(e: Entry, today: string): Column {
  const words = e.body.split(/\s+/).length;
  return {
    id: 'post:' + e.slug,
    kind: 'post',
    title: e.title,
    level: Math.max(1, Math.min(5, Math.round(words / 350))),
    proven: null,
    due: false,
    current: false,
    reading: false,
    recent: daysAgo(e.date, today) <= 30,
    target: 0,
    state: `published ${e.date}, ${Math.max(1, Math.round(words / 230))} min read`,
    detail: clip(e.summary, 130),
    open: { app: 'writing', args: { slug: e.slug } },
    gx: 0,
    gy: 0,
  };
}

/** The research question a post bears on, by the same keyword test the library uses. */
function rqForPost(e: Entry, rqs: ResearchQuestion[]): string | undefined {
  const text = { title: `${e.title} ${e.tags.join(' ')}`, abstract: `${e.summary} ${e.body.slice(0, 3000)}` };
  let best: { id: string; score: number } | undefined;
  for (const q of rqs) {
    const r = relevance(text, q.keywords);
    if (r.matched.length >= 2 && (!best || r.score > best.score)) best = { id: q.id, score: r.score };
  }
  return best?.id;
}

export interface CityInput {
  learning: Pick<LearningState, 'skills' | 'currentSkillId'>;
  papers: Paper[];
  cards: Card[];
  rqs: ResearchQuestion[];
  entries: Entry[];
}

export function buildCity(input: CityInput): City {
  const today = isoDay();
  const districts: District[] = [];
  const mk = (id: string, label: string, wing: District['wing']): District => ({
    id, label, wing, columns: [], gx: 0, gy: 0, w: 0, h: 0,
  });

  // learning wing: one district per domain
  const byDomain = new Map<string, District>();
  for (const s of input.learning.skills) {
    let d = byDomain.get(s.domain);
    if (!d) {
      d = mk('dom:' + s.domain, s.domain, 'learning');
      byDomain.set(s.domain, d);
    }
    d.columns.push(skillColumn(s, input.learning.currentSkillId, today));
  }
  districts.push(...byDomain.values());

  // research wing: one district per research question that has anything filed under it
  const dueByPaper = new Map<string, number>();
  for (const c of input.cards) {
    if (!c.suspended && c.due <= today) dueByPaper.set(c.paperId, (dueByPaper.get(c.paperId) ?? 0) + 1);
  }
  const byRq = new Map<string, District>();
  const rqDistrict = (rqId: string | undefined): District => {
    const key = rqId ?? '';
    let d = byRq.get(key);
    if (!d) {
      const q = input.rqs.find((r) => r.id === rqId);
      d = mk('rq:' + key, q ? q.short : 'Unfiled reading', 'research');
      byRq.set(key, d);
    }
    return d;
  };
  for (const p of input.papers) {
    if (p.status === 'dropped') continue;
    rqDistrict(p.rqIds[0]).columns.push(paperColumn(p, dueByPaper, today));
  }
  for (const e of input.entries) {
    if (e.kind !== 'post') continue;
    rqDistrict(rqForPost(e, input.rqs)).columns.push(postColumn(e, today));
  }
  districts.push(...byRq.values());

  // "reading now": the in-progress paper whose status moved most recently
  const inProgress = input.papers
    .filter((p) => p.status === 'pass1' || p.status === 'pass2' || p.status === 'pass3')
    .sort((a, b) => b.statusChangedAt.localeCompare(a.statusChangedAt))[0];
  if (inProgress) {
    const col = districts.flatMap((d) => d.columns).find((c) => c.id === 'paper:' + inProgress.id);
    if (col) col.reading = true;
  }

  layout(districts);

  const cols = districts.flatMap((d) => d.columns);
  const skills = cols.filter((c) => c.kind === 'skill');
  return {
    districts,
    w: Math.max(0, ...districts.map((d) => d.gx + d.w)),
    h: Math.max(0, ...districts.map((d) => d.gy + d.h)),
    totals: {
      skills: skills.length,
      proven: skills.filter((c) => c.proven === true).length,
      papers: cols.filter((c) => c.kind === 'paper').length,
      posts: cols.filter((c) => c.kind === 'post').length,
      due: cols.filter((c) => c.due).length,
      recent: cols.filter((c) => c.recent).length,
    },
  };
}

/**
 * Shelf-pack the districts onto the grid. Research sits on the near shelves
 * (it is what a visitor came for), learning behind it; inside a district the
 * tall stacks go to the back so nothing hides.
 *
 * Names are painted on each district's front row, so nothing may stand in
 * front of that row: districts on a shelf share a front edge, and the street
 * between shelves is wide enough (SHELF_GAP cells) that a full five-cube
 * stack on the next shelf, 2.2 cells tall on screen, cannot reach it.
 */
const SHELF_GAP = 2;
function layout(districts: District[]) {
  for (const d of districts) {
    const n = d.columns.length;
    d.w = Math.max(3, Math.ceil(Math.sqrt(n)));
    // one extra row at the front is kept clear for the district's name
    d.h = Math.max(1, Math.ceil(n / d.w)) + 1;
  }
  const area = districts.reduce((a, d) => a + (d.w + 1) * (d.h + 1), 0);
  const shelfW = Math.max(8, Math.ceil(Math.sqrt(area) * 0.8));

  const order = [
    ...districts.filter((d) => d.wing === 'learning').sort((a, b) => b.h - a.h || b.columns.length - a.columns.length),
    ...districts.filter((d) => d.wing === 'research').sort((a, b) => b.h - a.h || b.columns.length - a.columns.length),
  ];

  // cut the order into shelves
  const shelves: District[][] = [];
  let x = 0;
  let wing: District['wing'] | undefined;
  for (const d of order) {
    if (!shelves.length || x + d.w > shelfW || d.wing !== wing) {
      shelves.push([]);
      x = 0;
    }
    wing = d.wing;
    shelves[shelves.length - 1].push(d);
    x += d.w + 1;
  }

  let y = 0;
  for (let i = 0; i < shelves.length; i++) {
    const shelf = shelves[i];
    const shelfH = Math.max(...shelf.map((d) => d.h));
    let sx = 0;
    for (const d of shelf) {
      d.gx = sx;
      d.gy = y + shelfH - d.h; // front edges line up
      sx += d.w + 1;
    }
    const next = shelves[i + 1];
    y += shelfH + SHELF_GAP + (next && next[0].wing !== shelf[0].wing ? 1 : 0);
  }

  for (const d of order) {
    const sorted = [...d.columns].sort((a, b) => b.level - a.level || a.title.localeCompare(b.title));
    sorted.forEach((c, i) => {
      c.gx = d.gx + (i % d.w);
      c.gy = d.gy + Math.floor(i / d.w);
    });
    d.columns = sorted;
  }
}
