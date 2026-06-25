import type { Command } from '../../../types';
import { streamChat } from '../../../ai/stream';

const ask: Command['run'] = async ({ args }) => {
  const q = args.join(' ').trim();
  if (!q) return "usage: ai <question>   e.g.  ai what are Diwakar's core skills?";
  const { text, error } = await streamChat([{ role: 'user', content: q }], () => {});
  if (error) return '⚠ ' + error;
  return text || '(no response)';
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
];
