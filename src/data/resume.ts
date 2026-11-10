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
  title: 'Technical Lead, AI Engineering',
  company: 'Bajaj Life Insurance',
  location: 'Pune, India',
  phone: '+91 93780 67880',
  email: 'diwakar.adhikari0@gmail.com',
  github: 'Thunderk3g',
  githubUrl: 'https://github.com/Thunderk3g',
  tagline: 'Retrieval-grounded and speech AI, built where a wrong answer is a regulatory event.',
  /**
   * Three sentences, in the order a reader needs them: scope, what makes the
   * work different, where it is going. No adjectives; every clause is backed
   * by a bullet further down.
   */
  summary: [
    'AI engineering lead in regulated Indian insurance. I own three production AI systems for a life insurer (compliance review, speech analytics and document AI) from design through operation, after three and a half years leading a ten-person engineering team.',
    'My work is making these systems safe to rely on: every answer tied to evidence, a fail-closed path to a human, and evaluation that survives a second look. When the full data did not support my own headline result, I retracted it and published why.',
    'Preparing research in AI & Law and speech technology: one measurement paper on a public legal rule base is under revision, and a case study of the compliance system is in preparation.',
  ],
};

/* ───────────────────────── Experience ─────────────────────────
   How a bullet is written here (docs/resume-research.md has the sources):

   - Outcome or decision first, then the measure, then the method.
   - A number appears only with what it was measured on. Numbers are either
     public (a corpus, a repository, one of my posts) or structural (how many
     systems, regulators, splits). Nothing internal is estimated.
   - `result` is the slot for a cleared internal figure. It is empty until I
     have one in writing; when filled it prints first, in bold. */

export interface RoleGroup {
  heading: string;
  /** one cleared, measured outcome for the whole stream, e.g. a relative change with its baseline */
  result?: string;
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
    title: 'Technical Lead, AI Engineering',
    org: 'Bajaj Life Insurance',
    period: 'Dec 2025 – Present',
    blurb:
      'Lead AI engineering for the marketing function of an IRDAI-regulated life insurer: three production systems, each owned from design and evaluation through release and operation. Internal volumes are confidential, so the figures below are public, structural, or already published in my own posts.',
    groups: [
      {
        heading: 'Compliance review of marketing copy (LLM system, in production)',
        points: [
          'Built and run the reviewer that grades marketing copy against IRDAI, SEBI and brand rules before a person sees it. Every finding cites one of four kinds of evidence (a past reviewer decision, an active rule, a product fact, a mandated disclosure), stored so it can be audited.',
          'Removed fabricated quotes by construction: a deterministic check drops any finding whose quoted evidence is not literally in the source, with no second model call.',
          'Made it fail closed. Anything the system has not actually evaluated goes to a human reviewer and never receives a grade.',
          'Measured a safety default instead of trusting it, and found most of the corpus was untagged and bypassing the applicability check. Inverted the default; what is excluded is now shown to reviewers.',
          'Found and fixed four silent failures that tuning would have hidden: a score that saturated, disclaimers lost in DOCX headers and text boxes, a disclaimer that still passed with "not" deleted, and a rename that corrupted rules.',
          'Under it: hybrid retrieval (pgvector and BM25, fused by reciprocal rank) over typed indexes, rule reliability estimated from reviewer verdicts (Beta-Binomial), and replay evaluation protected against leakage by two independent barriers.',
        ],
      },
      {
        heading: 'Speech analytics and code-switched ASR data (Hinglish and Indian English telephony)',
        points: [
          'Built call intelligence over insurance telephony (speaker-labelled transcripts, disposition and compliance detection) and the corpus pipeline behind it, with train, validation and protected test splits.',
          'Found speaker leakage in the protected test split, rebuilt it so that no speaker crosses a split, verified zero leakage across every pair of splits, and kept the pre-fix result on record.',
          'Retracted my own headline result. A third ASR hypothesis lifted auto-accepted labels from 8.82% to 49.30% on a pilot slice (5.6×); the full corpus gave 2.74%. Published both, with the three mechanisms that explain the gap.',
          'Benchmarked speaker attribution against human-adjudicated calls: splitting the stereo channels beat a commercial neural diarizer, which swapped the two speakers on whole calls.',
          'Showed that Whisper repetition loops come from the decoder, not the audio: every confirmed case cleared under a temperature-fallback ladder. That stopped a quality filter which would have thrown away usable audio.',
          'Built governance in: an export gate by data class under the DPDP Act 2023 and IRDAI localisation rules, PII redaction, and a text-to-speech track stopped before any spend over an unresolved vendor-terms question.',
        ],
      },
      {
        heading: 'Document AI for KYC, and evaluation practice',
        points: [
          'Built the KYC document gate: a capture-quality check, classification, two OCR engines reconciled against each other, and four decision states, each with a reason code a person can act on.',
          'Wrote its rule engine identically in Python and Java so that any measured difference is attributable to OCR alone. Finding: upscaling and better OCR models barely moved confidence on poor captures, so the fix went to capture quality, not a new parser.',
          'Built qualityos, an evaluation harness with an append-only record of beliefs and a rule against synthetic runs, operated by role-separated agents (one diagnoses, one fixes, one documents) so that disagreement is kept, not averaged away.',
        ],
      },
    ],
  },
  {
    id: 'finserv',
    title: 'Dev Lead',
    org: 'Bajaj Finserv Direct Ltd',
    period: 'Jun 2022 – Nov 2025',
    blurb: 'Term-insurance purchase journeys for an insurance marketplace.',
    groups: [
      {
        heading: '',
        points: [
          'Led a ten-person engineering team delivering term-insurance purchase journeys end to end.',
          'Owned API design, release management and the integration with the insurer, Bajaj Allianz Life.',
          'Closed the critical authentication findings raised by VAPT security assessments on the production journeys.',
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
    name: 'Arbor',
    kind: 'agent-governance architecture',
    blurb:
      'For agents that act on real systems: human sign-off for irreversible actions, an immutable audit chain, credential-free sandboxes and layered prompt-injection defence, enforced by the architecture and not by policy. Written up as an RFC with 10 decision records and 219 passing tests.',
    caveat: 'A blueprint with working vertical slices, not a deployed platform.',
    url: 'https://github.com/Thunderk3g/Arbor',
  },
  {
    name: 'Mneme',
    kind: 'LLM knowledge compiler',
    blurb:
      'Compiles PDF, HTML and text into a cross-referenced, cited wiki that is queried directly, instead of paying retrieval cost on every question. A seven-stage compiler (decompose, extract, align, critic, write, index, graph), content-hash dedupe, hosted and local models behind one interface, and a lint that finds orphan pages and broken links.',
    caveat: 'No baseline against RAG yet. That is the missing experiment.',
    url: 'https://github.com/Thunderk3g/Mneme',
  },
  {
    name: 'ForgeLM',
    kind: 'fine-tuning on consumer GPUs',
    blurb:
      'A small fine-tuning platform: 4-bit loading, LoRA adapters and a GRPO trainer behind one configuration, built to learn the training stack from the inside and not through a hosted API.',
    caveat: 'Self-directed; results are on toy tasks, not published benchmarks.',
    url: 'https://github.com/Thunderk3g/ForgeLM',
  },
  {
    name: 'This site',
    kind: 'a research workbench that is also a desktop',
    blurb:
      'A Kali-style desktop in the browser with 13 apps, a real Linux 6.8 kernel (v86) and a real PostgreSQL 18 (PGlite), around a paper-study workbench. The whole desktop can be taken apart in 3D and read as a Kali machine, as this codebase, or as an LLM system.',
    url: 'https://github.com/Thunderk3g/thunderkeg-homepage',
  },
];

/* ───────────────────────── Research ───────────────────────── */

export const research = {
  inPreparation: [
    {
      title: 'Coverage is not constraint: measuring constraint density in formalised regulatory rule bases',
      venue: 'Manuscript under revision for resubmission (preprint available on request)',
      /** the one line an industry reader needs */
      brief:
        'A measurement on the public DAPRECO GDPR rule base: 962 rules, a mean constraint density of 0.462, and 43 rules (4.5%) that cannot tell any two scenarios apart.',
      summary:
        'Measured over the DAPRECO GDPR knowledge base, the largest freely available LegalRuleML corpus: 962 rules with a median of 12 antecedent predicates each, yet a mean constraint density of 0.462, and 43 rules (4.5%) whose antecedents consist entirely of predicates that fire on any scenario the corpus can describe. Antecedent length is not selectivity, so a coverage-style audit cannot tell a faithfully general principle from a rule that discriminates nothing. The six ubiquitous predicates are identical across a 25–50% threshold plateau, so the finding does not depend on the cut-off. The measurement script is standard-library Python and ships with the paper; all data is public (Robaldo et al.).',
    },
    {
      title:
        'Grounded regulatory compliance review: an engineering case study of a precedent-imitating retrieval system in insurance marketing',
      venue: 'Manuscript in preparation (pending employer clearance)',
      summary:
        'The grounding-tier taxonomy, fail-closed persistence, precedent canonicalisation with leakage barriers, bounded Beta-Binomial feedback and deterministic applicability and disclosure adjudication, with the negative results, bypassed quality gates and exonerated suspects reported as contributions.',
    },
  ],
  published: [
    {
      title: 'SustainAI: Enhancing Sustainable Energy Forecasting',
      venue: 'CSEAI 2023, 1st International Conference on Computing for Science, Engineering & AI',
      summary: 'Presented at the conference; forecasting for sustainable energy.',
    },
  ],
  directions: [
    'Applicability-constrained retrieval: where a hard categorical constraint that semantic similarity cannot express should be enforced. In the embedding, the SQL filter, or a deterministic judge after retrieval.',
    'Whether constraint density near 0.4 is a general property of formalised regulatory rule bases, measurable across the public LegalRuleML corpora.',
    'Defaults as unverified distributional claims: a safety default adopted for a correct reason can route most of a corpus around the mechanism it protects, and only coverage measurement reveals it.',
    'When consensus pseudo-labelling fails for code-switched low-resource ASR: orthographic divergence, same-family correlated error and hypothesis-granularity mismatch, measured at two scales.',
    'Evaluation instruments for romanized code-switched speech. WER scores spelling variants of one word as errors, and script canonicalisation is ill-posed when English tokens legitimately stay Latin; a script-aware, entity-weighted, human-validated metric for Indian financial speech does not yet exist.',
  ],
  /** Areas I read in and keep current on — tracked in the Research app, not claimed as my research. */
  following: [
    'AI in defense and national security: autonomy and counter-UAS, ISR and target recognition, LLMs for cyber operations, adversarial robustness, wargaming, and the policy around meaningful human control.',
    'AI agents in cyber security: autonomous pentesting and CTF agents, LLM-driven vulnerability discovery and fuzzing, SOC automation, and defending agents against prompt injection and tool abuse.',
    'Autonomous operation of large, configuration-heavy AI applications: coding and SWE agents, CI/CD and build repair, configuration validation and drift, incident root-cause analysis, and regression-testing LLM apps as prompts, models and configs change.',
    'AI and LLMs in trading and markets: financial LLMs and multi-agent trading systems, reinforcement learning for execution and portfolios, alpha mining, and the look-ahead and backtest biases that make results look better than they are.',
  ],
  /** Openly stated: this portfolio is part of a research-master's application. */
  track:
    'Applying for research-oriented master’s programmes in AI & Law and speech technology in Europe (Erasmus Mundus joint masters and Dutch, German and UK programmes) for the 2027 intake.',
};

/* ───────────────────────── Skills ─────────────────────────
   Only what a bullet above evidences. No self-ratings, nothing stale. */

export const skills: { group: string; items: string }[] = [
  {
    group: 'LLM systems and retrieval',
    items:
      'hybrid retrieval (dense + BM25, reciprocal rank fusion) · pgvector · generator and critic verification · LangGraph / LangChain · prompt-injection defence · API cost governance · LoRA / QLoRA and GRPO fine-tuning (self-directed)',
  },
  {
    group: 'Speech',
    items:
      'ASR pipelines · speaker diarization and channel-based attribution · WER/CER with script-normalised scoring · code-switched Hinglish and Indic · faster-whisper · corpus construction and dataset cards',
  },
  {
    group: 'Evaluation and research methods',
    items:
      'benchmark design with declared confounds · leakage-safe splitting · threshold-sensitivity analysis · correlated-error analysis of ASR ensembles · Beta-Binomial reliability estimation · negative results reported as results',
  },
  {
    group: 'Regulation and governance',
    items: 'IRDAI and SEBI advertising obligations · DPDP Act 2023 data-class gating · PII redaction · GDPR (DAPRECO / PrOnto) · LegalRuleML analysis · append-only audit design',
  },
  {
    group: 'Engineering',
    items: 'Python · TypeScript · Java · SQL · FastAPI · PostgreSQL · Redis · Qdrant · Next.js · Docker / Podman · Azure OpenAI · API design · release management · test-driven development',
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
      proof: 'Designed Arbor, an agent-governance architecture with 10 decision records and 219 passing tests.',
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
  /** where I reply; required to send from the site, unused by the mailto fallback */
  email: string;
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

export function briefSubject(b: Brief): string {
  const kind = hire.engagements.find((e) => e.id === b.engagement)?.label ?? 'Enquiry';
  return `${kind}${b.company ? ` — ${b.company}` : ''}`;
}

export function briefMailto(b: Brief): string {
  return `mailto:${profile.email}?subject=${encodeURIComponent(briefSubject(b))}&body=${encodeURIComponent(briefText(b))}`;
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
      if (g.result) out.push(`Result: ${g.result}`);
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
