'use client';

import { useMemo, useState } from 'react';
import { useHydrated, useLearning } from './store';
import { bottleneck, lanes, rank, weekPlan } from './priority';
import { SkillsPanel } from './panels/Skills';
import { BuildPanel } from './panels/Build';
import { PrepPanel } from './panels/Prep';
import { CoachPanel } from './panels/Coach';
import { ReviewPanel } from './panels/Review';
import { Card, Independence, StateBadge, fmtDate } from './ui';

type Tab = 'dashboard' | 'skills' | 'build' | 'prep' | 'coach' | 'review';

const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'skills', label: 'Skills & queue' },
  { id: 'build', label: 'Projects & evidence' },
  { id: 'prep', label: 'Interview & reading' },
  { id: 'coach', label: 'Coach & session' },
  { id: 'review', label: 'Review & data' },
];

function Dashboard({ go }: { go: (t: Tab) => void }) {
  const state = useLearning();
  const setTodayFocus = useLearning((s) => s.setTodayFocus);
  const startSession = useLearning((s) => s.startSession);

  const ranked = useMemo(() => rank(state), [state]);
  const queue = useMemo(() => lanes(state), [state]);
  const block = useMemo(() => bottleneck(state), [state]);
  const week = useMemo(() => weekPlan(state), [state]);

  const current = state.skills.find((s) => s.id === state.currentSkillId);
  const project = state.projects.find((p) => p.primary) ?? state.projects[0];
  const doneMs = project?.milestones.filter((m) => m.done).length ?? 0;
  const month = new Date().toISOString().slice(0, 7);
  const monthEvidence = state.evidence.filter((e) => e.date.startsWith(month));
  // Never contradict the deep-skill card: anything in NOW or NEXT is being
  // studied, so it cannot also appear under "do not study yet".
  const active = new Set([state.currentSkillId, ...queue.NEXT.map((r) => r.skill.id)]);
  const notYet = ranked.filter((r) => r.blockedBy.length > 0 && !active.has(r.skill.id)).slice(0, 3);

  return (
    <div className="lrn-grid">
      <Card title="North star" wide>
        <p className="lrn-northstar">{state.target.northStar}</p>
        <p className="lrn-spike">Deep spike — {state.target.spike}</p>
        <p className="lrn-note">{state.target.notes}</p>
        <p className="lrn-note">Target teams: {state.target.companies.join(' · ')}</p>
      </Card>

      <Card title="Current bottleneck" hint="unblocked, highest priority">
        {block ? (
          <>
            <p className="lrn-big">{block.skill.name}</p>
            <p className="lrn-note">
              {block.skill.state === 'UNKNOWN' || block.skill.state === 'AWARE'
                ? 'You have extensive applied AI experience, and insufficient evidence that you can independently implement the machinery underneath it.'
                : block.skill.objective}
            </p>
            <p className="lrn-metrics">
              unlocks {block.unlocks} skills · confidence {Math.round(block.skill.confidence * 100)}% ·{' '}
              <Independence value={block.skill.independent} />
            </p>
          </>
        ) : (
          <p className="lrn-empty">No unblocked skill ranked.</p>
        )}
      </Card>

      <Card title="Current deep skill" hint="only one at a time, on purpose">
        {current ? (
          <>
            <p className="lrn-big">{current.name}</p>
            <div className="lrn-detail-row">
              <StateBadge state={current.state} />
              <span className="lrn-arrow">→</span>
              <StateBadge state="INTERNALIZED" />
            </div>
            <p className="lrn-note">{current.objective}</p>
            <p className="lrn-note">
              <strong>Next milestone:</strong>{' '}
              {project?.milestones.find((m) => !m.done)?.title ?? 'project complete'}
            </p>
            <button className="lrn-btn primary" onClick={() => { startSession(current.id); go('coach'); }}>
              START LEARNING SESSION
            </button>
          </>
        ) : (
          <p className="lrn-empty">No current skill set.</p>
        )}
      </Card>

      <Card title="Today's focus" hint="max 3 — concrete and finishable">
        <ol className="lrn-focus">
          {state.todayFocus.map((f, i) => (
            <li key={i}>
              <input
                value={f}
                onChange={(e) => {
                  const next = [...state.todayFocus];
                  next[i] = e.target.value;
                  setTodayFocus(next);
                }}
              />
            </li>
          ))}
          {state.todayFocus.length < 3 && (
            <li>
              <button className="lrn-btn tiny" onClick={() => setTodayFocus([...state.todayFocus, ''])}>
                + add
              </button>
            </li>
          )}
        </ol>
      </Card>

      <Card title="Current build" hint={project?.stage}>
        <p className="lrn-big">{project?.name}</p>
        <p className="lrn-metrics">
          {doneMs} / {project?.milestones.length} major milestones
        </p>
        <ul className="lrn-ms-strip">
          {project?.milestones.map((m) => (
            <li key={m.id} className={m.done ? 'done' : ''} title={m.title}>
              <span />
            </li>
          ))}
        </ul>
        <p className="lrn-note">{project?.milestones.find((m) => !m.done)?.title}</p>
        <button className="lrn-btn" onClick={() => go('build')}>
          Open project
        </button>
      </Card>

      <Card title="Weakest high-ROI skills" hint="importance × gap × uncertainty × dependency value" wide>
        <div className="lrn-scroll">
        <table className="lrn-table compact">
          <tbody>
            {ranked.slice(0, 6).map((r) => (
              <tr key={r.skill.id} onClick={() => go('skills')}>
                <td className="lrn-num">{r.priority.toFixed(1)}</td>
                <td>{r.skill.name}</td>
                <td>
                  <StateBadge state={r.skill.state} />
                </td>
                <td className="lrn-dim">unlocks {r.unlocks}</td>
                <td className="lrn-dim">
                  {r.blockedBy.length ? `needs ${r.blockedBy.map((b) => b.name).join(', ')}` : 'workable now'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        <p className="lrn-note">
          Ranked by leverage, not by lowest score — CUDA trivia should never outrank PyTorch while
          PyTorch blocks five downstream skills.
        </p>
      </Card>

      <Card title="This week" wide>
        <dl className="lrn-kv tight">
          <dt>Understand</dt>
          <dd>{week.understand}</dd>
          <dt>Implement</dt>
          <dd>{week.implement}</dd>
          <dt>Apply</dt>
          <dd>{week.apply}</dd>
          <dt>Read</dt>
          <dd>
            {week.read.length === 0
              ? '—'
              : week.read.map((r) => (
                  <span key={r.title} className="lrn-read">
                    <strong>{r.title}</strong> — {r.reason}
                  </span>
                ))}
          </dd>
          <dt>Explain</dt>
          <dd>{week.explain}</dd>
          <dt>Ship</dt>
          <dd>{week.ship}</dd>
        </dl>
      </Card>

      <Card title="Evidence this month" hint={`${monthEvidence.length} recorded`}>
        {monthEvidence.length === 0 ? (
          <p className="lrn-empty">
            None yet. Until an artifact exists, every state on this page is a hypothesis.
          </p>
        ) : (
          <ul className="lrn-ev-mini">
            {monthEvidence.slice(0, 6).map((e) => (
              <li key={e.id}>
                {fmtDate(e.date)} · {e.artifact} · <em>{e.assistance}</em>
                {e.negative && <span className="lrn-tag neg">negative</span>}
              </li>
            ))}
          </ul>
        )}
        <button className="lrn-btn" onClick={() => go('build')}>
          Record evidence
        </button>
      </Card>

      <Card title="Do not study yet" hint="blocked behind prerequisites">
        <ul className="lrn-notyet">
          {notYet.map((r) => (
            <li key={r.skill.id}>
              <strong>{r.skill.name}</strong>
              <em>needs {r.blockedBy.map((b) => b.name).join(', ')}</em>
            </li>
          ))}
        </ul>
        <p className="lrn-note">
          {queue.IGNORE.length} more skills are parked in IGNORE. Leaving them there is the decision,
          not an oversight.
        </p>
      </Card>
    </div>
  );
}

export function LearningOS({ embedded }: { embedded?: boolean }) {
  const [tab, setTab] = useState<Tab>('dashboard');
  const hydrated = useHydrated();

  if (!hydrated) {
    return (
      <div className={'lrn' + (embedded ? ' embedded' : '')}>
        <p className="lrn-empty">Loading local state…</p>
      </div>
    );
  }

  return (
    <div className={'lrn' + (embedded ? ' embedded' : '')}>
      <nav className="lrn-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={'lrn-tab' + (tab === t.id ? ' active' : '')}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
        <span className="lrn-private" title="Nothing here is sent to a server or committed to git.">
          local only
        </span>
      </nav>

      <div className="lrn-body">
        {tab === 'dashboard' && <Dashboard go={setTab} />}
        {tab === 'skills' && <SkillsPanel />}
        {tab === 'build' && <BuildPanel />}
        {tab === 'prep' && <PrepPanel />}
        {tab === 'coach' && <CoachPanel />}
        {tab === 'review' && <ReviewPanel />}
      </div>
    </div>
  );
}

export default LearningOS;
