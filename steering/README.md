# Steerable Canvas: the backend

A writing surface where a person shapes the text *while* the model writes it:
see what the model is attending to, pin the phrases that matter, turn
independent dials (tone, pace, tension, surprise, focus, mode), and scrub a main
knob back and forth through alternative continuations.

This directory is the streaming backend (Python, FastAPI, one WebSocket per
session). The canvas itself is a React component in [`../src/steer`](../src/steer).
The two meet at a small JSON protocol, so either side can be replaced.

```
        canvas (React)                          backend
  ┌──────────────────────┐   WebSocket   ┌──────────────────────────────┐
  │ SteerableCanvas      │◄─────────────►│ server.py   one engine/session│
  │  text + gutter       │   protocol    │ engine.py   branches, cancel, │
  │  steering web, dials │               │             cache, speculation│
  │  main knob, footer   │               │ backends/   sim | api | local │
  └──────────────────────┘               └──────────────────────────────┘
         │ no backend configured?
         ▼
  the same engine, in TypeScript, in the page (src/steer/engine.ts),
  writing from /api/steer/generate or, with no model key, simulated
```

## Run it

Python 3.11 or newer.

```bash
cd steering
python -m venv .venv && . .venv/bin/activate
pip install -e ".[dev]"
```

```bash
cp .env.example .env          # then choose a backend in it
python -m steerable.server    # ws://127.0.0.1:8017/ws
```

Point the canvas at it by setting `NEXT_PUBLIC_STEER_WS_URL=ws://127.0.0.1:8017/ws`
for the web app. With `STEER_BACKEND=sim` (the default) no model and no key are
needed; the engine, cache, cancellation and telemetry are all real, the text is
not.

## Three backends, one interface

Everything above `SteeringBackend` (`steerable/backends/base.py`) is the same
for all three. The engine hands a backend the text so far and the control
state, and gets display tokens back.

| | `sim` | `api` (Tier A) | `local` (Tier B) |
| --- | --- | --- | --- |
| What writes | pools of sentences in `sim.yaml` | any OpenAI-compatible endpoint | an open-weights model via HF transformers |
| Dials | choose which pool a sentence draws from | compiled into a style block in the prompt: coarse | control vectors added to the residual stream, scaled by the dial: continuous |
| Attention lock | the pinned phrase returns in the text | a "keep in focus" list in the prompt: soft | an additive bias on attention scores toward the pinned positions |
| Focus monitor | lexical heuristic | a small proxy model's attention if it can load, else the heuristic | the generating model's own attention |
| Scrub and regenerate | yes | yes; speed is the provider's | yes; the prefix's KV cache is reused |
| Verified here | yes | against a local stand-in endpoint, not a real provider | on models built locally, not on real weights |
| Needs | nothing | an API key | a GPU (an 8B model in 16-bit wants about 16 GB) |

Hosted APIs expose neither activations nor attention weights, so Tier A can only
*approximate* each interaction. Tier B is the real thing and needs weights you
run yourself. The canvas does not change between them.

The footer of the canvas always says which backend is writing and where the
focus monitor's scores come from (`heuristic`, `proxy:<model>` or `model`).
The heuristic is not attention and is never labelled as such.

## The protocol

JSON over the WebSocket. `steerable/protocol.py` is the reference (Pydantic
models); `../src/steer/protocol.ts` mirrors it.

Client to server:

| Message | Meaning |
| --- | --- |
| `set_dial {dim, value 0..1 \| null, pole?}` | Move a dial. `null` returns it to unset; `pole` snaps to a named pole. |
| `pin {start_tok, end_tok, weight, id?}` | Lock attention on a span of visible tokens. Re-sending an `id` changes its weight. |
| `unpin {id}` | Release a lock. |
| `scrub {position_tok}` | Move the main knob. |
| `seed {text, task?, cols?}` | Start over from this text. |
| `stop {}` | Cancel generation. |
| `commit {}` *(added)* | Approve everything visible. |
| `reroll {}` *(added)* | Another sample under the same controls. |
| `layout {cols}` *(added)* | The width of the client's text column, so line scores match its lines. |

Server to client:

| Message | Meaning |
| --- | --- |
| `tokens {branch_id, from_tok, tokens[]}` | Text. Apply only if `branch_id` is the id of the last `invalidate`. |
| `invalidate {from_tok, branch_id, cause_seq?, cached, reason}` | Drop everything from `from_tok`; later tokens carry `branch_id`. |
| `attention {line_scores[], tok_scores[], source}` | The focus monitor, about every 100 ms while the text changes. |
| `telemetry {tok_s, latency_ms, steer, sim, …}` | The footer: also cache hits, cancelled requests, orphans, p50/p95. |
| `state {…}` *(added)* | The control state after every change: dial values, pins, the three marks. |
| `config {…}` *(added)* | Sent once: the backend, the dimensions, the tasks. |
| `error {message, retry_after?}` | A refusal from the model, reported once, never retried in a loop. |

Any client message may carry `seq`; the server echoes the `seq` that caused a
branch switch in `invalidate.cause_seq`. That is how the canvas and the harness
measure gesture-to-text without guessing.

## The engine

The text is a path of display tokens with three marks on it:

- **committed**: everything before it is approved and never regenerated.
- **anchor**: where regeneration starts when a control changes. It is the scrub
  point: the last place the knob was put.
- **visible**: how much of the path the client is showing.

A **branch** is one continuation of one prefix under one set of controls. Its
key is `hash(prefix up to the anchor) + quantised dial vector + pin set`, and
branches live in an LRU (64 by default). The rules:

- **A control changes.** Cancel whatever is in flight, wait out the debounce
  (30 ms, and never more than 90 ms for a hand that does not stop), send
  `invalidate`, then serve the branch from the cache or generate it. A branch
  that is already cached skips the debounce: it costs no request.
- **Scrub backward.** Truncate the visible text at once and cancel ongoing work.
  The dropped tail stays on the path, so scrubbing forward again is served
  without a request.
- **Scrub forward.** Reveal what the path holds; past its end, write more.
- **Idle.** Pre-generate one quantum either side of the dial last touched
  (capped at `STEER_SPEC_TOKENS`), so the next turn of that knob is a hit. A
  speculative request still in flight for the branch you turn to is adopted,
  not cancelled.
- **A moving hand.** If the controls move on while the current request is still
  waiting for its first token, that request is left to land (for at most
  `STEER_HOLD_MS`), shown, and only then superseded. Otherwise a dial in motion
  shows nothing until it stops. The text trails the hand by one
  time-to-first-token.
- **Pinning** a phrase moves the anchor to its end: a lock never regenerates the
  words it locks.

Cancellation is the part that goes wrong in systems like this, so it is counted.
`inflight` is the number of generation coroutines alive. Before a new branch
starts the engine waits for the cancelled ones to finish and checks the count is
zero; anything else is logged as an orphan, reported in telemetry and, with
`STEER_STRICT=1`, raised. The canvas independently drops and counts any tokens
that arrive for a branch that is no longer current.

## Dimensions are a file

[`dimensions.yaml`](dimensions.yaml) defines every dial: its poles, how many
quanta it has, the wording each pole compiles to in Tier A, and where its
control vector is applied in Tier B. Nothing about a dimension is hard-coded,
in Python or in the web app (which reads the same file). A product that wants
different dials ships a different file (`STEER_DIMENSIONS`). The file also holds
the tasks the canvas can be asked to write (story, marketing copy, sales script,
agent response), each with the framing that opens its prompt.

## Tier A: an API

```bash
STEER_BACKEND=api
STEER_API_BASE_URL=https://api.groq.com/openai/v1
STEER_API_KEY=…
STEER_API_MODEL=openai/gpt-oss-20b
```

Latency is the product here. If regeneration cannot keep up with the hand, this
is a slow chat box, so choose the endpoint by measured tokens per second and
time-to-first-token, not by model quality. Speculation throws away most of what
it generates; `STEER_SPECULATE=0` turns it off and `STEER_SPEC_TOKENS` caps it.

The proxy focus monitor needs the `local` extra (`pip install -e ".[local]"`)
and a small model (`STEER_PROXY_MODEL`, default `Qwen/Qwen2.5-0.5B`). If it
cannot load, the backend says so in its log and uses the heuristic.

## Tier B: local weights

`STEER_BACKEND=local` runs an open-weights model through HF transformers with
control vectors and attention-bias locks. [TIER_B.md](TIER_B.md) covers
training the vectors, the monotonic check, and, first of all, what has and has
not been verified: the mechanism is tested on models built locally, and it has
not yet been run on real pretrained weights or a GPU.

## The latency harness

```bash
python -m steerable.replay gestures/knob_steps.json gestures/dial_sweep.json
```

```bash
python -m steerable.replay gestures/rapid_100.json --url ws://127.0.0.1:8017/ws --p50 300 --p95 600
```

It replays a recorded gesture sequence (in-process, or against a running
server) and reports gesture-to-text p50/p95, the cache hit rate, and whether
any token arrived for a stale branch. It exits non-zero on a stale token, an
orphaned request, or a missed `--p50`/`--p95`. The four bundled files are
synthetic hands (`--synth` rewrites them); the canvas records real ones with
the `rec` control in its footer.

Two latencies are reported because they answer different questions. *Gesture to
text* is measured from the gesture the new text answers. *From start of burst*
is measured from the first gesture since the text last changed, which is what a
hand moving faster than the model can answer actually waits.

Measured here over the WebSocket on 16 Nov 2026. Neither row is a real model:
the first is the simulated backend, the second is the API backend against a
local stand-in endpoint with a fixed 180 ms time-to-first-token. They measure
the engine and the wire, and show what a given time-to-first-token costs; a
real provider's numbers have to be measured against that provider.

| Gestures | Backend | Gesture to text p50 / p95 | From burst start p50 / p95 | Cache hits | Stale tokens |
| --- | --- | --- | --- | --- | --- |
| `knob_steps` (one dial, a quantum at a time) | sim, 40 ms TTFT | 1 ms / 40 ms | 1 ms / 40 ms | 92% | 0 |
| `dial_sweep` (continuous, 60 Hz) | sim, 40 ms TTFT | 71 ms / 72 ms | 71 ms / 138 ms | 12% | 0 |
| `scrub_explore` (the main knob) | sim, 40 ms TTFT | 0.5 ms / 0.8 ms | 0.5 ms / 0.8 ms | n/a | 0 |
| `rapid_100` (100 changes, 4-70 ms apart) | sim, 40 ms TTFT | 71 ms / 73 ms | 182 ms / 516 ms | 0% | 0 |
| `knob_steps` | api stand-in, 180 ms TTFT | 1 ms / 214 ms | 1 ms / 214 ms | 81% | 0 |
| `dial_sweep` | api stand-in, 180 ms TTFT | 216 ms / 322 ms | 262 ms / 365 ms | 9% | 0 |
| `scrub_explore` | api stand-in, 180 ms TTFT | 0.5 ms / 0.8 ms | 0.5 ms / 0.8 ms | n/a | 0 |
| `rapid_100` | api stand-in, 180 ms TTFT | 205 ms / 250 ms | 356 ms / 367 ms | 0% | 0 |

A miss costs the debounce plus the model's time-to-first-token; a hit costs
about a millisecond. The target (p50 under 300 ms, p95 under 600 ms) is
therefore met when time-to-first-token is under roughly 250 ms, or when the
cache is doing its job.

## Blind A/B for attention locks

```bash
python -m steerable.abtest --pin "hidden" --samples 10 --out ab
```

Writes `ab.md` (ten unlabelled pairs, one continuation with the phrase pinned
and one without, same seed) and `ab.key.json`. Whether a reader can tell them
apart is a human judgement against a real model; it has not been run here.

## Tests

```bash
python -m pytest tests -q -m "not slow"
```

| File | What it holds to |
| --- | --- |
| `test_engine.py` | The engine's rules, one test each: cache, cancellation, scrubbing, speculation, pins, the hold for a moving hand, and that an orphaned request is detected |
| `test_api_and_server.py` | Tier A against a real HTTP endpoint (a local stand-in): the steering reaches the model, and a cancelled request closes its stream. The WebSocket server speaks the contract. |
| `test_units.py` | Layout, dimensions, the prompt compiler, the heuristic. Two fixtures here are also checked by the web app's tests, which keeps the Python and TypeScript halves in step. |
| `test_local.py` | Tier B on small models built locally: steering, the attention bias, KV-cache reuse, cancellation, the focus monitor. One test marked `slow` trains a small model and checks a dial moves a measured style monotonically |

## Configuration

Everything is an environment variable (or a line in `.env`); see
[`.env.example`](.env.example). No secret is read from anywhere else.

## What is where

```
dimensions.yaml        the dials and the tasks
sim.yaml               material for the simulated backend
steerable/
  protocol.py          every message, as a Pydantic model
  engine.py            branches, cancellation, cache, speculation, telemetry
  server.py            FastAPI app: /ws, /health, /config
  dimensions.py        what a dial position means
  prompting.py         Tier A: dials and pins compiled into a prompt
  layout.py            display tokens and the lines they fall on
  backends/            sim.py, api.py, local.py behind base.py
  attention/           the focus monitor: heuristic, proxy model, shared readout
  vectors.py           Tier B: train and check control vectors
  replay.py            the latency harness
  abtest.py            the blind A/B sheet for pins
gestures/              gesture files for the harness
tests/
```
