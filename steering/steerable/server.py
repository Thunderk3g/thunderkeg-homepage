"""FastAPI app: one WebSocket per session.

    uvicorn steerable.server:app --port 8017

The model (or HTTP client) is shared by every session; each connection gets its
own engine, cache and control state.
"""

from __future__ import annotations

import asyncio
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError

from . import protocol as P
from .backends import make_backend
from .config import get_settings
from .dimensions import load_dimensions
from .engine import Engine

log = logging.getLogger("steerable.server")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    logging.basicConfig(level=os.environ.get("STEER_LOG", "INFO"), format="%(asctime)s %(name)s %(levelname)s %(message)s")
    dims = load_dimensions(settings.dimensions)
    app.state.settings = settings
    app.state.dims = dims
    app.state.backend = make_backend(settings, dims)
    log.info("backend=%s tier=%s model=%s focus=%s", app.state.backend.name, app.state.backend.tier, app.state.backend.model, app.state.backend.attention_source)
    try:
        yield
    finally:
        await app.state.backend.aclose()


app = FastAPI(title="Steerable Canvas", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=get_settings().origins() or ["*"], allow_methods=["GET"])


@app.get("/health")
async def health() -> dict:
    backend = app.state.backend
    return {"ok": True, "backend": backend.name, "tier": backend.tier, "model": backend.model, "inflight": backend.inflight}


@app.get("/config")
async def config() -> dict:
    backend = app.state.backend
    return {
        "backend": backend.name,
        "tier": backend.tier,
        "model": backend.model,
        "attention_source": backend.attention_source,
        "dimensions": [d.public(backend.tier) for d in app.state.dims],
        "tasks": [t.public() for t in app.state.dims.tasks if backend.tier != "sim" or t.sim],
    }


@app.websocket("/ws")
async def session(ws: WebSocket) -> None:
    settings = app.state.settings
    allowed = settings.origins()
    origin = (ws.headers.get("origin") or "").rstrip("/")
    if allowed and origin not in allowed:
        await ws.close(code=4403, reason="origin not allowed")
        return
    await ws.accept()

    outbox: asyncio.Queue[P.ServerMsg] = asyncio.Queue()
    engine = Engine(app.state.backend, app.state.dims, settings, outbox.put_nowait, strict=os.environ.get("STEER_STRICT") == "1")

    async def writer() -> None:
        while True:
            msg = await outbox.get()
            await ws.send_text(msg.model_dump_json())

    send_task = asyncio.create_task(writer(), name="steer-writer")
    engine.start()
    try:
        while True:
            raw = await ws.receive_text()
            try:
                msg = P.client_msg.validate_json(raw)
            except ValidationError as err:
                first = err.errors()[0]
                outbox.put_nowait(P.Error(message=f"bad message: {first.get('msg')} at {'.'.join(map(str, first.get('loc', ())))}"))
                continue
            engine.handle(msg)
    except WebSocketDisconnect:
        pass
    finally:
        await engine.close()
        send_task.cancel()
        await asyncio.gather(send_task, return_exceptions=True)
        if engine.inflight:
            log.error("session closed with %d generation(s) still alive", engine.inflight)


def main() -> None:
    import uvicorn

    settings = get_settings()
    uvicorn.run("steerable.server:app", host=settings.host, port=settings.port, log_level="info")


if __name__ == "__main__":
    main()
