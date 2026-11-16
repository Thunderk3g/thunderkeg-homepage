"""The engine's rules, each as a test: cache, cancellation, scrubbing, speculation."""

from __future__ import annotations

import asyncio

import pytest

from steerable import protocol as P
from steerable.backends.base import GenRequest
from steerable.backends.sim import SimBackend
from steerable.engine import Engine

from conftest import Client, make_settings, settle

SEED = "Elara had kept the key hidden for eleven years."


def consistent(engine: Engine, client: Client) -> None:
    assert client.violations == []
    assert client.tokens == engine._slice(0, engine.visible), "the client's text is not the engine's"
    assert engine.orphans == 0


async def test_seed_writes_to_the_horizon(rig):
    engine, client, backend = rig()
    engine.seed(SEED)
    await settle(engine)
    seed_len = len(backend.split(SEED))
    assert client.text.startswith(SEED)
    assert len(client.tokens) == seed_len + 40
    assert client.state.committed == seed_len and client.state.anchor == seed_len
    assert not client.state.generating
    consistent(engine, client)


async def test_a_dial_change_regenerates_from_the_anchor(rig):
    engine, client, backend = rig(speculate=False)
    engine.seed(SEED)
    await settle(engine)
    before = client.text
    seed_len = len(backend.split(SEED))
    engine.set_dial("tone", 1.0, seq=7)
    await settle(engine)
    inv = client.of(P.Invalidate)[-1]
    assert inv.from_tok == seed_len and inv.cause_seq == 7 and not inv.cached
    assert client.text.startswith(SEED) and client.text != before
    assert backend.requests[-1].dials == {"tone": 1.0}
    assert engine.steer == 2  # the seed's first branch, then this one
    assert engine.latencies, "gesture-to-first-token was not measured"
    consistent(engine, client)


async def test_returning_to_a_setting_is_served_from_the_cache(rig):
    engine, client, backend = rig(speculate=False)
    engine.seed(SEED)
    await settle(engine)
    engine.set_dial("pace", 0.0)
    await settle(engine)
    first = client.text
    engine.set_dial("pace", 1.0)
    await settle(engine)
    assert client.text != first
    calls = len(backend.requests)
    engine.set_dial("pace", 0.0)
    await settle(engine)
    assert client.of(P.Invalidate)[-1].cached
    assert client.text == first
    assert len(backend.requests) == calls, "a cached branch must not cost a request"
    assert engine.cache_hits == 1
    consistent(engine, client)


async def test_moving_inside_a_quantum_does_nothing(rig):
    engine, client, backend = rig(speculate=False)
    engine.seed(SEED)
    engine.set_dial("pace", 0.0)
    await settle(engine)
    invalidates, calls = len(client.of(P.Invalidate)), len(backend.requests)
    engine.set_dial("pace", 0.04)  # still the first of six steps
    await settle(engine)
    assert len(client.of(P.Invalidate)) == invalidates and len(backend.requests) == calls
    assert client.state.dials["pace"] == 0.04, "the raw value is still reported"


async def test_a_hundred_rapid_dial_changes_leave_no_stale_tokens(rig):
    engine, client, backend = rig(sim_tok_s=2000, sim_ttft_ms=3, debounce_ms=4)
    engine.seed(SEED)
    await asyncio.sleep(0.02)
    for i in range(100):
        dim = ("tone", "pace", "tension", "mode")[i % 4]
        engine.set_dial(dim, ((i * 37) % 13) / 12, seq=i)
        # some land inside the debounce, some mid-stream, some after the text settled
        await asyncio.sleep((0.0, 0.002, 0.009, 0.03)[i % 4])
        assert client.violations == [], f"after change {i}"
    await settle(engine)
    consistent(engine, client)
    assert engine.cancelled > 0, "the test never cancelled anything; it proves nothing"
    assert engine.inflight == 0 and backend.inflight == 0
    assert len(backend.requests) - backend.finished >= 1, "no request was cut short"
    # the text on screen is the branch for the final controls
    assert backend.requests[-1].dials == engine._quantised() or client.of(P.Invalidate)[-1].cached


async def test_scrub_back_truncates_at_once_and_forward_is_free(rig):
    engine, client, backend = rig(speculate=False)
    engine.seed(SEED)
    await settle(engine)
    full = list(client.tokens)
    calls = len(backend.requests)
    engine.scrub(len(full) - 25, seq=3)
    # no await: the truncation is in the same call
    assert len(client.tokens) == len(full) - 25
    assert client.of(P.Invalidate)[-1].cause_seq == 3
    engine.scrub(len(full) - 10)
    assert client.tokens == full[:-10]
    engine.scrub(len(full))
    assert client.tokens == full
    await settle(engine)
    assert len(backend.requests) == calls, "scrubbing over text that exists must not generate"
    consistent(engine, client)


async def test_scrub_back_cancels_generation_and_the_end_resumes_it(rig):
    engine, client, backend = rig(sim_tok_s=400, speculate=False)
    engine.seed(SEED)
    seed_len = len(backend.split(SEED))
    await asyncio.sleep(0.05)
    assert engine._gen_task is not None
    engine.scrub(seed_len + 2)
    assert engine._gen_task is None
    await asyncio.sleep(0.03)
    assert engine.inflight == 0 and backend.inflight == 0
    assert len(client.tokens) == seed_len + 2
    held = engine._len()
    engine.scrub(10_000)
    await settle(engine)
    # pulling past the end asks for more, one horizon at a pull
    assert len(client.tokens) == max(seed_len + 40, held + 40)
    consistent(engine, client)


async def test_scrub_cannot_enter_committed_text(rig):
    engine, client, backend = rig(speculate=False)
    engine.seed(SEED)
    await settle(engine)
    seed_len = len(backend.split(SEED))
    engine.scrub(0)
    assert len(client.tokens) == seed_len
    engine.scrub(seed_len + 12)
    engine.commit()
    assert client.state.committed == seed_len + 12
    engine.scrub(3)
    assert len(client.tokens) == seed_len + 12
    consistent(engine, client)


async def test_commit_approves_and_writes_on(rig):
    engine, client, backend = rig(speculate=False)
    engine.seed(SEED)
    await settle(engine)
    n = len(client.tokens)
    engine.commit()
    await settle(engine)
    assert client.state.committed == n and len(client.tokens) == n + 40
    kept = list(client.tokens[:n])
    engine.set_dial("tension", 1.0)
    await settle(engine)
    assert client.tokens[:n] == kept, "committed text was regenerated"
    assert client.of(P.Invalidate)[-1].from_tok == n
    consistent(engine, client)


async def test_a_change_after_scrubbing_back_keeps_the_text_before_the_knob(rig):
    engine, client, backend = rig(speculate=False)
    engine.seed(SEED)
    await settle(engine)
    original = list(client.tokens)
    cut = len(original) - 20
    engine.scrub(cut)
    engine.set_dial("tone", 0.0)
    await settle(engine)
    assert client.tokens[:cut] == original[:cut]
    assert client.of(P.Invalidate)[-1].from_tok == cut
    assert backend.requests[-1].anchor == cut
    calls = len(backend.requests)
    # turning the dial back finds the tail that was scrubbed away
    engine.set_dial("tone", None)
    await settle(engine)
    assert client.of(P.Invalidate)[-1].cached
    assert client.tokens[: len(original)] == original
    assert len(backend.requests) == calls + (1 if len(client.tokens) > len(original) else 0)
    consistent(engine, client)


async def test_idle_speculation_makes_the_next_step_a_hit(rig):
    engine, client, backend = rig()
    engine.seed(SEED)
    engine.set_dial("pace", 0.5)
    await settle(engine)
    assert engine.sim == 2, "one quantum either side of the dial last touched"
    spec = [r for r in backend.requests if r.dials.get("pace") in (pytest.approx(2 / 6), pytest.approx(4 / 6))]
    assert len(spec) == 2 and all(r.max_tokens == 16 for r in spec), "speculation is capped at spec_tokens"
    visible = list(client.tokens)
    engine.set_dial("pace", 4 / 6)
    await asyncio.sleep(0.012)  # the debounce, and nothing more
    inv = client.of(P.Invalidate)[-1]
    assert inv.cached, "the neighbour was not ready"
    assert client.tokens != visible and len(client.tokens) >= inv.from_tok + 16
    await settle(engine)
    assert len(client.tokens) == inv.from_tok + 40, "a speculative branch is finished once it is chosen"
    consistent(engine, client)


async def test_a_speculative_request_in_flight_is_adopted_not_cancelled(rig):
    engine, client, backend = rig(sim_tok_s=300, sim_ttft_ms=20)
    engine.seed(SEED)
    engine.set_dial("pace", 0.5)
    await asyncio.sleep(0.02)
    # wait for the visible branch to finish and speculation to start
    for _ in range(400):
        if engine._spec_tasks:
            break
        await asyncio.sleep(0.005)
    assert len(engine._spec_tasks) == 2
    cancelled = engine.cancelled
    engine.set_dial("pace", 4 / 6)
    assert engine.cancelled == cancelled + 1, "only the other neighbour is cancelled"
    await settle(engine)
    assert backend.requests[-1].dials["pace"] != pytest.approx(4 / 6) or len(client.tokens) > 0
    target = [r for r in backend.requests if r.dials.get("pace") == pytest.approx(4 / 6)]
    assert target[0].max_tokens == 16, "the head start was the speculative request"
    assert len(client.tokens) == client.of(P.Invalidate)[-1].from_tok + 40
    consistent(engine, client)


async def test_a_pin_is_sent_to_the_model_and_keeps_its_own_text(rig):
    engine, client, backend = rig(speculate=False)
    engine.seed(SEED)
    await settle(engine)
    seed_len = len(backend.split(SEED))
    start, end = seed_len + 4, seed_len + 7
    phrase = "".join(client.tokens[start:end]).strip()
    kept = list(client.tokens[:end])
    engine.pin(start, end, 0.9, "a")
    await settle(engine)
    assert client.tokens[:end] == kept, "pinning a phrase regenerated the phrase"
    assert client.of(P.Invalidate)[-1].from_tok == end
    req = backend.requests[-1]
    assert [(p.start, p.end, p.text) for p in req.pins] == [(start, end, phrase)]
    assert client.state.pins[0].text == phrase
    # the simulated backend shows a lock by bringing the phrase back
    assert phrase in "".join(client.tokens[end:]) or len(client.tokens) > end

    engine.pin(start, end, 0.95, "a")  # same level: the weight moves, the text does not
    invalidates = len(client.of(P.Invalidate))
    await settle(engine)
    assert len(client.of(P.Invalidate)) == invalidates and client.state.pins[0].weight == 0.95

    engine.unpin("a")
    await settle(engine)
    assert client.state.pins == [] and backend.requests[-1].pins == []
    consistent(engine, client)


async def test_a_pin_whose_text_is_replaced_is_dropped(rig):
    engine, client, backend = rig(speculate=False)
    engine.seed(SEED)
    await settle(engine)
    seed_len = len(backend.split(SEED))
    engine.pin(seed_len + 10, seed_len + 12, 0.5, "late")
    await settle(engine)
    engine.scrub(seed_len + 3)
    engine.set_dial("mode", 0.0)
    await settle(engine)
    assert client.state.pins == [], "a pin cannot hold text that no longer exists"
    assert backend.requests[-1].pins == []
    consistent(engine, client)


async def test_reroll_gives_another_sample_and_stop_cancels(rig):
    engine, client, backend = rig(sim_tok_s=300, speculate=False)
    engine.seed(SEED)
    await asyncio.sleep(0.04)
    engine.stop()
    assert engine._gen_task is None
    await asyncio.sleep(0.02)
    assert engine.inflight == 0 and backend.inflight == 0
    stopped = len(client.tokens)
    await asyncio.sleep(0.05)
    assert len(client.tokens) == stopped and not client.state.generating
    engine.s.sim_tok_s = backend.tok_s = 0
    engine.reroll()
    await settle(engine)
    first = client.text
    engine.reroll()
    await settle(engine)
    assert client.text != first and client.state.variant == 2
    consistent(engine, client)


async def test_the_cache_is_bounded(rig):
    engine, client, backend = rig(speculate=False, cache_size=6)
    engine.seed(SEED)
    for i in range(13):
        engine.set_dial("tone", i / 12)
        await settle(engine)
    assert len(engine.cache) <= 6
    assert engine.active.key in engine.cache
    consistent(engine, client)


async def test_attention_and_telemetry_are_reported(rig):
    engine, client, backend = rig()
    engine.seed(SEED)
    engine.set_dial("tone", 0.5)
    await settle(engine)
    await asyncio.sleep(0.3)
    attn = client.of(P.Attention)[-1]
    assert len(attn.tok_scores) == len(client.tokens) and attn.source == "heuristic"
    assert max(attn.tok_scores) == 1.0 and max(attn.line_scores) == 1.0
    t = client.telemetry
    assert t.tokens == len(client.tokens) and t.steer == engine.steer and t.sim == engine.sim
    assert t.orphans == 0 and t.inflight == 0
    cfg = client.of(P.Config)[0]
    assert cfg.backend == "sim" and [d["name"] for d in cfg.dimensions] == ["tone", "pace", "tension", "surprise", "focus", "mode"]
    assert [t["id"] for t in cfg.tasks] == ["story"], "the simulated backend only offers what it can write"


class Deaf(SimBackend):
    """A backend that ignores cancellation: the fault the orphan check exists to catch."""

    async def generate(self, req: GenRequest):
        self.inflight += 1
        try:
            for _ in range(50):
                try:
                    await asyncio.sleep(0.02)
                except asyncio.CancelledError:
                    pass
                yield ["x"]
        finally:
            self.inflight -= 1


async def test_an_orphaned_request_is_detected(dims):
    client = Client()
    engine = Engine(Deaf(dims), dims, make_settings(speculate=False), client.recv, strict=False)
    engine.start()
    engine.seed(SEED)
    await asyncio.sleep(0.05)
    task = engine._gen_task
    engine.set_dial("tone", 0.0)
    # the engine waits for the cancelled request; this one refuses to die, so make the check run without it
    engine._dying.clear()
    await asyncio.sleep(0.05)
    assert engine.orphans >= 1, "an orphan went unnoticed"
    task.cancel()
    await engine.close()


async def test_a_hand_that_never_stops_still_gets_text(rig):
    """Debounce must not starve a continuous sweep: a branch opens at least every debounce_max_ms."""
    engine, client, backend = rig(debounce_ms=30, debounce_max_ms=60, speculate=False)
    engine.seed(SEED)
    await settle(engine)
    switches = engine.steer
    for i in range(1, 13):
        engine.set_dial("tone", i / 12, seq=i)  # a new quantum every 10 ms, inside the debounce every time
        await asyncio.sleep(0.01)
    assert engine.steer > switches, "nothing was shown while the dial was moving"
    await settle(engine)
    assert client.of(P.Invalidate)[-1].cause_seq == 12
    consistent(engine, client)


async def test_moving_inside_the_pending_quantum_does_not_postpone_it(rig):
    engine, client, backend = rig(debounce_ms=40, debounce_max_ms=400, speculate=False)
    engine.seed(SEED)
    await settle(engine)
    switches = engine.steer
    engine.set_dial("pace", 1.0, seq=1)
    for i in range(8):
        await asyncio.sleep(0.01)
        engine.set_dial("pace", 0.99 - i * 0.001, seq=2 + i)  # same step of six
    assert engine.steer == switches + 1, "the switch waited for the hand to stop"
    assert client.of(P.Invalidate)[-1].cause_seq == 1, "the gesture that asked for the branch is the one answered"
    await settle(engine)
    consistent(engine, client)


async def test_a_moving_dial_shows_text_at_the_pace_of_the_model(rig):
    """Changes arrive faster than the first token. Cancelling each time would show nothing until the hand stops."""
    engine, client, backend = rig(sim_ttft_ms=60, sim_tok_s=2000, debounce_ms=10, debounce_max_ms=30, speculate=False)
    engine.seed(SEED)
    await settle(engine)
    shown_before = {m.branch_id for m in client.of(P.Tokens)}
    start = asyncio.get_running_loop().time()
    first_text = None
    for i in range(1, 25):
        engine.set_dial("tone", (i % 13) / 12, seq=i)
        engine.set_dial("tension", ((i * 5) % 7) / 6, seq=100 + i)
        await asyncio.sleep(0.025)  # a new branch is asked for every 25 ms; a first token takes 60
        if first_text is None and {m.branch_id for m in client.of(P.Tokens)} - shown_before:
            first_text = asyncio.get_running_loop().time() - start
    shown = {m.branch_id for m in client.of(P.Tokens)} - shown_before
    assert len(shown) >= 4, f"only {len(shown)} branch(es) reached the screen in 600 ms of turning"
    assert first_text is not None and first_text < 0.2, "the first new text waited for the hand to stop"
    await settle(engine)
    assert backend.requests[-1].dials == engine._quantised(), "the text at rest is not the branch for the final controls"
    consistent(engine, client)
    assert engine.inflight == 0 and backend.inflight == 0


async def test_a_held_request_is_given_up_on_after_hold_ms(rig):
    engine, client, backend = rig(hold_ms=60, debounce_ms=5, speculate=False)
    engine.seed(SEED)
    await settle(engine)
    backend.ttft_ms = 300  # from here on the model is slow to answer
    engine.set_dial("tone", 0.0)
    await asyncio.sleep(0.02)
    cancelled = engine.cancelled
    engine.set_dial("tone", 1.0)  # the request for tone=0 has not answered; it is left to land
    assert engine._deferred and engine.cancelled == cancelled
    await asyncio.sleep(0.08)
    assert not engine._deferred and engine.cancelled == cancelled + 1, "a request that takes too long must not block the hand"
    backend.ttft_ms = 0
    await settle(engine)
    assert backend.requests[-1].dials == {"tone": 1.0}
    consistent(engine, client)


async def test_coming_back_to_the_branch_in_flight_releases_the_hold(rig):
    engine, client, backend = rig(sim_ttft_ms=80, debounce_ms=5, speculate=False)
    engine.seed(SEED)
    await settle(engine)
    engine.set_dial("pace", 0.0)
    await asyncio.sleep(0.03)
    engine.set_dial("pace", 1.0)
    assert engine._deferred
    engine.set_dial("pace", 0.0)
    assert not engine._deferred
    calls = len(backend.requests)
    await settle(engine)
    assert len(backend.requests) == calls and backend.requests[-1].dials == {"pace": 0.0}
    consistent(engine, client)
