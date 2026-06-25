'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppDefinition, AppProps } from '../../types';
import { streamChat } from '../../ai/stream';

/* Minimal structural types for the browser SpeechRecognition API. */
interface SRAlt { transcript: string }
interface SRResult { isFinal: boolean; 0: SRAlt; length: number }
interface SRResultList { length: number; [index: number]: SRResult }
interface SREvent { resultIndex: number; results: SRResultList }
interface SRErrorEvent { error: string }
interface SRInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((ev: SREvent) => void) | null;
  onerror: ((ev: SRErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SRCtor = new () => SRInstance;

function getSRCtor(): SRCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SRCtor;
    webkitSpeechRecognition?: SRCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const box: React.CSSProperties = {
  border: '1px solid var(--kos-border)',
  background: 'var(--kos-panel)',
  borderRadius: 8,
  padding: 12,
};
const label: React.CSSProperties = {
  fontSize: '0.72rem',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--kos-dim)',
  marginBottom: 6,
};

function VoiceApp(_props: AppProps) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [transcript, setTranscript] = useState('');
  const [srError, setSrError] = useState<string | null>(null);

  const [ttsText, setTtsText] = useState('');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const [ttsSupported, setTtsSupported] = useState(false);

  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);

  const recogRef = useRef<SRInstance | null>(null);
  const finalRef = useRef('');

  /* ── Speech recognition setup ── */
  useEffect(() => {
    const Ctor = getSRCtor();
    if (!Ctor) {
      setSupported(false);
      return;
    }
    setSupported(true);
    const recog = new Ctor();
    recog.lang = 'en-US';
    recog.continuous = true;
    recog.interimResults = true;
    recog.onresult = (ev) => {
      let chunk = '';
      let appended = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        const t = r[0]?.transcript ?? '';
        if (r.isFinal) appended += t;
        else chunk += t;
      }
      if (appended) {
        finalRef.current = (finalRef.current + ' ' + appended).replace(/\s+/g, ' ').trim();
        setTranscript(finalRef.current);
      }
      setInterim(chunk);
    };
    recog.onerror = (ev) => setSrError(ev.error || 'speech recognition error');
    recog.onend = () => {
      setListening(false);
      setInterim('');
    };
    recogRef.current = recog;
    return () => {
      try {
        recog.abort();
      } catch {
        /* ignore */
      }
      recogRef.current = null;
    };
  }, []);

  /* ── Speech synthesis voices ── */
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    setTtsSupported(true);
    const synth = window.speechSynthesis;
    const load = () => setVoices(synth.getVoices());
    load();
    synth.onvoiceschanged = load;
    const poll = window.setInterval(() => setSpeaking(synth.speaking || synth.pending), 250);
    return () => {
      synth.onvoiceschanged = null;
      window.clearInterval(poll);
      try {
        synth.cancel();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const toggleMic = useCallback(() => {
    const recog = recogRef.current;
    if (!recog) return;
    if (listening) {
      try {
        recog.stop();
      } catch {
        /* ignore */
      }
      return;
    }
    finalRef.current = '';
    setTranscript('');
    setInterim('');
    setSrError(null);
    try {
      recog.start();
      setListening(true);
    } catch {
      /* start() throws if already running — ignore */
    }
  }, [listening]);

  const speak = useCallback(
    (text: string) => {
      if (typeof window === 'undefined' || !window.speechSynthesis) return;
      const trimmed = text.trim();
      if (!trimmed) return;
      const synth = window.speechSynthesis;
      synth.cancel();
      const utter = new SpeechSynthesisUtterance(trimmed);
      const v = voices.find((x) => x.voiceURI === voiceURI);
      if (v) utter.voice = v;
      utter.lang = v?.lang || 'en-US';
      synth.speak(utter);
      setSpeaking(true);
    },
    [voices, voiceURI],
  );

  const stopSpeaking = useCallback(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const askAi = useCallback(async () => {
    const q = transcript.trim();
    if (!q || busy) return;
    setBusy(true);
    setAnswer('');
    let acc = '';
    const { text, error } = await streamChat([{ role: 'user', content: q }], (d) => {
      acc += d;
      setAnswer(acc);
    });
    setBusy(false);
    if (error) {
      setAnswer('⚠ ' + error);
      return;
    }
    const reply = text || acc;
    setAnswer(reply);
    speak(reply);
  }, [transcript, busy, speak]);

  if (!supported) {
    return (
      <div className="kos-game-over" style={{ padding: 24, maxWidth: 420 }}>
        Voice input not supported — Speech Recognition is unavailable in this
        browser. Try Chrome or Edge on desktop. Text-to-speech below may still work.
      </div>
    );
  }

  const live = interim || (listening ? 'Listening…' : '');

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        padding: 16,
        height: '100%',
        overflowY: 'auto',
        color: 'var(--kos-text)',
      }}
    >
      {/* Speech to text */}
      <section style={box}>
        <div style={label}>Speech → Text</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <button
            type="button"
            className={'kos-game-btn' + (listening ? ' primary' : '')}
            onClick={toggleMic}
            aria-pressed={listening}
          >
            {listening ? '⏹ Stop' : '🎙 Record'}
          </button>
          <span className="kos-game-hint">{live || 'Click record and speak.'}</span>
        </div>
        <div
          style={{
            minHeight: 56,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontSize: '0.9rem',
            lineHeight: 1.5,
          }}
        >
          {transcript || <span style={{ color: 'var(--kos-dim)' }}>Transcript appears here…</span>}
        </div>
        {srError && <div className="kos-game-over" style={{ marginTop: 6 }}>{srError}</div>}
      </section>

      {/* Ask AI */}
      <section style={box}>
        <div style={label}>Ask AI (voice)</div>
        <button
          type="button"
          className="kos-game-btn primary"
          onClick={() => void askAi()}
          disabled={busy || !transcript.trim()}
        >
          {busy ? 'Thinking…' : '✨ Ask AI & Speak'}
        </button>
        <div
          style={{
            minHeight: 48,
            marginTop: 10,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontSize: '0.9rem',
            lineHeight: 1.5,
          }}
        >
          {answer || (
            <span style={{ color: 'var(--kos-dim)' }}>The assistant&apos;s reply appears here.</span>
          )}
        </div>
      </section>

      {/* Text to speech */}
      <section style={box}>
        <div style={label}>Text → Speech</div>
        {!ttsSupported && (
          <div className="kos-game-over" style={{ marginBottom: 8 }}>
            Text-to-speech is unavailable in this browser.
          </div>
        )}
        <textarea
          value={ttsText}
          onChange={(e) => setTtsText(e.target.value)}
          placeholder="Type something to speak…"
          rows={3}
          style={{
            width: '100%',
            resize: 'vertical',
            background: '#0e1118',
            color: 'var(--kos-text)',
            border: '1px solid var(--kos-border)',
            borderRadius: 6,
            padding: 8,
            fontSize: '0.9rem',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="kos-game-btn primary"
            onClick={() => speak(ttsText)}
            disabled={!ttsSupported || !ttsText.trim()}
          >
            🔊 Speak
          </button>
          <button
            type="button"
            className="kos-game-btn"
            onClick={stopSpeaking}
            disabled={!ttsSupported || !speaking}
          >
            ⏹ Stop
          </button>
          {voices.length > 0 && (
            <select
              value={voiceURI}
              onChange={(e) => setVoiceURI(e.target.value)}
              aria-label="voice"
              style={{
                background: '#0e1118',
                color: 'var(--kos-text)',
                border: '1px solid var(--kos-border)',
                borderRadius: 6,
                padding: '6px 8px',
                fontSize: '0.82rem',
              }}
            >
              <option value="">Default voice</option>
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
          )}
          {speaking && <span className="kos-game-hint">Speaking…</span>}
        </div>
      </section>
    </div>
  );
}

export const voiceApp: AppDefinition = {
  id: 'voice',
  title: 'Voice',
  icon: '🎙',
  category: 'Accessories',
  component: VoiceApp,
  description: 'Speech-to-text, text-to-speech, and voice-driven AI chat',
  defaultSize: { width: 520, height: 600 },
  minSize: { width: 360, height: 420 },
  desktop: true,
  launchCommands: ['voice', 'say'],
};

export default VoiceApp;
