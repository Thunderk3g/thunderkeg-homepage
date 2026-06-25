'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;
let warned = false;

/** Singleton browser Supabase client (reused vinika project, publishable key). */
export function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    if (!warned) {
      // eslint-disable-next-line no-console
      console.warn('[os/net] Supabase env missing — multiplayer features disabled.');
      warned = true;
    }
    return null;
  }
  if (!client) {
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { params: { eventsPerSecond: 20 } },
    });
  }
  return client;
}

export function isOnlineEnabled(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

/** A stable, anonymous identity for this browser session. */
export function getClientId(): string {
  if (typeof window === 'undefined') return 'server';
  const KEY = 'kos:clientId';
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    id = 'u_' + Math.abs(hashString(String(performance.now()) + navigator.userAgent)).toString(36);
    window.localStorage.setItem(KEY, id);
  }
  return id;
}

export function getDisplayName(): string {
  if (typeof window === 'undefined') return 'guest';
  const KEY = 'kos:name';
  let n = window.localStorage.getItem(KEY);
  if (!n) {
    n = randomHandle();
    window.localStorage.setItem(KEY, n);
  }
  return n;
}

export function setDisplayName(name: string) {
  if (typeof window !== 'undefined') window.localStorage.setItem('kos:name', name.slice(0, 24));
}

const ADJ = ['root', 'null', 'cyber', 'ghost', 'shadow', 'binary', 'quantum', 'neon', 'proxy', 'kernel'];
const NOUN = ['dragon', 'daemon', 'packet', 'cipher', 'shell', 'byte', 'node', 'raptor', 'wolf', 'hex'];
function randomHandle(): string {
  const a = ADJ[Math.floor(seededRand() * ADJ.length)];
  const b = NOUN[Math.floor(seededRand() * NOUN.length)];
  const n = Math.floor(seededRand() * 90 + 10);
  return `${a}_${b}${n}`;
}

// performance.now()-seeded pseudo-randomness (Math.random is fine in app runtime).
function seededRand(): number {
  return Math.random();
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return h;
}
