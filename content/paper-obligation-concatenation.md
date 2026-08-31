---
kind: paper
title: Is obligation concatenation really all you need? (AUEB-Archimedes at RIRAG-2025)
date: 2026-08-08
authors: Chasandras, Chlapanis, Androutsopoulos
venue: RegNLP 2025 @ COLING · arXiv:2412.11567
link: https://arxiv.org/abs/2412.11567
status: read
summary: Naively concatenating retrieved obligations scores near the top on RePASs, the RegNLP shared task's own metric. A negative result about a compliance metric, published at the venue that defined it.
tags: compliance, RegNLP, evaluation, negative-results
---

Short, sharp, and the precedent I point at whenever someone tells me a negative result
about a metric is not publishable.

**The finding.** RePASs — the RegNLP shared-task metric scoring obligation coverage without
contradiction — can be scored near-top by concatenating retrieved obligations with no
reasoning at all. The metric rewards a behaviour it was not designed to reward.

**Why I care.** My own scoring function saturated: `clamp[0,100](100 − Σ w·c)` pins at zero
past roughly a dozen moderate findings, so a lightly-flagged document and a catastrophically
flagged one both score 0.0/F, and every downstream consumer inherits a number that stays
plausible while carrying no information. Same genre of failure — a compliance metric that
stops discriminating — and this paper is the evidence that the genre publishes.

**What it does not give me.** A replacement metric. Neither does mine: the hyperbolic
soft-tail policy I shipped *relocates* discriminating power rather than restoring it, and
the writeup says so. Two papers noting a metric degenerates, neither proposing the fix, is
a gap worth being honest about rather than papering over.

**Related in my own reading:** this is the same shape as the coverage/density argument —
a number that cannot go down is not a measurement.
