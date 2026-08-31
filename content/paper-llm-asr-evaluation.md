---
kind: paper
title: Evaluation of automatic speech recognition using generative large language models
date: 2026-08-12
authors: Bañeras-Roux, Kumar, Khalil, Burdisso, Motlicek, Liu, Rouvier, Wottawa, Dufour
venue: arXiv:2604.21928 (Apr 2026)
link: https://arxiv.org/abs/2604.21928
status: reading
summary: Three LLM-based ASR evaluation protocols benchmarked against human error annotations. Best LLMs reach 92–94% agreement with human annotators, against 63% for WER.
tags: speech, evaluation, LLM-as-judge
---

The number that makes the whole "beyond WER" line fundable: **92–94% agreement with human
annotators versus 63% for WER**, measured on the HATS human-annotation set.

**Why this is the paper to extend rather than duplicate.** It establishes the method and
the human-agreement bar. What it does not cover is exactly my setting: romanized
code-switching, 8 kHz telephony, and domain entities where the error that matters is a
policy ID or a premium amount rather than a function word. It is also pairwise
best-hypothesis selection rather than end-to-end system scoring.

**The uncomfortable part.** Burdisso and Motlicek appear here *and* on both call-centre
pseudo-labelling papers. One group holds the call-centre pipeline and the LLM-evaluation
method, and is visibly converging on the thesis I want to write. An Indic or
code-switching extension from them is the obvious next move. Realistic window: about twelve
months.

**What I hold that they do not.** A human-adjudicated anchor on real code-switched
telephony — and metric papers live or die on human agreement, not on the metric's
elegance. Reporting κ rather than raw agreement percentages is the first thing to fix.
