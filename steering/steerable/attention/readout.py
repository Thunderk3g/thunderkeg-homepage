"""A causal language model with the handles steering needs.

`Runner` wraps a Hugging Face model and its tokenizer and is shared by the
Tier B backend (which generates with it), the proxy focus monitor (which only
reads its attention) and vector training (which records its activations). It
owns everything that touches model internals:

  characters   every model token is given the span of characters it owns, so
               display tokens, pins and scores are matched by position in the
               text and never by token index.
  steering     a forward hook on a decoder layer adds a vector to the residual
               stream, from a given position onward.
  attention    a pin is an additive bias on attention scores. It is passed as a
               float 4D attention mask, which this version of transformers
               hands to the attention function unchanged, where both the eager
               and the scaled-dot-product paths add it to the scores before the
               softmax. tests/test_local.py checks that on every run.
  prefix       the keys and values of a kept prefix are computed once, with no
               steering and no bias, and copied for each request that shares it.
  focus        the attention the head of the text pays to everything before it,
               read from the model in eager mode.

Every forward pass holds one lock, so a generation and a focus readout can
share the model by taking turns, one pass at a time.
"""

from __future__ import annotations

import math
import re
import threading
from bisect import bisect_right
from contextlib import contextmanager
from dataclasses import dataclass
from itertools import accumulate
from typing import Any, Callable, Iterator, Sequence

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, DynamicCache

from ..backends.base import BackendError, PinSpec
from ..cache import LRU

DTYPES = {"fp16": torch.float16, "float16": torch.float16, "bf16": torch.bfloat16, "bfloat16": torch.bfloat16, "fp32": torch.float32, "float32": torch.float32}
#: the share of the depth the focus monitor reads when no dimension says otherwise
DEFAULT_LAYERS = (0.35, 0.7)
_NEWLINES = re.compile(r"\n+|[^\n]+")


def pick_device(device: str, dtype: str) -> tuple[str, torch.dtype]:
    """Resolve "auto": a GPU in half precision when there is one, else the CPU in single."""
    if device == "auto":
        device = "cuda" if torch.cuda.is_available() else "cpu"
    if dtype == "auto":
        if not device.startswith("cuda"):
            return device, torch.float32
        return device, torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16
    if dtype not in DTYPES:
        raise ValueError(f"dtype must be auto or one of {sorted(DTYPES)}, not {dtype!r}")
    return device, DTYPES[dtype]


def decoder_layers(model: torch.nn.Module) -> torch.nn.ModuleList:
    """The stack of decoder blocks whose outputs are the residual stream."""
    base = model.base_model
    for name in ("layers", "h"):
        layers = getattr(base, name, None)
        if isinstance(layers, torch.nn.ModuleList) and len(layers):
            return layers
    raise BackendError(
        f"{type(model).__name__} has an unsupported layout: the decoder blocks are expected at "
        "base_model.layers (Llama, Qwen2, Mistral) or base_model.h (GPT-2)"
    )


def layer_range(depth: int, lo: float = DEFAULT_LAYERS[0], hi: float = DEFAULT_LAYERS[1]) -> list[int]:
    """Fractions of the depth to layer indices; never empty."""
    first = min(depth - 1, max(0, int(lo * depth)))
    last = min(depth, max(first + 1, math.ceil(hi * depth)))
    return list(range(first, last))


@contextmanager
def steering(layers: Sequence[torch.nn.Module], vectors: dict[int, torch.Tensor], start: int) -> Iterator[None]:
    """Add `vectors[i]` to the output of layer i, from input position `start` on, for the passes run inside."""

    def hook(vector: torch.Tensor) -> Callable[..., None]:
        def add(_module: torch.nn.Module, _inputs: Any, output: Any) -> None:
            hidden = output[0] if isinstance(output, tuple) else output
            hidden[:, start:] += vector

        return add

    # prepended, so that anything else watching a layer sees its output after steering
    handles = [layers[i].register_forward_hook(hook(v), prepend=True) for i, v in vectors.items()]
    try:
        yield
    finally:
        for handle in handles:
            handle.remove()


@contextmanager
def recording(layers: Sequence[torch.nn.Module], indices: Sequence[int]) -> Iterator[dict[int, torch.Tensor]]:
    """Keep the output of each listed layer (batch, positions, hidden) from the last pass run inside."""
    seen: dict[int, torch.Tensor] = {}

    def hook(index: int) -> Callable[..., None]:
        def keep(_module: torch.nn.Module, _inputs: Any, output: Any) -> None:
            seen[index] = (output[0] if isinstance(output, tuple) else output).detach().clone()

        return keep

    handles = [layers[i].register_forward_hook(hook(i)) for i in indices]
    try:
        yield seen
    finally:
        for handle in handles:
            handle.remove()


def bias_mask(bias: torch.Tensor, anchor: int, offset: int, length: int) -> torch.Tensor:
    """The attention mask for a pass over positions offset..offset+length, with the pin bias in it.

    It is causal, and in the rows at or after `anchor` column j carries
    `bias[j]`; columns past the end of `bias` carry nothing. Shape
    (1, 1, length, offset + length), additive, in the dtype of `bias`.
    """
    width = offset + length
    column = torch.zeros(width, dtype=bias.dtype, device=bias.device)
    column[: min(width, len(bias))] = bias[:width]
    rows = torch.arange(offset, width, device=bias.device)[:, None]
    cols = torch.arange(width, device=bias.device)[None, :]
    mask = torch.where(rows >= anchor, column[None, :], torch.zeros((), dtype=bias.dtype, device=bias.device))
    return mask.masked_fill(cols > rows, torch.finfo(bias.dtype).min)[None, None]


def cut(piece: str) -> list[str]:
    """One model token's text as display tokens: runs of newlines stand alone.

    The layout code (layout.py, and its twin in the web app) takes a token to
    be either a run of newlines or text with none in it. Model vocabularies
    have tokens such as ".\n\n" that are both, so those are cut in two.
    """
    return _NEWLINES.findall(piece)


def starts_of(tokens: Sequence[str]) -> list[int]:
    """The character each display token starts at, with the length of the text at the end."""
    return list(accumulate((len(t) for t in tokens), initial=0))


def pin_weights(pins: Sequence[PinSpec], tokens: Sequence[str], spans: Sequence[tuple[int, int]]) -> list[float]:
    """The pin weight on each model token: the heaviest pin whose characters the token touches.

    A pin is a range of display tokens. It is turned into a range of characters
    (less the white space at its edges) and laid over the model tokens' spans,
    because the two tokenisations need not line up.
    """
    starts = starts_of(tokens)
    weights = [0.0] * len(spans)
    for pin in pins:
        first, last = max(0, pin.start), min(len(tokens), pin.end)
        if first >= last:
            continue
        chunk = "".join(tokens[first:last])
        lo = starts[first] + len(chunk) - len(chunk.lstrip())
        hi = starts[last] - (len(chunk) - len(chunk.rstrip()))
        for i, (s, e) in enumerate(spans):
            if s < hi and e > lo:
                weights[i] = max(weights[i], pin.weight)
    return weights


def to_display(scores: Sequence[float], spans: Sequence[tuple[int, int]], tokens: Sequence[str]) -> list[float]:
    """Model-token scores re-cut onto display tokens, each shared out by the characters it covers."""
    starts = starts_of(tokens)
    out = [0.0] * len(tokens)
    d = 0
    for score, (s, e) in zip(scores, spans):
        if e <= s:
            continue
        while d < len(tokens) and starts[d + 1] <= s:
            d += 1
        j = d
        while j < len(tokens) and starts[j] < e:
            out[j] += score * (min(e, starts[j + 1]) - max(s, starts[j])) / (e - s)
            j += 1
    return out


def normalise(scores: Sequence[float]) -> list[float]:
    """Scale so the largest score is 1; all zeros stay zeros."""
    top = max(scores, default=0.0)
    return [s / top for s in scores] if top > 0 else [0.0] * len(scores)


@dataclass(frozen=True)
class Encoded:
    ids: list[int]
    #: the characters each token owns; empty for a special token
    spans: list[tuple[int, int]]

    def before(self, char: int) -> int:
        """How many leading tokens lie wholly before character `char`."""
        return bisect_right([e for _, e in self.spans], char)


class Runner:
    """One loaded model and tokenizer; see the module docstring for what it does with them."""

    def __init__(self, name: str, device: str = "auto", dtype: str = "auto", prefixes: int = 4) -> None:
        self.name = name
        self.device, self.dtype = pick_device(device, dtype)
        self.tokenizer = AutoTokenizer.from_pretrained(name)
        if not self.tokenizer.is_fast:
            raise BackendError(f"{name}: a fast tokenizer is needed, for the character offsets of its tokens")
        self.model = AutoModelForCausalLM.from_pretrained(name, dtype=self.dtype).to(self.device).eval()
        self.layers = decoder_layers(self.model)
        self.depth = len(self.layers)
        self.hidden = int(self.model.config.hidden_size)
        config = self.model.config
        #: the longest sequence the model can take, when its config says
        self.max_positions: int | None = getattr(config, "n_positions", None) or getattr(config, "max_position_embeddings", None)
        ends = {self.tokenizer.eos_token_id, getattr(self.model.generation_config, "eos_token_id", None)}
        self.eos: set[int] = {int(t) for e in ends if e is not None for t in (e if isinstance(e, (list, tuple)) else [e])}
        self.focus_layers = layer_range(self.depth)
        #: one forward pass at a time; re-entrant so a prefix can be looked up and computed in one hold
        self.lock = threading.RLock()
        self._attn = config._attn_implementation
        self._prefixes: LRU[str, tuple[list[int], Any]] = LRU(prefixes)

    def encode(self, text: str) -> Encoded:
        """Model tokens with the characters each one owns.

        A token owns everything from the end of the token before it to its own
        end, so the spans tile the text whatever the tokenizer does with white
        space. Tokens that add no characters (specials, and the later bytes of
        a character split across tokens) own nothing. A text with no tokens at
        all is given the start token, so there is always a position to predict from.
        """
        enc = self.tokenizer(text, return_offsets_mapping=True)
        ids = list(enc["input_ids"])
        spans: list[tuple[int, int]] = []
        at = 0
        for s, e in enc["offset_mapping"]:
            end = max(at, e) if e > s else at
            spans.append((at, end))
            at = end
        if not ids:
            start = self.tokenizer.bos_token_id if self.tokenizer.bos_token_id is not None else self.tokenizer.eos_token_id
            if start is None:
                raise BackendError(f"{self.name}: the tokenizer has no start token to begin an empty text with")
            ids, spans = [int(start)], [(0, 0)]
        if at < len(text):
            spans[-1] = (spans[-1][0], len(text))
        return Encoded(ids, spans)

    def split(self, text: str) -> list[str]:
        """Display tokens: the slice of the text each model token owns. Joining them gives the text back."""
        return [part for s, e in self.encode(text).spans for part in cut(text[s:e])]

    def decode(self, ids: Sequence[int]) -> str:
        return self.tokenizer.decode(list(ids), skip_special_tokens=True, clean_up_tokenization_spaces=False)

    def forward(
        self,
        ids: Sequence[int],
        past: Any = None,
        *,
        steer: dict[int, torch.Tensor] | None = None,
        anchor: int = 0,
        bias: torch.Tensor | None = None,
        attentions: bool = False,
        logits: bool = True,
    ) -> Any:
        """One pass over `ids`, which follow the positions already held in `past`.

        `steer` and `bias` take effect from absolute position `anchor` on:
        the vectors are added to those positions' residuals, and those
        positions' attention is biased toward the columns `bias` marks. `past`
        is extended in place and returned in the output. With `attentions` the
        pass runs in eager mode and returns the attention weights; without
        `logits` it stops before the vocabulary projection.
        """
        offset = past.get_seq_length() if past is not None else 0
        kwargs: dict[str, Any] = {}
        if bias is not None:
            kwargs["attention_mask"] = bias_mask(bias, anchor, offset, len(ids))
        if attentions:
            kwargs["output_attentions"] = True
        net = self.model if logits else self.model.base_model
        x = torch.tensor([list(ids)], device=self.device)
        with self.lock, torch.inference_mode(), steering(self.layers, steer or {}, max(0, anchor - offset)):
            if attentions and self._attn != "eager":
                self.model.set_attn_implementation("eager")
            try:
                return net(input_ids=x, past_key_values=past, use_cache=True, **kwargs)
            finally:
                if attentions and self._attn != "eager":
                    self.model.set_attn_implementation(self._attn)

    def prefix(self, text: str) -> tuple[list[int], Any]:
        """The tokens of a kept prefix and their keys and values, computed once with no steering and no bias."""
        with self.lock:
            entry = self._prefixes.get(text)
            if entry is None:
                ids = self.encode(text).ids if text else []
                past = self.forward(ids, logits=False).past_key_values if ids else None
                entry = (ids, past)
                self._prefixes.put(text, entry)
            return entry

    def resume(self, ids: Sequence[int], prefix_text: str, upto: int) -> tuple[Any, int]:
        """A private copy of the cached prefix, and how many of `ids` it covers (at most `upto`).

        The copy is cut to the tokens the cached prefix shares with `ids`.
        That is normally all of it; it is fewer when the text after the prefix
        changes how the prefix's last characters tokenise, or when the caller
        needs to re-run the tail. The cached entry itself is never touched.
        """
        if upto <= 0:
            return None, 0
        cached, past = self.prefix(prefix_text)
        keep = 0
        while keep < min(len(cached), upto, len(ids)) and cached[keep] == ids[keep]:
            keep += 1
        if keep == 0:
            return None, 0
        layers = [(k[..., :keep, :], v[..., :keep, :]) for k, v, *_ in past]
        return DynamicCache(ddp_cache_data=layers, config=self.model.config), keep

    def pin_bias(self, pins: Sequence[PinSpec], tokens: Sequence[str], spans: Sequence[tuple[int, int]], strength: float) -> torch.Tensor | None:
        """The attention bias, in logits, on each model position; None when nothing is pinned."""
        weights = pin_weights(pins, tokens, spans)
        if strength == 0 or not any(weights):
            return None
        return torch.tensor(weights, dtype=self.dtype, device=self.device) * strength

    def focus(
        self,
        tokens: Sequence[str],
        window: int,
        anchor: int = 0,
        *,
        steer: dict[int, torch.Tensor] | None = None,
        pins: Sequence[PinSpec] = (),
        pin_strength: float = 0.0,
        layers: Sequence[int] | None = None,
    ) -> list[float]:
        """What the head of the text attends to: one score per display token, the largest 1.

        The rows of the model tokens under the last `window` display tokens
        are read from the model's attention, averaged over heads and over
        `layers`, summed, and shared out to display tokens by character. Any
        steering and pin bias is applied exactly as in generation, from the
        display token `anchor` on, so the readout shows what the controls do.

        The first position's column is left out: causal models park unused
        attention on whatever comes first, and it would flatten everything else.

        The model is locked for one pass at a time: the kept prefix (cached),
        the text between it and the window, then the window itself in eager mode.
        """
        if not tokens:
            return []
        enc = self.encode("".join(tokens))
        ids, spans = enc.ids, enc.spans
        starts = starts_of(tokens)
        anchor = min(max(anchor, 0), len(tokens))
        a = enc.before(starts[anchor])
        head = min(enc.before(starts[max(0, len(tokens) - window)]), len(ids) - 1)
        bias = self.pin_bias(pins, tokens, spans, pin_strength)
        # a text longer than the model can take is read over its tail only
        skip = max(0, len(ids) - self.max_positions) if self.max_positions else 0
        if skip:
            ids, a, head = ids[skip:], max(0, a - skip), max(0, head - skip)
            bias = bias[skip:] if bias is not None else None
            past, done = None, 0
        else:
            past, done = self.resume(ids, "".join(tokens[:anchor]), head)
        if done < head:
            past = self.forward(ids[done:head], past, steer=steer, anchor=a, bias=bias, logits=False).past_key_values
        out = self.forward(ids[head:], past, steer=steer, anchor=a, bias=bias, attentions=True, logits=False)
        picked = [out.attentions[i] for i in (layers or self.focus_layers)]
        seen = torch.stack([w[0].float().mean(0).sum(0) for w in picked]).mean(0)
        seen[0] = 0.0
        return normalise(to_display([0.0] * skip + seen.tolist(), spans, tokens))
