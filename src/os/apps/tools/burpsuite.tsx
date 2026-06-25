'use client';

import { useCallback, useMemo, useState } from 'react';
import type { AppDefinition } from '../../types';

type Verdict = 'pending' | 'forwarded' | 'dropped';

interface Capture {
  id: number;
  method: string;
  host: string;
  path: string;
  request: string;
  response: string;
  status: number;
}

const CAPTURES: Capture[] = [
  {
    id: 1,
    method: 'GET',
    host: 'shop.acme-demo.test',
    path: '/login',
    status: 200,
    request:
      'GET /login HTTP/1.1\nHost: shop.acme-demo.test\nUser-Agent: Mozilla/5.0 (X11; Linux x86_64)\nAccept: text/html,application/xhtml+xml\nConnection: keep-alive\n',
    response:
      'HTTP/1.1 200 OK\nServer: nginx/1.24.0\nContent-Type: text/html; charset=utf-8\nSet-Cookie: SESSION=a1b2c3; HttpOnly\nContent-Length: 482\n\n<!DOCTYPE html><html><body><form>…</form></body></html>',
  },
  {
    id: 2,
    method: 'POST',
    host: 'shop.acme-demo.test',
    path: '/api/auth',
    status: 302,
    request:
      'POST /api/auth HTTP/1.1\nHost: shop.acme-demo.test\nContent-Type: application/x-www-form-urlencoded\nCookie: SESSION=a1b2c3\nContent-Length: 41\n\nusername=admin&password=hunter2&remember=1',
    response:
      'HTTP/1.1 302 Found\nLocation: /dashboard\nSet-Cookie: SESSION=z9y8x7; HttpOnly; Secure\nContent-Length: 0\n',
  },
  {
    id: 3,
    method: 'GET',
    host: 'shop.acme-demo.test',
    path: '/api/cart?id=1042',
    status: 200,
    request:
      'GET /api/cart?id=1042 HTTP/1.1\nHost: shop.acme-demo.test\nAuthorization: Bearer eyJhbGciOiJIUzI1NiJ9.demo\nAccept: application/json\n',
    response:
      'HTTP/1.1 200 OK\nContent-Type: application/json\nContent-Length: 96\n\n{"id":1042,"items":[{"sku":"WIDGET-7","qty":2}],"total":"39.98","currency":"USD"}',
  },
  {
    id: 4,
    method: 'POST',
    host: 'shop.acme-demo.test',
    path: '/api/checkout',
    status: 201,
    request:
      'POST /api/checkout HTTP/1.1\nHost: shop.acme-demo.test\nContent-Type: application/json\nAuthorization: Bearer eyJhbGciOiJIUzI1NiJ9.demo\nContent-Length: 58\n\n{"cart":1042,"card":"4111111111111111","cvv":"123"}',
    response:
      'HTTP/1.1 201 Created\nContent-Type: application/json\nContent-Length: 44\n\n{"order":"ORD-88231","status":"confirmed"}',
  },
];

const STATUS_COLOR: Record<string, string> = {
  '2': '#6fcf97',
  '3': '#f2c94c',
  '4': '#eb5757',
  '5': '#eb5757',
};

function BurpSuite() {
  const [verdicts, setVerdicts] = useState<Record<number, Verdict>>({});
  const [selected, setSelected] = useState<number>(CAPTURES[0].id);
  const [intercept, setIntercept] = useState(true);

  const active = useMemo(
    () => CAPTURES.find((c) => c.id === selected) ?? CAPTURES[0],
    [selected],
  );

  const decide = useCallback(
    (id: number, verdict: Verdict) => setVerdicts((v) => ({ ...v, [id]: verdict })),
    [],
  );

  const pendingCount = CAPTURES.filter((c) => (verdicts[c.id] ?? 'pending') === 'pending').length;
  const verdict = verdicts[active.id] ?? 'pending';

  const cell = (w: string): React.CSSProperties => ({
    width: w,
    padding: '3px 8px',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
  });

  const pane: React.CSSProperties = {
    flex: 1,
    overflow: 'auto',
    margin: 0,
    padding: 8,
    background: '#14151f',
    color: '#d6e1ff',
    font: '12px/1.5 "Cascadia Code", Consolas, monospace',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#1e1f29', color: '#dcdde6', font: '12px/1.4 "Segoe UI", sans-serif' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 10px', background: '#e8732b', color: '#1a1206', borderBottom: '1px solid #14151c', fontWeight: 700 }}>
        <span style={{ fontSize: 14 }}>🟧 Burp Suite</span>
        <span style={{ fontWeight: 400, opacity: 0.85 }}>Proxy · Intercept</span>
        <button
          className="kos-game-btn"
          onClick={() => setIntercept((i) => !i)}
          style={{ marginLeft: 'auto', background: intercept ? '#1f6b35' : '#7a2230', color: '#fff' }}
        >
          Intercept is {intercept ? 'on' : 'off'}
        </button>
      </div>

      <div style={{ display: 'flex', padding: '3px 0', background: '#33343f', color: '#9fa0b2', borderBottom: '1px solid #14151c', fontWeight: 600 }}>
        <div style={cell('40px')}>#</div>
        <div style={cell('64px')}>Method</div>
        <div style={cell('170px')}>Host</div>
        <div style={{ ...cell('auto'), flex: 1 }}>Path</div>
        <div style={cell('54px')}>Status</div>
        <div style={cell('92px')}>State</div>
      </div>

      <div style={{ maxHeight: '34%', overflowY: 'auto' }}>
        {CAPTURES.map((c) => {
          const v = verdicts[c.id] ?? 'pending';
          const sel = c.id === selected;
          return (
            <div
              key={c.id}
              onClick={() => setSelected(c.id)}
              style={{
                display: 'flex',
                cursor: 'pointer',
                background: sel ? '#3b5bd9' : '#262732',
                color: sel ? '#fff' : '#cfd0de',
                opacity: v === 'dropped' ? 0.5 : 1,
                borderBottom: '1px solid rgba(0,0,0,0.25)',
              }}
            >
              <div style={cell('40px')}>{c.id}</div>
              <div style={{ ...cell('64px'), fontWeight: 600 }}>{c.method}</div>
              <div style={cell('170px')}>{c.host}</div>
              <div style={{ ...cell('auto'), flex: 1, textDecoration: v === 'dropped' ? 'line-through' : 'none' }}>{c.path}</div>
              <div style={{ ...cell('54px'), color: sel ? '#fff' : STATUS_COLOR[String(c.status)[0]] ?? '#cfd0de' }}>{c.status}</div>
              <div style={cell('92px')}>{v}</div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 10px', background: '#2b2c38', borderTop: '1px solid #14151c', borderBottom: '1px solid #14151c' }}>
        <button
          className="kos-game-btn"
          disabled={verdict !== 'pending'}
          onClick={() => decide(active.id, 'forwarded')}
          style={{ background: '#1f6b35', color: '#fff', opacity: verdict === 'pending' ? 1 : 0.5 }}
        >
          Forward
        </button>
        <button
          className="kos-game-btn"
          disabled={verdict !== 'pending'}
          onClick={() => decide(active.id, 'dropped')}
          style={{ background: '#7a2230', color: '#fff', opacity: verdict === 'pending' ? 1 : 0.5 }}
        >
          Drop
        </button>
        <span style={{ marginLeft: 'auto', opacity: 0.7 }}>
          {pendingCount} pending · request #{active.id} {verdict} · (simulation)
        </span>
      </div>

      <div style={{ display: 'flex', flex: 1, minHeight: 80 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid #14151c' }}>
          <div style={{ padding: '4px 8px', background: '#2b2c38', color: '#8be9fd', fontWeight: 600 }}>Request</div>
          <pre style={pane}>{active.request}</pre>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '4px 8px', background: '#2b2c38', color: '#6fcf97', fontWeight: 600 }}>Response</div>
          <pre style={pane}>{active.response}</pre>
        </div>
      </div>
    </div>
  );
}

export const burpsuiteApp: AppDefinition = {
  id: 'burpsuite',
  title: 'Burp Suite',
  icon: '🟧',
  category: 'Web Application Analysis',
  component: BurpSuite,
  description: 'HTTP intercepting proxy — view, forward, or drop requests (simulation)',
  defaultSize: { width: 860, height: 560 },
  minSize: { width: 560, height: 360 },
  launchCommands: ['burpsuite', 'burp'],
};

export default BurpSuite;
