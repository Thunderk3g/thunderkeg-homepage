"""A stand-in for an OpenAI-compatible endpoint, for tests and for running the whole stack offline.

    python tests/mock_openai.py --port 8019 --ttft-ms 150 --tok-s 800

It streams plausible text as chat-completion chunks at a set speed, and counts
the streams that are open and the ones the client hung up on, which is how the
tests check that a cancelled request is really closed.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import random
import re

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, StreamingResponse

WORDS = (
    "the hill kept its own counsel and the path bent twice before the gate where she had left the lantern "
    "burning low against the stone while the valley below settled into a blue and patient dark"
).split()


def make_app(ttft_ms: float = 0.0, tok_s: float = 0.0, fail_status: int | None = None) -> FastAPI:
    app = FastAPI()
    app.state.open = 0
    app.state.started = 0
    app.state.hung_up = 0
    app.state.completed = 0
    app.state.bodies = []
    app.state.fail_status = fail_status

    @app.get("/stats")
    async def stats() -> dict:
        s = app.state
        return {"open": s.open, "started": s.started, "hung_up": s.hung_up, "completed": s.completed}

    async def stream(request: Request, body: dict, chat: bool):
        s = app.state
        rng = random.Random(body.get("seed", 0))
        system = next((m["content"] for m in body.get("messages", []) if m["role"] == "system"), body.get("prompt", ""))
        # make the steering visible in the output, so a test can see it arrived
        marks = re.findall(r"- (\w+): ([^(\n—]+)", system)
        n = int(body.get("max_tokens", 64))
        s.open += 1
        s.started += 1
        try:
            if ttft_ms:
                await asyncio.sleep(ttft_ms / 1000)
            words = [f"[{k}={v.strip()}]" for k, v in marks] + [rng.choice(WORDS) for _ in range(n)]
            for i, word in enumerate(words[:n]):
                if await request.is_disconnected():
                    s.hung_up += 1
                    return
                piece = word if i == 0 else " " + word
                delta = {"choices": [{"index": 0, "delta": {"content": piece}}]} if chat else {"choices": [{"index": 0, "text": piece}]}
                yield f"data: {json.dumps(delta)}\n\n"
                if tok_s:
                    await asyncio.sleep(1 / tok_s)
            yield "data: [DONE]\n\n"
            s.completed += 1
        except asyncio.CancelledError:
            s.hung_up += 1
            raise
        finally:
            s.open -= 1

    async def handle(request: Request, chat: bool):
        body = await request.json()
        app.state.bodies.append(body)
        if app.state.fail_status:
            return JSONResponse({"error": {"message": "rate limited"}}, status_code=app.state.fail_status, headers={"retry-after": "2"})
        return StreamingResponse(stream(request, body, chat), media_type="text/event-stream")

    @app.post("/v1/chat/completions")
    async def chat(request: Request):
        return await handle(request, True)

    @app.post("/v1/completions")
    async def completions(request: Request):
        return await handle(request, False)

    return app


if __name__ == "__main__":
    import uvicorn

    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8019)
    ap.add_argument("--ttft-ms", type=float, default=150)
    ap.add_argument("--tok-s", type=float, default=800)
    args = ap.parse_args()
    uvicorn.run(make_app(args.ttft_ms, args.tok_s), host="127.0.0.1", port=args.port, log_level="warning")
