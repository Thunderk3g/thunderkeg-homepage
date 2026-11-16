import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
// Run: npx tsx scripts/steer.test.mts
import { heuristicScores } from '../src/steer/attention.ts';
import { dominant, quantise, quantiseAll, readout, weights } from '../src/steer/dimensions.ts';
import { DEFAULT_SETTINGS, Engine, type EngineSettings, type GenRequest, type TokenSource } from '../src/steer/engine.ts';
import { StreamSplitter, lineCount, paragraphs, split, wrap } from '../src/steer/layout.ts';
import { chatMessages, joinSeam, styleBlock } from '../src/steer/prompting.ts';
import type { ConfigMsg, DimensionInfo, InvalidateMsg, ServerMsg, StateMsg, TelemetryMsg } from '../src/steer/protocol.ts';
import { SimSource } from '../src/steer/sources.ts';

const ok = (c: unknown, m: string) => { assert.ok(c, m); console.log('ok -', m); };
const eq = (a: unknown, b: unknown, m: string) => { assert.deepEqual(a, b, m); console.log('ok -', m); };
const fixture = (name: string) => JSON.parse(readFileSync(new URL(`../steering/tests/fixtures/${name}`, import.meta.url), 'utf8'));
const yaml = (name: string) => parse(readFileSync(new URL(`../steering/${name}`, import.meta.url), 'utf8'));

/* ── the two runtimes agree: the same fixtures the Python tests check ── */

for (const c of fixture('layout.json')) {
  const tokens = split(c.text);
  assert.deepEqual(tokens, c.tokens);
  assert.equal(tokens.join(''), c.text);
  assert.deepEqual(wrap(tokens, c.cols), c.lines);
  assert.equal(lineCount(tokens, c.cols), c.line_count);
  assert.equal(paragraphs(tokens), c.paragraphs);
}
console.log('ok - tokens, lines and paragraphs match the Python layout');

for (const c of fixture('attention.json')) {
  const got = heuristicScores(c.tokens, c.pins, c.window);
  assert.equal(got.length, c.scores.length);
  got.forEach((v, i) => assert.ok(Math.abs(v - c.scores[i]) <= 1.01e-4, `score ${i}: ${v} vs ${c.scores[i]}`));
}
console.log('ok - the heuristic focus monitor matches the Python one');

{
  const text = 'Elara  ran.\n\n"Now," she said, and the gate\nclosed ';
  for (const size of [1, 2, 3, 7, 50]) {
    const s = new StreamSplitter();
    const out: string[] = [];
    for (let i = 0; i < text.length; i += size) out.push(...s.feed(text.slice(i, i + size)));
    out.push(...s.flush());
    assert.deepEqual(out, split(text), `chunks of ${size}`);
  }
  console.log('ok - streamed text is cut into the same tokens as whole text');
}

/* ── dimensions, read from the same YAML the backend reads ── */

const raw = yaml('dimensions.yaml');
const promptDims = raw.dimensions as (DimensionInfo & { poles: { name: string; description: string; prompt: string }[] })[];
const dims: DimensionInfo[] = promptDims.map((d) => ({ name: d.name, kind: d.kind, steps: d.steps, description: d.description, poles: d.poles.map((p) => ({ name: p.name, description: p.description })) }));
const tasks = (raw.tasks as { id: string; label: string; seed: string; sim?: boolean }[]).map((t) => ({ id: t.id, label: t.label, seed: t.seed, sim: !!t.sim }));
const pace = dims.find((d) => d.name === 'pace')!;
const tone = dims.find((d) => d.name === 'tone')!;

eq(weights(pace, 0.5), {}, 'a bipolar dial is neutral at its centre');
eq(readout(pace, 0), 'very compressed', 'and reads as an adverb and a pole away from it');
eq(readout(pace, 2 / 6), 'slightly compressed', 'one step from centre is "slightly"');
eq(weights(tone, 0.2), { wry: 0.4, tender: 0.6 }, 'a blend interpolates between its two nearest poles');
eq(readout(tone, 0.2), 'tender 60%', 'and reads as the dominant pole and its share');
eq(readout(tone, null), 'unset', 'an untouched dial is unset');
eq(dominant(tone, 1), { pole: 'wondrous', weight: 1 }, 'the far end is the last pole');
eq(quantise(pace, 0.49), 0.5, 'values snap to the dial\'s quanta');
eq(quantiseAll(dims, { tone: 0.2, pace: null, mode: 0.99 }), { tone: 2 / 12, mode: 1 }, 'only set dials are steered with');

{
  const block = styleBlock(promptDims, { tone: 0.25, pace: 1, tension: 0.5 }, [{ weight: 0.9, text: 'hidden' }, { weight: 0.2, text: 'Shadows  stretched' }]);
  ok(block.includes('tone: mostly tender (75%) with some wry (25%)'), 'the style block states a blend');
  ok(block.includes('pace: very expansive (100%)'), 'and a bipolar dial with its strength');
  ok(!block.includes('tension'), 'a dial at its neutral centre says nothing');
  ok(block.includes('"hidden" (must stay central)') && block.includes('"Shadows stretched" (keep lightly in mind)'), 'pins become a keep-in-focus list');
  eq(styleBlock(promptDims, {}, []), '', 'no dials and no pins: no block');
  const [system, user] = chatMessages(promptDims, { text: 'One. Two', dials: { mode: 1 / 3 }, pins: [], maxTokens: 50, framing: 'A sales advisor speaks.' });
  ok(system.content.includes('sales advisor') && system.content.includes('mode: dialogue') && user.content.includes('One. Two'), 'the request carries the framing, the steering and the text');
  eq(joinSeam('She waited.', 'Then'), ' Then', 'a continuation is joined to the text with a space');
  eq(joinSeam('She waited', ', then left.'), ', then left.', 'but not before punctuation');
  eq(joinSeam('She waited.\n\n', ' Then'), 'Then', 'nor after a paragraph break');
  eq(joinSeam('"Wait', '," she said.'), '," she said.', 'an open quote is closed without a space');
}

/* ── the engine: the same rules the Python suite holds steering/steerable/engine.py to ── */

const SEED = 'Elara had kept the key hidden for eleven years.';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class Client {
  tokens: string[] = [];
  branch: string | null = null;
  msgs: ServerMsg[] = [];
  violations: string[] = [];
  state: StateMsg | null = null;
  telemetry: TelemetryMsg | null = null;
  recv = (msg: ServerMsg) => {
    this.msgs.push(msg);
    if (msg.type === 'invalidate') {
      if (msg.from_tok > this.tokens.length) this.violations.push('invalidate past the end');
      this.tokens.length = Math.min(this.tokens.length, msg.from_tok);
      this.branch = msg.branch_id;
    } else if (msg.type === 'tokens') {
      if (msg.branch_id !== this.branch) return void this.violations.push(`stale tokens: ${msg.branch_id} while on ${this.branch}`);
      if (msg.from_tok !== this.tokens.length) return void this.violations.push(`gap at ${msg.from_tok}`);
      this.tokens.push(...msg.tokens);
    } else if (msg.type === 'state') this.state = msg;
    else if (msg.type === 'telemetry') this.telemetry = msg;
  };
  invalidates = () => this.msgs.filter((m): m is InvalidateMsg => m.type === 'invalidate');
  get text() { return this.tokens.join(''); }
}

class Counting extends SimSource {
  requests: GenRequest[] = [];
  finished = 0;
  async *generate(req: GenRequest, signal: AbortSignal) {
    this.requests.push(req);
    yield* super.generate(req, signal);
    if (!signal.aborted) this.finished += 1;
  }
}

const pools = yaml('sim.yaml');
const made: { engine: Engine; source: TokenSource }[] = [];
function rig(over: Partial<EngineSettings> & { tokS?: number; ttftMs?: number } = {}) {
  const { tokS = 0, ttftMs = 0, ...settings } = over;
  const source = new Counting(pools, dims, tokS, ttftMs);
  const client = new Client();
  const engine = new Engine(source, dims, tasks, { ...DEFAULT_SETTINGS, horizon: 40, specTokens: 16, debounceMs: 5, frameMs: 1, attentionMs: 5, ...settings }, client.recv, true);
  engine.start();
  made.push({ engine, source });
  return { engine, client, source };
}
async function settle(engine: Engine, timeout = 5000) {
  const end = Date.now() + timeout;
  let quiet = 0;
  while (Date.now() < end) {
    quiet = engine.idle ? quiet + 1 : 0;
    if (quiet >= 3) return;
    await sleep(4);
  }
  throw new Error('engine did not settle');
}
const consistent = (engine: Engine, client: Client) => {
  assert.deepEqual(client.violations, []);
  assert.deepEqual(client.tokens, engine.slice(0, engine.visible), "the client's text is not the engine's");
  assert.equal(engine.orphans, 0);
};
const seedLen = split(SEED).length;

{
  const { engine, client } = rig({ speculate: false });
  engine.seed(SEED);
  await settle(engine);
  ok(client.text.startsWith(SEED) && client.tokens.length === seedLen + 40, 'a seed is written on to the horizon');
  const config = client.msgs.find((m): m is ConfigMsg => m.type === 'config')!;
  eq(config.tasks.map((t) => t.id), ['story'], 'the simulated source only offers what it can write');
  const before = client.text;
  engine.setDial('tone', 1, undefined, 7);
  await settle(engine);
  const inv = client.invalidates().at(-1)!;
  ok(inv.from_tok === seedLen && inv.cause_seq === 7 && !inv.cached && inv.reason === 'switch', 'a dial change invalidates from the anchor and names its gesture');
  ok(client.text.startsWith(SEED) && client.text !== before, 'and the text after the anchor is rewritten');
  consistent(engine, client);
}

{
  const { engine, client, source } = rig({ speculate: false });
  engine.seed(SEED);
  engine.setDial('pace', 0);
  await settle(engine);
  const first = client.text;
  engine.setDial('pace', 1);
  await settle(engine);
  const calls = source.requests.length;
  engine.setDial('pace', 0);
  await settle(engine);
  ok(client.invalidates().at(-1)!.cached && client.text === first && source.requests.length === calls, 'returning to a setting is served from the cache, with no request');
  const invalidates = client.invalidates().length;
  engine.setDial('pace', 0.04);
  await settle(engine);
  ok(client.invalidates().length === invalidates && source.requests.length === calls && client.state!.dials.pace === 0.04, 'moving inside a quantum regenerates nothing');
  consistent(engine, client);
}

{
  const { engine, client, source } = rig({ tokS: 2000, ttftMs: 3, debounceMs: 4 });
  engine.seed(SEED);
  await sleep(20);
  for (let i = 0; i < 100; i++) {
    engine.setDial(['tone', 'pace', 'tension', 'mode'][i % 4], ((i * 37) % 13) / 12, undefined, i);
    await sleep([0, 2, 9, 30][i % 4]);
    assert.deepEqual(client.violations, [], `after change ${i}`);
  }
  await settle(engine);
  consistent(engine, client);
  ok(engine.cancelled > 0 && engine.inflight === 0 && source.inflight === 0, 'a hundred rapid dial changes leave no stale tokens and nothing in flight');
  ok(source.requests.length - (source as Counting).finished >= 1, 'and requests really were cut short');
}

{
  const { engine, client, source } = rig({ speculate: false });
  engine.seed(SEED);
  await settle(engine);
  const full = [...client.tokens];
  const calls = source.requests.length;
  engine.scrub(full.length - 25, 3);
  ok(client.tokens.length === full.length - 25 && client.invalidates().at(-1)!.reason === 'scrub', 'scrubbing back truncates in the same call');
  engine.scrub(full.length - 10);
  eq(client.tokens, full.slice(0, -10), 'scrubbing forward reveals the tail that was dropped');
  engine.scrub(full.length);
  await settle(engine);
  ok(client.tokens.length === full.length && source.requests.length === calls, 'and costs no request');
  engine.scrub(0);
  eq(client.tokens.length, seedLen, 'the knob cannot enter committed text');
  engine.scrub(10_000);
  await settle(engine);
  eq(client.tokens.length, full.length + 40, 'pulling past the end writes one more horizon');
  consistent(engine, client);
}

{
  const { engine, client, source } = rig({ speculate: false });
  engine.seed(SEED);
  await settle(engine);
  const original = [...client.tokens];
  const cut = original.length - 20;
  engine.scrub(cut);
  engine.setDial('tone', 0);
  await settle(engine);
  ok(client.invalidates().at(-1)!.from_tok === cut && source.requests.at(-1)!.anchor === cut, 'after scrubbing back, a change keeps the text before the knob');
  eq(client.tokens.slice(0, cut), original.slice(0, cut), 'word for word');
  engine.setDial('tone', null);
  await settle(engine);
  ok(client.invalidates().at(-1)!.cached, 'and turning the dial back finds the tail that was scrubbed away');
  eq(client.tokens.slice(0, original.length), original, 'unchanged');
  engine.commit();
  await settle(engine);
  const n = client.state!.committed;
  const kept = client.tokens.slice(0, n);
  engine.setDial('tension', 1);
  await settle(engine);
  ok(client.invalidates().at(-1)!.from_tok === n, 'committed text is never regenerated');
  eq(client.tokens.slice(0, n), kept, 'not one token of it');
  consistent(engine, client);
}

{
  const { engine, client, source } = rig();
  engine.seed(SEED);
  engine.setDial('pace', 0.5);
  await settle(engine);
  const spec = source.requests.filter((r) => Math.abs(r.dials.pace - 2 / 6) < 1e-9 || Math.abs(r.dials.pace - 4 / 6) < 1e-9);
  ok(engine.sim === 2 && spec.length === 2 && spec.every((r) => r.maxTokens === 16), 'while idle, one quantum either side of the dial is generated, capped');
  engine.setDial('pace', 4 / 6);
  await sleep(3);
  const inv = client.invalidates().at(-1)!;
  ok(inv.cached && client.tokens.length >= inv.from_tok + 16, 'so the next step of the knob is a hit, shown without waiting out the debounce');
  await settle(engine);
  eq(client.tokens.length, inv.from_tok + 40, 'and the speculative branch is finished once chosen');
  consistent(engine, client);
}

{
  const { engine, client, source } = rig({ tokS: 300, ttftMs: 20 });
  engine.seed(SEED);
  engine.setDial('pace', 0.5);
  for (let i = 0; i < 600 && engine.sim < 2; i++) await sleep(5);
  const cancelled = engine.cancelled;
  engine.setDial('pace', 4 / 6);
  eq(engine.cancelled, cancelled + 1, 'a speculative request already writing the chosen branch is adopted, not cancelled');
  await settle(engine);
  const target = source.requests.filter((r) => Math.abs(r.dials.pace - 4 / 6) < 1e-9);
  ok(target[0].maxTokens === 16 && client.tokens.length === client.invalidates().at(-1)!.from_tok + 40, 'and carries on to the horizon');
  consistent(engine, client);
}

{
  const { engine, client, source } = rig({ speculate: false });
  engine.seed(SEED);
  await settle(engine);
  const [start, end] = [seedLen + 4, seedLen + 7];
  const phrase = client.tokens.slice(start, end).join('').trim();
  const kept = client.tokens.slice(0, end);
  engine.pin(start, end, 0.9, 'a');
  await settle(engine);
  eq(client.tokens.slice(0, end), kept, 'pinning a phrase keeps the phrase');
  ok(client.invalidates().at(-1)!.from_tok === end && source.requests.at(-1)!.pins[0].text === phrase && client.state!.pins[0].text === phrase, 'and sends it to the source from then on');
  engine.unpin('a');
  await settle(engine);
  ok(client.state!.pins.length === 0 && source.requests.at(-1)!.pins.length === 0, 'unpinning releases it');
  engine.pin(seedLen + 10, seedLen + 12, 0.5, 'late');
  await settle(engine);
  engine.scrub(seedLen + 3);
  engine.setDial('mode', 0);
  await settle(engine);
  eq(client.state!.pins, [], 'a pin whose text is replaced is dropped');
  consistent(engine, client);
}

{
  const { engine, client } = rig({ debounceMs: 30, debounceMaxMs: 60, speculate: false });
  engine.seed(SEED);
  await settle(engine);
  const switches = engine.steer;
  for (let i = 1; i <= 12; i++) {
    engine.setDial('tone', i / 12, undefined, i);
    await sleep(10);
  }
  ok(engine.steer > switches, 'a hand that never stops still gets text while it moves');
  await settle(engine);
  eq(client.invalidates().at(-1)!.cause_seq, 12, 'and ends on the last gesture');
  consistent(engine, client);
}

{
  const { engine, client, source } = rig({ debounceMs: 300, debounceMaxMs: 350, speculate: false });
  engine.seed(SEED);
  await settle(engine);
  await sleep(400);
  const switches = engine.steer;
  engine.setDial('tone', 1, undefined, 1);
  await sleep(30);
  eq(engine.steer, switches + 1, 'the first change after a rest is not debounced');
  engine.setDial('tone', 0, undefined, 2);
  await sleep(50);
  eq(engine.steer, switches + 1, 'a change right behind it is part of a burst, and is');
  await settle(engine);
  eq(source.requests.at(-1)!.dials, { tone: 0 }, 'and the text ends on the last of them');
  consistent(engine, client);
}

{
  // changes arrive faster than the first token: cancelling each time would show nothing until the hand stops
  const { engine, client, source } = rig({ ttftMs: 60, tokS: 2000, debounceMs: 10, debounceMaxMs: 30, speculate: false });
  engine.seed(SEED);
  await settle(engine);
  const branches = () => new Set(client.msgs.filter((m) => m.type === 'tokens').map((m) => (m as { branch_id: string }).branch_id));
  const before = branches().size;
  const start = Date.now();
  let firstText = 0;
  for (let i = 1; i <= 24; i++) {
    engine.setDial('tone', (i % 13) / 12, undefined, i);
    engine.setDial('tension', ((i * 5) % 7) / 6, undefined, 100 + i);
    await sleep(25);
    if (!firstText && branches().size > before) firstText = Date.now() - start;
  }
  ok(branches().size - before >= 4, 'a dial that keeps moving shows text at the pace of the model, not when it stops');
  ok(firstText > 0 && firstText < 200, 'and the first of it arrives one time-to-first-token after the hand starts');
  await settle(engine);
  const q = engine.state().quantised;
  eq(source.requests.at(-1)!.dials, q, 'at rest the text is the branch for the final controls');
  consistent(engine, client);
  ok(engine.inflight === 0 && source.inflight === 0, 'with nothing left in flight');
}

{
  const { engine, client, source } = rig({ tokS: 300, speculate: false });
  engine.seed(SEED);
  await sleep(60);
  engine.stop();
  await sleep(30);
  const stopped = client.tokens.length;
  await sleep(50);
  ok(client.tokens.length === stopped && !client.state!.generating && engine.inflight === 0 && source.inflight === 0, 'stop cancels the stream and nothing arrives after it');
  engine.handle({ type: 'reroll' });
  await settle(engine);
  eq(client.state!.variant, 1, 'reroll asks for another sample');
  await sleep(300);
  const t = client.telemetry!;
  ok(t.tokens === client.tokens.length && t.orphans === 0 && t.inflight === 0 && t.steer === engine.steer, 'telemetry reports the session');
  const attn = client.msgs.filter((m) => m.type === 'attention').at(-1)!;
  ok(attn.type === 'attention' && attn.tok_scores.length === client.tokens.length && attn.source === 'heuristic' && Math.max(...attn.line_scores) === 1, 'the focus monitor scores every visible token and says where the scores come from');
  consistent(engine, client);
}

{
  // a source that ignores its abort signal: the fault the orphan check exists to catch
  class Deaf extends SimSource {
    async *generate(_req: GenRequest, _signal: AbortSignal) {
      this.inflight += 1;
      try {
        for (let i = 0; i < 12; i++) {
          await sleep(20);
          yield ['x'];
        }
      } finally {
        this.inflight -= 1;
      }
    }
  }
  const client = new Client();
  const engine = new Engine(new Deaf(pools, dims), dims, tasks, { ...DEFAULT_SETTINGS, speculate: false, debounceMs: 5 }, client.recv, false);
  const quiet = console.error;
  console.error = () => undefined;
  engine.start();
  engine.seed(SEED);
  await sleep(50);
  engine.setDial('tone', 0);
  // the engine waits for the cancelled request; this one refuses to stop, so run the check without it
  (engine as unknown as { dying: Set<unknown> }).dying.clear();
  await sleep(50);
  console.error = quiet;
  ok(engine.orphans >= 1, 'a request that outlives its cancel is detected');
  await sleep(300);
  await engine.close();
}

for (const { engine, source } of made) {
  await engine.close();
  assert.equal(engine.inflight, 0, 'a generation outlived its session');
  assert.equal(source.inflight, 0, 'a source request outlived its session');
}
console.log('\nall steer checks passed');
