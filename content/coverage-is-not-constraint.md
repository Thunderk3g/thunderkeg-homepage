---
kind: post
title: Coverage is not constraint
date: 2026-08-31
summary: A rule base can pass every coverage audit and still be, structurally, mostly non-discriminating. Measured over the DAPRECO GDPR knowledge base — 962 rules, mean constraint density 0.462.
tags: legal-informatics, compliance, measurement, JURIX
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

Retrieved 31 Aug 2026, `gdpr/rioKB_GDPR.xml`, 5,633,102 bytes.

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

The script is 120 lines, standard library only, and ships with the paper. Reproduce it:

```
curl -sSL -o rioKB_GDPR.xml \
  https://raw.githubusercontent.com/dapreco/daprecokb/master/gdpr/rioKB_GDPR.xml
python dapreco-density.py rioKB_GDPR.xml
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

The six ubiquitous predicates are `PersonalData` (87.0% of rules), `DataSubject` (87.0%),
`Controller` (85.8%), `Processor` (75.4%), `nominates` (75.2%) and
`PersonalDataProcessing` (68.1%).

The median rule carries twelve antecedent predicates. It *looks* highly specific. Six
predicates account for most of that bulk, and between them they assert only that there is
a controller, a processor, a data subject, and personal data being processed — which is
true of every situation the GDPR applies to at all.

**Antecedent length is not selectivity.** Fewer than half the conjuncts in a typical rule
do any work in deciding whether that rule fires. 414 distinct selective cores over 961
rules: the corpus has roughly half as much discriminating power as it has rules.

## The part that matters

The 43 density-0 rules are not obscure. Eight of them are Art. 80(1). Two each are
Art. 5(1)(a) lawfulness, 5(1)(d) accuracy, 5(1)(f) integrity and confidentiality, 24(1)
controller responsibility, 25(1) data protection by design, 28 processor obligations,
30 records of processing, 32(1) security, 37(4) DPO designation, 77(1) right to complain.

**This concentration is the point, and it is not a defect in the formalisation.** General
principles *are* meant to apply universally. Article 5 governs all processing, by design.
The formalisation is faithful.

What the measurement shows is that a corpus can be faithful and still be, structurally,
mostly non-discriminating — and that no coverage-style audit can tell you which of the two
you are looking at. Both cases produce the same coverage number. Only density separates
them.

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
so 0.462 is not an artefact of where the line was drawn. Report the plateau, not a number.

## What is not claimed

- No claim that the DAPRECO KB is wrong, deficient or badly built. It is a reference
  artefact and any paper using it should say so early and explicitly.
- No claim about runtime behaviour. Nothing was executed against a reasoner. This is a
  static property of the rule base.
- No claim that density *should* be high. For Article 5 it correctly should not be.

The claim is only this: density must be **reported**, because coverage cannot distinguish
the two cases, and a compliance programme that reports only coverage is reporting a number
that cannot go down.

---

*This is the measurement behind a short paper in preparation for JURIX 2026. The
independently interesting part is that a curated insurance-compliance rule base built by
practitioners, measured separately, lands at 0.433 — two rule bases with nothing in common
but their job, converging on roughly the same density.*
