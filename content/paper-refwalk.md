---
kind: paper
title: Citation-closure retrieval and per-rule attribution for regulatory compliance QA (RefWalk)
date: 2026-08-26
authors: Ju, Lee
venue: arXiv:2605.29742 (May 2026, under review)
link: https://arxiv.org/abs/2605.29742
status: reading
summary: Cross-document citation-closure traversal with explicit per-rule attribution, plus a new benchmark. The single most dangerous paper for my compliance manuscript's novelty claims.
tags: compliance, RegNLP, attribution, retrieval
---

Per-rule attribution — every finding traced to the specific provision that produced it — is
functionally my grounding-tier provenance, published first, formalised, and shipped with a
benchmark (RegOps-Bench).

**What this costs me.** Any claim that "each finding is attributed to a specific rule" is
novel is gone. It was, honestly, always engineering hygiene rather than a research
contribution; this paper just makes that unarguable.

**What is genuinely useful in it.** The observation that existing systems saturate on flat
rule structures — which is adjacent to, but not the same as, the constraint-density result.
They are describing a *retrieval* saturation over a flat rule graph; I am describing a
*selectivity* property of the rules themselves. Worth working out precisely how those two
relate before I write the related-work section, because a reviewer will assume they are the
same thing unless told otherwise.

**Reading note.** Under review, so the version I have may not be the version that lands.
Re-check before citing.
