'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppDefinition } from '../../types';

/* Educational simulation only — produces canned, realistic-looking nmap output.
   No packets are ever sent; nothing on the network is touched. */

interface ScanProfile {
  label: string;
  flags: string;
}

const PROFILES: Record<string, ScanProfile> = {
  intense: { label: 'Intense scan', flags: '-T4 -A -v' },
  quick: { label: 'Quick scan', flags: '-T4 -F' },
  ping: { label: 'Ping scan', flags: '-sn' },
  regular: { label: 'Regular scan', flags: '' },
  intenseUdp: { label: 'Intense scan plus UDP', flags: '-sS -sU -T4 -A -v' },
};

interface PortRow {
  port: string;
  service: string;
  version: string;
}

const OPEN_PORTS: PortRow[] = [
  { port: '22/tcp', service: 'ssh', version: 'OpenSSH 8.9p1 Ubuntu 3ubuntu0.6' },
  { port: '80/tcp', service: 'http', version: 'nginx 1.18.0 (Ubuntu)' },
  { port: '443/tcp', service: 'ssl/http', version: 'nginx 1.18.0 (Ubuntu)' },
];

const COLORS = {
  bg: '#0b0f12',
  panel: '#11171c',
  border: '#1f2b33',
  text: '#cfe3d8',
  accent: '#67d28a',
  warn: '#e0b15a',
  dim: '#7d909a',
};

function buildOutput(target: string, profileKey: string): string[] {
  const p = PROFILES[profileKey] ?? PROFILES.regular;
  const now = new Date();
  const stamp = now.toISOString().replace('T', ' ').slice(0, 19);
  const latency = (Math.random() * 0.04 + 0.005).toFixed(3);
  const out: string[] = [];
  out.push(`$ nmap ${p.flags ? p.flags + ' ' : ''}${target}`.trimEnd());
  out.push(`Starting Nmap 7.94 ( https://nmap.org ) at ${stamp} UTC`);
  out.push('');
  out.push(`Nmap scan report for ${target} (10.10.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1})`);
  out.push(`Host is up (${latency}s latency).`);

  if (profileKey === 'ping') {
    out.push('');
    out.push('Nmap done: 1 IP address (1 host up) scanned in 0.42 seconds');
    return out;
  }

  out.push('Not shown: 997 closed tcp ports (reset)');
  out.push('PORT     STATE SERVICE  VERSION');
  for (const row of OPEN_PORTS) {
    const showVer = profileKey === 'intense' || profileKey === 'intenseUdp';
    out.push(`${row.port.padEnd(8)} open  ${row.service.padEnd(8)} ${showVer ? row.version : ''}`.trimEnd());
  }

  if (profileKey === 'intense' || profileKey === 'intenseUdp') {
    out.push('Device type: general purpose');
    out.push('Running: Linux 5.X');
    out.push('OS CPE: cpe:/o:linux:linux_kernel:5');
    out.push('OS details: Linux 5.4 - 5.15');
    out.push('Network Distance: 11 hops');
    out.push('Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel');
  } else {
    out.push('OS guess: Linux (95%)');
  }

  out.push('');
  out.push('OS and Service detection performed. (simulation — no packets sent)');
  out.push(`Nmap done: 1 IP address (1 host up) scanned in ${(Math.random() * 18 + 4).toFixed(2)} seconds`);
  return out;
}

function Nmap() {
  const [target, setTarget] = useState('scanme.nmap.org');
  const [profile, setProfile] = useState<string>('intense');
  const [lines, setLines] = useState<string[]>([]);
  const [scanning, setScanning] = useState(false);
  const bodyRef = useRef<HTMLPreElement>(null);
  const queue = useRef<string[]>([]);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [lines]);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearInterval(timer.current);
    },
    [],
  );

  const runScan = useCallback(() => {
    const host = target.trim();
    if (!host || scanning) return;
    if (timer.current !== null) window.clearInterval(timer.current);
    setLines([]);
    setScanning(true);
    queue.current = buildOutput(host, profile);
    timer.current = window.setInterval(() => {
      const next = queue.current.shift();
      if (next === undefined) {
        if (timer.current !== null) window.clearInterval(timer.current);
        timer.current = null;
        setScanning(false);
        return;
      }
      setLines((l) => [...l, next]);
    }, 90);
  }, [target, profile, scanning]);

  const fieldStyle: React.CSSProperties = {
    background: COLORS.bg,
    color: COLORS.text,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 4,
    padding: '6px 8px',
    fontSize: 13,
    outline: 'none',
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: COLORS.panel,
        color: COLORS.text,
        fontFamily: 'Menlo, Consolas, monospace',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          padding: 8,
          borderBottom: `1px solid ${COLORS.border}`,
          flexWrap: 'wrap',
        }}
      >
        <label style={{ fontSize: 12, color: COLORS.dim }}>Target:</label>
        <input
          value={target}
          spellCheck={false}
          onChange={(e) => setTarget(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') runScan();
          }}
          aria-label="scan target"
          style={{ ...fieldStyle, flex: '1 1 160px', minWidth: 120 }}
        />
        <label style={{ fontSize: 12, color: COLORS.dim }}>Profile:</label>
        <select
          value={profile}
          onChange={(e) => setProfile(e.target.value)}
          aria-label="scan profile"
          style={fieldStyle}
        >
          {Object.entries(PROFILES).map(([key, p]) => (
            <option key={key} value={key}>
              {p.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={runScan}
          disabled={scanning}
          style={{
            ...fieldStyle,
            cursor: scanning ? 'default' : 'pointer',
            background: scanning ? COLORS.border : COLORS.accent,
            color: scanning ? COLORS.dim : '#06210f',
            fontWeight: 700,
            border: 'none',
          }}
        >
          {scanning ? 'Scanning…' : 'Scan'}
        </button>
      </div>

      <pre
        ref={bodyRef}
        style={{
          flex: 1,
          margin: 0,
          padding: 10,
          overflow: 'auto',
          fontSize: 12.5,
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          background: COLORS.bg,
        }}
      >
        {lines.length === 0 ? (
          <span style={{ color: COLORS.dim }}>
            Zenmap (simulation). Enter a target and press Scan to begin.
          </span>
        ) : (
          lines.map((l, i) => {
            const open = / open /.test(l);
            const done = l.startsWith('Nmap done');
            const sim = l.includes('simulation');
            return (
              <div
                key={i}
                style={{
                  color: open ? COLORS.accent : done ? COLORS.text : sim ? COLORS.warn : COLORS.text,
                }}
              >
                {l || ' '}
              </div>
            );
          })
        )}
      </pre>
    </div>
  );
}

export const nmapApp: AppDefinition = {
  id: 'nmap',
  title: 'Nmap (Zenmap)',
  icon: '🛰️',
  category: 'Information Gathering',
  component: Nmap,
  description: 'Network port scanner GUI (simulation)',
  defaultSize: { width: 760, height: 480 },
  minSize: { width: 460, height: 320 },
  launchCommands: ['nmap', 'zenmap'],
};

export default Nmap;
