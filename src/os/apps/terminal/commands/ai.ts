import type { Command } from '../../../types';
import type { NewsPayload } from '../../../ai/news';
import { streamChat } from '../../../ai/stream';
import { TRACK_IDS, trackFromWord, trackOf, type TrackId } from '@/research/tracks';

const ask: Command['run'] = async ({ args }) => {
  const q = args.join(' ').trim();
  if (!q) return "usage: ai <question>   e.g.  ai what are Diwakar's core skills?";
  const { text, error } = await streamChat([{ role: 'user', content: q }], () => {});
  if (error) return '⚠ ' + error;
  return text || '(no response)';
};

const LANES = ['research', 'industry', 'community'] as const;

/** news [track] [lane] [open] — words in any order. */
const news: Command['run'] = async ({ args, shell }) => {
  let track: TrackId = 'core';
  let lane: (typeof LANES)[number] | undefined;
  let open = false;
  for (const a of args) {
    const t = trackFromWord(a);
    const l = LANES.find((x) => x === a);
    if (t) track = t;
    else if (l) lane = l;
    else if (a === 'open') open = true;
    else return `usage: news [ml|defense|markets] [research|industry|community] [open]`;
  }
  if (open) {
    shell.launch('research', { arg: 'news', track });
    return `opening Research → News (${trackOf(track).label})…`;
  }

  let data: NewsPayload;
  try {
    const res = await fetch(`/api/news?track=${track}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = (await res.json()) as NewsPayload;
  } catch (err) {
    return `news: could not reach the feed aggregator (${err instanceof Error ? err.message : String(err)}).`;
  }

  const items = data.items.filter((i) => !lane || i.lane === lane).slice(0, 20);
  if (items.length === 0) return 'news: nothing in the feed right now.';

  const rows = items.map((i) => {
    const when = i.date
      ? `${Math.max(0, Math.round((Date.now() - Date.parse(i.date)) / 3600000))}h`.padStart(4)
      : '   —';
    return `  ${when}  [${i.lane[0].toUpperCase()}] ${i.title}\n        ${i.source} · ${i.url}`;
  });

  const foot = data.unreachable.length ? `\nunreachable feeds: ${data.unreachable.join(', ')}` : '';
  return [
    `${trackOf(track).label} — ${items.length} headlines (cached ≤30 min):`,
    '',
    ...rows,
    '',
    `run 'news ${track === 'core' ? '' : track + ' '}open' for the Research app.${foot}`,
  ].join('\n');
};

export const aiCommands: Command[] = [
  {
    name: 'ai',
    summary: 'ask the portfolio AI assistant about Diwakar',
    usage: 'ai <question>',
    category: 'ai',
    run: ask,
  },
  {
    name: 'ask',
    summary: 'alias for ai',
    usage: 'ask <question>',
    category: 'ai',
    run: ask,
  },
  {
    name: 'news',
    summary: 'latest headlines for a research track (AI/ML, defense, markets)',
    usage: 'news [ml|defense|markets] [research|industry|community] [open]',
    category: 'ai',
    run: news,
    complete: ({ args }) =>
      [...TRACK_IDS, ...LANES, 'open'].filter((l) => l.startsWith(args[args.length - 1] ?? '')),
  },
];
