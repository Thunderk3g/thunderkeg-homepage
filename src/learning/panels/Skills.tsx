'use client';

import { useMemo, useState } from 'react';
import { useLearning } from '../store';
import { evidenceFor, impliedState, lanes, overclaimed, rank, stateIndex } from '../priority';
import { STATE_ORDER, type Domain, type KnowledgeState, type QueueLane, type Skill } from '../types';
import { Independence, Meter, StateBadge, fmtDate } from '../ui';

/* ───────────────────────── dependency chains ─────────────────────────
   A force-directed graph would look impressive and read badly. The
   dependencies here are near-linear chains, so render them as chains: it is
   the same information, legible on a phone, and no layout library. */

const CHAINS: { title: string; ids: string[] }[] = [
  {
    title: 'Training',
    ids: ['ml-math', 'linear-algebra', 'backprop', 'pytorch', 'autograd', 'training-loops', 'transformer-training', 'finetuning', 'lora', 'distributed-training'],
  },
  {
    title: 'Inference',
    ids: ['transformer-internals', 'attention-math', 'autoregressive-decoding', 'kv-cache', 'batching', 'continuous-batching', 'vllm', 'distributed-inference'],
  },
  {
    title: 'Speech',
    ids: ['speech-fundamentals', 'feature-representation', 'asr-architecture', 'ctc-seq2seq', 'asr-finetuning', 'wer-eval', 'indic-adaptation'],
  },
  {
    title: 'Systems',
    ids: ['python', 'closed-book-python', 'concurrency', 'networking', 'distributed-systems', 'system-design'],
  },
];

const LANE_BLURB: Record<QueueLane, string> = {
  NOW: 'The one skill allowed to dominate.',
  NEXT: 'Directly unlocked by NOW. Nothing else belongs here.',
  LATER: 'Important, currently premature — the prerequisites are not cleared.',
  MAINTAIN: 'Already evidenced. Occasional retrieval practice only.',
  IGNORE: 'Interesting, poor ROI right now. Leaving it here is the decision.',
};

export function SkillsPanel() {
  const state = useLearning();
  const { patchSkill, setCurrentSkill, recordCheck } = state;
  const [openId, setOpenId] = useState<string | null>(state.currentSkillId);
  const [domainFilter, setDomainFilter] = useState<Domain | 'all'>('all');

  const ranked = useMemo(() => rank(state), [state]);
  const queue = useMemo(() => lanes(state), [state]);
  const byId = useMemo(() => new Map(state.skills.map((s) => [s.id, s])), [state.skills]);
  const rankedById = useMemo(() => new Map(ranked.map((r) => [r.skill.id, r])), [ranked]);

  const open = openId ? byId.get(openId) : undefined;
  const openRank = openId ? rankedById.get(openId) : undefined;
  const openEvidence = open ? evidenceFor(state, open.id) : [];

  const domains = useMemo(
    () => Array.from(new Set(state.skills.map((s) => s.domain))).sort(),
    [state.skills],
  );

  return (
    <div className="lrn-skills">
      <div className="lrn-skills-main">
        <h2>Skill graph</h2>
        <p className="lrn-note">
          Chains, not a hairball — the dependencies are near-linear and a chain is readable. Click any
          node for its state, evidence, objective and AI-free check.
        </p>

        {CHAINS.map((chain) => (
          <div className="lrn-chain" key={chain.title}>
            <h4>{chain.title}</h4>
            <ol>
              {chain.ids.map((id) => {
                const s = byId.get(id);
                if (!s) return null;
                const r = rankedById.get(id);
                return (
                  <li key={id}>
                    <button
                      className={
                        'lrn-node' +
                        (openId === id ? ' open' : '') +
                        (state.currentSkillId === id ? ' current' : '') +
                        ` st-${s.state.toLowerCase()}`
                      }
                      onClick={() => setOpenId(id)}
                    >
                      <span className="lrn-node-name">{s.name}</span>
                      <span className="lrn-node-sub">
                        {s.state}
                        {r && r.blockedBy.length > 0 && ' · blocked'}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}

        <h2>Learning queue</h2>
        <p className="lrn-note">
          Breadth fragmentation is the failure mode this exists to prevent. Exactly one NOW; anything
          whose prerequisites are unmet falls to LATER automatically.
        </p>
        {(['NOW', 'NEXT', 'MAINTAIN', 'LATER', 'IGNORE'] as QueueLane[]).map((lane) => (
          <div className="lrn-lane" key={lane}>
            <div className="lrn-lane-head">
              <strong>{lane}</strong>
              <span>{LANE_BLURB[lane]}</span>
            </div>
            {queue[lane].length === 0 ? (
              <p className="lrn-empty">—</p>
            ) : (
              <ul className="lrn-lane-list">
                {queue[lane].slice(0, lane === 'MAINTAIN' || lane === 'LATER' || lane === 'IGNORE' ? 8 : 99).map((r) => (
                  <li key={r.skill.id}>
                    <button className="lrn-lane-item" onClick={() => setOpenId(r.skill.id)}>
                      <span>{r.skill.name}</span>
                      <span className="lrn-lane-meta">
                        p{r.priority.toFixed(1)} · unlocks {r.unlocks}
                        {r.blockedBy.length > 0 && ` · needs ${r.blockedBy.map((b) => b.name).join(', ')}`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}

        <h2>All skills</h2>
        <div className="lrn-filter">
          <button className={'lrn-chip' + (domainFilter === 'all' ? ' on' : '')} onClick={() => setDomainFilter('all')}>
            all
          </button>
          {domains.map((d) => (
            <button
              key={d}
              className={'lrn-chip' + (domainFilter === d ? ' on' : '')}
              onClick={() => setDomainFilter(d)}
            >
              {d}
            </button>
          ))}
        </div>
        <div className="lrn-scroll">
        <table className="lrn-table">
          <thead>
            <tr>
              <th>Skill</th>
              <th>State</th>
              <th>Unaided</th>
              <th>Conf</th>
              <th>Pri</th>
            </tr>
          </thead>
          <tbody>
            {ranked
              .filter((r) => domainFilter === 'all' || r.skill.domain === domainFilter)
              .map((r) => (
                <tr
                  key={r.skill.id}
                  className={openId === r.skill.id ? 'open' : ''}
                  onClick={() => setOpenId(r.skill.id)}
                >
                  <td>
                    {r.skill.name}
                    {overclaimed(r.skill, evidenceFor(state, r.skill.id)) && (
                      <span className="lrn-flag" title="Claimed state outruns the attached evidence">
                        overclaimed
                      </span>
                    )}
                  </td>
                  <td>
                    <StateBadge state={r.skill.state} />
                  </td>
                  <td>
                    <Independence value={r.skill.independent} />
                  </td>
                  <td>
                    <Meter value={r.skill.confidence} label={`confidence ${Math.round(r.skill.confidence * 100)}%`} />
                  </td>
                  <td className="lrn-num">{r.priority.toFixed(1)}</td>
                </tr>
              ))}
          </tbody>
        </table>
        </div>
      </div>

      <aside className="lrn-detail">
        {!open ? (
          <p className="lrn-empty">Select a skill.</p>
        ) : (
          <>
            <h3>{open.name}</h3>
            <p className="lrn-detail-domain">{open.domain}</p>
            <div className="lrn-detail-row">
              <StateBadge state={open.state} />
              <Independence value={open.independent} />
            </div>

            <dl className="lrn-kv">
              <dt>Why it matters</dt>
              <dd>
                Role importance {open.roleImportance}/5 · interview relevance {open.interviewRelevance}/5
                {openRank && ` · unlocks ${openRank.unlocks} downstream skills`}
              </dd>
              <dt>Depends on</dt>
              <dd>
                {open.deps.length === 0
                  ? 'nothing — workable now'
                  : open.deps.map((d) => byId.get(d)?.name ?? d).join(' · ')}
              </dd>
              {openRank && openRank.blockedBy.length > 0 && (
                <>
                  <dt>Blocked by</dt>
                  <dd className="lrn-warn">{openRank.blockedBy.map((b) => b.name).join(', ')}</dd>
                </>
              )}
              <dt>Objective</dt>
              <dd>{open.objective}</dd>
              <dt>AI-free check</dt>
              <dd className="lrn-check">{open.aiFreeCheck}</dd>
              <dt>Last practised</dt>
              <dd>
                {fmtDate(open.lastPracticed)} · next review {fmtDate(open.nextReview)}
              </dd>
              <dt>Evidence</dt>
              <dd>
                {openEvidence.length === 0 ? (
                  <span className="lrn-warn">
                    none — this state is an unverified self-assessment
                  </span>
                ) : (
                  <>
                    {openEvidence.length} item{openEvidence.length === 1 ? '' : 's'}; supports{' '}
                    <strong>{impliedState(openEvidence)}</strong>
                    <ul className="lrn-ev-mini">
                      {openEvidence.slice(0, 4).map((e) => (
                        <li key={e.id}>
                          {fmtDate(e.date)} · {e.artifact} · {e.assistance}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </dd>
            </dl>

            <div className="lrn-detail-actions">
              <label className="lrn-field">
                <span>Claimed state</span>
                <select
                  value={open.state}
                  onChange={(e) => patchSkill(open.id, { state: e.target.value as KnowledgeState })}
                >
                  {STATE_ORDER.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="lrn-field">
                <span>Queue lane (override)</span>
                <select
                  value={open.lane ?? ''}
                  onChange={(e) =>
                    patchSkill(open.id, { lane: (e.target.value || undefined) as QueueLane | undefined })
                  }
                >
                  <option value="">auto</option>
                  {(['NEXT', 'LATER', 'MAINTAIN', 'IGNORE'] as QueueLane[]).map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label className="lrn-field">
                <span>Confidence in this estimate — {Math.round(open.confidence * 100)}%</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(open.confidence * 100)}
                  onChange={(e) => patchSkill(open.id, { confidence: Number(e.target.value) / 100 })}
                />
              </label>

              <div className="lrn-btn-row">
                <button className="lrn-btn primary" onClick={() => setCurrentSkill(open.id)}>
                  Make this the current deep skill
                </button>
              </div>
              <p className="lrn-note">
                Record the AI-free check honestly — it is the only thing that sets independence, and a
                failure is more useful than a skipped attempt.
              </p>
              <div className="lrn-btn-row">
                <button className="lrn-btn ok" onClick={() => recordCheck(open.id, true)}>
                  Passed unaided
                </button>
                <button className="lrn-btn bad" onClick={() => recordCheck(open.id, false)}>
                  Failed unaided
                </button>
              </div>
              {stateIndex(open.state) >= STATE_ORDER.indexOf('INTERNALIZED') &&
                open.independent !== true && (
                  <p className="lrn-warn">
                    Claimed {open.state} without a passed AI-free check. An agent producing a working
                    implementation does not establish this.
                  </p>
                )}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

export type { Skill };
