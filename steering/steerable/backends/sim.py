"""The simulated backend: no model, real engine.

It writes plausible story text from the pools in sim.yaml, letting every dial
choose which pool a sentence draws from, at a configurable speed. It is what
milestone 1 runs on, what the tests and the latency harness drive, and what the
canvas falls back to when no model is configured. It is always labelled `sim`.
"""

from __future__ import annotations

import asyncio
import random
from typing import Any, AsyncIterator

from ..attention.heuristic import heuristic_attention
from ..dimensions import Dimensions, load_sim
from ..layout import split
from .base import AttnRequest, AttnResult, GenRequest, SteeringBackend

SENTENCE_END = (".", "!", "?", '."', '!"', '?"', "”")


class SimWriter:
    """Sentences from pools. Deterministic for a given seed."""

    def __init__(self, pools: dict[str, Any], dims: Dimensions) -> None:
        self.pools = pools
        self.dims = dims

    def _pole(self, rng: random.Random, name: str, dials: dict[str, float], default: str | None = None) -> str:
        """Pick a pole of a dimension, weighted by where its dial sits."""
        dim = self.dims.get(name)
        if dim is None:
            return default or ""
        value = dials.get(name)
        names = [p.name for p in dim.poles]
        if value is None:
            return default if default is not None else rng.choice(names)
        weights = dim.weights(value)
        if dim.kind == "bipolar":
            # the far pole still turns up, less and less, as the dial moves away from it
            strength = max(weights.values(), default=0.0)
            near = max(weights, key=weights.get) if weights else rng.choice(names)
            far = names[1] if near == names[0] else names[0]
            return near if rng.random() < 0.5 + strength / 2 else far
        return rng.choices(list(weights), weights=list(weights.values()))[0]

    def _strength(self, name: str, pole: str, dials: dict[str, float]) -> float:
        dim = self.dims.get(name)
        value = dials.get(name)
        if dim is None or value is None:
            return 0.0
        return dim.weights(value).get(pole, 0.0)

    def sentence(self, rng: random.Random, dials: dict[str, float], pins: list, pinned_last: bool = False) -> tuple[str, bool, str]:
        """One sentence, whether it was a pin coming back, and its core (what makes two sentences "the same")."""
        p = self.pools
        if not pinned_last:
            for pin in pins:
                if rng.random() < 0.05 + 0.3 * pin.weight:
                    phrase = " ".join(pin.text.split()).strip(" .,;:!?\"'")
                    if phrase:
                        out = rng.choice(p["pins"]).replace("{pin}", phrase)
                        return out[0].upper() + out[1:], True, out

        surprise = dials.get("surprise")
        if surprise is not None:
            kind = "unexpected" if surprise > 0.5 else "expected"
            if rng.random() < 0.35 * self._strength("surprise", kind, dials):
                event = rng.choice(p["events"][kind])
                return event, False, event
        elif rng.random() < 0.06:
            event = rng.choice(p["events"]["expected"])
            return event, False, event

        mode = self._pole(rng, "mode", dials)
        tension = self._pole(rng, "tension", dials)
        focus = self._pole(rng, "focus", dials, default="character")
        tone = self._pole(rng, "tone", dials)
        expansive = self._strength("pace", "expansive", dials)
        compressed = self._strength("pace", "compressed", dials)

        if mode == "dialogue":
            core = rng.choice(p["dialogue"][tension])
            body = f"\"{core},\" {rng.choice(p['dialogue']['said'][focus])}"
        else:
            core = rng.choice(p["predicates"][mode][tension])
            body = f"{rng.choice(p['subjects'][focus])} {core}"
            if rng.random() < 0.15 + 0.8 * expansive - 0.15 * compressed:
                # a name keeps its capital after an opener; "She" and "The girl" do not
                if body.split(" ", 1)[0] != "Elara":
                    body = body[0].lower() + body[1:]
                body = rng.choice(p["openers"]) + body
        if rng.random() < 0.6 + 0.4 * expansive - 0.6 * compressed:
            body += rng.choice(p["tails"][tone])
        return body + ".", False, core

    def text(self, seed: int, dials: dict[str, float], pins: list, so_far: str, max_tokens: int) -> str:
        rng = random.Random(seed)
        out = ""
        stripped = so_far.rstrip()
        if stripped and not stripped.endswith(SENTENCE_END):
            # the prefix was cut mid-sentence: close it before starting another
            tone = self._pole(rng, "tone", dials)
            out += rng.choice(self.pools["tails"][tone]) + "."
        in_paragraph = 0 if so_far.endswith("\n") else 2
        compressed = self._strength("pace", "compressed", dials)
        # the pools are small: remember only enough to stop a sentence following itself
        used: list[str] = []
        pinned = False
        while len(split(out)) < max_tokens:
            for _ in range(8):
                sentence, was_pin, core = self.sentence(rng, dials, pins, pinned)
                if core not in used:
                    break
            used.append(core)
            del used[:-3]
            pinned = was_pin
            if in_paragraph >= rng.randint(3, 5) - round(compressed):
                out += "\n\n" + sentence
                in_paragraph = 1
            else:
                lead = "" if (not out and (not so_far or so_far.endswith("\n"))) else " "
                out += lead + sentence
                in_paragraph += 1
        return out


class SimBackend(SteeringBackend):
    name = "sim"
    tier = "sim"
    attention_source = "heuristic"

    def __init__(self, dims: Dimensions, *, tok_s: float = 600.0, ttft_ms: float = 40.0, sim_file: str | None = None) -> None:
        super().__init__(dims)
        self.writer = SimWriter(load_sim(sim_file), dims)
        self.tok_s = tok_s
        self.ttft_ms = ttft_ms

    def pin_level(self, weight: float) -> float:
        return round(weight * 4) / 4

    async def generate(self, req: GenRequest) -> AsyncIterator[list[str]]:
        self.inflight += 1
        try:
            if self.ttft_ms > 0:
                await asyncio.sleep(self.ttft_ms / 1000)
            so_far = "".join(req.tokens)
            text = self.writer.text(req.seed, req.dials, req.pins, so_far, req.max_tokens)
            tokens = split(text)[: req.max_tokens]
            if self.tok_s <= 0:
                yield tokens
                return
            # a real stream delivers a few tokens per network read; so does this
            loop = asyncio.get_running_loop()
            start = loop.time()
            sent = 0
            while sent < len(tokens):
                due = min(len(tokens), int((loop.time() - start) * self.tok_s) + 1)
                if due > sent:
                    yield tokens[sent:due]
                    sent = due
                await asyncio.sleep(max(0.001, 1.0 / self.tok_s))
        finally:
            self.inflight -= 1

    async def attention(self, req: AttnRequest) -> AttnResult:
        return await heuristic_attention(req)
