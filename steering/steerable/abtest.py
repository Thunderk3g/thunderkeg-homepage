"""A blind A/B sheet for attention locks.

    python -m steerable.abtest --pin "hidden" --samples 10 --out ab

The acceptance test for a pin is a human one: across ten samples, can a reader
who does not know which is which tell the continuation written with the phrase
pinned from the one written without? This writes the sheet (`ab.md`: pairs in
random order, unlabelled) and the key (`ab.key.json`) for whichever backend
STEER_BACKEND selects. Each pair shares its seed, so the pin is the only
difference between the two requests.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import random
import sys
from pathlib import Path

from .backends import GenRequest, PinSpec, make_backend
from .config import Settings
from .dimensions import load_dimensions


async def build(pin: str, samples: int, weight: float, tokens: int, task_id: str | None) -> tuple[str, dict]:
    settings = Settings()
    dims = load_dimensions(settings.dimensions)
    backend = make_backend(settings, dims)
    task = dims.task(task_id)
    text = task.seed if task else ""
    prefix = backend.split(text)
    joined = "".join(prefix)
    at = joined.find(pin)
    if at < 0:
        raise SystemExit(f"the phrase {pin!r} is not in the seed text of task {task.id if task else None!r}")
    # the display tokens the phrase covers
    start = end = None
    pos = 0
    for i, tok in enumerate(prefix):
        if start is None and pos + len(tok) > at:
            start = i
        if pos < at + len(pin):
            end = i + 1
        pos += len(tok)
    spec = PinSpec(start or 0, end or 1, backend.pin_level(weight), pin)

    async def one(seed: int, pins: list[PinSpec]) -> str:
        out: list[str] = []
        req = GenRequest(tokens=prefix, anchor=len(prefix), dials={}, pins=pins, max_tokens=tokens, seed=seed, task=task.id if task else None)
        async for chunk in backend.generate(req):
            out += chunk
        return "".join(out).strip()

    rng = random.Random(len(pin) * 7919 + samples)
    sheet = [f"# Blind A/B: is one of each pair pulled toward “{pin}”?\n", f"Seed text:\n\n> {text.replace(chr(10), chr(10) + '> ')}\n"]
    key: dict = {"pin": pin, "weight": weight, "backend": backend.name, "model": backend.model, "pairs": []}
    try:
        for n in range(1, samples + 1):
            seed = rng.randrange(2**31)
            pinned, plain = await asyncio.gather(one(seed, [spec]), one(seed, []))
            flip = rng.random() < 0.5
            a, b = (pinned, plain) if flip else (plain, pinned)
            sheet.append(f"## Pair {n}\n\n**A**\n\n{a}\n\n**B**\n\n{b}\n\nPinned: A / B / cannot tell\n")
            key["pairs"].append({"pair": n, "pinned": "A" if flip else "B", "seed": seed})
    finally:
        await backend.aclose()
    return "\n".join(sheet), key


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="steerable.abtest", description=__doc__.split("\n\n")[0])
    ap.add_argument("--pin", required=True, help="a phrase from the task's seed text")
    ap.add_argument("--samples", type=int, default=10)
    ap.add_argument("--weight", type=float, default=0.9)
    ap.add_argument("--tokens", type=int, default=90, help="display tokens per continuation")
    ap.add_argument("--task", default=None)
    ap.add_argument("--out", default="ab", help="writes <out>.md and <out>.key.json")
    args = ap.parse_args(argv)
    sheet, key = asyncio.run(build(args.pin, args.samples, args.weight, args.tokens, args.task))
    Path(f"{args.out}.md").write_text(sheet, encoding="utf-8")
    Path(f"{args.out}.key.json").write_text(json.dumps(key, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {args.out}.md ({args.samples} pairs) and {args.out}.key.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
