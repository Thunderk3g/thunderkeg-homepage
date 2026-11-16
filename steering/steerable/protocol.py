"""Every message that crosses the WebSocket, as a Pydantic model.

The first block is the contract the canvas was specified with. The second is
what the contract needed in practice: the client has to learn the dimensions,
commit text, ask for another sample and say how wide its column is. Nothing in
the second block changes the meaning of the first.

`seq` is the client's own counter for a gesture. The server echoes the seq that
caused a branch switch in `invalidate.cause_seq`, which is how a client (and the
replay harness) measures gesture-to-text latency without guessing.
"""

from __future__ import annotations

from typing import Annotated, Any, Literal, Union

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter


class Msg(BaseModel):
    model_config = ConfigDict(extra="ignore")


# ───────────────────────── client -> server ─────────────────────────


class SetDial(Msg):
    type: Literal["set_dial"] = "set_dial"
    dim: str
    #: position along the arc; None returns the dial to "unset"
    value: float | None = Field(default=None, ge=0.0, le=1.0)
    #: snap to a named pole instead of a raw value
    pole: str | None = None
    seq: int | None = None


class Pin(Msg):
    type: Literal["pin"] = "pin"
    start_tok: int = Field(ge=0)
    end_tok: int = Field(ge=1)
    weight: float = Field(default=0.5, ge=0.0, le=1.0)
    #: chosen by the client; sending an existing id changes that pin's weight
    id: str | None = Field(default=None, max_length=40)
    seq: int | None = None


class Unpin(Msg):
    type: Literal["unpin"] = "unpin"
    id: str
    seq: int | None = None


class Scrub(Msg):
    type: Literal["scrub"] = "scrub"
    position_tok: int = Field(ge=0)
    seq: int | None = None


class Seed(Msg):
    type: Literal["seed"] = "seed"
    text: str = Field(max_length=8000)
    task: str | None = None
    cols: int | None = Field(default=None, ge=20, le=200)
    seq: int | None = None


class Stop(Msg):
    type: Literal["stop"] = "stop"
    seq: int | None = None


# extensions


class Commit(Msg):
    """Approve everything visible: it becomes part of the committed text."""

    type: Literal["commit"] = "commit"
    seq: int | None = None


class Reroll(Msg):
    """Another sample under the same controls."""

    type: Literal["reroll"] = "reroll"
    seq: int | None = None


class Layout(Msg):
    """The width of the client's text column, so line scores match its lines."""

    type: Literal["layout"] = "layout"
    cols: int = Field(ge=20, le=200)


ClientMsg = Annotated[
    Union[SetDial, Pin, Unpin, Scrub, Seed, Stop, Commit, Reroll, Layout],
    Field(discriminator="type"),
]
client_msg: TypeAdapter[ClientMsg] = TypeAdapter(ClientMsg)


# ───────────────────────── server -> client ─────────────────────────


class Tokens(Msg):
    type: Literal["tokens"] = "tokens"
    branch_id: str
    from_tok: int
    tokens: list[str]


class Attention(Msg):
    type: Literal["attention"] = "attention"
    #: one score per visual line at the session's column width, 0..1
    line_scores: list[float]
    #: one score per visible token, 0..1
    tok_scores: list[float]
    #: where the scores come from: heuristic | proxy:<model> | model
    source: str = "heuristic"


class Invalidate(Msg):
    type: Literal["invalidate"] = "invalidate"
    from_tok: int
    #: every later `tokens` message must carry this id or be dropped
    branch_id: str
    cause_seq: int | None = None
    #: the branch was already in the cache
    cached: bool = False
    #: switch = new text follows from here; scrub = the knob moved back; seed = a new text
    reason: Literal["switch", "scrub", "seed"] = "switch"


class Telemetry(Msg):
    type: Literal["telemetry"] = "telemetry"
    tok_s: float
    latency_ms: float
    steer: int
    sim: int
    # beyond the contract: what the footer and the harness also show
    tokens: int = 0
    paragraphs: int = 0
    cache_hits: int = 0
    cache_misses: int = 0
    hit_rate: float = 0.0
    branches: int = 0
    cancelled: int = 0
    inflight: int = 0
    #: requests found alive after a cancel had been waited out; anything but 0 is a bug
    orphans: int = 0
    latency_p50: float = 0.0
    latency_p95: float = 0.0


class PinState(Msg):
    id: str
    start_tok: int
    end_tok: int
    weight: float
    text: str


class State(Msg):
    """The control state after every change, so each control can say what it holds."""

    type: Literal["state"] = "state"
    committed: int
    #: where regeneration starts from
    anchor: int
    scrub: int
    visible: int
    #: tokens that exist on this path, including any hidden beyond the knob
    cached_len: int
    target: int
    generating: bool
    variant: int
    dials: dict[str, float | None]
    #: the quantised values the engine actually steers with
    quantised: dict[str, float]
    pins: list[PinState]
    active_dim: str | None = None


class Config(Msg):
    type: Literal["config"] = "config"
    backend: str
    tier: str
    model: str | None = None
    attention_source: str
    dimensions: list[dict[str, Any]]
    tasks: list[dict[str, Any]]
    horizon: int
    cols: int
    frame_ms: int


class Error(Msg):
    type: Literal["error"] = "error"
    message: str
    retry_after: float | None = None


ServerMsg = Union[Tokens, Attention, Invalidate, Telemetry, State, Config, Error]
