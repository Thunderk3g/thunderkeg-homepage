"""Layout, dimensions, the prompt compiler and the heuristic focus monitor."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from steerable import protocol as P
from steerable.attention.heuristic import heuristic_scores
from steerable.backends.base import GenRequest, PinSpec
from steerable.dimensions import load_dimensions, parse_dimensions
from steerable.layout import StreamSplitter, line_count, paragraphs, split, wrap
from steerable.prompting import chat_messages, style_block

FIXTURES = Path(__file__).parent / "fixtures"


def test_split_gives_the_text_back():
    for text in ["", "one", "a  \nb  c\n\n d ", "Tabs\tand  spaces.\n", '"Quoted," she said — twice.\n\n\nNext']:
        assert "".join(split(text)) == text


def test_stream_splitter_matches_split():
    text = 'Elara  ran.\n\n"Now," she said, and the gate\nclosed '
    for size in (1, 2, 3, 7, 50):
        s, out = StreamSplitter(), []
        for i in range(0, len(text), size):
            out += s.feed(text[i : i + size])
        out += s.flush()
        assert out == split(text), f"chunks of {size}"


def test_layout_fixture_is_current():
    """The same file is checked by scripts/steer.test.mts, which is what keeps the two wraps in step."""
    cases = json.loads((FIXTURES / "layout.json").read_text())
    for case in cases:
        tokens = split(case["text"])
        assert tokens == case["tokens"]
        assert wrap(tokens, case["cols"]) == case["lines"]
        assert line_count(tokens, case["cols"]) == case["line_count"]
        assert paragraphs(tokens) == case["paragraphs"]


def test_attention_fixture_is_current():
    cases = json.loads((FIXTURES / "attention.json").read_text())
    for case in cases:
        pins = [PinSpec(p["start"], p["end"], p["weight"], "") for p in case["pins"]]
        got = heuristic_scores(case["tokens"], pins, case["window"])
        assert got == pytest.approx(case["scores"], abs=1e-4)


def test_heuristic_focus_follows_echoed_words_and_pins():
    tokens = split("The key was hidden under the stone. Years passed. She thought again of the key and the stone")
    scores = heuristic_scores(tokens, [], window=8)
    key, years = tokens.index(" key"), tokens.index(" Years")
    assert scores[key] > scores[years], "a word the head is echoing outranks one it is not"
    pinned = heuristic_scores(tokens, [PinSpec(years, years + 1, 1.0, "Years")], window=8)
    assert pinned[years] > scores[years]
    assert max(scores) == 1.0 and all(0 <= s <= 1 for s in scores)


def test_dimension_weights_and_readouts():
    dims = load_dimensions()
    pace, tone = dims.get("pace"), dims.get("tone")
    assert pace.weights(0.5) == {} and pace.readout(0.5) == "neutral"
    assert pace.weights(0.0) == {"compressed": 1.0} and pace.readout(0.0) == "very compressed"
    assert pace.readout(2 / 6) == "slightly compressed" and pace.readout(5 / 6) == "somewhat expansive"
    assert tone.weights(0.0) == {"wry": 1.0} and tone.weights(1.0) == {"wondrous": 1.0}
    w = tone.weights(0.2)  # between wry (0) and tender (1/3)
    assert w == pytest.approx({"wry": 0.4, "tender": 0.6})
    assert tone.readout(0.2) == "tender 60%" and tone.readout(None) == "unset"
    assert tone.pole_position("somber") == pytest.approx(2 / 3)
    assert pace.quantise(0.49) == 0.5 and pace.quantise(0.49, "B") == pytest.approx(12 / 24)
    assert dims.quantise({"tone": 0.2, "pace": None, "mode": 0.99}, "A") == {"tone": pytest.approx(2 / 12), "mode": 1.0}


def test_the_yaml_is_validated():
    with pytest.raises(ValueError, match="exactly two poles"):
        parse_dimensions({"dimensions": [{"name": "x", "kind": "bipolar", "poles": [{"name": "a"}]}]})
    with pytest.raises(ValueError, match="kind"):
        parse_dimensions({"dimensions": [{"name": "x", "kind": "ring", "poles": [{"name": "a"}, {"name": "b"}]}]})
    with pytest.raises(ValueError, match="unique"):
        one = {"name": "x", "kind": "bipolar", "poles": [{"name": "a"}, {"name": "b"}]}
        parse_dimensions({"dimensions": [one, one]})


def test_the_style_block_says_what_the_dials_say():
    dims = load_dimensions()
    block = style_block(dims, {"tone": 0.25, "pace": 1.0, "tension": 0.5}, [PinSpec(0, 1, 0.9, "hidden"), PinSpec(3, 5, 0.2, "Shadows  stretched")])
    assert "tone: mostly tender (75%) with some wry (25%)" in block
    assert "pace: very expansive (100%)" in block
    assert "tension" not in block, "a dial at its neutral centre says nothing"
    assert '"hidden" (must stay central)' in block and '"Shadows stretched" (keep lightly in mind)' in block
    assert style_block(dims, {}, []) == ""


def test_the_request_carries_the_text_and_the_framing():
    dims = load_dimensions()
    req = GenRequest(tokens=split("One. Two"), anchor=1, dials={"mode": 1 / 3}, pins=[], max_tokens=50, seed=1, task="sales")
    system, user = chat_messages(dims, req)
    assert "sales advisor" in system["content"] and "mode: dialogue" in system["content"]
    assert "One. Two" in user["content"]


def test_messages_are_validated():
    assert isinstance(P.client_msg.validate_python({"type": "set_dial", "dim": "tone", "value": 0.4}), P.SetDial)
    assert isinstance(P.client_msg.validate_json('{"type":"scrub","position_tok":12,"seq":3}'), P.Scrub)
    with pytest.raises(Exception):
        P.client_msg.validate_python({"type": "set_dial", "dim": "tone", "value": 1.4})
    with pytest.raises(Exception):
        P.client_msg.validate_python({"type": "launch"})
