"""Tier B: an open-weights model on this machine, steered from the inside.

Where Tier A can only rewrite the prompt, this backend reaches into the model:

  dials   each set dial adds its control vector (steerable.vectors) to the
          residual stream of the layers it was trained for, scaled by the
          dial. The vector is added only at the positions of the continuation,
          from the anchor on. The kept prefix is left as the model would read
          it unsteered, which is what "steer the text that is coming" means,
          and which makes the prefix's keys and values the same for every
          dial setting, so they are computed once and reused.
  pins    a pinned phrase gets an additive bias on the attention scores of
          every continuation position toward the phrase's tokens, in every
          layer: `pin_bias` logits at full weight.
  focus   the focus monitor reads the model's own attention, with the same
          steering and bias in effect, so it shows what the lock is doing.

Generation is a plain sampling loop, one token per forward pass, run in a
worker thread. Each generated token's text is one display token (cut once
more where it mixes newlines with other characters, which the layout code
does not allow). The loop checks a stop flag before every pass, and the request
is not counted as finished until the thread has returned, so a cancelled
branch can never still be using the model when the next one starts.
"""

from __future__ import annotations

import asyncio
import logging
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import AsyncIterator, Callable, Iterator

import torch

from ..attention.readout import Runner, cut, layer_range
from ..config import Settings
from ..dimensions import Dimensions
from ..vectors import ControlVector, vector_path
from .base import AttnRequest, AttnResult, BackendError, GenRequest, SteeringBackend

log = logging.getLogger("steerable.local")

#: tokens of context decoded along with a new token, so its leading space and any split character come out right
DECODE_CONTEXT = 4


def sample(logits: torch.Tensor, temperature: float, top_p: float, rng: torch.Generator) -> int:
    """Draw one token: temperature, then the smallest set of tokens holding `top_p` of the probability."""
    logits = logits.float().cpu()
    if temperature <= 0:
        return int(logits.argmax())
    probs = torch.softmax(logits / temperature, -1)
    if top_p >= 1:
        return int(torch.multinomial(probs, 1, generator=rng))
    ranked, order = probs.sort(descending=True)
    ranked[ranked.cumsum(-1) - ranked >= top_p] = 0.0
    return int(order[torch.multinomial(ranked, 1, generator=rng)])


class LocalSteeringBackend(SteeringBackend):
    name = "local"
    tier = "B"
    attention_source = "model"

    def __init__(self, dims: Dimensions, settings: Settings) -> None:
        super().__init__(dims)
        self.s = settings
        self.model = settings.local_model
        self.lm = Runner(settings.local_model, settings.local_device, settings.local_dtype)
        #: per dimension and pole, the vector to add after each layer at full dial: {layer: (hidden,)}
        self.vectors: dict[str, dict[str, dict[int, torch.Tensor]]] = {}
        spans: list[list[int]] = []
        for dim in dims:
            spans.append(layer_range(self.lm.depth, *(dim.tier_b.get("layers") or ())))
            loaded = self._load_vector(dim.name, vector_path(dim, settings.vectors_dir), float(dim.tier_b.get("max_strength", 0.0)))
            if loaded:
                self.vectors[dim.name] = loaded
        # the focus monitor reads the layers the dials act on
        if spans:
            self.lm.focus_layers = list(range(min(s[0] for s in spans), max(s[-1] for s in spans) + 1))
        self._pool = ThreadPoolExecutor(max_workers=2, thread_name_prefix="steer-local")
        self._gate: asyncio.Lock | None = None
        self._gate_loop: asyncio.AbstractEventLoop | None = None

    def _load_vector(self, name: str, path: Path, strength: float) -> dict[str, dict[int, torch.Tensor]] | None:
        """One dimension's vectors, scaled to full strength; None (and one warning) if they cannot be used."""
        if not path.exists():
            log.warning("%s: no control vectors at %s; this dial will have no effect (python -m steerable.vectors train)", name, path)
            return None
        vec = ControlVector.load(path)
        sizes = {v.shape[-1] for v in vec.poles.values()}
        if sizes != {self.lm.hidden} or max(vec.layers) >= self.lm.depth:
            log.warning("%s: the vectors at %s were trained for %s and do not fit %s; this dial will have no effect", name, path, vec.model, self.model)
            return None
        if vec.model != self.model:
            log.warning("%s: the vectors at %s were trained for %s, not %s", name, path, vec.model, self.model)
        scale = (vec.norms * strength)[:, None]
        return {
            pole: {layer: v.to(self.lm.device, self.lm.dtype) for layer, v in zip(vec.layers, unit * scale)}
            for pole, unit in vec.poles.items()
        }

    def split(self, text: str) -> list[str]:
        return self.lm.split(text)

    def steer(self, dials: dict[str, float]) -> dict[int, torch.Tensor]:
        """What the set dials add to the residual stream after each layer."""
        total: dict[int, torch.Tensor] = {}
        for name, value in dials.items():
            dim, poles = self.dims.get(name), self.vectors.get(name)
            if dim is None or poles is None:
                continue
            for pole, weight in dim.weights(value).items():
                for layer, vector in poles[pole].items():
                    total[layer] = total[layer] + weight * vector if layer in total else weight * vector
        return total

    # ───────────────────────── generation ─────────────────────────

    def _write(self, req: GenRequest, stop: threading.Event) -> Iterator[str]:
        """The sampling loop: yields each generated token's text as it is decoded, until told to stop."""
        lm = self.lm
        prefix = "".join(req.tokens[: req.anchor])
        enc = lm.encode("".join(req.tokens))
        ids = list(enc.ids)
        if lm.max_positions and len(ids) >= lm.max_positions:
            raise BackendError(f"{self.model}: the text is {len(ids)} tokens long and the model takes {lm.max_positions}")
        anchor = enc.before(len(prefix))
        steer = self.steer(req.dials)
        bias = lm.pin_bias(req.pins, req.tokens, enc.spans, self.s.pin_bias)
        rng = torch.Generator().manual_seed(req.seed)

        # the kept prefix comes from the cache; what the branch already holds is re-run after it, steered
        past, done = lm.resume(ids, prefix, len(ids) - 1)
        if stop.is_set():
            return
        out = lm.forward(ids[done:], past, steer=steer, anchor=anchor, bias=bias)
        past = out.past_key_values

        tail = ids[-DECODE_CONTEXT:]
        held: list[int] = []
        sent = 0
        while not stop.is_set():
            token = sample(out.logits[0, -1], self.s.local_temperature, self.s.local_top_p, rng)
            if token in lm.eos:
                return
            ids.append(token)
            held.append(token)
            before, after = lm.decode(tail), lm.decode(tail + held)
            # a piece that ends inside a character waits for the tokens that finish it (four bytes at most)
            if len(after) > len(before) and (not after.endswith("\ufffd") or len(held) >= 4):
                for part in cut(after[len(before) :])[: req.max_tokens - sent]:
                    yield part
                    sent += 1
                tail, held = (tail + held)[-DECODE_CONTEXT:], []
            if sent >= req.max_tokens or (lm.max_positions and len(ids) >= lm.max_positions) or stop.is_set():
                return
            out = lm.forward([token], past, steer=steer, anchor=anchor, bias=bias)

    def _run(self, req: GenRequest, stop: threading.Event, emit: Callable[[str | BaseException | None], None]) -> None:
        """The worker thread: hand every token to the event loop, then None, or the error that ended it."""
        try:
            for piece in self._write(req, stop):
                emit(piece)
            emit(None)
        except BaseException as err:  # noqa: BLE001 - it is re-raised in the task that asked
            emit(err)

    def _queue(self) -> asyncio.Lock:
        """The lock that makes generations take turns, for the event loop that is running now."""
        loop = asyncio.get_running_loop()
        if self._gate is None or self._gate_loop is not loop:
            self._gate, self._gate_loop = asyncio.Lock(), loop
        return self._gate

    async def generate(self, req: GenRequest) -> AsyncIterator[list[str]]:
        self.inflight += 1
        try:
            # a request cancelled while it waits here simply leaves the queue; no thread was started for it
            async with self._queue():
                loop = asyncio.get_running_loop()
                queue: asyncio.Queue[str | BaseException | None] = asyncio.Queue()
                stop = threading.Event()
                worker = loop.run_in_executor(self._pool, self._run, req, stop, lambda item: loop.call_soon_threadsafe(queue.put_nowait, item))
                try:
                    finished = False
                    while not finished:
                        items = [await queue.get()]
                        while not queue.empty():
                            items.append(queue.get_nowait())
                        tokens = [i for i in items if isinstance(i, str)]
                        if tokens:
                            yield tokens
                        for item in items:
                            if isinstance(item, BaseException):
                                raise item
                            finished = finished or item is None
                finally:
                    stop.set()
                    await _joined(worker)
        finally:
            self.inflight -= 1

    # ───────────────────────── focus ─────────────────────────

    def _focus(self, req: AttnRequest) -> list[float]:
        scores = self.lm.focus(
            req.tokens, req.window, req.anchor, steer=self.steer(req.dials), pins=req.pins, pin_strength=self.s.pin_bias
        )
        return [round(s, 4) for s in scores]

    async def attention(self, req: AttnRequest) -> AttnResult | None:
        scores = await asyncio.get_running_loop().run_in_executor(self._pool, self._focus, req)
        return AttnResult(tok_scores=scores, source=self.attention_source)

    async def aclose(self) -> None:
        self._pool.shutdown(wait=False, cancel_futures=True)


async def _joined(worker: asyncio.Future) -> None:
    """Wait until the worker thread has returned, whatever happens to this task meanwhile.

    A second cancellation arriving during the wait must not let the caller go
    while the thread is still on the model; it is held until the thread is
    done and then passed on.
    """
    cancelled = False
    while not worker.done():
        try:
            await asyncio.shield(worker)
        except asyncio.CancelledError:
            cancelled = True
    if cancelled:
        raise asyncio.CancelledError
