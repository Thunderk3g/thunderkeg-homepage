/**
 * A focus monitor with no model behind it. It is not attention: it scores each
 * earlier token by how much the words being written now echo it, adds a little
 * for recency and adds the weight of any pin. It is what the gutter draws when
 * the canvas runs in the page, and it is labelled `heuristic` wherever shown.
 *
 * The same function as steering/steerable/attention/heuristic.py;
 * steering/tests/fixtures/attention.json is checked against both.
 */

const WORD = /[\p{L}]+(?:'[\p{L}]+)?/u;
const STOP = new Set(
  (
    'a an and are as at be been but by did do for from had has have he her him his i if in into is it its ' +
    'me my no not of on or our she so that the their them then there they this to up was we were what when ' +
    'which who will with would you your'
  ).split(' '),
);
const RECENCY_SPAN = 40;
const RECENCY_WEIGHT = 0.12;
const STOP_WEIGHT = 0.05;
const STEM_MATCH = 0.5;

export function wordOf(token: string): string {
  const m = WORD.exec(token);
  return m ? m[0].toLowerCase() : '';
}

export interface PinSpan {
  start: number;
  end: number;
  weight: number;
}

export function heuristicScores(tokens: readonly string[], pins: readonly PinSpan[], window = 24): number[] {
  const n = tokens.length;
  if (!n) return [];
  const words = tokens.map(wordOf);
  const counts = new Map<string, number>();
  for (const w of words) if (w) counts.set(w, (counts.get(w) ?? 0) + 1);
  const head = Math.max(0, n - window);
  const query = words.slice(head).filter((w) => w && !STOP.has(w));
  const qWords = new Set(query);
  const qStems = new Set(query.filter((w) => w.length >= 5).map((w) => w.slice(0, 4)));

  const scores = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    const w = words[i];
    if (!w) continue;
    let s = RECENCY_WEIGHT * Math.exp(-(n - 1 - i) / RECENCY_SPAN);
    if (i < head) {
      const match = qWords.has(w) ? 1 : w.length >= 5 && qStems.has(w.slice(0, 4)) ? STEM_MATCH : 0;
      s += match / Math.sqrt(counts.get(w)!);
    }
    if (STOP.has(w)) s *= STOP_WEIGHT;
    scores[i] = s;
  }
  for (const pin of pins) {
    for (let i = Math.max(0, pin.start); i < Math.min(n, pin.end); i++) if (words[i]) scores[i] += pin.weight;
  }
  const top = Math.max(...scores);
  if (top <= 0) return scores;
  return scores.map((s) => Math.round((s / top) * 1e4) / 1e4);
}
