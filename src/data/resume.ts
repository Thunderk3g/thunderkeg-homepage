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
  /** Areas I read in and keep current on — tracked in the Research app, not claimed as my research. */
  following: [
    'AI in defense and national security — autonomy and counter-UAS, ISR and target recognition, LLMs for cyber operations, adversarial robustness, wargaming, and the policy around meaningful human control.',
    'AI agents in cyber security — autonomous pentesting and CTF agents, LLM-driven vulnerability discovery and fuzzing, SOC automation, and defending agents against prompt injection and tool abuse.',
    'Autonomous operation of large, configuration-heavy AI applications — coding and SWE agents, CI/CD and build repair, configuration validation and drift, incident root-cause analysis, and regression-testing LLM apps as prompts, models and configs change.',
    'AI and LLMs in trading and markets — financial LLMs and multi-agent trading systems, reinforcement learning for execution and portfolios, alpha mining, and the look-ahead and backtest biases that make results look better than they are.',
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

/* ───────────────────────── Working together ───────────────────────── */

/**
 * Everything the Hire app, the /hire page and the desktop's "work with me"
 * prompts say. Edit here and every surface follows.
 *
 * Each service names the work it is drawn from (`proof`), so nothing is
 * offered that is not already on this résumé. No rates are published; set
 * `open` to false to take the prompts down without removing the page.
 */
export interface Service {
  id: string;
  name: string;
  /** what the client ends up with */
  outcome: string;
  /** where on this site the same work is described */
  proof: string;
  /** a post or project that shows it, if one is public */
  link?: { label: string; href: string };
}

export const hire = {
  open: true,
  status: 'Open to freelance projects and new roles',
  /** shown beside the status; facts only */
  facts: ['Based in Pune, India', 'IST, UTC+5:30', 'Replies by email'],
  engagements: [
    { id: 'project', label: 'A freelance project', blurb: 'A scoped build or audit with a fixed outcome.' },
    { id: 'consult', label: 'Consulting or a review', blurb: 'A second pair of eyes on a system, a metric or a plan.' },
    { id: 'role', label: 'A full-time or contract role', blurb: 'AI engineering, applied research or a technical lead seat.' },
    { id: 'research', label: 'A research collaboration', blurb: 'AI & Law, retrieval evaluation or code-switched speech.' },
  ],
  services: [
    {
      id: 'grounded-llm',
      name: 'Retrieval-grounded LLM systems',
      outcome:
        'An assistant or reviewer that cites its evidence or declines to answer: hybrid dense and BM25 retrieval, a verification step that drops unsupported claims, and a fail-closed path to a human.',
      proof: 'Built in production for regulatory compliance review at an IRDAI-regulated insurer.',
      link: { label: 'A permissive default is a claim', href: '/writing/a-permissive-default-is-a-claim' },
    },
    {
      id: 'evaluation',
      name: 'Evaluation and audits of AI systems',
      outcome:
        'A written answer to “does this actually work?”: leakage-safe splits, declared confounds, sample sizes with every figure, and the failure cases your current metric hides.',
      proof: 'Found and reported speaker leakage, a saturating metric and a headline result that did not survive the full corpus.',
      link: { label: 'Falsifying my own headline result', href: '/writing/falsifying-my-own-result' },
    },
    {
      id: 'speech',
      name: 'Speech and ASR pipelines for Indian languages',
      outcome:
        'Transcription, speaker attribution and scoring for code-switched Hinglish and Indian English audio, with a corpus pipeline and a test split you can trust.',
      proof: 'Built call intelligence and an ASR corpus pipeline over Indian insurance telephony.',
    },
    {
      id: 'document-ai',
      name: 'Document AI and validation gates',
      outcome:
        'A document intake that classifies, reads and cross-checks, then returns a decision with a reason code instead of a confidence score nobody can act on.',
      proof: 'Built a KYC document-validation gate with dual-engine OCR and four decision states.',
    },
    {
      id: 'agents',
      name: 'Agent safety and governance',
      outcome:
        'Agents that cannot do the irreversible thing without sign-off: a tool gateway, approval tokens, an audit trail and layered prompt-injection defence.',
      proof: 'Designed Arbor, an agent-governance architecture with 10 ADRs and 219 passing tests.',
      link: { label: 'Arbor on GitHub', href: 'https://github.com/Thunderk3g/Arbor' },
    },
    {
      id: 'backend',
      name: 'AI backends and APIs',
      outcome:
        'The service around the model: FastAPI, PostgreSQL and pgvector, queues, cost guards for paid model APIs, and tests.',
      proof: 'Led a 10-person team shipping insurance purchase journeys; owns API design and releases.',
    },
  ] satisfies Service[] as Service[],
  /** how a first conversation goes */
  process: [
    'You send a short brief: what you need, by when, and what “done” looks like.',
    'I reply by email with questions, or with a clear no if it is not a fit.',
    'We agree scope, timeline and terms in writing before any work starts.',
  ],
};

export const TIMELINES = ['As soon as possible', 'Within a month', 'In 1–3 months', 'Flexible'] as const;

export interface Brief {
  engagement: string;
  name: string;
  company: string;
  services: string[];
  timeline: string;
  budget: string;
  details: string;
}

/** The brief as plain text, used for the email body and the copy button. */
export function briefText(b: Brief): string {
  const kind = hire.engagements.find((e) => e.id === b.engagement)?.label ?? 'An enquiry';
  const picked = hire.services.filter((s) => b.services.includes(s.id)).map((s) => s.name);
  const lines = [
    `Hi Diwakar,`,
    '',
    `I am getting in touch about ${kind.charAt(0).toLowerCase() + kind.slice(1)}.`,
    '',
    picked.length ? `Area: ${picked.join('; ')}` : '',
    b.timeline ? `Timeline: ${b.timeline}` : '',
    b.budget ? `Budget or compensation: ${b.budget}` : '',
    '',
    b.details || '(details)',
    '',
    b.name ? `${b.name}${b.company ? `, ${b.company}` : ''}` : '',
  ];
  return lines.filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n').trim();
}

export function briefMailto(b: Brief): string {
  const kind = hire.engagements.find((e) => e.id === b.engagement)?.label ?? 'Enquiry';
  const subject = `${kind}${b.company ? ` — ${b.company}` : ''}`;
  return `mailto:${profile.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(briefText(b))}`;
}

/* ───────────────────────── Derived helpers ───────────────────────── */

/** Flat plain-text résumé — used by the fake filesystem and the AI context. */
export function resumeText(): string {
  const out: string[] = [];
  out.push(profile.name, `${profile.title} · ${profile.company}`, profile.location);
  out.push(`${profile.email} · ${profile.phone} · github.com/${profile.github}`, '');
  out.push('## Summary', ...profile.summary.map((s) => '- ' + s), '');
  out.push('## Research interests', ...research.directions.map((d) => '- ' + d));
  out.push('', '## Also following', ...research.following.map((d) => '- ' + d));
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
  if (hire.open) {
    out.push('', '## Working together', `${hire.status}. ${hire.facts.join('. ')}.`);
    out.push(...hire.services.map((s) => `- ${s.name}: ${s.outcome}`));
    out.push(`To start: send a brief from the “Work with me” app or /hire, or email ${profile.email}.`);
  }
  return out.join('\n');
}
