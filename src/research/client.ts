'use client';

import type { GraphResponse, PapersResponse } from './types';

/**
 * Browser-side wrappers. Everything goes through our own /api/research/*
 * routes — never straight to arXiv or Semantic Scholar, which would bypass the
 * rate gate (and arXiv sends no CORS headers anyway).
 */

export type SearchParams =
  | { source: 'arxiv'; q: string; start?: number; max?: number }
  | { source: 'arxiv'; ids: string[] }
  | { source: 'hf-daily'; date?: string }
  | { source: 'hf-search'; q: string };

const failed = (source: string, error: string): PapersResponse => ({
  items: [],
  source,
  fetchedAt: new Date().toISOString(),
  cached: false,
  error,
});

export async function searchPapers(p: SearchParams, signal?: AbortSignal): Promise<PapersResponse> {
  const qs = new URLSearchParams({ source: p.source });
  if ('ids' in p) qs.set('ids', p.ids.join(','));
  if ('q' in p) qs.set('q', p.q);
  if ('start' in p && p.start) qs.set('start', String(p.start));
  if ('max' in p && p.max) qs.set('max', String(p.max));
  if ('date' in p && p.date) qs.set('date', p.date);
  try {
    const res = await fetch(`/api/research/papers?${qs}`, { signal });
    const body = (await res.json()) as PapersResponse & { error?: string };
    if (!res.ok) return failed(p.source, body.error ?? `HTTP ${res.status}`);
    return body;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    return failed(p.source, err instanceof Error ? err.message : String(err));
  }
}

export async function fetchGraph(id: string): Promise<GraphResponse> {
  try {
    const res = await fetch(`/api/research/graph?id=${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as GraphResponse;
  } catch {
    return { available: false, reason: 'unreachable', references: [], citations: [], recommendations: [] };
  }
}

/**
 * Free text → arXiv search_query. Anything with a `:` is taken as a raw arXiv
 * query (`abs:"word error rate" AND cat:eess.AS`); otherwise quoted phrases
 * become `all:"…"` and the remaining words are AND-joined as `all:w`.
 */
export function buildArxivQuery(text: string): string {
  const t = text.trim();
  if (!t) return '';
  if (t.includes(':')) return t;
  const parts = [...t.matchAll(/"([^"]+)"/g)].map((m) => `all:"${m[1].trim()}"`);
  const words = t
    .replace(/"[^"]*"/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/[()]/g, ''))
    .filter((w) => w && !/^(and|or|not)$/i.test(w));
  return [...parts, ...words.map((w) => `all:${w}`)].join(' AND ');
}

/** Save a string as a file via a Blob — no server round trip. */
export function download(filename: string, text: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
