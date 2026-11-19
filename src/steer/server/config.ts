import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { MODELS, isGroq } from '@/os/ai/llm';
import type { PromptDimension } from '../prompting';
import type { DimensionInfo, TaskInfo } from '../protocol';
import type { SimPools } from '../sim';

/**
 * The steering files, read once. steering/dimensions.yaml is the single source
 * for the dials: the Python backend reads the same file. Nothing about a
 * dimension is written down anywhere in the web app.
 */

export interface SteerTask extends TaskInfo {
  /** opens the system prompt */
  framing: string;
}

export interface SteerFile {
  dims: PromptDimension[];
  tasks: SteerTask[];
  sim: SimPools;
}

let cached: SteerFile | null = null;

// Each path is written out in full so the build traces these two files into
// the functions that read them, and nothing else from the directory.
const readDimensions = (): unknown => parse(readFileSync(path.join(process.cwd(), 'steering', 'dimensions.yaml'), 'utf8'));
const readSim = (): unknown => parse(readFileSync(path.join(process.cwd(), 'steering', 'sim.yaml'), 'utf8'));

export function steerFile(): SteerFile {
  if (cached) return cached;
  const raw = readDimensions() as { dimensions?: unknown[]; tasks?: unknown[] };
  const dims = (raw.dimensions ?? []).map((entry) => {
    const d = entry as { name: string; kind?: string; steps?: number; description?: string; poles?: { name: string; description?: string; prompt?: string }[] };
    const poles = (d.poles ?? []).map((p) => ({ name: String(p.name), description: String(p.description ?? ''), prompt: String(p.prompt ?? '') }));
    const kind = d.kind === 'blend' ? 'blend' : 'bipolar';
    if (poles.length < 2 || (kind === 'bipolar' && poles.length !== 2)) throw new Error(`steering/dimensions.yaml: ${d.name} has the wrong number of poles`);
    return { name: String(d.name), kind, steps: Math.max(2, Number(d.steps ?? 6)), description: String(d.description ?? ''), poles } satisfies PromptDimension;
  });
  const tasks = (raw.tasks ?? []).map((entry) => {
    const t = entry as { id: string; label?: string; framing?: string; seed?: string; sim?: boolean };
    return { id: String(t.id), label: String(t.label ?? t.id), framing: String(t.framing ?? '').trim(), seed: String(t.seed ?? '').replace(/^\n+|\n+$/g, ''), sim: !!t.sim };
  });
  cached = { dims, tasks, sim: readSim() as SimPools };
  return cached;
}

/** What the canvas is told: the dials without their prompt wording, the tasks without their framing. */
export function publicConfig(file: SteerFile): { dimensions: DimensionInfo[]; tasks: TaskInfo[]; sim: SimPools } {
  return {
    dimensions: file.dims.map((d) => ({ ...d, poles: d.poles.map(({ name, description }) => ({ name, description })) })),
    tasks: file.tasks.map(({ id, label, seed, sim }) => ({ id, label, seed, sim })),
    sim: file.sim,
  };
}

/** Groq's smaller open-weight model: already the last resort of the site's chain, here the first choice. */
const FAST_ON_GROQ = 'openai/gpt-oss-20b';

const num = (name: string, fallback: number) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

/**
 * How the in-page engine should behave against this site's model key.
 *
 * Speculation is off unless asked for: it sends two extra requests each time
 * the controls come to rest, and most of what they write is thrown away. On a
 * metered or free-tier key that is the first thing to run out. The debounce is
 * longer than the engine's default for the same reason.
 *
 * The reveal pace is here because a fast host needs it most: Groq writes a
 * whole branch in about a fifth of a second, and unpaced that is a paragraph
 * appearing at once. STEER_REVEAL_TOK_S=0 shows text as it arrives.
 */
export function hostedEngine() {
  return {
    revealTokS: process.env.STEER_REVEAL_TOK_S?.trim() === '0' ? 0 : Math.min(1000, num('STEER_REVEAL_TOK_S', 40)),
    speculate: process.env.STEER_SPECULATE === '1',
    debounceMs: num('STEER_DEBOUNCE_MS', 80),
    debounceMaxMs: num('STEER_DEBOUNCE_MAX_MS', 320),
    horizon: Math.min(200, num('STEER_HORIZON', 110)),
    specTokens: Math.min(100, num('STEER_SPEC_TOKENS', 40)),
  };
}

/**
 * The models the steer endpoint tries, in order.
 *
 * For the canvas the time to the first word matters more than the quality of
 * the model: a dial that answers in half a second does not feel like a dial.
 * So unless STEER_MODEL says otherwise, on Groq the smaller model of the chain
 * goes first and the rest of the chain stands behind it.
 */
export function steerModels(): string[] {
  const named = (process.env.STEER_MODEL ?? '')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
  if (named.length) return named;
  return isGroq ? [...new Set([FAST_ON_GROQ, ...MODELS])] : MODELS;
}
