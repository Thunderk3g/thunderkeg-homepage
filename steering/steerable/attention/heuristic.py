"""A focus monitor with no model behind it.

It is not attention. It scores each earlier token by how much the words being
written now echo it (shared words and stems, rarer words counting for more),
adds a little for recency and adds the weight of any pin. It exists so the
gutter has something honest to draw when neither a proxy model nor the
generating model's own attention is available, and it is labelled `heuristic`
wherever it is shown.

The web app has the same function in src/steer/attention.ts.
"""

from __future__ import annotations

import math
import re

from ..backends.base import AttnRequest, AttnResult

_WORD = re.compile(r"[^\W\d_]+(?:'[^\W\d_]+)?", re.UNICODE)
STOP = frozenset(
    "a an and are as at be been but by did do for from had has have he her him his i if in into is it its "
    "me my no not of on or our she so that the their them then there they this to up was we were what when "
    "which who will with would you your".split()
)
RECENCY_SPAN = 40.0
RECENCY_WEIGHT = 0.12
STOP_WEIGHT = 0.05
STEM_MATCH = 0.5


def word_of(token: str) -> str:
    m = _WORD.search(token)
    return m.group(0).lower() if m else ""


def heuristic_scores(tokens: list[str], pins: list, window: int = 24) -> list[float]:
    n = len(tokens)
    if n == 0:
        return []
    words = [word_of(t) for t in tokens]
    counts: dict[str, int] = {}
    for w in words:
        if w:
            counts[w] = counts.get(w, 0) + 1
    head = max(0, n - window)
    query = [w for w in words[head:] if w and w not in STOP]
    q_words = set(query)
    q_stems = {w[:4] for w in query if len(w) >= 5}

    scores = [0.0] * n
    for i, w in enumerate(words):
        if not w:
            continue
        s = RECENCY_WEIGHT * math.exp(-(n - 1 - i) / RECENCY_SPAN)
        if i < head:
            if w in q_words:
                match = 1.0
            elif len(w) >= 5 and w[:4] in q_stems:
                match = STEM_MATCH
            else:
                match = 0.0
            s += match / math.sqrt(counts[w])
        if w in STOP:
            s *= STOP_WEIGHT
        scores[i] = s
    for pin in pins:
        for i in range(max(0, pin.start), min(n, pin.end)):
            if words[i]:
                scores[i] += pin.weight
    top = max(scores)
    if top <= 0:
        return scores
    return [round(s / top, 4) for s in scores]


async def heuristic_attention(req: AttnRequest) -> AttnResult:
    return AttnResult(tok_scores=heuristic_scores(req.tokens, req.pins, req.window), source="heuristic")
