'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AppDefinition, AppProps } from '../../types';
import { useChat } from '../../net/realtime';

function timeOf(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** Deterministic-ish accent colour per author, so handles are easy to track. */
function colorOf(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return `hsl(${Math.abs(h) % 360}, 70%, 68%)`;
}

function ChatApp(_props: AppProps) {
  const { messages, users, send, clientId } = useChat('lobby');
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement | null>(null);
  const stuckToBottom = useRef(true);

  const online = users.length;

  // Track whether the user is pinned to the bottom so auto-scroll never fights
  // a user who has scrolled up to read history.
  const onScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
    stuckToBottom.current = gap < 48;
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (el && stuckToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const submit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const text = draft.trim();
      if (!text) return;
      send(text);
      setDraft('');
      stuckToBottom.current = true;
    },
    [draft, send],
  );

  const rows = useMemo(
    () =>
      messages.map((msg) => {
        const mine = msg.from === clientId;
        return (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: mine ? 'flex-end' : 'flex-start',
              gap: 2,
            }}
          >
            <div style={{ display: 'flex', gap: 6, fontSize: 11, opacity: 0.75 }}>
              <span style={{ color: colorOf(msg.from), fontWeight: 700 }}>
                {mine ? 'you' : msg.name}
              </span>
              <span style={{ opacity: 0.6 }}>{timeOf(msg.ts)}</span>
            </div>
            <div
              style={{
                maxWidth: '78%',
                padding: '6px 10px',
                borderRadius: 10,
                background: mine ? 'rgba(80,200,160,0.18)' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${mine ? 'rgba(80,200,160,0.35)' : 'rgba(255,255,255,0.12)'}`,
                color: '#e9eef2',
                fontSize: 13,
                lineHeight: 1.4,
                wordBreak: 'break-word',
                whiteSpace: 'pre-wrap',
              }}
            >
              {msg.text}
            </div>
          </div>
        );
      }),
    [messages, clientId],
  );

  return (
    <div
      className="kos-game"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#11171c',
        color: '#e9eef2',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div
        className="kos-game-hud"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(0,0,0,0.25)',
        }}
      >
        <strong style={{ fontSize: 14 }}>#lobby</strong>
        <span style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#4ade80',
              boxShadow: '0 0 6px #4ade80',
            }}
          />
          {online} online
        </span>
      </div>

      <div
        ref={listRef}
        onScroll={onScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {messages.length === 0 ? (
          <p className="kos-game-hint" style={{ opacity: 0.6, textAlign: 'center', marginTop: 24 }}>
            No messages yet — say hello to the lobby.
          </p>
        ) : (
          rows
        )}
      </div>

      <form
        onSubmit={submit}
        style={{
          display: 'flex',
          gap: 8,
          padding: 10,
          borderTop: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(0,0,0,0.25)',
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message #lobby…"
          maxLength={500}
          aria-label="Chat message"
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.18)',
            background: 'rgba(255,255,255,0.05)',
            color: '#e9eef2',
            fontSize: 13,
            outline: 'none',
          }}
        />
        <button
          className="kos-game-btn"
          type="submit"
          disabled={!draft.trim()}
          style={{ padding: '8px 16px', opacity: draft.trim() ? 1 : 0.5 }}
        >
          Send
        </button>
      </form>
    </div>
  );
}

export const chatApp: AppDefinition = {
  id: 'chat',
  title: 'Live Chat',
  icon: '💬',
  category: 'Internet',
  component: ChatApp,
  description: 'Global live chat room (Supabase realtime).',
  defaultSize: { width: 460, height: 560 },
  minSize: { width: 320, height: 380 },
  desktop: false,
  launchCommands: ['chat', 'irc'],
};
