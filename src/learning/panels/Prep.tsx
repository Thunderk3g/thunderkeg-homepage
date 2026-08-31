'use client';

import { useState } from 'react';
import { useLearning } from '../store';
import type { ResourceState } from '../types';
import { Field, Scale } from '../ui';

const RESOURCE_STATES: ResourceState[] = [
  'needed-now',
  'supporting-build',
  'interview-prep',
  'deep-dive',
  'later',
  'completed',
];

export function PrepPanel() {
  const state = useLearning();
  const { patchInterview, patchStory, patchResource } = state;
  const [openStory, setOpenStory] = useState<string | null>(null);
  const [openResource, setOpenResource] = useState<string | null>(null);

  return (
    <div className="lrn-prep">
      <h2>Interview readiness</h2>
      <p className="lrn-note">
        Four axes, tracked separately, because they fail separately. Knowing a mechanism, implementing
        it under time pressure, and explaining it out loud are three different skills.
      </p>
      <div className="lrn-scroll">
      <table className="lrn-table iv">
        <thead>
          <tr>
            <th>Domain</th>
            <th>Knowledge</th>
            <th>Implementation</th>
            <th>Explanation</th>
            <th>Confidence</th>
          </tr>
        </thead>
        <tbody>
          {state.interview.map((d) => (
            <tr key={d.id}>
              <td>{d.name}</td>
              <td>
                <Scale value={d.knowledge} label={`${d.name} knowledge`} onChange={(v) => patchInterview(d.id, { knowledge: v })} />
              </td>
              <td>
                <Scale value={d.implementation} label={`${d.name} implementation`} onChange={(v) => patchInterview(d.id, { implementation: v })} />
              </td>
              <td>
                <Scale value={d.explanation} label={`${d.name} explanation`} onChange={(v) => patchInterview(d.id, { explanation: v })} />
              </td>
              <td>
                <Scale value={d.confidence} label={`${d.name} confidence`} onChange={(v) => patchInterview(d.id, { confidence: v })} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      <h2>Story bank</h2>
      <p className="lrn-note">
        Real projects only. The follow-up questions are the part interviews actually turn on — write
        the answer before someone asks it.
      </p>
      <ul className="lrn-stories">
        {state.stories.map((s) => {
          const filled = [s.situation, s.decision, s.result].filter(Boolean).length;
          return (
            <li key={s.id}>
              <button className="lrn-story-head" onClick={() => setOpenStory(openStory === s.id ? null : s.id)}>
                <span>
                  <strong>{s.title}</strong>
                  <em>{s.category}</em>
                </span>
                <span className={'lrn-story-state' + (filled === 3 ? ' ok' : '')}>
                  {filled === 0 ? 'empty' : filled === 3 ? 'ready' : 'partial'}
                </span>
              </button>
              {openStory === s.id && (
                <div className="lrn-story-body">
                  <Field label="Situation" value={s.situation} onChange={(v) => patchStory(s.id, { situation: v })} area />
                  <Field label="Problem" value={s.problem} onChange={(v) => patchStory(s.id, { problem: v })} area />
                  <Field label="Constraints" value={s.constraints} onChange={(v) => patchStory(s.id, { constraints: v })} area />
                  <Field label="My decision" value={s.decision} onChange={(v) => patchStory(s.id, { decision: v })} area />
                  <Field label="Alternatives considered" value={s.alternatives} onChange={(v) => patchStory(s.id, { alternatives: v })} area />
                  <Field label="Technical implementation" value={s.implementation} onChange={(v) => patchStory(s.id, { implementation: v })} area />
                  <Field label="Measured result" value={s.result} onChange={(v) => patchStory(s.id, { result: v })} area />
                  <Field label="Failure / lesson" value={s.lesson} onChange={(v) => patchStory(s.id, { lesson: v })} area />
                  <Field label="What I personally owned" value={s.owned} onChange={(v) => patchStory(s.id, { owned: v })} area />
                  <div className="lrn-followups">
                    <span>Expect to be asked:</span>
                    <ul>
                      {s.followUps.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <h2>Reading queue</h2>
      <p className="lrn-note">
        Every resource carries a reason. No “100 papers every ML engineer should read” — a list with no
        reason is a list you will not finish.
      </p>
      <ul className="lrn-resources">
        {state.resources.map((r) => (
          <li key={r.id} className={r.state === 'completed' ? 'done' : ''}>
            <div className="lrn-res-head">
              <button onClick={() => setOpenResource(openResource === r.id ? null : r.id)}>
                <strong>{r.title}</strong>
              </button>
              <select value={r.state} onChange={(e) => patchResource(r.id, { state: e.target.value as ResourceState })}>
                {RESOURCE_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <p className="lrn-res-reason">{r.reason}</p>
            {r.url && (
              <a className="lrn-res-link" href={r.url} target="_blank" rel="noreferrer">
                {r.url}
              </a>
            )}
            {openResource === r.id && (
              <div className="lrn-res-body">
                <Field
                  label="Three things I learned (one per line)"
                  value={(r.learned ?? []).join('\n')}
                  onChange={(v) => patchResource(r.id, { learned: v.split('\n') })}
                  area
                />
                <Field
                  label="One thing I disagree with or don't understand"
                  value={r.disagreed ?? ''}
                  onChange={(v) => patchResource(r.id, { disagreed: v })}
                  area
                />
                <Field
                  label="One thing I can now build differently"
                  value={r.buildDifferently ?? ''}
                  onChange={(v) => patchResource(r.id, { buildDifferently: v })}
                  area
                />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
