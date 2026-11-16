import type { AttentionMsg, ClientMsg, ConfigMsg, ServerMsg, StateMsg, TelemetryMsg } from './protocol';
import type { Transport } from './transport';

/**
 * The canvas's side of a session: it applies the server's messages to a model
 * of the text, tags every gesture so its latency can be measured to the frame
 * it paints in, and tells React at most once per animation frame.
 *
 * The rule that keeps scrubbing glitch-free lives here: a `tokens` message is
 * applied only if it carries the id of the last `invalidate`. Anything else
 * was generated for controls that no longer hold, and is dropped and counted.
 */

const GHOST_MS = 700;

export interface Recording {
  seed: string;
  task: string | null;
  t0: number;
  events: ({ t: number } & ClientMsg)[];
}

let sessions = 0;

export class Session {
  /** distinguishes one session from the next, so the canvas starts afresh with each */
  readonly id = ++sessions;
  tokens: string[] = [];
  /** the tail a control change is replacing, kept on screen (dimmed) until its replacement starts to arrive */
  ghost: string[] = [];
  branch: string | null = null;
  config: ConfigMsg | null = null;
  state: StateMsg | null = null;
  attention: AttentionMsg | null = null;
  telemetry: TelemetryMsg | null = null;
  error: { message: string; at: number; retryAfter?: number | null } | null = null;
  /** tokens that arrived for a branch that was no longer current */
  stale = 0;
  /** dial values the hand has set but the server has not yet echoed */
  local: Record<string, number | null> = {};
  /** gesture-to-paint, in ms, most recent last */
  paint: number[] = [];
  lastPaint = 0;
  fps = 0;
  recording: Recording | null = null;
  /** how many steering gestures the hand has made this session */
  gestures = 0;
  /** refusals from the model (rate limits, outages), most recent last */
  errors: number[] = [];
  seedText = '';
  task: string | null = null;

  private transport: Transport | null = null;
  private listeners = new Set<() => void>();
  private version = 0;
  private scheduled = false;
  private seq = 0;
  private sentAt = new Map<number, number>();
  private awaiting: { branch: string; seq: number } | null = null;
  private forward: number | null = null;
  private toPaint: number[] = [];
  private ghostTimer: ReturnType<typeof setTimeout> | null = null;
  private frames: number[] = [];
  private fpsRaf = 0;
  private closed = false;

  /* ───────────────────────── React ───────────────────────── */

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getVersion = (): number => this.version;

  private notify(): void {
    if (this.scheduled || this.closed) return;
    this.scheduled = true;
    requestAnimationFrame(() => {
      this.scheduled = false;
      this.version += 1;
      this.listeners.forEach((fn) => fn());
      if (this.toPaint.length) {
        // the frame after this one is the first in which the new text has been painted
        const seqs = this.toPaint.splice(0);
        requestAnimationFrame(() => {
          const t = performance.now();
          for (const seq of seqs) {
            const sent = this.sentAt.get(seq);
            if (sent == null) continue;
            this.lastPaint = t - sent;
            this.paint.push(this.lastPaint);
            if (this.paint.length > 300) this.paint.shift();
          }
          for (const key of this.sentAt.keys()) if (key <= Math.max(...seqs)) this.sentAt.delete(key);
          this.version += 1;
          this.listeners.forEach((fn) => fn());
        });
      }
    });
  }

  /* ───────────────────────── transport ───────────────────────── */

  attach(transport: Transport): void {
    this.transport = transport;
    this.measureFps();
  }

  close(): void {
    this.closed = true;
    this.transport?.close();
    this.transport = null;
    if (this.ghostTimer) clearTimeout(this.ghostTimer);
    cancelAnimationFrame(this.fpsRaf);
  }

  get label(): string {
    return this.transport?.label ?? '';
  }

  receive = (msg: ServerMsg): void => {
    if (this.closed) return;
    switch (msg.type) {
      case 'invalidate': {
        if (msg.reason === 'switch' && !msg.cached && msg.from_tok < this.tokens.length) {
          this.ghost = this.tokens.slice(msg.from_tok);
          if (this.ghostTimer) clearTimeout(this.ghostTimer);
          this.ghostTimer = setTimeout(() => {
            this.ghost = [];
            this.notify();
          }, GHOST_MS);
        } else {
          this.ghost = [];
        }
        this.tokens.length = Math.min(this.tokens.length, msg.from_tok);
        this.branch = msg.branch_id;
        if (msg.reason === 'seed') this.attention = null;
        if (msg.cause_seq != null) {
          if (msg.reason === 'scrub') this.toPaint.push(msg.cause_seq);
          else if (msg.reason === 'switch') this.awaiting = { branch: msg.branch_id, seq: msg.cause_seq };
        }
        break;
      }
      case 'tokens': {
        if (msg.branch_id !== this.branch || msg.from_tok !== this.tokens.length) {
          this.stale += msg.tokens.length;
          break;
        }
        for (const tok of msg.tokens) this.tokens.push(tok);
        this.ghost = [];
        if (this.awaiting && this.awaiting.branch === msg.branch_id) {
          this.toPaint.push(this.awaiting.seq);
          this.awaiting = null;
        } else if (this.forward != null) {
          this.toPaint.push(this.forward);
        }
        this.forward = null;
        break;
      }
      case 'attention':
        this.attention = msg;
        break;
      case 'state':
        this.state = msg;
        for (const dim of Object.keys(this.local)) if (msg.dials[dim] === this.local[dim]) delete this.local[dim];
        break;
      case 'telemetry':
        this.telemetry = msg;
        break;
      case 'config':
        this.config = msg;
        break;
      case 'error':
        this.error = { message: msg.message, at: Date.now(), retryAfter: msg.retry_after };
        this.errors = [...this.errors.filter((t) => Date.now() - t < 20_000), Date.now()];
        break;
    }
    this.notify();
  };

  private send(msg: ClientMsg, timed = false): void {
    if (!this.transport) return;
    let out = msg;
    if (timed && msg.type !== 'layout') {
      this.gestures += 1;
      this.seq += 1;
      this.sentAt.set(this.seq, performance.now());
      out = { ...msg, seq: this.seq };
    }
    if (this.recording && msg.type !== 'seed' && msg.type !== 'layout') {
      this.recording.events.push({ t: Math.round(performance.now() - this.recording.t0), ...msg });
    }
    this.transport.send(out);
  }

  /* ───────────────────────── gestures ───────────────────────── */

  /** The value a dial shows: what the hand last set, until the server's state says the same. */
  dial(dim: string): number | null {
    if (dim in this.local) return this.local[dim];
    return this.state?.dials[dim] ?? null;
  }

  setDial(dim: string, value: number | null): void {
    this.local[dim] = value;
    this.send({ type: 'set_dial', dim, value }, true);
    this.notify();
  }

  pin(start: number, end: number, weight: number, id?: string): void {
    this.send({ type: 'pin', start_tok: start, end_tok: end, weight, id: id ?? `pin-${Date.now().toString(36)}` }, true);
  }

  unpin(id: string): void {
    this.send({ type: 'unpin', id }, true);
  }

  scrub(position: number): void {
    if (position > this.tokens.length) {
      this.gestures += 1;
      this.seq += 1;
      this.sentAt.set(this.seq, performance.now());
      this.forward = this.seq;
      if (this.recording) this.recording.events.push({ t: Math.round(performance.now() - this.recording.t0), type: 'scrub', position_tok: position });
      this.transport?.send({ type: 'scrub', position_tok: position, seq: this.seq });
      return;
    }
    this.send({ type: 'scrub', position_tok: position }, true);
  }

  seed(text: string, task: string | null, cols: number): void {
    this.seedText = text;
    this.task = task;
    this.error = null;
    this.paint = [];
    this.send({ type: 'seed', text, task, cols });
    if (this.recording) this.recording = { seed: text, task, t0: performance.now(), events: [] };
  }

  layout(cols: number): void {
    this.send({ type: 'layout', cols });
  }

  commit(): void {
    this.send({ type: 'commit' });
  }

  reroll(): void {
    this.send({ type: 'reroll' }, true);
  }

  stop(): void {
    this.send({ type: 'stop' });
  }

  /* ───────────────────────── the debug side ───────────────────────── */

  /** Start or stop recording gestures. Stopping returns a gesture file for the replay harness. */
  toggleRecording(): Recording | null {
    if (!this.recording) {
      this.recording = { seed: this.seedText, task: this.task, t0: performance.now(), events: [] };
      this.notify();
      return null;
    }
    const done = this.recording;
    this.recording = null;
    this.notify();
    return done;
  }

  /** Frames per second over the last second, reported twice a second: enough to see a stall, not enough to cause one. */
  private measureFps(): void {
    let reported = 0;
    const tick = (t: number) => {
      this.frames.push(t);
      while (this.frames.length && t - this.frames[0] > 1000) this.frames.shift();
      if (t - reported > 500 && this.frames.length > 1) {
        reported = t;
        const fps = Math.round(((this.frames.length - 1) * 1000) / (t - this.frames[0]));
        if (fps !== this.fps) {
          this.fps = fps;
          this.notify();
        }
      }
      if (!this.closed) this.fpsRaf = requestAnimationFrame(tick);
    };
    this.fpsRaf = requestAnimationFrame(tick);
  }
}
