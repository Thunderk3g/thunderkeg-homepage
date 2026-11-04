# Role benchmark: Technical Lead, AI Engineering (2026) and the research track

Date: 2026-11-04. Sources are summarised in the companion research brief this
was derived from (career ladders, hiring guides, 2026 job postings, programme
pages). Figures and deadlines marked "verify" were taken from search snippets
because the primary page could not be fetched from the build environment.

## 1. What "Technical Lead — AI Engineering" means at market standard

A lead is judged on scope, not on title. The ladders that publish their
criteria (Dropbox IC4/IC5, Rent the Runway, Spotify Steps, Google L5/L6, Will
Larson's Staff archetypes) converge on the same differentiators between a
strong senior engineer and a lead:

| Dimension | Senior engineer | Technical lead (market standard) |
|---|---|---|
| Time horizon | This quarter's features | Sets direction 6–12 months out; writes the roadmap |
| Ownership | A component | A product capability or system in production, including incidents |
| Quality system | Writes tests | Owns evals, tracing and regression gates as the team's quality system |
| Influence | Own team | Libraries, designs and reviews adopted by other teams |
| People | Mentors informally | Hiring input, growth plans, delegation; 40 % leadership / 60 % hands-on is typical in Indian BFSI postings |
| Evidence | Delivered work | Measured outcomes with baselines, stated honestly when confidential |

Indian BFSI postings for "Technical Lead, AI" usually ask for 8–12 years. At
four years total, the title is early by that norm, so the résumé has to prove
scope rather than lean on the title. That is why the rewrite leads every
bullet with what was owned and how it was verified.

## 2. What the current profile already proves

- Production retrieval-grounded LLM system with a real quality discipline:
  evidence tiers, deterministic critic, fail-closed persistence, leakage-safe
  evaluation, reviewer-independent reliability estimation.
- Error analysis as a habit: root-causing metric saturation, extraction
  gaps, inverted disclaimers, rename corruption, and reporting them.
- Falsification of a positive result at full scale, with mechanisms isolated.
- Speech pipeline work with benchmarks against human ground truth.
- Data governance under DPDP and IRDAI rules, with explicit stop decisions.
- Team leadership of ten engineers on a production insurance journey.

## 3. Gaps against the 2026 market, highest leverage first

1. **Production LLM observability and online evals.** The harness exists; it
   must be visible as a system: traces (Langfuse, LangSmith or Arize),
   faithfulness and context-precision metrics wired to those traces, drift
   monitoring, and regression gates in CI. Postings for staff-level AI roles
   lead with exactly this.
2. **Error analysis as a named method.** Open coding of failures into a
   taxonomy, then targeted judges per failure mode (Husain and Shankar's
   method). The work is already done implicitly; naming and documenting it
   makes it legible to eval-literate interviewers and reviewers.
3. **Serving and inference optimisation.** Nothing in the profile shows
   self-hosted serving: vLLM or TGI, quantisation, batching, latency and cost
   per request. "LoRA or vLLM experience" is now a routine line in postings.
4. **LLM cost management.** Cost-per-query and token budgets as an owned
   metric, reported in relative terms.
5. **Safety and red-teaming.** Adversarial testing of the compliance reviewer
   (prompt injection, jailbreaks, disclaimer evasion) as a documented practice.
6. **AI governance literacy.** EU AI Act Annex III treats life and health
   insurance risk assessment and pricing as high-risk, with obligations from
   August 2026; IRDAI formed an AI working group in 2026 (verify). Mapping the
   reviewer to these frameworks is the natural bridge to the AI & Law track.
7. **Speech stack depth.** pyannote 3.x, NeMo, DER as well as WER, and a
   code-switched evaluation protocol: the things speech postings name.
8. **Public artefacts.** One maintained repository (Mneme or ForgeLM) with
   releases and issues answered, and one talk or blog series. Maintainership
   counts more than stars.
9. **MLOps and data governance.** Lineage, model cards and PII handling for
   the KYC gate and the speech corpus.

## 4. A 90-day plan that serves both tracks

| Window | Theme | Artefact that proves it |
|---|---|---|
| Days 0–30 | Observability and evals as a system | Tracing on the compliance reviewer; a failure-mode taxonomy document; regression gate in CI; one blog post on the method |
| Days 31–60 | Serving and cost | Self-hosted vLLM benchmark of one open model against the hosted API on the reviewer's eval set: latency, cost per request, quality delta; write-up with declared confounds |
| Days 61–90 | Governance and the research bridge | Red-team report for the reviewer; mapping of the reviewer to EU AI Act Annex III and IRDAI expectations; resubmit the constraint-density paper; motivation letters drafted per programme |

## 5. Research-track applications (2027 intake)

| Programme | Fit | Notes (verify dates on the programme page) |
|---|---|---|
| EMILDAI, Erasmus Mundus Law, Data and AI | AI & Law, strongest fit | Past cycle opened late October with a scholarship deadline in January; motivation letter, CV, transcripts, IELTS 6.5, two referees |
| Leiden Advanced LLM Law and Digital Technologies | Law side, industry-friendly | Programme states that substantial relevant work experience lowers the weight on curriculum content; apply before 1 April for visa |
| Utrecht MSc Artificial Intelligence | AI, selective | Requires logic, programming, maths and ML fundamentals; non-EU deadline around 1 April |
| Radboud MSc Artificial Intelligence | AI | Non-EU deadline 1 April, scholarship deadline 31 January |
| Groningen MSc Speech Technology | Speech | One-year programme; motivation is the primary criterion; deadline 1 May |
| Saarland MSc Language Science and Technology | Speech and language | Winter intake, deadline 15 February, no tuition |
| Edinburgh MSc Speech and Language Processing | Speech | Rolling batches; apply early |
| KU Leuven Master of AI, Speech and Language option | Speech | Historic non-EEA deadline 1 March |

Maastricht's Law and AI programme and Tilburg's Law and Technology LLM
require law credits or a law bachelor; EMAI's and LCT's 2027 status should be
checked before planning around them. None of these programmes lists the GRE.

How to frame industry work for these applications: pick two or three
projects and go deep on method, tools and the open question each exposed; tie
each to a named research group at the programme. The compliance reviewer and
the constraint-density paper carry the AI & Law applications; the diarization
benchmark, the pseudo-labelling falsification and the romanized-WER critique
carry the speech applications.

## 6. How the résumé now presents unpublished work

Published work sits under its own heading. The JURIX submission is a
"manuscript under revision for resubmission" with no venue named and no
rejection mentioned; the employer-dependent paper is "in preparation, pending
clearance". This follows academic CV guidance: status labels must match
reality, in-preparation items are limited and separated, and "rejected" is
never written.

## 7. How this is tracked

The Learning OS (`/learning`, or the Learning app on the desktop) has a
**Role benchmark** tab that renders this document from
`src/learning/benchmark.ts`; the 90-day plan is roadmap phases p4–p6 in
`src/learning/seed.ts`. Change this document first, then those files.

- Section 1's dimensions each take a self-assessment (Senior / Between /
  Lead).
- Section 3's gaps are cards in priority order. Each shows the mapped skills
  with their current state, the artefact that would close the gap, and a
  "Log evidence" button that attaches evidence to those skills.
- Section 4's artefacts are checkboxes; section 5's programmes each carry an
  application status, with a "verify on programme page" flag.
- A readiness line gives, per track, the share of mapped skills at APPLIED or
  better. A gap serving both tracks counts toward each.
- With no LLM key, the offline coach answers "what should I do next" with
  the highest-priority gap that still has a mapped skill below APPLIED.

All of it is stored in the browser's localStorage only (schema v2), and is
included in the Learning OS JSON export.
