import type { DimensionInfo } from './protocol';

/**
 * What a dial position means. The same arithmetic as
 * steering/steerable/dimensions.py: a position gives a quantum (what the cache
 * is keyed on), a weight per pole (what steers) and the words the canvas shows.
 */

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const r6 = (v: number) => Math.round(v * 1e6) / 1e6;

export function quantise(dim: DimensionInfo, value: number): number {
  return Math.round(clamp01(value) * dim.steps) / dim.steps;
}

export function polePosition(dim: DimensionInfo, pole: string): number {
  const i = dim.poles.findIndex((p) => p.name === pole);
  if (i < 0) throw new Error(`${dim.name} has no pole ${pole}`);
  return i / (dim.poles.length - 1);
}

/** How much of each pole a position carries. Poles at zero are left out. */
export function weights(dim: DimensionInfo, value: number): Record<string, number> {
  const v = clamp01(value);
  if (dim.kind === 'bipolar') {
    if (v < 0.5) return { [dim.poles[0].name]: r6((0.5 - v) * 2) };
    if (v > 0.5) return { [dim.poles[1].name]: r6((v - 0.5) * 2) };
    return {};
  }
  const n = dim.poles.length;
  const x = v * (n - 1);
  const i = Math.min(Math.floor(x), n - 2);
  const f = r6(x - i);
  const out: Record<string, number> = {};
  if (1 - f > 1e-6) out[dim.poles[i].name] = r6(1 - f);
  if (f > 1e-6) out[dim.poles[i + 1].name] = f;
  return out;
}

export function adverb(strength: number): string {
  return strength <= 0.34 ? 'slightly' : strength <= 0.67 ? 'somewhat' : 'very';
}

/** The strongest pole at a position, and its share. */
export function dominant(dim: DimensionInfo, value: number): { pole: string; weight: number } | null {
  let best: { pole: string; weight: number } | null = null;
  for (const [pole, weight] of Object.entries(weights(dim, value))) if (!best || weight > best.weight) best = { pole, weight };
  return best;
}

/** What the canvas prints: "very relaxed", "tender 59%". */
export function readout(dim: DimensionInfo, value: number | null | undefined): string {
  if (value == null) return 'unset';
  const top = dominant(dim, value);
  if (!top) return 'neutral';
  return dim.kind === 'bipolar' ? `${adverb(top.weight)} ${top.pole}` : `${top.pole} ${Math.round(top.weight * 100)}%`;
}

/** The set dials, each snapped to its quantum, in the dimensions' own order. */
export function quantiseAll(dims: readonly DimensionInfo[], dials: Record<string, number | null | undefined>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of dims) {
    const v = dials[d.name];
    if (v != null) out[d.name] = quantise(d, v);
  }
  return out;
}
