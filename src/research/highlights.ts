import type { Highlight, Paper } from './types';

/**
 * Highlight → recall-card draft. Deterministic and offline: a number in the
 * sentence becomes a cloze (the claims worth citing are usually numeric);
 * otherwise a "what did <paper> find about …" question with the sentence as
 * the answer. Always a draft — the card editor opens with it.
 */

const NUM = /(?<![\w.])(?:[<>≤≥~≈]\s?)?\d+(?:[.,]\d+)?\s?(?:%|×|x\b|pp\b|points?\b|ms\b|s\b|h\b|k\b|M\b|B\b)?/;

/** "SN-WER — script-normalised WER for…" → "SN-WER" */
export function shortTitle(title: string): string {
  const head = title.split(/\s[—–:-]\s|:\s/)[0].trim();
  return head.length <= 48 ? head : head.split(/\s+/).slice(0, 6).join(' ') + '…';
}

const clean = (s: string) =>
  s
    .replace(/\s+/g, ' ')
    .replace(/^["“'‘]+|["”'’]+$/g, '')
    .trim();

/** A short topic phrase for the question form: the "why" if given, else the sentence's opening words. */
function topicOf(h: Pick<Highlight, 'text' | 'why'>): string {
  const src = clean(h.why || h.text);
  const words = src.replace(/[.;:!?].*$/, '').split(/\s+/).filter(Boolean);
  const phrase = words.slice(0, 8).join(' ');
  return (phrase.charAt(0).toLowerCase() + phrase.slice(1)).replace(/[,]$/, '') + (words.length > 8 ? '…' : '');
}

export interface HighlightDraft {
  prompt: string;
  answer: string;
  elaboration?: string;
  kind: 'cloze' | 'question';
}

export function draftCardFromHighlight(h: Pick<Highlight, 'text' | 'why' | 'where'>, paper: Pick<Paper, 'title'>): HighlightDraft {
  const text = clean(h.text);
  const where = h.where ? ` (${h.where})` : '';
  const m = NUM.exec(text);
  if (m && m[0].trim().length > 0 && text.length <= 400) {
    const ans = m[0].trim();
    const cloze = text.slice(0, m.index) + '____' + text.slice(m.index + m[0].length);
    return {
      kind: 'cloze',
      prompt: `${shortTitle(paper.title)}${where}: ${cloze}`,
      answer: ans,
      elaboration: h.why?.trim() || undefined,
    };
  }
  return {
    kind: 'question',
    prompt: `What did ${shortTitle(paper.title)} find about ${topicOf(h)}?`,
    answer: text,
    elaboration: h.why?.trim() || undefined,
  };
}
