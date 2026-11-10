import type { Card, Pass, Paper, ReadStatus, ResearchState } from './types';
import { addDays, isoDay } from './schedule';

/**
 * The Today tab, as data: what is due, what to read next and for how long,
 * how the week is going, and which research questions have no reading behind
 * them. Pure, so the terminal `today` prints exactly what the app shows.
 */

export const PASSES: Pass[] = ['pass1', 'pass2', 'pass3'];
export const PASS_NAME: Record<Pass, string> = { pass1: 'pass 1', pass2: 'pass 2', pass3: 'pass 3' };
const PASS_VERB: Record<Pass, string> = {
  pass1: 'skim',
  pass2: 'read',
  pass3: 're-derive',
};

/** Columns of the coverage grid, left to right. */
export const COVERAGE_COLS: ReadStatus[] = ['inbox', 'pass1', 'pass2', 'pass3', 'done'];

export interface QueueItem {
  paper: Paper;
  pass: Pass;
  minutes: number;
  /** days since the paper reached this pass */
  waiting: number;
}

export interface DayCell {
  day: string;
  active: boolean;
  reviews: number;
}

export interface CoverageRow {
  rqId: string;
  short: string;
  question: string;
  byStatus: Record<ReadStatus, number>;
  /** papers past pass 1 on this RQ */
  deep: number;
  gap: 'none' | 'thin' | null;
}

export interface StudyPlan {
  today: string;
  due: number;
  dueByPaper: { paperId: string; n: number }[];
  queue: QueueItem[];
  inbox: number;
  minutesQueued: number;
  week: {
    start: string;
    papersDone: number;
    cardsReviewed: number;
    goalPapers: number;
    goalCards: number;
  };
  days: DayCell[];
  streak: number;
  coverage: CoverageRow[];
  next: { text: string; paperId?: string; action: 'review' | 'read' | 'triage' | 'find' | 'rest' };
}

const dayOf = (iso: string) => (iso ?? '').slice(0, 10);

/** Monday of the ISO week holding `day` (UTC, like isoDay()). */
export function weekStart(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // Mon = 0
  return addDays(day, -dow);
}

const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

type PlanInput = Pick<ResearchState, 'papers' | 'cards' | 'log' | 'rqs' | 'prefs' | 'activeDays'>;

export function studyPlan(s: PlanInput, today = isoDay()): StudyPlan {
  const budgets = s.prefs.budgets;
  const live = s.cards.filter((c: Card) => !c.suspended && c.due <= today);
  const dueMap = new Map<string, number>();
  for (const c of live) dueMap.set(c.paperId, (dueMap.get(c.paperId) ?? 0) + 1);

  // oldest-waiting first within a pass: a paper that has sat at pass 2 for a
  // fortnight is the one about to be forgotten
  const queue: QueueItem[] = PASSES.flatMap((pass) =>
    s.papers
      .filter((p) => p.status === pass)
      .map((p) => ({ paper: p, pass, minutes: budgets[pass], waiting: Math.max(0, daysBetween(dayOf(p.statusChangedAt), today)) }))
      .sort((a, b) => b.waiting - a.waiting || a.paper.title.localeCompare(b.paper.title)),
  );

  const ws = weekStart(today);
  const papersDone = s.papers.filter((p) => p.status === 'done' && dayOf(p.statusChangedAt) >= ws).length;
  const cardsReviewed = s.log.filter((l) => dayOf(l.date) >= ws).length;

  const reviewDays = new Map<string, number>();
  for (const l of s.log) reviewDays.set(dayOf(l.date), (reviewDays.get(dayOf(l.date)) ?? 0) + 1);
  const active = new Set([...s.activeDays, ...reviewDays.keys()]);
  const days: DayCell[] = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(today, i - 6);
    return { day, active: active.has(day), reviews: reviewDays.get(day) ?? 0 };
  });
  // a streak survives a today that has not happened yet
  let streak = 0;
  for (let d = active.has(today) ? today : addDays(today, -1); active.has(d); d = addDays(d, -1)) streak++;

  const coverage: CoverageRow[] = s.rqs.map((q) => {
    const on = s.papers.filter((p) => p.rqIds.includes(q.id));
    const byStatus = Object.fromEntries(
      (['inbox', 'pass1', 'pass2', 'pass3', 'done', 'dropped'] as ReadStatus[]).map((st) => [st, on.filter((p) => p.status === st).length]),
    ) as Record<ReadStatus, number>;
    const deep = byStatus.pass2 + byStatus.pass3 + byStatus.done;
    const total = on.length - byStatus.dropped;
    return {
      rqId: q.id,
      short: q.short,
      question: q.question,
      byStatus,
      deep,
      gap: total === 0 ? 'none' : deep === 0 ? 'thin' : null,
    };
  });

  const inbox = s.papers.filter((p) => p.status === 'inbox').length;
  const next = nextAction({ due: live.length, queue, inbox, coverage, budgets });

  return {
    today,
    due: live.length,
    dueByPaper: [...dueMap].map(([paperId, n]) => ({ paperId, n })).sort((a, b) => b.n - a.n),
    queue,
    inbox,
    minutesQueued: queue.reduce((a, q) => a + q.minutes, 0),
    week: { start: ws, papersDone, cardsReviewed, goalPapers: s.prefs.weekly.papers, goalCards: s.prefs.weekly.cards },
    days,
    streak,
    coverage,
    next,
  };
}

export const fmtMinutes = (m: number) => (m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m / 60} h`);

const shortTitle = (t: string) => {
  const head = t.split(/\s[—–:-]\s|:\s/)[0].trim();
  return head.length <= 60 ? head : head.slice(0, 57).trimEnd() + '…';
};

function nextAction(x: {
  due: number;
  queue: QueueItem[];
  inbox: number;
  coverage: CoverageRow[];
  budgets: Record<Pass, number>;
}): StudyPlan['next'] {
  // recall first: it is short, and due cards decay while you read
  if (x.due > 0) {
    return { action: 'review', text: `${x.due} card${x.due === 1 ? '' : 's'} due — review first (about ${Math.max(2, Math.round(x.due * 0.5))} min), then read.` };
  }
  // deepest pass first: finishing beats starting
  for (const pass of ['pass3', 'pass2', 'pass1'] as Pass[]) {
    const at = x.queue.filter((q) => q.pass === pass);
    if (!at.length) continue;
    const first = at[0];
    const n = at.length;
    return {
      action: 'read',
      paperId: first.paper.id,
      text: `${n} paper${n === 1 ? '' : 's'} waiting for ${PASS_NAME[pass]} — start with ${shortTitle(first.paper.title)}, ${fmtMinutes(x.budgets[pass])} to ${PASS_VERB[pass]}.`,
    };
  }
  if (x.inbox > 0) {
    return { action: 'triage', text: `Queue is empty; ${x.inbox} paper${x.inbox === 1 ? '' : 's'} in the inbox — give one a ${fmtMinutes(x.budgets.pass1)} first pass.` };
  }
  const gap = x.coverage.find((c) => c.gap === 'none') ?? x.coverage.find((c) => c.gap === 'thin');
  if (gap) return { action: 'find', text: `Nothing queued. ${gap.short} has ${gap.gap === 'none' ? 'no papers' : 'nothing past a skim'} — find one in the Feed.` };
  return { action: 'rest', text: 'Queue clear, cards done. Write up a delta, or rest.' };
}

/** Plain-text study plan for the terminal. */
export function planText(plan: StudyPlan, titleOf: (id: string) => string): string {
  const pad = (s: string, n: number) => (s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length));
  const clip = (s: string, n: number) => (s.length <= n ? s : s.slice(0, n - 1) + '…');
  const bar = (n: number, goal: number, w = 20) => {
    const f = goal > 0 ? Math.min(w, Math.round((n / goal) * w)) : 0;
    return '█'.repeat(f) + '░'.repeat(w - f);
  };
  const out: string[] = [`Study plan · ${plan.today}`, '', `next: ${plan.next.text}`, ''];
  out.push(`due cards   ${plan.due}${plan.due ? '   (research review)' : ''}`);
  for (const d of plan.dueByPaper.slice(0, 3)) out.push(`  ${String(d.n).padStart(3)}  ${clip(titleOf(d.paperId), 64)}`);
  out.push('', `reading queue · ${plan.queue.length} paper(s) · ${fmtMinutes(plan.minutesQueued)} budgeted`);
  if (!plan.queue.length) out.push('  (empty — move a paper to pass 1)');
  for (const q of plan.queue) {
    out.push(`  ${pad(PASS_NAME[q.pass], 7)} ${pad(fmtMinutes(q.minutes), 8)} ${q.waiting ? pad(`${q.waiting}d`, 5) : '     '}${clip(q.paper.title, 58)}`);
  }
  const w = plan.week;
  out.push(
    '',
    `week of ${w.start}`,
    `  papers finished  ${bar(w.papersDone, w.goalPapers)}  ${w.papersDone}/${w.goalPapers}`,
    `  cards reviewed   ${bar(w.cardsReviewed, w.goalCards)}  ${w.cardsReviewed}/${w.goalCards}`,
    `  last 7 days      ${plan.days.map((d) => (d.active ? '■' : '·')).join(' ')}   streak ${plan.streak}d`,
    '',
    `coverage   ${COVERAGE_COLS.map((c) => pad(c === 'inbox' ? 'inbox' : c === 'done' ? 'done' : c.replace('pass', 'p'), 6)).join('')}`,
  );
  for (const r of plan.coverage) {
    out.push(
      `  ${pad(r.rqId.toUpperCase(), 8)} ${COVERAGE_COLS.map((c) => pad(String(r.byStatus[c] || '·'), 6)).join('')}${r.gap === 'none' ? ' ← no papers' : r.gap === 'thin' ? ' ← nothing past a skim' : ''}`,
    );
  }
  return out.join('\n');
}
