---
kind: post
title: Falsifying my own headline result
date: 2026-08-18
summary: A third ASR hypothesis lifted auto-accept 5.6× at pilot scale. At full corpus scale, with the coverage confound removed, almost all of it disappeared. Three separable mechanisms explain why.
tags: speech, ASR, code-switching, negative-results
---

The best week I had this year was the week I proved myself wrong on the record.

The setup: a code-switched Hinglish call corpus, romanized transcripts, and a
pseudo-labelling pipeline that auto-accepts an utterance when independent ASR systems
agree on it. Two sources gave a per-utterance auto-accept rate low enough to be useless.
Adding a third, script-matched hypothesis took it from **8.82% to 49.30%** — a 5.6× lift,
measured on a pilot slice, written up the same afternoon.

Then I ran it over the whole corpus. **2.74%.**

## Where the 5.6× went

The first thing to check was the obvious confound: the pilot slice had partial coverage,
and partial coverage inflates agreement because the utterances that get all three
hypotheses are the easy ones. Eliminating it moved the number the *wrong* way for my
story — 1.99% → 2.74% as coverage went 62% → 100% — which meant coverage was not the
explanation. The pilot number was simply not the corpus number.

Three mechanisms, separable and individually measurable, account for the gap.

**1. Orthographic divergence blocks corroboration.** In romanized Hinglish, *theek*,
*thik* and *teek* are the same word. Two systems can transcribe an utterance perfectly and
still fail a string-agreement test. Consensus filtering silently assumes commensurable
orthography — an assumption that holds for English and breaks completely for romanized
code-switched speech. This is the interesting part, and it is the part I would publish.

**2. Same-family correlated error.** Two of my three "independent" sources were the same
vendor family. I measured call-level WER between a fresh pass and the existing
vendor-derived reference at **0.035**. That is not independence; that is one system
agreeing with itself. Audhkhasi et al.'s 2014 diversity decomposition predicts almost no
fusion gain from a zero-diversity ensemble, and that is what the full-corpus number shows.
I issued this caveat the same day I recorded the positive result, which is the only reason
the positive result never got quoted anywhere it could do damage.

**3. Granularity mismatch.** The pilot measured call-level agreement; the pipeline
consumes utterance-level labels. A call can agree on average while most of its utterances
disagree.

## Why this is not a paper about my pipeline

It would be comfortable to write this up as "we built a consensus pseudo-labelling
pipeline for low-resource code-switched ASR". That paper does not exist to be written.
ROVER is from 1997. Rangappa et al. (Interspeech 2025) published multi-ASR consensus
filtering on call-centre data at 7,500 hours — 50× my scale — and showed that filtering
down to **1.4% of the pseudo-labelled data matches the full set**, which retires "we
generated silver labels at scale" as a contribution outright. Prakash et al., same venue
and year, open by naming multi-stage consensus pipelines as *the problem their work
solves*.

What survives is narrower and, I think, better: **script mismatch, not model count,
dominates consensus yield in romanized code-switched speech.** Nobody has quantified the
cost of the commensurable-orthography assumption failing, because nobody in that
literature works on corpora where it fails.

## The habit this is really about

The mistake that would have mattered was not the 49.30%. Numbers move when you scale them;
that is what scaling is for. The mistake would have been shipping the pilot number and
never running the corpus pass, because the pilot number was *good* and the corpus pass was
*expensive*.

The cheapest way I know to avoid that is to write down, before running anything, the
measurement that would falsify the result — and to treat the fact that you have not run it
yet as a property of the claim rather than a scheduling detail. Every number I report now
carries its n inline for the same reason. A figure quoted without its sample size will
eventually be quoted without its sample size by someone else.
