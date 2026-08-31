---
kind: paper
title: SN-WER — script-normalised WER for multi-script Indic ASR evaluation
date: 2026-08-20
authors: Pattnayak
venue: arXiv:2606.02548 (Jun 2026)
link: https://arxiv.org/abs/2606.02548
status: reading
summary: Transliterate reference and hypothesis into one canonical script before computing WER. 67% attenuation of romanization-induced WER inflation, token collision under 0.1%.
tags: speech, ASR, evaluation, Indic
---

Training-free, evaluation-only, and the closest published work to my script finding —
which appeared eleven weeks before I would have claimed it.

**What it owns.** "Transliterate, then score." Five Indic languages, three ASR models,
FLEURS and CommonVoice. It closes inflated performance gaps by up to 12% and it is the
obvious right answer for the monolingual case.

**Where its core assumption breaks.** SN-WER presumes a single canonical script exists per
language. For Hinglish that is false in a way that is not a detail: English tokens in a
code-switched utterance legitimately stay Latin. Canonicalising them to Devanagari is not
normalisation, it is corruption. There is no canonical script for code-switched text —
canonicalisation is *ill-posed*, not merely harder.

**My surviving delta.** Two parts. First, the ill-posedness itself, stated and measured.
Second, and more interesting: the script decision does not only change the *reported* WER,
it changes **consensus yield** — which training data you can obtain at all. That coupling
between scoring policy and data acquisition is not in this paper or in any other I have
found.

**Risk.** Single-author preprint from June 2026. A code-switching extension is the obvious
next step for its author. My window is short.
