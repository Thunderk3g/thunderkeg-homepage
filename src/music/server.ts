/**
 * Music sources — server side. All three are open and keyless:
 *
 *  - Audius: an open, decentralised music-streaming protocol. Its public API
 *    lists tracks and serves the audio itself; it only asks callers to name
 *    their app (`app_name`).
 *  - SomaFM: listener-supported, commercial-free internet radio.
 *  - Radio Browser: the open, community-maintained directory of radio streams.
 *
 * Only metadata comes through here. The audio streams straight from those
 * services to the browser's <audio> element.
 */

import { UPSTREAM_UA, UpstreamError } from '@/research/server/cache';
import type { Track } from './types';

const APP = 'diwakar-portfolio';
const AUDIUS = 'https://api.audius.co/v1';

async function getJson<T>(url: string, label: string): Promise<T> {
  const res = await fetch(url, {
    headers: { 'user-agent': UPSTREAM_UA, accept: 'application/json' },
    signal: AbortSignal.timeout(9000),
    cache: 'no-store',
  });
  if (!res.ok) throw new UpstreamError(`${label}: HTTP ${res.status}`, res.status);
  return (await res.json()) as T;
}

const https = (u?: string | null) => (u && u.startsWith('https://') ? u : undefined);

/* ───────────────────────── Audius ───────────────────────── */

interface AudiusTrack {
  id: string;
  title: string;
  duration?: number;
  genre?: string;
  play_count?: number;
  permalink?: string;
  is_streamable?: boolean;
  is_delete?: boolean;
  user?: { name?: string; handle?: string };
  artwork?: Record<string, string> | null;
}

function fromAudius(t: AudiusTrack): Track {
  return {
    id: `audius:${t.id}`,
    kind: 'track',
    title: t.title,
    artist: t.user?.name || t.user?.handle || 'Unknown artist',
    art: https(t.artwork?.['480x480'] ?? t.artwork?.['150x150']),
    srcs: [`${AUDIUS}/tracks/${encodeURIComponent(t.id)}/stream?app_name=${APP}`],
    duration: t.duration,
    genre: t.genre || undefined,
    link: t.permalink ? `https://audius.co${t.permalink}` : undefined,
    plays: t.play_count,
  };
}

const playable = (t: AudiusTrack) => t.is_streamable !== false && !t.is_delete && !!t.title;

export async function audiusTrending(genre?: string, time = 'week'): Promise<Track[]> {
  const qs = new URLSearchParams({ app_name: APP, time });
  if (genre) qs.set('genre', genre);
  const r = await getJson<{ data: AudiusTrack[] }>(`${AUDIUS}/tracks/trending?${qs}`, 'Audius');
  return r.data.filter(playable).slice(0, 60).map(fromAudius);
}

export async function audiusSearch(q: string): Promise<Track[]> {
  const qs = new URLSearchParams({ app_name: APP, query: q, limit: '50' });
  const r = await getJson<{ data: AudiusTrack[] }>(`${AUDIUS}/tracks/search?${qs}`, 'Audius');
  return r.data.filter(playable).map(fromAudius);
}

/* ───────────────────────── SomaFM ───────────────────────── */

interface SomaChannel {
  id: string;
  title: string;
  description: string;
  genre: string;
  listeners: string;
  lastPlaying?: string;
  largeimage?: string;
  image?: string;
}

/** The hosts SomaFM's own playlists rotate through; the player falls back across them. */
const SOMA_HOSTS = ['ice2', 'ice6', 'ice1', 'ice4'];

export async function somafm(): Promise<Track[]> {
  const r = await getJson<{ channels: SomaChannel[] }>('https://somafm.com/channels.json', 'SomaFM');
  return r.channels
    .sort((a, b) => Number(b.listeners) - Number(a.listeners))
    .map((c) => ({
      id: `soma:${c.id}`,
      kind: 'radio' as const,
      title: c.title,
      artist: 'SomaFM',
      art: https(c.largeimage ?? c.image),
      srcs: SOMA_HOSTS.map((h) => `https://${h}.somafm.com/${c.id}-128-mp3`),
      genre: c.genre.split('|')[0],
      link: `https://somafm.com/${c.id}/`,
      plays: Number(c.listeners) || undefined,
      note: c.lastPlaying ? `Now: ${c.lastPlaying}` : c.description,
    }));
}

/* ───────────────────────── Radio Browser ───────────────────────── */

interface RbStation {
  stationuuid: string;
  name: string;
  url_resolved: string;
  homepage?: string;
  favicon?: string;
  tags?: string;
  country?: string;
  codec?: string;
  bitrate?: number;
  clickcount?: number;
  lastcheckok?: number;
}

/** Radio Browser asks clients to spread load across its mirrors. */
const RB_MIRRORS = ['https://de1.api.radio-browser.info', 'https://fi1.api.radio-browser.info', 'https://de2.api.radio-browser.info'];

export async function radioByTag(tag: string): Promise<Track[]> {
  const qs = new URLSearchParams({
    tag,
    hidebroken: 'true',
    is_https: 'true',
    order: 'clickcount',
    reverse: 'true',
    limit: '80',
  });
  let last: unknown;
  for (const base of RB_MIRRORS) {
    try {
      const rows = await getJson<RbStation[]>(`${base}/json/stations/search?${qs}`, 'Radio Browser');
      const seen = new Set<string>();
      return rows
        // an https page cannot play an http stream, and the browser only decodes these reliably
        .filter((s) => s.url_resolved.startsWith('https://') && /mp3|aac/i.test(s.codec ?? '') && s.lastcheckok !== 0)
        .filter((s) => {
          const k = s.name.trim().toLowerCase();
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        })
        .slice(0, 48)
        .map((s) => ({
          id: `radio:${s.stationuuid}`,
          kind: 'radio' as const,
          title: s.name.trim(),
          artist: s.country || 'Internet radio',
          art: https(s.favicon),
          srcs: [s.url_resolved],
          genre: s.tags?.split(',').slice(0, 3).join(', ') || undefined,
          link: https(s.homepage),
          note: [s.codec, s.bitrate ? `${s.bitrate} kbps` : ''].filter(Boolean).join(' · ') || undefined,
        }));
    } catch (err) {
      last = err;
    }
  }
  throw last instanceof Error ? last : new Error('Radio Browser unreachable');
}
