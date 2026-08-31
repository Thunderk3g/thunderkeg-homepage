---
kind: post
title: A permissive default is an unverified claim about a distribution
date: 2026-08-06
summary: The applicability filter was correct. It reported itself healthy the entire time. Most of the corpus never reached it.
tags: retrieval, RAG, compliance, architecture
---

Retrieval scores are relevance scores. They are not applicability scores, and the
difference is the whole problem.

A compliance grader retrieves precedents and rules that look like the document under
review. Cosine similarity and `ts_rank` both answer "is this chunk about the same thing?"
Neither answers "does this rule *apply* to this product?" An on-topic passage about the
wrong product sails over any similarity floor you set, because it is genuinely on-topic.
The failure is not a retrieval failure. The retrieval worked.

So I added a deterministic applicability judge: exact metadata match on product scope,
decided *before* similarity ranking, with a per-candidate accept/reject verdict recorded
so any decision could be reconstructed later. Good mechanism. Verified. Tested.

## The measurement I nearly did not run

Verifying a filter is not verifying that anything reaches it.

I measured coverage of the metadata the filter depends on. Most of the precedent corpus
and nearly all of the active rules carried **no product scope at all** — overwhelmingly
the machine-extracted ones, which were roughly half the live corpus. And because the
default for an untagged candidate was *permissive* — let it through rather than drop it —
every one of those candidates bypassed the mechanism entirely.

The filter had a near-perfect accept rate on the candidates it saw. It reported itself
healthy throughout. It was healthy. It was also starved.

## The general form

A permissive default is adopted for a good reason: dropping candidates you cannot classify
loses recall, and losing recall in a compliance system means missing a violation. That
reasoning is correct.

But the reasoning contains a hidden empirical claim: *most candidates will be tagged, so
the permissive branch is an edge case.* That is a claim about a distribution, and I never
measured the distribution. When I finally did, it was the opposite of the assumption — the
permissive branch was the *main* path.

This generalises past retrieval. Any default that exists to handle missing data encodes a
belief about how often data is missing. The belief is testable. It is almost never tested,
because the mechanism's own metrics are computed over the population that reached it, and
that population is exactly the one the default excluded.

**Instrument the supply, not just the mechanism.** The number you want is not "what
fraction of evaluated candidates did the filter accept?" It is "what fraction of the corpus
is even eligible to be evaluated?"

## What changed

I inverted the default to fail-closed, which excluded a meaningful block of legacy rules
from grading — and put that exclusion in the product UI, visibly, rather than hiding it
behind a healthy-looking number. A reviewer seeing "N rules excluded: no product scope" can
act on it. A reviewer seeing a 97% filter accept rate cannot.

The closest published work I have found is **Deceptive Grounding** (arXiv:2607.09349),
which names and quantifies the failure — a RAG system citing a real document about the
wrong entity, passing every faithfulness check — in a clinical setting. It treats it as a
post-hoc verification problem and never measures metadata coverage. **GraphCompliance**
(arXiv:2510.26309) solves applicability structurally with a policy graph, but assumes the
structure exists.

Neither asks the supply-side question, which is the only part of this I think is actually
unclaimed: *the filter was correct and starved, and its own metrics could not have told me.*
