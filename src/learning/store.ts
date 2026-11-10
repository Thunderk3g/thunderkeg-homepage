'use client';

import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { BENCHMARK_PHASES, BENCHMARK_RESOURCES, DEFAULT_PLAN, SCHEMA_VERSION, V1_TARGET, seedState } from './seed';
import { buildSession } from './priority';
import { ASSISTED_RETRY_DAYS, addDays, nextState, phasesFor, schedule, type Scheduled } from './schedule';
import type {
  ApplicationStatus,
  DimensionLevel,
  Evidence,
  InterviewDomain,
  LearningState,
  Outcome,
  Plan,
  ProjectStage,
  Reassessment,
  Resource,
  Review,
  Skill,
  Story,
} from './types';

/**
 * Persistence.
 *
 * There is no backend and no auth in this project, so the Learning OS is
 * local-first by design: everything lives in this browser's localStorage and
 * nothing is ever sent to a server (the coach sends a *summary* only, and only
 * when you press the button). That also makes it private by construction.
 *
 * Storage sits behind zustand's persist adapter, so moving to Supabase or
 * Postgres later is a change to `storage:` here plus an async loader — not a
 * rewrite of every component. Export/import keeps the history portable either
 * way, so the data is never trapped in one implementation.
 */

const KEY = 'kos:learning-os';

const today = () => new Date().toISOString().slice(0, 10);
const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 9)}`;

interface Actions {
  setCurrentSkill: (id: string) => void;
  patchSkill: (id: string, patch: Partial<Skill>) => void;
  /** record an AI-free check attempt without the runner (no prediction); reschedules the next one */
  recordCheck: (id: string, passed: boolean) => void;

  /** begin a check or a full session; nothing is shown until a prediction is made */
  startRun: (skillId: string, kind: 'check' | 'session') => void;
  predictRun: (p: number) => void;
  advanceRun: () => void;
  cancelRun: () => void;
  /** record the outcome of the run in progress, reschedule the skill, and return what changed */
  finishRun: (r: { outcome: Outcome; assisted: boolean; note: string }) => (Scheduled & { review: Review }) | null;
  /** move a skill up one state after enough unaided passes */
  promote: (id: string) => void;
  setPlan: (patch: Partial<Plan>) => void;
  setTodayFocus: (items: string[]) => void;

  addEvidence: (e: Omit<Evidence, 'id'>) => void;
  removeEvidence: (id: string) => void;

  setProjectStage: (id: string, stage: ProjectStage) => void;
  toggleMilestone: (projectId: string, milestoneId: string) => void;

  patchResource: (id: string, patch: Partial<Resource>) => void;
  patchInterview: (id: string, patch: Partial<InterviewDomain>) => void;
  patchStory: (id: string, patch: Partial<Story>) => void;

  startSession: (skillId: string) => void;
  completeSession: (id: string) => void;

  addReassessment: (r: Omit<Reassessment, 'id' | 'date'>) => void;

  setDimension: (id: string, level: DimensionLevel) => void;
  togglePlanItem: (key: string) => void;
  setApplication: (id: string, status: ApplicationStatus) => void;

  exportJson: () => string;
  importJson: (raw: string) => { ok: boolean; error?: string };
  reset: () => void;
}

export type LearningStore = LearningState & Actions;

export const useLearning = create<LearningStore>()(
  persist(
    (set, get) => ({
      ...seedState(),

      setCurrentSkill: (id) => set({ currentSkillId: id }),

      patchSkill: (id, patch) =>
        set((s) => ({ skills: s.skills.map((k) => (k.id === id ? { ...k, ...patch } : k)) })),

      recordCheck: (id, passed) => {
        if (!get().skills.some((k) => k.id === id)) return;
        set((s) => applyReview(s, { skillId: id, kind: 'check', predicted: null, outcome: passed ? 'pass' : 'fail', assisted: false }).state);
      },

      startRun: (skillId, kind) => {
        if (!get().skills.some((k) => k.id === skillId)) return;
        const now = Date.now();
        set({ activeRun: { skillId, kind, startedAt: now, predicted: null, phase: 0, phaseStartedAt: now } });
      },

      predictRun: (p) =>
        set((s) => {
          if (!s.activeRun) return {};
          const now = Date.now();
          // the clock starts when the prediction is made, not when the card was opened
          return { activeRun: { ...s.activeRun, predicted: p, startedAt: now, phaseStartedAt: now } };
        }),

      advanceRun: () =>
        set((s) => {
          const run = s.activeRun;
          const skill = run && s.skills.find((k) => k.id === run.skillId);
          if (!run || !skill) return {};
          const last = phasesFor(skill, run.kind).length;
          return { activeRun: { ...run, phase: Math.min(last, run.phase + 1), phaseStartedAt: Date.now() } };
        }),

      cancelRun: () => set({ activeRun: null }),

      finishRun: ({ outcome, assisted, note }) => {
        const s = get();
        const run = s.activeRun;
        if (!run || !s.skills.some((k) => k.id === run.skillId)) return null;
        const res = applyReview(s, {
          skillId: run.skillId,
          kind: run.kind,
          predicted: run.predicted,
          outcome,
          assisted,
          note: note.trim() || undefined,
          minutes: Math.max(1, Math.round((Date.now() - run.startedAt) / 60000)),
        });
        set({ ...res.state, activeRun: null });
        return { ...res.scheduled, review: res.review };
      },

      promote: (id) =>
        set((s) => ({
          skills: s.skills.map((k) => (k.id === id ? { ...k, state: nextState(k.state), stateChangedAt: today() } : k)),
        })),

      setPlan: (patch) => set((s) => ({ plan: { ...s.plan, ...patch } })),

      setTodayFocus: (items) => set({ todayFocus: items.slice(0, 3) }),

      addEvidence: (e) =>
        set((s) => {
          const entry: Evidence = { ...e, id: uid('ev') };
          // evidence touches the skills it names: practice date and confidence
          const skills = s.skills.map((k) => {
            if (!entry.skillIds.includes(k.id)) return k;
            const unaided = entry.assistance === 'none';
            return {
              ...k,
              lastPracticed: entry.date,
              confidence: Math.min(1, k.confidence + (unaided ? 0.12 : 0.04)),
              independent: unaided ? true : k.independent,
            };
          });
          return { evidence: [entry, ...s.evidence], skills };
        }),

      removeEvidence: (id) => set((s) => ({ evidence: s.evidence.filter((e) => e.id !== id) })),

      setProjectStage: (id, stage) =>
        set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, stage } : p)) })),

      toggleMilestone: (projectId, milestoneId) =>
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id !== projectId
              ? p
              : {
                  ...p,
                  milestones: p.milestones.map((m) =>
                    m.id !== milestoneId
                      ? m
                      : { ...m, done: !m.done, doneAt: !m.done ? today() : undefined },
                  ),
                },
          ),
        })),

      patchResource: (id, patch) =>
        set((s) => ({ resources: s.resources.map((r) => (r.id === id ? { ...r, ...patch } : r)) })),

      patchInterview: (id, patch) =>
        set((s) => ({ interview: s.interview.map((d) => (d.id === id ? { ...d, ...patch } : d)) })),

      patchStory: (id, patch) =>
        set((s) => ({ stories: s.stories.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),

      startSession: (skillId) =>
        set((s) => {
          const skill = s.skills.find((k) => k.id === skillId);
          if (!skill) return {};
          return { sessions: [buildSession(skill, uid('ses'), today()), ...s.sessions] };
        }),

      completeSession: (id) =>
        set((s) => ({
          sessions: s.sessions.map((x) => (x.id === id ? { ...x, completed: true } : x)),
        })),

      addReassessment: (r) =>
        set((s) => ({
          reassessments: [{ ...r, id: uid('ra'), date: today() }, ...s.reassessments],
          lastReassessedAt: today(),
        })),

      setDimension: (id, level) => set((s) => ({ benchmark: { ...s.benchmark, [id]: level } })),

      togglePlanItem: (key) => set((s) => ({ planDone: { ...s.planDone, [key]: !s.planDone[key] } })),

      setApplication: (id, status) => set((s) => ({ applications: { ...s.applications, [id]: status } })),

      exportJson: () => {
        const s = get();
        const data: LearningState = {
          version: s.version,
          target: s.target,
          skills: s.skills,
          evidence: s.evidence,
          projects: s.projects,
          resources: s.resources,
          interview: s.interview,
          stories: s.stories,
          sessions: s.sessions,
          reassessments: s.reassessments,
          roadmap: s.roadmap,
          currentSkillId: s.currentSkillId,
          todayFocus: s.todayFocus,
          lastReassessedAt: s.lastReassessedAt,
          benchmark: s.benchmark,
          planDone: s.planDone,
          applications: s.applications,
          reviews: s.reviews,
          activeRun: null,
          plan: s.plan,
        };
        return JSON.stringify(data, null, 2);
      },

      importJson: (raw) => {
        try {
          const parsed = JSON.parse(raw) as Partial<LearningState>;
          if (!Array.isArray(parsed.skills) || !parsed.target) {
            return { ok: false, error: 'Not a Learning OS export (missing skills/target).' };
          }
          const upgraded = migrateState(parsed, typeof parsed.version === 'number' ? parsed.version : 1);
          set({ ...seedState(), ...upgraded, activeRun: null, version: SCHEMA_VERSION });
          return { ok: true };
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : String(err) };
        }
      },

      reset: () => set({ ...seedState() }),
    }),
    {
      name: KEY,
      storage: createJSONStorage(() => localStorage),
      version: SCHEMA_VERSION,
      // Only persist data, never the action functions.
      partialize: (s) => ({
        version: s.version,
        target: s.target,
        skills: s.skills,
        evidence: s.evidence,
        projects: s.projects,
        resources: s.resources,
        interview: s.interview,
        stories: s.stories,
        sessions: s.sessions,
        reassessments: s.reassessments,
        roadmap: s.roadmap,
        currentSkillId: s.currentSkillId,
        todayFocus: s.todayFocus,
        lastReassessedAt: s.lastReassessedAt,
        benchmark: s.benchmark,
        planDone: s.planDone,
        applications: s.applications,
        reviews: s.reviews,
        activeRun: s.activeRun,
        plan: s.plan,
      }),
      migrate: (persisted, version) => migrateState(persisted as Partial<LearningState>, version) as LearningStore,
      /**
       * A stored export predates any skill added to the seed later. Union the
       * two by id so new seed skills appear instead of silently going missing.
       */
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<LearningState>;
        const seededIds = new Set((p.skills ?? []).map((s) => s.id));
        const skills = [
          ...(p.skills ?? []),
          ...current.skills.filter((s) => !seededIds.has(s.id)),
        ];
        return {
          ...current,
          ...p,
          skills,
          benchmark: p.benchmark ?? {},
          planDone: p.planDone ?? {},
          applications: p.applications ?? {},
          reviews: p.reviews ?? [],
          activeRun: p.activeRun ?? null,
          plan: { ...DEFAULT_PLAN, ...(p.plan ?? {}) },
        };
      },
    },
  ),
);

/**
 * Schema migrations, applied in order to persisted state (zustand's
 * `migrate`) and to imported exports. Without a `migrate`, zustand discards
 * persisted state on a version bump — that is the failure this prevents.
 *
 * v1 → v2 (role benchmark): adds `benchmark`, `planDone` and `applications`;
 * appends roadmap phases p4–p6 and the benchmark reading items by id; and
 * replaces the target only field by field where it still equals the v1 seed,
 * so an edited north star survives. New skills arrive through `merge`.
 *
 * v2 → v3 (daily loop): adds `reviews`, `activeRun` and `plan`. Skills keep
 * whatever `nextReview` they had; their `sched` starts when they are next
 * checked.
 */
export function migrateState(p: Partial<LearningState>, fromVersion: number): Partial<LearningState> {
  let out: Partial<LearningState> = { ...p };
  if (fromVersion < 2) {
    const seed = seedState();
    const roadmap = out.roadmap ?? seed.roadmap;
    const resources = out.resources ?? seed.resources;
    const has = (list: { id: string }[], id: string) => list.some((x) => x.id === id);
    const t = out.target;
    out = {
      ...out,
      benchmark: out.benchmark ?? {},
      planDone: out.planDone ?? {},
      applications: out.applications ?? {},
      roadmap: [...roadmap, ...BENCHMARK_PHASES.filter((ph) => !has(roadmap, ph.id))],
      resources: [...resources, ...BENCHMARK_RESOURCES.filter((r) => !has(resources, r.id))],
      target: t
        ? {
            ...t,
            northStar: t.northStar === V1_TARGET.northStar ? seed.target.northStar : t.northStar,
            notes: t.notes === V1_TARGET.notes ? seed.target.notes : t.notes,
            companies:
              t.companies?.join('|') === V1_TARGET.companies.join('|') ? seed.target.companies : t.companies,
          }
        : seed.target,
    };
  }
  if (fromVersion < 3) {
    out = {
      ...out,
      reviews: out.reviews ?? [],
      activeRun: null,
      plan: { ...DEFAULT_PLAN, ...(out.plan ?? {}) },
    };
  }
  return { ...out, version: SCHEMA_VERSION };
}

/**
 * The one place a recorded attempt changes a skill: its schedule, its next
 * review date, whether it counts as proven without AI, and the confidence the
 * priority model reads. An assisted pass is logged as practice and changes
 * none of the claims.
 */
function applyReview(
  s: LearningState,
  r: Omit<Review, 'id' | 'date' | 'intervalAfter'>,
): { state: Pick<LearningState, 'skills' | 'reviews'>; scheduled: Scheduled; review: Review } {
  const skill = s.skills.find((k) => k.id === r.skillId)!;
  const date = today();
  const scheduled = schedule(skill.sched, r, Math.random() * 2 - 1);
  const proof = !r.assisted;
  const passed = r.outcome !== 'fail';
  const review: Review = { ...r, id: uid('rv'), date, intervalAfter: scheduled.days };
  const skills = s.skills.map((k) => {
    if (k.id !== r.skillId) return k;
    return {
      ...k,
      sched: scheduled.sched,
      lastPracticed: date,
      nextReview: addDays(date, passed && r.assisted ? ASSISTED_RETRY_DAYS : scheduled.days),
      // only an unaided attempt says anything about independence
      independent: passed ? (proof ? true : k.independent) : false,
      confidence: !passed
        ? Math.max(0.05, k.confidence - 0.2)
        : proof
          ? Math.min(1, k.confidence + (r.outcome === 'hard' ? 0.08 : 0.15))
          : k.confidence,
    };
  });
  return { state: { skills, reviews: [review, ...s.reviews] }, scheduled, review };
}

/**
 * localStorage does not exist during the prerender, so zustand disables the
 * persist API entirely on the server and `useLearning.persist` is undefined
 * there — hence the optional chaining. Gate render on rehydration so the
 * client markup matches the server's "loading" pass.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const api = useLearning.persist;
    if (!api) {
      setHydrated(true); // no persistence available; seed state is what we have
      return;
    }
    if (api.hasHydrated()) setHydrated(true);
    return api.onFinishHydration(() => setHydrated(true));
  }, []);
  return hydrated;
}
