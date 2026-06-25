'use client';

import { useEffect, useRef, useState } from 'react';
import type { AppDefinition } from '../../types';
import { streamChat, type ChatMsg } from '../../ai/stream';

const SUGGESTIONS = [
  'What does Diwakar do at Bajaj Life?',
  'Summarize his AI/ML experience',
  'What are his strongest skills?',
  'Tell me about his projects',
];

function AssistantApp() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState('');
  const [streaming, setStreaming] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, streaming]);

  const sendText = async (q: string) => {
    const question = q.trim();
    if (!question || busy) return;
    const next: ChatMsg[] = [...messages, { role: 'user', content: question }];
    setMessages(next);
    setDraft('');
    setBusy(true);
    setStreaming('');
    let acc = '';
    const { text, error } = await streamChat(next, (d) => {
      acc += d;
      setStreaming(acc);
    });
    setStreaming('');
    setMessages([...next, { role: 'assistant', content: error ? '⚠ ' + error : text || acc }]);
    setBusy(false);
  };

  return (
    <div className="kos-assistant">
      <div className="kos-assistant-log" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="kos-assistant-welcome">
            <div className="kos-assistant-avatar">🤖</div>
            <h3>Portfolio Assistant</h3>
            <p>Ask me anything about Diwakar — experience, skills, projects.</p>
            <div className="kos-assistant-suggest">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => sendText(s)}>{s}</button>
              ))}
            </div>
            <p className="kos-assistant-hint">
              Needs <code>LLM_API_KEY</code> in <code>.env.local</code> (Groq/OpenAI). Otherwise it stays offline.
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={'kos-assistant-msg ' + m.role}>
            <span className="kos-assistant-role">{m.role === 'user' ? '🧑' : '🤖'}</span>
            <div className="kos-assistant-bubble">{m.content}</div>
          </div>
        ))}
        {streaming && (
          <div className="kos-assistant-msg assistant">
            <span className="kos-assistant-role">🤖</span>
            <div className="kos-assistant-bubble">{streaming}<span className="kos-assistant-caret">▋</span></div>
          </div>
        )}
      </div>
      <form
        className="kos-assistant-input"
        onSubmit={(e) => {
          e.preventDefault();
          void sendText(draft);
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={busy ? 'Thinking…' : 'Ask about Diwakar…'}
          disabled={busy}
          aria-label="assistant prompt"
        />
        <button type="submit" disabled={busy || !draft.trim()} className="kos-game-btn primary">
          Send
        </button>
      </form>
    </div>
  );
}

export const assistantApp: AppDefinition = {
  id: 'assistant',
  title: 'AI Assistant',
  icon: '🤖',
  category: 'Development',
  component: AssistantApp,
  description: 'LLM assistant that answers questions about Diwakar',
  defaultSize: { width: 520, height: 560 },
  minSize: { width: 340, height: 380 },
  desktop: true,
  launchCommands: ['assistant', 'chatbot'],
};

export default AssistantApp;
