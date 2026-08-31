'use client';

import { useRef, useState } from 'react';
import { useLearning } from '../store';
import { COACH_PROMPTS, coachContext, offlineCoach } from '../coach';
import { streamChat, type ChatMsg } from '@/os/ai/stream';
import { fmtDate } from '../ui';

export function CoachPanel() {
  const state = useLearning();
  const { startSession, completeSession } = state;
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState('');
  const [streaming, setStreaming] = useState('');
  const [busy, setBusy] = useState(false);
  const logRef = useRef<HTMLDivElement | null>(null);

  const currentSkill = state.skills.find((s) => s.id === state.currentSkillId);
  const openSession = state.sessions.find((s) => !s.completed);

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
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
      <h2>Daily session</h2>
      {openSession ? (
        <article className="lrn-session">
          <header>
            <strong>{state.skills.find((s) => s.id === openSession.skillId)?.name}</strong>
            <span>{fmtDate(openSession.date)}</span>
          </header>
          <p className="lrn-session-goal">{openSession.goal}</p>
          <ol className="lrn-session-steps">
            {openSession.steps.map((s, i) => (
              <li key={i}>
                <span className="lrn-session-min">{s.minutes} min</span>
                <span>
                  <strong>{s.label}</strong>
                  <em>{s.detail}</em>
                </span>
              </li>
            ))}
          </ol>
          <p className="lrn-session-ev">
            <strong>Evidence produced:</strong> {openSession.evidenceTarget}
          </p>
          <button className="lrn-btn primary" onClick={() => completeSession(openSession.id)}>
            Session done — now record the evidence
          </button>
        </article>
      ) : (
        <div className="lrn-session-start">
          <p className="lrn-note">
            60 minutes, weighted the way the loop is: understand → implement unaided → verify →
            explain. It always ends in an artifact, so there is nothing to plan.
          </p>
          <button
            className="lrn-btn primary big"
            onClick={() => currentSkill && startSession(currentSkill.id)}
            disabled={!currentSkill}
          >
            START LEARNING SESSION
            {currentSkill && <span> — {currentSkill.name}</span>}
          </button>
        </div>
      )}

      {state.sessions.filter((s) => s.completed).length > 0 && (
        <p className="lrn-note">
          {state.sessions.filter((s) => s.completed).length} completed session
          {state.sessions.filter((s) => s.completed).length === 1 ? '' : 's'} on record.
        </p>
      )}

      <h2>Coach</h2>
      <p className="lrn-note">
        It reads your skill graph, evidence log and project state — and it is instructed not to
        flatter you. With no model key configured it still answers, computing from the same priority
        model this dashboard renders.
      </p>

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
          <button key={p} onClick={() => void ask(p)} disabled={busy}>
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
          placeholder={busy ? 'Thinking…' : 'Ask the coach…'}
          disabled={busy}
          aria-label="coach prompt"
        />
        <button className="lrn-btn primary" type="submit" disabled={busy || !draft.trim()}>
          Ask
        </button>
      </form>
    </div>
  );
}
