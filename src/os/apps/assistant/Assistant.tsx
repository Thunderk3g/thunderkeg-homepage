'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, Square, Volume2 } from 'lucide-react';
import type { AppDefinition } from '../../types';
import { streamChat, type ChatMsg } from '../../ai/stream';

const SUGGESTIONS = [
  'What does Diwakar do at Bajaj Life?',
  'What is his compliance retrieval work?',
  'What research is he doing on speech?',
  'What is he applying to study?',
  'How do I contact him?',
];

const AUTO_SPEAK_KEY = 'kos-assistant-speak';

/* Minimal structural types for the browser SpeechRecognition API. */
interface SRResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface SREvent {
  resultIndex: number;
  results: { length: number; [i: number]: SRResult };
}
interface SRInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((ev: SREvent) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SRCtor = new () => SRInstance;

function speechRecognitionCtor(): SRCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** what a reply sounds like read aloud: no markdown punctuation, no warning glyphs */
function speakable(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' (code omitted) ')
    .replace(/[`*_#>⚠]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function readPref(): boolean {
  try {
    return localStorage.getItem(AUTO_SPEAK_KEY) === '1';
  } catch {
    return false;
  }
}

function AssistantApp() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState('');
  const [streaming, setStreaming] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  /* speech: dictation in, read-aloud out (both hidden where the browser lacks them) */
  const [canListen, setCanListen] = useState(false);
  const [canSpeak, setCanSpeak] = useState(false);
  const [listening, setListening] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);
  const recogRef = useRef<SRInstance | null>(null);

  useEffect(() => {
    setCanListen(Boolean(speechRecognitionCtor()));
    setCanSpeak(typeof window !== 'undefined' && 'speechSynthesis' in window);
    setAutoSpeak(readPref());
    return () => {
      try {
        recogRef.current?.abort();
        window.speechSynthesis?.cancel();
      } catch {
        /* ignore */
      }
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, streaming]);

  const speak = useCallback(
    (idx: number, text: string) => {
      if (!canSpeak) return;
      const synth = window.speechSynthesis;
      synth.cancel();
      if (speakingIdx === idx) {
        setSpeakingIdx(null);
        return;
      }
      const u = new SpeechSynthesisUtterance(speakable(text));
      u.lang = 'en-US';
      u.onend = u.onerror = () => setSpeakingIdx((cur) => (cur === idx ? null : cur));
      setSpeakingIdx(idx);
      synth.speak(u);
    },
    [canSpeak, speakingIdx],
  );

  const sendText = async (q: string) => {
    const question = q.trim();
    if (!question || busy) return;
    recogRef.current?.stop();
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
    const reply = error ? '⚠ ' + error : text || acc;
    setMessages([...next, { role: 'assistant', content: reply }]);
    setBusy(false);
    if (autoSpeak && !error) speak(next.length, reply);
  };

  const toggleMic = () => {
    if (listening) {
      recogRef.current?.stop();
      return;
    }
    const Ctor = speechRecognitionCtor();
    if (!Ctor) return;
    const recog = new Ctor();
    recog.lang = 'en-US';
    recog.continuous = false;
    recog.interimResults = true;
    const base = draft.trim() ? draft.trim() + ' ' : '';
    recog.onresult = (ev) => {
      let heard = '';
      for (let i = 0; i < ev.results.length; i++) heard += ev.results[i][0]?.transcript ?? '';
      setDraft(base + heard.trim());
    };
    recog.onerror = (ev) =>
      setMicError(ev.error === 'not-allowed' ? 'Microphone access was blocked.' : `Dictation stopped (${ev.error}).`);
    recog.onend = () => {
      setListening(false);
      recogRef.current = null;
      inputRef.current?.focus();
    };
    recogRef.current = recog;
    setMicError(null);
    try {
      recog.start();
      setListening(true);
    } catch {
      setMicError('Dictation could not start.');
    }
  };

  const toggleAutoSpeak = (on: boolean) => {
    setAutoSpeak(on);
    if (!on) {
      window.speechSynthesis?.cancel();
      setSpeakingIdx(null);
    }
    try {
      localStorage.setItem(AUTO_SPEAK_KEY, on ? '1' : '0');
    } catch {
      /* private mode: the toggle just won't persist */
    }
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
                <button key={s} onClick={() => sendText(s)}>
                  {s}
                </button>
              ))}
            </div>
            <p className="kos-assistant-hint">
              With <code>LLM_API_KEY</code> set (Groq/OpenAI-compatible) this talks to a model. Without one it still
              answers — by keyword search over the résumé, quoting it verbatim.
              {canListen && ' Use the mic to dictate a question.'}
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={'kos-assistant-msg ' + m.role}>
            <span className="kos-assistant-role">{m.role === 'user' ? '🧑' : '🤖'}</span>
            <div className="kos-assistant-bubble">{m.content}</div>
            {m.role === 'assistant' && canSpeak && (
              <button
                type="button"
                className={'kos-assistant-speak' + (speakingIdx === i ? ' on' : '')}
                onClick={() => speak(i, m.content)}
                title={speakingIdx === i ? 'Stop reading' : 'Read aloud'}
                aria-label={speakingIdx === i ? 'Stop reading' : 'Read this reply aloud'}
              >
                {speakingIdx === i ? <Square size={13} aria-hidden /> : <Volume2 size={14} aria-hidden />}
              </button>
            )}
          </div>
        ))}
        {streaming && (
          <div className="kos-assistant-msg assistant">
            <span className="kos-assistant-role">🤖</span>
            <div className="kos-assistant-bubble">
              {streaming}
              <span className="kos-assistant-caret">▋</span>
            </div>
          </div>
        )}
      </div>
      {(micError || (canSpeak && messages.length > 0)) && (
        <div className="kos-assistant-speechbar">
          {micError && <span className="kos-assistant-micerr">{micError}</span>}
          {canSpeak && (
            <label className="kos-assistant-autospeak">
              <input type="checkbox" checked={autoSpeak} onChange={(e) => toggleAutoSpeak(e.target.checked)} /> Read
              replies aloud
            </label>
          )}
        </div>
      )}
      <form
        className="kos-assistant-input"
        onSubmit={(e) => {
          e.preventDefault();
          void sendText(draft);
        }}
      >
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={busy ? 'Thinking…' : listening ? 'Listening…' : 'Ask about Diwakar…'}
          disabled={busy}
          aria-label="assistant prompt"
        />
        {canListen && (
          <button
            type="button"
            className={'kos-assistant-mic' + (listening ? ' on' : '')}
            onClick={toggleMic}
            disabled={busy}
            title={listening ? 'Stop dictation' : 'Dictate'}
            aria-label={listening ? 'Stop dictation' : 'Dictate a question'}
            aria-pressed={listening}
          >
            <Mic size={16} aria-hidden />
          </button>
        )}
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
  description: 'Ask about Diwakar by typing or dictating; replies can be read aloud',
  defaultSize: { width: 540, height: 580 },
  minSize: { width: 340, height: 380 },
  desktop: true,
  launchCommands: ['assistant', 'chatbot'],
};

export default AssistantApp;
