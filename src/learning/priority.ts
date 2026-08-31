import {
  STATE_ORDER,
  type Evidence,
  type LearningState,
  type QueueLane,
  type Session,
  type Skill,
} from './types';

/* ───────────────────────── scoring ─────────────────────────
   Priority = role importance × skill gap × evidence uncertainty × dependency value.
   Explicitly NOT "lowest skill first": CUDA trivia must not outrank PyTorch,
   because PyTorch blocks five downstream skills and CUDA blocks nothing yet. */

export const stateIndex = (s: Skill['state']) => STATE_ORDER.indexOf(s);

/** 0 (mastered) → 1 (nothing there). INTERNALIZED is the bar, not STRONG. */
export function gap(skill: Skill): number {
  const target = STATE_ORDER.indexOf('INTERNALIZED');
  const raw = (target - stateIndex(skill.state)) / target;
  const g = Math.max(0, Math.min(1, raw));
  // an untested independence claim is itself a gap, even at a high state
  if (skill.independent === null && stateIndex(skill.state) >= STATE_ORDER.indexOf('APPLIED')) {
    return Math.max(g, 0.35);
  }
  if (skill.independent === false) return Math.max(g, 0.5);
  return g;
}

export const uncertainty = (skill: Skill) => 1 - Math.max(0, Math.min(1, skill.confidence));

/** Everything transitively downstream of this skill. Memoised per call-set. */
export function dependents(skills: Skill[]): Map<string, Set<string>> {
  const direct = new Map<string, string[]>();
  for (const s of skills) {
    for (const d of s.deps) {
      if (!direct.has(d)) direct.set(d, []);
      direct.get(d)!.push(s.id);
    }
  }
  const out = new Map<string, Set<string>>();
  const walk = (id: string, seen: Set<string>) => {
    for (const child of direct.get(id) ?? []) {
      if (seen.has(child)) continue;
      seen.add(child);
      walk(child, seen);
    }
    return seen;
  };
  for (const s of skills) out.set(s.id, walk(s.id, new Set<string>()));
  return out;
}

export interface Ranked {
  skill: Skill;
  priority: number;
  gap: number;
  uncertainty: number;
  /** how many skills this unblocks, transitively */
  unlocks: number;
  /** unmet prerequisites — a skill is not workable until these are cleared */
  blockedBy: Skill[];
}

const READY = STATE_ORDER.indexOf('APPLIED');

export function rank(state: LearningState): Ranked[] {
  const byId = new Map(state.skills.map((s) => [s.id, s]));
  const down = dependents(state.skills);

  return state.skills
    .map((skill) => {
      const g = gap(skill);
      const u = uncertainty(skill);
      const unlocks = down.get(skill.id)?.size ?? 0;
      // log-ish so a hub with 12 dependants does not swamp everything else
      const dependencyValue = 1 + Math.log2(1 + unlocks);
      const blockedBy = skill.deps
        .map((d) => byId.get(d))
        .filter((d): d is Skill => !!d && stateIndex(d.state) < READY);
      // a blocked skill is real work, just not *now* — damp rather than drop
      const readiness = blockedBy.length === 0 ? 1 : 1 / (1 + blockedBy.length);
      return {
        skill,
        gap: g,
        uncertainty: u,
        unlocks,
        blockedBy,
        priority: skill.roleImportance * g * (0.5 + u) * dependencyValue * readiness,
      };
    })
    .sort((a, b) => b.priority - a.priority);
}

/* ───────────────────────── queue lanes ─────────────────────────
   Breadth fragmentation is the named risk, so the lane assignment is
   deliberately narrow: exactly one NOW, and everything blocked falls back. */

export function lanes(state: LearningState): Record<QueueLane, Ranked[]> {
  const ranked = rank(state);
  const out: Record<QueueLane, Ranked[]> = { NOW: [], NEXT: [], LATER: [], MAINTAIN: [], IGNORE: [] };
  const current = ranked.find((r) => r.skill.id === state.currentSkillId);
  if (current) out.NOW.push(current);

  for (const r of ranked) {
    if (r.skill.id === state.currentSkillId) continue;
    if (r.skill.lane) {
      out[r.skill.lane].push(r);
      continue;
    }
    if (r.gap <= 0.15 && r.skill.independent === true) {
      out.MAINTAIN.push(r);
    } else if (r.skill.roleImportance <= 2 && r.blockedBy.length > 0) {
      out.IGNORE.push(r);
    } else if (r.blockedBy.length === 0 || r.blockedBy.every((b) => b.id === state.currentSkillId)) {
      out.NEXT.push(r);
    } else {
      out.LATER.push(r);
    }
  }
  out.NEXT = out.NEXT.slice(0, 6);
  return out;
}

/** The one skill the dashboard should shout about. */
export function bottleneck(state: LearningState): Ranked | undefined {
  return rank(state).find((r) => r.blockedBy.length === 0) ?? rank(state)[0];
}

/* ───────────────────────── evidence → estimates ─────────────────────────
   Evidence moves estimates in BOTH directions. AI-generated evidence can
   raise "applied" but can never, on its own, establish independence. */

export function evidenceFor(state: LearningState, skillId: string): Evidence[] {
  return state.evidence
    .filter((e) => e.skillIds.includes(skillId))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** What a skill's state would be, judged only from attached evidence. */
export function impliedState(items: Evidence[]): Skill['state'] {
  if (items.length === 0) return 'UNKNOWN';
  const unaided = items.filter((e) => e.assistance === 'none');
  const light = items.filter((e) => e.assistance === 'light');
  if (unaided.length >= 3) return 'STRONG';
  if (unaided.length >= 1) return 'INTERNALIZED';
  if (light.length >= 1 || items.some((e) => e.kind === 'production')) return 'APPLIED';
  return 'CONCEPTUAL';
}

/** Does the claimed state outrun the evidence? This is what the coach challenges. */
export function overclaimed(skill: Skill, items: Evidence[]): boolean {
  return stateIndex(skill.state) > stateIndex(impliedState(items)) + 1;
}

/* ───────────────────────── spaced revision ─────────────────────────
   Engineering retrieval, not flashcards: intervals stretch with demonstrated
   independence and shrink when a check fails. */

const INTERVALS = [2, 5, 12, 25, 45, 90];

export function nextReviewDate(skill: Skill, passed: boolean, from = new Date()): string {
  const base = stateIndex(skill.state);
  const step = passed ? Math.min(INTERVALS.length - 1, base) : 0;
  const days = INTERVALS[step] * (skill.independent === true ? 1.5 : 1);
  const d = new Date(from);
  d.setDate(d.getDate() + Math.round(days));
  return d.toISOString().slice(0, 10);
}

export function dueForReview(state: LearningState, today = new Date()): Skill[] {
  const iso = today.toISOString().slice(0, 10);
  return state.skills.filter((s) => s.nextReview && s.nextReview <= iso);
}

/* ───────────────────────── session generator ─────────────────────────
   60 minutes, weighted the way the learning loop is: understand → implement
   unaided → verify → explain. The output is always an artifact. */

export function buildSession(skill: Skill, id: string, date: string): Session {
  return {
    id,
    date,
    skillId: skill.id,
    goal: skill.objective,
    steps: [
      {
        minutes: 15,
        label: 'Understand',
        detail: `Read only enough to answer: what problem does ${skill.name.toLowerCase()} solve, and what breaks without it? Close the tab before the next step.`,
      },
      {
        minutes: 25,
        label: 'Implement — no AI',
        detail: skill.aiFreeCheck,
      },
      {
        minutes: 10,
        label: 'Verify',
        detail: 'Diff against a reference implementation. Where it differs, find out why before changing anything.',
      },
      {
        minutes: 10,
        label: 'Explain',
        detail: `Write the interview answer: mechanism, complexity, and the trade-off you would be asked about. No notes.`,
      },
    ],
    evidenceTarget: `Code + a short notes file recording what failed and what you now understand about ${skill.name.toLowerCase()}.`,
    completed: false,
  };
}

/* ───────────────────────── weekly plan ───────────────────────── */

export interface WeekPlan {
  understand: string;
  implement: string;
  apply: string;
  read: { title: string; reason: string }[];
  explain: string;
  ship: string;
}

export function weekPlan(state: LearningState): WeekPlan {
  const skill = state.skills.find((s) => s.id === state.currentSkillId) ?? state.skills[0];
  const project = state.projects.find((p) => p.primary) ?? state.projects[0];
  const nextMilestone = project?.milestones.find((m) => !m.done);
  const reading = state.resources
    .filter((r) => r.state === 'needed-now' || (r.state === 'supporting-build' && r.skillIds.includes(skill.id)))
    .slice(0, 3);

  return {
    understand: skill.objective,
    implement: skill.aiFreeCheck,
    apply: nextMilestone
      ? `${project.name} → ${nextMilestone.title}. You implement: ${nextMilestone.mine}`
      : 'Pick the next milestone on the primary project.',
    read: reading.map((r) => ({ title: r.title, reason: r.reason })),
    explain: `Answer out loud, unaided: "${skill.aiFreeCheck}" — then write down where you hesitated.`,
    ship: nextMilestone
      ? `A committed artifact for ${nextMilestone.title}, with the AI-assistance level recorded honestly.`
      : `A committed artifact demonstrating ${skill.name.toLowerCase()}.`,
  };
}

/* ───────────────────────── portfolio target state ───────────────────────── */

export interface PortfolioTarget {
  label: string;
  met: boolean;
  why: string;
}

export function portfolioTargets(state: LearningState): PortfolioTarget[] {
  const has = (kind: Evidence['kind'], unaided = false) =>
    state.evidence.some((e) => e.kind === kind && (!unaided || e.assistance === 'none'));
  const complete = (id: string) => state.projects.find((p) => p.id === id)?.stage === 'Complete';

  return [
    { label: 'Serious PyTorch implementation, written unaided', met: has('implementation', true), why: 'The one artifact that separates you from an AI-assisted builder.' },
    { label: 'Transformer-from-scratch educational repo', met: complete('attention-from-scratch'), why: 'Proves model-level understanding is yours.' },
    { label: 'Fine-tuned model experiment with a protected split', met: state.evidence.some((e) => e.skillIds.includes('finetuning') || e.skillIds.includes('asr-finetuning')), why: 'Moves you from consuming models to adapting them.' },
    { label: 'Indic speech project with measured results', met: complete('indic-asr-lab'), why: 'The differentiator for Indic-speech teams.' },
    { label: 'Evaluation framework you can point at', met: has('benchmark'), why: 'Your strongest existing instinct, made public.' },
    { label: 'Inference benchmarking repository', met: state.evidence.some((e) => e.kind === 'benchmark' && e.skillIds.some((s) => ['kv-cache', 'inference-internals', 'quantization'].includes(s))), why: 'Shows you reason about latency and VRAM, not just correctness.' },
    { label: 'One strong technical write-up', met: has('blog') || has('memo'), why: 'Depth signal that survives a recruiter skim.' },
    { label: 'A published negative result', met: state.evidence.some((e) => e.negative), why: 'Rare, credible, and already how you work.' },
    { label: 'Clear personally-authored vs AI-assisted labelling', met: state.evidence.length > 0 && state.evidence.every((e) => !!e.didMyself), why: 'Honesty here is a hiring signal, not a liability.' },
  ];
}
