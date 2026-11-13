/**
 * Single source of truth for every résumé surface in this project:
 * the /resume page, the PDF export, the Firefox app, the fake filesystem
 * under ~/Documents, and the AI assistant's grounding context.
 *
 * Editorial policy — read before adding a number.
 * ------------------------------------------------------------------
 * This repository is public. A figure appears here only if a reader learns
 * something from it, and only if it is one of these kinds:
 *
 *   public        from a public corpus or a public repository
 *   published     already in one of my own posts
 *   structural    how many systems, rules, roles, tables, tests, teams
 *   measured      offline evaluation and benchmark results, each stated with
 *                 what it was measured on (audited from the code, 2026-11-12)
 *   owner-stated  how long the team took, and my own career history
 *                 (titles, dates, awards, the reading group). Nothing else
 *                 rests on my word alone: a claim the code, a post or a
 *                 public repository does not back is not on this page.
 *
 * Still not published: business volumes and outcomes (submissions, calls,
 * conversions, premium, cost, spend), latency of production systems, corpus
 * sizes, reviewer-decision totals, colleagues' names, internal hosts, target
 * dates and private repository names. Nothing is estimated: a figure marked
 * "about" is a measurement, rounded.
 *
 * No phone number either. Scrapers read public repositories, and every surface
 * here is built from this file; email and the /hire form are the contact routes.
 *
 * Two build rules (scripts/resume-pdf.test.mts): every bullet is at most 330
 * characters, and /resume.pdf is exactly two pages. `lead` on a group sets
 * how many of its bullets the PDF prints; the page and the CV print them all.
 */

export const profile = {
  name: 'DIWAKAR ADHIKARI',
  title: 'Technical Lead, AI Engineering',
  company: 'Bajaj Life Insurance',
  location: 'Pune, India',
  email: 'diwakar.adhikari0@gmail.com',
  github: 'Thunderk3g',
  githubUrl: 'https://github.com/Thunderk3g',
  tagline: 'Production agentic, retrieval-grounded and speech AI systems for regulated financial services.',
  /** Two paragraphs: what I do and own, then how I got here and how the work is held to account. */
  summary: [
    'I started and lead AI engineering for the sales and marketing function of an IRDAI-regulated life insurer, taking it from language models in a chat window to agentic, retrieval-grounded and speech systems in production. I own each system from the business head’s brief through architecture, infrastructure, security and release, and trained the team’s engineers to ship on their own within four to five months.',
    'Four years in regulated financial-services engineering: intern to Senior Software Engineer, then lead of a ten-engineer team, then recruited in-house by the insurer to start its AI engineering. I build deterministic state machines around LLMs, applicability-constrained hybrid retrieval, Hinglish speech pipelines and time-validated models, and hold each to evaluation that can fail: when the full corpus did not support my own pilot result, I withdrew the claim and wrote up why.',
  ],
};

/* ───────────────────────── Experience ─────────────────────────
   How a bullet is written here:

   - Outcome or decision first, then the measure, then the method.
   - A number appears only with what it was measured on, and only if it is
     one of the kinds in the policy above. Nothing is estimated.
   - `result` is one measured outcome for the whole stream. It prints first,
     in bold, on every surface. No stream uses it at the moment.
   - `lead` is how many bullets, from the top, the two-page PDF carries. The
     /resume page, the academic CV and the plain-text résumé carry them all,
     so order the bullets by what a reader with ten seconds needs. */

export interface RoleGroup {
  heading: string;
  /** one measured outcome for the whole stream, e.g. a change with its baseline */
  result?: string;
  points: string[];
  /** how many of `points`, from the top, go in the two-page PDF; all of them when unset */
  lead?: number;
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
    org: 'Bajaj Life Insurance (formerly Bajaj Allianz Life)',
    period: 'Dec 2025 – Present',
    blurb:
      'Recruited in-house to start and lead AI engineering for the sales and marketing function of an IRDAI-regulated life insurer. I take each requirement from the business head, then design, build, release and run the system.',
    groups: [
      {
        heading: 'AI engineering function, platform and team',
        lead: 2,
        points: [
          'Started AI engineering in a function that had none: took requirements directly from business heads and worked with underwriting, analytics, products, IT, the data-warehouse team and information security to ship the systems below, with no team changing its workflow to fit the software.',
          'Trained the team to work as forward-deployed engineers who ship on their own within four to five months, ran a paper reading group (intent routing, agentic query caching, memory-augmented retrieval, agent threat models), and stood up one shared Podman stack on RHEL 9 (PostgreSQL, Redis, Qdrant, nginx) serving five applications.',
        ],
      },
      {
        heading: 'Conversational purchase journey for term insurance (in user-acceptance testing)',
        lead: 2,
        points: [
          'Architected the chat-based term-insurance purchase journey (English, Hindi, Hinglish) as a deterministic state machine: the model only reads and phrases text, 119 versioned rules, 62 flow steps and 6 rate tables (maker-checker, with rollback) decide every step, and a write-ahead ledger gates calls to 18 of the insurer’s APIs.',
          'Held it to evaluation: 7 suites and 393 cases took retrieval from 72% to 79% top-1 and from 90% to 97% hit@4, with Hindi FAQ answers precise on 34 of 34 turns. Shipped the first version in 16 days, and an A/B on its eval set chose a model 4.8× cheaper per passing answer, with no difference found on 40 of 40 checks.',
          'Designed the journey to ask less: IIB, GSTN and existing-policy checks run as soon as basic details are in, knock-out cases stop early with an alternative, and a health answer opens a reflex questionnaire. In 75 test journeys the price arrived by the fourth turn (median) with no fact asked twice.',
          'Built a pricing-parity harness that checks the engine against the insurer’s existing calculator across 100,000 input combinations.',
          'Designed every conversation to be auditable: the customer’s message, the model’s response, each guardrail decision and every upstream call are stored, as one scrubbed record per turn.',
        ],
      },
      {
        heading: 'Compliance review of marketing copy (LangGraph, in production)',
        lead: 2,
        points: [
          'Designed the precedent engine and replay harness for the team’s reviewer of marketing copy against IRDAI, SEBI and brand rules, which I co-built and run. Hybrid retrieval (pgvector and BM25, reciprocal rank fusion) over typed indexes, four kinds of cited evidence, and Beta-Binomial rule reliability from reviewer verdicts.',
          'Removed fabricated quotes by construction (a deterministic check drops any finding whose quoted evidence is not literally in the source) and made it fail closed. Measured the applicability filter’s permissive default, found most of the corpus untagged and bypassing it, and inverted the default, showing exclusions to reviewers.',
          'Found and fixed four silent failures that tuning would have hidden: a score that saturated, disclaimers lost in DOCX headers and text boxes, a disclaimer that still passed with "not" deleted, and a rename that corrupted rules.',
          'Kept reviewer scores out of training so the evaluation channel stays independent, and protected replay evaluation against leakage with two independent barriers.',
        ],
      },
      {
        heading: 'Speech analytics and code-switched Hinglish ASR',
        lead: 2,
        points: [
          'Co-built call analytics for the sales teams in six languages (speaker-labelled transcripts, dispositions, compliance detection) and built its realtime speech-to-speech voice agent. Remapped call records to acquisition channels so a call can be traced to the channel its lead came from, a data fix and not a model.',
          'Falsified my own headline result before anything was built on it: a third ASR hypothesis lifted auto-accepted labels from 8.82% to 49.30% on a pilot slice (5.6×), and the full corpus gave 2.74%. Wrote up both, with the three mechanisms that explain the gap.',
          'Built the ASR corpus pipeline with protected test splits, found speaker leakage in the protected split and rebuilt it so no speaker crosses a split. Benchmarked speaker attribution against human-adjudicated calls: splitting the stereo channels beat a commercial neural diarizer.',
          'Showed that Whisper repetition loops come from the decoder, not the audio: every confirmed case cleared under a temperature-fallback ladder. That stopped a quality filter which would have thrown away usable audio.',
          'Built governance in: an export gate by data class under the DPDP Act 2023 and IRDAI localisation rules, PII redaction, and a text-to-speech track stopped before any spend over an unresolved vendor-terms question.',
        ],
      },
      {
        heading: 'Lead scoring, attribution and data platforms',
        lead: 2,
        points: [
          'Showed that a “stop after six calls” rule rested on a broken attempt counter, using the pipeline I built to join WhatsApp, RCS and email campaign events to the lead master, which also became the scoring model’s training data.',
          'Built a LightGBM model that ranks every sales lead by its chance of buying within 90 days, with time-based validation and a point-in-time leakage gate that blocks a training run: PR-AUC 0.348 and 30× lift in the top 1% on a later-period holdout. Kept it over CatBoost, which gained 0.0013 PR-AUC at 9.9× the training time.',
          'Built a role-based sales reconciliation and approval portal for 6 user roles, where moving workbook parsing to a calamine service cut it from about 74 s to 0.3 s, and founded the lead-generation portal: an Angular shell that loads React games through module federation.',
        ],
      },
    ],
  },
  {
    id: 'finserv-lead',
    title: 'Web Development Lead',
    org: 'Bajaj Finserv Direct Ltd (embedded at Bajaj Allianz Life)',
    period: 'Feb 2025 – Nov 2025',
    blurb:
      'Promoted to lead the ten-engineer team building the insurer’s online purchase journeys. The insurer then recruited me in-house to start its AI engineering.',
    groups: [
      {
        heading: '',
        points: [
          'Led a ten-person engineering team delivering the term-insurance, ULIP and Smart Wealth Goal purchase applications (Angular 17) end to end, owning API design, the integration with the insurer, the payment, Aadhaar and journey-resume flows, and release management.',
          'Introduced the Adobe Analytics data layer to the purchase forms (now used in 35 files), ran a bundle-optimisation pass (lazy-loaded routes, a service worker, lazy images), and closed the critical authentication findings raised by VAPT security assessments.',
        ],
      },
    ],
  },
  {
    id: 'finserv-swe',
    title: 'Intern → Software Engineer → Senior Software Engineer',
    org: 'Bajaj Finserv Direct Ltd',
    period: 'Apr 2022 – Feb 2025',
    blurb:
      'Joined as an intern and was promoted to Software Engineer, then Senior Software Engineer, on consumer journeys for insurance, mutual funds and asset management.',
    groups: [
      {
        heading: '',
        points: [
          'Built customer acquisition journeys for motor insurance, mutual funds and the Bajaj Finserv AMC new-fund-offer launch (Angular, TypeScript, Java and Spring Boot, REST APIs, Redis, Kafka), integrating video KYC and partner underwriting APIs.',
          'Implemented server-side rendering (Angular Universal), RxJS state caching that removed repeated API calls, and lazy-loaded routes and assets for Core Web Vitals. Received the Deployment Star Award and the Esteemed Contributor to Financial Innovation Award.',
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
  /** shown on the page and the CV; the two-page PDF says what exists and stops */
  caveat?: string;
  /** Public repository or page for the project. */
  url?: string;
  /** false keeps it off the two-page PDF; the page and the CV still carry it */
  pdf?: boolean;
}

export const projects: Project[] = [
  {
    name: 'Arbor',
    kind: 'agent-governance and safety kernel',
    blurb:
      'For agents that act on real systems, enforced by the architecture and not by policy: single-use Ed25519 approval tokens for irreversible actions, a hash-chained audit log with Merkle roots, and a tool gateway that runs a taint firewall before approval. Written up as a 16-section RFC with 11 decision records; 219 passing tests.',
    caveat: 'A kernel with working vertical slices, not a platform; sandboxing is designed, not built.',
    url: 'https://github.com/Thunderk3g/Arbor',
  },
  {
    name: 'ForgeLM',
    kind: 'small task models against a small prompted LLM',
    blurb:
      'A 4-bit QLoRA fine-tuning platform (built with two collaborators), then CPU experiments with paired-bootstrap and McNemar gates. On Banking77 at 8 labels per class, a frozen encoder with a linear head scored 85.8% ± 0.4 on the full test set, and on a 1,000-text subset beat a few-shot 1.5B LLM by 87.5% to 66.9%, at ~3 ms against ~770 ms. With all the labels it reached 93.1% after 38 s of CPU training. A LoRA of a 360M model reached 89.0% on the 10 most frequent intents (chance 10%; 1.3% untuned) in 19 minutes.',
    caveat: 'Self-directed; not published benchmarks. The LLM baseline is one small prompted model: no larger or fine-tuned LLM was tested.',
    url: 'https://github.com/Thunderk3g/ForgeLM',
  },
  {
    name: 'qualityos',
    kind: 'work-internal evaluation harness with a belief record',
    blurb:
      'An evaluation harness that keeps an append-only record of beliefs (observe, hypothesise, experiment, revise) and is run by role-separated agents: one diagnoses, one fixes, one documents. Its probe found an LLM outage on a voice call being recorded as a clean compliance pass, and the failure path was fixed.',
    caveat: 'Built inside my work at the insurer, so there is no public repository; its recorded runs are on synthetic data.',
  },
  {
    name: 'Mneme',
    kind: 'LLM knowledge compiler',
    blurb:
      'Compiles PDF, HTML and text into a cross-referenced, cited wiki that is queried directly, instead of paying retrieval cost on every question. A five-stage compiler (decompose, extract, align, write, index) with seams left for a critic and a graph builder, content-hash dedupe, hosted and local models behind one interface, and a lint that finds orphan pages and broken links.',
    caveat: 'No baseline against RAG yet.',
    url: 'https://github.com/Thunderk3g/Mneme',
    pdf: false,
  },
  {
    name: 'This site',
    kind: 'a research workbench that is also a desktop',
    blurb:
      'A Kali-style desktop in the browser with 13 apps, a real Linux 6.8 kernel (v86) and PostgreSQL 18 (PGlite), around a paper-study workbench. The desktop can be taken apart in 3D and read as a Kali machine, this codebase or an LLM system.',
    url: 'https://github.com/Thunderk3g/thunderkeg-homepage',
    // the site's address is already in the PDF header
    pdf: false,
  },
];

/* ───────────────────────── Research ───────────────────────── */

export const research = {
  inPreparation: [
    {
      title: 'Coverage is not constraint: measuring constraint density in formalised regulatory rule bases',
      venue: 'Working paper (preprint on request; the measurement script is public)',
      /** the script that reproduces every number, served from /public */
      code: '/research/dapreco-density.py',
      /** the one line an industry reader needs */
      brief:
        'A measurement on the public DAPRECO GDPR rule base: 962 rules, a mean constraint density of 0.462, and 43 rules (4.5%) whose conditions are all corpus-common (9 when only the GDPR’s own scope predicates count).',
      summary:
        'Measured over the DAPRECO GDPR knowledge base, the largest freely available LegalRuleML corpus, as retrieved on 31 Aug 2026: 962 rules with a median of 12 antecedent predicates each, yet a mean constraint density of 0.462, and 43 rules (4.5%) whose antecedents consist entirely of predicates found in at least half of all rules. Frequency across rules is not truth across situations, so the paper reports a second reading: counting only the four predicates that hold wherever the GDPR applies gives a mean density of 0.622 and 9 such rules, all ontology-mapping rules. Antecedent length is not selectivity, so a coverage-style audit cannot tell a faithfully general principle from a rule that separates little. The set of six ubiquitous predicates is identical from a 25% to a 50% threshold. The measurement script is standard-library Python and public; all data is public (Robaldo et al.).',
    },
    {
      title: 'Grounded, fail-closed compliance review in production: what broke, and why the filter was not the problem',
      venue: 'Manuscript in preparation (pending employer clearance)',
      summary:
        'An operational study of a precedent-imitating compliance reviewer in insurance marketing: applicability metadata starved under a permissive default, a bulk rename that acted as an unmigrated schema change, a score metric that saturated, and fail-closed audit provenance, with the negative results and exonerated suspects reported as contributions.',
    },
  ],
  /** Presented, not yet linked to proceedings. The heading on every surface says “Conference presentations”;
      move this under a “Peer-reviewed” heading only once a DOI is on the entry. */
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
    'Contestable claim decisions and machine-readable policy wordings in Indian insurance: whether a rejection can be checked clause by clause against the wording in force, with every citation literally in the source. Nothing built yet.',
    'When consensus pseudo-labelling fails for code-switched low-resource ASR: orthographic divergence, same-family correlated error and hypothesis-granularity mismatch, measured at two scales.',
    'Evaluation instruments for romanized code-switched speech. WER scores spelling variants of one word as errors, and script canonicalisation is ill-posed when English tokens legitimately stay Latin; I have not found a script-aware, entity-weighted, human-validated metric for Indian financial speech.',
  ],
  /** Areas I read in and keep current on. Tracked in the Research app only: not on the résumé, the CV or /stacks, and not claimed as my research. */
  following: [
    'AI in defense and national security: autonomy and counter-UAS, ISR and target recognition, LLMs for cyber operations, adversarial robustness, wargaming, and the policy around meaningful human control.',
    'AI agents in cyber security: autonomous pentesting and CTF agents, LLM-driven vulnerability discovery and fuzzing, SOC automation, and defending agents against prompt injection and tool abuse.',
    'Autonomous operation of large, configuration-heavy AI applications: coding and SWE agents, CI/CD and build repair, configuration validation and drift, incident root-cause analysis, and regression-testing LLM apps as prompts, models and configs change.',
    'AI and LLMs in trading and markets: financial LLMs and multi-agent trading systems, reinforcement learning for execution and portfolios, alpha mining, and the look-ahead and backtest biases that make results look better than they are.',
  ],
  /** One sentence on where the research sits beside the engineering. */
  track:
    'I study evaluation failures: checks that report success they have not earned, in formalised legal rule bases (AI & Law) and in code-switched Hinglish speech, alongside applied AI engineering.',
};

/* ───────────────────────── Skills ─────────────────────────
   Only what a bullet above evidences, with one exception that is my own
   statement: distillation. No self-ratings, nothing stale. */

export const skills: { group: string; items: string }[] = [
  {
    group: 'Agentic and LLM systems',
    items:
      'tool-using agents (LangGraph / LangChain) · deterministic state-machine orchestration · hybrid retrieval (pgvector + BM25, reciprocal rank fusion) · evidence grounding and verbatim-quote critics · prompt-injection defence · offline eval suites and regression gates · API cost governance',
  },
  {
    group: 'Machine learning and evaluation',
    items:
      'gradient-boosted models (LightGBM, CatBoost) · time-based validation and leakage gates · PR-AUC and lift · paired-bootstrap and McNemar model selection · small task models against LLM baselines · distillation · LoRA / QLoRA fine-tuning · Beta-Binomial reliability',
  },
  {
    group: 'Speech',
    items:
      'telephony ASR pipelines · channel-split and diarization-based speaker attribution · script-normalised WER/CER · code-switched Hinglish and Indic · faster-whisper · speaker-disjoint corpus construction',
  },
  {
    group: 'Regulation and governance',
    items:
      'IRDAI and SEBI advertising obligations · fail-closed human routing · DPDP Act 2023 data-class gating · PII redaction · GDPR and LegalRuleML analysis · append-only audit design',
  },
  {
    group: 'Engineering and delivery',
    items:
      'Python · TypeScript · Java · SQL · FastAPI · Celery · Next.js · React · Angular · Spring Boot · PostgreSQL · Redis · Qdrant · Kafka · Docker / Podman on RHEL · nginx · Azure OpenAI · release management',
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
  'Deployment Star Award (Bajaj Finserv Direct)',
  'Esteemed Contributor to Financial Innovation Award',
  'COMPEX Indian Embassy Scholarship Scheme Awardee',
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
  status: 'Open to senior and lead AI engineering roles, technical advisory and research collaborations',
  /** shown beside the status; facts only */
  facts: ['Based in Pune, India', 'IST, UTC+5:30', 'Replies by email'],
  engagements: [
    { id: 'role', label: 'A full-time or contract lead role', blurb: 'Technical lead, staff AI engineer or forward-deployed AI architect.' },
    { id: 'project', label: 'A scoped AI build', blurb: 'From the requirement to an audited system in production.' },
    { id: 'consult', label: 'An evaluation or architecture review', blurb: 'A second pair of eyes on grounding, leakage, an eval harness or unit cost.' },
    { id: 'research', label: 'A research collaboration', blurb: 'AI & Law, retrieval evaluation or code-switched speech.' },
  ],
  services: [
    {
      id: 'grounded-llm',
      name: 'Applicability-constrained, grounded LLM systems',
      outcome:
        'An assistant or reviewer that keeps hard applicability apart from semantic similarity, checks every quote against its source deterministically, and fails closed to a human.',
      proof: 'Co-built and run in production for regulatory compliance review at an IRDAI-regulated insurer.',
      link: { label: 'A permissive default is a claim', href: '/writing/a-permissive-default-is-a-claim' },
    },
    {
      id: 'deterministic-agents',
      name: 'Deterministic state machines around LLMs',
      outcome:
        'A customer-facing conversation where versioned rules and calculators decide every step, price and API write, and the model only reads and phrases, in more than one language.',
      proof: 'Architected a trilingual term-insurance purchase journey: 119 versioned rules, 62 flow steps and 18 of the insurer’s APIs behind a ledger.',
    },
    {
      id: 'evaluation',
      name: 'Evaluation harnesses, leakage audits and cost gates',
      outcome:
        'A written answer to “does this actually work?”: leakage-safe splits, model-selection gates that cut spend without changing behaviour, and the failure cases your current metric hides.',
      proof: 'Chose a model 4.8× cheaper per passing answer with no difference found on its 40 checks; falsified my own 5.6× pilot result on the full corpus.',
      link: { label: 'Falsifying my own headline result', href: '/writing/falsifying-my-own-result' },
    },
    {
      id: 'speech',
      name: 'Speech and ASR pipelines for Indian languages',
      outcome:
        'Transcription, speaker attribution and scoring for code-switched Hinglish and Indian English telephony, with a corpus pipeline and a test split you can trust.',
      proof: 'Co-built six-language call analytics and an ASR corpus pipeline over Indian insurance telephony.',
    },
    {
      id: 'agents',
      name: 'Agent safety and governance',
      outcome:
        'Agents that cannot do the irreversible thing without sign-off: a tool gateway, single-use approval tokens, a tamper-evident audit trail and a taint firewall against prompt injection.',
      proof: 'Designed Arbor, an agent-governance architecture with 11 decision records and 219 passing tests.',
      link: { label: 'Arbor on GitHub', href: 'https://github.com/Thunderk3g/Arbor' },
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
  out.push(`${profile.email} · github.com/${profile.github}`, '');
  out.push('## Summary', ...profile.summary.map((s) => '- ' + s), '');
  out.push('## Skills', ...skills.map((s) => `${s.group}: ${s.items}`));
  out.push('', '## Experience');
  for (const r of roles) {
    out.push('', `### ${r.title} · ${r.org} · ${r.period}`, r.blurb);
    for (const g of r.groups) {
      if (g.heading) out.push('', `#### ${g.heading}`);
      if (g.result) out.push(`Result: ${g.result}`);
      out.push(...g.points.map((p) => '- ' + p));
    }
  }
  out.push('', '## Selected projects');
  for (const p of projects) {
    out.push('', `### ${p.name} — ${p.kind}${p.url ? ` (${p.url})` : ''}`, p.blurb);
    if (p.caveat) out.push(`(${p.caveat})`);
  }
  out.push('', '## Research');
  for (const r of [...research.inPreparation, ...research.published]) {
    out.push('', `### ${r.title}`, r.venue, r.summary);
  }
  out.push('', '## Research interests', ...research.directions.map((d) => '- ' + d));
  out.push('', research.track);
  out.push('', '## Education', ...education.map((e) => `${e.degree} — ${e.org} · ${e.period} · ${e.detail}`));
  out.push('', '## Awards', ...awards.map((a) => '- ' + a));
  if (hire.open) {
    out.push('', '## Working together', `${hire.status}. ${hire.facts.join('. ')}.`);
    out.push(...hire.services.map((s) => `- ${s.name}: ${s.outcome}`));
    out.push(`To start: send a brief from the “Work with me” app or /hire, or email ${profile.email}.`);
  }
  return out.join('\n');
}
