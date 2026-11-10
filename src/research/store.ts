'use client';

import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Entry } from '@/content/writing';
import { DEFAULT_PREFS, SCHEMA_VERSION, seedState } from './seed';
import { isoDay, nextDue } from './schedule';
import { bibKey } from './bibtex';
import { relevance } from './rank';
import type {
  Card,
  FiveCs,
  Grade,
  Highlight,
  Paper,
  PaperHit,
  PaperNote,
  Rating,
  ReadMode,
  ReadStatus,
  ResearchState,
  StudyPrefs,
  Topic,
} from './types';

/**
 * Persistence — same local-first pattern as the Learning OS (src/learning/store.ts):
 * zustand persist over localStorage, data only, export/import for portability.
 *
 * Only saved papers, cards and the review log are stored. Feed results, HF
 * payloads and Semantic Scholar graphs are never persisted: at ~1.5 KB a paper,
 * a thousand saved papers is ~1.5 MB, comfortably inside the quota.
 */

const KEY = 'kos:research';
const LOG_CAP = 1000;
const DAYS_CAP = 400;

const now = () => new Date().toISOString();
const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 9)}`;

export const emptyNote = (): PaperNote => ({
  fiveCs: { category: '', context: '', correctness: '', contributions: '', clarity: '' },
  problem: '',
  method: '',
  results: '',
  limitations: '',
  critique: '',
  delta: '',
  freeform: '',
});

export type NotePatch = Partial<Omit<PaperNote, 'fiveCs'>> & { fiveCs?: Partial<FiveCs> };
export type NewCard = Pick<Card, 'paperId' | 'prompt' | 'answer' | 'origin'> & Partial<Pick<Card, 'elaboration' | 'rqIds'>>;
export type NewHighlight = Pick<Highlight, 'paperId' | 'text'> & Partial<Pick<Highlight, 'where' | 'why'>>;

/** Mark today as a study day (for the streak strip). */
const touched = (days: string[], day = isoDay()): string[] =>
  days.includes(day) ? days : [...days, day].sort().slice(-DAYS_CAP);

interface Actions {
  /** idempotent by id; returns the paper id */
  savePaper: (hit: PaperHit, extra?: { rqIds?: string[]; tags?: string[] }) => string;
  removePaper: (id: string) => void;
  setStatus: (id: string, status: ReadStatus) => void;
  patchNote: (id: string, patch: NotePatch) => void;
  setTags: (id: string, tags: string[]) => void;
  toggleRq: (id: string, rqId: string) => void;
  /** metadata only (citation count, venue…); notes go through patchNote */
  patchPaper: (id: string, patch: Partial<Pick<Paper, 'citationCount' | 'venue' | 'doi'>>) => void;

  addHighlight: (h: NewHighlight) => string;
  patchHighlight: (id: string, patch: Partial<Omit<Highlight, 'id' | 'paperId'>>) => void;
  deleteHighlight: (id: string) => void;

  setReadMode: (paperId: string, mode: ReadMode) => void;
  /** null clears the rating */
  rate: (paperId: string, r: Rating | null, keywords?: string[]) => void;
  addMatrixCol: (name: string) => void;
  removeMatrixCol: (name: string) => void;
  setExtra: (paperId: string, col: string, value: string) => void;
  setPrefs: (patch: Partial<Omit<StudyPrefs, 'readMode'>>) => void;

  addCard: (c: NewCard) => string;
  patchCard: (id: string, patch: Partial<Card>) => void;
  deleteCard: (id: string) => void;
  /** grade a card; schedule.ts decides the next date */
  review: (cardId: string, grade: Grade, typedRecall: boolean) => void;

  addTopic: (t: Omit<Topic, 'id' | 'builtin'>) => string;
  patchTopic: (id: string, patch: Partial<Omit<Topic, 'id' | 'builtin'>>) => void;
  /** built-in topics can be edited but not removed */
  removeTopic: (id: string) => void;
  markTopicSeen: (topicId: string, iso: string) => void;

  markEvidenceLogged: (id: string) => void;
  importContentNotes: (entries: Entry[]) => void;

  exportJson: () => string;
  importJson: (raw: string) => { ok: boolean; error?: string };
  reset: () => void;
}

export type ResearchStore = ResearchState & Actions;

const dataOf = (s: ResearchState): ResearchState => ({
  version: s.version,
  papers: s.papers,
  cards: s.cards,
  log: s.log,
  highlights: s.highlights,
  prefs: s.prefs,
  activeDays: s.activeDays,
  ratings: s.ratings,
  rqs: s.rqs,
  topics: s.topics,
  topicSeenAt: s.topicSeenAt,
  seededFromContent: s.seededFromContent,
});

const ARXIV_ABS = /arxiv\.org\/abs\/(\d{4}\.\d{4,5})/;

/** A published content/*.md paper note → a library entry. */
function paperFromEntry(e: Entry, s: ResearchState, taken: Set<string>): Paper {
  const arxivId = e.link ? ARXIV_ABS.exec(e.link)?.[1] : undefined;
  const status: ReadStatus =
    e.status === 'reading' ? 'pass2' : /^(read|refer)/.test(e.status ?? '') ? 'done' : 'inbox';
  const authors = (e.authors ?? '').split(/,|\band\b/).map((a) => a.trim()).filter(Boolean);
  const hit: PaperHit = {
    id: arxivId ? `arxiv:${arxivId}` : `note:${e.slug}`,
    arxivId,
    title: e.title,
    authors,
    abstract: e.summary,
    published: e.date,
    categories: [],
    absUrl: arxivId ? `https://arxiv.org/abs/${arxivId}` : e.link ?? `/writing/${e.slug}`,
    pdfUrl: arxivId ? `https://arxiv.org/pdf/${arxivId}` : undefined,
    source: 'note',
    venue: e.venue,
  };
  // link the research questions the note plainly bears on
  const text = { title: `${e.title} ${e.tags.join(' ')}`, abstract: `${e.summary} ${e.body.slice(0, 3000)}` };
  const rqIds = s.rqs.filter((q) => relevance(text, q.keywords).matched.length >= 2).map((q) => q.id);
  const key = bibKey(hit, taken);
  taken.add(key);
  return {
    ...hit,
    savedAt: now(),
    status,
    // the note's own date, so a seeded "read" paper does not count as finished this week
    statusChangedAt: /^\d{4}-\d{2}-\d{2}/.test(e.date) ? new Date(`${e.date.slice(0, 10)}T12:00:00Z`).toISOString() : now(),
    tags: e.tags,
    rqIds,
    note: { ...emptyNote(), freeform: e.body },
    bibKey: key,
    contentSlug: e.slug,
  };
}

// Declared before the store: persist rehydrates from localStorage synchronously
// while create() runs, so anything merge or onRehydrateStorage touches must
// already be initialised.
/** Labels a built-in topic used to have, so a stored copy can be told apart from a user's own edit. */
const RETIRED_LABELS: Record<string, string> = { 'd-cyber': 'LLMs for cyber operations' };

/**
 * Like unionById, but a built-in topic always follows the seed's track (topics
 * move between tracks as tracks are added), and one still carrying a retired
 * label takes the seed's current label and query too. Edits the user made to a
 * built-in's query or keywords otherwise survive.
 */
function mergeTopics(stored: Topic[], seed: Topic[]): Topic[] {
  const bySeed = new Map(seed.map((t) => [t.id, t]));
  const synced = stored.map((t) => {
    const s = bySeed.get(t.id);
    if (!s || !t.builtin) return t;
    if (RETIRED_LABELS[t.id] === t.label) return { ...t, label: s.label, arxivQuery: s.arxivQuery, keywords: [...s.keywords], rqId: s.rqId, track: s.track };
    return { ...t, track: s.track };
  });
  return unionById(synced, seed);
}

let rehydrateFailed = false;
const failListeners = new Set<() => void>();

export const useResearch = create<ResearchStore>()(
  persist(
    (set, get) => ({
      ...seedState(),

      savePaper: (hit, extra) => {
        const existing = get().papers.find((p) => p.id === hit.id);
        if (existing) return existing.id;
        set((s) => {
          const paper: Paper = {
            ...hit,
            savedAt: now(),
            status: 'inbox',
            statusChangedAt: now(),
            tags: extra?.tags ?? [],
            rqIds: extra?.rqIds ?? [],
            note: emptyNote(),
            bibKey: bibKey(hit, s.papers.map((p) => p.bibKey)),
          };
          return { papers: [paper, ...s.papers] };
        });
        return hit.id;
      },

      removePaper: (id) =>
        set((s) => {
          const gone = new Set(s.cards.filter((c) => c.paperId === id).map((c) => c.id));
          const { [id]: _drop, ...readMode } = s.prefs.readMode;
          return {
            papers: s.papers.filter((p) => p.id !== id),
            cards: s.cards.filter((c) => !gone.has(c.id)),
            log: s.log.filter((l) => !gone.has(l.cardId)),
            highlights: s.highlights.filter((h) => h.paperId !== id),
            prefs: { ...s.prefs, readMode },
          };
        }),

      setStatus: (id, status) =>
        set((s) => ({
          papers: s.papers.map((p) =>
            p.id === id && p.status !== status ? { ...p, status, statusChangedAt: now() } : p,
          ),
          activeDays: touched(s.activeDays),
        })),

      patchNote: (id, patch) =>
        set((s) => ({
          papers: s.papers.map((p) =>
            p.id !== id
              ? p
              : { ...p, note: { ...p.note, ...patch, fiveCs: { ...p.note.fiveCs, ...(patch.fiveCs ?? {}) } } },
          ),
          activeDays: touched(s.activeDays),
        })),

      patchPaper: (id, patch) =>
        set((s) => ({ papers: s.papers.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),

      addHighlight: (h) => {
        const id = uid('hl');
        const hl: Highlight = {
          id,
          paperId: h.paperId,
          text: h.text.trim(),
          where: h.where?.trim() || undefined,
          why: h.why?.trim() || undefined,
          createdAt: now(),
        };
        set((s) => ({ highlights: [...s.highlights, hl], activeDays: touched(s.activeDays) }));
        return id;
      },

      patchHighlight: (id, patch) =>
        set((s) => ({ highlights: s.highlights.map((h) => (h.id === id ? { ...h, ...patch, id: h.id } : h)) })),

      deleteHighlight: (id) => set((s) => ({ highlights: s.highlights.filter((h) => h.id !== id) })),

      setReadMode: (paperId, mode) =>
        set((s) => {
          if ((s.prefs.readMode[paperId] ?? 'off') === mode) return {};
          return { prefs: { ...s.prefs, readMode: { ...s.prefs.readMode, [paperId]: mode } } };
        }),

      rate: (paperId, r, keywords = []) =>
        set((s) => {
          const { [paperId]: _old, ...rest } = s.ratings;
          return { ratings: r === null ? rest : { ...rest, [paperId]: { r, keywords: keywords.slice(0, 20) } } };
        }),

      addMatrixCol: (name) =>
        set((s) => {
          const n = name.trim().slice(0, 40);
          if (!n || s.prefs.matrixCols.some((c) => c.toLowerCase() === n.toLowerCase())) return {};
          return { prefs: { ...s.prefs, matrixCols: [...s.prefs.matrixCols, n] } };
        }),

      removeMatrixCol: (name) =>
        set((s) => ({ prefs: { ...s.prefs, matrixCols: s.prefs.matrixCols.filter((c) => c !== name) } })),

      setExtra: (paperId, col, value) =>
        set((s) => ({
          papers: s.papers.map((p) => (p.id === paperId ? { ...p, extra: { ...(p.extra ?? {}), [col]: value } } : p)),
        })),

      setPrefs: (patch) =>
        set((s) => ({
          prefs: {
            ...s.prefs,
            ...patch,
            budgets: { ...s.prefs.budgets, ...(patch.budgets ?? {}) },
            weekly: { ...s.prefs.weekly, ...(patch.weekly ?? {}) },
          },
        })),

      setTags: (id, tags) =>
        set((s) => ({ papers: s.papers.map((p) => (p.id === id ? { ...p, tags } : p)) })),

      toggleRq: (id, rqId) =>
        set((s) => ({
          papers: s.papers.map((p) =>
            p.id !== id
              ? p
              : { ...p, rqIds: p.rqIds.includes(rqId) ? p.rqIds.filter((r) => r !== rqId) : [...p.rqIds, rqId] },
          ),
        })),

      addCard: (c) => {
        const id = uid('card');
        const paper = get().papers.find((p) => p.id === c.paperId);
        const card: Card = {
          id,
          paperId: c.paperId,
          prompt: c.prompt.trim(),
          answer: c.answer.trim(),
          elaboration: c.elaboration?.trim() || undefined,
          rqIds: c.rqIds ?? paper?.rqIds ?? [],
          origin: c.origin,
          createdAt: now(),
          // a new card is reviewed the same day it is written
          due: isoDay(),
          step: 0,
          reps: 0,
          lapses: 0,
        };
        set((s) => ({ cards: [...s.cards, card], activeDays: touched(s.activeDays) }));
        return id;
      },

      patchCard: (id, patch) =>
        set((s) => ({ cards: s.cards.map((c) => (c.id === id ? { ...c, ...patch, id: c.id } : c)) })),

      deleteCard: (id) =>
        set((s) => ({
          cards: s.cards.filter((c) => c.id !== id),
          highlights: s.highlights.map((h) => (h.cardId === id ? { ...h, cardId: undefined } : h)),
        })),

      review: (cardId, grade, typedRecall) =>
        set((s) => {
          const card = s.cards.find((c) => c.id === cardId);
          if (!card) return {};
          const next = nextDue(card, grade, new Date());
          return {
            cards: s.cards.map((c) => (c.id === cardId ? { ...c, ...next } : c)),
            log: [...s.log, { cardId, date: now(), grade, typedRecall }].slice(-LOG_CAP),
            activeDays: touched(s.activeDays),
          };
        }),

      addTopic: (t) => {
        const id = uid('t');
        set((s) => ({ topics: [...s.topics, { ...t, id }] }));
        return id;
      },

      patchTopic: (id, patch) =>
        set((s) => ({ topics: s.topics.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),

      removeTopic: (id) =>
        set((s) => ({ topics: s.topics.filter((t) => t.id !== id || t.builtin) })),

      markTopicSeen: (topicId, iso) =>
        set((s) =>
          (s.topicSeenAt[topicId] ?? '') >= iso ? {} : { topicSeenAt: { ...s.topicSeenAt, [topicId]: iso } },
        ),

      markEvidenceLogged: (id) =>
        set((s) => ({ papers: s.papers.map((p) => (p.id === id ? { ...p, evidenceLoggedAt: now() } : p)) })),

      importContentNotes: (entries) =>
        set((s) => {
          const have = new Set(s.papers.map((p) => p.id));
          const taken = new Set(s.papers.map((p) => p.bibKey));
          const fresh = entries
            .filter((e) => e.kind === 'paper')
            .map((e) => paperFromEntry(e, s, taken))
            .filter((p) => !have.has(p.id));
          return { papers: [...s.papers, ...fresh], seededFromContent: true };
        }),

      exportJson: () => JSON.stringify(dataOf(get()), null, 2),

      importJson: (raw) => {
        try {
          const parsed = JSON.parse(raw) as Partial<ResearchState>;
          if (!Array.isArray(parsed.papers) || !Array.isArray(parsed.cards)) {
            return { ok: false, error: 'Not a Research export (missing papers/cards).' };
          }
          const seed = seedState();
          set({
            ...seed,
            ...parsed,
            highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
            activeDays: Array.isArray(parsed.activeDays) ? parsed.activeDays : [],
            ratings: parsed.ratings ?? {},
            prefs: mergePrefs(parsed.prefs),
            rqs: unionById(parsed.rqs ?? [], seed.rqs),
            topics: mergeTopics(parsed.topics ?? [], seed.topics),
            version: SCHEMA_VERSION,
          });
          return { ok: true };
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : String(err) };
        }
      },

      reset: () => {
        seeding = null;
        set({ ...seedState() });
      },
    }),
    {
      name: KEY,
      storage: createJSONStorage(() => localStorage),
      version: SCHEMA_VERSION,
      // Only persist data, never the action functions.
      partialize: (s) => dataOf(s),
      // zustand never reports a failed rehydration as finished; say why, and let the UI start from the seed
      onRehydrateStorage: () => (_state, error) => {
        if (!error) return;
        console.error('[research] could not restore saved state; starting fresh for this session', error);
        rehydrateFailed = true;
        failListeners.forEach((f) => f());
      },
      /**
       * Union seed topics and RQs by id, so a built-in topic added later shows
       * up for someone whose stored state predates it.
       */
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<ResearchState>;
        return {
          ...current,
          ...p,
          // fields added after the first release default for older stored state
          highlights: p.highlights ?? [],
          activeDays: p.activeDays ?? [],
          ratings: p.ratings ?? {},
          prefs: mergePrefs(p.prefs),
          rqs: unionById(p.rqs ?? [], current.rqs),
          topics: mergeTopics(p.topics ?? [], current.topics),
        };
      },
    },
  ),
);

function mergePrefs(p: Partial<StudyPrefs> | undefined): StudyPrefs {
  return {
    ...DEFAULT_PREFS,
    ...(p ?? {}),
    budgets: { ...DEFAULT_PREFS.budgets, ...(p?.budgets ?? {}) },
    weekly: { ...DEFAULT_PREFS.weekly, ...(p?.weekly ?? {}) },
    readMode: { ...(p?.readMode ?? {}) },
    matrixCols: [...(p?.matrixCols ?? [])],
  };
}

function unionById<T extends { id: string }>(stored: T[], seed: T[]): T[] {
  const ids = new Set(stored.map((x) => x.id));
  return [...stored, ...seed.filter((x) => !ids.has(x.id))];
}


/**
 * First run: his published paper notes (content/*.md, kind: paper) become
 * library entries, so the library is never empty on day one. Runs once; the
 * flag is persisted.
 */
let seeding: Promise<void> | null = null;
export function ensureSeeded(): Promise<void> {
  if (useResearch.getState().seededFromContent) return Promise.resolve();
  seeding ??= fetch('/api/content')
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then((d: { entries: Entry[] }) => useResearch.getState().importContentNotes(d.entries ?? []))
    .catch(() => {
      seeding = null; // try again next time; the library still works without it
    });
  return seeding;
}

/**
 * Same as the Learning OS's useHydrated(): gate render on rehydration so the
 * client markup matches the server's "loading" pass. Also kicks off the
 * one-time import of published paper notes.
 */
export function useResearchHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const done = () => {
      setHydrated(true);
      void ensureSeeded();
    };
    const api = useResearch.persist;
    if (!api || rehydrateFailed) {
      done();
      return;
    }
    if (api.hasHydrated()) done();
    failListeners.add(done);
    const off = api.onFinishHydration(done);
    return () => {
      failListeners.delete(done);
      off();
    };
  }, []);
  return hydrated;
}

/* ───────────────────────── derived ───────────────────────── */

/** mulberry32 — a seeded shuffle so the day's order is stable across re-renders. */
function rng(seed: string) {
  let a = [...seed].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 2654435761) >>> 0, 1779033703);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Cards due today, shuffled with today's date as the seed. Interleaving
 * papers is deliberate: blocked review by paper inflates recall.
 */
export function dueCards(state: Pick<ResearchState, 'cards'>, today = isoDay()): Card[] {
  const due = state.cards.filter((c) => !c.suspended && c.due <= today);
  const rand = rng(today);
  for (let i = due.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [due[i], due[j]] = [due[j], due[i]];
  }
  return due;
}

export function counts(state: Pick<ResearchState, 'papers' | 'cards'>, today = isoDay()) {
  const by = (st: ReadStatus[]) => state.papers.filter((p) => st.includes(p.status)).length;
  return {
    papers: state.papers.length,
    inbox: by(['inbox']),
    reading: by(['pass1', 'pass2', 'pass3']),
    done: by(['done']),
    cards: state.cards.length,
    due: state.cards.filter((c) => !c.suspended && c.due <= today).length,
  };
}
