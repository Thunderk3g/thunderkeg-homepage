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
  | 'Product & leadership';

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

export interface RoadmapPhase {
  id: string;
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
}
