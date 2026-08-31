---
kind: paper
title: GraphCompliance — aligning policy and context graphs for LLM-based regulatory compliance
date: 2026-08-22
authors: Chung, Ko, Yoo, Onizuka, Kim, Kim, Shin
venue: arXiv:2510.26309 (Oct 2025)
link: https://arxiv.org/abs/2510.26309
status: reading
summary: Regulations become a policy graph, runtime context becomes a context graph, and graph alignment does the structural work so the LLM only judges the semantic residue. +4.1–7.2pp micro-F1 over LLM-only.
tags: compliance, knowledge-graphs, GDPR
---

The strongest structural alternative to what I built, and the question I expect first from
any reviewer: *why a flat `product_scope` string filter instead of a policy graph?*

**The honest answer.** Because the graph did not exist and building it was not in scope. A
policy graph assumes structure; my measurement was that most of the corpus had no
structure at all — not even a single scope tag. GraphCompliance solves applicability
elegantly *given* a formalised policy; my problem was that formalisation coverage was the
binding constraint.

Which means these two results compose rather than compete: their method is what you build
*after* you have measured and fixed the supply problem. Worth saying explicitly rather than
positioning it as an alternative I rejected.

**Caveats to carry.** 300 synthetic GDPR scenarios, and graph-construction cost is not
reported — which is exactly the cost my corpus could not pay.
