import { weights } from './dimensions';
import { split } from './layout';
import type { DimensionInfo } from './protocol';

/**
 * The simulated writer: plausible story text from the pools in
 * steering/sim.yaml, with every dial choosing which pool a sentence draws
 * from. No model is involved, and the canvas says so wherever it shows this
 * text. The Python SimBackend (steering/steerable/backends/sim.py) writes from
 * the same pools by the same rules.
 */

export interface SimPools {
  subjects: Record<string, string[]>;
  predicates: Record<string, Record<string, string[]>>;
  dialogue: { relaxed: string[]; tense: string[]; said: Record<string, string[]> } & Record<string, unknown>;
  tails: Record<string, string[]>;
  openers: string[];
  events: Record<string, string[]>;
  pins: string[];
}

export interface SimPin {
  weight: number;
  text: string;
}

/** A small seeded generator (mulberry32): the same seed writes the same text. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SENTENCE_END = ['.', '!', '?', '."', '!"', '?"', '”'];
const pick = <T,>(r: () => number, items: readonly T[]): T => items[Math.floor(r() * items.length)];

export class SimWriter {
  private byName: Map<string, DimensionInfo>;

  constructor(
    private pools: SimPools,
    dims: readonly DimensionInfo[],
  ) {
    this.byName = new Map(dims.map((d) => [d.name, d]));
  }

  /** Pick a pole of a dimension, weighted by where its dial sits. */
  private pole(r: () => number, name: string, dials: Record<string, number>, fallback?: string): string {
    const dim = this.byName.get(name);
    if (!dim) return fallback ?? '';
    const value = dials[name];
    const names = dim.poles.map((p) => p.name);
    if (value == null) return fallback ?? pick(r, names);
    const w = Object.entries(weights(dim, value));
    if (dim.kind === 'bipolar') {
      // the far pole still turns up, less and less, as the dial moves away from it
      if (!w.length) return pick(r, names);
      const [near, strength] = w[0];
      const far = near === names[0] ? names[1] : names[0];
      return r() < 0.5 + strength / 2 ? near : far;
    }
    let x = r() * w.reduce((s, [, v]) => s + v, 0);
    for (const [pole, v] of w) {
      x -= v;
      if (x <= 0) return pole;
    }
    return w[w.length - 1][0];
  }

  private strength(name: string, pole: string, dials: Record<string, number>): number {
    const dim = this.byName.get(name);
    const value = dials[name];
    return dim && value != null ? (weights(dim, value)[pole] ?? 0) : 0;
  }

  /** One sentence, whether it was a pin coming back, and its core (what makes two sentences "the same"). */
  private sentence(r: () => number, dials: Record<string, number>, pins: readonly SimPin[], pinnedLast: boolean): [string, boolean, string] {
    const p = this.pools;
    if (!pinnedLast) {
      for (const pin of pins) {
        if (r() < 0.05 + 0.3 * pin.weight) {
          const phrase = pin.text.split(/\s+/).join(' ').replace(/^[ .,;:!?"']+|[ .,;:!?"']+$/g, '');
          if (phrase) {
            const out = pick(r, p.pins).replace('{pin}', phrase);
            return [out[0].toUpperCase() + out.slice(1), true, out];
          }
        }
      }
    }
    const surprise = dials.surprise;
    if (surprise != null) {
      const kind = surprise > 0.5 ? 'unexpected' : 'expected';
      if (r() < 0.35 * this.strength('surprise', kind, dials)) {
        const event = pick(r, p.events[kind]);
        return [event, false, event];
      }
    } else if (r() < 0.06) {
      const event = pick(r, p.events.expected);
      return [event, false, event];
    }

    const mode = this.pole(r, 'mode', dials);
    const tension = this.pole(r, 'tension', dials) as 'relaxed' | 'tense';
    const focus = this.pole(r, 'focus', dials, 'character');
    const tone = this.pole(r, 'tone', dials);
    const expansive = this.strength('pace', 'expansive', dials);
    const compressed = this.strength('pace', 'compressed', dials);

    let body: string;
    let core: string;
    if (mode === 'dialogue') {
      core = pick(r, p.dialogue[tension]);
      body = `"${core}," ${pick(r, p.dialogue.said[focus])}`;
    } else {
      core = pick(r, p.predicates[mode][tension]);
      body = `${pick(r, p.subjects[focus])} ${core}`;
      if (r() < 0.15 + 0.8 * expansive - 0.15 * compressed) {
        // a name keeps its capital after an opener; "She" and "The girl" do not
        if (body.split(' ', 1)[0] !== 'Elara') body = body[0].toLowerCase() + body.slice(1);
        body = pick(r, p.openers) + body;
      }
    }
    if (r() < 0.6 + 0.4 * expansive - 0.6 * compressed) body += pick(r, p.tails[tone]);
    return [body + '.', false, core];
  }

  text(seed: number, dials: Record<string, number>, pins: readonly SimPin[], soFar: string, maxTokens: number): string {
    const r = rng(seed);
    let out = '';
    const stripped = soFar.trimEnd();
    if (stripped && !SENTENCE_END.some((e) => stripped.endsWith(e))) {
      // the prefix was cut mid-sentence: close it before starting another
      out += pick(r, this.pools.tails[this.pole(r, 'tone', dials)]) + '.';
    }
    let inParagraph = soFar.endsWith('\n') ? 0 : 2;
    const compressed = this.strength('pace', 'compressed', dials);
    // the pools are small: remember only enough to stop a sentence following itself
    let used: string[] = [];
    let pinned = false;
    while (split(out).length < maxTokens) {
      let sentence = '';
      let wasPin = false;
      let core = '';
      for (let i = 0; i < 8; i++) {
        [sentence, wasPin, core] = this.sentence(r, dials, pins, pinned);
        if (!used.includes(core)) break;
      }
      used = [...used, core].slice(-3);
      pinned = wasPin;
      if (inParagraph >= 3 + Math.floor(r() * 3) - Math.round(compressed)) {
        out += '\n\n' + sentence;
        inParagraph = 1;
      } else {
        const lead = !out && (!soFar || soFar.endsWith('\n')) ? '' : ' ';
        out += lead + sentence;
        inParagraph += 1;
      }
    }
    return out;
  }
}
