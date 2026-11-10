'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLearning } from '../store';
import { useResearch } from '@/research/store';
import { useOS } from '@/os/store';
import {
  PREDICTIONS,
  PROMOTION_PASSES,
  addDays,
  calibration,
  isoToday,
  nextState,
  phasesFor,
  promotable,
  todayQueue,
  unaidedPassDays,
  weeks,
  type QueueItem,
  type Scheduled,
} from '../schedule';
import type { Outcome, Review, Run, Skill } from '../types';
import { Card, StateBadge, fmtDate } from '../ui';

/**
 * Today — the one screen to open. It answers "what do I do now?" with at most
 * three unaided checks and one session, runs them against a clock, and
 * records a prediction before and an outcome after. Everything else in the
 * Learning OS is a way of deciding what belongs in this queue.
 */

const REASON_LABEL: Record<QueueItem['reason'], string> = {
  retry: 'Retry',
  due: 'Due',
  first: 'First check',
  session: 'Session',
};

const OUTCOMES: { id: Outcome; label: string; hint: string }[] = [
  { id: 'pass', label: 'Passed', hint: 'Did what the check asks, from memory.' },
  { id: 'hard', label: 'Passed, with a struggle', hint: 'Got there, slowly or with a wrong turn.' },
  { id: 'fail', label: 'Did not pass', hint: 'Stuck, wrong, or needed to look it up.' },
];

const pct = (p: number) => `${Math.round(p * 100)}%`;
const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

type Result = Scheduled & { review: Review; skill: Skill };

function Runner({ run, skill, onDone }: { run: Run; skill: Skill; onDone: (r: Result) => void }) {
  const predictRun = useLearning((s) => s.predictRun);
  const advanceRun = useLearning((s) => s.advanceRun);
  const cancelRun = useLearning((s) => s.cancelRun);
  const finishRun = useLearning((s) => s.finishRun);
  const phases = useMemo(() => phasesFor(skill, run.kind), [skill, run.kind]);
  const [, tick] = useState(0);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [assisted, setAssisted] = useState(false);
  const [note, setNote] = useState('');

  const timing = run.predicted !== null && run.phase < phases.length;
  useEffect(() => {
    if (!timing) return;
    const id = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [timing]);

  const total = phases.reduce((a, p) => a + p.minutes, 0);
  const head = (
    <header className="lrn-td-run-head">
      <span className="lrn-td-reason session">{run.kind === 'session' ? `Session, ${total} min` : 'Check'}</span>
      <strong>{skill.name}</strong>
      <StateBadge state={skill.state} />
      <button className="lrn-td-abandon" onClick={cancelRun} title="Nothing is recorded">
        Abandon
      </button>
    </header>
  );

  if (run.predicted === null) {
    return (
      <article className="lrn-td-run">
        {head}
        <p className="lrn-td-task">{skill.aiFreeCheck}</p>
        <p className="lrn-td-q">Before you start: how likely are you to pass this today, with every assistant closed?</p>
        <div className="lrn-td-predict" role="group" aria-label="Chance of passing">
          {PREDICTIONS.map((p) => (
            <button key={p} className="lrn-btn" onClick={() => predictRun(p)}>
              {pct(p)}
            </button>
          ))}
        </div>
        <p className="lrn-note">
          Answer first, then the clock starts. The guess is kept and compared with what happens, because how ready
          something feels is a poor guide to whether you can do it.
        </p>
      </article>
    );
  }

  if (run.phase < phases.length) {
    const phase = phases[run.phase];
    const elapsed = Date.now() - run.phaseStartedAt;
    const over = elapsed > phase.minutes * 60000;
    return (
      <article className="lrn-td-run">
        {head}
        <ol className="lrn-td-phases">
          {phases.map((p, i) => (
            <li key={i} className={i === run.phase ? 'on' : i < run.phase ? 'done' : ''}>
              <span className="lrn-td-min">{p.minutes} min</span>
              <span>
                <strong>
                  {p.label}
                  {p.unaided && <em className="lrn-td-aioff">AI off</em>}
                </strong>
                {i === run.phase && <span className="lrn-td-detail">{p.detail}</span>}
              </span>
            </li>
          ))}
        </ol>
        <div className="lrn-td-clock">
          <span className={'lrn-td-time' + (over ? ' over' : '')} aria-live="off">
            {clock(elapsed)}
          </span>
          <span className="lrn-dim">
            of {phase.minutes}:00{over ? ', over. Wrap this step up.' : ''} · said {pct(run.predicted)}
          </span>
          <button className="lrn-btn primary" onClick={advanceRun}>
            {run.phase === phases.length - 1 ? 'Finish and record' : `Next: ${phases[run.phase + 1].label}`}
          </button>
        </div>
        <p className="lrn-note">
          {phase.unaided
            ? 'The coach is locked for this step. Getting stuck here is information: note where.'
            : 'The coach is open for this step. Ask it why, not for the answer.'}
        </p>
      </article>
    );
  }

  return (
    <article className="lrn-td-run">
      {head}
      <p className="lrn-td-q">How did it go? Judge it against the check, not against the effort.</p>
      <p className="lrn-td-task small">{skill.aiFreeCheck}</p>
      <div className="lrn-td-outcomes" role="radiogroup" aria-label="Outcome">
        {OUTCOMES.map((o) => (
          <button
            key={o.id}
            role="radio"
            aria-checked={outcome === o.id}
            className={'lrn-td-outcome ' + o.id + (outcome === o.id ? ' on' : '')}
            onClick={() => setOutcome(o.id)}
          >
            <strong>{o.label}</strong>
            <span>{o.hint}</span>
          </button>
        ))}
      </div>
      <label className="lrn-td-assist">
        <input type="checkbox" checked={assisted} onChange={(e) => setAssisted(e.target.checked)} />
        <span>
          I used an AI assistant during the attempt
          <small>It is logged as practice. A pass with help proves nothing yet, so the check comes back in two days.</small>
        </span>
      </label>
      <label className="lrn-field">
        <span>{outcome === 'pass' ? 'Anything you hesitated on (optional)' : 'Where it broke, or where you hesitated'}</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
      </label>
      <div className="lrn-btn-row">
        <button
          className="lrn-btn primary"
          disabled={!outcome}
          onClick={() => {
            if (!outcome) return;
            const res = finishRun({ outcome, assisted, note });
            if (res) onDone({ ...res, skill });
          }}
        >
          Record
        </button>
        <span className="lrn-dim">You said {pct(run.predicted)} before starting.</span>
      </div>
    </article>
  );
}

function ResultNote({ r, onEvidence, onClose }: { r: Result; onEvidence: () => void; onClose: () => void }) {
  const { review } = r;
  const passed = review.outcome !== 'fail';
  const next = addDays(review.date, review.intervalAfter);
  let verdict: string;
  if (review.assisted && passed) {
    verdict = 'Logged as practice with AI. It does not count as proof, so the same check is back in two days, unaided.';
  } else if (r.illusion) {
    verdict = `You said ${pct(review.predicted!)} and it did not pass. That gap is the useful part: it felt known and was not. Retry in ${review.intervalAfter} days; the interval will not grow again until two clean passes.`;
  } else if (!passed) {
    verdict = `Not passed. Retry in ${review.intervalAfter} days while the failure is still fresh, then it returns to a quarter of its old interval.`;
  } else if (r.surprised) {
    verdict = `Passed, though you gave it ${pct(review.predicted!)}. Counted as a hard pass, so it comes back sooner: ${review.intervalAfter} day${review.intervalAfter === 1 ? '' : 's'}.`;
  } else {
    verdict = `Passed without AI. Next check in ${review.intervalAfter} day${review.intervalAfter === 1 ? '' : 's'}, on ${fmtDate(next)}.`;
  }
  return (
    <div className={'lrn-td-result ' + (passed ? 'ok' : 'bad')} role="status">
      <p>
        <strong>{r.skill.name}.</strong> {verdict}
      </p>
      <div className="lrn-btn-row">
        {passed && !review.assisted && (
          <button className="lrn-btn" onClick={onEvidence}>
            Record the artifact as evidence
          </button>
        )}
        <button className="lrn-btn" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}

export function TodayPanel({ go, embedded }: { go: (tab: 'build' | 'skills' | 'coach') => void; embedded?: boolean }) {
  const state = useLearning();
  const { startRun, promote, setPlan } = state;
  const cards = useResearch((s) => s.cards);
  const [result, setResult] = useState<Result | null>(null);

  const today = isoToday();
  const queue = useMemo(() => todayQueue(state, today), [state, today]);
  const cal = useMemo(() => calibration(state.reviews), [state.reviews]);
  const wk = useMemo(() => weeks(state.reviews, state.plan.perWeek, 6, today), [state.reviews, state.plan.perWeek, today]);
  const ready = useMemo(() => promotable(state), [state]);
  const cardsDue = cards.filter((c) => !c.suspended && c.due <= today).length;

  const run = state.activeRun;
  const runSkill = run ? state.skills.find((s) => s.id === run.skillId) : undefined;
  const thisWeek = wk[wk.length - 1];
  const upcoming = state.skills
    .filter((s) => s.nextReview && s.nextReview > today)
    .sort((a, b) => a.nextReview!.localeCompare(b.nextReview!))
    .slice(0, 4);

  return (
    <div className="lrn-td">
      {run && runSkill && <Runner key={run.skillId + run.kind} run={run} skill={runSkill} onDone={setResult} />}
      {result && !run && (
        <ResultNote
          r={result}
          onEvidence={() => {
            setResult(null);
            go('build');
          }}
          onClose={() => setResult(null)}
        />
      )}

      <div className="lrn-grid">
        <Card
          title="Do this now"
          hint={`${new Date(today + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' })}`}
          wide
        >
          {queue.items.length === 0 && (
            <p className="lrn-empty">
              Nothing left for today. That is the plan working: come back when the next check is due.
            </p>
          )}
          <ol className="lrn-td-queue">
            {queue.items.map((it) => (
              <li key={it.kind + it.skill.id} className={'r-' + it.reason}>
                <div className="lrn-td-item-head">
                  <span className={'lrn-td-reason ' + it.reason}>{REASON_LABEL[it.reason]}</span>
                  <strong>{it.skill.name}</strong>
                  <span className="lrn-dim">{it.skill.domain}</span>
                  <StateBadge state={it.skill.state} />
                </div>
                <p className="lrn-td-why">{it.why}</p>
                <p className="lrn-td-check">{it.kind === 'session' ? it.skill.objective : it.skill.aiFreeCheck}</p>
                <button
                  className={'lrn-btn' + (it === queue.items[0] ? ' primary' : '')}
                  disabled={!!run}
                  onClick={() => {
                    setResult(null);
                    startRun(it.skill.id, it.kind);
                  }}
                >
                  {it.kind === 'session'
                    ? `Start the session (${phasesFor(it.skill, 'session').reduce((a, p) => a + p.minutes, 0)} min)`
                    : 'Start the check (about 25 min)'}
                </button>
              </li>
            ))}
          </ol>
          {queue.deferred > 0 && (
            <p className="lrn-note">
              {queue.deferred} more check{queue.deferred === 1 ? ' is' : 's are'} due and held for tomorrow. Three a
              day is the cap, so a backlog never becomes a reason to skip the day.
            </p>
          )}
          {cardsDue > 0 && (
            <p className="lrn-td-cards">
              <span>
                <strong>{cardsDue}</strong> recall card{cardsDue === 1 ? '' : 's'} due from the papers you are reading.
              </span>
              {embedded ? (
                <button className="lrn-btn tiny" onClick={() => useOS.getState().launch('research', { arg: 'review' })}>
                  Review in Research
                </button>
              ) : (
                <span className="lrn-dim">Open Research → Review on the desktop.</span>
              )}
            </p>
          )}
          {queue.doneToday.length > 0 && (
            <ul className="lrn-td-done">
              {queue.doneToday.map((r) => (
                <li key={r.id} className={r.outcome === 'fail' ? 'bad' : 'ok'}>
                  {r.outcome === 'fail' ? '✗' : '✓'} {state.skills.find((s) => s.id === r.skillId)?.name ?? r.skillId}
                  <span className="lrn-dim">
                    {r.outcome === 'fail' ? 'not passed' : r.outcome === 'hard' ? 'passed, hard' : 'passed'}
                    {r.assisted ? ', with AI' : ''}
                    {r.predicted !== null ? `, said ${pct(r.predicted)}` : ''}
                    {r.minutes ? `, ${r.minutes} min` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="The plan" hint="when, where, how often">
          <label className="lrn-field">
            <span>If … then I do today’s queue</span>
            <input
              value={state.plan.ifThen}
              onChange={(e) => setPlan({ ifThen: e.target.value })}
              placeholder="If it is 7:30 and the coffee is made, then at the desk, phone outside"
              maxLength={160}
            />
          </label>
          <div className="lrn-td-perweek">
            <span>Practice days a week</span>
            <span className="lrn-bm-seg">
              {[2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  className={'lrn-bm-seg-btn' + (state.plan.perWeek === n ? ' on lead' : '')}
                  onClick={() => setPlan({ perWeek: n })}
                >
                  {n}
                </button>
              ))}
            </span>
          </div>
          <div className="lrn-td-weeks" aria-label="Days practised per week, last six weeks">
            {wk.map((w) => (
              <div key={w.start} className={'lrn-td-week' + (w.current ? ' cur' : '')} title={`Week of ${fmtDate(w.start)}: ${w.days} of ${w.planned} days`}>
                <span className="lrn-td-week-bar">
                  <span style={{ height: `${Math.min(100, (w.days / Math.max(1, w.planned)) * 100)}%` }} className={w.days >= w.planned ? 'met' : ''} />
                </span>
                <b>{w.days}</b>
                <small>{fmtDate(w.start)}</small>
              </div>
            ))}
          </div>
          <p className="lrn-note">
            This week: {thisWeek.days} of {thisWeek.planned} days. Days kept against days planned, not a streak and not
            hours: a missed day costs one day.
          </p>
        </Card>

        <Card title="Calibration" hint={cal.n ? `${cal.n} prediction${cal.n === 1 ? '' : 's'}` : 'predicted vs actual'} wide>
          {cal.n === 0 ? (
            <p className="lrn-empty">
              No predictions yet. Each check asks for one before it starts; after ten, this shows whether “I know
              this” can be trusted.
            </p>
          ) : (
            <>
              <table className="lrn-table compact lrn-td-cal">
                <tbody>
                  {cal.bins.map((b) => (
                    <tr key={b.label}>
                      <td>{b.label}</td>
                      <td className="lrn-num">{b.n ? `passed ${b.passed} of ${b.n}` : 'none yet'}</td>
                      <td className="lrn-dim">
                        {b.n ? `true rate plausibly ${pct(b.low!)} to ${pct(b.high!)}` : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {cal.overconfidence === null ? (
                <p className="lrn-note">
                  Not enough data for a verdict: {cal.n} of the 10 predictions it takes. The counts above are all that
                  can honestly be said so far.
                </p>
              ) : (
                <p className="lrn-note">
                  On average you predicted {pct(cal.meanPredicted!)} and passed {pct(cal.passRate!)}:{' '}
                  <strong>
                    {Math.abs(cal.overconfidence) < 0.08
                      ? 'well calibrated'
                      : cal.overconfidence > 0
                        ? `overconfident by about ${Math.round(cal.overconfidence * 100)} points`
                        : `underconfident by about ${Math.round(-cal.overconfidence * 100)} points`}
                  </strong>
                  .{cal.brier !== null && ` Brier score ${cal.brier.toFixed(2)} (always saying 50% scores 0.25; lower is better).`}
                </p>
              )}
              {cal.illusions > 0 && (
                <p className="lrn-note">
                  {cal.illusions} time{cal.illusions === 1 ? '' : 's'} a 90% prediction did not pass. Those are the
                  skills that feel known because the material is familiar, not because it can be produced.
                </p>
              )}
            </>
          )}
        </Card>

        <Card title="Ready to move up" hint={`${PROMOTION_PASSES} unaided passes on separate days`}>
          {ready.length === 0 ? (
            <p className="lrn-empty">
              None yet. A state changes after {PROMOTION_PASSES} unaided passes on {PROMOTION_PASSES} different days,
              not after one good session.
            </p>
          ) : (
            <ul className="lrn-td-ready">
              {ready.map((s) => (
                <li key={s.id}>
                  <span>
                    <strong>{s.name}</strong>
                    <span className="lrn-dim">
                      {' '}
                      passed {unaidedPassDays(state.reviews, s).length} times since it was rated {s.state.toLowerCase()}
                    </span>
                  </span>
                  <button className="lrn-btn tiny ok" onClick={() => promote(s.id)}>
                    Move to {nextState(s.state).toLowerCase()}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {upcoming.length > 0 && (
            <>
              <p className="lrn-td-sub">Coming up</p>
              <ul className="lrn-td-upcoming">
                {upcoming.map((s) => (
                  <li key={s.id}>
                    <span>{s.name}</span>
                    <span className="lrn-dim">{fmtDate(s.nextReview)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        <section className="lrn-card wide lrn-td-why-card">
          <details>
            <summary>Why it works this way</summary>
            <ul>
              <li>
                <strong>The unit is an attempt, not reading.</strong> Retrieving from memory beats restudying, most of
                all after a delay (Roediger &amp; Karpicke 2006; Dunlosky et al. 2013 rate it high utility).
              </li>
              <li>
                <strong>AI off during the attempt.</strong> In a 2026 randomised study, developers who learned a
                library with an assistant scored 50% on a later quiz against 67% without; delegating was the worst
                pattern, asking conceptual questions the best (Shen &amp; Tamkin, Anthropic).
              </li>
              <li>
                <strong>Checks come back on a widening schedule.</strong> Spacing is the other high-utility technique;
                too short a gap costs more than too long (Cepeda et al. 2008). A failure returns within days.
              </li>
              <li>
                <strong>You predict before you start.</strong> Feeling fluent is not the same as being able: people
                judge massed practice as better while doing worse with it (Kornell &amp; Bjork 2008).
              </li>
              <li>
                <strong>Neighbouring checks come from different domains.</strong> Mixing related topics beats blocking
                them (Brunmair &amp; Richter 2019).
              </li>
              <li>
                <strong>No streaks, no hours.</strong> Time logged explains little of professional performance
                (Macnamara et al. 2014), so the only count kept is days practised against days planned.
              </li>
            </ul>
            <p className="lrn-note">Sources, effect sizes and what is unverified: docs/learning-os-evidence.md in the repository.</p>
          </details>
        </section>
      </div>
    </div>
  );
}
