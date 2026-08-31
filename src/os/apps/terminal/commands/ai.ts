import type { Command } from '../../../types';
import type { NewsPayload } from '../../../ai/news';
import { streamChat } from '../../../ai/stream';

const ask: Command['run'] = async ({ args }) => {
  const q = args.join(' ').trim();
  if (!q) return "usage: ai <question>   e.g.  ai what are Diwakar's core skills?";
  const { text, error } = await streamChat([{ role: 'user', content: q }], () => {});
  if (error) return '⚠ ' + error;
  return text || '(no response)';
};

const LANES = ['research', 'industry', 'community'] as const;

const news: Command['run'] = async ({ args, shell }) => {
  const wanted = LANES.find((l) => l === args[0]);
  if (args[0] && !wanted && args[0] !== 'open') {
    return `usage: news [research|industry|community|open]`;
  }
  if (args[0] === 'open') {
    shell.launch('ainews');
    return 'opening AI Radar…';
  }

  let data: NewsPayload;
  try {
    const res = await fetch('/api/ai-news');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = (await res.json()) as NewsPayload;
  } catch (err) {
    return `news: could not reach the feed aggregator (${err instanceof Error ? err.message : String(err)}).`;
  }

  const items = data.items.filter((i) => !wanted || i.lane === wanted).slice(0, 20);
  if (items.length === 0) return 'news: nothing in the feed right now.';

  const rows = items.map((i) => {
    const when = i.date
      ? `${Math.max(0, Math.round((Date.now() - Date.parse(i.date)) / 3600000))}h`.padStart(4)
      : '   —';
    return `  ${when}  [${i.lane[0].toUpperCase()}] ${i.title}\n        ${i.source} · ${i.url}`;
  });

  const foot = data.unreachable.length ? `\nunreachable feeds: ${data.unreachable.join(', ')}` : '';
  return [`${items.length} headlines (cached ≤30 min):`, '', ...rows, '', `run 'news open' for the AI Radar app.${foot}`].join('\n');
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
    summary: 'latest AI research, industry and community headlines',
    usage: 'news [research|industry|community|open]',
    category: 'ai',
    run: news,
    complete: ({ args }) => [...LANES, 'open'].filter((l) => l.startsWith(args[0] ?? '')),
  },
];
