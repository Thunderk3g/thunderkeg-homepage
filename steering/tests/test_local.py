"""Tier B on models small enough to build here: steering, the attention lock, the focus monitor, the vectors.

Nothing is downloaded. The fast tests use random-initialised Llama- and
GPT-2-shaped models, which is enough to check mechanics: what a hook or a mask
does to activations and attention does not depend on the weights meaning
anything. The slow test trains a small model on a synthetic language with two
countable styles and checks the product claim itself: turning a dial moves a
measured property of the text monotonically.
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
import math
import random

import pytest

torch = pytest.importorskip("torch")
pytest.importorskip("transformers")
pytest.importorskip("tokenizers")

import yaml  # noqa: E402

from steerable import protocol as P  # noqa: E402
from steerable import vectors  # noqa: E402
from steerable.attention.proxy import ProxyAttention  # noqa: E402
from steerable.attention.readout import Runner, cut, decoder_layers, layer_range, pin_weights, recording, to_display  # noqa: E402
from steerable.backends import make_backend  # noqa: E402
from steerable.backends import local as local_module  # noqa: E402
from steerable.backends.base import AttnRequest, BackendError, GenRequest, PinSpec  # noqa: E402
from steerable.backends.local import LocalSteeringBackend  # noqa: E402
from steerable.dimensions import load_dimensions  # noqa: E402
from steerable.engine import Engine  # noqa: E402
from steerable.layout import split as layout_split  # noqa: E402
from steerable.layout import wrap  # noqa: E402

import tiny  # noqa: E402
from conftest import Client, make_settings, settle  # noqa: E402

ARCHS = ["llama", "gpt2"]
TEXT = "Elara had kept the key hidden for eleven years, and tonight she finally carried it up the hill.\n\nShadows stretched across the path."
AWKWARD = ["", " ", "a", "Elara  kept the key — café 🎉 naïve.\n\nShe  opened it. ", "\n\nline\n", "tabs\tand\r\nreturns", "日本語のテキスト"]
DIALS = [0.0, 0.25, 0.5, 0.75, 1.0]


@pytest.fixture(scope="module")
def checkpoints(tmp_path_factory) -> dict[str, str]:
    """A random-init model and tokenizer per architecture, saved the way a real checkpoint is."""
    root = tmp_path_factory.mktemp("models")
    return {arch: str(tiny.save_tiny(root / arch, arch)) for arch in ARCHS}


@pytest.fixture(scope="module")
def trained(checkpoints, tmp_path_factory) -> dict[str, str]:
    """Vectors for every dimension in dimensions.yaml, trained on each tiny model through the command line."""
    out: dict[str, str] = {}
    for arch, path in checkpoints.items():
        out[arch] = str(tmp_path_factory.mktemp(f"vectors-{arch}"))
        assert vectors.main(["train", "--model", path, "--vectors-dir", out[arch], "--device", "cpu"]) == 0
    return out


@pytest.fixture
async def backend(request, checkpoints, trained):
    """A Tier B backend on the tiny model of the requested architecture, with its vectors."""
    arch = request.param
    settings = make_settings(backend="local", local_model=checkpoints[arch], vectors_dir=trained[arch], local_device="cpu")
    b = LocalSteeringBackend(load_dimensions(), settings)
    yield b
    await b.aclose()
    assert b.inflight == 0


both = pytest.mark.parametrize("backend", ARCHS, indirect=True)


async def collect(backend: LocalSteeringBackend, req: GenRequest) -> list[str]:
    return [t async for chunk in backend.generate(req) for t in chunk]


def request_for(backend: LocalSteeringBackend, text: str = TEXT, **over) -> GenRequest:
    tokens = backend.split(text)
    base = dict(tokens=tokens, anchor=len(tokens), dials={}, pins=[], max_tokens=24, seed=7)
    base.update(over)
    return GenRequest(**base)


# ───────────────────────── tokens ─────────────────────────


@both
def test_split_gives_the_text_back(backend):
    for text in [TEXT, *AWKWARD]:
        tokens = backend.split(text)
        assert "".join(tokens) == text
        assert all(tokens), "an empty display token"
        assert all("\n" not in t or set(t) == {"\n"} for t in tokens), "a token mixes newlines with text"
    assert len(backend.split(TEXT)) > len(layout_split(TEXT)), "display tokens should be the model's tokens, not words"


@both
def test_character_spans_tile_the_text(backend):
    for text in [TEXT, *AWKWARD]:
        enc = backend.lm.encode(text)
        assert len(enc.ids) == len(enc.spans) >= 1
        assert enc.spans[0][0] == 0 and enc.spans[-1][1] == len(text)
        assert all(a[1] == b[0] for a, b in zip(enc.spans, enc.spans[1:])), "a gap or an overlap between tokens"
        assert enc.before(len(text)) == len(enc.ids) and enc.before(-1) == 0


def test_a_model_token_with_newlines_in_it_is_cut_for_the_layout():
    assert cut(".\n\n") == [".", "\n\n"] and cut("\nThe") == ["\n", "The"] and cut(" \n \n") == [" ", "\n", " ", "\n"]
    assert cut(" word") == [" word"] and cut("\n\n") == ["\n\n"] and cut("") == []
    # the layout code now sees the paragraph break that the uncut token would have hidden
    assert wrap([" end", ".\n\n", "Next"], 72) == [0, 0, 0] and wrap([" end", ".", "\n\n", "Next"], 72) == [0, 0, 0, 2]


def test_scores_are_shared_out_by_character():
    # one model token covering "ab" and half of "cd" puts two thirds of its score on the first display token
    assert to_display([3.0, 1.0], [(0, 3), (3, 4)], ["ab", "cd"]) == pytest.approx([2.0, 2.0])
    assert to_display([5.0, 1.0], [(0, 0), (0, 2)], ["ab"]) == [1.0], "a token with no characters has nowhere to go"


def test_a_pin_is_mapped_by_characters_not_by_index():
    # display tokens are words; the model's tokens are cut differently and start with a special token
    words = ["The", " key", " was", " hidden"]
    spans = [(0, 0), (0, 2), (2, 5), (5, 7), (7, 11), (11, 18)]  # <s> | Th | e k | ey | " was" | " hidden"
    weights = pin_weights([PinSpec(1, 2, 0.5, "key")], words, spans)
    assert weights == [0.0, 0.0, 0.5, 0.5, 0.0, 0.0]
    assert pin_weights([PinSpec(3, 9, 1.0, "hidden"), PinSpec(1, 2, 0.5, "key")], words, spans) == [0.0, 0.0, 0.5, 0.5, 0.0, 1.0]


# ───────────────────────── generation ─────────────────────────


@both
async def test_generation_is_reproducible_and_stops_at_max_tokens(backend):
    req = request_for(backend)
    first = await collect(backend, req)
    assert len(first) == 24 and all(first)
    assert await collect(backend, req) == first, "the same request must write the same branch"
    assert await collect(backend, request_for(backend, seed=8)) != first
    assert backend.inflight == 0
    # a fresh backend has no cached prefix and must still agree
    other = LocalSteeringBackend(backend.dims, backend.s)
    assert await collect(other, req) == first
    await other.aclose()


@both
async def test_a_branch_is_continued_from_what_it_already_holds(backend):
    req = request_for(backend, max_tokens=6)
    head = await collect(backend, req)
    more = await collect(backend, GenRequest(tokens=req.tokens + head, anchor=req.anchor, dials={}, pins=[], max_tokens=6, seed=9))
    assert len(more) == 6
    text = "".join(req.tokens + head + more)
    assert "".join(backend.split(text)) == text


@both
async def test_characters_split_across_tokens_arrive_whole(backend, monkeypatch):
    lm = backend.lm
    wanted = " café 🎉 naïve — 日本\n\nnext"
    script = iter(lm.tokenizer(wanted, add_special_tokens=False)["input_ids"] + [next(iter(lm.eos))])
    assert len(lm.tokenizer(" 🎉", add_special_tokens=False)["input_ids"]) > 2, "the emoji should take several tokens"
    monkeypatch.setattr(local_module, "sample", lambda *args: next(script))
    out = await collect(backend, request_for(backend, max_tokens=200))
    assert "".join(out) == wanted
    assert all(piece and "�" not in piece for piece in out)
    assert len(out) < len(lm.tokenizer(wanted, add_special_tokens=False)["input_ids"]), "tokens of one character were not joined"


@both
async def test_generation_ends_when_the_model_does(backend, monkeypatch):
    eos = next(iter(backend.lm.eos))
    script = iter(backend.lm.tokenizer(" the end", add_special_tokens=False)["input_ids"] + [eos, 5, 5])
    monkeypatch.setattr(local_module, "sample", lambda *args: next(script))
    assert "".join(await collect(backend, request_for(backend))) == " the end"


@both
async def test_empty_text_starts_from_the_start_token(backend):
    out = await collect(backend, GenRequest(tokens=[], anchor=0, dials={}, pins=[], max_tokens=5, seed=1))
    assert len(out) == 5


@both
async def test_text_longer_than_the_context_is_refused(backend):
    with pytest.raises(BackendError, match="tokens long"):
        await collect(backend, request_for(backend, "word " * 400))
    assert backend.inflight == 0


def count_forwards(backend: LocalSteeringBackend) -> list[int]:
    """Make the backend count its forward passes; the count is the single item of the returned list."""
    calls = [0]
    real = backend.lm.forward

    def counting(*args, **kwargs):
        calls[0] += 1
        return real(*args, **kwargs)

    backend.lm.forward = counting
    return calls


@both
async def test_cancel_stops_the_thread_before_inflight_clears(backend):
    calls = count_forwards(backend)
    got: list[str] = []

    async def consume() -> None:
        async for chunk in backend.generate(request_for(backend, max_tokens=200)):
            got.extend(chunk)

    task = asyncio.create_task(consume())
    while not got:
        await asyncio.sleep(0.001)
    assert backend.inflight == 1
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    # the moment the cancelled task is done, the thread is too: nothing more runs on the model
    assert backend.inflight == 0
    done = calls[0]
    await asyncio.sleep(0.05)
    assert calls[0] == done, "the worker thread outlived the cancelled request"
    assert done < 150, "the thread ran on long after the cancel"


@both
async def test_closing_the_stream_early_stops_the_thread(backend):
    calls = count_forwards(backend)
    async with contextlib.aclosing(backend.generate(request_for(backend, max_tokens=200))) as stream:
        async for _ in stream:
            break
    assert backend.inflight == 0
    done = calls[0]
    await asyncio.sleep(0.05)
    assert calls[0] == done < 150


@both
async def test_a_queued_request_that_is_cancelled_leaves_the_queue(backend):
    started: list[str] = []
    real = backend._write

    def tracking(req, stop):
        started.append(req.tokens[-1])
        return real(req, stop)

    backend._write = tracking
    first = asyncio.create_task(collect(backend, request_for(backend, TEXT + " one", max_tokens=100)))
    while not started:
        await asyncio.sleep(0.001)
    second = asyncio.create_task(collect(backend, request_for(backend, TEXT + " two", max_tokens=100)))
    third = asyncio.create_task(collect(backend, request_for(backend, TEXT + " three", max_tokens=5)))
    await asyncio.sleep(0.005)
    assert backend.inflight == 3 and len(started) == 1, "one generation at a time on the model"
    second.cancel()
    with pytest.raises(asyncio.CancelledError):
        await second
    assert backend.inflight == 2
    assert len(await third) == 5 and len(await first) == 100
    assert len(started) == 2, "the cancelled request must never have reached the model"
    assert backend.inflight == 0


# ───────────────────────── the prefix cache ─────────────────────────


@both
def test_cached_prefix_gives_the_same_logits_as_a_full_pass(backend):
    lm = backend.lm
    tokens = backend.split(TEXT)
    k = len(tokens) // 2
    prefix = "".join(tokens[:k])
    enc = lm.encode(TEXT)
    anchor = enc.before(len(prefix))
    steer = backend.steer({"pace": 1.0, "tone": 0.2})
    bias = lm.pin_bias([PinSpec(2, 5, 1.0, "")], tokens, enc.spans, 2.0)
    assert steer and bias is not None

    for kwargs in ({}, {"steer": steer, "anchor": anchor, "bias": bias}):
        full = lm.forward(enc.ids, **kwargs).logits[0]
        for _ in range(2):  # the second time the prefix comes out of the cache, and must not have been changed
            past, done = lm.resume(enc.ids, prefix, len(enc.ids) - 1)
            assert done == anchor
            out = lm.forward(enc.ids[done:], past, **kwargs)
            assert torch.allclose(out.logits[0], full[done:], atol=1e-5)
            assert out.past_key_values.get_seq_length() == len(enc.ids)
            cached_ids, cached = lm.prefix(prefix)
            assert cached.get_seq_length() == len(cached_ids) == anchor, "the cached prefix was extended in place"
    assert len(lm._prefixes) == 1, "the prefix is computed once and keyed by its text"

    # the steering and the bias did change the continuation, so the equality above is not vacuous
    plain = lm.forward(enc.ids).logits[0]
    steered = lm.forward(enc.ids, steer=steer, anchor=anchor, bias=bias).logits[0]
    assert torch.equal(plain[: anchor - 1], steered[: anchor - 1])
    assert not torch.allclose(plain[anchor:], steered[anchor:], atol=1e-4)


@both
def test_a_prefix_that_tokenises_differently_in_context_is_cut_back(backend):
    lm = backend.lm
    # alone, "hid" ends the prefix; followed by "den" the tokenizer may merge across the seam
    prefix, text = "She kept the key hid", "She kept the key hidden for years"
    ids = lm.encode(text).ids
    past, done = lm.resume(ids, prefix, len(ids) - 1)
    assert done <= len(lm.encode(prefix).ids) and lm.encode(prefix).ids[:done] == ids[:done]
    out = lm.forward(ids[done:], past)
    assert torch.allclose(out.logits[0], lm.forward(ids).logits[0][done:], atol=1e-5)


# ───────────────────────── steering ─────────────────────────


def continuation_projection(backend: LocalSteeringBackend, dials: dict[str, float], direction: torch.Tensor) -> tuple[torch.Tensor, float, int]:
    """The last layer's residuals for TEXT steered from its midpoint, and the continuation's mean projection on `direction`."""
    lm = backend.lm
    tokens = backend.split(TEXT)
    enc = lm.encode(TEXT)
    anchor = enc.before(len("".join(tokens[: len(tokens) // 2])))
    last = lm.depth - 1
    with recording(lm.layers, [last]) as seen:
        lm.forward(enc.ids, steer=backend.steer(dials), anchor=anchor)
    hidden = seen[last][0]
    return hidden, float((hidden[anchor:] @ direction).mean()), anchor


@both
def test_steering_moves_the_continuation_and_never_the_prefix(backend):
    # pace is swept end to end; tone, a blend of four poles, over its last stretch, from the third pole to the fourth
    for name, sweep in (("pace", DIALS), ("tone", [2 / 3 + v / 3 for v in DIALS])):
        dim = backend.dims.get(name)
        high = dim.poles[-1].name
        vector = vectors.ControlVector.load(vectors.vector_path(dim, backend.s.vectors_dir))
        direction = vector.poles[high][-1]
        plain, _, anchor = continuation_projection(backend, {}, direction)
        seen: list[float] = []
        for value in sweep:
            hidden, projection, _ = continuation_projection(backend, {name: value}, direction)
            assert torch.equal(hidden[:anchor], plain[:anchor]), "steering reached the kept prefix"
            seen.append(projection)
        assert all(b > a for a, b in zip(seen, seen[1:])), f"{name}: projection is not monotonic in the dial: {seen}"
        if dim.kind == "bipolar":
            hidden, _, _ = continuation_projection(backend, {name: 0.5}, direction)
            assert torch.equal(hidden, plain), "a bipolar dial at its centre must not steer"


@both
def test_the_steering_vector_is_the_weighted_sum_over_dials_and_poles(backend):
    dims = backend.dims
    dials = {"tone": 0.5, "pace": 0.75}
    total = backend.steer(dials)
    for layer, got in total.items():
        want = torch.zeros_like(got)
        for name, value in dials.items():
            for pole, weight in dims.get(name).weights(value).items():
                want += weight * backend.vectors[name][pole][layer]
        assert torch.allclose(got, want, atol=1e-6)
    assert backend.steer({}) == {} and backend.steer({"pace": 0.5}) == {}
    # at full dial the vector added is max_strength of the layer's mean residual length
    vector = vectors.ControlVector.load(vectors.vector_path(dims.get("pace"), backend.s.vectors_dir))
    full = backend.steer({"pace": 1.0})
    for i, layer in enumerate(vector.layers):
        assert float(full[layer].norm()) == pytest.approx(0.08 * float(vector.norms[i]), rel=1e-4)


async def test_a_missing_vector_file_is_a_warning_not_a_crash(checkpoints, tmp_path, caplog):
    settings = make_settings(backend="local", local_model=checkpoints["llama"], vectors_dir=str(tmp_path), local_device="cpu")
    with caplog.at_level(logging.WARNING, logger="steerable.local"):
        backend = LocalSteeringBackend(load_dimensions(), settings)
    assert backend.vectors == {}
    warned = [r.getMessage() for r in caplog.records if "no control vectors" in r.getMessage()]
    assert len(warned) == len(list(backend.dims)), "one warning per dimension, at load"
    caplog.clear()
    with caplog.at_level(logging.WARNING, logger="steerable.local"):
        req = request_for(backend, max_tokens=8)
        steered = await collect(backend, GenRequest(req.tokens, req.anchor, {"pace": 1.0}, [], 8, req.seed))
        assert steered == await collect(backend, req), "a dial with no vector must have no effect"
    assert not caplog.records, "the warning is given once, not on every request"
    await backend.aclose()


async def test_vectors_for_another_model_are_refused(checkpoints, trained, tmp_path):
    other = tiny.save_tiny(tmp_path / "wide", "llama", hidden=48)
    settings = make_settings(backend="local", local_model=str(other), vectors_dir=trained["llama"], local_device="cpu")
    backend = LocalSteeringBackend(load_dimensions(), settings)
    assert backend.vectors == {}
    await backend.aclose()


# ───────────────────────── the attention lock ─────────────────────────


def pinned_mass(backend: LocalSteeringBackend, weight: float) -> tuple[torch.Tensor, torch.Tensor, int, list[int]]:
    """Attention with a pin of `weight` on display tokens 3..6 of TEXT, locked from the midpoint.

    Returns the logits, the attention averaged over layers and heads (rows by
    columns), the anchor, and the pinned model positions.
    """
    lm = backend.lm
    tokens = backend.split(TEXT)
    enc = lm.encode(TEXT)
    anchor = enc.before(len("".join(tokens[: len(tokens) // 2])))
    pins = [PinSpec(3, 6, weight, "".join(tokens[3:6]))]
    out = lm.forward(enc.ids, anchor=anchor, bias=lm.pin_bias(pins, tokens, enc.spans, backend.s.pin_bias), attentions=True)
    attention = torch.stack([a[0].float() for a in out.attentions]).mean(dim=(0, 1))
    columns = [i for i, w in enumerate(pin_weights([PinSpec(3, 6, 1.0, "")], tokens, enc.spans)) if w]
    return out.logits[0], attention, anchor, columns


@both
def test_a_pin_raises_attention_on_the_pinned_tokens_monotonically(backend):
    assert backend.lm._attn == "sdpa", "the test means to compare the default attention path with the eager one"
    _, plain, anchor, columns = pinned_mass(backend, 0.0)
    assert columns and max(columns) < anchor
    masses: list[float] = []
    for weight in DIALS:
        _, attention, _, _ = pinned_mass(backend, weight)
        assert torch.allclose(attention.sum(-1), torch.ones(attention.shape[0]), atol=1e-4)
        assert torch.equal(attention[:anchor], plain[:anchor]), "the bias reached rows before the anchor"
        masses.append(float(attention[anchor:, columns].sum(-1).mean()))
    assert all(b > a for a, b in zip(masses, masses[1:])), f"mass on the pin is not monotonic in its weight: {masses}"

    # The bias is exactly additive on the scores. In the first layer, where both passes see the same
    # residuals, the log-odds of a pinned column against a free one move by the bias itself, in every head.
    lm = backend.lm
    tokens = backend.split(TEXT)
    enc = lm.encode(TEXT)
    free = next(i for i in range(1, anchor) if i not in columns)
    odds = []
    for weight in (0.0, 0.5, 1.0):
        bias = lm.pin_bias([PinSpec(3, 6, weight, "")], tokens, enc.spans, backend.s.pin_bias)
        first = lm.forward(enc.ids, anchor=anchor, bias=bias, attentions=True).attentions[0][0].float()
        odds.append(torch.log(first[:, anchor:, columns[0]] / first[:, anchor:, free]))
    assert torch.allclose(odds[1] - odds[0], torch.full_like(odds[0], 0.5 * backend.s.pin_bias), atol=1e-4)
    assert torch.allclose(odds[2] - odds[0], torch.full_like(odds[0], backend.s.pin_bias), atol=1e-4)


@both
def test_the_bias_acts_the_same_through_sdpa_and_eager_attention(backend):
    lm = backend.lm
    tokens = backend.split(TEXT)
    enc = lm.encode(TEXT)
    anchor = enc.before(len("".join(tokens[: len(tokens) // 2])))
    bias = lm.pin_bias([PinSpec(3, 6, 1.0, "")], tokens, enc.spans, backend.s.pin_bias)
    plain = lm.forward(enc.ids).logits[0]
    sdpa = lm.forward(enc.ids, anchor=anchor, bias=bias).logits[0]
    eager = lm.forward(enc.ids, anchor=anchor, bias=bias, attentions=True).logits[0]
    assert lm.model.config._attn_implementation == "sdpa", "the eager pass must hand the model back as it found it"
    assert torch.allclose(sdpa, eager, atol=1e-5)
    assert torch.equal(sdpa[: anchor - 1], plain[: anchor - 1])
    assert float((sdpa[anchor:] - plain[anchor:]).abs().max()) > 1e-3, "the mask had no effect on the default attention path"
    # token by token with the cache, as generation runs it, the biased logits are the same again
    past, done = lm.resume(enc.ids, "".join(tokens[: len(tokens) // 2]), len(enc.ids) - 1)
    for i in range(done, len(enc.ids)):
        step = lm.forward(enc.ids[i : i + 1], past, anchor=anchor, bias=bias)
        past = step.past_key_values
        assert torch.allclose(step.logits[0, -1], sdpa[i], atol=1e-5)


@both
async def test_a_pin_changes_what_is_written(backend):
    req = request_for(backend, max_tokens=12)
    pinned = GenRequest(req.tokens, req.anchor, {}, [PinSpec(3, 6, 1.0, "".join(req.tokens[3:6]))], 12, req.seed)
    lm = backend.lm
    enc = lm.encode(TEXT)
    bias = lm.pin_bias(pinned.pins, req.tokens, enc.spans, backend.s.pin_bias)
    a = lm.forward(enc.ids).logits[0, -1]
    b = lm.forward(enc.ids, anchor=len(enc.ids) - 1, bias=bias).logits[0, -1]
    assert not torch.allclose(a, b, atol=1e-4)
    assert len(await collect(backend, pinned)) == 12


def test_an_unknown_layout_is_refused():
    class Odd(torch.nn.Module):
        base_model = torch.nn.Linear(2, 2)

    with pytest.raises(BackendError, match="unsupported layout"):
        decoder_layers(Odd())


# ───────────────────────── the focus monitor ─────────────────────────


@both
async def test_focus_monitor_scores_every_display_token(backend):
    tokens = backend.split(TEXT)
    for anchor in (0, len(tokens) // 2, len(tokens)):
        for window in (1, 8, 500):
            result = await backend.attention(AttnRequest(tokens=tokens, pins=[], window=window, anchor=anchor))
            assert result.source == "model"
            assert len(result.tok_scores) == len(tokens)
            assert max(result.tok_scores) == 1.0 and min(result.tok_scores) >= 0.0
    assert (await backend.attention(AttnRequest(tokens=[], pins=[]))).tok_scores == []


@both
async def test_focus_monitor_reads_the_same_with_and_without_the_prefix_cache(backend):
    tokens = backend.split(TEXT)
    # with no dial and no pin the anchor only decides how much comes from the cache
    reads = [(await backend.attention(AttnRequest(tokens=tokens, pins=[], window=8, anchor=a))).tok_scores for a in (0, 5, len(tokens))]
    assert reads[0] == pytest.approx(reads[1], abs=2e-4) and reads[0] == pytest.approx(reads[2], abs=2e-4)
    # and it is the attention itself: the eager rows of the last eight tokens, over the steering layers
    lm = backend.lm
    enc = lm.encode(TEXT)
    out = lm.forward(enc.ids, attentions=True)
    rows = torch.stack([out.attentions[i][0].float().mean(0)[-8:].sum(0) for i in lm.focus_layers]).mean(0)
    rows[0] = 0
    want = to_display(rows.tolist(), enc.spans, tokens)
    assert reads[0] == pytest.approx([w / max(want) for w in want], abs=2e-4)
    assert lm.focus_layers == layer_range(lm.depth, 0.35, 0.7)


@both
async def test_focus_monitor_shows_the_lock(backend):
    tokens = backend.split(TEXT)
    anchor = len(tokens) // 2
    shares: list[float] = []
    for weight in DIALS:
        pins = [PinSpec(3, 6, weight, "".join(tokens[3:6]))] if weight else []
        scores = (await backend.attention(AttnRequest(tokens=tokens, pins=pins, window=8, anchor=anchor))).tok_scores
        shares.append(sum(scores[3:6]) / sum(scores))
    assert all(b > a for a, b in zip(shares, shares[1:])), f"the pin's share of focus is not monotonic in its weight: {shares}"


@both
async def test_focus_monitor_runs_while_a_generation_is_in_flight(backend):
    req = request_for(backend, max_tokens=120)
    task = asyncio.create_task(collect(backend, req))
    reads = 0
    while not task.done():
        result = await backend.attention(AttnRequest(tokens=req.tokens, pins=[], window=8, anchor=req.anchor))
        assert len(result.tok_scores) == len(req.tokens)
        reads += 1
    assert reads >= 2, "the monitor waited for the whole generation"
    assert await task == await collect(backend, req), "a readout between two tokens must not disturb the branch"


@pytest.mark.parametrize("arch", ARCHS)
async def test_proxy_focus_monitor(checkpoints, arch):
    proxy = ProxyAttention(checkpoints[arch])
    assert proxy.source == f"proxy:{checkpoints[arch]}"
    tokens = layout_split(TEXT)  # Tier A display tokens are words; the proxy cuts the text its own way
    plain = await proxy.attention(AttnRequest(tokens=tokens, pins=[], window=6, anchor=4))
    assert plain.source == proxy.source and len(plain.tok_scores) == len(tokens)
    assert max(plain.tok_scores) == 1.0 and min(plain.tok_scores) >= 0.0
    pinned = await proxy.attention(AttnRequest(tokens=tokens, pins=[PinSpec(2, 4, 1.0, "kept the")], window=6, anchor=4))
    assert max(pinned.tok_scores) == 1.0
    assert sum(pinned.tok_scores[2:4]) / sum(pinned.tok_scores) > sum(plain.tok_scores[2:4]) / sum(plain.tok_scores)
    long = await proxy.attention(AttnRequest(tokens=layout_split(("word " * 400).strip()), pins=[], window=6))
    assert len(long.tok_scores) == 400 and max(long.tok_scores) == 1.0, "a text past the model's context is read over its tail"


# ───────────────────────── vectors ─────────────────────────


@pytest.mark.parametrize("arch", ARCHS)
def test_training_writes_vectors_that_load(checkpoints, trained, arch):
    dims = load_dimensions()
    lm = Runner(checkpoints[arch], "cpu")
    for dim in dims:
        path = vectors.vector_path(dim, trained[arch])
        assert path.exists()
        vector = vectors.ControlVector.load(path)
        assert vector.dimension == dim.name and vector.model == checkpoints[arch]
        assert vector.layers == layer_range(lm.depth, *dim.tier_b["layers"])
        assert set(vector.poles) == {p.name for p in dim.poles}
        assert vector.norms.shape == (len(vector.layers),) and bool((vector.norms > 0).all())
        for unit in vector.poles.values():
            assert unit.shape == (len(vector.layers), lm.hidden)
            assert torch.allclose(unit.norm(dim=-1), torch.ones(len(vector.layers)), atol=1e-5)
        if dim.kind == "bipolar":
            low, high = (p.name for p in dim.poles)
            assert torch.equal(vector.poles[low], -vector.poles[high])
    settings = make_settings(backend="local", local_model=checkpoints[arch], vectors_dir=trained[arch], local_device="cpu")
    backend = make_backend(settings, dims)
    assert isinstance(backend, LocalSteeringBackend) and (backend.name, backend.tier, backend.attention_source) == ("local", "B", "model")
    assert set(backend.vectors) == {d.name for d in dims}


def test_a_vector_points_from_the_other_poles_toward_its_own(checkpoints):
    lm = Runner(checkpoints["llama"], "cpu")
    dims = load_dimensions()
    for name in ("pace", "tone"):
        dim = dims.get(name)
        vector, agreement = vectors.train_dimension(lm, dim, dims.contrast_stems)
        assert agreement > 0.5
        for p, pole in enumerate(dim.poles):
            acts = [
                torch.stack([vectors.last_activations(lm, vectors.contrast_ids(lm, stem, q.prompt), vector.layers) for stem in dims.contrast_stems])
                for q in dim.poles
            ]
            others = torch.stack([a for q, a in enumerate(acts) if q != p]).mean(0)
            lift = torch.einsum("sld,ld->l", acts[p] - others, vector.poles[pole.name]) / len(dims.contrast_stems)
            assert bool((lift > 0).all()), f"{name}/{pole.name}: the vector points away from its pole at some layer"


def test_first_component_finds_the_shared_shift():
    torch.manual_seed(0)
    shift = torch.nn.functional.normalize(torch.randn(16), dim=0)
    diffs = 3.0 * shift + 0.3 * torch.randn(20, 16)
    found = vectors.first_component(diffs)
    assert float(found @ shift) > 0.95 and float(found.norm()) == pytest.approx(1.0)
    assert float(vectors.first_component(-diffs) @ shift) < -0.95, "the sign follows the differences"


def test_contrast_prompts_use_the_chat_template_when_there_is_one(checkpoints):
    lm = Runner(checkpoints["llama"], "cpu")
    plain = lm.decode(vectors.contrast_ids(lm, "She opened the letter and", "warm and gentle"))
    assert plain == "Write in a style that is warm and gentle.\n\nShe opened the letter and"
    lm.tokenizer.chat_template = "{% for m in messages %}<{{ m['role'] }}>{{ m['content'] }}\n{% endfor %}{% if add_generation_prompt %}<assistant>{% endif %}"
    chat = lm.decode(vectors.contrast_ids(lm, "She opened the letter and", "warm and gentle"))
    assert chat == "<user>Continue this piece of writing in a style that is warm and gentle.\n<assistant>She opened the letter and"
    custom = lm.decode(vectors.contrast_ids(lm, "the stem", "the style", "{prompt} | {stem}"))
    assert custom == "the style | the stem"


def test_sentence_and_repetition_scores():
    assert vectors.words_per_sentence("One two. Three four five six!") == 3.0
    assert vectors.words_per_sentence("One two. Three four five six and then it was cut") == 2.0
    assert vectors.words_per_sentence("no end at all") == 4.0 and vectors.words_per_sentence("") == 0.0
    assert vectors.repetition("a b c d e f") == 0.0
    assert vectors.repetition("a b c a b c a b c") == pytest.approx(1 - 3 / 7)


@both
async def test_evaluation_runs_end_to_end(backend, capsys):
    dims = backend.dims
    for name in ("pace", "tone", "tension"):
        dim = dims.get(name)
        report = await vectors.evaluate(backend, dim, samples=3, positions=3, tokens=8)
        assert [p.value for p in report.positions] == [0.0, 0.5, 1.0] and report.baseline.value is None
        assert all(len(p.samples) == 3 and all(math.isfinite(s) for s in p.scores + p.nlls) for p in report.positions)
        if dim.kind == "bipolar":
            assert report.positions[1].samples == report.baseline.samples, "a centred bipolar dial is the unsteered model"
        assert name in report.table() and "monotonic:" in report.table() and "grammar:" in report.table()
    judge = vectors.Judge(backend.lm, dims.get("tone"))
    assert 0.0 <= judge("She smiled.") <= 1.0 and len(judge.log_probs("She smiled.")) == 4
    # a pole name of several tokens is scored over all of them: its log-probability is below its first token's
    lm = backend.lm
    first = torch.log_softmax(lm.forward(judge.prompt_ids("She smiled.")).logits[0, -1].float(), -1)
    for name_ids, logp in zip(judge.names, judge.log_probs("She smiled.")):
        assert len(name_ids) > 1 and logp < float(first[name_ids[0]])


def test_eval_command_line_reports_and_sets_the_exit_code(checkpoints, trained, tmp_path, capsys):
    common = ["--model", checkpoints["llama"], "--device", "cpu"]
    args = ["eval", *common, "--dim", "pace", "--samples", "2", "--positions", "3", "--tokens", "6"]
    code = vectors.main([*args, "--vectors-dir", trained["llama"]])
    out = capsys.readouterr().out
    assert "mean words per sentence" in out and "monotonic:" in out
    assert code == (1 if "monotonic: NO" in out else 2 if "grammar: BROKEN" in out else 0)
    assert vectors.main([*args, "--vectors-dir", str(tmp_path)]) == 1, "no vectors, nothing to evaluate"
    assert "run `train` first" in capsys.readouterr().err


# ───────────────────────── through the engine ─────────────────────────


@both
async def test_engine_end_to_end(backend):
    settings = make_settings(backend="local", horizon=60, spec_tokens=8, debounce_ms=5, attention_ms=5)
    client = Client()
    engine = Engine(backend, backend.dims, settings, client.recv, strict=True)
    engine.start()
    seed_len = len(backend.split(TEXT))

    async def writing(seq: int) -> None:
        """Wait until the branch opened by gesture `seq` has put its first tokens on the page."""
        while not (client.of(P.Invalidate)[-1].cause_seq == seq and len(client.tokens) > seed_len):
            await asyncio.sleep(0.001)

    try:
        engine.seed(TEXT)
        await settle(engine, timeout=30)
        assert client.text.startswith(TEXT) and len(client.tokens) == seed_len + 60
        unsteered = client.text

        engine.set_dial("pace", 1.0, seq=1)
        await settle(engine, timeout=30)
        assert client.text.startswith(TEXT) and client.text != unsteered, "a full turn of a trained dial changed nothing"
        assert client.of(P.Invalidate)[-1].from_tok == seed_len

        # a second gesture lands while the first one's branch is still being written
        engine.set_dial("tone", 0.25, seq=2)
        await asyncio.wait_for(writing(2), 30)
        cancelled = engine.cancelled
        engine.set_dial("tone", 0.75, seq=3)
        assert engine.cancelled > cancelled, "the branch in flight was not cancelled"
        await settle(engine, timeout=30)
        assert len(client.tokens) == seed_len + 60

        engine.pin(3, 6, 1.0, seq=4)
        await settle(engine, timeout=30)
        assert client.state.pins and client.state.pins[0].text == "".join(backend.split(TEXT)[3:6]).strip()

        engine.scrub(seed_len + 10, seq=5)
        await settle(engine, timeout=30)
        assert len(client.tokens) == seed_len + 10
        engine.set_dial("pace", 0.0, seq=6)
        await settle(engine, timeout=30)
        engine.scrub(seed_len + 90, seq=7)
        await settle(engine, timeout=30)
        assert len(client.tokens) > seed_len + 70

        assert client.violations == []
        assert engine.orphans == 0
        assert client.tokens == engine._slice(0, engine.visible)
        shown = client.of(P.Attention)
        assert shown and shown[-1].source == "model" and len(shown[-1].tok_scores) == engine.visible
        assert not client.of(P.Error)
        assert engine.sim > 0, "speculation never ran on the local backend"
    finally:
        await engine.close()
    assert engine.inflight == 0 and backend.inflight == 0


# ───────────────────────── the acceptance criterion, small ─────────────────────────


def toy_dimensions(strength: float) -> dict:
    """Two dials for the synthetic language. A pole's `prompt` is a passage written in that style."""
    rng = random.Random(1)
    return {
        "version": 1,
        "dimensions": [
            {
                "name": "tone",
                "kind": "blend",
                "poles": [
                    {"name": "grim", "prompt": tiny.toy_passage(rng, tiny.COLD, False, 5)},
                    {"name": "kind", "prompt": tiny.toy_passage(rng, tiny.WARM, False, 5)},
                ],
                "tier_b": {"layers": [0.3, 0.8], "max_strength": strength, "steps": 24, "vector": "vectors/tone.pt"},
            },
            {
                "name": "pace",
                "kind": "bipolar",
                "poles": [
                    {"name": "compressed", "prompt": tiny.toy_passage(rng, tiny.WARM, False, 5)},
                    {"name": "expansive", "prompt": tiny.toy_passage(rng, tiny.WARM, True, 2)},
                ],
                "tier_b": {"layers": [0.3, 0.8], "max_strength": strength, "steps": 24, "vector": "vectors/pace.pt"},
            },
        ],
        # openings that give neither style away; half stop inside a clause, half at the end of one
        "contrast_stems": [
            stem
            for i, subject in enumerate(tiny.SUBJECTS)
            for stem in (subject + ("", " was", " saw the")[i % 3], f"{subject} {tiny.PLAIN[i % len(tiny.PLAIN)]}")
        ],
    }


@pytest.mark.slow
def test_a_dial_moves_a_measured_style_monotonically(tmp_path, capsys):
    """Train a small model on a two-style language, train vectors on it, and sweep each dial.

    The language has two tones with no word in common and two paces (one
    clause to a sentence, or several), so both styles can be counted in a
    sample. The vectors come from the real training command with a prompt
    template the toy model can read: a passage in the pole's style, then the
    opening. Each dial is then swept over five positions with twenty samples
    at each, and the mean score must rise at every step.
    """
    text = tiny.toy_corpus(3000)
    tokenizer = tiny.train_tokenizer([text], vocab_size=420, bos=False)
    torch.manual_seed(0)
    model = tiny.build_model("llama", len(tokenizer), hidden=64, layers=4, heads=4)
    loss = tiny.train_lm(model, tokenizer, text, steps=600)
    assert loss < 1.3, f"the toy model did not learn its language (loss {loss:.2f})"
    checkpoint = tmp_path / "toy"
    model.save_pretrained(checkpoint)
    tokenizer.save_pretrained(checkpoint)

    dims_file = tmp_path / "dimensions.yaml"
    dims_file.write_text(yaml.safe_dump(toy_dimensions(strength=0.3)))
    common = ["--model", str(checkpoint), "--dimensions", str(dims_file), "--vectors-dir", str(tmp_path / "vectors"), "--device", "cpu"]
    assert vectors.main(["train", *common, "--template", "{prompt} {stem}"]) == 0

    # pace, through the command line exactly as a user would run the acceptance check
    code = vectors.main(["eval", *common, "--dim", "pace", "--samples", "20", "--positions", "5", "--tokens", "48"])
    tables = [capsys.readouterr().out]
    assert code == 0, f"pace did not pass:\n{tables[0]}"

    dims = load_dimensions(dims_file)
    settings = make_settings(backend="local", local_model=str(checkpoint), vectors_dir=str(tmp_path / "vectors"), local_device="cpu")

    async def sweep() -> dict[str, vectors.Report]:
        backend = LocalSteeringBackend(dims, settings)
        tone = dims.get("tone")
        kwargs = dict(samples=20, positions=5, tokens=48)
        reports = {
            "pace": await vectors.evaluate(backend, dims.get("pace"), **kwargs),
            # tone, counted: of the tone words in a sample, the share from the warm vocabulary
            "tone, counted": await vectors.evaluate(backend, tone, scorer=tiny.warm_share, scorer_name="share of warm words", **kwargs),
            # tone, judged by the unsteered model: after the sample, is "the man was kind" likelier than "the man was grim"
            "tone, judged": await vectors.evaluate(
                backend, tone, scorer=vectors.Judge(backend.lm, tone, "{text} the man was"), scorer_name="model judge", **kwargs
            ),
        }
        await backend.aclose()
        return reports

    reports = asyncio.run(sweep())
    tables += [r.table() for r in list(reports.values())[1:]]
    with capsys.disabled():
        print("\n\n" + "\n\n".join(tables))

    assert reports["pace"].table() + "\n" == tables[0], "the command line and the library disagree"
    for name, report in reports.items():
        means = [p.score for p in report.positions]
        assert len(report.positions) == 5 and all(len(p.scores) == 20 for p in report.positions)
        assert all(b > a for a, b in zip(means, means[1:])), f"{name}: the score does not rise at every step: {means}"
        assert report.monotonic and report.grammar_intact, f"{name}:\n{report.table()}"
        low, high = report.positions[0], report.positions[-1]
        assert high.score - low.score > 4 * math.hypot(low.spread, high.spread), f"{name}: the shift is within the noise"
    # the two ends of each dial are far apart in the units of the measure itself
    assert reports["pace"].positions[-1].score > 2 * reports["pace"].positions[0].score
    assert reports["tone, counted"].positions[0].score < 0.2 and reports["tone, counted"].positions[-1].score > 0.8
