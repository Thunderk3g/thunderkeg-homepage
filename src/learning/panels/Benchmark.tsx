'use client';

import { useMemo, useState } from 'react';
import { useLearning } from '../store';
import {
  DIMENSIONS,
  GAPS,
  LEVELS,
  PROGRAMME_NOTE,
  PROGRAMMES,
  atLeastApplied,
  readiness,
  type Readiness,
} from '../benchmark';
import { APPLICATION_STATUS_LABEL, type ApplicationStatus, type Track } from '../types';
import { StateBadge } from '../ui';
import { EvidenceForm } from './Build';

const TRACK_LABEL: Record<Track, string> = { lead: 'lead', research: 'research', both: 'both tracks' };

function ReadinessPart({ label, r }: { label: string; r: Readiness }) {
  return (
    <span className="lrn-bm-ready-part">
      <strong>{label}</strong> {r.ready}/{r.total} mapped skills at APPLIED or better ({Math.round(r.share * 100)} %)
      <span className="lrn-bm-bar" aria-hidden>
        <span style={{ width: `${Math.round(r.share * 100)}%` }} />
      </span>
    </span>
  );
}

export function BenchmarkPanel() {
  const state = useLearning();
  const { setDimension, togglePlanItem, setApplication } = state;
  const [logging, setLogging] = useState<string | null>(null);

  const lead = useMemo(() => readiness(state, 'lead'), [state]);
  const research = useMemo(() => readiness(state, 'research'), [state]);
  const skillById = useMemo(() => new Map(state.skills.map((s) => [s.id, s])), [state.skills]);
  const phases = state.roadmap.filter((p) => p.track);
  const gaps = useMemo(() => [...GAPS].sort((a, b) => a.priority - b.priority), []);

  const atLead = DIMENSIONS.filter((d) => state.benchmark[d.id] === 'lead').length;
  const assessed = DIMENSIONS.filter((d) => state.benchmark[d.id]).length;

  return (
    <div className="lrn-bm">
      <p className="lrn-bm-ready" data-testid="readiness">
        <span className="lrn-bm-ready-k">Readiness</span>
        <ReadinessPart label="Lead track" r={lead} />
        <ReadinessPart label="Research track" r={research} />
      </p>
      <p className="lrn-note">
        Benchmarked against the 2026 market standard for Technical Lead — AI Engineering and the 2027
        research-master&apos;s intake. Source: <code>docs/role-benchmark.md</code>. A skill counts as ready
        only at APPLIED or better, so readiness moves when evidence moves the skill, not when a box is
        ticked.
      </p>

      <h2>Senior vs lead — where I am</h2>
      <p className="lrn-note">
        A lead is judged on scope, not title. {assessed}/{DIMENSIONS.length} dimensions self-assessed,
        {' '}{atLead} at lead level.
      </p>
      <div className="lrn-scroll">
        <table className="lrn-table lrn-bm-dims">
          <thead>
            <tr>
              <th>Dimension</th>
              <th>Senior engineer</th>
              <th>Technical lead (market standard)</th>
              <th>Me now</th>
            </tr>
          </thead>
          <tbody>
            {DIMENSIONS.map((d) => {
              const v = state.benchmark[d.id];
              return (
                <tr key={d.id} data-dim={d.id}>
                  <td className="lrn-bm-dim-name">{d.name}</td>
                  <td className="lrn-dim">{d.senior}</td>
                  <td>{d.lead}</td>
                  <td>
                    <span className="lrn-bm-seg" role="radiogroup" aria-label={`${d.name} self-assessment`}>
                      {LEVELS.map((l) => (
                        <button
                          key={l.id}
                          role="radio"
                          aria-checked={v === l.id}
                          className={'lrn-bm-seg-btn' + (v === l.id ? ` on ${l.id}` : '')}
                          onClick={() => setDimension(d.id, l.id)}
                        >
                          {l.label}
                        </button>
                      ))}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2>Gaps, highest leverage first</h2>
      <p className="lrn-note">
        Each gap names the artefact that would close it. Logging evidence here attaches it to the mapped
        skills, which is what moves their state.
      </p>
      <ol className="lrn-bm-gaps">
        {gaps.map((g) => {
          const mapped = g.skillIds.map((id) => skillById.get(id)).filter((s) => s !== undefined);
          const ready = mapped.filter(atLeastApplied).length;
          return (
            <li key={g.id} className="lrn-bm-gap" data-gap={g.id}>
              <header>
                <span className="lrn-bm-prio">{g.priority}</span>
                <h3>{g.title}</h3>
                <span className={`lrn-bm-track t-${g.track}`}>{TRACK_LABEL[g.track]}</span>
              </header>
              <p className="lrn-bm-why">{g.why}</p>
              <ul className="lrn-bm-skills">
                {mapped.map((s) => (
                  <li key={s.id}>
                    <span>{s.name}</span>
                    <StateBadge state={s.state} />
                  </li>
                ))}
              </ul>
              <p className="lrn-bm-proof">
                <strong>Proof:</strong> {g.proof}
              </p>
              <footer>
                <span className="lrn-dim">
                  {ready}/{mapped.length} at APPLIED+
                </span>
                {logging !== g.id && (
                  <button className="lrn-btn tiny" onClick={() => setLogging(g.id)}>
                    Log evidence
                  </button>
                )}
              </footer>
              {logging === g.id && (
                <EvidenceForm
                  initial={{ skillIds: g.skillIds.filter((id) => skillById.has(id)), artifact: g.proof }}
                  onDone={() => setLogging(null)}
                />
              )}
            </li>
          );
        })}
      </ol>

      <h2>90-day plan</h2>
      <p className="lrn-note">
        Runs alongside the model-level roadmap (p1–p3 under Review &amp; data), not after it. Tick an
        artefact when it exists, not when it is started.
      </p>
      <div className="lrn-bm-plan">
        {phases.map((p) => {
          const done = p.artifacts.filter((_, i) => state.planDone[`${p.id}:${i}`]).length;
          return (
            <section key={p.id} className="lrn-bm-phase" data-phase={p.id}>
              <header>
                <strong>{p.window}</strong>
                {p.track && <span className={`lrn-bm-track t-${p.track}`}>{TRACK_LABEL[p.track]}</span>}
                <span className="lrn-dim">
                  {done}/{p.artifacts.length}
                </span>
              </header>
              <p className="lrn-bm-theme">{p.theme}</p>
              <ul className="lrn-milestones">
                {p.artifacts.map((a, i) => {
                  const key = `${p.id}:${i}`;
                  const on = Boolean(state.planDone[key]);
                  return (
                    <li key={key} className={on ? 'done' : ''}>
                      <label>
                        <input type="checkbox" checked={on} onChange={() => togglePlanItem(key)} data-plan={key} />
                        <span className="lrn-ms-title">{a}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      <h2>Research-track applications — 2027 intake</h2>
      <p className="lrn-note">
        Carry the AI &amp; Law applications with the compliance reviewer and the constraint-density
        paper; the speech applications with the diarization benchmark, the pseudo-labelling
        falsification and the romanized-WER critique.
      </p>
      <div className="lrn-scroll">
        <table className="lrn-table lrn-bm-apps">
          <thead>
            <tr>
              <th>Programme</th>
              <th>Track</th>
              <th>Fit</th>
              <th>Deadline and notes</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {PROGRAMMES.map((p) => (
              <tr key={p.id} data-programme={p.id}>
                <td className="lrn-bm-dim-name">
                  {p.url ? (
                    <a href={p.url} target="_blank" rel="noreferrer">
                      {p.name}
                    </a>
                  ) : (
                    p.name
                  )}
                </td>
                <td>{p.track}</td>
                <td className="lrn-dim">{p.fit}</td>
                <td>
                  {p.deadline}
                  {p.verify && <span className="lrn-bm-verify">verify on programme page</span>}
                </td>
                <td>
                  <select
                    value={state.applications[p.id] ?? 'not-started'}
                    onChange={(e) => setApplication(p.id, e.target.value as ApplicationStatus)}
                    aria-label={`${p.name} status`}
                  >
                    {(Object.keys(APPLICATION_STATUS_LABEL) as ApplicationStatus[]).map((k) => (
                      <option key={k} value={k}>
                        {APPLICATION_STATUS_LABEL[k]}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="lrn-note">{PROGRAMME_NOTE}</p>
    </div>
  );
}
