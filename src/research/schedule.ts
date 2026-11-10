import type { Card, Grade } from './types';

/**
 * Review scheduler.
 *
 * A deterministic expanding ladder. Cepeda et al. 2008 put the best review gap
 * at roughly 20–40% of the retention horizon for a week and 5–10% for a year,
 * so the steps grow to 180 days. FSRS is better but needs review history to fit
 * its parameters; everything goes through nextDue() so it can replace this.
 */
export const LADDER = [1, 3, 7, 16, 35, 80, 180]; // days
const LAST = LADDER.length - 1;

/** UTC calendar date. */
export const isoDay = (d: Date = new Date()) => d.toISOString().slice(0, 10);

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return isoDay(d);
}

/** Days until the next review if `card` were graded `grade` now. */
export function intervalFor(card: Pick<Card, 'step'>, grade: Grade): { step: number; days: number } {
  const step = Math.min(card.step, LAST);
  switch (grade) {
    case 'again':
      return { step: 0, days: 1 };
    case 'hard':
      return { step, days: Math.max(1, Math.round(LADDER[step] * 0.6)) };
    case 'good': {
      const s = Math.min(step + 1, LAST);
      return { step: s, days: LADDER[s] };
    }
    case 'easy': {
      const s = Math.min(step + 2, LAST);
      return { step: s, days: LADDER[s] };
    }
  }
}

export function nextDue(
  card: Card,
  grade: Grade,
  today: Date,
): Pick<Card, 'step' | 'due' | 'reps' | 'lapses' | 'lastReviewed'> {
  const day = isoDay(today);
  const { step, days } = intervalFor(card, grade);
  return {
    step,
    due: addDays(day, days),
    reps: card.reps + 1,
    lapses: card.lapses + (grade === 'again' ? 1 : 0),
    lastReviewed: day,
  };
}
