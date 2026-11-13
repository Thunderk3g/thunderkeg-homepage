---
kind: post
title: Coverage is not constraint
date: 2026-08-31
summary: A rule base can pass every coverage audit and still be, structurally, mostly non-discriminating. Measured over the DAPRECO GDPR knowledge base — 962 rules, mean constraint density 0.462.
tags: legal-informatics, compliance, measurement, JURIX
stack: rule-bases
---

Every compliance system I have worked on eventually gets asked the same question by
someone senior: *are we covering all the rules?* It is a reasonable question and it has a
satisfying answer — a percentage. It is also, I think, close to the wrong question.

Here is the problem stated as plainly as I can. A rule fires when its antecedent is
satisfied. Coverage tells you how many rules you evaluated. It tells you nothing about how
many of them *could have failed to fire*. A rule whose antecedent is satisfied by every
scenario your system is capable of describing is a rule that is always evaluated, always
covered, and never discriminating.

I wanted to know whether this was a real property of real rule bases or a thing I had
talked myself into. So I measured one.

## The corpus

The [DAPRECO knowledge base](https://github.com/dapreco/daprecokb) is the GDPR formalised
in LegalRuleML over the PrOnto privacy ontology, built by legal scholars — Robaldo,
Bartolini et al. — and, as far as I know, the largest freely available LegalRuleML
knowledge base. I picked it precisely because it is *not* mine: it is legal content,
formalised by people whose job is legal knowledge representation, published in the
JURIX/AI-and-Law community, for purposes entirely unrelated to anything I build.

Retrieved 31 Aug 2026, `gdpr/rioKB_GDPR.xml`, 5,633,102 bytes (upstream commit `6676cd4`).

## The measure

```
antecedent predicates : distinct ruleml:Rel/@iri under <ruleml:if>
domain predicates     : antecedent predicates excluding the rioOnto: namespace,
                        which is reification plumbing, not legal content
ubiquitous predicate  : appears in >= 50% of all rule antecedents
selective predicate   : a domain predicate that is not ubiquitous
constraint density    : |selective| / |domain|, per rule
density-0 rule        : no selective predicate at all
```

The script is standard library only and public:
[dapreco-density.py](/research/dapreco-density.py). It prints every number in this post.
Reproduce it, with the file pinned to the commit I measured:

```
curl -sSL -o rioKB_GDPR.xml \
  https://raw.githubusercontent.com/dapreco/daprecokb/6676cd4781ed4f6dc7f8f2341295c21d25a23f22/gdpr/rioKB_GDPR.xml
python3 dapreco-density.py rioKB_GDPR.xml
```

## The result

| Measure | Value |
|---|---|
| Rules | 962 |
| Distinct domain predicates | 188 |
| Antecedent predicates per rule | mean 11.4 · median 12 · max 27 |
| Ubiquitous predicates (≥50% of rules) | 6 |
| **Mean constraint density** | **0.462** |
| Median constraint density | 0.400 |
| **Density-0 rules** | **43 (4.5%)** |
| Rules with ≤2 selective predicates | 408 (42.4%) |
| Distinct selective cores | 414 over 961 rules |

(961, not 962: one rule's antecedent holds only a `rioOnto:` predicate, so it has no domain
predicate and no density.)

The six ubiquitous predicates are `PersonalData` (87.0% of rules), `DataSubject` (87.0%),
`Controller` (85.8%), `Processor` (75.4%), `nominates` (75.2%) and
`PersonalDataProcessing` (68.1%).

The median rule carries twelve antecedent predicates. It *looks* highly specific. Six
predicates account for most of that bulk, and between them they assert only that there is
a controller, a processor, a data subject, and personal data being processed. Most of that
is true of every situation the GDPR applies to at all. The processor is the exception, and
it gets its own section below.

**Antecedent length is not selectivity.** By this count, fewer than half the conjuncts in a
typical rule are selective. There are 414 distinct selective condition sets over 961 rules,
so on average more than two rules share each one. Rules that share conditions can still
impose different obligations, so this counts distinct triggers, not wasted rules.

## The part that matters

The 43 density-0 rules are not obscure. Thirty-four of them sit in nine articles. Eight are
Art. 80(1). Six are Art. 5(1): two each for (a) lawfulness, (d) accuracy and (f) integrity
and confidentiality. Six are Art. 28 processor obligations and four are Art. 30 records of
processing. Two each are Art. 24(1) controller responsibility, 25(1) data protection by
design, 32(1) security, 37(4) DPO designation and 77(1) right to complain. The other nine
cite no article: they are the rules that map the legal vocabulary onto the PrOnto ontology.

**This concentration is the point, and it is not a defect in the formalisation.** General
principles *are* meant to apply universally. Article 5 governs all processing, by design.
The formalisation is faithful.

What the measurement shows is that a corpus can be faithful and still be, structurally,
mostly non-discriminating — and that no coverage-style audit can tell you which of the two
you are looking at. Both cases produce the same coverage number. Only density separates
them.

## Frequency is not truth

Everything above calls a predicate non-discriminating because it is *common across rules*.
That is a fact about the corpus, not about the world. `PersonalData`, `DataSubject`,
`Controller` and `PersonalDataProcessing` do hold wherever the GDPR applies. `Processor`
and `nominates` do not: a controller that processes the data itself has no processor, and a
rule that requires one separates that situation from the rest.

So here is the same measurement with only those four scope predicates counted as
non-discriminating:

| Reading | Predicates set aside | Mean density | Density-0 rules |
|---|---|---|---|
| Corpus-common (≥50% of rules) | 6 | 0.462 | 43 (4.5%) |
| Scope-only | 4 | 0.622 | 9 (0.9%) |

The nine that remain are exactly the ontology-mapping rules. Every density-0 rule tied to
an article requires a processor, so under the stricter reading it can tell two scenarios
apart: it just does so with a predicate most of the corpus also uses. The accurate name for
the 43 is *rules whose conditions are all corpus-common*. What survives both readings is
the first claim: antecedent length is not selectivity.

## Being honest about the threshold

The 50% ubiquity line is a choice, and choosing it flatteringly would be easy. So here is
the sweep:

| Threshold | Ubiquitous | Mean density | Density-0 rules |
|---|---|---|---|
| 90% | 0 | 1.000 | 0 (0.0%) |
| 75% | 5 | 0.542 | 4 (0.4%) |
| **50%** | **6** | **0.462** | **43 (4.5%)** |
| 25% | 6 | 0.462 | 43 (4.5%) |
| 10% | 14 | 0.367 | 81 (8.4%) |

At 90% no predicate qualifies, so density is trivially 1.000 and the metric degenerates. A
reviewer would find that in thirty seconds, so it goes first. The defensible claim is the
**50–25% plateau**: the ubiquitous set is the *same six predicates* across that whole band,
so 0.462 holds anywhere in it. Outside the band the result moves, to 4 density-0 rules at
75% and 81 at 10%. Report the plateau, not a number.

## What is not claimed

- No claim that the DAPRECO KB is wrong, deficient or badly built. It is a reference
  artefact and any paper using it should say so early and explicitly.
- No claim about runtime behaviour. Nothing was executed against a reasoner. This is a
  static property of the rule base.
- No claim that density *should* be high. For Article 5 it correctly should not be.
- No claim that a corpus-common predicate is true of every scenario. The scope-only reading
  above is the check on that, and it changes the count from 43 to 9.

The claim is only this: density must be **reported**, because coverage cannot distinguish
the two cases, and a compliance programme that reports only coverage is reporting a number
that cannot go down.

---

*This is the measurement behind a working paper (preprint on request). One anecdote beside
it: a curated insurance-compliance rule base built by practitioners, measured separately,
lands at 0.433. It is an internal rule base, so I give no size or source for it, and two
data points do not show convergence.*

*Update, November 2026:* upstream replaced `rioKB_GDPR.xml` on 29 Sep 2026. On the current
file the same script gives 966 rules, five ubiquitous predicates, a mean density of 0.458
and 80 density-0 rules, and the plateau no longer holds: five predicates at 50%, six at
25%. Every number above is for the pinned commit.
