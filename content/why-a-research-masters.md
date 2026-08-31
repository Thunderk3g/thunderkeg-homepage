---
kind: post
title: Why I'm applying for a research master's, and what I'd work on
date: 2026-08-24
summary: Four years of production engineering left me with five questions I cannot answer from inside a company. Stating them publicly, along with the track I'm applying to.
tags: research, AI-and-law, speech, career
---

I am applying for a research-track master's in Europe — AI & Law and speech technology,
Erasmus Mundus consortia and Dutch programmes — starting the next intake. This page exists
because I would rather a supervisor find the actual questions than a CV bullet.

The short version of why: I have spent four years building systems where being wrong has a
regulatory consequence, and the interesting part has consistently been the *measurement*,
not the system. Every time I found something genuinely surprising, I found it by
instrumenting something nobody asked me to instrument, and then I had to stop, because the
next step was an experiment and there was no time budget for experiments. That is the right
call inside a company. It is also why I want to be somewhere the experiment *is* the
deliverable.

## The five questions

**1. Where should a hard categorical constraint live in a retrieval system?**
Semantic similarity cannot express "this rule applies only to this product". You can put
the constraint in the embedding, in a SQL filter, or in a post-retrieval deterministic
judge, and the three choices have different failure modes. My argument for the third is
that embedding product scope would cluster precedents *by product* rather than by issue
type — the axis retrieval actually needs to discriminate on. It is an argument. It has no
experiment behind it. ([Longer version](/writing/a-permissive-default-is-a-claim))

**2. Coverage is not constraint — how general is that?**
Measured on the DAPRECO GDPR corpus: 962 rules, mean constraint density 0.462, 43 rules
whose antecedents fire on anything the corpus can describe. A curated insurance rule base
lands at 0.433. Two corpora with nothing in common but their job. Is 0.4-ish a property of
formalised regulatory rule bases generally? That is a measurable question over the handful
of public LegalRuleML corpora and it has not been asked.
([Longer version](/writing/coverage-is-not-constraint))

**3. When does consensus pseudo-labelling fail, and why?**
Orthographic divergence, same-family correlated error, hypothesis-granularity mismatch —
three separable mechanisms, measured at two scales on romanized code-switched Hinglish.
The entire Indic ASR literature assumes native-script references. Real Indian contact-centre
transcripts are ~99.5% Latin script, which breaks the core assumption of every
transliterate-then-score metric published so far.
([Longer version](/writing/falsifying-my-own-result))

**4. What is the right evaluation instrument for romanized code-switched speech?**
Not WER. `theek` / `thik` / `teek` are the same word and WER scores two of them wrong.
SN-WER solves the monolingual Indic case by canonicalising to one script; code-switching
makes canonicalisation ill-posed, because English tokens legitimately stay Latin. A
script-aware, entity-weighted, human-validated metric for Indian financial speech does not
exist, and the entity part matters more than the word part when the entities are policy
IDs, premiums, and the lakh/crore numeral system.

**5. Identifier stability in LLM-built knowledge bases.**
A deduplication hash is stable only if its inputs are stable. Derive one field of that hash
from an LLM at ingestion time and clearing a cache re-derives a different identifier and a
duplicate row. "A content hash is stable" quietly fails when the content is *sampled*. Small
observation, genuinely general, two paragraphs — but I have not found it written down
anywhere.

## What I bring that a fresh graduate does not

Production constraints as a research instinct. I have a reflex for asking what the
measurement would have looked like if the mechanism were broken, because I have shipped
mechanisms that reported themselves healthy while being starved. I have run a paid-API
research programme under hard budget guards and an append-only ledger that reconciles on
re-parse. I have written a data-class export gate under DPDP Act 2023 and IRDAI
localisation rules, and killed a training track over an unresolved vendor terms-of-service
question rather than argue it later.

## What I am missing, stated plainly

No peer-reviewed publication in this area yet — one short paper in preparation for JURIX
2026, one manuscript pending employer clearance. No formal training in legal informatics.
No supervisor. The negative results I am proudest of are, so far, internal documents.

That is the gap the degree is for.

---

*If you supervise in AI & Law, legal knowledge representation, or code-switched speech and
any of the five reads as a real question — [email me](mailto:diwakar.adhikari0@gmail.com).
I would rather be told question 2 was answered in 2019 than find out in review.*
