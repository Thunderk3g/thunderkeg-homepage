'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppDefinition } from '../../types';

interface HashMode {
  id: number;
  name: string;
  example: string;
  /** canned plaintext "recovered" for the demo */
  plain: string;
}

const MODES: HashMode[] = [
  { id: 0, name: 'MD5', example: '8743b52063cd84097a65d1633f5c74f5', plain: 'hashcat1' },
  { id: 100, name: 'SHA1', example: 'b89eaac7e61417341b710b727768294d0e6a277b', plain: 'sunshine' },
  { id: 1400, name: 'SHA2-256', example: '127e6fbfe24a750e72930c220a8e138275656b8e5d8f48a98c3c92df2caba935', plain: 'letmein' },
  { id: 1800, name: 'sha512crypt $6$', example: '$6$rounds=5000$abc$Xyz...', plain: 'P@ssw0rd!' },
  { id: 22000, name: 'WPA-PBKDF2', example: 'WPA*02*...*HelloNet', plain: 'wifipass2024' },
  { id: 1000, name: 'NTLM', example: 'b4b9b02e6f09a9bd760f388b67351e2b', plain: 'Admin123' },
];

const STATUS_BG = '#0b1220';
const ACCENT = '#7cf2c4';
const AMBER = '#ffb454';

function HashcatApp() {
  const [modeId, setModeId] = useState<number>(MODES[0].id);
  const [hash, setHash] = useState<string>(MODES[0].example);
  const [progress, setProgress] = useState<number>(0);
  const [running, setRunning] = useState<boolean>(false);
  const [log, setLog] = useState<string[]>([]);
  const [cracked, setCracked] = useState<string | null>(null);
  const [speed, setSpeed] = useState<string>('0 H/s');
  const timer = useRef<number | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const mode = MODES.find((m) => m.id === modeId) ?? MODES[0];

  const append = useCallback((line: string) => setLog((l) => [...l, line]), []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  const stop = useCallback(() => {
    if (timer.current !== null) {
      window.clearInterval(timer.current);
      timer.current = null;
    }
    setRunning(false);
  }, []);

  useEffect(() => stop, [stop]);

  const start = useCallback(() => {
    if (running) return;
    setCracked(null);
    setProgress(0);
    setLog([]);
    setRunning(true);
    const target = (hash.trim() || mode.example).slice(0, 64);
    const gh = (3.2 + Math.random() * 4).toFixed(1);
    append(`hashcat (v6.2.6-sim) starting in attack mode 0 (Straight)`);
    append(`Hash.Mode........: ${mode.id} (${mode.name})`);
    append(`Hash.Target......: ${target}`);
    append(`Dictionary.......: rockyou.txt (14,344,391 words)`);
    append(`Guess.Queue......: 1/1 (100.00%)`);
    setSpeed(`${gh} GH/s`);

    timer.current = window.setInterval(() => {
      setProgress((p) => {
        const next = Math.min(100, p + 4 + Math.random() * 9);
        const pct = Math.round(next);
        if (pct % 20 === 0 || pct === 100) {
          append(`Progress.........: ${pct}% (recovered 0/1 digests)`);
        }
        if (next >= 100) {
          if (timer.current !== null) {
            window.clearInterval(timer.current);
            timer.current = null;
          }
          append(`${target}:${mode.plain}`);
          append(`Status...........: Cracked`);
          append(`Recovered........: 1/1 (100.00%) Digests`);
          setCracked(mode.plain);
          setSpeed('0 H/s');
          setRunning(false);
        }
        return next;
      });
    }, 280);
  }, [append, hash, mode, running]);

  const box: React.CSSProperties = {
    background: STATUS_BG,
    color: '#e7f3ee',
    fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
    fontSize: 12,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    padding: 12,
    gap: 10,
    boxSizing: 'border-box',
  };

  return (
    <div style={box}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: ACCENT, fontWeight: 700 }}>hashcat</span>
        <span style={{ color: '#6f8499', fontSize: 11 }}>advanced password recovery (simulation)</span>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ color: '#9fb3c8' }}>Hash mode:</label>
        <select
          value={modeId}
          disabled={running}
          onChange={(e) => {
            const id = Number(e.target.value);
            setModeId(id);
            const m = MODES.find((x) => x.id === id);
            if (m) setHash(m.example);
            setCracked(null);
            setProgress(0);
          }}
          style={{ background: '#13202e', color: ACCENT, border: '1px solid #25415b', borderRadius: 4, padding: '4px 6px' }}
        >
          {MODES.map((m) => (
            <option key={m.id} value={m.id}>
              -m {m.id} · {m.name}
            </option>
          ))}
        </select>
      </div>

      <textarea
        value={hash}
        disabled={running}
        spellCheck={false}
        onChange={(e) => setHash(e.target.value)}
        placeholder="paste a hash to crack…"
        aria-label="hash input"
        style={{
          background: '#0d1722',
          color: '#e7f3ee',
          border: '1px solid #25415b',
          borderRadius: 4,
          padding: 8,
          resize: 'none',
          height: 52,
          fontFamily: 'inherit',
          fontSize: 12,
        }}
      />

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className="kos-game-btn"
          onClick={start}
          disabled={running}
          style={{ background: running ? '#244' : ACCENT, color: '#06150f', fontWeight: 700, cursor: running ? 'default' : 'pointer' }}
        >
          {running ? 'Cracking…' : 'Start attack'}
        </button>
        <button className="kos-game-btn" onClick={stop} disabled={!running} style={{ opacity: running ? 1 : 0.5 }}>
          Stop
        </button>
        <span style={{ marginLeft: 'auto', color: AMBER }}>Speed: {speed}</span>
      </div>

      <div style={{ height: 14, background: '#0d1722', border: '1px solid #25415b', borderRadius: 7, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${progress}%`,
            background: cracked ? ACCENT : 'linear-gradient(90deg,#2b7fff,#7cf2c4)',
            transition: 'width 0.2s linear',
          }}
        />
      </div>

      {cracked && (
        <div style={{ color: '#06150f', background: ACCENT, padding: '6px 10px', borderRadius: 4, fontWeight: 700 }}>
          ✓ Recovered plaintext: <span style={{ fontFamily: 'inherit' }}>{cracked}</span> (simulated)
        </div>
      )}

      <div
        ref={logRef}
        style={{ flex: 1, overflowY: 'auto', background: '#091016', border: '1px solid #1b2b3a', borderRadius: 4, padding: 8, lineHeight: 1.5, color: '#9fdcc4', minHeight: 60 }}
      >
        {log.length === 0 ? (
          <span style={{ color: '#52677c' }}>Pick a mode, paste a hash, and press Start. Output is canned for demo purposes.</span>
        ) : (
          log.map((l, i) => (
            <div key={i} style={{ color: l.startsWith('Status') || l.includes(':') ? ACCENT : '#9fdcc4', whiteSpace: 'pre-wrap' }}>
              {l}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export const hashcatApp: AppDefinition = {
  id: 'hashcat',
  title: 'hashcat',
  icon: '🔓',
  category: 'Password Attacks',
  component: HashcatApp,
  description: 'Advanced password recovery (simulation)',
  defaultSize: { width: 640, height: 520 },
  minSize: { width: 420, height: 380 },
  launchCommands: ['hashcat'],
};

export default HashcatApp;
