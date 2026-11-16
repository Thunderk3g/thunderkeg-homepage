import { adverb, weights } from './dimensions';

/**
 * Tier A steering: the dial values and pins, compiled into a prompt. A hosted
 * API exposes neither activations nor attention, so the text of the request is
 * the only handle. The same compiler as steering/steerable/prompting.py.
 */

export interface PromptPole {
  name: string;
  prompt: string;
}

export interface PromptDimension {
  name: string;
  kind: 'bipolar' | 'blend';
  steps: number;
  description: string;
  poles: (PromptPole & { description: string })[];
}

export interface PromptPin {
  weight: number;
  text: string;
}

/** weights below this are noise in a blend and are left out of the prompt */
const MIN_SHARE = 0.1;
const pct = (w: number) => Math.round(w * 100);

export function styleLine(dim: PromptDimension, value: number): string | null {
  const prompt = (pole: string) => dim.poles.find((p) => p.name === pole)?.prompt ?? '';
  let ranked = Object.entries(weights(dim, value)).sort((a, b) => b[1] - a[1]);
  if (!ranked.length) return null;
  if (dim.kind === 'bipolar') {
    const [pole, strength] = ranked[0];
    return `${dim.name}: ${adverb(strength)} ${pole} (${pct(strength)}%) — ${prompt(pole)}`;
  }
  ranked = ranked.filter(([, w]) => w >= MIN_SHARE);
  if (ranked.length === 1) return `${dim.name}: ${ranked[0][0]} — ${prompt(ranked[0][0])}`;
  const [[a, wa], [b, wb]] = ranked;
  if (Math.abs(wa - wb) < 0.02) return `${dim.name}: an even blend of ${a} and ${b} — ${a}: ${prompt(a)}; ${b}: ${prompt(b)}`;
  return `${dim.name}: mostly ${a} (${pct(wa)}%) with some ${b} (${pct(wb)}%) — ${a}: ${prompt(a)}; ${b}: ${prompt(b)}`;
}

export function pinEmphasis(weight: number): string {
  return weight < 0.34 ? 'keep lightly in mind' : weight < 0.67 ? 'keep in focus' : 'must stay central';
}

export function styleBlock(dims: readonly PromptDimension[], dials: Record<string, number>, pins: readonly PromptPin[]): string {
  const parts: string[] = [];
  const lines = dims.flatMap((d) => (d.name in dials ? [styleLine(d, dials[d.name])] : [])).filter((l): l is string => !!l);
  if (lines.length) {
    parts.push(
      'STEERING (apply to everything you write next; where two lines pull apart, honour both):\n' +
        lines.map((l) => `- ${l}`).join('\n'),
    );
  }
  const seen = new Set<string>();
  const focus: string[] = [];
  for (const pin of [...pins].sort((a, b) => b.weight - a.weight)) {
    const text = pin.text.split(/\s+/).filter(Boolean).join(' ');
    if (text && !seen.has(text.toLowerCase())) {
      seen.add(text.toLowerCase());
      focus.push(`- "${text}" (${pinEmphasis(pin.weight)})`);
    }
  }
  if (focus.length) {
    parts.push(
      "KEEP IN FOCUS (the reader's attention is locked on these phrases from the text; " +
        'let what you write next stay with them, return to them or build on them):\n' +
        focus.join('\n'),
    );
  }
  return parts.join('\n\n');
}

export function chatMessages(
  dims: readonly PromptDimension[],
  req: { text: string; dials: Record<string, number>; pins: readonly PromptPin[]; maxTokens: number; framing?: string },
): { role: 'system' | 'user'; content: string }[] {
  // a display token is about one word
  const words = Math.max(20, Math.floor(req.maxTokens * 0.9));
  const rules =
    `${req.framing || 'You are continuing a piece of writing.'}\n\n` +
    'Continue the text from exactly where it stops, as if you were the same writer mid-flow. ' +
    'Output only the continuation: no preamble, no repetition of the existing text, no commentary, ' +
    'no headings, no markdown. If the text stops mid-sentence, finish that sentence first. ' +
    `Write about ${words} words and end on a complete sentence.`;
  const block = styleBlock(dims, req.dials, req.pins);
  return [
    { role: 'system', content: block ? `${rules}\n\n${block}` : rules },
    { role: 'user', content: `<text>\n${req.text}\n</text>\n\nContinue the text from exactly where it stops.` },
  ];
}

/** Chat models answer as a fresh message; make the seam with the existing text clean. */
export function joinSeam(soFar: string, text: string): string {
  if (!soFar || soFar.endsWith('\n') || soFar.endsWith(' ')) return text.replace(/^ +/, '');
  const head = text.slice(0, 1);
  if (!head || /\s/.test(head) || '.,;:!?)]}…’”-'.includes(head)) return text;
  if (head === '"' || head === "'") {
    // a straight quote closes if one is open in the paragraph being continued
    const paragraph = soFar.slice(soFar.lastIndexOf('\n') + 1);
    if ((paragraph.split(head).length - 1) % 2 === 1) return text;
  }
  return ' ' + text;
}
