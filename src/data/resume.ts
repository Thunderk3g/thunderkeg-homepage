/**
 * Single source of truth for every résumé surface in this project:
 * the /resume page, the PDF export, the Firefox "About Me" app, the fake
 * filesystem under ~/Documents, and the AI assistant's grounding context.
 *
 * Editorial policy — read before adding a number.
 * ------------------------------------------------------------------
 * This repository is public. Employer-internal production metrics
 * (submission counts, latency percentiles, corpus sizes, programme spend,
 * reviewer-decision totals) are NOT published here; they need written
 * clearance and they live only in the private master résumé. What is
 * published: architecture, method, named negative results, and numbers
 * that come from public corpora or from personal repositories.
 */

export const profile = {
  name: 'DIWAKAR ADHIKARI',
  title: 'Technical Lead — AI Engineering',
  company: 'Bajaj Life Insurance',
  location: 'Pune, India',
  phone: '+91 93780 67880',
  email: 'diwakar.adhikari0@gmail.com',
  github: 'Thunderk3g',
  githubUrl: 'https://github.com/Thunderk3g',
  tagline: 'Retrieval-grounded and speech AI, built where a wrong answer is a regulatory event.',
  summary: [
    'AI engineering lead building retrieval-grounded and speech AI systems inside an IRDAI-regulated life insurer, where a false negative has regulatory consequence and every claim has to survive an audit.',
    'Work spans regulatory compliance review, multilingual call intelligence, document AI and evaluation methodology — characterised by measured negative results, declared confounds, and a refusal to report numbers that cannot be defended.',
    'Currently preparing research on constraint density in formalised regulatory rule bases, and applying for a research-track master’s in AI & Law / speech in Europe.',
  ],
};

/* ───────────────────────── Experience ───────────────────────── */

export interface RoleGroup {
  heading: string;
  points: string[];
}

export interface Role {
  id: string;
  title: string;
  org: string;
  period: string;
  blurb: string;
  groups: RoleGroup[];
}

export const roles: Role[] = [
  {
    id: 'bajaj-life',
    title: 'Technical Lead — AI Engineering',
    org: 'Bajaj Life Insurance',
    period: 'Dec 2025 – Present',
    blurb:
      'Owns the marketing-AI engineering portfolio: a production regulatory compliance grader, a multilingual call-intelligence platform, a document-validation gate, and the shared platform the agents run on.',
    groups: [
      {
        heading: 'Regulatory compliance review engine (production)',
        points: [
          'Designed and shipped a six-node LangGraph pre-publication compliance grader for life-insurance marketing collateral against IRDAI, SEBI and internal brand obligations.',
          'Built hybrid retrieval combining dense pgvector and BM25, fused by reciprocal rank fusion (k=60) over six typed indexes — submission chunks, rules, regulator source passages, legacy examples, canonical precedents and product brochures.',
          'Introduced a five-tier grounding taxonomy (disclosure > product_fact > precedent > rule > novel) as a first-class queryable database column driving cross-tier deduplication, so every finding carries the evidence class that produced it rather than an unattributable model judgement.',
          'Implemented a deterministic verbatim-substring critic that drops any finding whose quoted text is not a literal substring of the analysed chunk — removing the fabricated-evidence failure class without a second model call.',
          'Enforced a fail-closed persistence gate: a run blocked on empty content, failed status or a degraded chunk resolves to needs_review, never to a grade — on the stated premise that a false negative ships a non-compliant public claim while a false positive only costs reviewer attention.',
          'Separated regulatory applicability from semantic relevance with a deterministic applicability judge and per-candidate recorded verdicts, after a code-level root-cause analysis showed cosine and ts_rank floors are relevance floors that an on-topic-but-wrong-product chunk sails over.',
          'Measured coverage of that applicability layer and inverted its own permissive default on the evidence: most of the precedent corpus and nearly all active rules were untagged and bypassed the mechanism entirely — a supply problem, not a mechanism problem — with the resulting exclusions recorded honestly in the product UI rather than hidden.',
          'Diagnosed a score-saturation defect by instrumenting a heavily-flagged run, proving the absolute-deduction metric pinned at zero past roughly a dozen moderate findings; replaced it with a strictly decreasing hyperbolic soft-tail policy, versioned and stamped per run.',
          'Traced a disclosure false positive to a DOCX extraction bug (python-docx `Document.paragraphs` excludes headers, footers, text boxes and table cells — exactly where marketing creatives place mandated disclaimers), identified the 0.48–0.55 fuzzy-similarity band as a fingerprint of absence rather than alteration, and added a legally-critical-token guard after finding a disclaimer semantically inverted by deleting "not" scored 0.96 and passed as present.',
          'Restored run determinism after measuring violations accumulating across re-runs of a single submission, caused by a per-submission rather than per-run LangGraph thread id; fixed with per-run threads, content-derived prompt fences, seeded decoding and stable retrieval tiebreaks.',
          'Built Beta-Binomial rule reliability from reviewer accept/reject verdicts and architecturally refused to train on the evaluation metric — reviewer document scores are stored and never enter scoring or weight updates, a constraint restated at four independent code sites to preserve an independent evaluation channel.',
          'Designed a leakage-safe replay evaluation using two independent barriers: a deterministic `md5(source_file) mod 1000` train/eval split plus retrieval-side same-document exclusion.',
          'Audited a company rename executed as a repo-wide find-and-replace and documented four simultaneous downstream corruptions across regex source, disclaimer registry, seed rules and prompt ground truth; replaced it with an entity registry where aliases carry status and effective dates, so historical names are mapped at match time rather than rewritten in stored records.',
          'Catalogued code-versus-documentation discrepancies including two production runbooks prescribing incompatible embedding dimensions in a system whose embedding-identity guard fails closed — arguing that operator documentation carrying constants is executable and deserves a single source or a test.',
          'Deployed to a RHEL 9 VM under podman/podman-compose on a shared platform stack, with a one-command self-verifying deploy script and a runtime egress surface of exactly two external HTTPS hosts.',
          'Shipped the reviewer surfaces: a pixel-faithful document comparison viewer, a Lexical rich-text working document with in-place fix application and DOCX round-trip export preserving headers and footers, violation anchoring implemented byte-identically in frontend and backend, auth/RBAC with an append-only audit trail, and an admin retrieval inspector exposing both retrieval legs’ scores, ranks, applicability verdicts and deciding stage per candidate.',
        ],
      },
      {
        heading: 'Speech and call intelligence',
        points: [
          'Built a production call-intelligence platform over Indian insurance telephony — speaker-labelled transcripts, lead extraction, disposition classification, compliance detection, a nine-competency salesperson scorecard, question clustering and a Customer-360 identity spine.',
          'Ran a three-arm paid benchmark against human-adjudicated physical ground truth showing stereo channel-split attribution outperforming commercial neural diarization (n=8 — the n is stated every time the figure is), with the diarizer inverting speakers on whole calls; established that the channel-split failure mode migrates entirely from separation (physically exact) to role labelling.',
          'Converted that result into a confidence-ordered role-labelling voter (dialer convention → fuzzy CDR agent-name match in the opening window → opening-script markers → talk-ratio prior) with an explicit fall-back to paid diarization below a confidence threshold, plus a cost model showing compacted channel-split materially cheaper per thousand calls than the mono-plus-diarization incumbent.',
          'Built an offline speech-dataset pipeline with zero declared runtime dependencies, producing a code-switched Hinglish and Indian-English training corpus split train / validation / protected test.',
          'Found, quantified and fixed a speaker-leakage defect in that split — a large share of protected-test segments shared an agent voice with train or validation; re-carved the split agent-atomically and independently re-verified zero call-level and zero agent-voice leakage across all three split pairs, preserving the pre-fix number in the record.',
          'Falsified my own headline finding on consensus pseudo-labelling. A script-matched third ASR hypothesis lifted per-utterance auto-accept 5.6× at pilot scale; a full-corpus pass with the coverage confound eliminated measured a small fraction of that. Diagnosed three separable mechanisms: orthographic divergence blocking corroboration, same-family correlated error (measured at call-level WER 0.035, self-issued the same day the positive result was recorded), and call-level-versus-utterance granularity mismatch.',
          'Ran a silence-stripping A/B on the live path and wired the feature off on the evidence — roughly one point of word error per point of cost saved — and showed the previously cited larger saving was a single long-call outlier.',
          'Ran a 72-combination × 16-channel offline VAD grid search at zero paid cost, establishing that a 99 % speech-coverage floor was unreachable within a +10 % billed budget, then confirmed the tuned parameters on a paid arm (WER 0.234 → 0.202, cross-channel bleed 1.78 %) and returned the honest verdict TUNE-MORE rather than shipping.',
          'Demonstrated that Whisper hallucination loops are decoder artefacts, not audio quality: every confirmed greedy looper resolved under a temperature-fallback ladder, the two engines looped on different calls, and the cost of the remedy was measured (RTF ~10.9× versus ~1.2× greedy) — invalidating a data-quality metric that would have discarded a large share of the corpus.',
          'Tested a published ICASSP tokenizer-expansion method against local corpus statistics and reported that its premise did not hold: romanized token inflation measured 1.21×–1.41× against a 3.19× Devanagari counterfactual, so full tokenizer retraining was not justified; redirected to vocabulary coverage as the real driver.',
          'Corrected a 2.7× corpus-size overestimate the same day it was made by running a database census instead of trusting a planning assumption, cutting a projected full-corpus spend estimate by roughly two thirds.',
          'Diagnosed and fixed a speaker-role heuristic that penalised interrogative density — wrong for consultative sales, where the agent drives discovery — taking turn accuracy from 35 % to 100 % on the probe set.',
          'Built a four-layer cost-safety spine — dry-run by default, ordered budget guards requiring a human-dropped approval token, a content-hash idempotent cache and a filesystem emergency stop — and ran the entire programme at a small fraction of its cap with no per-day cap ever breached; the append-only ledger reconciles to the paise on independent re-parse.',
          'Built an invoice-faithful cost meter billing Σ⌈per request⌉ rather than ⌈Σ⌉, and surfaced a governance bug found by running an experiment: a vendor omitting `audio_duration` caused the ledger to record zero against successful paid requests.',
          'Implemented a BFSI PII redactor with typed placeholder spans, an amount-adjacency rule, spoken-digit and Devanagari normalisation and assert-guarded no-raw-value invariants — and labelled the result engineering-clean but not DPO-verified.',
          'Built a privacy-gated in-domain noise bank behind a double Silero-VAD speech gate with hashed call-id provenance and protected-test exclusion, plus an honest post-hoc re-check disclosing the clips still flagged — "a privacy floor, not an ASR-strength ceiling".',
          'Built and then parked a half-duplex real-time speech-to-speech advisor: browser VAD → streaming STT → sentence-chunked streaming LLM → streaming TTS with barge-in, a warm TTS socket pool sized to the barge-in latency budget, a truncation guard that withholds unvoiced tails from TTS and never caches them, and three-tier caching (exact response, exact audio, semantic at cosine 0.86).',
          'Stopped a planned TTS training track before any spend on an unresolved vendor terms-of-service question about training competing models, gating TTS off in code and configuration, and ran a tokenizer study in its place.',
          'Established a data-class export gate (A–G) under DPDP Act 2023 and IRDAI record-localisation rules, ruling out release of noised audio in writing on the published evidence that speaker anonymisation reverses to ~78 % accuracy with off-the-shelf models — pseudonymised, never anonymised.',
        ],
      },
      {
        heading: 'Document AI — KYC validation gate',
        points: [
          'Built an evidence-driven document validation gate for the eTouch II buy journey: capture-quality pre-gate → classification → dual-engine OCR → per-field extraction → cross-engine reconciliation → cross-check against customer-entered data → four decision states with machine-readable reason codes, replacing a production journey that had no document validation beyond a four-key presence test.',
          'Cut false-accept rate by roughly three quarters and took document-type classification to 100 % on a synthetic benchmark of 8 document types × 9 degradations, with the decision precedence RECAPTURE > UNSUPPORTED > CONFIRM > ACCEPT chosen because a false accept costs more than a confirmation prompt.',
          'Controlled the experiment by implementing the rule engine verbatim in both Python and Java with self-tests during `docker build`, so any measured difference is attributable to the OCR model and never to the rules.',
          'Reported a negative result rather than a tuning win: on a deliberately degraded voter ID (360 px, glare, 1.6° skew, JPEG q28), DPI upscaling and `tessdata_best` moved mean confidence only marginally — so the recommendation was upstream capture quality, not a better parser.',
        ],
      },
      {
        heading: 'Marketing data and attribution',
        points: [
          'Built a multi-channel campaign-to-conversion attribution pipeline joining WhatsApp, RCS and email event logs to the lead master across financial years, producing one decision-ready row per unique customer phone from tens of gigabytes of raw logs.',
          'Established conversion truth from the lead master rather than the sparse campaign `conversion` event, and chose mobile number as the join key on measured evidence rather than on convention.',
          'Eliminated funnel rates exceeding 100 % by replacing event tallies with a monotonic funnel aggregation that backfills earlier stages, guaranteeing sent ≥ delivered ≥ read ≥ clicked ≥ replied ≥ conversion.',
          'Surfaced the finding leadership could act on: close to half of every send fails or bounces before reaching a handset — identified as a larger and cheaper lever than any creative or timing optimisation.',
          'Specified a CatBoost propensity model over the pipeline output with per-feature type, reasoning, include flag and missing-value handling, and a stated class-imbalance caveat. Designed, not fitted — no trained model exists.',
          'Automated a monthly marketing MIS report by reverse-engineering an undocumented portal API (base64 envelope, dual CSRF tokens, async export polling), reconciling the output line-by-line against a hand-built deck and tracing the single residual gap to two named portal data gaps.',
        ],
      },
      {
        heading: 'Platform, production engineering and evaluation methodology',
        points: [
          'Ran a multi-agent AI platform on a single RHEL 9 VM under Podman — one shared Postgres/Redis/nginx stack with three agents documented live in production — with hard architectural rules, a port registry, a new-agent onboarding guide, health probes and a landing page carrying live per-agent status.',
          'Delivered a four-role sales-disposition reconciliation portal (admin / SM / verifier / approver) with period-scoped records and separation of duties, and cut source-workbook parsing from ~74 s in Node to ~0.3 s through a dedicated Rust-backed parser service (~245×) after the source sheet’s declared 54,508 × 16,383 range proved fatal to any materialising reader.',
          'Built a compliance-by-construction customer communication portal where non-compliant sends are structurally unreachable — approved templates, permitted fields, approved attachments only — verified by 93 HTTP-level end-to-end checks against a real database including negative paths.',
          'Built `qualityos`, a portable evaluation harness packaging a scientific loop (observe → hypothesise → experiment → revise beliefs) as an installable skill, with an append-only belief graph, eight non-negotiable laws reproduced byte-for-byte by a validation gate, paid model stages behind an explicit environment flag, 44 tests, standard library only, and a dashboard rule that forbids synthetic runs or smoothed curves.',
          'Designed a six-agent role-separated evaluation topology (navigator, two domain judges, runner, librarian, fix surgeon) in which judges diagnose, the surgeon fixes and the librarian documents, so evidence, code and documentation cannot silently diverge — with an explicit output contract to preserve disagreement rather than round up to a clean verdict.',
          'Maintained an Open Knowledge Format documentation bundle (172 files, six-key front matter with zero variance, an append-only numbered known-issues ledger where resolved entries are moved rather than deleted) enforced by a mandatory librarian pass at the end of every improvement loop.',
        ],
      },
    ],
  },
  {
    id: 'finserv',
    title: 'Dev Lead',
    org: 'Bajaj Finserv Direct Ltd',
    period: 'Jun 2022 – Nov 2025',
    blurb: 'Term-insurance purchase journeys — API design, release management and cross-team integration.',
    groups: [
      {
        heading: '',
        points: [
          'Led a 10-member engineering team delivering term-insurance purchase journeys, owning API design, release management and cross-team integration with Bajaj Allianz Life.',
          'Optimised Angular front-ends and introduced server-side rendering across customer-facing journeys.',
          'Remediated critical authentication findings raised in VAPT security assessments.',
          'Delivered the front-end for the Bajaj Finserv Asset Management NFO launch.',
          'Began the research trajectory that led here: quantisation for running LLMs and agents on resource-constrained hardware.',
        ],
      },
    ],
  },
];

/* ───────────────────────── Projects ───────────────────────── */

export interface Project {
  name: string;
  kind: string;
  blurb: string;
  caveat?: string;
}

export const projects: Project[] = [
  {
    name: 'Mneme',
    kind: 'LLM knowledge compiler',
    blurb:
      'Compiles PDF, HTML and text sources into a cross-referenced, citation-bearing wiki queried directly — an explicit architectural bet against paying RAG’s per-query re-derivation cost. Staged compiler (decompose → extract → align → critic → write → index → graph) with a manifest dependency map, content-hash dedupe, two interchangeable backends (hosted Claude and local Ollama) behind one interface, and a `lint` command that finds orphan pages and broken links so the knowledge base is testable.',
    caveat: 'No baseline against RAG exists — this is the missing experiment.',
  },
  {
    name: 'R2P-IP',
    kind: 'research-to-product agent platform',
    blurb:
      'An architecture RFC with 10 ADRs plus six wired vertical slices — audit chain, approval tokens, ontology, tool gateway, focal graph, working memory — passing 219 tests. Six constraints enforced architecturally rather than by policy: human sign-off for irreversible actions, an immutable audit trail, sandboxes with no ambient credentials, prompt-injection defence in depth (taint tracking, content/instruction separation, tool firewalls), multi-tenancy, and reconstructible autonomous decisions.',
    caveat: 'A blueprint plus vertical slices, not a deployed platform.',
  },
  {
    name: 'Semantic gap analyser',
    kind: 'content-gap analysis',
    blurb:
      'Streamlit content-gap analysis over insurance landing pages: structure-aware chunking (headings, FAQ pairs, tables, schema — explicitly not blind fixed-width splits) with global near-duplicate dedup, hosted embeddings with a two-level local fallback so it runs fully offline, Qdrant with automatic FAISS fallback, HDBSCAN clustering with KMeans fallback, and a nine-dimension scoring model. Built so it cannot invent claim ratios, premium rates or tax figures — anything requiring factual validation is flagged for verification.',
  },
  {
    name: 'Insurance HTML5 game portfolio',
    kind: 'micro-frontend delivery',
    blurb:
      'Shipped 38+ browser games across 7+ tracked release batches under a catalogue/tracker/portfolio-review process, delivered through an Angular shell hosting React micro-frontends via a module-federation manifest in a 476-commit, 16-contributor shared codebase.',
  },
  {
    name: 'Multi-tenant commerce platform',
    kind: 'sole author, 66 commits',
    blurb:
      'One Next.js codebase powering many storefronts through layered configuration and theme tokens rather than forks; PostgreSQL row-level security for tenancy, forward-only Drizzle migrations, three runtime roles selected by environment variable from one image. Security work included closing a data-API exposure of users and sessions and adding a test that refuses a destructive schema reset against a non-local database.',
  },
  {
    name: 'dee-bot',
    kind: 'robot control stack',
    blurb:
      'Sequenced discover → prove safe stop → prove one movement → then UI, with the driving interface deliberately not built while capability remained unproven. 40 tests over the safety core: dead-man switch, central command queue, emergency-stop priority, rate limiting.',
  },
  {
    name: 'This portfolio',
    kind: 'Next.js + zustand',
    blurb:
      'A browser Kali Linux desktop — window manager, POSIX-ish shell with ~90 commands over an in-memory filesystem, simulated security tools, a 24-game arcade with Supabase-realtime multiplayer, and this résumé rendered from one typed source.',
  },
];

/* ───────────────────────── Research ───────────────────────── */

export const research = {
  inPreparation: [
    {
      title: 'Coverage is not constraint: measuring constraint density in formalised regulatory rule bases',
      venue: 'JURIX 2026 (short/poster) — in preparation',
      summary:
        'Measured over the DAPRECO GDPR knowledge base, the largest freely available LegalRuleML corpus: 962 rules, median 12 antecedent predicates per rule, but mean constraint density 0.462 and 43 rules (4.5 %) whose antecedents consist entirely of predicates that fire on any scenario the corpus can describe. Antecedent length is not selectivity — so a coverage-style audit of a rule base cannot distinguish a faithfully general principle from a structurally non-discriminating rule. Measurement script is 120 lines, standard library only, and ships with the paper.',
    },
    {
      title:
        'Grounded Regulatory Compliance Review: an engineering case study of a precedent-imitating retrieval system in insurance marketing',
      venue: 'Manuscript in preparation — pending employer clearance',
      summary:
        'Full draft covering the grounding-tier taxonomy, fail-closed persistence, precedent canonicalisation with two independent leakage barriers, bounded Beta-Binomial feedback, the deterministic applicability layer and deterministic disclosure adjudication — with four negative results, three bypassed quality gates, one self-inflicted false alarm and three exonerated suspects reported as contributions. Not submitted; requires named authorship, employer clearance, a related-work section, one ablation and one baseline.',
    },
  ],
  published: [
    {
      title: 'SustainAI: Enhancing Sustainable Energy Forecasting',
      venue: 'CSEAI 2023',
      summary: 'Presented at the 1st International Conference on Computing for Science, Engineering & AI.',
    },
  ],
  directions: [
    'Applicability-constrained retrieval — where a hard categorical constraint that semantic similarity cannot express should be enforced: in the embedding, the SQL filter, or a post-retrieval deterministic judge.',
    'Defaults as unverified distributional claims — a safety default adopted for a correct reason can route most of a corpus around the mechanism it protects, and only coverage measurement reveals it.',
    'Identifier stability in LLM-built knowledge bases — a deduplication hash derived from an LLM-generated field inherits the generator’s non-determinism, so a content hash is not stable when the content is sampled.',
    'When consensus pseudo-labelling fails for code-switched low-resource ASR — orthographic divergence, same-family correlated error, and hypothesis-granularity mismatch, measured at two scales.',
    'Physical channel separation versus neural diarization for narrowband multilingual contact-centre audio, and where the failure mode moves to.',
  ],
  /** Openly stated: this portfolio is part of a research-master's application. */
  track:
    'Applying for a research-track master’s in AI & Law / speech technology in Europe (Erasmus Mundus and Dutch programmes), with the JURIX short paper as the first submission.',
};

/* ───────────────────────── Skills ───────────────────────── */

export const skills: { group: string; items: string }[] = [
  {
    group: 'AI / ML systems',
    items:
      'retrieval-augmented generation · hybrid dense + BM25 with reciprocal rank fusion · pgvector · embedding clustering (HDBSCAN, KMeans) · generator–critic verification · prompt-injection defence · LangGraph / LangChain orchestration · evaluation-harness design · belief-revision evaluation · Beta-Binomial reliability estimation · leakage-safe dataset splitting',
  },
  {
    group: 'Speech',
    items:
      'ASR pipeline engineering · speaker diarization and channel-based attribution · VAD · forced segmentation · WER/CER with script-normalised scoring · code-switched Hinglish and Indic handling · streaming STT/TTS · faster-whisper · corpus construction and dataset cards',
  },
  { group: 'Languages', items: 'Python · TypeScript · Java · SQL' },
  {
    group: 'Frameworks & data',
    items:
      'FastAPI · Celery · Next.js · React · Angular · Spring Boot · PostgreSQL · pgvector · Redis · Kafka · Qdrant · DuckDB · pandas · Drizzle · Alembic',
  },
  {
    group: 'Platform',
    items:
      'Docker · Podman / podman-compose · RHEL 9 · nginx · MinIO · Azure OpenAI and AI Foundry · Vercel · Railway · Supabase · GitHub Actions',
  },
  {
    group: 'Practice',
    items:
      'test-driven development · benchmark design with declared confounds and stopping rules · cost governance for paid model APIs · PII redaction and data-class export gating under DPDP Act 2023 and IRDAI rules · append-only audit design · documentation as a maintained artefact',
  },
];

/* ───────────────────────── Education & awards ───────────────────────── */

export const education = [
  {
    degree: 'B.Tech, Computer Science and Engineering',
    org: 'SRM University',
    period: '2018 – 2022',
    detail: 'CGPA 8.8 / 10',
  },
];

export const awards = [
  'COMPEX Indian Embassy Scholarship Scheme Awardee',
  'Esteemed Contributor to Financial Innovation Award',
];

/* ───────────────────────── Derived helpers ───────────────────────── */

/** Flat plain-text résumé — used by the fake filesystem and the AI context. */
export function resumeText(): string {
  const out: string[] = [];
  out.push(profile.name, `${profile.title} · ${profile.company}`, profile.location);
  out.push(`${profile.email} · ${profile.phone} · github.com/${profile.github}`, '');
  out.push('## Summary', ...profile.summary.map((s) => '- ' + s), '');
  out.push('## Experience');
  for (const r of roles) {
    out.push('', `### ${r.title} · ${r.org} · ${r.period}`, r.blurb);
    for (const g of r.groups) {
      if (g.heading) out.push('', `#### ${g.heading}`);
      out.push(...g.points.map((p) => '- ' + p));
    }
  }
  out.push('', '## Selected independent projects');
  for (const p of projects) {
    out.push('', `### ${p.name} — ${p.kind}`, p.blurb);
    if (p.caveat) out.push(`(${p.caveat})`);
  }
  out.push('', '## Research');
  for (const r of [...research.inPreparation, ...research.published]) {
    out.push('', `### ${r.title}`, r.venue, r.summary);
  }
  out.push('', 'Research directions:', ...research.directions.map((d) => '- ' + d));
  out.push('', research.track);
  out.push('', '## Skills', ...skills.map((s) => `${s.group}: ${s.items}`));
  out.push('', '## Education', ...education.map((e) => `${e.degree} — ${e.org} · ${e.period} · ${e.detail}`));
  out.push('', '## Awards', ...awards.map((a) => '- ' + a));
  return out.join('\n');
}
