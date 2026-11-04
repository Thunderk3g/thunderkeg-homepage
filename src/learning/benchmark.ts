import { stateIndex } from './priority';
import type { DimensionLevel, LearningState, Skill, Track } from './types';

/* ───────────────────────── role benchmark ─────────────────────────
   docs/role-benchmark.md, as data. That document is the source of truth:
   change it first, then this file. Terse on purpose, like seed.ts. The
   90-day plan lives in seed.ts as roadmap phases p4–p6 (BENCHMARK_PHASES). */

export interface Dimension {
  id: string;
  name: string;
  senior: string;
  lead: string;
}

/** §1 — what separates a strong senior engineer from a lead. */
export const DIMENSIONS: Dimension[] = [
  { id: 'horizon', name: 'Time horizon', senior: "This quarter's features", lead: 'Sets direction 6–12 months out; writes the roadmap' },
  { id: 'ownership', name: 'Ownership', senior: 'A component', lead: 'A product capability or system in production, including incidents' },
  { id: 'quality', name: 'Quality system', senior: 'Writes tests', lead: "Owns evals, tracing and regression gates as the team's quality system" },
  { id: 'influence', name: 'Influence', senior: 'Own team', lead: 'Libraries, designs and reviews adopted by other teams' },
  { id: 'people', name: 'People', senior: 'Mentors informally', lead: 'Hiring input, growth plans, delegation; 40 % leadership / 60 % hands-on is typical in Indian BFSI postings' },
  { id: 'evidence', name: 'Evidence', senior: 'Delivered work', lead: 'Measured outcomes with baselines, stated honestly when confidential' },
];

export const LEVELS: { id: DimensionLevel; label: string }[] = [
  { id: 'senior', label: 'Senior' },
  { id: 'between', label: 'Between' },
  { id: 'lead', label: 'Lead' },
];

export interface Gap {
  id: string;
  /** 1 = highest leverage, the doc's order */
  priority: number;
  title: string;
  track: Track;
  why: string;
  /** the artefact that would prove the gap closed */
  proof: string;
  /** seed skill ids */
  skillIds: string[];
}

/** §3 — gaps against the 2026 market, highest leverage first. */
export const GAPS: Gap[] = [
  { id: 'g-observability', priority: 1, title: 'Production LLM observability and online evals', track: 'lead', why: 'Staff-level AI postings lead with it; the harness exists but is not yet visible as a system.', proof: 'Traces on the reviewer with faithfulness and context-precision scores attached, drift monitoring, and a regression gate in CI.', skillIds: ['ai-observability', 'llm-tracing', 'eval-methodology'] },
  { id: 'g-error-analysis', priority: 2, title: 'Error analysis as a named method', track: 'both', why: 'Already done implicitly; naming it makes it legible to eval-literate interviewers and reviewers.', proof: 'A failure-mode taxonomy document from open coding, with one targeted judge per failure mode.', skillIds: ['error-analysis-method', 'eval-methodology'] },
  { id: 'g-serving', priority: 3, title: 'Serving and inference optimisation', track: 'lead', why: '"LoRA or vLLM experience" is now a routine line in postings; nothing shows self-hosted serving.', proof: 'Self-hosted vLLM benchmark against the hosted API: latency, cost per request, quality delta.', skillIds: ['model-serving', 'vllm', 'quantization'] },
  { id: 'g-cost', priority: 4, title: 'LLM cost management', track: 'lead', why: 'A lead owns cost per query as a metric, not as a bill someone else reads.', proof: 'Cost per query and token budgets reported as an owned metric, in relative terms.', skillIds: ['cost-engineering'] },
  { id: 'g-red-team', priority: 5, title: 'Safety and red-teaming', track: 'both', why: 'A compliance reviewer that has never been attacked is an untested claim.', proof: 'Red-team report: prompt injection, jailbreaks and disclaimer evasion against the reviewer.', skillIds: ['red-teaming', 'security-engineering'] },
  { id: 'g-governance', priority: 6, title: 'AI governance literacy', track: 'both', why: 'EU AI Act Annex III makes life and health insurance pricing high-risk from August 2026; IRDAI formed an AI working group in 2026 (verify). The bridge to AI & Law.', proof: 'Mapping of the reviewer to EU AI Act Annex III and IRDAI expectations.', skillIds: ['ai-governance'] },
  { id: 'g-speech', priority: 7, title: 'Speech stack depth', track: 'research', why: 'Speech postings and programmes name pyannote 3.x, NeMo and DER as well as WER.', proof: 'DER and WER on the diarization benchmark, plus a code-switched evaluation protocol.', skillIds: ['asr-architecture', 'der-eval', 'wer-eval', 'indic-adaptation'] },
  { id: 'g-public', priority: 8, title: 'Public artefacts', track: 'both', why: 'Maintainership counts more than stars, for hiring panels and admissions alike.', proof: 'One maintained repository with releases and answered issues, and one talk or blog series.', skillIds: ['public-artefacts'] },
  { id: 'g-mlops', priority: 9, title: 'MLOps and data governance', track: 'lead', why: 'Lineage, model cards and PII handling are what an auditor asks for first.', proof: 'Lineage, model cards and PII handling documented for the KYC gate and the speech corpus.', skillIds: ['docker', 'cloud', 'ai-governance'] },
];

export type ProgrammeTrack = 'AI & Law' | 'AI' | 'Speech';

export interface Programme {
  id: string;
  name: string;
  track: ProgrammeTrack;
  fit: string;
  deadline: string;
  /** dates came from search snippets — check the programme page */
  verify: boolean;
  url?: string;
}

/** §5 — research-track applications, 2027 intake. The doc gives no URLs. */
export const PROGRAMMES: Programme[] = [
  { id: 'emildai', name: 'EMILDAI, Erasmus Mundus Law, Data and AI', track: 'AI & Law', fit: 'Strongest fit', deadline: 'Past cycle opened late October, scholarship deadline in January; motivation letter, CV, transcripts, IELTS 6.5, two referees', verify: true },
  { id: 'leiden-llm', name: 'Leiden Advanced LLM Law and Digital Technologies', track: 'AI & Law', fit: 'Law side, industry-friendly', deadline: 'Relevant work experience lowers the weight on curriculum; apply before 1 April for visa', verify: true },
  { id: 'utrecht-ai', name: 'Utrecht MSc Artificial Intelligence', track: 'AI', fit: 'Selective', deadline: 'Needs logic, programming, maths and ML fundamentals; non-EU deadline around 1 April', verify: true },
  { id: 'radboud-ai', name: 'Radboud MSc Artificial Intelligence', track: 'AI', fit: 'AI', deadline: 'Non-EU deadline 1 April, scholarship deadline 31 January', verify: true },
  { id: 'groningen-speech', name: 'Groningen MSc Speech Technology', track: 'Speech', fit: 'Speech, one year', deadline: 'Motivation is the primary criterion; deadline 1 May', verify: true },
  { id: 'saarland-lst', name: 'Saarland MSc Language Science and Technology', track: 'Speech', fit: 'Speech and language', deadline: 'Winter intake, deadline 15 February, no tuition', verify: true },
  { id: 'edinburgh-slp', name: 'Edinburgh MSc Speech and Language Processing', track: 'Speech', fit: 'Speech', deadline: 'Rolling batches; apply early', verify: true },
  { id: 'kuleuven-ai', name: 'KU Leuven Master of AI, Speech and Language option', track: 'Speech', fit: 'Speech', deadline: 'Historic non-EEA deadline 1 March', verify: true },
];

export const PROGRAMME_NOTE =
  "Maastricht's Law and AI and Tilburg's Law and Technology LLM require law credits or a law bachelor; check EMAI's and LCT's 2027 status before planning around them. None of these programmes lists the GRE.";

/* ───────────────────────── readiness ───────────────────────── */

const APPLIED = stateIndex('APPLIED');

export const atLeastApplied = (s: Skill) => stateIndex(s.state) >= APPLIED;

/** Unique skill ids mapped by the gaps that serve a track ('both' counts for each). */
export function trackSkillIds(track: Exclude<Track, 'both'>): string[] {
  const ids = GAPS.filter((g) => g.track === track || g.track === 'both').flatMap((g) => g.skillIds);
  return [...new Set(ids)];
}

export interface Readiness {
  ready: number;
  total: number;
  share: number;
}

/** Share of a track's mapped skills currently at APPLIED or better. */
export function readiness(state: LearningState, track: Exclude<Track, 'both'>): Readiness {
  const skills = trackSkillIds(track)
    .map((id) => state.skills.find((s) => s.id === id))
    .filter((s): s is Skill => Boolean(s));
  const ready = skills.filter(atLeastApplied).length;
  return { ready, total: skills.length, share: skills.length ? ready / skills.length : 0 };
}

/** Highest-priority gap with at least one mapped skill below APPLIED. */
export function nextGap(state: LearningState): { gap: Gap; below: Skill[] } | undefined {
  for (const gap of [...GAPS].sort((a, b) => a.priority - b.priority)) {
    const below = gap.skillIds
      .map((id) => state.skills.find((s) => s.id === id))
      .filter((s): s is Skill => Boolean(s) && !atLeastApplied(s as Skill));
    if (below.length) return { gap, below };
  }
  return undefined;
}
