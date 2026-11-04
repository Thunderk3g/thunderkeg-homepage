'use client';

import { useMemo, useState } from 'react';
import { STATUS_SHORT, type Pass } from '@/research/types';
import { useResearch } from '@/research/store';
import { COVERAGE_COLS, PASSES, PASS_NAME, fmtMinutes, studyPlan } from '@/research/plan';

/**
 * Today: the study plan. Recall first, then the reading queue deepest-pass
 * first, the week against its goal, and which research questions have no
 * reading behind them.
 */
export function Today({
  onReview,
  onRead,
  onFeed,
  onLibrary,
}: {
  onReview: () => void;
  onRead: (paperId: string) => void;
  onFeed: () => void;
  onLibrary: (filter?: { rq?: string; status?: string }) => void;
}) {
  const papers = useResearch((s) => s.papers);
  const cards = useResearch((s) => s.cards);
  const log = useResearch((s) => s.log);
  const rqs = useResearch((s) => s.rqs);
  const prefs = useResearch((s) => s.prefs);
  const activeDays = useResearch((s) => s.activeDays);
  const setPrefs = useResearch((s) => s.setPrefs);
  const [editing, setEditing] = useState(false);

  const plan = useMemo(
    () => studyPlan({ papers, cards, log, rqs, prefs, activeDays }),
    [papers, cards, log, rqs, prefs, activeDays],
  );
  const titleOf = (id: string) => papers.find((p) => p.id === id)?.title ?? id;
  const w = plan.week;
  const pct = (n: number, g: number) => (g > 0 ? Math.min(100, Math.round((n / g) * 100)) : 0);

  const act = () => {
    const n = plan.next;
    if (n.action === 'review') onReview();
    else if (n.action === 'read' && n.paperId) onRead(n.paperId);
    else if (n.action === 'triage') onLibrary({ status: 'inbox' });
    else if (n.action === 'find') onFeed();
  };
  const actLabel = { review: 'Review now', read: 'Start reading', triage: 'Open inbox', find: 'Open Feed', rest: '' }[plan.next.action];

  const num = (v: string, min: number, max: number) => Math.max(min, Math.min(max, Math.round(Number(v) || min)));

  return (
    <div className="rsx-today" data-testid="rsx-today">
      <section className="rsx-next" aria-label="Next action">
        <p className="rsx-answer-label">Next</p>
        <p className="rsx-next-text">{plan.next.text}</p>
        {actLabel && (
          <button className="lrn-btn primary" onClick={act}>
            {actLabel}
          </button>
        )}
      </section>

      <div className="rsx-today-grid">
        <section className="rsx-panel" aria-label="Due cards">
          <h3 className="rsx-panel-h">Recall</h3>
          <p className="rsx-big-n">
            {plan.due}
            <span> card{plan.due === 1 ? '' : 's'} due</span>
          </p>
          {plan.dueByPaper.slice(0, 3).map((d) => (
            <p key={d.paperId} className="rsx-row-meta rsx-ellip">
              {d.n} · {titleOf(d.paperId)}
            </p>
          ))}
          <button className="lrn-btn" onClick={onReview} disabled={plan.due === 0}>
            Review now
          </button>
        </section>

        <section className="rsx-panel" aria-label="This week">
          <h3 className="rsx-panel-h">
            Week of {w.start}
            <button className="rsx-link-btn" onClick={() => setEditing((v) => !v)}>
              {editing ? 'done' : 'edit goals'}
            </button>
          </h3>
          <div className="rsx-goal">
            <span>Papers finished</span>
            <span className="rsx-meter" role="progressbar" aria-valuenow={w.papersDone} aria-valuemax={w.goalPapers}>
              <span style={{ width: `${pct(w.papersDone, w.goalPapers)}%` }} />
            </span>
            <span className="rsx-goal-n">
              {w.papersDone}/
              {editing ? (
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={w.goalPapers}
                  aria-label="weekly paper goal"
                  onChange={(e) => setPrefs({ weekly: { ...prefs.weekly, papers: num(e.target.value, 0, 50) } })}
                />
              ) : (
                w.goalPapers
              )}
            </span>
          </div>
          <div className="rsx-goal">
            <span>Cards reviewed</span>
            <span className="rsx-meter" role="progressbar" aria-valuenow={w.cardsReviewed} aria-valuemax={w.goalCards}>
              <span style={{ width: `${pct(w.cardsReviewed, w.goalCards)}%` }} />
            </span>
            <span className="rsx-goal-n">
              {w.cardsReviewed}/
              {editing ? (
                <input
                  type="number"
                  min={0}
                  max={1000}
                  value={w.goalCards}
                  aria-label="weekly card goal"
                  onChange={(e) => setPrefs({ weekly: { ...prefs.weekly, cards: num(e.target.value, 0, 1000) } })}
                />
              ) : (
                w.goalCards
              )}
            </span>
          </div>
          <ol className="rsx-streak" aria-label="Last 7 days">
            {plan.days.map((d) => (
              <li
                key={d.day}
                className={d.active ? 'on' : ''}
                title={`${d.day}${d.active ? ' — studied' : ''}${d.reviews ? `, ${d.reviews} reviews` : ''}`}
              >
                <span className="rsx-streak-dot" />
                <span className="rsx-bar-d">{new Date(`${d.day}T00:00:00Z`).toUTCString().slice(0, 2)}</span>
              </li>
            ))}
          </ol>
          <p className="rsx-row-meta">{plan.streak ? `${plan.streak}-day streak` : 'No streak yet — any review or note starts one.'}</p>
        </section>
      </div>

      <section className="rsx-panel" aria-label="Reading queue">
        <h3 className="rsx-panel-h">
          Reading queue · {plan.queue.length} · {fmtMinutes(plan.minutesQueued)}
          <span className="rsx-budgets">
            {PASSES.map((p: Pass) => (
              <label key={p} title={`Minutes budgeted for ${PASS_NAME[p]}`}>
                {PASS_NAME[p]}
                {editing ? (
                  <input
                    type="number"
                    min={1}
                    max={600}
                    value={prefs.budgets[p]}
                    aria-label={`${PASS_NAME[p]} minutes`}
                    onChange={(e) => setPrefs({ budgets: { ...prefs.budgets, [p]: num(e.target.value, 1, 600) } })}
                  />
                ) : (
                  <b>{fmtMinutes(prefs.budgets[p])}</b>
                )}
              </label>
            ))}
          </span>
        </h3>
        {plan.queue.length === 0 ? (
          <p className="lrn-empty">
            Nothing in pass 1–3. {plan.inbox ? `${plan.inbox} in the inbox.` : 'Save papers from the Feed or Radar.'}
          </p>
        ) : (
          <ul className="rsx-queue">
            {plan.queue.map((q) => (
              <li key={q.paper.id}>
                <span className={`rsx-pill st-${q.pass}`}>{STATUS_SHORT[q.pass]}</span>
                <button className="rsx-queue-title" onClick={() => onRead(q.paper.id)} title="Open in Read mode">
                  {q.paper.title}
                </button>
                <span className="rsx-queue-meta">
                  {fmtMinutes(q.minutes)}
                  {q.waiting > 0 && <span className={q.waiting > 14 ? 'rsx-due' : ''}> · {q.waiting}d</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rsx-panel" aria-label="Research question coverage">
        <h3 className="rsx-panel-h">Coverage — papers per research question and pass</h3>
        <div className="rsx-cov-wrap">
          <table className="rsx-cov">
            <thead>
              <tr>
                <th scope="col">RQ</th>
                {COVERAGE_COLS.map((c) => (
                  <th key={c} scope="col">
                    {STATUS_SHORT[c]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {plan.coverage.map((r) => (
                <tr key={r.rqId} className={r.gap ? `gap-${r.gap}` : ''}>
                  <th scope="row" title={r.question}>
                    <button className="rsx-link-btn" onClick={() => onLibrary({ rq: r.rqId })}>
                      {r.short}
                    </button>
                    {r.gap && <span className="rsx-gap">{r.gap === 'none' ? 'no papers' : 'skims only'}</span>}
                  </th>
                  {COVERAGE_COLS.map((c) => {
                    const n = r.byStatus[c];
                    return (
                      <td key={c} className={n ? `n st-${c}` : 'z'} style={n ? { ['--a' as string]: Math.min(1, 0.18 + n * 0.2) } : undefined}>
                        {n || '·'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
