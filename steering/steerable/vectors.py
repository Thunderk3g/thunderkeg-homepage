"""Control vectors for Tier B: training them, and checking that they steer.

    python -m steerable.vectors train [--dims tone pace]
    python -m steerable.vectors eval --dim pace [--samples 20] [--positions 5]

A control vector is a direction in the residual stream that separates text
written toward one pole of a dial from text written toward the others. It is
found by contrast: every opening in `contrast_stems` is paired with every
pole's `prompt` as a style instruction, the model reads each one, and the
activation at the last token is recorded at the layers the dimension names.
The vector for a pole at a layer is the first principal component of the
differences between that pole and its opposite (bipolar) or the mean of the
other poles (blend), pointed toward the pole and scaled to length one.

What is recorded at the last token is what the model is about to do there, so
a style shows up only where it is about to matter: sentence length at the end
of a clause, word choice in the middle of one. Openings should therefore stop
at varied points. (On the small model in the tests, openings that all stopped
at one kind of point gave a vector that steered one dial and not the other.)

Each file holds, for one dimension and one model: the unit vectors per pole
and layer, the layers' indices, and the mean length of the residual at each
layer. At run time the vector added at a layer is

    weight of the pole at the dial's position  x  max_strength  x  mean residual length  x  unit vector

so `max_strength` is a fraction of the residual's own size and means the same
thing on a small model as on a large one. A bipolar dimension stores both
poles, the first being the second negated, so the two kinds are applied alike.

`eval` is the acceptance check: with the dial at several positions from 0 to
1 it writes the same samples (same openings, same seeds), scores each one for
the dimension, and reports whether the mean score rises monotonically and
whether the text still reads as the model's own language. It exits 0 when
both hold, 1 when the score is not monotonic, 2 when it is but the language
is broken, which is the sign that `max_strength` is set too high.
"""

from __future__ import annotations

import argparse
import asyncio
import copy
import logging
import math
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING, Callable, Sequence

import torch

from .attention.readout import Runner, layer_range, recording
from .backends.base import GenRequest
from .config import Settings, get_settings
from .dimensions import HERE, Dimension, Dimensions, load_dimensions

if TYPE_CHECKING:
    from .backends.local import LocalSteeringBackend

#: the plain framing of a contrastive prompt, for a model with no chat template
PLAIN_CONTRAST = "Write in a style that is {prompt}.\n\n{stem}"
CHAT_CONTRAST = "Continue this piece of writing in a style that is {prompt}."
PLAIN_JUDGE = "{text}\n\nIn one word, the {dimension} of this passage is"
CHAT_JUDGE = "Passage:\n{text}\n\nWhich one word describes the {dimension} of this passage best: {poles}? Answer with that word only."

#: log-probability below which the unsteered model counts a token as one it would not have written
ODD_TOKEN = math.log(1e-3)

Scorer = Callable[[str], float]


@dataclass
class ControlVector:
    dimension: str
    model: str
    #: indices of the decoder layers the vectors are added after
    layers: list[int]
    #: per pole, one unit vector per layer: (len(layers), hidden)
    poles: dict[str, torch.Tensor]
    #: the mean length of the residual at each layer: (len(layers),)
    norms: torch.Tensor

    def save(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        torch.save(
            {"dimension": self.dimension, "model": self.model, "layers": self.layers, "poles": self.poles, "norms": self.norms},
            path,
        )

    @classmethod
    def load(cls, path: Path) -> ControlVector:
        raw = torch.load(path, map_location="cpu", weights_only=True)
        return cls(str(raw["dimension"]), str(raw["model"]), [int(i) for i in raw["layers"]], dict(raw["poles"]), raw["norms"])


def vector_path(dim: Dimension, vectors_dir: str = "vectors") -> Path:
    """Where a dimension's vectors are kept.

    `tier_b.vector` is a path relative to the steering directory. Its leading
    `vectors/` stands for the configured vectors directory, so pointing
    STEER_VECTORS_DIR elsewhere moves every dimension's file with it.
    """
    rel = Path(str(dim.tier_b.get("vector") or f"vectors/{dim.name}.pt"))
    if rel.parts[0] == "vectors":
        return HERE / vectors_dir / Path(*rel.parts[1:])
    return HERE / rel


def contrast_ids(lm: Runner, stem: str, prompt: str, template: str | None = None) -> list[int]:
    """The tokens of one contrastive prompt: a style instruction, then the opening the model is to continue.

    A model with a chat template gets the instruction as the user's turn and
    the opening as the start of its own reply; any other model gets `template`.
    """
    tok = lm.tokenizer
    if template is None and tok.chat_template:
        messages = [{"role": "user", "content": CHAT_CONTRAST.format(prompt=prompt)}]
        text = tok.apply_chat_template(messages, tokenize=False, add_generation_prompt=True) + stem
        # the rendered template already carries its own special tokens
        return list(tok(text, add_special_tokens=False)["input_ids"])
    return lm.encode((template or PLAIN_CONTRAST).format(prompt=prompt, stem=stem)).ids


def last_activations(lm: Runner, ids: Sequence[int], layers: Sequence[int]) -> torch.Tensor:
    """The residual after each listed layer at the last token: (len(layers), hidden)."""
    with recording(lm.layers, layers) as seen:
        lm.forward(ids, logits=False)
    return torch.stack([seen[i][0, -1].float().cpu() for i in layers])


def first_component(diffs: torch.Tensor) -> torch.Tensor:
    """The direction a set of differences shares: (pairs, hidden) to a unit vector.

    The component is taken about the origin, not about the mean of the
    differences: the shift that every pair has in common is the signal, and
    centring would subtract it. The sign is set so the vector points the way
    the differences point on average.
    """
    diffs = diffs.double()
    _, _, vt = torch.linalg.svd(diffs, full_matrices=False)
    v = vt[0]
    if torch.dot(v, diffs.mean(0)) < 0:
        v = -v
    return (v / v.norm()).float()


def train_dimension(lm: Runner, dim: Dimension, stems: Sequence[str], template: str | None = None) -> tuple[ControlVector, float]:
    """Train one dimension's vectors. Also returns how consistently the pairs agree with them.

    The second value is the share of (opening, pole, layer) differences that
    point the same way as the vector found for that pole and layer: 1.0 means
    every pair separates along it, 0.5 means it is no better than chance.
    """
    if not stems:
        raise ValueError("no contrast_stems to build contrastive prompts from")
    layers = layer_range(lm.depth, *(dim.tier_b.get("layers") or ()))
    # acts[pole][stem] = (layers, hidden)
    acts = torch.stack(
        [torch.stack([last_activations(lm, contrast_ids(lm, stem, pole.prompt, template), layers) for stem in stems]) for pole in dim.poles]
    )
    norms = acts.norm(dim=-1).mean(dim=(0, 1))
    poles: dict[str, torch.Tensor] = {}
    agree: list[float] = []
    targets = [1] if dim.kind == "bipolar" else list(range(len(dim.poles)))
    for p in targets:
        others = [q for q in range(len(dim.poles)) if q != p]
        diffs = acts[p] - acts[others].mean(0)
        vectors = torch.stack([first_component(diffs[:, i]) for i in range(len(layers))])
        poles[dim.poles[p].name] = vectors
        agree.append((torch.einsum("sld,ld->sl", diffs, vectors) > 0).float().mean().item())
    if dim.kind == "bipolar":
        low, high = dim.poles[0].name, dim.poles[1].name
        poles = {low: -poles[high], high: poles[high]}
    return ControlVector(dim.name, lm.name, layers, poles, norms), sum(agree) / len(agree)


def train(
    dims: Dimensions,
    settings: Settings,
    names: Sequence[str] | None = None,
    *,
    template: str | None = None,
    lm: Runner | None = None,
) -> dict[str, Path]:
    """Train and save vectors for the named dimensions (all of them by default); returns where each went."""
    unknown = set(names or ()) - {d.name for d in dims}
    if unknown:
        raise ValueError(f"unknown dimension(s): {', '.join(sorted(unknown))}")
    lm = lm or Runner(settings.local_model, settings.local_device, settings.local_dtype)
    written: dict[str, Path] = {}
    for dim in dims:
        if names and dim.name not in names:
            continue
        vector, agreement = train_dimension(lm, dim, dims.contrast_stems, template)
        path = vector_path(dim, settings.vectors_dir)
        vector.save(path)
        written[dim.name] = path
        print(
            f"{dim.name}: layers {vector.layers[0]}..{vector.layers[-1]} of {lm.depth}, "
            f"residual length {vector.norms.min():.2f}..{vector.norms.max():.2f}, "
            f"pairs agreeing {agreement:.0%} -> {path}"
        )
    return written


def words_per_sentence(text: str) -> float:
    """Mean words per sentence. A last sentence that was cut off is counted only if it is the only one."""
    sentences = [s for s in re.split(r"[.!?]+", text) if s.strip()]
    if len(sentences) > 1 and not re.search(r"[.!?][\"'”’)\s]*$", text):
        sentences = sentences[:-1]
    if not sentences:
        return 0.0
    return sum(len(s.split()) for s in sentences) / len(sentences)


def repetition(text: str) -> float:
    """The share of three-word runs that had already occurred earlier in the same text."""
    words = text.lower().split()
    runs = [tuple(words[i : i + 3]) for i in range(len(words) - 2)]
    return 1 - len(set(runs)) / len(runs) if runs else 0.0


def surprise(lm: Runner, prefix: str, continuation: str) -> tuple[float, float]:
    """How the unsteered model reads `continuation` after `prefix`.

    Returns the mean negative log-likelihood per token, and the share of
    tokens the model gave less than one chance in a thousand. A change of
    style moves the first a little and the second hardly at all; a broken
    word or a sentence that falls apart shows up in the second at once.
    """
    enc = lm.encode(prefix + continuation)
    first = max(1, enc.before(len(prefix)))
    if first >= len(enc.ids):
        return 0.0, 0.0
    logp = torch.log_softmax(lm.forward(enc.ids).logits[0].float(), -1)
    targets = torch.tensor(enc.ids[first:], device=logp.device)
    seen = logp[first - 1 : -1].gather(1, targets[:, None])
    return -seen.mean().item(), (seen < ODD_TOKEN).float().mean().item()


class Judge:
    """Scores a text for a dimension by asking the unsteered model which pole it reads as.

    The text is put in a short classification prompt and the log-probability
    of each pole's name as the next words is read off. For a bipolar
    dimension the score is the second pole's minus the first's. For a blend
    it is the expected position on the arc under those probabilities, 0 at
    the first pole and 1 at the last, so it should rise as the dial is swept.
    """

    def __init__(self, lm: Runner, dim: Dimension, template: str | None = None) -> None:
        self.lm = lm
        self.dim = dim
        self.template = template
        self.chat = template is None and bool(lm.tokenizer.chat_template)
        # a name continues a plain prompt after a space, and opens a chat reply without one
        lead = "" if self.chat else " "
        self.names = [list(lm.tokenizer(lead + p.name, add_special_tokens=False)["input_ids"]) for p in dim.poles]

    def prompt_ids(self, text: str) -> list[int]:
        tok = self.lm.tokenizer
        fields = {"text": text.strip(), "dimension": self.dim.name, "poles": " or ".join(p.name for p in self.dim.poles)}
        if self.chat:
            messages = [{"role": "user", "content": CHAT_JUDGE.format(**fields)}]
            rendered = tok.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
            return list(tok(rendered, add_special_tokens=False)["input_ids"])
        return self.lm.encode((self.template or PLAIN_JUDGE).format(**fields)).ids

    def log_probs(self, text: str) -> list[float]:
        """The log-probability of each pole's name following the classification prompt."""
        out = self.lm.forward(self.prompt_ids(text))
        first = torch.log_softmax(out.logits[0, -1].float(), -1)
        scores: list[float] = []
        for name in self.names:
            total = first[name[0]].item()
            if len(name) > 1:
                more = self.lm.forward(name[:-1], copy.deepcopy(out.past_key_values)).logits[0].float()
                rest = torch.log_softmax(more, -1).gather(1, torch.tensor(name[1:], device=more.device)[:, None])
                total += rest.sum().item()
            scores.append(total)
        return scores

    def __call__(self, text: str) -> float:
        logp = self.log_probs(text)
        if self.dim.kind == "bipolar":
            return logp[1] - logp[0]
        share = torch.softmax(torch.tensor(logp), 0).tolist()
        return sum(s * i / (len(share) - 1) for i, s in enumerate(share))


@dataclass
class Position:
    #: the dial's value; None is the dial left unset
    value: float | None
    scores: list[float] = field(default_factory=list)
    nlls: list[float] = field(default_factory=list)
    odds: list[float] = field(default_factory=list)
    repetitions: list[float] = field(default_factory=list)
    samples: list[str] = field(default_factory=list)

    @property
    def score(self) -> float:
        return sum(self.scores) / len(self.scores)

    @property
    def spread(self) -> float:
        """The standard error of the mean score."""
        n = len(self.scores)
        if n < 2:
            return 0.0
        return math.sqrt(sum((s - self.score) ** 2 for s in self.scores) / (n - 1) / n)

    @property
    def nll(self) -> float:
        return sum(self.nlls) / len(self.nlls)

    @property
    def odd(self) -> float:
        return sum(self.odds) / len(self.odds)

    @property
    def repetition(self) -> float:
        return sum(self.repetitions) / len(self.repetitions)


@dataclass
class Report:
    dim: Dimension
    scorer: str
    tokens: int
    baseline: Position
    positions: list[Position]
    max_nll_rise: float
    max_odd_rise: float
    max_repetition_rise: float

    @property
    def monotonic(self) -> bool:
        """The mean score never falls from one dial position to the next, and ends above where it began."""
        means = [p.score for p in self.positions]
        return all(b >= a for a, b in zip(means, means[1:])) and means[-1] > means[0]

    @property
    def nll_rise(self) -> float:
        return max(p.nll for p in self.positions) - self.baseline.nll

    @property
    def odd_rise(self) -> float:
        return max(p.odd for p in self.positions) - self.baseline.odd

    @property
    def repetition_rise(self) -> float:
        return max(p.repetition for p in self.positions) - self.baseline.repetition

    @property
    def grammar_intact(self) -> bool:
        return (
            self.nll_rise <= self.max_nll_rise
            and self.odd_rise <= self.max_odd_rise
            and self.repetition_rise <= self.max_repetition_rise
        )

    def table(self) -> str:
        n = len(self.baseline.scores)
        lines = [
            f"{self.dim.name}: {self.scorer}; {n} samples at each of {len(self.positions)} dial positions, {self.tokens} tokens each",
            f"{'dial':>6}  {'reads as':<22}{'score':>9}{'± s.e.':>9}{'nll/tok':>9}{'odd':>8}{'repeat':>8}",
        ]
        for p in [self.baseline, *self.positions]:
            dial = "unset" if p.value is None else f"{p.value:.2f}"
            lines.append(
                f"{dial:>6}  {self.dim.readout(p.value):<22}{p.score:>9.3f}{p.spread:>9.3f}{p.nll:>9.3f}{p.odd:>8.3f}{p.repetition:>8.3f}"
            )
        first, last = self.positions[0].score, self.positions[-1].score
        lines.append(f"monotonic: {'yes' if self.monotonic else 'NO'} (mean score {first:.3f} at 0 to {last:.3f} at 1)")
        lines.append(
            f"grammar: {'intact' if self.grammar_intact else 'BROKEN'} "
            f"(worst rise over the unset dial: nll/token {self.nll_rise:+.3f}, limit {self.max_nll_rise:+.2f}; "
            f"odd tokens {self.odd_rise:+.3f}, limit {self.max_odd_rise:+.2f}; "
            f"repetition {self.repetition_rise:+.3f}, limit {self.max_repetition_rise:+.2f})"
        )
        return "\n".join(lines)


async def evaluate(
    backend: LocalSteeringBackend,
    dim: Dimension,
    *,
    samples: int = 20,
    positions: int = 5,
    tokens: int = 60,
    scorer: Scorer | None = None,
    scorer_name: str | None = None,
    stems: Sequence[str] | None = None,
    max_nll_rise: float = 0.5,
    max_odd_rise: float = 0.01,
    max_repetition_rise: float = 0.15,
) -> Report:
    """Sweep one dial from 0 to 1 and measure what it does to the text.

    Sample i is written from the same opening with the same seed at every
    position, so the only thing that differs between positions is the dial.
    Each sample is scored for the dimension (mean words per sentence for
    `pace`, the model's own judgement otherwise, unless a scorer is given) and
    for three signs of broken language. Two are read from the model with
    steering off: the sample's mean negative log-likelihood per token, and
    the share of its tokens the model would not have written (`surprise`).
    The third is how much the sample repeats itself. Language counts as
    intact while none of them rises above the unset dial's value by more
    than its limit.
    """
    stems = list(stems or backend.dims.contrast_stems)
    if not stems:
        raise ValueError("no openings to write from: pass stems or add contrast_stems to the dimensions file")
    if scorer is None:
        scorer, scorer_name = (words_per_sentence, "mean words per sentence") if dim.name == "pace" else (Judge(backend.lm, dim), "model judge")
    values: list[float | None] = [None, *(i / (positions - 1) for i in range(positions))]
    rows = [Position(v) for v in values]
    for row in rows:
        for i in range(samples):
            stem = stems[i % len(stems)]
            prefix = backend.split(stem)
            req = GenRequest(
                tokens=prefix, anchor=len(prefix), dials={} if row.value is None else {dim.name: row.value}, pins=[], max_tokens=tokens, seed=i
            )
            text = "".join([t async for chunk in backend.generate(req) for t in chunk])
            row.samples.append(text)
            row.scores.append(scorer(text))
            mean_nll, odd = surprise(backend.lm, stem, text)
            row.nlls.append(mean_nll)
            row.odds.append(odd)
            row.repetitions.append(repetition(text))
    return Report(dim, scorer_name or "custom scorer", tokens, rows[0], rows[1:], max_nll_rise, max_odd_rise, max_repetition_rise)


def _settings(args: argparse.Namespace) -> Settings:
    over = {
        "local_model": args.model,
        "local_device": args.device,
        "local_dtype": args.dtype,
        "vectors_dir": args.vectors_dir,
        "dimensions": args.dimensions,
    }
    return get_settings().model_copy(update={k: v for k, v in over.items() if v is not None})


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="steerable-vectors", description="Train and check Tier B control vectors.")
    shared = argparse.ArgumentParser(add_help=False)
    shared.add_argument("--model", help="hub id or local directory (default: STEER_LOCAL_MODEL)")
    shared.add_argument("--dimensions", help="dimensions file (default: STEER_DIMENSIONS, else dimensions.yaml)")
    shared.add_argument("--vectors-dir", help="where vector files live (default: STEER_VECTORS_DIR)")
    shared.add_argument("--device")
    shared.add_argument("--dtype")
    sub = parser.add_subparsers(dest="command", required=True)

    p_train = sub.add_parser("train", parents=[shared], help="train vectors from contrastive prompts")
    p_train.add_argument("--dims", nargs="*", help="dimensions to train (default: all)")
    p_train.add_argument("--template", help="contrastive prompt with {prompt} and {stem}, used instead of the chat template")

    p_eval = sub.add_parser("eval", parents=[shared], help="check that a dial moves its score monotonically")
    p_eval.add_argument("--dim", required=True)
    p_eval.add_argument("--samples", type=int, default=20)
    p_eval.add_argument("--positions", type=int, default=5, help="dial positions from 0 to 1")
    p_eval.add_argument("--tokens", type=int, default=60, help="tokens written per sample")
    p_eval.add_argument("--scorer", choices=["auto", "words", "judge"], default="auto", help="auto: words per sentence for pace, the model judge otherwise")
    p_eval.add_argument("--judge-template", help="judge prompt with {text}, {dimension} and {poles}, used instead of the chat template")
    p_eval.add_argument("--max-nll-rise", type=float, default=0.5, help="allowed rise in nll/token over the unset dial")
    p_eval.add_argument("--max-odd-rise", type=float, default=0.01, help="allowed rise in the share of tokens the unsteered model finds implausible")
    p_eval.add_argument("--max-repetition-rise", type=float, default=0.15, help="allowed rise in the repetition rate over the unset dial")
    p_eval.add_argument("--show", action="store_true", help="print the first sample at each position")

    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.WARNING, format="%(levelname)s %(name)s: %(message)s")
    settings = _settings(args)
    dims = load_dimensions(settings.dimensions)

    if args.command == "train":
        train(dims, settings, args.dims, template=args.template)
        return 0

    from .backends.local import LocalSteeringBackend

    dim = dims.get(args.dim)
    if dim is None:
        parser.error(f"unknown dimension {args.dim!r}")
    backend = LocalSteeringBackend(dims, settings)
    if args.dim not in backend.vectors:
        print(f"{args.dim}: no usable vectors at {vector_path(dim, settings.vectors_dir)}; run `train` first", file=sys.stderr)
        return 1
    scorer: Scorer | None = None
    name: str | None = None
    if args.scorer == "words":
        scorer, name = words_per_sentence, "mean words per sentence"
    elif args.scorer == "judge" or (args.judge_template and args.dim != "pace"):
        scorer, name = Judge(backend.lm, dim, args.judge_template), "model judge"
    report = asyncio.run(
        evaluate(
            backend,
            dim,
            samples=args.samples,
            positions=args.positions,
            tokens=args.tokens,
            scorer=scorer,
            scorer_name=name,
            max_nll_rise=args.max_nll_rise,
            max_odd_rise=args.max_odd_rise,
            max_repetition_rise=args.max_repetition_rise,
        )
    )
    print(report.table())
    if args.show:
        for p in [report.baseline, *report.positions]:
            print(f"\n[{'unset' if p.value is None else f'{p.value:.2f}'}] {p.samples[0]!r}")
    if not report.monotonic:
        return 1
    return 0 if report.grammar_intact else 2


if __name__ == "__main__":
    sys.exit(main())
