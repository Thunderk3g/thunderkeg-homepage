/**
 * Single source of truth for every résumé surface in this project:
 * the /resume page, the PDF export, the Firefox app, the fake filesystem
 * under ~/Documents, and the AI assistant's grounding context.
 *
 * Editorial policy — read before adding a number.
 * ------------------------------------------------------------------
 * This repository is public. Employer-internal production metrics
 * (submission counts, latency percentiles, corpus sizes, programme spend,
 * reviewer-decision totals) are NOT published here; they need written
 * clearance and they live only in the private master résumé.
 *
 * What is published: scope (what was owned), mechanism (what was built and
 * how it was verified), decisions and negative results, and numbers that
 * come from public corpora or personal repositories. Numbers that only
 * decorate (tiny sample sizes, test counts, "six-node") are left out: a
 * figure appears here only if a reader learns something from it.
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
    'Engineer with four years in regulated Indian financial services: three and a half leading a ten-person team on insurance purchase journeys, and the last year leading AI engineering for a life insurer, where a wrong answer is a regulatory event and every claim has to survive an audit.',
    'Method over numbers: declared confounds, stated sample sizes, leakage-safe splits, and negative results reported as results — including falsifying a headline finding of my own at full-corpus scale.',
    'Preparing for research in AI & Law and speech technology: a measurement of constraint density in the public DAPRECO GDPR knowledge base, and an engineering case study of grounded regulatory compliance review.',
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
      'Leads AI engineering for the marketing function of an IRDAI-regulated life insurer: three production streams — compliance review, speech analytics and document AI — owned from design through operation. Employer-internal figures are omitted by policy; method, decisions and negative results are reported instead.',
    groups: [
      {
        heading: 'Retrieval-grounded regulatory compliance review (production)',
        points: [
          'Designed and operate an LLM reviewer that grades life-insurance marketing copy against IRDAI, SEBI and brand obligations on the principle of grounding before generation: every finding is anchored to a retrieved reviewer precedent, an active rule, a product fact or a mandated disclosure, and carries that evidence tier as a queryable column.',
          'Hybrid retrieval — dense (pgvector) and BM25 fused by reciprocal rank fusion over typed indexes — with a deterministic verbatim-evidence critic that drops any finding whose quoted evidence is not literally in the source, removing fabricated evidence without a second model call.',
          'Fail-closed by construction: anything not substantively evaluated resolves to human review, never a grade. Rule reliability is estimated from reviewer verdicts (Beta-Binomial) with reviewer scores architecturally excluded from training, so the evaluation channel stays independent; replay evaluation is leakage-safe by two independent barriers.',
          'Measured a safety default instead of trusting it: found most of the corpus untagged and silently bypassing the regulatory-applicability judge under a permissive default, then inverted the default to fail-closed with the exclusions shown to reviewers.',
          'Root-caused and reported rather than tuned away: a saturating score metric (replaced by a strictly decreasing, versioned policy); DOCX extraction that missed disclaimers in headers, footers and text boxes; a disclaimer inverted by deleting "not" that still passed fuzzy matching (fixed with a legally-critical-token guard); and a company rename done as find-and-replace that corrupted rules and seed data (replaced by an alias registry with effective dates).',
        ],
      },
      {
        heading: 'Speech analytics and code-switched ASR data (Hinglish / Indian English telephony)',
        points: [
          'Built call intelligence over insurance telephony — speaker-labelled transcripts, disposition and compliance detection — and an offline corpus pipeline for code-switched Hinglish and Indian English with train / validation / protected-test splits; found speaker leakage in the protected split, re-carved it agent-atomically, verified zero leakage across all split pairs, and kept the pre-fix result on record.',
          'Benchmarked speaker attribution against human-adjudicated ground truth: stereo channel-split attribution outperformed commercial neural diarization, which inverted speakers on whole calls; showed the residual failure moves from separation to role labelling and built a confidence-ordered role voter with diarization fallback.',
          'Falsified my own headline result on consensus pseudo-labelling: a script-matched third ASR hypothesis looked decisive on a pilot slice, but the full-corpus pass with the coverage confound removed kept only a small fraction of the gain. Isolated three separable mechanisms — orthographic divergence in romanized text, same-family correlated error, and call- versus utterance-level granularity mismatch.',
          'Showed that Whisper hallucination loops are decoder artefacts rather than audio quality (every confirmed looper resolved under a temperature-fallback ladder, at a measured compute cost), invalidating a data-quality filter that would have discarded usable audio; tested a published ICASSP tokenizer-expansion method and reported that its premise does not hold for romanized text.',
          'Data governance: a data-class export gate under the DPDP Act 2023 and IRDAI localisation rules; BFSI PII redaction labelled engineering-clean, not DPO-verified; a TTS training track stopped before any spend over an unresolved vendor terms-of-service question.',
        ],
      },
      {
        heading: 'Document AI and evaluation practice',
        points: [
          'Built a KYC document-validation gate — capture-quality pre-gate, classification, dual-engine OCR, cross-engine reconciliation and decision states with reason codes — with the rule engine implemented identically in Python and Java so that measured differences are attributable to OCR alone; reported that upscaling and better OCR models barely moved confidence on degraded captures, so the fix was capture quality, not a better parser.',
          'Built qualityos, a standard-library evaluation harness (observe → hypothesise → experiment → revise beliefs) with an append-only belief graph and a rule forbidding synthetic runs or smoothed curves, run by role-separated agents — judges diagnose, a separate agent fixes, a librarian documents — so that disagreement is preserved rather than rounded to a verdict.',
        ],
      },
    ],
  },
  {
    id: 'finserv',
    title: 'Dev Lead',
    org: 'Bajaj Finserv Direct Ltd',
    period: 'Jun 2022 – Nov 2025',
    blurb: 'Term-insurance purchase journeys for an insurance marketplace — API design, release management and cross-team integration.',
    groups: [
      {
        heading: '',
        points: [
          'Led a ten-member engineering team delivering term-insurance purchase journeys end to end, owning API design, release management and the integration with Bajaj Allianz Life.',
          'Remediated critical authentication findings raised in VAPT security assessments on the production journeys.',
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
  /** Public repository or page for the project. */
  url?: string;
}

export const projects: Project[] = [
  {
    name: 'Mneme',
    kind: 'LLM knowledge compiler',
    blurb:
      'Compiles PDF, HTML and text sources into a cross-referenced, citation-bearing wiki that is queried directly — an explicit architectural bet against paying RAG’s per-query re-derivation cost. Staged compiler (decompose → extract → align → critic → write → index → graph), content-hash dedupe, hosted and local model backends behind one interface, and a lint that finds orphan pages and broken links so the knowledge base is testable.',
    caveat: 'No baseline against RAG exists yet — that is the missing experiment.',
    url: 'https://github.com/Thunderk3g/Mneme',
  },
  {
    name: 'Arbor (R2P-IP)',
    kind: 'agent-governance architecture',
    blurb:
      'An architecture for agents that act on real systems: human sign-off for irreversible actions, an immutable audit chain, credential-free sandboxes and prompt-injection defence in depth are enforced by the architecture, not by policy. Documented as an RFC with decision records and wired, tested vertical slices.',
    caveat: 'A blueprint with vertical slices, not a deployed platform.',
    url: 'https://github.com/Thunderk3g/Arbor',
  },
  {
    name: 'ForgeLM',
    kind: 'fine-tuning on constrained hardware',
    blurb:
      'A small fine-tuning platform for consumer GPUs: 4-bit loading, LoRA adapters and a GRPO trainer behind one configuration, built to learn the training stack from the inside rather than through a hosted API.',
    caveat: 'Self-directed; results are on toy tasks, not published benchmarks.',
  },
  {
    name: 'This site',
    kind: 'research workbench disguised as a desktop',
    blurb:
      'A Kali-style desktop in the browser that runs a real Linux 6.8 kernel (v86) and a real PostgreSQL 18 (PGlite), around a paper-study workbench — three-pass notes, highlights, spaced recall, a literature matrix — with this résumé rendered from one typed source to every surface.',
    url: 'https://github.com/Thunderk3g/thunderkeg-homepage',
  },
];

/* ───────────────────────── Research ───────────────────────── */

export const research = {
  inPreparation: [
    {
      title: 'Coverage is not constraint: measuring constraint density in formalised regulatory rule bases',
      venue: 'Manuscript under revision for resubmission (preprint available on request)',
      summary:
        'Measured over the DAPRECO GDPR knowledge base, the largest freely available LegalRuleML corpus: 962 rules with a median of 12 antecedent predicates each, yet a mean constraint density of 0.462, and 43 rules (4.5 %) whose antecedents consist entirely of predicates that fire on any scenario the corpus can describe. Antecedent length is not selectivity, so a coverage-style audit cannot distinguish a faithfully general principle from a structurally non-discriminating rule. The six ubiquitous predicates are identical across a 25–50 % threshold plateau, so the finding is not an artefact of the cut-off. The measurement script is standard-library Python and ships with the paper; all data is public (Robaldo et al.).',
    },
    {
      title:
        'Grounded regulatory compliance review: an engineering case study of a precedent-imitating retrieval system in insurance marketing',
      venue: 'Manuscript in preparation (pending employer clearance)',
      summary:
        'The grounding-tier taxonomy, fail-closed persistence, precedent canonicalisation with leakage barriers, bounded Beta-Binomial feedback and deterministic applicability and disclosure adjudication — with the negative results, bypassed quality gates and exonerated suspects reported as contributions.',
    },
  ],
  published: [
    {
      title: 'SustainAI: Enhancing Sustainable Energy Forecasting',
      venue: 'CSEAI 2023 — 1st International Conference on Computing for Science, Engineering & AI',
      summary: 'Presented at the conference; forecasting for sustainable energy.',
    },
  ],
  directions: [
    'Applicability-constrained retrieval — where a hard categorical constraint that semantic similarity cannot express should be enforced: in the embedding, the SQL filter, or a post-retrieval deterministic judge.',
    'Whether constraint density near 0.4 is a general property of formalised regulatory rule bases, measurable across the public LegalRuleML corpora.',
    'Defaults as unverified distributional claims — a safety default adopted for a correct reason can route most of a corpus around the mechanism it protects, and only coverage measurement reveals it.',
    'When consensus pseudo-labelling fails for code-switched low-resource ASR — orthographic divergence, same-family correlated error, and hypothesis-granularity mismatch, measured at two scales.',
    'Evaluation instruments for romanized code-switched speech — WER scores spelling variants of one word as errors, and script canonicalisation is ill-posed when English tokens legitimately stay Latin; a script-aware, entity-weighted, human-validated metric for Indian financial speech does not yet exist.',
  ],
  /** Openly stated: this portfolio is part of a research-master's application. */
  track:
    'Applying for research-oriented master’s programmes in AI & Law and speech technology in Europe (Erasmus Mundus joint masters and Dutch, German and UK programmes) for the 2027 intake.',
};

/* ───────────────────────── Skills ───────────────────────── */

export const skills: { group: string; items: string }[] = [
  {
    group: 'Research methods',
    items:
      'benchmark design with declared confounds and stopping rules · leakage-safe splitting · threshold-sensitivity analysis · correlated-error analysis of ASR ensembles · Beta-Binomial reliability estimation · falsification-first reporting of negative results',
  },
  {
    group: 'LLM systems',
    items:
      'retrieval-augmented generation · hybrid dense + BM25 with reciprocal rank fusion · pgvector · generator–critic verification · LangGraph / LangChain orchestration · evaluation-harness design · prompt-injection defence · cost governance for paid model APIs · LoRA / QLoRA and GRPO fine-tuning (self-directed)',
  },
  {
    group: 'Speech',
    items:
      'ASR pipeline engineering · speaker diarization and channel-based attribution · VAD · WER/CER with script-normalised scoring · code-switched Hinglish and Indic handling · streaming STT/TTS · faster-whisper · corpus construction and dataset cards',
  },
  {
    group: 'Legal informatics & governance',
    items: 'LegalRuleML static analysis · GDPR (DAPRECO / PrOnto) · IRDAI and SEBI advertising obligations · DPDP Act 2023 data-class gating · PII redaction · append-only audit design',
  },
  {
    group: 'Engineering',
    items: 'Python · TypeScript · Java · SQL · FastAPI · PostgreSQL / pgvector · Redis · Qdrant · Next.js · Docker / Podman · RHEL 9 · Azure OpenAI · test-driven development · documentation as a maintained artefact',
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
  out.push('## Research interests', ...research.directions.map((d) => '- ' + d));
  out.push('', '## Publications');
  for (const r of research.published) out.push('', `### ${r.title}`, r.venue, r.summary);
  out.push('', '## Manuscripts');
  for (const r of research.inPreparation) out.push('', `### ${r.title}`, r.venue, r.summary);
  out.push('', research.track);
  out.push('', '## Education', ...education.map((e) => `${e.degree} — ${e.org} · ${e.period} · ${e.detail}`));
  out.push('', '## Experience');
  for (const r of roles) {
    out.push('', `### ${r.title} · ${r.org} · ${r.period}`, r.blurb);
    for (const g of r.groups) {
      if (g.heading) out.push('', `#### ${g.heading}`);
      out.push(...g.points.map((p) => '- ' + p));
    }
  }
  out.push('', '## Selected independent projects');
  for (const p of projects) {
    out.push('', `### ${p.name} — ${p.kind}${p.url ? ` (${p.url})` : ''}`, p.blurb);
    if (p.caveat) out.push(`(${p.caveat})`);
  }
  out.push('', '## Skills', ...skills.map((s) => `${s.group}: ${s.items}`));
  out.push('', '## Awards', ...awards.map((a) => '- ' + a));
  return out.join('\n');
}
