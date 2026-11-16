# Tier B: steering a local model from the inside

Tier A can only rewrite the prompt. Tier B runs an open-weights model on your
own machine and reaches into it, which is what the steering in the reference
demo actually is:

- **Dials** are control vectors. For each dimension a direction in the residual
  stream is found that separates text written toward one pole from text written
  toward the others. Turning the dial adds that direction, scaled, to the
  residual stream at a span of layers. It is added only to the positions of the
  continuation, never to the kept prefix: that is what "steer the text that is
  coming" means, and it makes the prefix's keys and values identical for every
  dial setting, so they are computed once and reused.
- **Attention locks** are an additive bias on attention scores toward the
  pinned phrase's tokens, for every position after the anchor, in every layer.
- **The focus monitor** reads the model's own attention, with the same steering
  and bias in effect, so it shows what a lock does.

## Status: read this first

**None of this has been run on real pretrained weights, on a GPU, or in half
precision.** The machine it was built on has no access to the Hugging Face hub
and no GPU. What exists is the full mechanism, exercised on models built from a
config: random-initialised Llama-architecture and GPT-2-architecture models for
the mechanics, and one small model trained from scratch on a synthetic language
for the acceptance check. It was written against transformers 5.23 and torch
2.15 and relies on behaviour of that transformers version (a float 4D attention
mask is passed through to the attention function and added to the scores).

So: the first run against a real model is a real test. Expect to tune
`max_strength` per dimension, and possibly to find that a model needs its chat
template around the text (see Known limits).

## Run it

```bash
pip install -e ".[local]"
```

```bash
STEER_BACKEND=local STEER_LOCAL_MODEL=Qwen/Qwen2.5-1.5B-Instruct python -m steerable.vectors train --dims tone pace
```

```bash
python -m steerable.vectors eval --dim pace --samples 20
```

```bash
STEER_BACKEND=local python -m steerable.server
```

`train` writes one file per dimension into `vectors/` (not committed: they are
specific to a model). A dimension with no vector file is a dial with no effect
and one warning in the log, not a crash. Vectors trained on a different model
are refused if their shape does not fit and warned about if it does.

## How a vector is found

Every opening in `contrast_stems` (in `dimensions.yaml`) is paired with every
pole's `prompt` as a style instruction, the model reads each one, and the
activation at the last token is recorded at the dimension's layers. The vector
for a pole is the first principal component of the differences between that
pole and its opposite (bipolar) or the mean of the others (blend), pointed
toward the pole and scaled to length one.

At run time the vector added at a layer is

```
weight of the pole at the dial's position  x  max_strength  x  mean residual length at that layer  x  unit vector
```

so `max_strength` is a fraction of the residual's own size and means the same
push on a small model as a large one. The additions accumulate along the span
of layers. The values in `dimensions.yaml` (0.06 to 0.08) are starting points
that have not been tuned against real weights.

One thing learnt on the small model: the activation at the last token carries
what the model is about to do *there*, so a style shows up only where it is
about to matter. Openings that all stopped mid-clause gave a vector that
steered word choice but not sentence length; openings that all stopped at the
end of a clause did the reverse. Every opening in the shipped `contrast_stems`
stops mid-sentence, so `pace` may want openings that end on a full stop added.

## The acceptance check

> Moving a dial from 0 to 1 shifts a classifier score for that dimension
> monotonically across 20 samples, with grammar intact.

`python -m steerable.vectors eval --dim <name>` is that check. With the dial at
several positions it writes the same samples (same openings, same seeds),
scores each, and reports whether the mean rises at every step and whether the
text still reads as the model's own language. It exits 0 when both hold, 1 when
the score is not monotonic, and 2 when it is but the language is broken, which
is the sign that `max_strength` is too high.

- **Score.** `pace` is mean words per sentence. Any other dimension is scored
  by the *unsteered* model as a judge: the log-probability it gives each pole's
  name after reading the sample.
- **Grammar intact** is three proxies against the dial's neutral position: mean
  per-token surprise under the unsteered model, the share of tokens it finds
  very unlikely (p < 0.001), and a repetition rate. Each has a threshold
  (`--max-nll-rise`, `--max-odd-rise`, `--max-repetition-rise`). The second was
  added because, on the small model, mean surprise alone missed text in which a
  fifth of the sentences were malformed.

### What has been shown, and on what

A 4-layer Llama-architecture model (hidden size 64) was trained for 600 steps
on a synthetic language with two measurable styles: short against long
sentences, and two tone vocabularies. Vectors were trained with the real
`train` command and checked with the real `eval` command. 20 samples of 64
tokens at each position:

```
pace: mean words per sentence
  dial  reads as                  score   ± s.e.  nll/tok
  0.00  very compressed           4.501    0.162    0.962
  0.25  somewhat compressed       7.058    1.126    0.965
  0.50  neutral                   9.573    1.130    1.075
  0.75  somewhat expansive       14.860    1.865    1.153
  1.00  very expansive           27.217    2.550    1.224
monotonic: yes   grammar: intact

tone: share of warm words
  0.00  grim 100%                 0.085    0.038    1.208
  0.25  grim 75%                  0.240    0.077    1.196
  0.50  grim 50%                  0.504    0.101    1.075
  0.75  kind 75%                  0.740    0.091    1.012
  1.00  kind 100%                 0.890    0.046    0.940
monotonic: yes   grammar: intact
```

This is `tests/test_local.py::test_a_dial_moves_a_measured_style_monotonically`
(marked `slow`). It asserts a strict rise at every step, the eval's own grammar
verdict, and that at least 95% of sentences still parse under the toy grammar
at every position.

What that does and does not establish. It shows the pipeline end to end:
contrastive training, vectors that load, a dial that moves a measured property
of the output monotonically, and a check that notices when the text breaks. It
does not show that the vectors for `tone` or `pace` on a real model do the
same; that is the first thing to run on a GPU. Two honest notes on how the toy
result was reached: the strengths (0.12 for tone, 0.2 for pace) were chosen by
sweeping `eval`, and pushed further they break the text (tone at 0.2 left 67%
of sentences well-formed at the far pole, which `eval` flags); and the toy
language was changed once so that style varies sentence by sentence, because
with one fixed style per document each sample was nearly all-or-nothing and two
adjacent positions fell within noise. The assertions were not loosened.

### What the mechanism tests show

On random-initialised Llama-architecture and GPT-2-architecture models
(`tests/test_local.py`, about 65 tests):

- **Steering** changes the continuation's activations and leaves the prefix's
  bit-identical; the projection of the continuation onto the vector rises
  monotonically with the dial.
- **Attention bias.** The mass on pinned positions rises strictly with the
  pin's weight. In the first layer the log-odds of a pinned column against a
  free one shift by exactly the bias, in every head. Rows before the anchor are
  identical to the unbiased pass. The bias acts the same through eager and
  scaled-dot-product attention.
- **KV-cache reuse.** Logits through the cached prefix equal a full forward
  pass, including when the prefix tokenises differently once text follows it.
- **Cancellation.** A cancelled request stops its thread within one token step,
  and the request is not counted as finished until the thread has returned,
  including when a second cancel arrives while it is still waiting.
- **Focus monitor.** One score per display token, the same with and without the
  prefix cache, showing a pin, and able to run while a generation is in flight.
- **End to end** through the engine (seed, dial, pin, scrub): no stale tokens,
  no orphaned requests.

## Known limits

- **Raw continuation.** The model is given the text as it stands; no chat
  template and no task framing are put around it. An instruction-tuned model
  may end its turn early on bare prose, which the engine reads as "done". A
  base (non-instruct) model is the safer first choice.
- **Layouts.** Decoder blocks are expected at `base_model.layers` (Llama,
  Qwen2, Mistral) or `base_model.h` (GPT-2), on a single device. Anything else
  is refused with a clear error. Sliding-window caches are not supported.
- **The first pass over a new prefix cannot be interrupted**; cancellation
  takes effect within one token step after it.
- **Context.** A text longer than the model's context is refused; the focus
  monitor reads only its tail.
- **The focus monitor leaves out the first position's column**, on the
  assumption that causal models park unused attention there. That assumption
  has not been checked on real weights.
- **Coherence.** Large dial values can break grammar. Test each vector alone
  first and keep `max_strength` below where `eval` exits 2.
