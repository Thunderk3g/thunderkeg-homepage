---
kind: post
title: Two things Indian insurance does not have yet
date: 2026-11-13
summary: I asked what one person with AI agents can legally run in Indian insurance, and what the market is missing. The first answer is narrower than I hoped. The second has two entries I want to build, a claim-rejection checker and an open graph of policy wordings.
tags: insurance, agents, claims, research, india
stack: insurance-white-space
---

A disclosure first. I work at a life insurer. This is personal reading from public sources,
not my employer's view, and not legal advice. Nothing described here is built yet.

On 13 November 2026 I ran two long research passes over public sources with one question:
could one person, with AI agents doing most of the work, run an honest insurance guidance
product in India? And if so, what should it be?

## The model cannot be the seller

The first answer is mostly no. In India insurance has to be solicited and sold through an
insurer or an IRDAI-registered intermediary. From January 2027 every policy must also name
the authorised human who sold it
([Outlook Money](https://www.outlookmoney.com/personal-finance/irdai-tightens-insurance-sales-rules-policies-to-name-authorised-seller-from-january-2027)).
A consultation paper from September 2026 goes further: it proposes one merged distributor
licence, commission caps, and a bar on distributors charging customers fees
([Business Standard](https://www.business-standard.com/finance/insurance/irdai-s-draft-distribution-norms-could-put-insurance-volumes-at-risk-126092401304_1.html)).
Those are proposals, not final rules.

So an agent can read a policy, compare it and explain it. It cannot sell it. I do not mind
this. It is the design I already use at work: the model reads and phrases, and something
accountable decides.

The second thing I learnt is that "advisory-first" is a service style, not a business
model. Whoever is paid only when you buy has a reason to prefer that you buy. The layer
where nobody is paid on a sale is information and outcomes, and that is where the gaps are.

## What exists and what does not

The research produced sixteen ideas and scored them. These are the ones that, as far as it
could find, do not exist in India or exist only in part:

| Idea | In India today |
|---|---|
| An open, machine-readable graph of policy wordings | Does not exist at wording depth |
| Rails that let a customer's own AI agent buy compliantly | Does not exist |
| Mis-selling surveillance tied to the named salesperson | Does not exist at depth |
| A claim-rejection checker and grievance drafter | Early; one funded player |
| A compliance copilot for the new distribution rules | Partial and generic |
| A hospital-bill audit before and after admission | Early |
| A household agent that works only for the customer | Partial; nobody has made it pay |

Two of these are the ones I keep thinking about.

## Claim reversal

IRDAI's 2023-24 annual report says health insurers disallowed or repudiated about ₹26,000
crore of claims in FY24, about ₹10,937 crore of it repudiated outright. A customer who gets
a rejection letter has a route: a grievance to the insurer, an escalation on Bima Bharosa,
then the Insurance Ombudsman. Few people know the route, and fewer can check the insurer's
stated reason against their own policy wording.

That check is a reading problem. Take the policy, the discharge summary, the bills and the
rejection letter. Test the stated reason against the wording, the regulator's circulars and
published ombudsman awards. Draft the grievance. The customer stays the filer.

Four things I have already learnt the hard way would shape how I build it:

- **Every quoted clause must be literally in the wording.** A finding whose quote is not in
  the source gets dropped by a deterministic check, not by a second model.
- **Applicability before similarity.** The wording that counts is the version in force on
  the policy's date, for that product. A clause from next year's wording is on-topic and
  wrong. ([The longer version](/writing/a-permissive-default-is-a-claim))
- **Filing is irreversible, so a person signs it.** The agent drafts and a human approves.
- **Evaluation that can fail.** Published ombudsman awards are labelled outcomes. Hold some
  out. If the system cannot beat a plain checklist on awards it has not seen, it should not
  exist.

## Bima Graph

The claims checker needs something underneath it: every retail product's wording, with its
exclusions, sub-limits, waiting periods and riders, in one schema, versioned over time, and
published as an API and an MCP server. The research found nothing like it in India at
wording depth. The closest analogue it found abroad is Defaqto's product ratings in the UK.

This is the part closest to my research. A policy wording is a rule base: an exclusion is a
rule, and its conditions are an antecedent. The question I asked of a GDPR rule base, how
much of a rule's antecedent separates one case from another, can be asked of an exclusion
clause. ([Coverage is not constraint](/writing/coverage-is-not-constraint))

I would build the graph first, because the claims checker is only as good as the wording it
reads.

## What is not claimed

- Nothing is built. There is no code, no user and no win rate.
- The regulatory statements come from secondary coverage read on 13 November 2026. I have
  not checked each against IRDAI's own documents, and the September proposals are not final.
- "Does not exist" means the research did not find it. It is not proof of absence.
- Whether a service outside the licensing regime may charge for recovering a claim is a
  question for a lawyer, and I have not asked one yet.

---

*If you work on claims, ombudsman cases or policy-wording data in India and one of these is
already done, [email me](mailto:diwakar.adhikari0@gmail.com). I would rather be told than
find out.*
