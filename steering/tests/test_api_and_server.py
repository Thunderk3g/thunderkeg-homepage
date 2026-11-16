"""Tier A against a real HTTP endpoint (a local stand-in), and the WebSocket server."""

from __future__ import annotations

import asyncio
import json
import socket
import sys
from pathlib import Path

import pytest
import uvicorn

sys.path.insert(0, str(Path(__file__).parent))

from mock_openai import make_app  # noqa: E402

from steerable import protocol as P  # noqa: E402
from steerable.backends.api import ApiBackend, ThinkStripper  # noqa: E402
from steerable.backends.base import BackendError, GenRequest, PinSpec  # noqa: E402
from steerable.engine import Engine  # noqa: E402
from steerable.layout import split  # noqa: E402

from conftest import Client, make_settings, settle  # noqa: E402


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class Served:
    """An ASGI app on a real port, for the length of a test."""

    def __init__(self, app) -> None:
        self.app = app
        self.port = free_port()
        self.server = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=self.port, log_level="error", lifespan="on"))
        self.task: asyncio.Task | None = None

    async def __aenter__(self) -> "Served":
        self.task = asyncio.create_task(self.server.serve())
        for _ in range(200):
            if self.server.started:
                return self
            await asyncio.sleep(0.01)
        raise RuntimeError("server did not start")

    async def __aexit__(self, *exc) -> None:
        self.server.should_exit = True
        await self.task


def api(dims, port: int, **over) -> ApiBackend:
    settings = make_settings(backend="api", api_base_url=f"http://127.0.0.1:{port}/v1", api_key="test-key", api_model="mock", **over)
    return ApiBackend(dims, settings)


async def collect(backend, req) -> list[str]:
    out: list[str] = []
    async for chunk in backend.generate(req):
        out += chunk
    return out


async def test_the_api_backend_streams_display_tokens_with_the_steering_in_the_prompt(dims):
    async with Served(make_app()) as srv:
        backend = api(dims, srv.port)
        req = GenRequest(tokens=split("She waited."), anchor=3, dials={"pace": 0.0}, pins=[PinSpec(0, 1, 0.9, "She")], max_tokens=20, seed=5, task="story")
        tokens = await collect(backend, req)
        assert 0 < len(tokens) <= 20
        text = "".join(tokens)
        assert text.startswith(" "), "the continuation joins the existing text with a space"
        assert "[pace=very compressed" in text, "the dial did not reach the model"
        body = srv.app.state.bodies[-1]
        assert body["stream"] is True and body["model"] == "mock" and body["seed"] == 5
        assert "KEEP IN FOCUS" in body["messages"][0]["content"] and '"She" (must stay central)' in body["messages"][0]["content"]
        assert backend.inflight == 0
        await backend.aclose()


async def test_completion_mode_sends_a_prompt(dims):
    async with Served(make_app()) as srv:
        backend = api(dims, srv.port, api_mode="completion")
        tokens = await collect(backend, GenRequest(tokens=split("One."), anchor=1, dials={}, pins=[], max_tokens=8, seed=1))
        assert len(tokens) == 8 and "prompt" in srv.app.state.bodies[-1] and srv.app.state.bodies[-1]["prompt"].endswith("One.")
        await backend.aclose()


async def test_a_cancelled_request_closes_its_http_stream(dims):
    async with Served(make_app(ttft_ms=10, tok_s=100)) as srv:
        backend = api(dims, srv.port)
        client = Client()
        engine = Engine(backend, dims, make_settings(horizon=200, speculate=False, debounce_ms=5), client.recv, strict=True)
        engine.start()
        engine.seed("Elara waited.")
        for _ in range(100):
            if srv.app.state.open == 1 and len(client.tokens) > 5:
                break
            await asyncio.sleep(0.01)
        assert srv.app.state.open == 1, "the stream never opened"
        engine.set_dial("tone", 0.0)
        for _ in range(100):
            if srv.app.state.hung_up >= 1:
                break
            await asyncio.sleep(0.01)
        assert srv.app.state.hung_up == 1, "the provider was left generating text nobody will read"
        engine.stop()
        await asyncio.sleep(0.1)
        assert srv.app.state.open == 0 and backend.inflight == 0 and engine.inflight == 0
        assert client.violations == [] and engine.orphans == 0
        await engine.close()
        await backend.aclose()


async def test_many_changes_against_http_leave_nothing_open(dims):
    async with Served(make_app(ttft_ms=15, tok_s=400)) as srv:
        backend = api(dims, srv.port)
        client = Client()
        engine = Engine(backend, dims, make_settings(horizon=60, debounce_ms=5), client.recv, strict=True)
        engine.start()
        engine.seed("Elara waited.")
        for i in range(100):
            engine.set_dial(("tone", "pace", "tension")[i % 3], ((i * 5) % 7) / 6, seq=i)
            await asyncio.sleep((0.001, 0.012, 0.03)[i % 3])
        await settle(engine, timeout=10)
        await asyncio.sleep(0.1)
        stats = srv.app.state
        assert client.violations == [] and engine.orphans == 0
        assert stats.open == 0 and backend.inflight == 0
        assert stats.hung_up > 0 and stats.started == stats.hung_up + stats.completed
        assert client.tokens == engine._slice(0, engine.visible)
        await engine.close()
        await backend.aclose()


async def test_a_refusal_from_the_provider_is_reported_not_retried(dims):
    async with Served(make_app(fail_status=429)) as srv:
        backend = api(dims, srv.port)
        with pytest.raises(BackendError) as err:
            await collect(backend, GenRequest(tokens=["x"], anchor=1, dials={}, pins=[], max_tokens=8, seed=1))
        assert "429" in str(err.value) and err.value.retry_after == 2.0
        client = Client()
        engine = Engine(backend, dims, make_settings(speculate=False), client.recv, strict=True)
        engine.start()
        engine.seed("Elara waited.")
        await settle(engine)
        await asyncio.sleep(0.1)
        assert len(client.of(P.Error)) == 1 and client.of(P.Error)[0].retry_after == 2.0
        assert len(srv.app.state.bodies) == 2, "the engine must not hammer a provider that said no"
        await engine.close()
        await backend.aclose()


def test_reasoning_blocks_are_dropped():
    s = ThinkStripper()
    assert "".join(s.feed(p) for p in ["<th", "ink>plan", "ning</thi", "nk>\n\nThe", " text"]) == "The text"
    s = ThinkStripper()
    assert "".join(s.feed(p) for p in ["Plain", " text"]) == "Plain text"


async def test_the_websocket_server_speaks_the_contract(monkeypatch):
    import websockets

    from steerable import config

    monkeypatch.setenv("STEER_BACKEND", "sim")
    monkeypatch.setenv("STEER_SIM_TOK_S", "0")
    monkeypatch.setenv("STEER_SIM_TTFT_MS", "0")
    monkeypatch.setenv("STEER_HORIZON", "30")
    monkeypatch.setenv("STEER_STRICT", "1")
    config.get_settings.cache_clear()
    from steerable.server import app

    async with Served(app) as srv:
        async with websockets.connect(f"ws://127.0.0.1:{srv.port}/ws") as ws:
            seen: list[dict] = []
            tokens: list[str] = []
            branch = None

            async def until(pred, timeout=5.0):
                nonlocal branch
                end = asyncio.get_running_loop().time() + timeout
                while True:
                    msg = json.loads(await asyncio.wait_for(ws.recv(), end - asyncio.get_running_loop().time()))
                    seen.append(msg)
                    if msg["type"] == "invalidate":
                        del tokens[msg["from_tok"] :]
                        branch = msg["branch_id"]
                    elif msg["type"] == "tokens":
                        assert msg["branch_id"] == branch and msg["from_tok"] == len(tokens)
                        tokens.extend(msg["tokens"])
                    if pred(msg):
                        return msg

            cfg = await until(lambda m: m["type"] == "config")
            assert cfg["backend"] == "sim" and len(cfg["dimensions"]) == 6 and cfg["dimensions"][0]["poles"][0]["name"] == "wry"
            await ws.send(json.dumps({"type": "seed", "text": "Elara waited.", "seq": 1}))
            await until(lambda m: m["type"] == "state" and not m["generating"] and m["visible"] == 32)
            assert "".join(tokens).startswith("Elara waited.")
            before = list(tokens)
            await ws.send(json.dumps({"type": "set_dial", "dim": "tone", "pole": "somber", "seq": 2}))
            inv = await until(lambda m: m["type"] == "invalidate")
            assert inv["cause_seq"] == 2 and inv["from_tok"] == 2
            state = await until(lambda m: m["type"] == "state" and not m["generating"] and m["visible"] == 32)
            assert state["dials"]["tone"] == pytest.approx(2 / 3) and tokens != before
            await ws.send(json.dumps({"type": "scrub", "position_tok": 10, "seq": 3}))
            await until(lambda m: m["type"] == "invalidate" and m["reason"] == "scrub")
            assert len(tokens) == 10
            await ws.send('{"type": "set_dial", "dim": "tone", "value": 7}')
            err = await until(lambda m: m["type"] == "error")
            assert "bad message" in err["message"]
            await until(lambda m: m["type"] == "attention")
            await until(lambda m: m["type"] == "telemetry")
    config.get_settings.cache_clear()


async def test_the_harness_reports_a_clean_run():
    from steerable.replay import run_inprocess, synth

    report = await run_inprocess(synth()["rapid_100"], backend="sim", sim_tok_s=2000, sim_ttft_ms=5, _env_file=None)
    assert report["sent"] == 100 and report["stale_tokens"] == 0 and report["orphans"] == 0 and report["inflight_at_end"] == 0
    assert report["requests_cancelled"] > 0 and report["answered"] > 0
