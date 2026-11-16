"""Tier A steering: the dial values and pins, compiled into a prompt.

A hosted API exposes neither activations nor attention, so the only handle is
the text of the request. Each set dial becomes one line of a style block; each
pin becomes one line of a keep-in-focus list. The effect is coarse next to a
control vector, which is exactly the limitation the two tiers exist to name.
"""

from __future__ import annotations

from .backends.base import GenRequest, PinSpec
from .dimensions import Dimension, Dimensions, adverb

#: weights below this are noise in a blend and are left out of the prompt
MIN_SHARE = 0.1


def style_line(dim: Dimension, value: float) -> str | None:
    weights = dim.weights(value)
    if not weights:
        return None
    ranked = sorted(weights.items(), key=lambda kv: -kv[1])
    if dim.kind == "bipolar":
        pole, strength = ranked[0]
        return f"{dim.name}: {adverb(strength)} {pole} ({round(strength * 100)}%) — {dim.pole(pole).prompt}"
    ranked = [(p, w) for p, w in ranked if w >= MIN_SHARE]
    if len(ranked) == 1:
        pole = ranked[0][0]
        return f"{dim.name}: {pole} — {dim.pole(pole).prompt}"
    (a, wa), (b, wb) = ranked[0], ranked[1]
    if abs(wa - wb) < 0.02:
        return f"{dim.name}: an even blend of {a} and {b} — {a}: {dim.pole(a).prompt}; {b}: {dim.pole(b).prompt}"
    return (
        f"{dim.name}: mostly {a} ({round(wa * 100)}%) with some {b} ({round(wb * 100)}%) — "
        f"{a}: {dim.pole(a).prompt}; {b}: {dim.pole(b).prompt}"
    )


def pin_emphasis(weight: float) -> str:
    if weight < 0.34:
        return "keep lightly in mind"
    if weight < 0.67:
        return "keep in focus"
    return "must stay central"


def style_block(dims: Dimensions, dials: dict[str, float], pins: list[PinSpec]) -> str:
    parts: list[str] = []
    lines = [line for d in dims if d.name in dials and (line := style_line(d, dials[d.name]))]
    if lines:
        parts.append(
            "STEERING (apply to everything you write next; where two lines pull apart, honour both):\n"
            + "\n".join(f"- {line}" for line in lines)
        )
    seen: set[str] = set()
    focus: list[str] = []
    for pin in sorted(pins, key=lambda p: -p.weight):
        text = " ".join(pin.text.split())
        if text and text.lower() not in seen:
            seen.add(text.lower())
            focus.append(f'- "{text}" ({pin_emphasis(pin.weight)})')
    if focus:
        parts.append(
            "KEEP IN FOCUS (the reader's attention is locked on these phrases from the text; "
            "let what you write next stay with them, return to them or build on them):\n" + "\n".join(focus)
        )
    return "\n\n".join(parts)


def system_prompt(dims: Dimensions, req: GenRequest, words: int) -> str:
    task = dims.task(req.task)
    framing = task.framing if task and task.framing else "You are continuing a piece of writing."
    rules = (
        f"{framing}\n\n"
        "Continue the text from exactly where it stops, as if you were the same writer mid-flow. "
        "Output only the continuation: no preamble, no repetition of the existing text, no commentary, "
        "no headings, no markdown. If the text stops mid-sentence, finish that sentence first. "
        f"Write about {words} words and end on a complete sentence."
    )
    block = style_block(dims, req.dials, req.pins)
    return f"{rules}\n\n{block}" if block else rules


def chat_messages(dims: Dimensions, req: GenRequest) -> list[dict[str, str]]:
    # a display token is about one word
    words = max(20, int(req.max_tokens * 0.9))
    text = "".join(req.tokens)
    return [
        {"role": "system", "content": system_prompt(dims, req, words)},
        {"role": "user", "content": f"<text>\n{text}\n</text>\n\nContinue the text from exactly where it stops."},
    ]


def completion_prompt(dims: Dimensions, req: GenRequest) -> str:
    """For a raw completion endpoint: the steering as a header, then the text itself."""
    block = style_block(dims, req.dials, req.pins)
    text = "".join(req.tokens)
    return f"[{block}]\n\n{text}" if block else text
