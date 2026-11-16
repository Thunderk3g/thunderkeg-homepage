"""The latency harness: replay a recorded gesture sequence and measure it.

    python -m steerable.replay gestures/knob_steps.json              # in-process, backend from STEER_BACKEND
    python -m steerable.replay gestures/rapid_100.json --url ws://127.0.0.1:8017/ws
    python -m steerable.replay --synth                               # rewrite the bundled gesture files

A gesture file is JSON: a seed text and a list of client messages, each with
`t`, milliseconds after the seed's first text has settled. The canvas can
record one from a real hand (the `rec` control in its footer).

What is measured, per gesture that changed the text:

    latency   from sending the gesture to the first tokens of the branch it
              opened (for a backward scrub: to the truncation). This is
              gesture-to-text as the wire sees it; a browser adds one frame.
    burst     the same, counted from the first gesture since the text last
              changed. A hand moving faster than the debounce produces
              gestures that are folded into a later one; this is what those
              cost.

and, for the whole run, whether any token arrived for a branch that was no
longer current (it must be zero), the cache hit rate, and the engine's own
count of requests that outlived a cancel (also zero).
"""

from __future__ import annotations

import argparse
import asyncio
import json
import math
import random
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Awaitable, Callable

from . import protocol as P
from .engine import percentile

CONTROL = {"set_dial", "pin", "unpin", "reroll"}
GESTURES = Path(__file__).resolve().parent.parent / "gestures"
STORY = (
    "Elara had kept the key hidden for eleven years, and tonight she finally carried it up the hill.\n\n"
    "Shadows stretched across the path as the last of the light went out of the valley."
)


@dataclass
class Run:
    """The client side of a session, with a stopwatch on every gesture."""

    tokens: list[str] = field(default_factory=list)
    branch: str | None = None
    violations: list[str] = field(default_factory=list)
    sent: dict[int, tuple[float, str]] = field(default_factory=dict)
    latency: dict[int, float] = field(default_factory=dict)
    burst: dict[int, float] = field(default_factory=dict)
    cached: dict[int, bool] = field(default_factory=dict)
    #: branch id -> the seq that opened it, until its first tokens arrive
    waiting: dict[str, int] = field(default_factory=dict)
    forward: int | None = None
    #: gestures that asked for different text (a dial crossing into a new quantum, a pin, a scrub)
    asking: set[int] = field(default_factory=set)
    quantised: dict[str, float | None] = field(default_factory=dict)
    last_answered: int = -1
    state: P.State | None = None
    telemetry: P.Telemetry | None = None
    config: P.Config | None = None
    errors: list[str] = field(default_factory=list)
    last_recv = 0.0

    def on_send(self, seq: int, kind: str, body: dict[str, Any], now: float) -> None:
        self.sent[seq] = (now, kind)
        if kind == "scrub" and body.get("position_tok", 0) > len(self.tokens):
            self.forward = seq
        if kind == "set_dial":
            # the client knows each dial's quanta, so it knows whether this move asked for anything
            steps = next((d["steps"] for d in (self.config.dimensions if self.config else []) if d["name"] == body.get("dim")), None)
            value = body.get("value")
            q = None if value is None else (round(value * steps) / steps if steps else value)
            if self.quantised.get(body.get("dim")) != q or body.get("dim") not in self.quantised:
                self.asking.add(seq)
            self.quantised[body.get("dim")] = q
        elif kind in CONTROL or kind == "scrub":
            self.asking.add(seq)

    def _answer(self, seq: int, now: float) -> None:
        if seq not in self.sent:
            return
        self.latency[seq] = (now - self.sent[seq][0]) * 1000
        first = next((s for s in sorted(self.asking) if self.last_answered < s <= seq), seq)
        self.burst[seq] = (now - self.sent[first][0]) * 1000
        self.last_answered = seq

    def on_recv(self, msg: P.ServerMsg, now: float) -> None:
        self.last_recv = now
        if isinstance(msg, P.Invalidate):
            if msg.from_tok > len(self.tokens):
                self.violations.append(f"invalidate past the end ({msg.from_tok} > {len(self.tokens)})")
            del self.tokens[msg.from_tok :]
            self.branch = msg.branch_id
            if msg.cause_seq is not None:
                if msg.reason == "scrub":
                    self._answer(msg.cause_seq, now)
                elif msg.reason == "switch":
                    self.waiting[msg.branch_id] = msg.cause_seq
                    self.cached[msg.cause_seq] = msg.cached
        elif isinstance(msg, P.Tokens):
            if msg.branch_id != self.branch:
                self.violations.append(f"stale tokens for {msg.branch_id} while on {self.branch}")
                return
            if msg.from_tok != len(self.tokens):
                self.violations.append(f"gap: tokens at {msg.from_tok}, text is {len(self.tokens)} long")
                return
            self.tokens.extend(msg.tokens)
            seq = self.waiting.pop(msg.branch_id, None)
            if seq is not None:
                self._answer(seq, now)
            elif self.forward is not None:
                self._answer(self.forward, now)
            self.forward = None
        elif isinstance(msg, P.State):
            self.state = msg
        elif isinstance(msg, P.Telemetry):
            self.telemetry = msg
        elif isinstance(msg, P.Config):
            self.config = msg
        elif isinstance(msg, P.Error):
            self.errors.append(msg.message)

    def report(self, name: str, elapsed: float) -> dict[str, Any]:
        controls = [s for s, (_, kind) in self.sent.items() if kind in CONTROL or kind == "scrub"]
        asked = len(self.asking)
        lat = [self.latency[s] for s in sorted(self.latency)]
        burst = [self.burst[s] for s in sorted(self.burst)]
        switched = [s for s in self.cached]
        t = self.telemetry
        return {
            "gestures": name,
            "backend": self.config.backend if self.config else None,
            "model": self.config.model if self.config else None,
            "sent": len(controls),
            "asked_for_a_change": asked,
            "answered": len(lat),
            "folded": max(0, asked - len(lat)),
            "latency_ms": {"p50": round(percentile(lat, 0.5), 1), "p95": round(percentile(lat, 0.95), 1), "max": round(max(lat, default=0.0), 1)},
            "burst_ms": {"p50": round(percentile(burst, 0.5), 1), "p95": round(percentile(burst, 0.95), 1), "max": round(max(burst, default=0.0), 1)},
            "branch_switches": len(switched),
            "served_from_cache": sum(1 for s in switched if self.cached[s]),
            "hit_rate": round(sum(1 for s in switched if self.cached[s]) / len(switched), 3) if switched else 0.0,
            "stale_tokens": len(self.violations),
            "violations": self.violations[:5],
            "orphans": t.orphans if t else None,
            "inflight_at_end": t.inflight if t else None,
            "speculative_branches": t.sim if t else None,
            "requests_cancelled": t.cancelled if t else None,
            "tok_s": t.tok_s if t else None,
            "final_tokens": len(self.tokens),
            "errors": self.errors[:5],
            "seconds": round(elapsed, 2),
        }


def render(report: dict[str, Any]) -> str:
    lat, burst = report["latency_ms"], report["burst_ms"]
    lines = [
        f"{report['gestures']}  ·  backend {report['backend']}" + (f" ({report['model']})" if report["model"] else ""),
        f"  gestures sent        {report['sent']}  ({report['asked_for_a_change']} asked for different text; {report['answered']} were shown, {report['folded']} were overtaken by the next)",
        f"  gesture-to-text      p50 {lat['p50']} ms   p95 {lat['p95']} ms   max {lat['max']} ms",
        f"  from start of burst  p50 {burst['p50']} ms   p95 {burst['p95']} ms   max {burst['max']} ms",
        f"  branch switches      {report['branch_switches']}, {report['served_from_cache']} from cache (hit rate {report['hit_rate']:.0%})",
        f"  speculative branches {report['speculative_branches']}   requests cancelled {report['requests_cancelled']}   tok/s {report['tok_s']}",
        f"  stale tokens         {report['stale_tokens']}   orphaned requests {report['orphans']}   in flight at end {report['inflight_at_end']}",
    ]
    if report["errors"]:
        lines.append(f"  errors               {report['errors']}")
    return "\n".join(lines)


async def replay(
    gestures: dict[str, Any],
    send: Callable[[dict[str, Any]], Awaitable[None]],
    run: Run,
    *,
    clock: Callable[[], float] = time.perf_counter,
    quiet_s: float = 0.4,
) -> float:
    """Send the seed, wait for it to settle, then play the events on their own clock."""

    async def settled(timeout: float) -> None:
        end = clock() + timeout
        while clock() < end:
            await asyncio.sleep(0.02)
            if run.state is not None and not run.state.generating and clock() - run.last_recv > quiet_s:
                return

    started = clock()
    await send({"type": "seed", "text": gestures.get("seed", STORY), "task": gestures.get("task"), "seq": 0})
    run.on_send(0, "seed", {}, clock())
    await settled(float(gestures.get("lead_s", 20)))
    origin = clock()
    for i, event in enumerate(gestures["events"], start=1):
        body = {k: v for k, v in event.items() if k != "t"}
        wait = origin + event["t"] / 1000 - clock()
        if wait > 0:
            await asyncio.sleep(wait)
        body["seq"] = i
        run.on_send(i, body["type"], body, clock())
        await send(body)
    await settled(30)
    return clock() - started


async def run_inprocess(gestures: dict[str, Any], **overrides: Any) -> dict[str, Any]:
    from .backends import make_backend
    from .config import Settings
    from .dimensions import load_dimensions
    from .engine import Engine

    settings = Settings(**overrides)
    dims = load_dimensions(settings.dimensions)
    backend = make_backend(settings, dims)
    run = Run()
    engine = Engine(backend, dims, settings, lambda m: run.on_recv(m, time.perf_counter()), strict=True)
    engine.start()

    async def send(body: dict[str, Any]) -> None:
        engine.handle(P.client_msg.validate_python(body))

    try:
        elapsed = await replay(gestures, send, run)
        run.telemetry = engine.telemetry()
        if run.tokens != engine._slice(0, engine.visible):
            run.violations.append("the client's text is not the engine's at the end of the run")
    finally:
        await engine.close()
        await backend.aclose()
    return run.report(gestures.get("name", "gestures"), elapsed)


async def run_ws(gestures: dict[str, Any], url: str) -> dict[str, Any]:
    import websockets
    from pydantic import TypeAdapter

    server_msg: TypeAdapter[P.ServerMsg] = TypeAdapter(P.ServerMsg)  # type: ignore[type-arg]
    run = Run()
    async with websockets.connect(url, max_size=None) as ws:

        async def reader() -> None:
            async for raw in ws:
                data = json.loads(raw)
                model = {
                    "tokens": P.Tokens, "attention": P.Attention, "invalidate": P.Invalidate, "telemetry": P.Telemetry,
                    "state": P.State, "config": P.Config, "error": P.Error,
                }.get(data.get("type"))
                if model is not None:
                    run.on_recv(model.model_validate(data), time.perf_counter())

        task = asyncio.create_task(reader())
        try:
            elapsed = await replay(gestures, lambda body: ws.send(json.dumps(body)), run)
            await asyncio.sleep(0.4)  # one more telemetry tick
        finally:
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)
    del server_msg
    return run.report(gestures.get("name", "gestures"), elapsed)


# ───────────────────────── synthetic hands ─────────────────────────


def _ease(x: float) -> float:
    return 0.5 - 0.5 * math.cos(math.pi * x)


def synth() -> dict[str, dict[str, Any]]:
    """Gesture files that stand in for a hand, for when nobody has recorded one. Deterministic."""
    rng = random.Random(1368)
    files: dict[str, dict[str, Any]] = {}

    # 100 dial changes, as fast and as irregular as a careless hand: the stale-token test
    t, events = 0.0, []
    for i in range(100):
        dim = ("tone", "pace", "tension", "surprise", "focus", "mode")[rng.randrange(6)]
        events.append({"t": round(t), "type": "set_dial", "dim": dim, "value": round(rng.random(), 3)})
        t += rng.choice([4, 8, 12, 16, 25, 40, 70])
    files["rapid_100"] = {"name": "rapid_100", "description": "100 dial changes 4-70 ms apart across all six dials", "events": events}

    # one dial stepped a quantum at a time with a human dwell: what speculation is for
    t, events, step = 0.0, [], 3
    for _ in range(40):
        step = min(6, max(0, step + rng.choice([-1, 1])))
        events.append({"t": round(t), "type": "set_dial", "dim": "pace", "value": round(step / 6, 4)})
        t += rng.uniform(280, 650)
    files["knob_steps"] = {"name": "knob_steps", "description": "pace stepped one quantum at a time, 280-650 ms apart", "events": events}

    # continuous sweeps sampled like pointer events (60 Hz)
    t, events = 0.0, []
    for dim, a, b, ms in [("tone", 0.0, 1.0, 1400), ("tone", 1.0, 0.4, 700), ("tension", 0.5, 1.0, 500), ("pace", 0.5, 0.0, 600), ("mode", 0.0, 0.66, 900), ("tension", 1.0, 0.2, 800)]:
        frames = int(ms / 16.7)
        for f in range(frames + 1):
            events.append({"t": round(t + f * 16.7), "type": "set_dial", "dim": dim, "value": round(a + (b - a) * _ease(f / frames), 4)})
        t += ms + rng.uniform(250, 500)
    files["dial_sweep"] = {"name": "dial_sweep", "description": "six continuous sweeps at pointer-event rate, with pauses", "events": events}

    # the main knob: back, forward, a dial, back again, and a pin on the way
    t, events = 0.0, []
    seed_len = 33  # display tokens in the story seed
    pos = seed_len + 120
    def drag(to: int, ms: float) -> None:
        nonlocal t, pos
        frames = max(1, int(ms / 16.7))
        start = pos
        for f in range(1, frames + 1):
            p = round(start + (to - start) * _ease(f / frames))
            if p != pos:
                pos = p
                events.append({"t": round(t + f * 16.7), "type": "scrub", "position_tok": pos})
        t += ms
    for _ in range(4):
        drag(seed_len + rng.randrange(20, 70), 500)
        t += rng.uniform(200, 400)
        drag(seed_len + 120, 400)
        t += rng.uniform(150, 300)
        drag(seed_len + rng.randrange(30, 80), 450)
        t += 200
        events.append({"t": round(t), "type": "set_dial", "dim": rng.choice(["tone", "tension"]), "value": round(rng.randrange(0, 7) / 6, 4)})
        t += rng.uniform(500, 800)
        pos = pos + 120
    events.insert(len(events) // 2, {"t": events[len(events) // 2]["t"], "type": "pin", "start_tok": 5, "end_tok": 7, "weight": 0.8, "id": "key"})
    files["scrub_explore"] = {"name": "scrub_explore", "description": "scrub back and forward, change a dial at the new point, pin a phrase", "events": events}
    for f in files.values():
        f["seed"] = STORY
        f["task"] = "story"
    return files


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="steerable.replay", description=__doc__.split("\n\n")[0])
    ap.add_argument("gestures", nargs="*", help="gesture files to replay")
    ap.add_argument("--url", help="replay against a running server (ws://host:port/ws) instead of in-process")
    ap.add_argument("--json", help="also write the reports to this file")
    ap.add_argument("--synth", action="store_true", help="write the bundled synthetic gesture files and exit")
    ap.add_argument("--p50", type=float, default=None, help="fail if gesture-to-text p50 exceeds this many ms")
    ap.add_argument("--p95", type=float, default=None, help="fail if gesture-to-text p95 exceeds this many ms")
    args = ap.parse_args(argv)

    if args.synth:
        GESTURES.mkdir(exist_ok=True)
        for name, body in synth().items():
            (GESTURES / f"{name}.json").write_text(json.dumps(body, indent=1) + "\n", encoding="utf-8")
            print(f"wrote gestures/{name}.json  ({len(body['events'])} events)")
        return 0
    if not args.gestures:
        ap.error("give at least one gesture file, or --synth")

    reports, failed = [], False
    for path in args.gestures:
        gestures = json.loads(Path(path).read_text(encoding="utf-8"))
        gestures.setdefault("name", Path(path).stem)
        report = asyncio.run(run_ws(gestures, args.url) if args.url else run_inprocess(gestures))
        reports.append(report)
        print(render(report), end="\n\n")
        lat = report["latency_ms"]
        if report["stale_tokens"] or report["orphans"] or report["inflight_at_end"]:
            failed = True
        if (args.p50 is not None and lat["p50"] > args.p50) or (args.p95 is not None and lat["p95"] > args.p95):
            failed = True
    if args.json:
        Path(args.json).write_text(json.dumps(reports, indent=1) + "\n", encoding="utf-8")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
