---
kind: paper
title: Deceptive Grounding — entity attribution failure in clinical RAG
date: 2026-08-27
authors: Caruzzo, Yoo, Kim
venue: arXiv:2607.09349 (Jul 2026)
link: https://arxiv.org/abs/2607.09349
status: reading
summary: Names and quantifies the failure where RAG cites a real document about the wrong entity — passing every hallucination and faithfulness check. 8–87% rate across 13 models.
tags: RAG, retrieval, grounding, evaluation
---

The closest published work to the applicability problem I hit in production, and the paper
that most sharpens what is left of my own contribution.

**The finding.** A RAG system retrieves a genuine, on-topic, correctly-quoted passage —
about the wrong entity. Every faithfulness check passes, because the citation *is*
faithful. They measure 8–87% across 13 models and build an entity-attribution verifier that
catches it at 97.0% precision.

**Why it matters to me.** "Cosine floors are relevance floors, not applicability floors" is
the same observation, arrived at from a compliance rather than a clinical direction. They
got there first and with numbers.

**Where I can still differentiate — and it is narrow.** They treat it as a *post-hoc
verification* problem: detect the bad attribution after retrieval. My mechanism is a
deterministic pre-filter with per-candidate recorded provenance. More usefully, they never
measure **metadata coverage** — whether the entity information the filter needs exists in
the corpus at all. That supply-side measurement is the part I have and they do not.

Any novelty claim I make about "attributing findings to the right entity" is gone. Cite it
early, differentiate on mechanism placement and on the supply measurement, and do not
pretend otherwise.
