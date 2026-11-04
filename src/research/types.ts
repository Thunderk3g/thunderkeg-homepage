/**
 * Research study system — data model.
 *
 * Papers and recall cards are a different object type from the Learning OS's
 * skills, so they live in their own store. Study *output* (structured notes,
 * cards) is fed back into the Learning OS as evidence rather than duplicated.
 */

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
}

export interface ResearchQuestion {
  id: string;
  short: string;
  question: string;
  keywords: string[];
}

export interface Topic {
  id: string;
  label: string;
  rqId?: string;
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

export interface ResearchState {
  version: 1;
  papers: Paper[];
  cards: Card[];
  /** capped at 1000 */
  log: ReviewLog[];
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
  recommendations: GraphRef[];
}
