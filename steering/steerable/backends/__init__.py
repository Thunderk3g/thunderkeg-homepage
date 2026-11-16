"""Backends, and the one place that chooses between them."""

from __future__ import annotations

import logging

from ..config import Settings
from ..dimensions import Dimensions
from .base import AttnRequest, AttnResult, BackendError, GenRequest, PinSpec, SteeringBackend

log = logging.getLogger("steerable")

__all__ = ["AttnRequest", "AttnResult", "BackendError", "GenRequest", "PinSpec", "SteeringBackend", "make_backend"]


def _proxy(settings: Settings):
    """The proxy focus monitor, if it was asked for and can load."""
    if settings.attention == "heuristic":
        return None
    try:
        from ..attention.proxy import ProxyAttention

        return ProxyAttention(settings.proxy_model)
    except Exception as err:  # noqa: BLE001 - no torch, no weights, no network: all mean "use the heuristic"
        if settings.attention == "proxy":
            raise
        log.warning("proxy focus monitor unavailable (%s); using the lexical heuristic", err)
        return None


def make_backend(settings: Settings, dims: Dimensions) -> SteeringBackend:
    kind = settings.backend
    if kind == "sim":
        from .sim import SimBackend

        return SimBackend(dims, tok_s=settings.sim_tok_s, ttft_ms=settings.sim_ttft_ms, sim_file=settings.sim_file)
    if kind == "api":
        from .api import ApiBackend

        if not settings.api_key:
            log.warning("STEER_API_KEY is empty; requests will be sent without credentials")
        return ApiBackend(dims, settings, attention=_proxy(settings))
    if kind == "local":
        from .local import LocalSteeringBackend

        return LocalSteeringBackend(dims, settings)
    raise ValueError(f"STEER_BACKEND must be sim, api or local, not {kind!r}")
