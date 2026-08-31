---
kind: paper
title: Efficient data selection for domain adaptation of ASR using pseudo-labels and multi-stage filtering
date: 2026-08-15
authors: Rangappa, Carofilis, Prakash, Burdisso, Madikeri, Motlicek, Stolcke et al.
venue: Interspeech 2025 · arXiv:2506.03681
link: https://arxiv.org/abs/2506.03681
status: read
summary: Multi-ASR pseudo-labels filtered by WER-prediction, NER and CER analysis over three systems. 7,500h of call-centre data fine-tunes to 12.3% WER — and filtering to 100h (1.4%) matches it.
tags: speech, ASR, pseudo-labelling, call-centre
---

The paper that retired my pipeline as a contribution, and I am glad I read it before
writing rather than after.

**What it does.** Exactly my architecture — pseudo-labels from multiple ASR systems,
consensus/agreement filtering, applied to call-centre audio — at roughly 50× my scale, a
year earlier, by Uniphore and Idiap. Its "CER over three ASR systems" baseline *is* my
three-source consensus.

**The result that hurts most.** Filtering to 1.4% of the pseudo-labelled data matches
training on the full set. "We generated silver labels at scale" is therefore not a
contribution to anything. Volume was never the scarce thing.

**What it does not cover, which is where I still live.** English. No code-switching, no
script mismatch, no romanization. Their filtering assumes commensurable orthography across
systems — the assumption whose failure dominates my yield numbers. They never had to
question it because for English it holds.

**Companion papers to read together with it.** Carofilis et al. (arXiv:2506.04981) —
consensus filtering outperforms alternatives by up to 22.3% relative on the same
call-centre corpus. Prakash et al. (Interspeech 2025) — a SpeechLLM fuses and corrects
multi-ASR output jointly, and opens by framing multi-stage consensus pipelines as *the
problem*. Same group, converging from several directions at once.
