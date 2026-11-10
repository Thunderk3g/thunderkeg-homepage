/**
 * The record behind the Stacks board: what I have learnt, as dated things done.
 *
 * Three levels, and nothing else:
 *
 *   field    a lane on the board                       (FIELDS)
 *   subject  one stack in that lane                    (SUBJECTS)
 *   cube     one thing built, measured, studied or     (RECORD, plus the live
 *            written, with the date it happened         sources below)
 *
 * This file holds only the cubes that have no other home: work, projects and
 * measurements. Two kinds of cube are never listed here because they already
 * live somewhere and are read from there (src/stacks/model.ts):
 *
 *   - posts and paper notes   content/*.md  (`stack:` in the frontmatter names
 *                             the subject; without it the tags decide)
 *   - papers being studied    the Research library, from Pass 1 on
 *
 * Editing rules
 * ------------------------------------------------------------------
 * One cube is one thing that happened, said in one line. If it is not on the
 * résumé, in a public repository or in a post, it does not go here. The same
 * editorial policy as src/data/resume.ts applies: scope and mechanism, never
 * an employer-internal figure.
 *
 * `when` is as precise as I can honestly be: 'YYYY-MM' where a commit or a
 * post dates it, 'YYYY' for work inside a role, 'YYYY–YY' for something that
 * ran across years. The board orders cubes by it, oldest at the bottom.
 */

export type CubeKind = 'built' | 'measured' | 'studied' | 'wrote';

export const KIND_LABEL: Record<CubeKind, string> = {
  built: 'built',
  measured: 'measured',
  studied: 'studied',
  wrote: 'wrote',
};

/** What each kind means, for legends and the record page. */
export const KIND_MEANING: Record<CubeKind, string> = {
  built: 'something I built, shipped or run',
  measured: 'a measurement or experiment, negative results included',
  studied: 'a paper or a course worked through',
  wrote: 'a post, a paper or a manuscript',
};

export const KINDS: CubeKind[] = ['built', 'measured', 'studied', 'wrote'];

export interface Field {
  id: string;
  name: string;
  blurb: string;
}

export interface Subject {
  id: string;
  field: string;
  name: string;
  /** one line: what the subject is, in my work */
  blurb: string;
  /** Research questions (src/research/seed.ts) whose papers stack here */
  rqIds?: string[];
  /** lowercase stems that route an untagged paper or post here */
  keywords: string[];
  /** an area I read in and keep current on, not one I claim work in yet */
  following?: boolean;
  /** only drawn once something lands on it */
  hideEmpty?: boolean;
}

export interface RecordEntry {
  subject: string;
  kind: CubeKind;
  when: string;
  title: string;
  /** a public page for it, if there is one */
  href?: string;
}

/* ───────────────────────── fields ─────────────────────────
   Board order, left to right. */

export const FIELDS: Field[] = [
  { id: 'eng', name: 'Engineering', blurb: 'The four years before AI, and the web and backend work that still carries everything else.' },
  { id: 'retrieval', name: 'Retrieval & grounding', blurb: 'Getting the right evidence in front of a model, and refusing to answer without it.' },
  { id: 'eval', name: 'Evaluation & method', blurb: 'How I find out whether something works, and what I do when it does not.' },
  { id: 'speech', name: 'Speech', blurb: 'Code-switched Hinglish and Indian English telephony, from audio to scored transcript.' },
  { id: 'law', name: 'Law & governance', blurb: 'Regulation as an engineering constraint: compliance review, rule bases, data rules.' },
  { id: 'agents', name: 'Agents & security', blurb: 'Systems that act, what stops them, and the tracks I follow around them.' },
  { id: 'models', name: 'Models & documents', blurb: 'Below the API: fine-tuning, local models, cost, and reading documents.' },
];

/* ───────────────────────── subjects ───────────────────────── */

export const SUBJECTS: Subject[] = [
  /* Engineering */
  { id: 'cs-foundations', field: 'eng', name: 'Computer science foundations', blurb: 'The degree underneath the rest.', keywords: [] },
  { id: 'apis-backend', field: 'eng', name: 'APIs & backend services', blurb: 'Versioned APIs and the services behind them.', keywords: ['api design', 'fastapi', 'backend', 'microservice'] },
  { id: 'leading', field: 'eng', name: 'Leading delivery', blurb: 'Owning a team, a release train and the integration across teams.', keywords: [] },
  { id: 'web', field: 'eng', name: 'Web front end', blurb: 'This site, and the sites I have built for other people.', keywords: ['frontend', 'this-site', 'next.js', 'react', 'browser'] },
  { id: 'web-platform', field: 'eng', name: 'Enterprise web platform', blurb: 'Content platform, analytics and performance work on production pages.', keywords: ['core web vitals', 'web performance', 'content management'] },
  { id: 'databases', field: 'eng', name: 'Databases', blurb: 'PostgreSQL as the system of record and as the retrieval store.', keywords: ['postgres', 'sql', 'pgvector', 'query plan'] },

  /* Retrieval & grounding */
  { id: 'hybrid-retrieval', field: 'retrieval', name: 'Hybrid retrieval', blurb: 'Dense and lexical retrieval, fused and routed.', keywords: ['hybrid', 'bm25', 'dense retrieval', 'rank fusion', 'reranking', 'multilingual retrieval'] },
  { id: 'grounding', field: 'retrieval', name: 'Grounding & verification', blurb: 'Every claim tied to evidence that is literally in the source.', keywords: ['grounding', 'attribution', 'faithful', 'hallucinat', 'citation', 'rag'] },
  { id: 'constrained-retrieval', field: 'retrieval', name: 'Constrained retrieval', blurb: 'Where a hard categorical constraint should live in a retrieval system.', rqIds: ['rq1'], keywords: ['metadata filter', 'hard constraint', 'filtered', 'constrained retrieval', 'applicab', 'pre-filter', 'post-filter'] },
  { id: 'knowledge-compilation', field: 'retrieval', name: 'Knowledge compilation', blurb: 'Compiling sources into a cited knowledge base instead of re-deriving it per query.', rqIds: ['rq5'], keywords: ['dedup', 'identifier', 'entity resolution', 'knowledge graph construction', 'knowledge base construction', 'wiki'] },

  /* Evaluation & method */
  { id: 'eval-design', field: 'eval', name: 'Evaluation design', blurb: 'Harnesses, metrics and the confounds declared before the run.', keywords: ['benchmark design', 'evaluation harness', 'metric', 'llm-as-judge', 'annotation'] },
  { id: 'leakage', field: 'eval', name: 'Splits & leakage', blurb: 'Test sets that have not seen the training data, checked rather than assumed.', keywords: ['leakage', 'data split', 'contamination', 'held-out'] },
  { id: 'reliability', field: 'eval', name: 'Reliability estimation', blurb: 'How much to trust a rule, estimated from the verdicts on it.', keywords: ['beta-binomial', 'calibration', 'reliability', 'bayesian'] },
  { id: 'root-cause', field: 'eval', name: 'Root-cause analysis', blurb: 'Failures traced to their mechanism and reported, not tuned away.', keywords: ['root cause', 'failure analysis', 'error analysis', 'post-mortem'] },
  { id: 'research-practice', field: 'eval', name: 'Research practice', blurb: 'Writing it up, and what I want to work on next.', keywords: ['research', 'career', 'masters'] },
  { id: 'llm-regression', field: 'eval', name: 'Regression-testing LLM apps', blurb: 'What breaks when prompts, models and configs change.', rqIds: ['rq-o2'], keywords: ['regression', 'llm application', 'observability', 'monitoring', 'prompt change'], following: true },
  { id: 'backtest-validity', field: 'eval', name: 'Backtest validity', blurb: 'Look-ahead and survivorship bias in LLM-derived market signals.', rqIds: ['rq-m1'], keywords: ['look-ahead', 'lookahead', 'backtest', 'alpha', 'transaction cost', 'out-of-sample'], following: true },
  { id: 'wider-reading', field: 'eval', name: 'Wider reading', blurb: 'Papers that do not sit under one subject.', keywords: [], hideEmpty: true },

  /* Speech */
  { id: 'asr-pipelines', field: 'speech', name: 'ASR pipelines', blurb: 'From telephony audio to speaker-labelled, scored transcripts.', keywords: ['speech recognition', 'asr', 'telephony', 'call cent', 'streaming'] },
  { id: 'speaker-attribution', field: 'speech', name: 'Speaker attribution', blurb: 'Who said what, measured against human-adjudicated ground truth.', keywords: ['diariz', 'speaker', 'der'] },
  { id: 'pseudo-labelling', field: 'speech', name: 'Consensus pseudo-labelling', blurb: 'When agreement between ASR systems is evidence, and when it is not.', rqIds: ['rq3'], keywords: ['pseudo-label', 'pseudo label', 'consensus', 'self-training', 'data selection', 'rover'] },
  { id: 'speech-eval', field: 'speech', name: 'Speech evaluation', blurb: 'The right instrument for romanized, code-switched speech.', rqIds: ['rq4'], keywords: ['wer', 'word error rate', 'code-switch', 'romani', 'transliterat', 'script', 'hinglish', 'indic'] },
  { id: 'whisper-decoding', field: 'speech', name: 'Whisper decoding', blurb: 'What the decoder does when it loops, and why.', keywords: ['whisper', 'decoding', 'temperature fallback', 'hallucination loop'] },

  /* Law & governance */
  { id: 'compliance-review', field: 'law', name: 'Compliance review', blurb: 'An LLM reviewer for regulated marketing copy, in production.', keywords: ['compliance', 'regnlp', 'regulatory', 'obligation', 'irdai', 'sebi'] },
  { id: 'rule-bases', field: 'law', name: 'Legal rule bases', blurb: 'How selective formalised regulatory rules really are.', rqIds: ['rq2'], keywords: ['legalruleml', 'deontic', 'rule base', 'formalis', 'formaliz', 'gdpr', 'dapreco'] },
  { id: 'data-governance', field: 'law', name: 'Data governance', blurb: 'What may leave the building, decided by a gate and not a habit.', keywords: ['dpdp', 'pii', 'redaction', 'privacy', 'data protection', 'localisation'] },
  { id: 'human-oversight', field: 'law', name: 'Human control of AI decisions', blurb: 'Where an LLM can sit in a decision loop and stay overseeable.', rqIds: ['rq-d2'], keywords: ['human-in-the-loop', 'human oversight', 'meaningful human control', 'decision support', 'wargam', 'escalat'], following: true },

  /* Agents & security */
  { id: 'agent-governance', field: 'agents', name: 'Agent governance', blurb: 'Agents that cannot do the irreversible thing without sign-off.', keywords: ['agent governance', 'audit trail', 'approval', 'sandbox', 'guardrail'] },
  { id: 'prompt-injection', field: 'agents', name: 'Prompt-injection defence', blurb: 'Agents with tools, resisting the text they read.', rqIds: ['rq-c2'], keywords: ['prompt injection', 'indirect injection', 'tool poisoning', 'jailbreak', 'privilege', 'exfiltrat'] },
  { id: 'multi-agent', field: 'agents', name: 'Multi-agent workflows', blurb: 'Role-separated agents whose disagreement is kept.', keywords: ['multi-agent', 'orchestrat', 'langgraph', 'agentic workflow'] },
  { id: 'appsec', field: 'agents', name: 'Application security', blurb: 'Findings from security assessments, fixed on production systems.', keywords: ['authentication', 'vapt', 'vulnerab', 'owasp'] },
  { id: 'offensive-agents', field: 'agents', name: 'Offensive-security agents', blurb: 'When an autonomous agent can be trusted with security work.', rqIds: ['rq-c1'], keywords: ['penetration test', 'pentest', 'exploit', 'red team', 'capture the flag', 'ctf'], following: true },
  { id: 'self-managing', field: 'agents', name: 'Self-managing applications', blurb: 'Agents that keep a configuration-heavy system healthy.', rqIds: ['rq-o1'], keywords: ['configuration', 'misconfig', 'drift', 'ci/cd', 'continuous integration', 'incident', 'self-healing'], following: true },
  { id: 'adversarial', field: 'agents', name: 'Adversarial robustness', blurb: 'Staying reliable when the environment is working against you.', rqIds: ['rq-d1'], keywords: ['adversarial', 'robust', 'jamming', 'poison', 'backdoor', 'spoof'], following: true },
  { id: 'trading-agents', field: 'agents', name: 'Trading agents', blurb: 'Multi-agent LLM systems against a simple systematic baseline.', rqIds: ['rq-m2'], keywords: ['trading agent', 'portfolio', 'position sizing', 'market making', 'execution'], following: true },

  /* Models & documents */
  { id: 'fine-tuning', field: 'models', name: 'Fine-tuning & quantization', blurb: 'Adapting and shrinking models on hardware I own.', keywords: ['fine-tun', 'lora', 'qlora', 'quantiz', 'quantis', 'adapter', 'grpo'] },
  { id: 'transformer-internals', field: 'models', name: 'Transformer internals', blurb: 'The architecture, taken apart to see it.', keywords: ['attention', 'transformer', 'scaling law', 'positional', 'kv cache'] },
  { id: 'local-models', field: 'models', name: 'Local models', blurb: 'Running models on my own machine behind the same interface as hosted ones.', keywords: ['ollama', 'local model', 'on-device', 'llama.cpp'] },
  { id: 'cost', field: 'models', name: 'Cost governance', blurb: 'Paid model APIs under a budget that holds.', keywords: ['cost', 'budget', 'token usage', 'pricing'] },
  { id: 'document-ai', field: 'models', name: 'Document AI', blurb: 'Reading identity documents and returning a decision with a reason.', keywords: ['ocr', 'document understanding', 'kyc', 'layout'] },
];

/* ───────────────────────── cubes ─────────────────────────
   Grouped by where the claim comes from, so each one can be checked. */

const e = (subject: string, kind: CubeKind, when: string, title: string, href?: string): RecordEntry => ({
  subject,
  kind,
  when,
  title,
  href,
});

const GH = 'https://github.com/Thunderk3g/';

export const RECORD: RecordEntry[] = [
  /* ── résumé: education and the Dev Lead years (2018–2025) ── */
  e('cs-foundations', 'studied', '2018–22', 'B.Tech in Computer Science and Engineering, SRM University'),
  e('apis-backend', 'built', '2022–25', 'Term-insurance purchase-journey APIs for an insurance marketplace'),
  e('apis-backend', 'built', '2022–25', 'The integration with the insurer on the other side of those journeys'),
  e('leading', 'built', '2022–25', 'Led a ten-person engineering team and owned its releases'),
  e('appsec', 'built', '2022–25', 'Fixed critical authentication findings from VAPT assessments on production journeys'),
  e('research-practice', 'wrote', '2023', 'SustainAI: sustainable energy forecasting, presented at CSEAI 2023'),

  /* ── résumé: Technical Lead, AI Engineering (Dec 2025 – present) ── */
  e('leading', 'built', '2025-12', 'Took on AI engineering for a life insurer: compliance review, speech analytics, document AI'),

  // compliance review
  e('compliance-review', 'built', '2026', 'An LLM reviewer that grades insurance marketing copy against IRDAI, SEBI and brand obligations'),
  e('compliance-review', 'built', '2026', 'Fail-closed by construction: anything not substantively evaluated goes to a human'),
  e('compliance-review', 'wrote', '2026', 'Manuscript in preparation: grounded regulatory compliance review, an engineering case study'),
  e('grounding', 'built', '2026', 'Grounding before generation: every finding anchored to retrieved evidence, with its evidence tier stored'),
  e('grounding', 'built', '2026', 'A deterministic critic that drops any finding whose quoted evidence is not in the source'),
  e('hybrid-retrieval', 'built', '2026', 'Dense (pgvector) and BM25 retrieval fused by reciprocal rank fusion over typed indexes'),
  e('databases', 'built', '2026', 'PostgreSQL with pgvector as the retrieval store'),
  e('constrained-retrieval', 'measured', '2026', 'Most of a corpus was untagged and bypassing the applicability judge under a permissive default'),
  e('constrained-retrieval', 'built', '2026', 'Inverted that default to fail-closed, with the exclusions shown to reviewers'),
  e('reliability', 'built', '2026', 'Rule reliability estimated from reviewer verdicts with a Beta-Binomial model'),
  e('reliability', 'built', '2026', 'Reviewer scores kept out of training, so the evaluation channel stays independent'),
  e('eval-design', 'built', '2026', 'Replay evaluation made leakage-safe by two independent barriers'),
  e('eval-design', 'measured', '2026', 'A score metric that saturated, replaced by a strictly decreasing, versioned policy'),
  e('root-cause', 'measured', '2026', 'DOCX extraction was missing disclaimers in headers, footers and text boxes'),
  e('root-cause', 'built', '2026', 'A legally-critical-token guard, after a disclaimer with "not" deleted still passed fuzzy matching'),
  e('root-cause', 'built', '2026', 'An alias registry with effective dates, after a find-and-replace rename corrupted rules'),

  // speech
  e('asr-pipelines', 'built', '2026', 'Call intelligence over insurance telephony: speaker-labelled transcripts, disposition and compliance detection'),
  e('asr-pipelines', 'built', '2026', 'A corpus pipeline for code-switched Hinglish and Indian English with a protected test split'),
  e('leakage', 'measured', '2026', 'Found speaker leakage in the protected test split'),
  e('leakage', 'built', '2026', 'Re-carved the split agent-atomically and verified zero leakage across every split pair'),
  e('speaker-attribution', 'measured', '2026', 'Stereo channel-split attribution beat commercial neural diarization against human-adjudicated truth'),
  e('speaker-attribution', 'built', '2026', 'A confidence-ordered role voter with diarization as the fallback'),
  e('pseudo-labelling', 'measured', '2026', 'Pilot: a script-matched third ASR hypothesis looked decisive'),
  e('pseudo-labelling', 'measured', '2026', 'Full corpus, coverage confound removed: most of the gain was gone, and three mechanisms explain why'),
  e('whisper-decoding', 'measured', '2026', 'Whisper hallucination loops are decoder artefacts: every confirmed looper resolved under a temperature-fallback ladder'),
  e('speech-eval', 'measured', '2026', 'Tested a published tokenizer-expansion method; its premise does not hold for romanized text'),
  e('data-governance', 'built', '2026', 'A data-class export gate under the DPDP Act 2023 and IRDAI localisation rules'),
  e('data-governance', 'built', '2026', 'PII redaction for BFSI transcripts, labelled engineering-clean and not DPO-verified'),

  // document AI and evaluation practice
  e('document-ai', 'built', '2026', 'A KYC validation gate: capture-quality pre-gate, classification, dual-engine OCR, decisions with reason codes'),
  e('document-ai', 'built', '2026', 'The rule engine written identically in Python and Java, so differences are attributable to OCR alone'),
  e('document-ai', 'measured', '2026', 'Upscaling and better OCR models barely moved confidence on degraded captures; the fix was capture quality'),
  e('eval-design', 'built', '2026', 'qualityos: an evaluation harness with an append-only belief graph and no synthetic runs'),
  e('multi-agent', 'built', '2026', 'Role-separated agents: judges diagnose, a separate agent fixes, a librarian documents'),
  e('multi-agent', 'built', '2026', 'Orchestration with LangGraph and LangChain'),
  e('cost', 'built', '2026', 'Budget guards and metering for paid model APIs'),
  e('apis-backend', 'built', '2026', 'The services around the models: FastAPI, PostgreSQL and queues'),

  /* ── résumé: the constraint-density paper (public data) ── */
  e('rule-bases', 'measured', '2026', 'Constraint density over the DAPRECO GDPR knowledge base: 962 rules, mean density 0.462'),
  e('rule-bases', 'wrote', '2026', 'Manuscript under revision: Coverage is not constraint'),

  /* ── public repositories, dated by their commits ── */
  e('web', 'built', '2022-01', 'The first version of this site', GH + 'thunderkeg-homepage'),
  e('web', 'built', '2025-03', 'This site rebuilt on Next.js', GH + 'thunderkeg-homepage'),
  e('local-models', 'built', '2025-03', 'A browser extension for local models through Ollama', GH + 'ollama-extension'),
  e('fine-tuning', 'built', '2025-08', 'ForgeLM: 4-bit loading, LoRA adapters and a GRPO trainer for consumer GPUs', GH + 'ForgeLM'),
  e('fine-tuning', 'built', '2026-03', 'A Qwen fine-tune for compliance text', GH + 'qwen-compliance-finetune'),
  e('web', 'built', '2026-05', 'A desktop in the browser: window manager, terminal, file system', GH + 'thunderkeg-homepage'),
  e('web', 'built', '2026-05', 'Client sites and a storefront, in TypeScript'),
  e('knowledge-compilation', 'built', '2026-06', 'Mneme: a staged compiler from sources to a cross-referenced, cited wiki', GH + 'Mneme'),
  e('knowledge-compilation', 'built', '2026-06', 'Content-hash dedupe, and a lint that finds orphan pages and broken links', GH + 'Mneme'),
  e('local-models', 'built', '2026-06', 'Hosted and local model backends behind one interface, in Mneme', GH + 'Mneme'),
  e('agent-governance', 'built', '2026-06', 'Arbor: human sign-off for irreversible actions, an immutable audit chain, credential-free sandboxes', GH + 'Arbor'),
  e('agent-governance', 'wrote', '2026-06', 'Arbor written up as an RFC with ten decision records', GH + 'Arbor'),
  e('prompt-injection', 'built', '2026-06', "Layered prompt-injection defence in Arbor's tool gateway", GH + 'Arbor'),
  e('web', 'built', '2026-11', 'A paper-study workbench in this site: three-pass notes, highlights, spaced recall, a literature matrix', GH + 'thunderkeg-homepage'),
  e('databases', 'built', '2026-11', 'PostgreSQL compiled to WebAssembly as an in-tab research workspace', GH + 'thunderkeg-homepage'),

  /* ── from my Claude Code sessions (Sep – Nov 2026) and a private study repo.
        Named at the level of the technology only. Delete any I would rather
        not show. ── */
  e('transformer-internals', 'built', '2026-03', 'A transformer architecture visualiser, built to see the internals'),
  e('web-platform', 'measured', '2026-09', 'A Core Web Vitals audit of production pages'),
  e('web-platform', 'built', '2026-10', 'Calculator pages migrated onto Adobe Experience Manager components'),
  e('web-platform', 'built', '2026-10', 'Analytics data-layer events wired through purchase forms'),
  e('apis-backend', 'built', '2026-10', 'Pending-state handling for a payment-gateway integration'),
  e('hybrid-retrieval', 'built', '2026-11', 'Query routing across Hindi, Hinglish and English, scored offline'),
];
