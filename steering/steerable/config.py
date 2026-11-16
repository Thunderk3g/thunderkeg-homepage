"""Settings, all from the environment (or a .env file). No secrets in code."""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="STEER_", env_file=".env", extra="ignore")

    #: sim (no model) | api (Tier A) | local (Tier B)
    backend: str = "sim"
    dimensions: str | None = None
    sim_file: str | None = None

    # the engine
    horizon: int = Field(default=120, description="tokens generated past the anchor before the engine idles")
    spec_tokens: int = Field(default=48, description="how deep a speculative neighbour is generated")
    speculate: bool = True
    debounce_ms: int = 30
    #: a hand that never stops still gets a new branch at least this often
    debounce_max_ms: int = 90
    #: how long a request still waiting for its first token is left to land when the controls move on
    hold_ms: int = 400
    frame_ms: int = 16
    cache_size: int = 64
    max_tokens: int = Field(default=4000, description="the longest a text may grow")
    cols: int = 72
    attention_ms: int = 100
    #: tokens at the head whose attention the focus monitor reads
    focus_window: int = 24

    # Tier A: any OpenAI-compatible endpoint
    api_base_url: str = "https://api.groq.com/openai/v1"
    api_key: str = ""
    api_model: str = "openai/gpt-oss-20b"
    #: chat = /chat/completions, completion = /completions (raw continuation)
    api_mode: str = "chat"
    api_temperature: float = 0.8
    #: JSON object merged into every request body (provider-specific switches)
    api_extra: str = ""
    api_timeout_s: float = 30.0

    # the focus monitor: auto = the model itself in Tier B, the proxy if it can load, else the heuristic
    attention: str = "auto"
    proxy_model: str = "Qwen/Qwen2.5-0.5B"

    # Tier B: an open-weights model on this machine
    local_model: str = "Qwen/Qwen2.5-1.5B-Instruct"
    local_device: str = "auto"
    local_dtype: str = "auto"
    local_temperature: float = 0.8
    local_top_p: float = 0.95
    vectors_dir: str = "vectors"
    #: how hard a full-weight pin pulls attention, in logits
    pin_bias: float = 2.0

    # the simulated backend's speed, so the engine can be exercised at a realistic rate
    sim_tok_s: float = 600.0
    sim_ttft_ms: float = 40.0

    # the server
    host: str = "127.0.0.1"
    port: int = 8017
    #: comma-separated origins allowed to open the WebSocket; empty allows any
    allowed_origins: str = ""

    def origins(self) -> list[str]:
        return [o.strip().rstrip("/") for o in self.allowed_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
