'use client';

import { useState } from 'react';
import { useLearning } from '../store';
import { portfolioTargets } from '../priority';
import {
  ASSISTANCE_LABEL,
  PROJECT_STAGES,
  type AiAssistance,
  type EvidenceKind,
  type ProjectStage,
} from '../types';
import { Field, fmtDate } from '../ui';

const KINDS: EvidenceKind[] = [
  'implementation',
  'benchmark',
  'experiment',
  'notebook',
  'memo',
  'blog',
  'diagram',
  'interview',
  'paper-notes',
  'production',
  'commit',
];

function EvidenceForm({ onDone }: { onDone: () => void }) {
  const skills = useLearning((s) => s.skills);
  const addEvidence = useLearning((s) => s.addEvidence);

  const [skillIds, setSkillIds] = useState<string[]>([]);
  const [kind, setKind] = useState<EvidenceKind>('implementation');
  const [artifact, setArtifact] = useState('');
  const [url, setUrl] = useState('');
  const [didMyself, setDidMyself] = useState('');
  const [assistance, setAssistance] = useState<AiAssistance>('none');
  const [whatFailed, setWhatFailed] = useState('');
  const [whatLearned, setWhatLearned] = useState('');
  const [result, setResult] = useState('');
  const [confidence, setConfidence] = useState(0.6);
  const [negative, setNegative] = useState(false);

  const valid = artifact.trim() && whatLearned.trim() && skillIds.length > 0;

  return (
    <div className="lrn-form">
      <label className="lrn-field">
        <span>Skills this is evidence for</span>
        <select
          multiple
          size={6}
          value={skillIds}
          onChange={(e) => setSkillIds(Array.from(e.target.selectedOptions, (o) => o.value))}
        >
          {skills.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      <div className="lrn-form-row">
        <label className="lrn-field">
          <span>Kind</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as EvidenceKind)}>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <label className="lrn-field">
          <span>AI assistance — be honest, this is the whole point</span>
          <select value={assistance} onChange={(e) => setAssistance(e.target.value as AiAssistance)}>
            {(Object.keys(ASSISTANCE_LABEL) as AiAssistance[]).map((a) => (
              <option key={a} value={a}>
                {ASSISTANCE_LABEL[a]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <Field label="Artifact" value={artifact} onChange={setArtifact} placeholder="kv_cache.py + bench.md" />
      <Field label="Link (optional)" value={url} onChange={setUrl} placeholder="https://github.com/…" />
      <Field label="What I personally did" value={didMyself} onChange={setDidMyself} area placeholder="Wrote the cache and the benchmark loop from an empty file; the plotting was generated." />
      <Field label="What failed" value={whatFailed} onChange={setWhatFailed} area placeholder="First version cached the wrong axis — decode got slower." />
      <Field label="What I learned" value={whatLearned} onChange={setWhatLearned} area />
      <Field label="Measurable result" value={result} onChange={setResult} placeholder="p50 decode 41ms → 12ms at 512 ctx" />

      <label className="lrn-field">
        <span>Confidence after producing this — {Math.round(confidence * 100)}%</span>
        <input type="range" min={0} max={100} value={Math.round(confidence * 100)} onChange={(e) => setConfidence(Number(e.target.value) / 100)} />
      </label>
      <label className="lrn-checkbox">
        <input type="checkbox" checked={negative} onChange={(e) => setNegative(e.target.checked)} />
        <span>Rigorous negative result (counts fully — the experiment was sound, the answer was no)</span>
      </label>

      <div className="lrn-btn-row">
        <button
          className="lrn-btn primary"
          disabled={!valid}
          onClick={() => {
            addEvidence({
              date: new Date().toISOString().slice(0, 10),
              skillIds,
              kind,
              artifact,
              url: url || undefined,
              didMyself,
              assistance,
              whatFailed: whatFailed || undefined,
              whatLearned,
              result: result || undefined,
              confidence,
              negative,
            });
            onDone();
          }}
        >
          Record evidence
        </button>
        <button className="lrn-btn" onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export function BuildPanel() {
  const state = useLearning();
  const { setProjectStage, toggleMilestone, removeEvidence } = state;
  const [adding, setAdding] = useState(false);
  const targets = portfolioTargets(state);

  const month = new Date().toISOString().slice(0, 7);
  const thisMonth = state.evidence.filter((e) => e.date.startsWith(month));

  return (
    <div className="lrn-build">
      <h2>Projects</h2>
      <p className="lrn-note">
        Learning attaches to artifacts. Each milestone declares what you must implement and what an
        agent may do — that split is what makes the finished project evidence rather than output.
      </p>

      {state.projects.map((p) => {
        const done = p.milestones.filter((m) => m.done).length;
        return (
          <article className="lrn-project" key={p.id}>
            <header>
              <h3>
                {p.name}
                {p.primary && <span className="lrn-tag">primary</span>}
              </h3>
              <select value={p.stage} onChange={(e) => setProjectStage(p.id, e.target.value as ProjectStage)}>
                {PROJECT_STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </header>
            <div className="lrn-stages">
              {PROJECT_STAGES.map((s) => (
                <span key={s} className={'lrn-stage' + (PROJECT_STAGES.indexOf(p.stage) >= PROJECT_STAGES.indexOf(s) ? ' on' : '')}>
                  {s}
                </span>
              ))}
            </div>
            <p className="lrn-project-obj">{p.objective}</p>

            <dl className="lrn-kv tight">
              <dt>Proves</dt>
              <dd>{p.proves.map((id) => state.skills.find((s) => s.id === id)?.name ?? id).join(' · ')}</dd>
              <dt>Evaluation</dt>
              <dd>{p.evaluation}</dd>
              <dt>Artifact</dt>
              <dd>{p.artifact}</dd>
              <dt>Interview value</dt>
              <dd>{p.interviewValue}</dd>
              {p.researchPotential && (
                <>
                  <dt>Research</dt>
                  <dd>{p.researchPotential}</dd>
                </>
              )}
            </dl>

            <p className="lrn-milestone-count">
              {done} / {p.milestones.length} milestones
            </p>
            <ul className="lrn-milestones">
              {p.milestones.map((m) => (
                <li key={m.id} className={m.done ? 'done' : ''}>
                  <label>
                    <input type="checkbox" checked={m.done} onChange={() => toggleMilestone(p.id, m.id)} />
                    <span className="lrn-ms-title">{m.title}</span>
                  </label>
                  <span className="lrn-ms-split">
                    <strong>you:</strong> {m.mine} <strong>agents:</strong> {m.agentOk}
                  </span>
                </li>
              ))}
            </ul>
          </article>
        );
      })}

      <h2>Evidence</h2>
      <p className="lrn-note">
        {thisMonth.length} item{thisMonth.length === 1 ? '' : 's'} this month. Evidence is what moves a
        skill estimate — in either direction. Hours spent move nothing.
      </p>
      {adding ? (
        <EvidenceForm onDone={() => setAdding(false)} />
      ) : (
        <button className="lrn-btn primary" onClick={() => setAdding(true)}>
          + Record evidence
        </button>
      )}

      {state.evidence.length === 0 ? (
        <p className="lrn-empty">
          Nothing recorded yet — which is why every skill estimate on this page is still a hypothesis.
        </p>
      ) : (
        <ul className="lrn-evidence">
          {state.evidence.map((e) => (
            <li key={e.id}>
              <div className="lrn-ev-head">
                <strong>{e.artifact}</strong>
                <span>
                  {fmtDate(e.date)} · {e.kind} · {e.assistance}
                  {e.negative && <span className="lrn-tag neg">negative result</span>}
                </span>
              </div>
              <p>
                <em>Did myself:</em> {e.didMyself || '—'}
              </p>
              {e.whatFailed && (
                <p>
                  <em>Failed:</em> {e.whatFailed}
                </p>
              )}
              <p>
                <em>Learned:</em> {e.whatLearned}
              </p>
              {e.result && (
                <p>
                  <em>Result:</em> {e.result}
                </p>
              )}
              <div className="lrn-ev-foot">
                {e.skillIds.map((id) => (
                  <span key={id} className="lrn-tag">
                    {state.skills.find((s) => s.id === id)?.name ?? id}
                  </span>
                ))}
                {e.url && (
                  <a href={e.url} target="_blank" rel="noreferrer">
                    link
                  </a>
                )}
                <button className="lrn-btn tiny" onClick={() => removeEvidence(e.id)}>
                  delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h2>Public evidence vs target role</h2>
      <p className="lrn-note">Depth, not repository count. Each row is met or it is not.</p>
      <ul className="lrn-targets">
        {targets.map((t) => (
          <li key={t.label} className={t.met ? 'met' : ''}>
            <span className="lrn-target-mark">{t.met ? '✓' : '○'}</span>
            <span>
              <strong>{t.label}</strong>
              <em>{t.why}</em>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
