"""The generation engine: one per session.

The text is a path of display tokens with three marks on it:

    committed   everything before it is approved and never regenerated
    anchor      where regeneration starts when a control changes
    visible     how much of the path the client is showing

and a `target`: how far the engine writes before it idles.

A *branch* is one continuation of one prefix under one set of controls. Its key
is hash(prefix up to the anchor) + the quantised dial vector + the pin set (+
the sample number and the task), and branches live in an LRU. The rules:

  control change   cancel whatever is in flight at once, wait out the debounce
                   (none for the first change after a rest, or for a branch
                   already cached), send `invalidate`, then serve the branch
                   from the cache or generate it from the prefix.
  scrub backward   truncate the visible text at once and cancel ongoing work.
                   The dropped tail stays where it was, so scrubbing forward
                   again is served without a request.
  scrub forward    reveal what the path already holds; past its end, write more.
  idle             pre-generate the neighbouring quanta of the dial last
                   touched, so the next turn of that knob is a cache hit.

One exception to "cancel at once", for a hand that does not stop. If the
controls move on while the request for the current branch is still waiting for
its first token, cancelling it would throw away the wait and start another just
as long: a dial in motion would show nothing until it stopped. So that request
is left to land (for at most hold_ms). The moment its first tokens are on
screen it is cancelled and the branch for where the hand is now is opened. The
text then trails the hand by one time-to-first-token instead of waiting for it.

Everything that changes state is synchronous and messages are queued, never
awaited mid-change, so two control messages cannot interleave. Each stream of
tokens is tagged with an activation id that changes on every invalidate; a
client drops any `tokens` message that does not carry the current one.

Cancellation is the part that goes wrong in systems like this, so it is
counted: `inflight` is the number of generation coroutines alive, and before a
new branch starts the engine waits for the cancelled ones to finish and checks
that the count, and the backend's own count of open requests, is zero.
"""

from __future__ import annotations

import asyncio
import contextlib
import hashlib
import json
import logging
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Callable

from . import protocol as P
from .backends.base import AttnRequest, BackendError, GenRequest, PinSpec, SteeringBackend
from .cache import LRU
from .config import Settings
from .dimensions import Dimensions
from .layout import paragraphs, wrap

log = logging.getLogger("steerable.engine")

#: how long the controls must be still before neighbours are speculated
SPECULATE_AFTER_S = 0.12
TELEMETRY_EVERY_S = 0.25


@dataclass
class Branch:
    key: str
    dials: dict[str, float]
    pins: tuple[PinSpec, ...]
    tokens: list[str] = field(default_factory=list)
    #: the model ended the text itself; there is nothing more to ask for
    done: bool = False
    #: made by speculation and not shown yet
    speculative: bool = False


@dataclass
class PinRecord:
    id: str
    start: int
    end: int
    weight: float
    text: str


def _sha(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8")).hexdigest()


def percentile(values: list[float], q: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    k = (len(ordered) - 1) * q
    lo = int(k)
    hi = min(lo + 1, len(ordered) - 1)
    return ordered[lo] + (ordered[hi] - ordered[lo]) * (k - lo)


class Engine:
    def __init__(
        self,
        backend: SteeringBackend,
        dims: Dimensions,
        settings: Settings,
        send: Callable[[P.ServerMsg], None],
        *,
        strict: bool = False,
        clock: Callable[[], float] = time.perf_counter,
    ) -> None:
        self.backend = backend
        self.dims = dims
        self.s = settings
        self._send = send
        self.strict = strict
        self.clock = clock

        # the path
        self.prefix: list[str] = []
        self.active: Branch | None = None
        self.committed = 0
        self.anchor_pos = 0
        self.visible = 0
        self.target = 0
        self.following = True

        # the controls
        self.dials: dict[str, float | None] = {d.name: None for d in dims}
        self.pins: dict[str, PinRecord] = {}
        self.variant = 0
        self.task: str | None = None
        self.active_dim: str | None = None
        self.cols = settings.cols

        self.cache: LRU[str, Branch] = LRU(settings.cache_size)
        self.activation = 0
        self.branch_id = "none-0"

        # work
        self._gen_task: asyncio.Task | None = None
        #: speculative requests in flight, by the key of the branch each is writing
        self._spec_tasks: dict[str, asyncio.Task] = {}
        self._dying: set[asyncio.Task] = set()
        self._switch_handle: asyncio.TimerHandle | None = None
        self._switch_task: asyncio.Task | None = None
        self._spec_handle: asyncio.TimerHandle | None = None
        self._epoch = 0
        #: the branch the scheduled switch is heading for, and when its burst of changes began
        self._pending_key: str | None = None
        self._burst_at: float | None = None
        #: the controls have moved on, but the request in flight is being left to land first
        self._deferred = False
        self._hold_handle: asyncio.TimerHandle | None = None
        self._active_since = 0.0
        #: when a control change last asked for a branch that had to be generated
        self._changed_at = float("-inf")
        self._loops: list[asyncio.Task] = []
        self._dirty = asyncio.Event()
        self._attn_dirty = asyncio.Event()
        self._closed = False

        # counters
        self.inflight = 0
        self.orphans = 0
        self.steer = 0
        self.sim = 0
        self.cache_hits = 0
        self.cache_misses = 0
        self.cancelled = 0
        self._gesture_at: float | None = None
        self._gesture_seq: int | None = None
        self._latency_from: float | None = None
        self.latencies: deque[float] = deque(maxlen=500)
        self.latency_ms = 0.0
        self._rate: deque[tuple[float, int]] = deque()
        self.tok_s = 0.0
        self._last_telemetry: P.Telemetry | None = None

    # ───────────────────────── lifecycle ─────────────────────────

    def start(self) -> None:
        self._send(
            P.Config(
                backend=self.backend.name,
                tier=self.backend.tier,
                model=self.backend.model,
                attention_source=self.backend.attention_source,
                dimensions=[d.public(self.backend.tier) for d in self.dims],
                tasks=[t.public() for t in self.dims.tasks if self.backend.tier != "sim" or t.sim],
                horizon=self.s.horizon,
                cols=self.cols,
                frame_ms=self.s.frame_ms,
            )
        )
        self._emit_state()
        self._loops = [
            asyncio.create_task(self._pump(), name="steer-pump"),
            asyncio.create_task(self._attention_loop(), name="steer-attention"),
            asyncio.create_task(self._telemetry_loop(), name="steer-telemetry"),
        ]

    async def close(self) -> None:
        self._closed = True
        self._cancel_switch()
        self._cancel_work("close")
        if self._spec_handle:
            self._spec_handle.cancel()
        for t in self._loops:
            t.cancel()
        await asyncio.gather(*self._loops, *self._dying, return_exceptions=True)
        self._dying.clear()

    # ───────────────────────── the path ─────────────────────────

    def _len(self) -> int:
        return len(self.prefix) + (len(self.active.tokens) if self.active else 0)

    def _slice(self, start: int, end: int) -> list[str]:
        n = len(self.prefix)
        if end <= n:
            return self.prefix[start:end]
        tail = self.active.tokens if self.active else []
        if start >= n:
            return tail[start - n : end - n]
        return self.prefix[start:] + tail[: end - n]

    @property
    def anchor(self) -> int:
        return max(self.committed, min(self.anchor_pos, self.visible))

    @property
    def generating(self) -> bool:
        return self._gen_task is not None or self._switch_handle is not None or self._switch_task is not None

    # ───────────────────────── keys ─────────────────────────

    def _quantised(self) -> dict[str, float]:
        return self.dims.quantise(self.dials, self.backend.tier)

    def _pin_specs(self, upto: int) -> tuple[PinSpec, ...]:
        return tuple(
            PinSpec(p.start, p.end, self.backend.pin_level(p.weight), p.text)
            for p in sorted(self.pins.values(), key=lambda p: (p.start, p.end))
            if p.end <= upto
        )

    def _key(self, prefix_hash: str, dials: dict[str, float], pins: tuple[PinSpec, ...]) -> str:
        return _sha(
            json.dumps(
                [
                    prefix_hash,
                    sorted(dials.items()),
                    [(p.start, p.end, p.weight) for p in pins],
                    self.variant,
                    self.task,
                ]
            )
        )

    @staticmethod
    def _seed(key: str, offset: int) -> int:
        return int(_sha(f"{key}:{offset}")[:8], 16)

    # ───────────────────────── messages in ─────────────────────────

    def handle(self, msg: P.ClientMsg) -> None:
        if self._closed:
            return
        if isinstance(msg, P.SetDial):
            self.set_dial(msg.dim, msg.value, msg.pole, msg.seq)
        elif isinstance(msg, P.Pin):
            self.pin(msg.start_tok, msg.end_tok, msg.weight, msg.id, msg.seq)
        elif isinstance(msg, P.Unpin):
            self.unpin(msg.id, msg.seq)
        elif isinstance(msg, P.Scrub):
            self.scrub(msg.position_tok, msg.seq)
        elif isinstance(msg, P.Seed):
            self.seed(msg.text, msg.task, msg.cols, msg.seq)
        elif isinstance(msg, P.Stop):
            self.stop()
        elif isinstance(msg, P.Commit):
            self.commit()
        elif isinstance(msg, P.Reroll):
            self.reroll(msg.seq)
        elif isinstance(msg, P.Layout):
            self.cols = msg.cols
            self._attn_dirty.set()

    def seed(self, text: str, task: str | None = None, cols: int | None = None, seq: int | None = None) -> None:
        self._cancel_switch()
        self._cancel_work("seed")
        self.cache.clear()
        self.pins.clear()
        self.variant = 0
        self.task = task
        if cols:
            self.cols = cols
        tokens = self.backend.split(text.replace("\r\n", "\n").replace("\r", "\n"))[: self.s.max_tokens]
        self.prefix = tokens
        self.active = None
        self.committed = self.visible = self.anchor_pos = len(tokens)
        self.target = min(self.s.max_tokens, len(tokens) + self.s.horizon)
        self.following = True
        self.activation += 1
        self.branch_id = f"seed-{self.activation}"
        self._send(P.Invalidate(from_tok=0, branch_id=self.branch_id, cause_seq=seq, reason="seed"))
        if tokens:
            self._send(P.Tokens(branch_id=self.branch_id, from_tok=0, tokens=tokens))
        self._attn_dirty.set()
        self._gesture(seq)
        self._emit_state()
        self._pending_key = None
        self._schedule_switch(0.0)

    def set_dial(self, dim: str, value: float | None, pole: str | None = None, seq: int | None = None) -> None:
        d = self.dims.get(dim)
        if d is None:
            self._send(P.Error(message=f"unknown dimension {dim!r}"))
            return
        if pole is not None:
            try:
                value = d.pole_position(pole)
            except KeyError as err:
                self._send(P.Error(message=str(err)))
                return
        self.dials[dim] = value
        self.active_dim = dim
        self._controls_changed(seq)

    def pin(self, start: int, end: int, weight: float, pin_id: str | None = None, seq: int | None = None) -> None:
        existing = self.pins.get(pin_id) if pin_id else None
        if existing is not None:
            existing.weight = weight
        else:
            end = min(end, self.visible)
            text = "".join(self._slice(start, end)).strip()
            if start >= end or not text:
                self._send(P.Error(message="a pin must cover visible text"))
                return
            pin_id = pin_id or f"p{len(self.pins) + 1}-{self.activation}"
            self.pins[pin_id] = PinRecord(pin_id, start, end, weight, text)
            # pinning a phrase keeps it: regeneration starts after it, never over it
            self.anchor_pos = max(self.anchor, end)
        self._attn_dirty.set()
        self._controls_changed(seq)

    def unpin(self, pin_id: str, seq: int | None = None) -> None:
        if self.pins.pop(pin_id, None) is None:
            return
        self._attn_dirty.set()
        self._controls_changed(seq)

    def reroll(self, seq: int | None = None) -> None:
        self.variant += 1
        self._controls_changed(seq)

    def scrub(self, position: int, seq: int | None = None) -> None:
        length = self._len()
        # past the end of the text the knob asks for more, one horizon at a pull
        p = max(self.committed, min(position, self.s.max_tokens, max(length, self.target, length + self.s.horizon)))
        if p < self.visible:
            self._cancel_work("scrub back")
            self.visible = p
            self.anchor_pos = p
            self.following = False
            self.activation += 1
            self.branch_id = f"{self.branch_id.split('-')[0]}-{self.activation}"
            self._send(P.Invalidate(from_tok=p, branch_id=self.branch_id, cause_seq=seq, cached=True, reason="scrub"))
            self._attn_dirty.set()
            if self._deferred:
                # the request that was being left to land is gone; the change it was holding back still applies
                self._release_hold()
                self._schedule_switch(self.s.debounce_ms / 1000)
        else:
            self.anchor_pos = p
            upto = min(p, length)
            if upto > self.visible:
                self._send(P.Tokens(branch_id=self.branch_id, from_tok=self.visible, tokens=self._slice(self.visible, upto)))
                self.visible = upto
                self._attn_dirty.set()
            if p >= length:
                self.following = True
                self.target = max(self.target, p)
                if self._switch_handle is None and self._switch_task is None:
                    self._ensure_generation()
        self._emit_state()
        self._schedule_speculation()

    def commit(self) -> None:
        self.committed = self.anchor_pos = self.visible
        if self.visible == self._len():
            self.following = True
            self.target = min(self.s.max_tokens, self.visible + self.s.horizon)
            if self._switch_handle is None and self._switch_task is None:
                self._ensure_generation()
        self._emit_state()

    def stop(self) -> None:
        self._cancel_switch()
        self._cancel_work("stop")
        self.target = self._len()
        self._emit_state()

    # ───────────────────────── control changes ─────────────────────────

    def _gesture(self, seq: int | None) -> None:
        self._gesture_at = self.clock()
        self._gesture_seq = seq

    def _controls_changed(self, seq: int | None) -> None:
        self._emit_state()
        a = self.anchor
        key = self._key(_sha("".join(self._slice(0, a))), self._quantised(), self._pin_specs(a))
        settled = self._switch_handle is None and self._switch_task is None
        if settled and self.active is not None and key == self.active.key:
            # the dial moved inside its quantum, or came back to what is being written
            self._release_hold()
            return
        if key == self._pending_key and (not settled or self._deferred):
            # still heading for the same branch; a hand that keeps moving inside
            # one quantum must not keep postponing it
            return
        self._gesture(seq)
        self._pending_key = key
        held = self.cache.peek(key)
        hit = held is not None and bool(held.tokens)
        if not hit and settled and self._awaiting_first_token():
            # let the request in flight land before moving on (see the module docstring)
            self._deferred = True
            if self._hold_handle is None:
                wait = self._active_since + self.s.hold_ms / 1000 - self.clock()
                self._hold_handle = asyncio.get_running_loop().call_later(max(0.0, wait), self._move_on)
            return
        self._release_hold()
        # Whatever is in flight is for controls that no longer hold, with one
        # exception: a speculative request already writing the branch these
        # controls ask for is the head start speculation exists to give.
        self._cancel_work("control change", keep=key)
        # The debounce is there to spare requests that a moving hand would
        # waste. A branch already in the cache costs none, so it is shown now.
        # So is the first change after the controls have been at rest: nothing
        # is known yet about where the hand is going, and waiting only adds to
        # the time before the first new word.
        now = self.clock()
        rested = now - self._changed_at > self.s.debounce_max_ms / 1000
        self._changed_at = now
        self._schedule_switch(0.0 if hit or rested else self.s.debounce_ms / 1000)

    def _awaiting_first_token(self) -> bool:
        return self._gen_task is not None and self._latency_from is not None and self.following

    def _release_hold(self) -> None:
        self._deferred = False
        if self._hold_handle is not None:
            self._hold_handle.cancel()
            self._hold_handle = None

    def _move_on(self) -> None:
        """The held request has landed, failed or run out of time: open the branch the controls now ask for."""
        if not self._deferred or self._closed:
            self._release_hold()
            return
        self._release_hold()
        self._cancel_work("superseded", keep=self._pending_key)
        self._schedule_switch(0.0)

    def _schedule_switch(self, delay: float) -> None:
        """Debounce: wait for the controls to hold still, but never longer than debounce_max_ms."""
        self._epoch += 1
        if self._switch_handle is not None:
            self._switch_handle.cancel()
        loop = asyncio.get_running_loop()
        epoch = self._epoch
        now = loop.time()
        if self._burst_at is None:
            self._burst_at = now
        delay = max(0.0, min(delay, self._burst_at + self.s.debounce_max_ms / 1000 - now))

        def fire() -> None:
            self._switch_handle = None
            self._switch_task = asyncio.create_task(self._switch(epoch), name="steer-switch")

        self._switch_handle = loop.call_later(delay, fire)

    def _cancel_switch(self) -> None:
        self._epoch += 1
        self._pending_key = None
        self._burst_at = None
        self._release_hold()
        if self._switch_handle is not None:
            self._switch_handle.cancel()
            self._switch_handle = None

    async def _switch(self, epoch: int) -> None:
        try:
            await self._drain()
            if epoch != self._epoch or self._closed:
                return
            self._assert_quiet()
            self._pending_key = None
            self._burst_at = None
            self._release_hold()
            self._apply_switch()
        finally:
            if self._switch_task is asyncio.current_task():
                self._switch_task = None
        if epoch == self._epoch and not self._closed:
            self._emit_state()
            self._schedule_speculation()

    def _apply_switch(self) -> None:
        # a pin whose text is about to be replaced has nothing left to hold
        a = self.anchor
        for pin_id in [i for i, p in self.pins.items() if p.end > a]:
            del self.pins[pin_id]

        length = self._len()
        new_prefix = self._slice(0, a)
        prefix_hash = _sha("".join(new_prefix))
        dials = self._quantised()
        pins = self._pin_specs(a)
        key = self._key(prefix_hash, dials, pins)

        if self.active is not None and key == self.active.key:
            self._ensure_generation()
            return
        # a speculative request for any other branch should already be gone
        self._cancel_work("switch", keep=key)

        if self.active is not None and len(self.prefix) < a < length:
            # The text past the new anchor was written under the old controls.
            # Record it as the continuation of this prefix under those controls,
            # so turning the dial back finds it.
            alias = self._key(prefix_hash, self.active.dials, self.active.pins)
            if self.cache.peek(alias) is None:
                self._put(Branch(alias, dict(self.active.dials), self.active.pins, self._slice(a, length), self.active.done))

        branch = self.cache.get(key)
        cached = branch is not None and len(branch.tokens) > 0
        if branch is None:
            branch = Branch(key, dials, pins)
        if cached:
            self.cache_hits += 1
        else:
            self.cache_misses += 1
        branch.speculative = False

        self.prefix = new_prefix
        self.active = branch
        self._put(branch)
        self.visible = a
        self.anchor_pos = a
        self.following = True
        self.target = min(self.s.max_tokens, max(a + self.s.horizon, a + len(branch.tokens)))
        self.activation += 1
        self.branch_id = f"{key[:8]}-{self.activation}"
        self._send(P.Invalidate(from_tok=a, branch_id=self.branch_id, cause_seq=self._gesture_seq, cached=cached))
        self.steer += 1
        self._latency_from = self._gesture_at
        self._active_since = self.clock()
        self._rate.clear()
        self._attn_dirty.set()
        self._flush()
        # a speculative request still writing this branch carries on as its generation
        self._gen_task = self._spec_tasks.pop(key, None)
        self._ensure_generation()

    def _put(self, branch: Branch) -> None:
        keep = [self.active.key] if self.active else []
        self.cache.put(branch.key, branch, keep=keep)

    # ───────────────────────── generation ─────────────────────────

    def _ensure_generation(self) -> None:
        if self.active is None or self._gen_task is not None or not self.following:
            return
        if self.active.done or self._len() >= self.target:
            return
        limit = self.target - len(self.prefix)
        self._gen_task = asyncio.create_task(
            self._generate(self.active, list(self.prefix), limit, speculative=False), name="steer-generate"
        )

    async def _generate(self, branch: Branch, prefix: list[str], limit: int, *, speculative: bool) -> None:
        """Extend `branch` until it holds `limit` tokens."""
        task = asyncio.current_task()
        self.inflight += 1
        finished = False
        try:
            need = limit - len(branch.tokens)
            if need <= 0:
                finished = True
                return
            req = GenRequest(
                tokens=prefix + branch.tokens,
                anchor=len(prefix),
                dials=branch.dials,
                pins=list(branch.pins),
                max_tokens=need,
                seed=self._seed(branch.key, len(branch.tokens)),
                task=self.task,
            )
            got = 0
            async with contextlib.aclosing(self.backend.generate(req)) as stream:
                async for chunk in stream:
                    chunk = chunk[: need - got]
                    if not chunk:
                        break
                    branch.tokens.extend(chunk)
                    got += len(chunk)
                    if branch is self.active:
                        self._rate.append((self.clock(), len(chunk)))
                        self._dirty.set()
                    if got >= need:
                        break
            if got < need:
                branch.done = True
            finished = True
        except asyncio.CancelledError:
            raise
        except BackendError as err:
            log.warning("generation failed: %s", err)
            if not speculative:
                self._send(P.Error(message=str(err), retry_after=err.retry_after))
        except Exception as err:  # noqa: BLE001 - a backend fault must not take the session down
            log.exception("generation crashed")
            if not speculative:
                self._send(P.Error(message=f"generation failed: {err}"))
        finally:
            self.inflight -= 1
            if self._spec_tasks.get(branch.key) is task:
                del self._spec_tasks[branch.key]
            self._dying.discard(task)
            if self._gen_task is task:
                self._gen_task = None
            if branch is self.active and not self._closed:
                # the last tokens leave now, so the state that follows describes what the client holds
                self._flush()
                if self._deferred:
                    # it ended without showing anything (an error, an empty reply): nothing left to wait for
                    self._move_on()
                if finished:
                    # short of the target only when this began as a speculative request
                    self._ensure_generation()
                    if self._gen_task is None:
                        self._schedule_speculation()
                self._emit_state()

    def _cancel_work(self, reason: str, keep: str | None = None) -> None:
        """Cancel every request in flight, except a speculative one writing branch `keep`."""
        kept = self._spec_tasks.get(keep) if keep else None
        tasks = [t for t in (self._gen_task, *self._spec_tasks.values()) if t is not None and t is not kept and not t.done()]
        for t in tasks:
            t.cancel()
            self._dying.add(t)
        if tasks:
            self.cancelled += len(tasks)
            log.debug("cancelled %d request(s): %s", len(tasks), reason)
        self._gen_task = None
        self._spec_tasks = {keep: kept} if kept is not None and not kept.done() else {}
        if self._spec_handle is not None:
            self._spec_handle.cancel()
            self._spec_handle = None

    async def _drain(self) -> None:
        while self._dying:
            pending = list(self._dying)
            await asyncio.gather(*pending, return_exceptions=True)
            self._dying.difference_update(pending)

    def _assert_quiet(self) -> None:
        """After a cancel has been waited out, nothing may still be talking to the model."""
        allowed = sum(1 for t in (self._gen_task, *self._spec_tasks.values()) if t is not None and not t.done())
        live = self.inflight - allowed
        if live:
            self.orphans += live
            log.error("orphaned generation: %d coroutine(s) alive after cancel", live)
            if self.strict:
                raise AssertionError(f"{live} orphaned generation(s) after cancel")

    # ───────────────────────── speculation ─────────────────────────

    def _schedule_speculation(self) -> None:
        if not self.s.speculate or self._closed:
            return
        if self._spec_handle is not None:
            self._spec_handle.cancel()
        self._spec_handle = asyncio.get_running_loop().call_later(SPECULATE_AFTER_S, self._speculate)

    def _speculate(self) -> None:
        """Pre-generate one quantum either side of the dial last touched."""
        self._spec_handle = None
        if self._closed or self.active is None or self.generating or self._spec_tasks:
            return
        dim = self.dims.get(self.active_dim) if self.active_dim else None
        value = self.dials.get(dim.name) if dim else None
        if dim is None or value is None:
            return
        tier = self.backend.tier
        steps = dim.steps_for(tier)
        here = round(dim.quantise(value, tier) * steps)
        a = self.anchor
        if a >= self.s.max_tokens:
            return
        prefix = self._slice(0, a)
        prefix_hash = _sha("".join(prefix))
        pins = self._pin_specs(a)
        base = self._quantised()
        depth = min(self.s.spec_tokens, self.s.max_tokens - a)
        for step in (here + 1, here - 1):
            if not 0 <= step <= steps:
                continue
            dials = {**base, dim.name: step / steps}
            key = self._key(prefix_hash, dials, pins)
            branch = self.cache.peek(key)
            if branch is None:
                branch = Branch(key, dials, pins, speculative=True)
                self._put(branch)
            if branch.done or len(branch.tokens) >= depth:
                continue
            self.sim += 1
            self._spec_tasks[key] = asyncio.create_task(
                self._generate(branch, prefix, depth, speculative=True), name="steer-speculate"
            )

    # ───────────────────────── messages out ─────────────────────────

    def _flush(self) -> None:
        if not self.following or self.active is None:
            return
        length = self._len()
        if self.visible >= length:
            return
        self._send(P.Tokens(branch_id=self.branch_id, from_tok=self.visible, tokens=self._slice(self.visible, length)))
        self.visible = length
        if self._latency_from is not None:
            self.latency_ms = (self.clock() - self._latency_from) * 1000
            self.latencies.append(self.latency_ms)
            self._latency_from = None
        self._attn_dirty.set()
        if self._deferred:
            # the held request is on screen; now follow the hand
            self._move_on()

    async def _pump(self) -> None:
        """Tokens leave in frames: at once when the first arrives, then no more often than frame_ms."""
        frame = self.s.frame_ms / 1000
        while True:
            await self._dirty.wait()
            self._dirty.clear()
            self._flush()
            await asyncio.sleep(frame)

    async def _attention_loop(self) -> None:
        every = self.s.attention_ms / 1000
        while True:
            await self._attn_dirty.wait()
            self._attn_dirty.clear()
            n = self.visible
            activation = self.activation
            tokens = self._slice(0, n)
            pins = [PinSpec(p.start, p.end, p.weight, p.text) for p in self.pins.values() if p.end <= n]
            try:
                result = await self.backend.attention(
                    AttnRequest(tokens=tokens, pins=pins, window=self.s.focus_window, anchor=self.anchor, dials=self._quantised())
                )
            except asyncio.CancelledError:
                raise
            except Exception:  # noqa: BLE001 - the monitor is a readout; it never stops the writing
                log.exception("attention failed")
                result = None
            # scores for a text that has since been replaced are not shown
            if result is not None and activation == self.activation and tokens:
                lines = wrap(tokens, self.cols)
                sums = [0.0] * (lines[-1] + 1)
                for line, score in zip(lines, result.tok_scores):
                    sums[line] += score
                top = max(sums) or 1.0
                self._send(
                    P.Attention(
                        line_scores=[round(v / top, 4) for v in sums],
                        tok_scores=result.tok_scores,
                        source=result.source,
                    )
                )
            await asyncio.sleep(every)

    def _measure_rate(self) -> None:
        now = self.clock()
        while self._rate and now - self._rate[0][0] > 1.0:
            self._rate.popleft()
        if len(self._rate) >= 2:
            span = self._rate[-1][0] - self._rate[0][0]
            if span > 0.02:
                # the first read opens the window; the tokens in it arrived before it
                self.tok_s = sum(n for _, n in list(self._rate)[1:]) / span

    def telemetry(self) -> P.Telemetry:
        self._measure_rate()
        looked = self.cache_hits + self.cache_misses
        visible = self._slice(0, self.visible)
        lat = list(self.latencies)
        return P.Telemetry(
            tok_s=round(self.tok_s, 1),
            latency_ms=round(self.latency_ms, 1),
            steer=self.steer,
            sim=self.sim,
            tokens=self.visible,
            paragraphs=paragraphs(visible),
            cache_hits=self.cache_hits,
            cache_misses=self.cache_misses,
            hit_rate=round(self.cache_hits / looked, 3) if looked else 0.0,
            branches=len(self.cache),
            cancelled=self.cancelled,
            inflight=self.inflight,
            orphans=self.orphans,
            latency_p50=round(percentile(lat, 0.5), 1),
            latency_p95=round(percentile(lat, 0.95), 1),
        )

    async def _telemetry_loop(self) -> None:
        while True:
            t = self.telemetry()
            if t != self._last_telemetry:
                self._last_telemetry = t
                self._send(t)
            await asyncio.sleep(TELEMETRY_EVERY_S)

    def state(self) -> P.State:
        return P.State(
            committed=self.committed,
            anchor=self.anchor,
            scrub=self.anchor_pos,
            visible=self.visible,
            cached_len=self._len(),
            target=self.target,
            generating=self.generating,
            variant=self.variant,
            dials=dict(self.dials),
            quantised=self._quantised(),
            pins=[
                P.PinState(id=p.id, start_tok=p.start, end_tok=p.end, weight=round(p.weight, 3), text=p.text)
                for p in sorted(self.pins.values(), key=lambda p: p.start)
            ],
            active_dim=self.active_dim,
        )

    def _emit_state(self) -> None:
        if not self._closed:
            self._send(self.state())
