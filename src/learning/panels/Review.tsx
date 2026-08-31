'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { useLearning } from '../store';
import { dueForReview, evidenceFor, impliedState, overclaimed } from '../priority';
import { Field, fmtDate } from '../ui';

const EMPTY = {
  built: '',
  canDoWithoutAi: '',
  failedToReproduce: '',
  raised: '',
  lowered: '',
  bottleneck: '',
  projectStillBest: '',
  dropped: '',
};

export function ReviewPanel() {
  const state = useLearning();
  const { addReassessment, exportJson, importJson, reset, recordCheck } = state;
  const [form, setForm] = useState(EMPTY);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const due = dueForReview(state);
  const overclaims = state.skills.filter((s) => overclaimed(s, evidenceFor(state, s.id)));
  const lastMonth = state.lastReassessedAt ?? '';
  const monthsSince = lastMonth
    ? Math.floor((Date.now() - Date.parse(lastMonth)) / (1000 * 60 * 60 * 24 * 30))
    : null;

  const download = () => {
    const blob = new Blob([exportJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `learning-os-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported', { description: 'Your learning history is portable JSON.' });
  };

  const upload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = importJson(String(reader.result));
      if (res.ok) toast.success('Imported');
      else toast.error('Import failed', { description: res.error });
    };
    reader.readAsText(file);
  };

  return (
    <div className="lrn-review">
      <h2>Spaced retrieval</h2>
      <p className="lrn-note">
        Engineering retrieval, not flashcards: re-run the AI-free check from memory. Intervals stretch
        with demonstrated independence and collapse on a failure.
      </p>
      {due.length === 0 ? (
        <p className="lrn-empty">Nothing due. Reviews get scheduled when you record a check result.</p>
      ) : (
        <ul className="lrn-due">
          {due.map((s) => (
            <li key={s.id}>
              <div>
                <strong>{s.name}</strong>
                <em>{s.aiFreeCheck}</em>
                <span className="lrn-due-date">due {fmtDate(s.nextReview)}</span>
              </div>
              <div className="lrn-btn-row">
                <button className="lrn-btn ok" onClick={() => recordCheck(s.id, true)}>
                  Recalled
                </button>
                <button className="lrn-btn bad" onClick={() => recordCheck(s.id, false)}>
                  Could not
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h2>Roadmap</h2>
      <p className="lrn-note">
        Relative phases, not calendar dates — the roadmap moves when evidence moves, not when a month
        ends.
      </p>
      <ol className="lrn-roadmap">
        {state.roadmap.map((p) => {
          const skills = p.skillIds.map((id) => state.skills.find((s) => s.id === id)).filter(Boolean);
          const evidenced = skills.filter((s) => s && evidenceFor(state, s.id).length > 0).length;
          return (
            <li key={p.id}>
              <header>
                <strong>{p.window}</strong>
                <span>{p.theme}</span>
                <span className="lrn-roadmap-count">
                  {evidenced}/{skills.length} skills evidenced
                </span>
              </header>
              <ul>
                {p.artifacts.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </li>
          );
        })}
      </ol>

      <h2>Monthly reassessment</h2>
      <p className="lrn-note">
        {monthsSince === null
          ? 'Never run. Do it once you have evidence to judge against.'
          : `Last run ${fmtDate(lastMonth)} (${monthsSince} month${monthsSince === 1 ? '' : 's'} ago).`}{' '}
        Estimates are allowed to go down. That is the point.
      </p>

      {overclaims.length > 0 && (
        <div className="lrn-callout warn">
          <strong>Before you start:</strong> {overclaims.length} skill
          {overclaims.length === 1 ? '' : 's'} claim a state the evidence does not support —{' '}
          {overclaims
            .slice(0, 4)
            .map((s) => `${s.name} (claimed ${s.state}, evidence supports ${impliedState(evidenceFor(state, s.id))})`)
            .join('; ')}
          .
        </div>
      )}

      <div className="lrn-form">
        <Field label="What did I actually build?" value={form.built} onChange={(v) => setForm({ ...form, built: v })} area />
        <Field label="What can I now do without AI?" value={form.canDoWithoutAi} onChange={(v) => setForm({ ...form, canDoWithoutAi: v })} area />
        <Field label="What did I think I knew but fail to reproduce?" value={form.failedToReproduce} onChange={(v) => setForm({ ...form, failedToReproduce: v })} area />
        <Field label="Which estimates should go UP? (one per line)" value={form.raised} onChange={(v) => setForm({ ...form, raised: v })} area />
        <Field label="Which should go DOWN? (one per line)" value={form.lowered} onChange={(v) => setForm({ ...form, lowered: v })} area />
        <Field label="Biggest bottleneck now" value={form.bottleneck} onChange={(v) => setForm({ ...form, bottleneck: v })} area />
        <Field label="Is the current main project still highest-ROI?" value={form.projectStillBest} onChange={(v) => setForm({ ...form, projectStillBest: v })} area />
        <Field label="What should be dropped from the roadmap?" value={form.dropped} onChange={(v) => setForm({ ...form, dropped: v })} area />
        <div className="lrn-btn-row">
          <button
            className="lrn-btn primary"
            disabled={!form.built.trim()}
            onClick={() => {
              addReassessment({
                built: form.built,
                canDoWithoutAi: form.canDoWithoutAi,
                failedToReproduce: form.failedToReproduce,
                raised: form.raised.split('\n').filter(Boolean),
                lowered: form.lowered.split('\n').filter(Boolean),
                bottleneck: form.bottleneck,
                projectStillBest: form.projectStillBest,
                dropped: form.dropped,
              });
              setForm(EMPTY);
              toast.success('Reassessment recorded');
            }}
          >
            Record reassessment
          </button>
        </div>
      </div>

      {state.reassessments.length > 0 && (
        <ul className="lrn-history">
          {state.reassessments.map((r) => (
            <li key={r.id}>
              <strong>{fmtDate(r.date)}</strong>
              <p>
                <em>Built:</em> {r.built}
              </p>
              <p>
                <em>Bottleneck:</em> {r.bottleneck}
              </p>
              {r.lowered.length > 0 && (
                <p>
                  <em>Lowered:</em> {r.lowered.join(', ')}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <h2>Data</h2>
      <p className="lrn-note">
        Everything lives in this browser&rsquo;s localStorage — nothing is sent to a server, so the
        record is private by construction. Export keeps it portable if that ever changes.
      </p>
      <div className="lrn-btn-row">
        <button className="lrn-btn" onClick={download}>
          Export JSON
        </button>
        <button className="lrn-btn" onClick={() => fileRef.current?.click()}>
          Import JSON
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.target.value = '';
          }}
        />
        <button
          className="lrn-btn bad"
          onClick={() => {
            if (confirm('Reset the Learning OS to the seed profile? This deletes all recorded evidence.')) {
              reset();
              toast.success('Reset to seed profile');
            }
          }}
        >
          Reset to seed
        </button>
      </div>
    </div>
  );
}
