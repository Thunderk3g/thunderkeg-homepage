"""Dimensions: the dials, loaded from YAML.

A dimension turns a position on its arc into three things: the quantum the
cache is keyed on, the weight of each pole (what both tiers steer with), and
the words the interface shows.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

HERE = Path(__file__).resolve().parent.parent
DEFAULT_DIMENSIONS = HERE / "dimensions.yaml"
DEFAULT_SIM = HERE / "sim.yaml"


@dataclass(frozen=True)
class Pole:
    name: str
    description: str = ""
    prompt: str = ""


@dataclass(frozen=True)
class Dimension:
    name: str
    kind: str  # bipolar | blend
    steps: int
    poles: tuple[Pole, ...]
    description: str = ""
    tier_b: dict[str, Any] = field(default_factory=dict)

    def steps_for(self, tier: str) -> int:
        if tier == "B" and self.tier_b.get("steps"):
            return int(self.tier_b["steps"])
        return self.steps

    def quantise(self, value: float, tier: str = "A") -> float:
        steps = self.steps_for(tier)
        return round(min(1.0, max(0.0, value)) * steps) / steps

    def pole_position(self, pole: str) -> float:
        names = [p.name for p in self.poles]
        if pole not in names:
            raise KeyError(f"{self.name} has no pole {pole!r}")
        return names.index(pole) / (len(names) - 1)

    def weights(self, value: float) -> dict[str, float]:
        """How much of each pole a position carries. Poles at zero are left out."""
        value = min(1.0, max(0.0, value))
        if self.kind == "bipolar":
            low, high = self.poles[0].name, self.poles[1].name
            if value < 0.5:
                return {low: round((0.5 - value) * 2, 6)}
            if value > 0.5:
                return {high: round((value - 0.5) * 2, 6)}
            return {}
        n = len(self.poles)
        x = value * (n - 1)
        i = min(int(x), n - 2)
        f = round(x - i, 6)
        out = {self.poles[i].name: round(1 - f, 6), self.poles[i + 1].name: f}
        return {k: v for k, v in out.items() if v > 1e-6}

    def readout(self, value: float | None) -> str:
        """What the interface prints: "very relaxed", "tender 59%"."""
        if value is None:
            return "unset"
        w = self.weights(value)
        if not w:
            return "neutral"
        pole, weight = max(w.items(), key=lambda kv: kv[1])
        if self.kind == "bipolar":
            return f"{adverb(weight)} {pole}"
        return f"{pole} {round(weight * 100)}%"

    def pole(self, name: str) -> Pole:
        return next(p for p in self.poles if p.name == name)

    def public(self, tier: str) -> dict[str, Any]:
        return {
            "name": self.name,
            "kind": self.kind,
            "steps": self.steps_for(tier),
            "description": self.description,
            "poles": [{"name": p.name, "description": p.description} for p in self.poles],
        }


def adverb(strength: float) -> str:
    if strength <= 0.34:
        return "slightly"
    if strength <= 0.67:
        return "somewhat"
    return "very"


@dataclass(frozen=True)
class Task:
    id: str
    label: str
    framing: str
    seed: str
    sim: bool = False

    def public(self) -> dict[str, Any]:
        return {"id": self.id, "label": self.label, "seed": self.seed, "sim": self.sim}


@dataclass(frozen=True)
class Dimensions:
    dims: tuple[Dimension, ...]
    tasks: tuple[Task, ...]
    contrast_stems: tuple[str, ...] = ()

    def __iter__(self):
        return iter(self.dims)

    def get(self, name: str) -> Dimension | None:
        return next((d for d in self.dims if d.name == name), None)

    def task(self, task_id: str | None) -> Task | None:
        return next((t for t in self.tasks if t.id == task_id), None) or (self.tasks[0] if self.tasks else None)

    def quantise(self, dials: dict[str, float | None], tier: str) -> dict[str, float]:
        """The set dials, each snapped to its quantum, in file order."""
        out: dict[str, float] = {}
        for d in self.dims:
            v = dials.get(d.name)
            if v is not None:
                out[d.name] = d.quantise(v, tier)
        return out


def parse_dimensions(raw: dict[str, Any]) -> Dimensions:
    dims: list[Dimension] = []
    for entry in raw.get("dimensions") or []:
        poles = tuple(
            Pole(name=str(p["name"]), description=str(p.get("description", "")), prompt=str(p.get("prompt", "")))
            for p in entry.get("poles") or []
        )
        kind = str(entry.get("kind", "bipolar"))
        name = str(entry["name"])
        if kind not in ("bipolar", "blend"):
            raise ValueError(f"dimension {name}: kind must be bipolar or blend, not {kind!r}")
        if kind == "bipolar" and len(poles) != 2:
            raise ValueError(f"dimension {name}: a bipolar dimension has exactly two poles")
        if len(poles) < 2:
            raise ValueError(f"dimension {name}: at least two poles")
        steps = int(entry.get("steps", 6))
        if steps < 2:
            raise ValueError(f"dimension {name}: steps must be at least 2")
        dims.append(
            Dimension(
                name=name,
                kind=kind,
                steps=steps,
                poles=poles,
                description=str(entry.get("description", "")),
                tier_b=dict(entry.get("tier_b") or {}),
            )
        )
    if len({d.name for d in dims}) != len(dims):
        raise ValueError("dimension names must be unique")
    tasks = tuple(
        Task(
            id=str(t["id"]),
            label=str(t.get("label", t["id"])),
            framing=str(t.get("framing", "")).strip(),
            seed=str(t.get("seed", "")).strip("\n"),
            sim=bool(t.get("sim", False)),
        )
        for t in raw.get("tasks") or []
    )
    return Dimensions(dims=tuple(dims), tasks=tasks, contrast_stems=tuple(raw.get("contrast_stems") or ()))


def load_dimensions(path: str | Path | None = None) -> Dimensions:
    with open(path or DEFAULT_DIMENSIONS, encoding="utf-8") as fh:
        return parse_dimensions(yaml.safe_load(fh))


def load_sim(path: str | Path | None = None) -> dict[str, Any]:
    with open(path or DEFAULT_SIM, encoding="utf-8") as fh:
        return yaml.safe_load(fh)
