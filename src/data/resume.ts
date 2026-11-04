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
    'Engineer preparing for research in AI & Law and speech technology, after four years of building retrieval-grounded and speech systems in regulated Indian financial services — where a wrong answer is a regulatory event and every claim has to survive an audit.',
    'Method over systems: declared confounds, sample sizes stated with every figure, leakage-safe splits, and negative results reported as results — including falsifying a headline finding of my own at full-corpus scale.',
    'Current work: a measurement of constraint density in the public DAPRECO GDPR knowledge base, and an engineering case-study write-up on grounded regulatory compliance review.',
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
      'Leads AI engineering for an IRDAI-regulated life insurer’s marketing function. Selected for method; employer-internal metrics are omitted.',
    groups: [
      {
        heading: 'Retrieval-grounded regulatory compliance review (production)',
        points: [
          'Designed a six-node LangGraph grader for life-insurance marketing copy against IRDAI, SEBI and brand obligations on the principle of grounding before generation: every finding is anchored in a retrieved reviewer precedent, an active rule, a product fact or a mandated disclosure, and carries that evidence tier as a queryable column.',
          'Hybrid dense (pgvector) + BM25 retrieval fused by reciprocal rank fusion over six typed indexes, with a deterministic verbatim-substring critic that drops any finding whose quoted evidence is not literally in the source — removing fabricated evidence without a second model call.',
          'Separated regulatory applicability from semantic relevance with a deterministic, per-candidate-recorded applicability judge; then measured the metadata it depended on, found most of the corpus untagged and silently bypassing it under a permissive default, and inverted the default to fail-closed with exclusions shown to reviewers.',
          'Fail-closed persistence (anything not substantively evaluated resolves to human review, never a grade); Beta-Binomial rule reliability from reviewer verdicts, with reviewer scores architecturally excluded from training to keep an independent evaluation channel; leakage-safe replay evaluation with two independent barriers.',
          'Root-caused and reported rather than tuned away: a saturating score metric (replaced by a strictly decreasing, versioned policy); DOCX extraction missing disclaimers in headers, footers and text boxes; a disclaimer inverted by deleting “not” still passing fuzzy matching (fixed with a legally-critical-token guard); and a company rename done as find-and-replace that corrupted regexes, disclaimer wording and seed rules at once (replaced by an alias registry with effective dates).',
        ],
      },
      {
        heading: 'Code-switched speech and ASR data (Hinglish / Indian English telephony)',
        points: [
          'Built call intelligence over Indian insurance telephony (speaker-labelled transcripts, disposition, compliance detection) and an offline corpus pipeline for code-switched Hinglish and Indian English with train / validation / protected-test splits.',
          'Falsified my own headline result on consensus pseudo-labelling: a script-matched third ASR hypothesis sharply lifted per-utterance auto-accept on a pilot slice, but the full-corpus pass, with the coverage confound removed, kept only a small fraction of that gain. Isolated three separable mechanisms — orthographic divergence in romanized text, same-family correlated error, and call- versus utterance-level granularity mismatch.',
          'Three-arm benchmark against human-adjudicated ground truth (n=8, stated with every figure): stereo channel-split attribution outperformed commercial neural diarization, which inverted speakers on whole calls; showed the residual failure moves from separation to role labelling and built a confidence-ordered role voter with diarization fall-back.',
          'Found speaker leakage in the protected test split (agent voices shared with train/validation), re-carved it agent-atomically, re-verified zero leakage across all split pairs, and kept the pre-fix result on record.',
          'Showed Whisper hallucination loops were decoder artefacts rather than audio quality (all confirmed loopers resolved under a temperature-fallback ladder, at a measured compute cost), invalidating a data-quality filter; tested a published ICASSP tokenizer-expansion method and reported that its premise did not hold for romanized text.',
          'Data governance: a data-class export gate under the DPDP Act 2023 and IRDAI localisation rules; BFSI PII redaction labelled engineering-clean, not DPO-verified; and a TTS training track stopped before any spend over an unresolved vendor terms-of-service question.',
        ],
      },
      {
        heading: 'Document AI and evaluation methodology',
        points: [
          'Built a KYC document-validation gate (capture-quality pre-gate → classification → dual-engine OCR → cross-engine reconciliation → four decision states with reason codes), with the rule engine implemented verbatim in Python and Java so measured differences are attributable to OCR alone; reported that upscaling and better OCR models barely moved confidence on degraded captures — the fix was capture quality, not a better parser.',
          'Built qualityos, a standard-library evaluation harness (observe → hypothesise → experiment → revise beliefs) with an append-only belief graph and a rule forbidding synthetic runs or smoothed curves, run by role-separated agents — judges diagnose, a separate agent fixes, a librarian documents — so that disagreement is preserved rather than rounded to a clean verdict.',
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
          'Remediated critical authentication findings raised in VAPT security assessments.',
          'Self-directed work on quantised fine-tuning for constrained hardware: ForgeLM, a fine-tuning platform using 4-bit loading, LoRA and a GRPO trainer.',
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
      'Compiles PDF, HTML and text sources into a cross-referenced, citation-bearing wiki queried directly — an explicit architectural bet against paying RAG’s per-query re-derivation cost. Staged compiler (decompose → extract → align → critic → write → index → graph) with a manifest dependency map, content-hash dedupe, two interchangeable backends (hosted Claude and local Ollama) behind one interface, and a `lint` command that finds orphan pages and broken links so the knowledge base is testable.',
    caveat: 'No baseline against RAG exists — this is the missing experiment.',
    url: 'https://github.com/Thunderk3g/Mneme',
  },
  {
    name: 'Arbor (R2P-IP)',
    kind: 'agent-governance architecture',
    blurb:
      'Architecture RFC with 10 ADRs and six wired vertical slices (audit chain, approval tokens, ontology, tool gateway, focal graph, working memory), 219 passing tests. Human sign-off for irreversible actions, an immutable audit trail, credential-free sandboxes and prompt-injection defence in depth are enforced architecturally, not by policy.',
    caveat: 'A blueprint plus vertical slices, not a deployed platform.',
    url: 'https://github.com/Thunderk3g/Arbor',
  },
  {
    name: 'This site',
    kind: 'research notebook (Next.js)',
    blurb:
      'Long-form research notes and an annotated reading shelf in AI & Law and speech evaluation, each paper tracked as read or reading, with this résumé rendered from one typed source to every surface.',
  },
];

/* ───────────────────────── Research ───────────────────────── */

export const research = {
  inPreparation: [
    {
      title: 'Coverage is not constraint: measuring constraint density in formalised regulatory rule bases',
      venue: 'Submitted to JURIX 2026 (short paper) — not accepted; revising',
      summary:
        'Measured over the DAPRECO GDPR knowledge base, the largest freely available LegalRuleML corpus: 962 rules, median 12 antecedent predicates per rule, but mean constraint density 0.462 and 43 rules (4.5 %) whose antecedents consist entirely of predicates that fire on any scenario the corpus can describe. Antecedent length is not selectivity — so a coverage-style audit of a rule base cannot distinguish a faithfully general principle from a structurally non-discriminating rule. Measurement script is 120 lines, standard library only, and ships with the paper. The six ubiquitous predicates are identical across a 25–50 % threshold plateau, so the figure is not an artefact of the cut-off; all data is from the public DAPRECO KB (Robaldo et al.).',
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
    'Whether constraint density near 0.4 is a general property of formalised regulatory rule bases — measurable across the public LegalRuleML corpora.',
    'Defaults as unverified distributional claims — a safety default adopted for a correct reason can route most of a corpus around the mechanism it protects, and only coverage measurement reveals it.',
    'Identifier stability in LLM-built knowledge bases — a deduplication hash derived from an LLM-generated field inherits the generator’s non-determinism, so a content hash is not stable when the content is sampled.',
    'When consensus pseudo-labelling fails for code-switched low-resource ASR — orthographic divergence, same-family correlated error, and hypothesis-granularity mismatch, measured at two scales.',
    'Evaluation instruments for romanized code-switched speech — WER scores spelling variants of one word (theek / thik / teek) as errors, and script canonicalisation is ill-posed when English tokens legitimately stay Latin; a script-aware, entity-weighted, human-validated metric for Indian financial speech does not yet exist.',
  ],
  /** Openly stated: this portfolio is part of a research-master's application. */
  track:
    'Applying for a research-track master’s in AI & Law and speech technology in Europe (Erasmus Mundus joint masters and Dutch programmes), for the 2027 intake.',
};

/* ───────────────────────── Skills ───────────────────────── */

export const skills: { group: string; items: string }[] = [
  {
    group: 'Research methods',
    items:
      'benchmark design with declared confounds and stopping rules · leakage-safe splitting · threshold-sensitivity analysis · correlated-error analysis of ASR ensembles · Beta-Binomial reliability estimation · falsification-first reporting of negative results',
  },
  {
    group: 'Legal informatics',
    items: 'LegalRuleML static analysis · GDPR (DAPRECO/PrOnto) · IRDAI and SEBI advertising obligations · DPDP Act 2023',
  },
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
    group: 'Engineering',
    items: 'FastAPI · LangGraph · PostgreSQL/pgvector · Redis · Qdrant · Next.js · Docker/Podman · RHEL 9 · Azure OpenAI',
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
  out.push('## Research interests', ...research.directions.map((d) => '- ' + d));
  out.push('', '## Research');
  for (const r of [...research.inPreparation, ...research.published]) {
    out.push('', `### ${r.title}`, r.venue, r.summary);
  }
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
