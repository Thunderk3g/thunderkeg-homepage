'use client';

import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { SCHEMA_VERSION, seedState } from './seed';
import { buildSession, nextReviewDate } from './priority';
import type {
  Evidence,
  InterviewDomain,
  LearningState,
  ProjectStage,
  Reassessment,
  Resource,
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
  /** record an AI-free check attempt; reschedules the next retrieval */
  recordCheck: (id: string, passed: boolean) => void;
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

      recordCheck: (id, passed) =>
        set((s) => ({
          skills: s.skills.map((k) => {
            if (k.id !== id) return k;
            return {
              ...k,
              // passing the AI-free check is the only thing that sets independence
              independent: passed ? true : false,
              lastPracticed: today(),
              nextReview: nextReviewDate(k, passed),
              confidence: passed ? Math.min(1, k.confidence + 0.15) : Math.max(0.05, k.confidence - 0.2),
            };
          }),
        })),

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
        };
        return JSON.stringify(data, null, 2);
      },

      importJson: (raw) => {
        try {
          const parsed = JSON.parse(raw) as Partial<LearningState>;
          if (!Array.isArray(parsed.skills) || !parsed.target) {
            return { ok: false, error: 'Not a Learning OS export (missing skills/target).' };
          }
          set({ ...seedState(), ...parsed, version: SCHEMA_VERSION });
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
      }),
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
        return { ...current, ...p, skills };
      },
    },
  ),
);

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
