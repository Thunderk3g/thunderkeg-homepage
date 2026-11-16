from __future__ import annotations

import asyncio

import pytest

from steerable import protocol as P
from steerable.backends.base import GenRequest
from steerable.backends.sim import SimBackend
from steerable.config import Settings
from steerable.dimensions import load_dimensions
from steerable.engine import Engine


class Client:
    """Applies the protocol the way the canvas does, and records every breach of it."""

    def __init__(self) -> None:
        self.tokens: list[str] = []
        self.branch: str | None = None
        self.msgs: list[P.ServerMsg] = []
        self.violations: list[str] = []
        self.state: P.State | None = None
        self.telemetry: P.Telemetry | None = None

    def recv(self, msg: P.ServerMsg) -> None:
        self.msgs.append(msg)
        if isinstance(msg, P.Invalidate):
            if msg.from_tok > len(self.tokens):
                self.violations.append(f"invalidate past the end: {msg.from_tok} > {len(self.tokens)}")
            del self.tokens[msg.from_tok :]
            self.branch = msg.branch_id
        elif isinstance(msg, P.Tokens):
            if msg.branch_id != self.branch:
                self.violations.append(f"stale tokens: {msg.branch_id} while on {self.branch}")
                return
            if msg.from_tok != len(self.tokens):
                self.violations.append(f"gap: tokens at {msg.from_tok}, text is {len(self.tokens)} long")
                return
            self.tokens.extend(msg.tokens)
        elif isinstance(msg, P.State):
            self.state = msg
        elif isinstance(msg, P.Telemetry):
            self.telemetry = msg

    def of(self, kind: type) -> list:
        return [m for m in self.msgs if isinstance(m, kind)]

    @property
    def text(self) -> str:
        return "".join(self.tokens)


class CountingSim(SimBackend):
    """The simulated backend, remembering every request it was sent."""

    def __init__(self, *args, **kwargs) -> None:
        super().__init__(*args, **kwargs)
        self.requests: list[GenRequest] = []
        self.finished = 0

    async def generate(self, req: GenRequest):
        self.requests.append(req)
        async for chunk in super().generate(req):
            yield chunk
        self.finished += 1


def make_settings(**over) -> Settings:
    base = dict(
        backend="sim",
        horizon=40,
        spec_tokens=16,
        debounce_ms=5,
        frame_ms=1,
        attention_ms=5,
        sim_tok_s=0,
        sim_ttft_ms=0,
        cache_size=64,
    )
    base.update(over)
    return Settings(_env_file=None, **base)


async def settle(engine: Engine, timeout: float = 5.0) -> None:
    """Wait until the engine has nothing in flight and nothing scheduled."""
    loop = asyncio.get_running_loop()
    end = loop.time() + timeout
    quiet = 0
    while loop.time() < end:
        busy = engine.generating or engine._spec_tasks or engine._spec_handle is not None or engine._dying or engine._dirty.is_set()
        quiet = 0 if busy else quiet + 1
        if quiet >= 3:
            return
        await asyncio.sleep(0.004)
    raise AssertionError("engine did not settle")


@pytest.fixture
def dims():
    return load_dimensions()


@pytest.fixture
async def rig(dims):
    """(engine, client, backend) on the simulated backend, strict about orphans."""
    made: list[Engine] = []

    def build(**over):
        settings = make_settings(**over)
        backend = CountingSim(dims, tok_s=settings.sim_tok_s, ttft_ms=settings.sim_ttft_ms)
        client = Client()
        engine = Engine(backend, dims, settings, client.recv, strict=True)
        engine.start()
        made.append(engine)
        return engine, client, backend

    yield build
    for engine in made:
        await engine.close()
        assert engine.inflight == 0, "a generation outlived its session"
        assert engine.backend.inflight == 0, "a backend request outlived its session"
