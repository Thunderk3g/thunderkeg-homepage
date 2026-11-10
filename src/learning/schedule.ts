import { STATE_ORDER, type LearningState, type Outcome, type Review, type Sched, type Skill } from './types';
import { rank } from './priority';

/**
 * The daily loop: what to check today, when to check it again, and whether
 * my predictions about myself can be trusted.
 *
 * Why it is built this way is in docs/learning-os-evidence.md. In short:
 * retrieving from memory beats re-reading; spacing beats cramming; how
 * fluent something feels in the moment is a poor guide to whether it will
 * be there next month; and work done with an AI assistant does not transfer
 * to doing it alone. So the unit here is an unaided check with a prediction
 * made before it and an outcome recorded after it.
 *
 * Pure functions only. The store applies them; Today.tsx draws them.
 */

/* ───────────────────────── scheduling ─────────────────────────
   An expanding interval with an ease factor (SM-2 family), tuned for checks
   that cost 10–30 minutes: a longer first interval than a flashcard gets, a
   quick retry after a failure, and a return to a quarter of the old interval
   once the retry passes. The constants are design judgments, not findings. */

export const FIRST_INTERVAL = 3;
export const FIRST_INTERVAL_HARD = 1;
export const START_EASE = 2.3;
export const MIN_EASE = 1.3;
export const MAX_EASE = 2.8;
export const RETRY_DAYS = 2;
export const MAX_INTERVAL = 180;
/** an assisted pass proves nothing yet: try again, unaided, this soon */
export const ASSISTED_RETRY_DAYS = 2;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export interface ScheduleInput {
  outcome: Outcome;
  /** stated before the attempt, 0–1; null if none was made */
  predicted: number | null;
  assisted: boolean;
}

export interface Scheduled {
  sched: Sched;
  /** days until the next check */
  days: number;
  /** a confident prediction that failed: fluency mistaken for ability */
  illusion: boolean;
  /** a pass I did not expect: treated as a hard one */
  surprised: boolean;
}

/** `fuzz` is a number in [-1, 1]; long intervals move by up to 10% so reviews do not pile onto one day. */
export function schedule(prev: Sched | undefined, input: ScheduleInput, fuzz = 0): Scheduled {
  const base: Sched = prev ?? { interval: 0, ease: START_EASE, lapses: 0 };

  if (input.outcome !== 'fail' && input.assisted) {
    // practice, not proof: nothing about the schedule moves
    return { sched: base, days: ASSISTED_RETRY_DAYS, illusion: false, surprised: false };
  }

  if (input.outcome === 'fail') {
    const illusion = input.predicted !== null && input.predicted >= 0.8;
    const sched: Sched = {
      interval: RETRY_DAYS,
      ease: clamp(base.ease - 0.2, MIN_EASE, MAX_EASE),
      lapses: base.lapses + 1,
      preLapse: base.preLapse ?? base.interval,
      ...(illusion ? { hold: 2 } : base.hold ? { hold: base.hold } : {}),
    };
    return { sched, days: RETRY_DAYS, illusion, surprised: false };
  }

  const surprised = input.outcome === 'pass' && input.predicted !== null && input.predicted <= 0.5;
  const hard = input.outcome === 'hard' || surprised;
  let interval: number;
  let ease = base.ease;
  let hold = base.hold ?? 0;

  if (base.preLapse !== undefined) {
    // the retry after a lapse: come back at a quarter of where it was
    interval = Math.max(RETRY_DAYS, Math.round(base.preLapse * 0.25));
  } else if (base.interval === 0) {
    interval = hard ? FIRST_INTERVAL_HARD : FIRST_INTERVAL;
  } else if (hard) {
    interval = base.interval * 1.3;
    ease = clamp(ease - 0.15, MIN_EASE, MAX_EASE);
  } else if (hold > 0) {
    interval = base.interval; // growth resumes after the owed clean passes
  } else {
    interval = base.interval * ease;
    ease = clamp(ease + 0.05, MIN_EASE, MAX_EASE);
  }
  if (!hard && hold > 0) hold -= 1;

  if (interval >= 10) interval *= 1 + 0.1 * clamp(fuzz, -1, 1);
  interval = clamp(Math.round(interval), 1, MAX_INTERVAL);

  const sched: Sched = { interval, ease: Math.round(ease * 100) / 100, lapses: base.lapses, ...(hold > 0 ? { hold } : {}) };
  return { sched, days: interval, illusion: false, surprised };
}

export const addDays = (iso: string, days: number) => {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export const isoToday = (now = new Date()) => now.toISOString().slice(0, 10);

/* ───────────────────────── promotion ─────────────────────────
   One good day is not a state change. A skill is ready to move up after
   unaided passes on three separate days since it last moved. */

export const PROMOTION_PASSES = 3;

export function unaidedPassDays(reviews: Review[], skill: Skill): string[] {
  const since = skill.stateChangedAt ?? '';
  const days = new Set<string>();
  for (const r of reviews) {
    if (r.skillId === skill.id && !r.assisted && r.outcome !== 'fail' && r.date > since) days.add(r.date);
  }
  return [...days].sort();
}

export function promotable(state: Pick<LearningState, 'skills' | 'reviews'>): Skill[] {
  const top = STATE_ORDER.length - 1;
  return state.skills.filter(
    (s) => STATE_ORDER.indexOf(s.state) < top && unaidedPassDays(state.reviews, s).length >= PROMOTION_PASSES,
  );
}

export const nextState = (s: Skill['state']) => STATE_ORDER[Math.min(STATE_ORDER.length - 1, STATE_ORDER.indexOf(s) + 1)];

/* ───────────────────────── today's queue ───────────────────────── */

export type QueueReason = 'retry' | 'due' | 'first' | 'session';

export interface QueueItem {
  skill: Skill;
  reason: QueueReason;
  kind: 'check' | 'session';
  /** one line: why this, today */
  why: string;
  overdueDays: number;
}

export const MAX_CHECKS_PER_DAY = 3;

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

/** Reorder so neighbouring items come from different domains where the list allows it. */
export function interleave<T extends { skill: Skill }>(items: T[]): T[] {
  const pool = [...items];
  const out: T[] = [];
  while (pool.length) {
    const last = out[out.length - 1]?.skill.domain;
    const i = pool.findIndex((x) => x.skill.domain !== last);
    out.push(pool.splice(i === -1 ? 0 : i, 1)[0]);
  }
  return out;
}

export interface TodayQueue {
  items: QueueItem[];
  /** checks due today beyond the daily cap */
  deferred: number;
  /** checks already recorded today */
  doneToday: Review[];
}

export function todayQueue(state: LearningState, today = isoToday()): TodayQueue {
  const doneToday = state.reviews.filter((r) => r.date === today);
  const checkedToday = new Set(doneToday.map((r) => r.skillId));
  const ranked = rank(state);
  const order = new Map(ranked.map((r, i) => [r.skill.id, i]));
  const byPriority = (a: Skill, b: Skill) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0);

  const dueSkills = state.skills.filter((s) => s.nextReview && s.nextReview <= today && !checkedToday.has(s.id));
  const retries: QueueItem[] = dueSkills
    .filter((s) => s.sched?.preLapse !== undefined)
    .sort(byPriority)
    .map((skill) => ({
      skill,
      reason: 'retry',
      kind: 'check',
      why: 'It did not pass last time. A second attempt within days is where most of the gain is.',
      overdueDays: daysBetween(skill.nextReview!, today),
    }));
  const due: QueueItem[] = dueSkills
    .filter((s) => s.sched?.preLapse === undefined)
    .sort((a, b) => a.nextReview!.localeCompare(b.nextReview!) || byPriority(a, b))
    .map((skill) => {
      const overdueDays = daysBetween(skill.nextReview!, today);
      return {
        skill,
        reason: 'due',
        kind: 'check',
        why:
          overdueDays > 0
            ? `Due ${overdueDays} day${overdueDays === 1 ? '' : 's'} ago. The longer the gap, the more the attempt is worth.`
            : `Due today, ${skill.sched?.interval ?? '?'} days after the last check.`,
        overdueDays,
      };
    });

  let checks = interleave([...retries, ...due]);

  // nothing scheduled yet: start with what is claimed but has never been tried alone
  if (checks.length === 0 && doneToday.length === 0) {
    const applied = STATE_ORDER.indexOf('APPLIED');
    const first = ranked
      .map((r) => r.skill)
      .filter(
        (s) =>
          s.independent === null &&
          !s.nextReview &&
          s.id !== state.currentSkillId &&
          STATE_ORDER.indexOf(s.state) >= applied,
      )
      .slice(0, 6);
    checks = interleave(
      first.map((skill): QueueItem => ({
        skill,
        reason: 'first',
        kind: 'check',
        why: `Rated ${skill.state.toLowerCase()}, never tried without AI. One attempt turns the rating into a measurement.`,
        overdueDays: 0,
      })),
    ).slice(0, 2);
  }

  const room = Math.max(0, MAX_CHECKS_PER_DAY - doneToday.filter((r) => r.kind === 'check').length);
  const shown = checks.slice(0, room);
  const items = [...shown];

  const current = state.skills.find((s) => s.id === state.currentSkillId);
  if (current && !doneToday.some((r) => r.kind === 'session' && r.skillId === current.id)) {
    items.push({
      skill: current,
      reason: 'session',
      kind: 'session',
      why: 'The one skill allowed to dominate right now. The session ends in its AI-free check.',
      overdueDays: 0,
    });
  }
  return { items, deferred: checks.length - shown.length, doneToday };
}

/* ───────────────────────── session shape ─────────────────────────
   The same hour is not right at every level. With nothing to retrieve yet,
   an attempt before any reading primes what the reading is for. Once the
   skill has been applied, worked explanations add little: start from the
   problem. */

export interface Phase {
  label: string;
  minutes: number;
  detail: string;
  /** the part that must be done with every assistant closed */
  unaided?: boolean;
}

export function checkPhases(skill: Skill): Phase[] {
  return [
    { label: 'Attempt, no AI', minutes: 20, detail: skill.aiFreeCheck, unaided: true },
    {
      label: 'Verify',
      minutes: 5,
      detail: 'Compare against a reference or run it. Decide pass or fail on what the check asks for, not on effort.',
    },
  ];
}

export function sessionPhases(skill: Skill): Phase[] {
  const level = STATE_ORDER.indexOf(skill.state);
  const name = skill.name.toLowerCase();
  const verify: Phase = {
    label: 'Verify',
    minutes: 10,
    detail: 'Diff against a reference implementation. Where it differs, find out why before changing anything.',
  };
  const explain: Phase = {
    label: 'Explain, from memory',
    minutes: 10,
    detail: `Write the answer you would give in an interview: the mechanism, the cost, and the trade-off you would be asked about. No notes, no tabs.`,
    unaided: true,
  };
  if (level <= STATE_ORDER.indexOf('AWARE')) {
    return [
      {
        label: 'Attempt first, no AI',
        minutes: 10,
        detail: `Before reading anything: ${skill.aiFreeCheck} Get as far as you can and write down exactly where you stop. Getting it wrong here is the point.`,
        unaided: true,
      },
      {
        label: 'Understand',
        minutes: 15,
        detail: `Read only enough to get past the place you stopped. What problem does ${name} solve, and what breaks without it? Close the tab before the next step.`,
      },
      { label: 'Implement, no AI', minutes: 20, detail: skill.aiFreeCheck, unaided: true },
      { ...verify, minutes: 5 },
      explain,
    ];
  }
  if (level >= STATE_ORDER.indexOf('APPLIED')) {
    return [
      {
        label: 'Implement, no AI',
        minutes: 35,
        detail: `${skill.aiFreeCheck} Start from the problem, not from a tutorial. Look something up only when you are stuck, and note what it was.`,
        unaided: true,
      },
      verify,
      { ...explain, minutes: 15 },
    ];
  }
  return [
    {
      label: 'Understand',
      minutes: 15,
      detail: `Read only enough to answer: what problem does ${name} solve, and what breaks without it? Close the tab before the next step.`,
    },
    { label: 'Implement, no AI', minutes: 25, detail: skill.aiFreeCheck, unaided: true },
    verify,
    explain,
  ];
}

export const phasesFor = (skill: Skill, kind: 'check' | 'session') =>
  kind === 'check' ? checkPhases(skill) : sessionPhases(skill);

/* ───────────────────────── calibration ─────────────────────────
   Do the predictions match what happens? Reported as counts with honest
   intervals, never as a smooth curve: there will not be enough data for one. */

export const PREDICTIONS = [0.1, 0.3, 0.5, 0.7, 0.9] as const;

export interface CalibrationBin {
  label: string;
  n: number;
  passed: number;
  /** Wilson 90% interval on the pass rate, 0–1; null when empty */
  low: number | null;
  high: number | null;
}

export interface Calibration {
  n: number;
  bins: CalibrationBin[];
  meanPredicted: number | null;
  passRate: number | null;
  /** mean prediction minus pass rate: positive is overconfident. null under 10 predictions */
  overconfidence: number | null;
  /** mean squared error of the predictions; 0.25 is what always saying 50% scores. null under 20 */
  brier: number | null;
  /** confident predictions (80%+) that failed */
  illusions: number;
}

/** Wilson score interval; z = 1.645 is a 90% interval, which is as much as small counts support. */
export function wilson(passed: number, n: number, z = 1.645): [number, number] | null {
  if (n === 0) return null;
  const p = passed / n;
  const z2 = z * z;
  const centre = (p + z2 / (2 * n)) / (1 + z2 / n);
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / (1 + z2 / n);
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}

export function calibration(reviews: Review[]): Calibration {
  const rs = reviews.filter((r) => r.predicted !== null && !r.assisted);
  const defs: { label: string; test: (p: number) => boolean }[] = [
    { label: 'said 50% or less', test: (p) => p <= 0.5 },
    { label: 'said about 70%', test: (p) => p > 0.5 && p < 0.85 },
    { label: 'said 90%', test: (p) => p >= 0.85 },
  ];
  const bins = defs.map((d) => {
    const inBin = rs.filter((r) => d.test(r.predicted!));
    const passed = inBin.filter((r) => r.outcome !== 'fail').length;
    const w = wilson(passed, inBin.length);
    return { label: d.label, n: inBin.length, passed, low: w ? w[0] : null, high: w ? w[1] : null };
  });
  const n = rs.length;
  if (n === 0) {
    return { n, bins, meanPredicted: null, passRate: null, overconfidence: null, brier: null, illusions: 0 };
  }
  const meanPredicted = rs.reduce((a, r) => a + r.predicted!, 0) / n;
  const passRate = rs.filter((r) => r.outcome !== 'fail').length / n;
  const brier = rs.reduce((a, r) => a + (r.predicted! - (r.outcome === 'fail' ? 0 : 1)) ** 2, 0) / n;
  return {
    n,
    bins,
    meanPredicted,
    passRate,
    overconfidence: n >= 10 ? meanPredicted - passRate : null,
    brier: n >= 20 ? brier : null,
    illusions: rs.filter((r) => r.predicted! >= 0.8 && r.outcome === 'fail').length,
  };
}

/* ───────────────────────── consistency ─────────────────────────
   Days practised against days planned, by week. Not a streak: a missed day
   costs one day, not the whole record, and hours are not counted because
   time logged is not the same as skill gained. */

export interface Week {
  /** ISO date of the Monday */
  start: string;
  days: number;
  planned: number;
  current: boolean;
}

export function mondayOf(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

export function weeks(reviews: Review[], perWeek: number, count = 6, today = isoToday()): Week[] {
  const thisMonday = mondayOf(today);
  const out: Week[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const start = addDays(thisMonday, -7 * i);
    const end = addDays(start, 7);
    const days = new Set(reviews.filter((r) => r.date >= start && r.date < end).map((r) => r.date)).size;
    out.push({ start, days, planned: perWeek, current: i === 0 });
  }
  return out;
}
