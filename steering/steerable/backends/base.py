"""The interface every inference backend sits behind.

The engine knows nothing about prompts, activations or HTTP. It hands a backend
the text so far and the control state, and gets display tokens back. Swapping
the simulated backend for an API, or the API for a local model with real
activation steering, changes nothing above this line.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import AsyncIterator

from ..dimensions import Dimensions
from ..layout import split


@dataclass(frozen=True)
class PinSpec:
    start: int
    end: int
    weight: float
    text: str


@dataclass(frozen=True)
class GenRequest:
    #: every display token so far: the kept prefix, then whatever this branch already holds
    tokens: list[str]
    #: index in `tokens` where the steered continuation begins
    anchor: int
    #: the set dials, already quantised
    dials: dict[str, float]
    pins: list[PinSpec]
    max_tokens: int
    seed: int
    task: str | None = None


@dataclass(frozen=True)
class AttnRequest:
    tokens: list[str]
    pins: list[PinSpec]
    #: how many tokens at the head count as "what is being written now"
    window: int = 24
    anchor: int = 0
    dials: dict[str, float] = field(default_factory=dict)


@dataclass(frozen=True)
class AttnResult:
    #: one score per token, 0..1 (the largest is 1)
    tok_scores: list[float]
    source: str


class BackendError(Exception):
    def __init__(self, message: str, retry_after: float | None = None) -> None:
        super().__init__(message)
        self.retry_after = retry_after


class SteeringBackend(ABC):
    name: str = "base"
    #: sim | A | B
    tier: str = "A"
    model: str | None = None
    attention_source: str = "heuristic"

    def __init__(self, dims: Dimensions) -> None:
        self.dims = dims
        #: requests currently open against the model; the engine asserts this returns to zero
        self.inflight = 0

    def split(self, text: str) -> list[str]:
        """Text to display tokens."""
        return split(text)

    def pin_level(self, weight: float) -> float:
        """The weight a pin is cached under. Two weights at one level share a branch."""
        return round(weight * 20) / 20

    @abstractmethod
    def generate(self, req: GenRequest) -> AsyncIterator[list[str]]:
        """Yield display tokens until max_tokens, the model stops, or the task is cancelled."""

    @abstractmethod
    async def attention(self, req: AttnRequest) -> AttnResult | None:
        """Score every visible token for the focus monitor."""

    async def aclose(self) -> None:  # pragma: no cover - nothing to release by default
        return None
