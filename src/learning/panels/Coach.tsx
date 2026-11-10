'use client';

import { useRef, useState } from 'react';
import { useLearning } from '../store';
import { COACH_PROMPTS, coachContext, offlineCoach } from '../coach';
import { phasesFor } from '../schedule';
import { streamChat, type ChatMsg } from '@/os/ai/stream';

export function CoachPanel({ onToday }: { onToday?: () => void }) {
  const state = useLearning();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState('');
  const [streaming, setStreaming] = useState('');
  const [busy, setBusy] = useState(false);
  const logRef = useRef<HTMLDivElement | null>(null);

  // The unaided steps of a check are unaided by definition, so the coach is
  // shut for them and until the outcome is in. It stays open for the
  // "understand" step, where asking why is the kind of AI use that helps.
  const run = state.activeRun;
  const runSkill = run ? state.skills.find((s) => s.id === run.skillId) : undefined;
  const runPhases = run && runSkill ? phasesFor(runSkill, run.kind) : [];
  const locked = !!run && !!runSkill && (run.phase >= runPhases.length || !!runPhases[run.phase].unaided);
  const lockedSkill = locked ? runSkill : undefined;

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || busy || locked) return;
    setBusy(true);
    setDraft('');
    const next: ChatMsg[] = [...messages, { role: 'user', content: q }];
    setMessages(next);
    setStreaming('');

    // Only a computed summary leaves the browser, and only on this click.
    const payload: ChatMsg[] = [
      { role: 'user', content: `SNAPSHOT\n${coachContext(state)}\n\nQUESTION\n${q}` },
    ];
    let acc = '';
    const { text } = await streamChat(
      payload,
      (d) => {
        acc += d;
        setStreaming(acc);
        if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
      },
      { mode: 'coach', offline: () => offlineCoach(q, state) },
    );
    setStreaming('');
    setMessages([...next, { role: 'assistant', content: text || acc }]);
    setBusy(false);
  };

  return (
    <div className="lrn-coach">
      <h2>Coach</h2>
      <p className="lrn-note">
        It reads your skill graph, evidence log and project state — and it is instructed not to
        flatter you. With no model key configured it still answers, computing from the same priority
        model this dashboard renders.
      </p>

      {locked && (
        <p className="lrn-td-locked" role="status">
          Locked while you work on <strong>{lockedSkill?.name ?? 'the check'}</strong> without AI. It opens again for
          the reading step and once the outcome is recorded; ask it then what you got wrong.{' '}
          {onToday && (
            <button className="lrn-btn tiny" onClick={onToday}>
              Back to the check
            </button>
          )}
        </p>
      )}

      <div className="lrn-coach-log" ref={logRef}>
        {messages.length === 0 && !streaming && (
          <p className="lrn-empty">Ask something specific. Vague questions get vague coaching.</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={'lrn-msg ' + m.role}>
            <span className="lrn-msg-role">{m.role === 'user' ? 'you' : 'coach'}</span>
            <pre>{m.content}</pre>
          </div>
        ))}
        {streaming && (
          <div className="lrn-msg assistant">
            <span className="lrn-msg-role">coach</span>
            <pre>
              {streaming}
              <span className="kos-assistant-caret">▋</span>
            </pre>
          </div>
        )}
      </div>

      <div className="lrn-coach-suggest">
        {COACH_PROMPTS.map((p) => (
          <button key={p} onClick={() => void ask(p)} disabled={busy || locked}>
            {p}
          </button>
        ))}
      </div>

      <form
        className="lrn-coach-input"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(draft);
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={locked ? 'Locked during the attempt' : busy ? 'Thinking…' : 'Ask the coach…'}
          disabled={busy || locked}
          aria-label="coach prompt"
        />
        <button className="lrn-btn primary" type="submit" disabled={busy || locked || !draft.trim()}>
          Ask
        </button>
      </form>
    </div>
  );
}
