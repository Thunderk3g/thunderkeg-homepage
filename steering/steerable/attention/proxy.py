"""A focus monitor for Tier A: a small open model reads the text the API wrote.

A hosted API does not expose attention, so a stand-in model is run over the
visible text and its attention is read exactly as Tier B reads its own (the
readout in readout.py is the same code): what the last few tokens attend to,
over the middle layers, one score per display token.

It is an approximation twice over, and is labelled `proxy:<model>` wherever
it is shown. The proxy is not the model that is writing, so its attention says
what a reader of the text would look back at, not what the writer did. And a
pin cannot bias a hosted model's attention, nor is the proxy's own attention
biased here; a pin is shown by adding its weight to the scores of the pinned
tokens before the scores are scaled to a top of 1. That marks where the lock
sits on the page. It is a display convention, not a measurement.
"""

from __future__ import annotations

import asyncio

from ..backends.base import AttnRequest, AttnResult
from .readout import Runner, normalise


class ProxyAttention:
    def __init__(self, model_name: str, device: str = "auto", dtype: str = "auto") -> None:
        self.source = f"proxy:{model_name}"
        self.lm = Runner(model_name, device, dtype)

    def _scores(self, req: AttnRequest) -> list[float]:
        scores = self.lm.focus(req.tokens, req.window, req.anchor)
        for pin in req.pins:
            for i in range(max(0, pin.start), min(len(scores), pin.end)):
                if req.tokens[i].strip():
                    scores[i] += pin.weight
        return [round(s, 4) for s in normalise(scores)]

    async def attention(self, req: AttnRequest) -> AttnResult:
        return AttnResult(tok_scores=await asyncio.to_thread(self._scores, req), source=self.source)
