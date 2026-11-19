import { quantise, quantiseAll } from './dimensions';
import { paragraphs, wrap } from './layout';
import type { ClientMsg, DimensionInfo, ServerMsg, StateMsg, TaskInfo, TelemetryMsg } from './protocol';

/**
 * The generation engine, running in the page.
 *
 * This is the same engine as steering/steerable/engine.py, which is the
 * reference and carries the full account of the rules. In short: the text is a
 * path with a committed mark, an anchor (where regeneration starts) and a
 * visible mark. A branch is one continuation of one prefix under one set of
 * controls, cached by hash(prefix up to the anchor) + quantised dials + pins.
 * A control change cancels what is in flight, waits out the debounce, sends
 * `invalidate`, then serves the branch from the cache or generates it. A
 * backward scrub truncates at once and keeps the tail; while idle, the
 * neighbouring quanta of the dial last touched are generated ahead of need.
 *
 * It speaks the same messages as the WebSocket backend, so the canvas cannot
 * tell which one it is talking to.
 *
 * One thing here is the page's own: the paced reveal (`revealTokS`). A hosted
 * model writes a whole branch in a fraction of a second, which reads as a
 * block of text landing after a wait. With a pace set, a branch still fills
 * (and is cached) as fast as it arrives, but its words go on screen one at a
 * time.
 */

export interface PinSpec {
  start: number;
  end: number;
  weight: number;
  text: string;
}

export interface GenRequest {
  /** every display token so far: the kept prefix, then whatever this branch already holds */
  tokens: string[];
  /** index in `tokens` where the steered continuation begins */
  anchor: number;
  /** the set dials, already quantised */
  dials: Record<string, number>;
  pins: PinSpec[];
  maxTokens: number;
  seed: number;
  task: string | null;
}

export class SourceError extends Error {
  constructor(
    message: string,
    public retryAfter?: number,
  ) {
    super(message);
  }
}

/** Where tokens come from. The engine knows nothing about prompts or HTTP. */
export interface TokenSource {
  readonly name: string;
  /** sim | A */
  readonly tier: string;
  readonly model?: string | null;
  readonly attentionSource: string;
  /** requests currently open; the engine checks this returns to zero */
  inflight: number;
  split(text: string): string[];
  /** the weight a pin is cached under: two weights at one level share a branch */
  pinLevel(weight: number): number;
  /** Yield display tokens until maxTokens, the end of the text, or the signal aborts. */
  generate(req: GenRequest, signal: AbortSignal): AsyncGenerator<string[], void, void>;
  attention(tokens: string[], pins: PinSpec[], window: number): Promise<{ scores: number[]; source: string } | null>;
}

export interface EngineSettings {
  horizon: number;
  specTokens: number;
  speculate: boolean;
  debounceMs: number;
  debounceMaxMs: number;
  frameMs: number;
  cacheSize: number;
  maxTokens: number;
  cols: number;
  attentionMs: number;
  focusWindow: number;
  /** how long a request still waiting for its first token is left to land when the controls move on */
  holdMs: number;
  /**
   * The most display tokens put on screen per second; 0 shows each one as it
   * arrives. Only words not yet seen are paced: text a branch has shown before
   * comes back at once.
   */
  revealTokS: number;
}

export const DEFAULT_SETTINGS: EngineSettings = {
  horizon: 120,
  specTokens: 48,
  speculate: true,
  debounceMs: 30,
  debounceMaxMs: 90,
  frameMs: 16,
  cacheSize: 64,
  maxTokens: 4000,
  cols: 72,
  attentionMs: 100,
  focusWindow: 24,
  holdMs: 400,
  revealTokS: 0,
};

/** how long the controls must be still before neighbours are speculated */
const SPECULATE_AFTER_MS = 120;
const TELEMETRY_EVERY_MS = 250;

interface Branch {
  key: string;
  dials: Record<string, number>;
  pins: PinSpec[];
  tokens: string[];
  /** the source ended the text itself; there is nothing more to ask for */
  done: boolean;
  /** how many of its tokens have ever been on screen */
  shown: number;
}

interface Work {
  key: string;
  controller: AbortController;
  promise: Promise<void>;
  done: boolean;
}

interface PinRecord extends PinSpec {
  id: string;
}

/** cyrb53: a fast 53-bit string hash, enough to key a few dozen branches. */
export function hash(text: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

export function percentile(values: number[], q: number): number {
  if (!values.length) return 0;
  const ordered = [...values].sort((a, b) => a - b);
  const k = (ordered.length - 1) * q;
  const lo = Math.floor(k);
  const hi = Math.min(lo + 1, ordered.length - 1);
  return ordered[lo] + (ordered[hi] - ordered[lo]) * (k - lo);
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export class Engine {
  // the path
  private prefix: string[] = [];
  private active: Branch | null = null;
  committed = 0;
  private anchorPos = 0;
  visible = 0;
  private target = 0;
  private following = true;

  // the controls
  private dials: Record<string, number | null> = {};
  private pins = new Map<string, PinRecord>();
  private variant = 0;
  private task: string | null = null;
  private activeDim: string | null = null;
  private cols: number;

  /** insertion order is recency: the first key is the least recently used */
  private cache = new Map<string, Branch>();
  private activation = 0;
  private branchId = 'none-0';

  // work
  private genTask: Work | null = null;
  private specTasks = new Map<string, Work>();
  private dying = new Set<Work>();
  private switchTimer: ReturnType<typeof setTimeout> | null = null;
  /** switches waiting for cancelled requests to finish */
  private switching = 0;
  private specTimer: ReturnType<typeof setTimeout> | null = null;
  private frameTimer: ReturnType<typeof setTimeout> | null = null;
  private frameDirty = false;
  /** armed while written words are still waiting for their turn on screen */
  private revealTimer: ReturnType<typeof setTimeout> | null = null;
  /** when the next word may be shown */
  private revealAt = 0;
  /** nothing is waiting to be shown, so the reveal clock is stopped */
  private starved = true;
  private attnBusy = false;
  private attnDirty = false;
  private telemetryTimer: ReturnType<typeof setInterval> | null = null;
  private epoch = 0;
  private pendingKey: string | null = null;
  private burstAt: number | null = null;
  /** the controls have moved on, but the request in flight is being left to land first */
  private deferred = false;
  private holdTimer: ReturnType<typeof setTimeout> | null = null;
  private activeSince = 0;
  /** when a control change last asked for a branch that had to be generated */
  private changedAt = -Infinity;
  private closed = false;

  // counters
  inflight = 0;
  orphans = 0;
  steer = 0;
  sim = 0;
  cacheHits = 0;
  cacheMisses = 0;
  cancelled = 0;
  private gestureAt: number | null = null;
  private gestureSeq: number | null = null;
  private latencyFrom: number | null = null;
  private latencies: number[] = [];
  private latencyMs = 0;
  private rate: [number, number][] = [];
  private tokS = 0;
  private lastTelemetry = '';

  constructor(
    private source: TokenSource,
    private dims: readonly DimensionInfo[],
    private tasks: readonly TaskInfo[],
    private s: EngineSettings,
    private send: (msg: ServerMsg) => void,
    private strict = false,
  ) {
    this.cols = s.cols;
    for (const d of dims) this.dials[d.name] = null;
  }

  /* ───────────────────────── lifecycle ───────────────────────── */

  start(): void {
    this.send({
      type: 'config',
      backend: this.source.name,
      tier: this.source.tier,
      model: this.source.model ?? null,
      attention_source: this.source.attentionSource,
      dimensions: [...this.dims],
      tasks: this.tasks.filter((t) => this.source.tier !== 'sim' || t.sim),
      horizon: this.s.horizon,
      cols: this.cols,
      frame_ms: this.s.frameMs,
    });
    this.emitState();
    this.telemetryTimer = setInterval(() => this.emitTelemetry(), TELEMETRY_EVERY_MS);
    this.emitTelemetry();
  }

  async close(): Promise<void> {
    this.closed = true;
    this.cancelSwitch();
    this.cancelWork('close');
    for (const t of [this.specTimer, this.frameTimer, this.holdTimer, this.revealTimer]) if (t != null) clearTimeout(t);
    if (this.telemetryTimer != null) clearInterval(this.telemetryTimer);
    await this.drain();
  }

  /* ───────────────────────── the path ───────────────────────── */

  private len(): number {
    return this.prefix.length + (this.active ? this.active.tokens.length : 0);
  }

  slice(start: number, end: number): string[] {
    const n = this.prefix.length;
    if (end <= n) return this.prefix.slice(start, end);
    const tail = this.active ? this.active.tokens : [];
    if (start >= n) return tail.slice(start - n, end - n);
    return [...this.prefix.slice(start), ...tail.slice(0, end - n)];
  }

  private get anchor(): number {
    return Math.max(this.committed, Math.min(this.anchorPos, this.visible));
  }

  get generating(): boolean {
    return this.genTask !== null || this.switchTimer !== null || this.switching > 0;
  }

  /** nothing in flight and nothing scheduled: for tests and the harness */
  get idle(): boolean {
    return !this.generating && !this.specTasks.size && this.specTimer === null && !this.dying.size && !this.frameDirty && this.revealTimer === null;
  }

  /* ───────────────────────── keys ───────────────────────── */

  private quantised(): Record<string, number> {
    return quantiseAll(this.dims, this.dials);
  }

  private pinSpecs(upto: number): PinSpec[] {
    return [...this.pins.values()]
      .filter((p) => p.end <= upto)
      .sort((a, b) => a.start - b.start || a.end - b.end)
      .map((p) => ({ start: p.start, end: p.end, weight: this.source.pinLevel(p.weight), text: p.text }));
  }

  private key(prefixHash: number, dials: Record<string, number>, pins: PinSpec[]): string {
    return JSON.stringify([
      prefixHash,
      Object.entries(dials).sort(([a], [b]) => (a < b ? -1 : 1)),
      pins.map((p) => [p.start, p.end, p.weight]),
      this.variant,
      this.task,
    ]);
  }

  private keyAt(anchor: number): string {
    return this.key(hash(this.slice(0, anchor).join('')), this.quantised(), this.pinSpecs(anchor));
  }

  /* ───────────────────────── messages in ───────────────────────── */

  handle(msg: ClientMsg): void {
    if (this.closed) return;
    switch (msg.type) {
      case 'set_dial':
        return this.setDial(msg.dim, msg.value, msg.pole, msg.seq);
      case 'pin':
        return this.pin(msg.start_tok, msg.end_tok, msg.weight, msg.id, msg.seq);
      case 'unpin':
        return this.unpin(msg.id, msg.seq);
      case 'scrub':
        return this.scrub(msg.position_tok, msg.seq);
      case 'seed':
        return this.seed(msg.text, msg.task ?? null, msg.cols, msg.seq);
      case 'stop':
        return this.stop();
      case 'commit':
        return this.commit();
      case 'reroll':
        this.variant += 1;
        return this.controlsChanged(msg.seq);
      case 'layout':
        this.cols = msg.cols;
        return this.markAttention();
    }
  }

  seed(text: string, task: string | null = null, cols?: number, seq?: number): void {
    this.cancelSwitch();
    this.cancelWork('seed');
    this.cancelReveal();
    this.cache.clear();
    this.pins.clear();
    this.variant = 0;
    this.task = task;
    if (cols) this.cols = cols;
    const tokens = this.source.split(text.replace(/\r\n?/g, '\n')).slice(0, this.s.maxTokens);
    this.prefix = tokens;
    this.active = null;
    this.committed = this.visible = this.anchorPos = tokens.length;
    this.target = Math.min(this.s.maxTokens, tokens.length + this.s.horizon);
    this.following = true;
    this.activation += 1;
    this.branchId = `seed-${this.activation}`;
    this.send({ type: 'invalidate', from_tok: 0, branch_id: this.branchId, cause_seq: seq ?? null, cached: false, reason: 'seed' });
    if (tokens.length) this.send({ type: 'tokens', branch_id: this.branchId, from_tok: 0, tokens });
    this.markAttention();
    this.gesture(seq);
    this.emitState();
    this.pendingKey = null;
    this.scheduleSwitch(0);
  }

  setDial(dim: string, value: number | null, pole?: string, seq?: number): void {
    const d = this.dims.find((x) => x.name === dim);
    if (!d) return this.send({ type: 'error', message: `unknown dimension '${dim}'` });
    if (pole != null) {
      const i = d.poles.findIndex((p) => p.name === pole);
      if (i < 0) return this.send({ type: 'error', message: `${dim} has no pole '${pole}'` });
      value = i / (d.poles.length - 1);
    }
    this.dials[dim] = value == null ? null : Math.min(1, Math.max(0, value));
    this.activeDim = dim;
    this.controlsChanged(seq);
  }

  pin(start: number, end: number, weight: number, id?: string, seq?: number): void {
    const existing = id ? this.pins.get(id) : undefined;
    if (existing) {
      existing.weight = weight;
    } else {
      end = Math.min(end, this.visible);
      const text = this.slice(start, end).join('').trim();
      if (start >= end || !text) return this.send({ type: 'error', message: 'a pin must cover visible text' });
      id = id || `p${this.pins.size + 1}-${this.activation}`;
      this.pins.set(id, { id, start, end, weight, text });
      // pinning a phrase keeps it: regeneration starts after it, never over it
      this.anchorPos = Math.max(this.anchor, end);
    }
    this.markAttention();
    this.controlsChanged(seq);
  }

  unpin(id: string, seq?: number): void {
    if (!this.pins.delete(id)) return;
    this.markAttention();
    this.controlsChanged(seq);
  }

  scrub(position: number, seq?: number): void {
    const length = this.len();
    // past the end of the text the knob asks for more, one horizon at a pull
    const p = Math.max(this.committed, Math.min(position, this.s.maxTokens, Math.max(length, this.target, length + this.s.horizon)));
    if (p < this.visible) {
      this.cancelWork('scrub back');
      this.cancelReveal();
      this.visible = p;
      this.anchorPos = p;
      this.following = false;
      this.activation += 1;
      this.branchId = `${this.branchId.split('-')[0]}-${this.activation}`;
      this.send({ type: 'invalidate', from_tok: p, branch_id: this.branchId, cause_seq: seq ?? null, cached: true, reason: 'scrub' });
      this.markAttention();
      if (this.deferred) {
        // the request that was being left to land is gone; the change it was holding back still applies
        this.releaseHold();
        this.scheduleSwitch(this.s.debounceMs);
      }
    } else {
      this.anchorPos = p;
      const upto = Math.min(p, length);
      if (upto > this.visible) {
        this.show(upto);
        this.markAttention();
      }
      if (p >= length) {
        this.following = true;
        this.target = Math.max(this.target, p);
        if (this.switchTimer === null && this.switching === 0) this.ensureGeneration();
      }
    }
    this.emitState();
    this.scheduleSpeculation();
  }

  commit(): void {
    this.committed = this.anchorPos = this.visible;
    if (this.visible === this.len()) {
      this.following = true;
      this.target = Math.min(this.s.maxTokens, this.visible + this.s.horizon);
      if (this.switchTimer === null && this.switching === 0) this.ensureGeneration();
    }
    this.emitState();
  }

  stop(): void {
    this.cancelSwitch();
    this.cancelWork('stop');
    this.cancelReveal();
    // Stopping ends the text where it stands. Words written but not yet shown
    // go the way of the words the cancelled request never wrote.
    if (this.following && this.active && this.visible >= this.prefix.length && this.visible < this.len()) {
      this.active.tokens.length = this.visible - this.prefix.length;
      this.active.shown = this.active.tokens.length;
      this.active.done = false;
    }
    this.target = this.len();
    this.emitState();
  }

  /* ───────────────────────── control changes ───────────────────────── */

  private gesture(seq?: number | null): void {
    this.gestureAt = now();
    this.gestureSeq = seq ?? null;
  }

  private controlsChanged(seq?: number): void {
    this.emitState();
    const key = this.keyAt(this.anchor);
    const settled = this.switchTimer === null && this.switching === 0;
    // the dial moved inside its quantum, or came back to what is being written
    if (settled && this.active && key === this.active.key) return this.releaseHold();
    // still heading for the same branch; a hand that keeps moving inside one
    // quantum must not keep postponing it
    if (key === this.pendingKey && (!settled || this.deferred)) return;
    this.gesture(seq);
    this.pendingKey = key;
    const held = this.cache.get(key);
    const hit = !!held && held.tokens.length > 0;
    if (!hit && settled && this.awaitingFirstToken()) {
      // Let the request in flight land before moving on. Cancelling it would
      // throw away the wait for its first token and start another just as
      // long, so a dial in motion would show nothing until it stopped. The
      // text trails the hand by one time-to-first-token instead.
      this.deferred = true;
      if (this.holdTimer === null) this.holdTimer = setTimeout(() => this.moveOn(), Math.max(0, this.activeSince + this.s.holdMs - now()));
      return;
    }
    this.releaseHold();
    // Whatever is in flight is for controls that no longer hold, with one
    // exception: a speculative request already writing the branch these
    // controls ask for is the head start speculation exists to give.
    this.cancelWork('control change', key);
    // The debounce spares requests that a moving hand would waste. A branch
    // already in the cache costs none, so it is shown now. So is the first
    // change after the controls have been at rest: nothing is known yet about
    // where the hand is going, and waiting only delays the first new word.
    const t = now();
    const rested = t - this.changedAt > this.s.debounceMaxMs;
    this.changedAt = t;
    this.scheduleSwitch(hit || rested ? 0 : this.s.debounceMs);
  }

  private awaitingFirstToken(): boolean {
    return this.genTask !== null && this.latencyFrom !== null && this.following;
  }

  private releaseHold(): void {
    this.deferred = false;
    if (this.holdTimer !== null) {
      clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }
  }

  /** The held request has landed, failed or run out of time: open the branch the controls now ask for. */
  private moveOn(): void {
    const due = this.deferred && !this.closed;
    this.releaseHold();
    if (!due) return;
    this.cancelWork('superseded', this.pendingKey ?? undefined);
    this.scheduleSwitch(0);
  }

  /** Debounce: wait for the controls to hold still, but never longer than debounceMaxMs. */
  private scheduleSwitch(delay: number): void {
    this.epoch += 1;
    if (this.switchTimer !== null) clearTimeout(this.switchTimer);
    const epoch = this.epoch;
    const t = now();
    if (this.burstAt === null) this.burstAt = t;
    delay = Math.max(0, Math.min(delay, this.burstAt + this.s.debounceMaxMs - t));
    this.switchTimer = setTimeout(() => {
      this.switchTimer = null;
      void this.switchBranch(epoch);
    }, delay);
  }

  private cancelSwitch(): void {
    this.epoch += 1;
    this.pendingKey = null;
    this.burstAt = null;
    this.releaseHold();
    if (this.switchTimer !== null) {
      clearTimeout(this.switchTimer);
      this.switchTimer = null;
    }
  }

  private async switchBranch(epoch: number): Promise<void> {
    this.switching += 1;
    try {
      await this.drain();
      if (epoch !== this.epoch || this.closed) return;
      this.assertQuiet();
      this.pendingKey = null;
      this.burstAt = null;
      this.releaseHold();
      this.applySwitch();
    } finally {
      this.switching -= 1;
    }
    if (epoch === this.epoch && !this.closed) {
      this.emitState();
      this.scheduleSpeculation();
    }
  }

  private applySwitch(): void {
    // a pin whose text is about to be replaced has nothing left to hold
    const a = this.anchor;
    for (const [id, p] of this.pins) if (p.end > a) this.pins.delete(id);

    const length = this.len();
    const newPrefix = this.slice(0, a);
    const prefixHash = hash(newPrefix.join(''));
    const dials = this.quantised();
    const pins = this.pinSpecs(a);
    const key = this.key(prefixHash, dials, pins);

    if (this.active && key === this.active.key) {
      this.ensureGeneration();
      return;
    }
    // a speculative request for any other branch should already be gone
    this.cancelWork('switch', key);

    if (this.active && this.prefix.length < a && a < length) {
      // The text past the new anchor was written under the old controls. Record
      // it as the continuation of this prefix under those controls, so turning
      // the dial back finds it.
      const alias = this.key(prefixHash, this.active.dials, this.active.pins);
      if (!this.cache.has(alias)) {
        this.put({
          key: alias,
          dials: { ...this.active.dials },
          pins: this.active.pins,
          tokens: this.slice(a, length),
          done: this.active.done,
          shown: Math.max(0, this.visible - a),
        });
      }
    }

    let branch = this.cache.get(key);
    const cached = !!branch && branch.tokens.length > 0;
    if (!branch) branch = { key, dials, pins, tokens: [], done: false, shown: 0 };
    if (cached) this.cacheHits += 1;
    else this.cacheMisses += 1;

    this.cancelReveal();
    this.prefix = newPrefix;
    this.active = branch;
    this.put(branch);
    this.visible = a;
    this.anchorPos = a;
    this.following = true;
    this.target = Math.min(this.s.maxTokens, Math.max(a + this.s.horizon, a + branch.tokens.length));
    this.activation += 1;
    this.branchId = `${hash(key).toString(36)}-${this.activation}`;
    this.send({ type: 'invalidate', from_tok: a, branch_id: this.branchId, cause_seq: this.gestureSeq, cached, reason: 'switch' });
    this.steer += 1;
    this.latencyFrom = this.gestureAt;
    this.activeSince = now();
    this.rate = [];
    this.markAttention();
    this.flush();
    // a speculative request still writing this branch carries on as its generation
    const adopted = this.specTasks.get(key);
    if (adopted) {
      this.specTasks.delete(key);
      this.genTask = adopted;
    }
    this.ensureGeneration();
  }

  /** Insert or refresh a branch, evicting the least recently used. The active branch is never evicted. */
  private put(branch: Branch): void {
    this.cache.delete(branch.key);
    this.cache.set(branch.key, branch);
    for (const key of this.cache.keys()) {
      if (this.cache.size <= this.s.cacheSize) break;
      if (key !== branch.key && key !== this.active?.key) this.cache.delete(key);
    }
  }

  /* ───────────────────────── generation ───────────────────────── */

  private ensureGeneration(): void {
    if (!this.active || this.genTask || !this.following) return;
    if (this.active.done || this.len() >= this.target) return;
    this.genTask = this.spawn(this.active, [...this.prefix], this.target - this.prefix.length, false);
  }

  private spawn(branch: Branch, prefix: string[], limit: number, speculative: boolean): Work {
    const work: Work = { key: branch.key, controller: new AbortController(), promise: Promise.resolve(), done: false };
    work.promise = this.generate(work, branch, prefix, limit, speculative);
    return work;
  }

  /** Extend `branch` until it holds `limit` tokens. */
  private async generate(work: Work, branch: Branch, prefix: string[], limit: number, speculative: boolean): Promise<void> {
    const signal = work.controller.signal;
    this.inflight += 1;
    let finished = false;
    try {
      // let the caller record this work before the first token can arrive
      await Promise.resolve();
      const need = limit - branch.tokens.length;
      if (need > 0 && !signal.aborted) {
        let got = 0;
        const stream = this.source.generate(
          {
            tokens: [...prefix, ...branch.tokens],
            anchor: prefix.length,
            dials: branch.dials,
            pins: branch.pins,
            maxTokens: need,
            seed: hash(`${branch.key}:${branch.tokens.length}`) >>> 0,
            task: this.task,
          },
          signal,
        );
        for await (const read of stream) {
          if (signal.aborted) break;
          const chunk = read.slice(0, need - got);
          if (!chunk.length) break;
          branch.tokens.push(...chunk);
          got += chunk.length;
          if (branch === this.active) {
            this.rate.push([now(), chunk.length]);
            this.markDirty();
          }
          if (got >= need) break;
        }
        if (!signal.aborted) {
          if (got < need) branch.done = true;
          finished = true;
        }
      } else if (!signal.aborted) {
        finished = true;
      }
    } catch (err) {
      if (!signal.aborted) {
        const message = err instanceof Error ? err.message : String(err);
        if (!speculative) this.send({ type: 'error', message, retry_after: err instanceof SourceError ? (err.retryAfter ?? null) : null });
      }
    } finally {
      this.inflight -= 1;
      work.done = true;
      if (this.specTasks.get(branch.key) === work) this.specTasks.delete(branch.key);
      this.dying.delete(work);
      if (this.genTask === work) this.genTask = null;
      if (branch === this.active && !this.closed) {
        // the last tokens leave now, so the state that follows describes what the client holds
        this.flush();
        // it ended without showing anything (an error, an empty reply): nothing left to wait for
        if (this.deferred) this.moveOn();
        if (finished) {
          // short of the target only when this began as a speculative request
          this.ensureGeneration();
          if (!this.genTask) this.scheduleSpeculation();
        }
        this.emitState();
      }
    }
  }

  /** Cancel every request in flight, except a speculative one writing branch `keep`. */
  private cancelWork(_reason: string, keep?: string): void {
    const kept = keep ? this.specTasks.get(keep) : undefined;
    let n = 0;
    for (const work of [this.genTask, ...this.specTasks.values()]) {
      if (!work || work === kept || work.done) continue;
      work.controller.abort();
      this.dying.add(work);
      n += 1;
    }
    this.cancelled += n;
    this.genTask = null;
    this.specTasks = new Map(kept && !kept.done ? [[keep!, kept]] : []);
    if (this.specTimer !== null) {
      clearTimeout(this.specTimer);
      this.specTimer = null;
    }
  }

  private async drain(): Promise<void> {
    while (this.dying.size) {
      const pending = [...this.dying];
      await Promise.allSettled(pending.map((w) => w.promise));
      for (const w of pending) this.dying.delete(w);
    }
  }

  /** After a cancel has been waited out, nothing may still be talking to the source. */
  private assertQuiet(): void {
    const allowed = [this.genTask, ...this.specTasks.values()].filter((w) => w && !w.done).length;
    const live = this.inflight - allowed;
    if (live > 0) {
      this.orphans += live;
      console.error(`steer: ${live} orphaned generation(s) alive after cancel`);
      if (this.strict) throw new Error(`${live} orphaned generation(s) after cancel`);
    }
  }

  /* ───────────────────────── speculation ───────────────────────── */

  private scheduleSpeculation(): void {
    if (!this.s.speculate || this.closed) return;
    if (this.specTimer !== null) clearTimeout(this.specTimer);
    this.specTimer = setTimeout(() => this.speculate(), SPECULATE_AFTER_MS);
  }

  /** Pre-generate one quantum either side of the dial last touched. */
  private speculate(): void {
    this.specTimer = null;
    if (this.closed || !this.active || this.generating || this.specTasks.size) return;
    const dim = this.dims.find((d) => d.name === this.activeDim);
    const value = dim ? this.dials[dim.name] : null;
    if (!dim || value == null) return;
    const here = Math.round(quantise(dim, value) * dim.steps);
    const a = this.anchor;
    if (a >= this.s.maxTokens) return;
    const prefix = this.slice(0, a);
    const prefixHash = hash(prefix.join(''));
    const pins = this.pinSpecs(a);
    const base = this.quantised();
    const depth = Math.min(this.s.specTokens, this.s.maxTokens - a);
    for (const step of [here + 1, here - 1]) {
      if (step < 0 || step > dim.steps) continue;
      const dials = { ...base, [dim.name]: step / dim.steps };
      const key = this.key(prefixHash, dials, pins);
      let branch = this.cache.get(key);
      if (!branch) {
        branch = { key, dials, pins, tokens: [], done: false, shown: 0 };
        this.put(branch);
      }
      if (branch.done || branch.tokens.length >= depth) continue;
      this.sim += 1;
      this.specTasks.set(key, this.spawn(branch, prefix, depth, true));
    }
  }

  /* ───────────────────────── messages out ───────────────────────── */

  /** Put the text up to `upto` on screen. */
  private show(upto: number): void {
    this.send({ type: 'tokens', branch_id: this.branchId, from_tok: this.visible, tokens: this.slice(this.visible, upto) });
    this.visible = upto;
    if (this.active) this.active.shown = Math.max(this.active.shown, upto - this.prefix.length);
    if (upto >= this.len()) this.starved = true;
  }

  private flush(): void {
    if (!this.following || !this.active) return;
    const length = this.len();
    if (this.visible >= length) {
      this.starved = true;
      return;
    }
    let upto = length;
    if (this.s.revealTokS > 0) {
      const step = 1000 / this.s.revealTokS;
      const t = now();
      // The clock runs only while words are waiting: the wait for a model's
      // first token must not be repaid as a burst when it lands.
      if (this.starved) {
        this.revealAt = t;
        this.starved = false;
      }
      // Counted from the clock rather than one per tick, so a late timer (a
      // busy frame, a background tab) does not slow the text down.
      const due = t >= this.revealAt ? 1 + Math.floor((t - this.revealAt) / step) : 0;
      this.revealAt += due * step;
      // what this branch has shown before comes back at once
      const seen = Math.max(this.visible, Math.min(length, this.prefix.length + this.active.shown));
      upto = Math.min(length, seen + due);
      if (upto < length) this.armReveal(Math.max(this.s.frameMs, this.revealAt - t));
      if (upto <= this.visible) return;
    }
    this.show(upto);
    if (this.latencyFrom !== null) {
      this.latencyMs = now() - this.latencyFrom;
      this.latencies.push(this.latencyMs);
      if (this.latencies.length > 500) this.latencies.shift();
      this.latencyFrom = null;
    }
    this.markAttention();
    // the held request is on screen; now follow the hand
    if (this.deferred) this.moveOn();
  }

  private armReveal(delay: number): void {
    if (this.revealTimer !== null) return;
    this.revealTimer = setTimeout(() => {
      this.revealTimer = null;
      if (this.closed) return;
      this.flush();
      // the last word is out: the state the client holds says "still writing" until told otherwise
      if (this.revealTimer === null) this.emitState();
    }, delay);
  }

  private cancelReveal(): void {
    if (this.revealTimer !== null) {
      clearTimeout(this.revealTimer);
      this.revealTimer = null;
    }
    this.starved = true;
  }

  /** Tokens leave in frames: at once when the first arrives, then no more often than frameMs. */
  private markDirty(): void {
    if (this.frameTimer !== null) {
      this.frameDirty = true;
      return;
    }
    this.flush();
    this.frameTimer = setTimeout(() => {
      this.frameTimer = null;
      if (this.frameDirty) {
        this.frameDirty = false;
        this.markDirty();
      }
    }, this.s.frameMs);
  }

  private markAttention(): void {
    this.attnDirty = true;
    if (!this.attnBusy && !this.closed) void this.attentionPass();
  }

  private async attentionPass(): Promise<void> {
    this.attnBusy = true;
    try {
      while (this.attnDirty && !this.closed) {
        this.attnDirty = false;
        const n = this.visible;
        const activation = this.activation;
        const tokens = this.slice(0, n);
        const pins = [...this.pins.values()].filter((p) => p.end <= n);
        let result: { scores: number[]; source: string } | null = null;
        try {
          result = await this.source.attention(tokens, pins, this.s.focusWindow);
        } catch {
          result = null; // the monitor is a readout; it never stops the writing
        }
        // scores for a text that has since been replaced are not shown
        if (result && activation === this.activation && tokens.length && !this.closed) {
          const lines = wrap(tokens, this.cols);
          const sums = new Array<number>(lines[lines.length - 1] + 1).fill(0);
          result.scores.forEach((score, i) => (sums[lines[i]] += score));
          const top = Math.max(...sums) || 1;
          this.send({
            type: 'attention',
            line_scores: sums.map((v) => Math.round((v / top) * 1e4) / 1e4),
            tok_scores: result.scores,
            source: result.source,
          });
        }
        await new Promise((r) => setTimeout(r, this.s.attentionMs));
      }
    } finally {
      this.attnBusy = false;
    }
  }

  private measureRate(): void {
    const t = now();
    while (this.rate.length && t - this.rate[0][0] > 1000) this.rate.shift();
    if (this.rate.length >= 2) {
      const span = this.rate[this.rate.length - 1][0] - this.rate[0][0];
      // the first read opens the window; the tokens in it arrived before it
      if (span > 20) this.tokS = (this.rate.slice(1).reduce((s, [, n]) => s + n, 0) / span) * 1000;
    }
  }

  telemetry(): TelemetryMsg {
    this.measureRate();
    const looked = this.cacheHits + this.cacheMisses;
    const r1 = (v: number) => Math.round(v * 10) / 10;
    return {
      type: 'telemetry',
      tok_s: r1(this.tokS),
      latency_ms: r1(this.latencyMs),
      steer: this.steer,
      sim: this.sim,
      tokens: this.visible,
      paragraphs: paragraphs(this.slice(0, this.visible)),
      cache_hits: this.cacheHits,
      cache_misses: this.cacheMisses,
      hit_rate: looked ? Math.round((this.cacheHits / looked) * 1000) / 1000 : 0,
      branches: this.cache.size,
      cancelled: this.cancelled,
      inflight: this.inflight,
      orphans: this.orphans,
      latency_p50: r1(percentile(this.latencies, 0.5)),
      latency_p95: r1(percentile(this.latencies, 0.95)),
    };
  }

  private emitTelemetry(): void {
    if (this.closed) return;
    const t = this.telemetry();
    const key = JSON.stringify(t);
    if (key !== this.lastTelemetry) {
      this.lastTelemetry = key;
      this.send(t);
    }
  }

  state(): StateMsg {
    return {
      type: 'state',
      committed: this.committed,
      anchor: this.anchor,
      scrub: this.anchorPos,
      visible: this.visible,
      cached_len: this.len(),
      target: this.target,
      // to the canvas, text still being written out is text still being written
      generating: this.generating || this.revealTimer !== null,
      variant: this.variant,
      dials: { ...this.dials },
      quantised: this.quantised(),
      pins: [...this.pins.values()]
        .sort((a, b) => a.start - b.start)
        .map((p) => ({ id: p.id, start_tok: p.start, end_tok: p.end, weight: Math.round(p.weight * 1000) / 1000, text: p.text })),
      active_dim: this.activeDim,
    };
  }

  private emitState(): void {
    if (!this.closed) this.send(this.state());
  }
}
