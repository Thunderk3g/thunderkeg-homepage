import { heuristicScores } from './attention';
import { SourceError, type GenRequest, type PinSpec, type TokenSource } from './engine';
import { StreamSplitter, split } from './layout';
import type { DimensionInfo } from './protocol';
import { SimWriter, type SimPools } from './sim';

/** A timer that an abort cuts short. Resolves false when aborted. */
function sleep(ms: number, signal: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve(false);
    const done = () => {
      clearTimeout(timer);
      resolve(false);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', done);
      resolve(true);
    }, ms);
    signal.addEventListener('abort', done, { once: true });
  });
}

const heuristic = async (tokens: string[], pins: PinSpec[], window: number) => ({
  scores: heuristicScores(tokens, pins, window),
  source: 'heuristic',
});

/**
 * No model: text from the pools in steering/sim.yaml, streamed at a set speed
 * so the engine is exercised the way a fast endpoint would exercise it.
 */
export class SimSource implements TokenSource {
  readonly name = 'sim';
  readonly tier = 'sim';
  readonly model = null;
  readonly attentionSource = 'heuristic';
  inflight = 0;
  private writer: SimWriter;

  constructor(
    pools: SimPools,
    dims: readonly DimensionInfo[],
    private tokS = 600,
    private ttftMs = 40,
  ) {
    this.writer = new SimWriter(pools, dims);
  }

  split = split;
  pinLevel = (w: number) => Math.round(w * 4) / 4;
  attention = heuristic;

  async *generate(req: GenRequest, signal: AbortSignal): AsyncGenerator<string[], void, void> {
    this.inflight += 1;
    try {
      if (this.ttftMs > 0 && !(await sleep(this.ttftMs, signal))) return;
      const tokens = split(this.writer.text(req.seed, req.dials, req.pins, req.tokens.join(''), req.maxTokens)).slice(0, req.maxTokens);
      if (this.tokS <= 0) {
        yield tokens;
        return;
      }
      // a real stream delivers a few tokens per network read; so does this
      const start = performance.now();
      let sent = 0;
      while (sent < tokens.length) {
        const due = Math.min(tokens.length, Math.floor(((performance.now() - start) / 1000) * this.tokS) + 1);
        if (due > sent) {
          yield tokens.slice(sent, due);
          sent = due;
        }
        if (!(await sleep(Math.max(1, 1000 / this.tokS), signal))) return;
      }
    } finally {
      this.inflight -= 1;
    }
  }
}

/**
 * Tier A in the page: the site's own /api/steer/generate, which compiles the
 * dials and pins into a prompt and streams an OpenAI-compatible endpoint.
 * Aborting the fetch closes the stream all the way to the provider.
 */
export class ApiSource implements TokenSource {
  readonly name = 'api';
  readonly tier = 'A';
  readonly attentionSource = 'heuristic';
  inflight = 0;

  constructor(
    private url: string,
    readonly model: string | null,
  ) {}

  split = split;
  // a prompt can say three strengths of "keep this in mind", no more
  pinLevel = (w: number) => (w < 0.34 ? 0.2 : w < 0.67 ? 0.5 : 0.9);
  attention = heuristic;

  async *generate(req: GenRequest, signal: AbortSignal): AsyncGenerator<string[], void, void> {
    this.inflight += 1;
    try {
      let res: Response;
      try {
        res = await fetch(this.url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          signal,
          body: JSON.stringify({
            text: req.tokens.join(''),
            dials: req.dials,
            pins: req.pins.map((p) => ({ weight: p.weight, text: p.text })),
            max_tokens: req.maxTokens,
            seed: req.seed,
            task: req.task,
          }),
        });
      } catch (err) {
        if (signal.aborted) return;
        throw new SourceError(`the model could not be reached (${err instanceof Error ? err.message : err})`);
      }
      if (res.headers.get('content-type')?.includes('application/json')) {
        // a refusal is JSON: no key, rate limit, or every model busy
        const body = (await res.json().catch(() => ({}))) as { llm?: string; reason?: string; error?: string };
        const retry = Number(res.headers.get('retry-after')) || undefined;
        const why =
          body.llm === 'unconfigured'
            ? 'no model is configured on this site'
            : body.reason === 'rate' || body.reason === 'busy'
              ? `the model is rate-limited here${retry ? `; try again in ${retry}s` : ''}`
              : (body.error ?? body.reason ?? `HTTP ${res.status}`);
        throw new SourceError(why, retry);
      }
      if (!res.ok || !res.body) throw new SourceError(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const splitter = new StreamSplitter();
      let buffer = '';
      let sent = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let cut: number;
          while ((cut = buffer.indexOf('\n\n')) >= 0) {
            const line = buffer.slice(0, cut).trim();
            buffer = buffer.slice(cut + 2);
            if (!line.startsWith('data:')) continue;
            const data = JSON.parse(line.slice(5)) as { delta?: string; done?: boolean; error?: string };
            if (data.error) throw new SourceError(data.error);
            if (data.delta) {
              const tokens = splitter.feed(data.delta);
              if (tokens.length) {
                sent += tokens.length;
                yield tokens;
                if (sent >= req.maxTokens) return;
              }
            }
          }
        }
        const tail = splitter.flush();
        if (tail.length) yield tail;
      } catch (err) {
        if (signal.aborted) return;
        throw err;
      } finally {
        // leaving early (a full branch, or an abort) must hang up, not leave the stream to run
        void reader.cancel().catch(() => undefined);
      }
    } finally {
      this.inflight -= 1;
    }
  }
}
