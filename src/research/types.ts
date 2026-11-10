/**
 * Research study system — data model.
 *
 * Papers and recall cards live in their own store. A paper read to Pass 1 or
 * further shows up as a cube on the Stacks board (src/stacks/model.ts), under
 * the subject its research question or keywords point to.
 */

import type { TrackId } from './tracks';

export type PaperSource = 'arxiv' | 'hf' | 'note' | 'manual';

/** A search result, normalised across arXiv, Hugging Face and imported notes. */
export interface PaperHit {
  /** 'arxiv:2606.02548' (version stripped) | 'note:<slug>' */
  id: string;
  arxivId?: string;
  doi?: string;
  title: string;
  authors: string[];
  abstract: string;
  /** ISO */
  published: string;
  categories: string[];
  primaryCategory?: string;
  absUrl: string;
  pdfUrl?: string;
  source: PaperSource;
  upvotes?: number;
  aiSummary?: string;
  venue?: string;
  /** from Semantic Scholar, filled in when the Connections panel loads */
  citationCount?: number;
}

/** Keshav's three passes, plus the two ways a paper leaves the queue. */
export type ReadStatus = 'inbox' | 'pass1' | 'pass2' | 'pass3' | 'done' | 'dropped';

export const STATUS_ORDER: ReadStatus[] = ['inbox', 'pass1', 'pass2', 'pass3', 'done', 'dropped'];

export const STATUS_LABEL: Record<ReadStatus, string> = {
  inbox: 'Inbox',
  pass1: 'Pass 1 · skim 5–10 min',
  pass2: 'Pass 2 · read ≤1 h',
  pass3: 'Pass 3 · re-derive',
  done: 'Done',
  dropped: 'Dropped',
};

export const STATUS_SHORT: Record<ReadStatus, string> = {
  inbox: 'inbox',
  pass1: 'pass 1',
  pass2: 'pass 2',
  pass3: 'pass 3',
  done: 'done',
  dropped: 'dropped',
};

export interface FiveCs {
  category: string;
  context: string;
  correctness: string;
  contributions: string;
  clarity: string;
}

export interface PaperNote {
  fiveCs: FiveCs;
  problem: string;
  method: string;
  results: string;
  limitations: string;
  /** my critique */
  critique: string;
  /** what is left for my work after this paper */
  delta: string;
  /** imported markdown body lives here */
  freeform: string;
}

export interface Paper extends PaperHit {
  savedAt: string;
  status: ReadStatus;
  statusChangedAt: string;
  tags: string[];
  rqIds: string[];
  note: PaperNote;
  bibKey: string;
  evidenceLoggedAt?: string;
  contentSlug?: string;
  /** values of his custom literature-matrix columns, by column name */
  extra?: Record<string, string>;
}

export interface ResearchQuestion {
  id: string;
  short: string;
  question: string;
  keywords: string[];
  /** which track the question belongs to; absent = core */
  track?: TrackId;
}

export interface Topic {
  id: string;
  label: string;
  rqId?: string;
  /** which track's feed the topic appears in; absent = core */
  track?: TrackId;
  arxivQuery: string;
  keywords: string[];
  builtin?: boolean;
}

export type Grade = 'again' | 'hard' | 'good' | 'easy';

export interface Card {
  id: string;
  paperId: string;
  prompt: string;
  answer: string;
  elaboration?: string;
  rqIds: string[];
  origin: 'me' | 'llm' | 'offline';
  createdAt: string;
  /** YYYY-MM-DD */
  due: string;
  step: number;
  reps: number;
  lapses: number;
  lastReviewed?: string;
  suspended?: boolean;
}

export interface ReviewLog {
  cardId: string;
  date: string;
  grade: Grade;
  typedRecall: boolean;
}

/**
 * A sentence he pasted from the paper while reading. The PDF iframe cannot
 * share its selection with the page, so highlights are typed or pasted.
 */
export interface Highlight {
  id: string;
  paperId: string;
  text: string;
  /** "p. 4", "§3.2", "Table 2" — free text */
  where?: string;
  why?: string;
  createdAt: string;
  /** the recall card made from it, if any */
  cardId?: string;
}

/** Read mode layout, remembered per paper. 'off' is the normal detail view. */
export type ReadMode = 'off' | 'split' | 'reader' | 'notes';

export type Pass = 'pass1' | 'pass2' | 'pass3';

export interface StudyPrefs {
  /** minutes per pass (Keshav: 5–10 min, ≤1 h, 4–5 h for a beginner) */
  budgets: Record<Pass, number>;
  weekly: { papers: number; cards: number };
  readMode: Record<string, ReadMode>;
  /** reader pane width in split mode, percent of the detail width */
  splitPct: number;
  /** custom literature-matrix columns ("dataset", "baseline", …) */
  matrixCols: string[];
}

/** Explicit feedback on a feed item: +1 more like this, -1 not relevant (hidden). */
export type Rating = 1 | -1;

export interface ResearchState {
  version: 1;
  papers: Paper[];
  cards: Card[];
  /** capped at 1000 */
  log: ReviewLog[];
  highlights: Highlight[];
  prefs: StudyPrefs;
  /** feed ratings by paper id; the rated papers' keywords nudge ranking */
  ratings: Record<string, { r: Rating; keywords: string[] }>;
  /** YYYY-MM-DD days with any study activity (status change, note, card, review); capped */
  activeDays: string[];
  rqs: ResearchQuestion[];
  topics: Topic[];
  /** topicId → newest `published` seen */
  topicSeenAt: Record<string, string>;
  seededFromContent: boolean;
}

/** Shape of /api/research/papers. */
export interface PapersResponse {
  items: PaperHit[];
  total?: number;
  source: string;
  fetchedAt: string;
  cached: boolean;
  error?: string;
}

export interface GraphRef {
  title: string;
  year?: number;
  arxivId?: string;
  doi?: string;
  citationCount?: number;
  s2Url: string;
}

/** Shape of /api/research/graph. */
export interface GraphResponse {
  available: boolean;
  reason?: 'rate-limited' | 'not-found' | 'unreachable' | 'no-key';
  paper?: {
    title: string;
    year?: number;
    venue?: string;
    citationCount?: number;
    referenceCount?: number;
    tldr?: string;
    s2Url: string;
  };
  references: GraphRef[];
  citations: GraphRef[];
}

/** Shape of /api/research/related (Semantic Scholar recommendations). */
export interface RelatedResponse {
  available: boolean;
  reason?: 'rate-limited' | 'not-found' | 'unreachable';
  items: (GraphRef & { venue?: string })[];
}

/** Shape of /api/research/pdf?check=1. */
export interface PdfCheck {
  ok: boolean;
  format: 'pdf' | 'html';
  status?: number;
  bytes?: number;
  error?: string;
}
