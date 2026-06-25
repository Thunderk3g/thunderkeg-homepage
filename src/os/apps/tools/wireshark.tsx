'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AppDefinition } from '../../types';

interface Packet {
  no: number;
  time: number;
  src: string;
  dst: string;
  proto: string;
  len: number;
  info: string;
}

const HOSTS = ['192.168.1.42', '192.168.1.1', '10.0.0.5', '8.8.8.8', '142.250.80.14', '93.184.216.34'];
const FLOWS: Array<{ proto: string; info: (s: string, d: string) => string }> = [
  { proto: 'TCP', info: () => `49832 → 443 [SYN] Seq=0 Win=64240 Len=0 MSS=1460` },
  { proto: 'TCP', info: () => `443 → 49832 [SYN, ACK] Seq=0 Ack=1 Win=65535 Len=0` },
  { proto: 'TLSv1.3', info: () => `Application Data, Application Data` },
  { proto: 'DNS', info: (_s, d) => `Standard query 0x1a2b A ${d === '8.8.8.8' ? 'example.com' : 'google.com'}` },
  { proto: 'DNS', info: () => `Standard query response 0x1a2b A 93.184.216.34` },
  { proto: 'HTTP', info: () => `GET /index.html HTTP/1.1` },
  { proto: 'HTTP', info: () => `HTTP/1.1 200 OK (text/html)` },
  { proto: 'ARP', info: (s) => `Who has ${s}? Tell 192.168.1.1` },
  { proto: 'ICMP', info: () => `Echo (ping) request id=0x0001 seq=12/3072` },
  { proto: 'TCP', info: () => `49832 → 443 [ACK] Seq=1 Ack=1 Win=64240 Len=0` },
];

const PROTO_COLOR: Record<string, string> = {
  TCP: '#e7e6ff', 'TLSv1.3': '#d6ffd6', DNS: '#fff0c2', HTTP: '#d6f0ff', ARP: '#ffe0e0', ICMP: '#ffe9ff',
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function hexDump(seed: number): string {
  const lines: string[] = [];
  for (let row = 0; row < 6; row++) {
    const bytes: string[] = [];
    let ascii = '';
    for (let i = 0; i < 16; i++) {
      const b = (seed * 31 + row * 16 + i * 7) & 0xff;
      bytes.push(b.toString(16).padStart(2, '0'));
      ascii += b >= 32 && b < 127 ? String.fromCharCode(b) : '.';
    }
    lines.push(`${(row * 16).toString(16).padStart(4, '0')}  ${bytes.slice(0, 8).join(' ')}  ${bytes.slice(8).join(' ')}  ${ascii}`);
  }
  return lines.join('\n');
}

function Wireshark() {
  const [packets, setPackets] = useState<Packet[]>([]);
  const [capturing, setCapturing] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const noRef = useRef(1);
  const startRef = useRef(Date.now());
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!capturing) return;
    const id = window.setInterval(() => {
      const flow = pick(FLOWS);
      const src = pick(HOSTS);
      let dst = pick(HOSTS);
      if (dst === src) dst = HOSTS[(HOSTS.indexOf(dst) + 1) % HOSTS.length];
      const pkt: Packet = {
        no: noRef.current++,
        time: (Date.now() - startRef.current) / 1000,
        src,
        dst,
        proto: flow.proto,
        len: 54 + Math.floor(Math.random() * 1400),
        info: flow.info(src, dst),
      };
      setPackets((prev) => [...prev.slice(-199), pkt]);
    }, 700);
    return () => window.clearInterval(id);
  }, [capturing]);

  useEffect(() => {
    if (capturing && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [packets, capturing]);

  const clear = useCallback(() => {
    setPackets([]);
    setSelected(null);
    noRef.current = 1;
    startRef.current = Date.now();
  }, []);

  const active = useMemo(() => packets.find((p) => p.no === selected) ?? null, [packets, selected]);

  const cell = (w: string): React.CSSProperties => ({ width: w, padding: '2px 8px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#1e1f29', color: '#dcdde6', font: '12px/1.4 "Segoe UI", sans-serif' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 10px', background: '#2b2c38', borderBottom: '1px solid #14151c' }}>
        <button className="kos-game-btn" onClick={() => setCapturing((c) => !c)} style={{ background: capturing ? '#7a2230' : '#1f6b35' }}>
          {capturing ? '⏹ Stop' : '▶ Start'}
        </button>
        <button className="kos-game-btn" onClick={clear}>{'\u{1f5d1}'} Clear</button>
        <span style={{ marginLeft: 'auto', opacity: 0.7 }}>
          eth0 · {packets.length} packets · {capturing ? 'capturing…' : 'stopped'} · (simulation)
        </span>
      </div>

      <div style={{ display: 'flex', padding: '2px 0', background: '#33343f', color: '#9fa0b2', borderBottom: '1px solid #14151c', fontWeight: 600 }}>
        <div style={cell('46px')}>No.</div>
        <div style={cell('70px')}>Time</div>
        <div style={cell('130px')}>Source</div>
        <div style={cell('130px')}>Destination</div>
        <div style={cell('72px')}>Proto</div>
        <div style={cell('54px')}>Len</div>
        <div style={{ ...cell('auto'), flex: 1 }}>Info</div>
      </div>

      <div ref={listRef} style={{ flex: 1, overflowY: 'auto', minHeight: 60 }}>
        {packets.length === 0 && (
          <div style={{ padding: 16, opacity: 0.6 }}>No packets captured. Press Start to begin sniffing (simulated traffic).</div>
        )}
        {packets.map((p) => {
          const sel = p.no === selected;
          return (
            <div
              key={p.no}
              onClick={() => setSelected(p.no)}
              style={{
                display: 'flex',
                cursor: 'pointer',
                background: sel ? '#3b5bd9' : PROTO_COLOR[p.proto] ?? '#262732',
                color: sel ? '#fff' : '#23242e',
                borderBottom: '1px solid rgba(0,0,0,0.08)',
              }}
            >
              <div style={cell('46px')}>{p.no}</div>
              <div style={cell('70px')}>{p.time.toFixed(3)}</div>
              <div style={cell('130px')}>{p.src}</div>
              <div style={cell('130px')}>{p.dst}</div>
              <div style={cell('72px')}>{p.proto}</div>
              <div style={cell('54px')}>{p.len}</div>
              <div style={{ ...cell('auto'), flex: 1 }}>{p.info}</div>
            </div>
          );
        })}
      </div>

      <div style={{ height: '38%', minHeight: 110, borderTop: '2px solid #14151c', background: '#16171f', overflow: 'auto', padding: 10 }}>
        {active ? (
          <div>
            <div style={{ color: '#8be9fd', marginBottom: 6 }}>Frame {active.no}: {active.len} bytes captured on interface eth0</div>
            <div style={{ marginBottom: 2 }}>▸ Ethernet II, Src: 00:1a:2b:3c:4d:5e, Dst: 00:5e:4d:3c:2b:1a</div>
            <div style={{ marginBottom: 2 }}>▸ Internet Protocol, Src: {active.src}, Dst: {active.dst}</div>
            <div style={{ marginBottom: 8 }}>▸ {active.proto}: {active.info}</div>
            <pre style={{ margin: 0, font: '12px/1.45 "Cascadia Code", Consolas, monospace', color: '#6fcf97', whiteSpace: 'pre' }}>{hexDump(active.no + active.len)}</pre>
          </div>
        ) : (
          <div style={{ opacity: 0.6 }}>Select a packet to inspect its details and hex dump (canned data).</div>
        )}
      </div>
    </div>
  );
}

export const wiresharkApp: AppDefinition = {
  id: 'wireshark',
  title: 'Wireshark',
  icon: '\u{1f988}',
  category: 'Sniffing & Spoofing',
  component: Wireshark,
  description: 'Network protocol analyzer / packet sniffer (simulation)',
  defaultSize: { width: 820, height: 540 },
  minSize: { width: 520, height: 340 },
  launchCommands: ['wireshark', 'tshark'],
};

export default Wireshark;
