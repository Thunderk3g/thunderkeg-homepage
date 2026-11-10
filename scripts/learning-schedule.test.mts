import assert from 'node:assert/strict';
// Run: npx tsx scripts/learning-schedule.test.mts
import { calibration, interleave, mondayOf, schedule, todayQueue, weeks, wilson } from '../src/learning/schedule.ts';
import { seedState } from '../src/learning/seed.ts';
import type { Review, Sched } from '../src/learning/types.ts';

const ok = (c: boolean, m: string) => { assert.ok(c, m); console.log('ok -', m); };
const run = (prev: Sched | undefined, outcome: 'pass' | 'hard' | 'fail', predicted: number | null = 0.7, assisted = false) =>
  schedule(prev, { outcome, predicted, assisted });

// first checks
ok(run(undefined, 'pass').days === 3, 'first clean pass: 3 days');
ok(run(undefined, 'hard').days === 1, 'first hard pass: 1 day');
ok(run(undefined, 'pass', 0.3).days === 1 && run(undefined, 'pass', 0.3).surprised, 'a pass predicted at 30% counts as hard');

// growth
let s = run(undefined, 'pass').sched;
const second = run(s, 'pass');
ok(second.days === 7 && second.sched.ease === 2.35, 'second pass: 3 × 2.3 → 7 days, ease up');
const hard = run(second.sched, 'hard');
ok(hard.days === 9 && hard.sched.ease === 2.2, 'hard pass: × 1.3, ease down');
let grow = second.sched;
for (let i = 0; i < 12; i++) grow = run(grow, 'pass').sched;
ok(grow.interval === 180 && grow.ease <= 2.8, 'interval capped at 180 days, ease at 2.8');

// lapse and recovery
const base: Sched = { interval: 40, ease: 2.4, lapses: 0 };
const lapse = run(base, 'fail', 0.5);
ok(lapse.days === 2 && lapse.sched.preLapse === 40 && lapse.sched.lapses === 1 && !lapse.illusion, 'fail: retry in 2 days, remembers the old interval');
const again = run(lapse.sched, 'fail', 0.5);
ok(again.sched.preLapse === 40 && again.sched.lapses === 2, 'a second fail keeps the original interval to return to');
const back = run(lapse.sched, 'pass');
ok(back.days === 10 && back.sched.preLapse === undefined, 'retry passed: back at a quarter of the old interval');
ok(run({ interval: 4, ease: 2, lapses: 0, preLapse: 4 }, 'pass').days === 2, 'recovery floor is 2 days');

// confident failure
const ill = run(base, 'fail', 0.9);
ok(ill.illusion && ill.sched.hold === 2, 'a 90% prediction that fails is flagged and owes two clean passes');
const h1 = run(ill.sched, 'pass');
const h2 = run(h1.sched, 'pass');
const h3 = run(h2.sched, 'pass');
ok(h1.days === 10 && h2.days === 10 && h2.sched.hold === undefined && h3.days > 10, 'growth resumes only after the owed passes');

// assisted
const asst = run(base, 'pass', 0.7, true);
ok(asst.sched === base && asst.days === 2, 'an assisted pass moves nothing and asks for an unaided retry');
ok(run(base, 'fail', 0.7, true).sched.lapses === 1, 'an assisted fail is still a fail');

// fuzz
ok(schedule(base, { outcome: 'pass', predicted: 0.7, assisted: false }, 1).days === 106, 'fuzz stretches long intervals by up to 10%');
ok(schedule(undefined, { outcome: 'pass', predicted: 0.7, assisted: false }, 1).days === 3, 'short intervals are not fuzzed');

// calibration
const rv = (predicted: number | null, outcome: Review['outcome'], assisted = false, date = '2026-11-02', skillId = 'x'): Review =>
  ({ id: Math.random().toString(36), date, skillId, kind: 'check', predicted, outcome, assisted, intervalAfter: 3 });
const w = wilson(6, 9)!;
ok(w[0] > 0.38 && w[0] < 0.42 && w[1] > 0.85 && w[1] < 0.89, 'Wilson 90% interval for 6 of 9');
ok(wilson(0, 0) === null, 'no interval without data');
const few = calibration([rv(0.9, 'fail'), rv(0.9, 'pass'), rv(0.3, 'pass'), rv(null, 'pass'), rv(0.9, 'pass', true)]);
ok(few.n === 3 && few.overconfidence === null && few.brier === null && few.illusions === 1, 'under 10 predictions: counts only, no summary numbers');
ok(few.bins[2].n === 2 && few.bins[2].passed === 1 && few.bins[0].n === 1, 'bins hold raw counts; unpredicted and assisted reviews are left out');
const many = calibration([...Array(12).fill(0).map(() => rv(0.9, 'pass')), ...Array(8).fill(0).map(() => rv(0.9, 'fail'))]);
ok(Math.abs(many.overconfidence! - 0.3) < 1e-9 && Math.abs(many.brier! - (12 * 0.01 + 8 * 0.81) / 20) < 1e-9, 'at 20: overconfidence and Brier score');

// queue
const st = seedState();
const q0 = todayQueue(st, '2026-11-10');
ok(q0.items.length >= 1 && q0.items[q0.items.length - 1].reason === 'session', 'the current skill session closes the queue');
ok(q0.items.filter((i) => i.reason === 'first').length <= 2, 'with nothing scheduled, at most two first checks are suggested');
ok(q0.items.every((i) => i.reason !== 'first' || i.skill.independent === null), 'first checks are skills never tried without AI');
const due = st.skills.slice(0, 6).map((k, i) => ({ ...k, nextReview: '2026-11-0' + (i + 1), sched: { interval: 5, ease: 2.3, lapses: 0, ...(i === 5 ? { preLapse: 20 } : {}) } }));
const st2 = { ...st, skills: [...due, ...st.skills.slice(6)] };
const q2 = todayQueue(st2, '2026-11-10');
const checks = q2.items.filter((i) => i.kind === 'check');
ok(checks.length === 3 && q2.deferred === 3, 'three checks a day; the rest are deferred, not hidden');
ok(checks.some((i) => i.reason === 'retry'), 'a retry is always in the day');
const q3 = todayQueue({ ...st2, reviews: [rv(0.7, 'pass', false, '2026-11-10', due[0].id)] }, '2026-11-10');
ok(q3.items.filter((i) => i.kind === 'check').length === 2 && !q3.items.some((i) => i.skill.id === due[0].id && i.kind === 'check'), 'a check done today leaves the queue and uses a slot');
const mixed = interleave([{ skill: { domain: 'A' } }, { skill: { domain: 'A' } }, { skill: { domain: 'B' } }] as never[]) as { skill: { domain: string } }[];
ok(mixed.map((m) => m.skill.domain).join('') === 'ABA', 'neighbouring checks come from different domains');

// weeks
ok(mondayOf('2026-11-10') === '2026-11-09' && mondayOf('2026-11-15') === '2026-11-09', 'weeks start on Monday');
const wk = weeks([rv(0.7, 'pass', false, '2026-11-09'), rv(0.7, 'pass', false, '2026-11-09'), rv(0.7, 'fail', false, '2026-11-10'), rv(0.7, 'pass', false, '2026-11-01')], 4, 3, '2026-11-10');
ok(wk.length === 3 && wk[2].days === 2 && wk[2].current && wk[1].days === 0 && wk[0].days === 1, 'days practised per week, not sessions or hours');
console.log('all passed');
