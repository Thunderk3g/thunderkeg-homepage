"""Tier A: any OpenAI-compatible endpoint.

Steering is a style block compiled from the dials and pins (prompting.py). The
stream is read as server-sent events and re-cut into display tokens. A
cancelled task closes the HTTP response, which is what stops the provider
generating (and billing) text nobody will read.
"""

from __future__ import annotations

import json
import logging
from typing import Any, AsyncIterator

import httpx

from ..attention.heuristic import heuristic_attention
from ..config import Settings
from ..dimensions import Dimensions
from ..layout import StreamSplitter
from ..prompting import chat_messages, completion_prompt
from .base import AttnRequest, AttnResult, BackendError, GenRequest, SteeringBackend

log = logging.getLogger("steerable.api")


class ThinkStripper:
    """Drops a leading <think>…</think> block from models that inline their reasoning."""

    def __init__(self) -> None:
        self.buf = ""
        self.state = "start"

    def feed(self, delta: str) -> str:
        if self.state == "open":
            return delta
        self.buf += delta
        if self.state == "start":
            head = self.buf.lstrip()
            if len(head) < 7 and "<think>".startswith(head):
                return ""
            if not head.startswith("<think>"):
                self.state = "open"
                out, self.buf = self.buf, ""
                return out
            self.state = "thinking"
        end = self.buf.find("</think>")
        if end < 0:
            return ""
        self.state = "open"
        out, self.buf = self.buf[end + 8 :].lstrip(), ""
        return out


class ApiBackend(SteeringBackend):
    name = "api"
    tier = "A"

    def __init__(self, dims: Dimensions, settings: Settings, *, client: httpx.AsyncClient | None = None, attention=None) -> None:
        super().__init__(dims)
        self.s = settings
        self.model = settings.api_model
        self._attention = attention
        if attention is not None:
            self.attention_source = attention.source
        self._extra: dict[str, Any] = json.loads(settings.api_extra) if settings.api_extra.strip() else {}
        self._client = client or httpx.AsyncClient(
            base_url=settings.api_base_url.rstrip("/") + "/",
            headers={"authorization": f"Bearer {settings.api_key}"} if settings.api_key else {},
            timeout=httpx.Timeout(settings.api_timeout_s, connect=10.0),
        )

    def pin_level(self, weight: float) -> float:
        # a prompt can say three strengths of "keep this in mind", no more
        return 0.2 if weight < 0.34 else 0.5 if weight < 0.67 else 0.9

    def _body(self, req: GenRequest) -> tuple[str, dict[str, Any]]:
        # a display token is roughly a word; leave the model room in its own tokens
        common: dict[str, Any] = {
            "model": self.model,
            "stream": True,
            "temperature": self.s.api_temperature,
            "max_tokens": int(req.max_tokens * 1.6) + 16,
            "seed": req.seed % (2**31),
            **self._extra,
        }
        if self.s.api_mode == "completion":
            return "completions", {**common, "prompt": completion_prompt(self.dims, req)}
        return "chat/completions", {**common, "messages": chat_messages(self.dims, req)}

    async def generate(self, req: GenRequest) -> AsyncIterator[list[str]]:
        path, body = self._body(req)
        splitter = StreamSplitter()
        strip = ThinkStripper()
        sent = 0
        self.inflight += 1
        try:
            async with self._client.stream("POST", path, json=body) as res:
                if res.status_code >= 400:
                    detail = (await res.aread()).decode("utf-8", "replace")[:300]
                    retry = res.headers.get("retry-after")
                    raise BackendError(
                        f"{self.model}: HTTP {res.status_code} {detail}".strip(),
                        retry_after=float(retry) if retry and retry.replace(".", "", 1).isdigit() else None,
                    )
                async for line in res.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    data = line[5:].strip()
                    if data == "[DONE]":
                        break
                    try:
                        choice = (json.loads(data).get("choices") or [{}])[0]
                    except json.JSONDecodeError:
                        continue
                    delta = (choice.get("delta") or {}).get("content") or choice.get("text") or ""
                    text = strip.feed(delta) if delta else ""
                    if not text:
                        continue
                    if sent == 0 and splitter._buf == "":
                        text = self._join(req, text)
                    tokens = splitter.feed(text)
                    if tokens:
                        sent += len(tokens)
                        yield tokens
                        if sent >= req.max_tokens:
                            return
                tail = splitter.flush()
                if tail:
                    yield tail
        except httpx.HTTPError as err:
            raise BackendError(f"{self.model}: {type(err).__name__}: {err}") from err
        finally:
            self.inflight -= 1

    @staticmethod
    def _join(req: GenRequest, text: str) -> str:
        """Chat models answer as a fresh message; make the seam with the existing text clean."""
        last = req.tokens[-1] if req.tokens else ""
        if not last or last.endswith(("\n", " ")):
            return text.lstrip(" ")
        head = text[:1]
        if head.isspace() or head in ".,;:!?)]}…’”-":
            return text
        if head in "\"'":
            # a straight quote closes if one is open in the paragraph being continued
            paragraph = "".join(req.tokens).rsplit("\n", 1)[-1]
            if paragraph.count(head) % 2 == 1:
                return text
        return " " + text

    async def attention(self, req: AttnRequest) -> AttnResult | None:
        if self._attention is not None:
            return await self._attention.attention(req)
        return await heuristic_attention(req)

    async def aclose(self) -> None:
        await self._client.aclose()
