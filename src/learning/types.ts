/**
 * Persistent AI-engineering Learning OS — data model.
 *
 * The central object is a SKILL STATE, not a course. Every estimate is a
 * hypothesis that evidence can move in either direction.
 */

export type KnowledgeState =
  | 'UNKNOWN'
  | 'AWARE'
  | 'CONCEPTUAL'
  | 'APPLIED'
  | 'INTERNALIZED'
  | 'STRONG';

/** Ordered so a state can be compared numerically. */
export const STATE_ORDER: KnowledgeState[] = [
  'UNKNOWN',
  'AWARE',
  'CONCEPTUAL',
  'APPLIED',
  'INTERNALIZED',
  'STRONG',
];

export const STATE_BLURB: Record<KnowledgeState, string> = {
  UNKNOWN: 'No reliable evidence.',
  AWARE: 'Terminology understood; cannot use it reliably.',
  CONCEPTUAL: 'Can explain the mechanism.',
  APPLIED: 'Used successfully in a real implementation.',
  INTERNALIZED: 'Can explain, derive, debug and implement the important parts independently.',
  STRONG: 'Repeated evidence across projects, implementations and interviews.',
};

export type Domain =
  | 'Model internals'
  | 'Training'
  | 'Inference & serving'
  | 'Speech'
  | 'Retrieval & agents'
  | 'Evaluation'
  | 'Systems & backend'
  | 'Infrastructure'
  | 'Foundations'
  | 'Interview craft'
  | 'Product & leadership'
  | 'Governance & safety';

export type QueueLane = 'NOW' | 'NEXT' | 'LATER' | 'MAINTAIN' | 'IGNORE';

export interface Skill {
  id: string;
  name: string;
  domain: Domain;
  /** 1–5: how much this matters for the target role */
  roleImportance: number;
  /** 1–5: how often it comes up in interviews for that role */
  interviewRelevance: number;
  state: KnowledgeState;
  /** 0–1 — how much I trust my own estimate. Low confidence raises priority. */
  confidence: number;
  /**
   * Can I do this without an AI assistant? `null` = never tested, which is
   * treated as "unknown", never as "no".
   */
  independent: boolean | null;
  /** skill ids this depends on */
  deps: string[];
  /** the concrete thing to achieve next */
  objective: string;
  /** what would prove it — the AI-free check */
  aiFreeCheck: string;
  /** ISO dates */
  lastPracticed?: string;
  nextReview?: string;
  /** manual override of the computed queue lane */
  lane?: QueueLane;
  projectId?: string;
  notes?: string;
  /** review schedule, moved only by recorded checks (schema v3) */
  sched?: Sched;
  /** when `state` last changed; promotion counts passes after this (schema v3) */
  stateChangedAt?: string;
}

/**
 * Per-skill review schedule. An expanding interval with an ease factor, in
 * the SM-2 family, adapted to coarse pass / hard / fail checks that take
 * 10–30 minutes rather than seconds (see schedule.ts).
 */
export interface Sched {
  /** days until the next check */
  interval: number;
  /** growth factor applied on a clean pass, 1.3–2.8 */
  ease: number;
  lapses: number;
  /** the interval before the current lapse; set while a retry is owed */
  preLapse?: number;
  /** clean passes still owed before the interval may grow again (after a confident failure) */
  hold?: number;
}

export type Outcome = 'pass' | 'hard' | 'fail';

/** One recorded attempt at a skill's AI-free check. The raw material for scheduling and calibration. */
export interface Review {
  id: string;
  date: string;
  skillId: string;
  /** a short retrieval check, or the check at the end of a full session */
  kind: 'check' | 'session';
  /** probability of passing, stated before starting; null when recorded without a prediction */
  predicted: number | null;
  outcome: Outcome;
  /** an AI assistant was used during the attempt: it counts as practice, never as proof */
  assisted: boolean;
  minutes?: number;
  /** where it broke or where I hesitated */
  note?: string;
  /** days to the next check that this review scheduled */
  intervalAfter: number;
}

/** The check or session in progress. Persisted, so a reload does not lose the clock. */
export interface Run {
  skillId: string;
  kind: 'check' | 'session';
  startedAt: number;
  /** null until the prediction is made; nothing else is shown before it */
  predicted: number | null;
  /** index into the run's phases; equal to their count once only the outcome is left */
  phase: number;
  phaseStartedAt: number;
}

/** The standing plan: when and where practice happens, and how often. */
export interface Plan {
  /** an if-then sentence: the cue and the place */
  ifThen: string;
  /** practice days planned per week */
  perWeek: number;
}

export type AiAssistance = 'none' | 'light' | 'heavy' | 'generated';

export const ASSISTANCE_LABEL: Record<AiAssistance, string> = {
  none: 'No AI — written from an empty file',
  light: 'AI for lookup/syntax only',
  heavy: 'AI wrote most of it, I directed and debugged',
  generated: 'AI generated it; I reviewed only',
};

export type EvidenceKind =
  | 'implementation'
  | 'benchmark'
  | 'experiment'
  | 'notebook'
  | 'memo'
  | 'blog'
  | 'diagram'
  | 'interview'
  | 'paper-notes'
  | 'production'
  | 'commit';

export interface Evidence {
  id: string;
  date: string;
  skillIds: string[];
  kind: EvidenceKind;
  /** what the artifact is, plus a link if there is one */
  artifact: string;
  url?: string;
  /** what I personally did, as opposed to what an agent did */
  didMyself: string;
  assistance: AiAssistance;
  whatFailed?: string;
  whatLearned: string;
  /** a number, a WER, a latency — anything measurable */
  result?: string;
  /** 0–1 self-rated confidence after producing this */
  confidence: number;
  /** a rigorous negative result is first-class evidence */
  negative?: boolean;
}

export type ProjectStage =
  | 'Proposed'
  | 'Researching'
  | 'Building'
  | 'Evaluating'
  | 'Writing'
  | 'Complete';

export const PROJECT_STAGES: ProjectStage[] = [
  'Proposed',
  'Researching',
  'Building',
  'Evaluating',
  'Writing',
  'Complete',
];

export interface Milestone {
  id: string;
  title: string;
  done: boolean;
  /** what I must implement myself for this milestone to count */
  mine: string;
  /** what an agent is allowed to do */
  agentOk: string;
  doneAt?: string;
}

export interface Project {
  id: string;
  name: string;
  stage: ProjectStage;
  objective: string;
  /** skills the project builds */
  develops: string[];
  /** skills the finished artifact would prove */
  proves: string[];
  evaluation: string;
  artifact: string;
  repo?: string;
  resumeValue: string;
  interviewValue: string;
  researchPotential?: string;
  milestones: Milestone[];
  primary?: boolean;
}

export type ResourceState =
  | 'needed-now'
  | 'supporting-build'
  | 'interview-prep'
  | 'deep-dive'
  | 'later'
  | 'completed';

export interface Resource {
  id: string;
  title: string;
  url?: string;
  /** never add a resource without one */
  reason: string;
  state: ResourceState;
  skillIds: string[];
  /** filled in on completion */
  learned?: string[];
  disagreed?: string;
  buildDifferently?: string;
}

export interface InterviewDomain {
  id: string;
  name: string;
  /** 0–5 each, tracked independently */
  knowledge: number;
  implementation: number;
  explanation: number;
  confidence: number;
  evidenceIds: string[];
}

export interface Story {
  id: string;
  title: string;
  category: string;
  situation: string;
  problem: string;
  constraints: string;
  decision: string;
  alternatives: string;
  implementation: string;
  result: string;
  lesson: string;
  owned: string;
  followUps: string[];
}

export interface Session {
  id: string;
  date: string;
  skillId: string;
  goal: string;
  steps: { minutes: number; label: string; detail: string }[];
  evidenceTarget: string;
  completed: boolean;
}

export interface Reassessment {
  id: string;
  date: string;
  built: string;
  canDoWithoutAi: string;
  failedToReproduce: string;
  raised: string[];
  lowered: string[];
  bottleneck: string;
  projectStillBest: string;
  dropped: string;
}

/** Which career track a plan phase or benchmark gap serves. */
export type Track = 'lead' | 'research' | 'both';

export interface RoadmapPhase {
  id: string;
  /** absent on the original learning phases (p1–p3) */
  track?: Track;
  /** relative, not calendar-pinned: 'Day 0–30' */
  window: string;
  theme: string;
  artifacts: string[];
  skillIds: string[];
  startedAt?: string;
  completedAt?: string;
}

export interface CareerTarget {
  northStar: string;
  spike: string;
  companies: string[];
  notes: string;
}

/** Self-assessed position on one lead-vs-senior dimension. */
export type DimensionLevel = 'senior' | 'between' | 'lead';

export type ApplicationStatus = 'not-started' | 'researching' | 'drafting' | 'submitted' | 'decided';

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  'not-started': 'Not started',
  researching: 'Researching',
  drafting: 'Drafting',
  submitted: 'Submitted',
  decided: 'Decided',
};

export interface LearningState {
  version: number;
  target: CareerTarget;
  skills: Skill[];
  evidence: Evidence[];
  projects: Project[];
  resources: Resource[];
  interview: InterviewDomain[];
  stories: Story[];
  sessions: Session[];
  reassessments: Reassessment[];
  roadmap: RoadmapPhase[];
  /** the single skill allowed to dominate right now */
  currentSkillId: string;
  /** max 3, ids or free text */
  todayFocus: string[];
  lastReassessedAt?: string;
  /** role benchmark: dimension id → self-assessment (schema v2) */
  benchmark: Record<string, DimensionLevel>;
  /** role benchmark: `${phaseId}:${artifactIndex}` → done (schema v2) */
  planDone: Record<string, boolean>;
  /** role benchmark: programme id → application status (schema v2) */
  applications: Record<string, ApplicationStatus>;
  /** every recorded check, newest first (schema v3) */
  reviews: Review[];
  activeRun: Run | null;
  plan: Plan;
}
