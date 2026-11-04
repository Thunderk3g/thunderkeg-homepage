import type { ResearchQuestion, ResearchState, StudyPrefs, Topic } from './types';

export const SCHEMA_VERSION = 1;

/**
 * The five questions from content/why-a-research-masters.md. Keywords are
 * lowercase substrings (stems, both spellings) used by rank.ts and by the
 * offline first pass to say which question a paper bears on.
 */
export const RQS: ResearchQuestion[] = [
  {
    id: 'rq1',
    short: 'RQ1 constraint placement',
    question: 'Where should a hard categorical constraint live in a retrieval system?',
    keywords: ['metadata filter', 'hard constraint', 'filtered', 'constrained retrieval', 'applicab', 'pre-filter', 'post-filter', 'scope'],
  },
  {
    id: 'rq2',
    short: 'RQ2 coverage vs constraint',
    question: 'Coverage is not constraint — how general is low constraint density in formalised rule bases?',
    keywords: ['legalruleml', 'deontic', 'rule base', 'formalis', 'formaliz', 'compliance', 'gdpr', 'regulat', 'obligation'],
  },
  {
    id: 'rq3',
    short: 'RQ3 consensus pseudo-labels',
    question: 'When does consensus pseudo-labelling fail, and why?',
    keywords: ['pseudo-label', 'pseudo label', 'consensus', 'self-training', 'agreement', 'data selection', 'filtering', 'rover'],
  },
  {
    id: 'rq4',
    short: 'RQ4 romanized CS evaluation',
    question: 'What is the right evaluation instrument for romanized code-switched speech?',
    keywords: ['wer', 'word error rate', 'code-switch', 'romani', 'transliterat', 'normalis', 'normaliz', 'script', 'indic', 'hinglish'],
  },
  {
    id: 'rq5',
    short: 'RQ5 identifier stability',
    question: 'Identifier stability in LLM-built knowledge bases.',
    keywords: ['dedup', 'identifier', 'hash', 'entity resolution', 'idempotent', 'cache', 'determinis', 'knowledge graph construction'],
  },
];

/** Built-in arXiv topics. Each query was checked live against the API. */
export const TOPICS: Topic[] = [
  {
    id: 't-constraints',
    label: 'Constrained retrieval',
    rqId: 'rq1',
    arxivQuery:
      '(abs:"metadata filter" OR abs:"hard constraint" OR abs:"filtered vector search" OR abs:"constrained retrieval") AND (cat:cs.IR OR cat:cs.CL OR cat:cs.DB)',
    keywords: ['metadata', 'filter', 'constraint', 'applicab', 'hybrid', 'vector search', 'predicate', 'retrieval'],
    builtin: true,
  },
  {
    id: 't-legal',
    label: 'Legal rule bases',
    rqId: 'rq2',
    arxivQuery:
      '(abs:"LegalRuleML" OR abs:"deontic logic" OR abs:"legal knowledge" OR abs:"regulatory compliance") AND (cat:cs.AI OR cat:cs.CL OR cat:cs.LO OR cat:cs.CY)',
    keywords: ['legalruleml', 'deontic', 'rule', 'formalis', 'formaliz', 'compliance', 'gdpr', 'obligation', 'regulat'],
    builtin: true,
  },
  {
    id: 't-pseudo',
    label: 'Pseudo-labelling (speech)',
    rqId: 'rq3',
    arxivQuery: '(abs:"pseudo-label" OR abs:"pseudo-labeling" OR abs:"pseudo-labelling") AND (cat:eess.AS OR cat:cs.SD)',
    keywords: ['pseudo-label', 'consensus', 'agreement', 'filter', 'confidence', 'self-training', 'asr', 'data selection'],
    builtin: true,
  },
  {
    id: 't-asr-eval',
    label: 'ASR evaluation',
    rqId: 'rq4',
    arxivQuery: '(abs:"word error rate" OR abs:WER) AND (abs:metric OR abs:evaluation) AND (cat:eess.AS OR cat:cs.CL)',
    keywords: ['wer', 'word error rate', 'metric', 'normalis', 'normaliz', 'transliterat', 'code-switch', 'romani', 'entity'],
    builtin: true,
  },
  {
    id: 't-codeswitch',
    label: 'Code-switching ASR',
    rqId: 'rq4',
    arxivQuery: '(abs:"code-switching" OR abs:"code-switched") AND (abs:"speech recognition" OR abs:ASR)',
    keywords: ['code-switch', 'hindi', 'hinglish', 'indic', 'romani', 'script', 'transliterat', 'bilingual'],
    builtin: true,
  },
  {
    id: 't-grounding',
    label: 'RAG grounding',
    arxivQuery:
      '(ti:"retrieval-augmented" OR ti:RAG) AND (abs:grounding OR abs:faithfulness OR abs:citation) AND (cat:cs.CL OR cat:cs.IR)',
    keywords: ['grounding', 'faithful', 'citation', 'attribution', 'hallucinat', 'evidence', 'entity'],
    builtin: true,
  },
  {
    id: 't-quant',
    label: 'Quantization on-device',
    arxivQuery:
      '(abs:quantization OR abs:"low-bit") AND (abs:"large language model" OR abs:LLM) AND (abs:edge OR abs:"on-device" OR abs:"consumer GPU")',
    keywords: ['quantiz', 'low-bit', '4-bit', 'int4', 'int8', 'on-device', 'edge', 'memory', 'latency'],
    builtin: true,
  },
  {
    id: 't-kb-identity',
    label: 'KB identity / dedup',
    rqId: 'rq5',
    arxivQuery:
      '(abs:"entity resolution" OR abs:deduplication OR abs:"knowledge graph construction") AND (abs:"large language model" OR abs:LLM) AND (cat:cs.CL OR cat:cs.DB OR cat:cs.IR)',
    // the query is noisy (200+ results); ranking does the real filtering
    keywords: ['dedup', 'identifier', 'hash', 'entity resolution', 'idempotent', 'cache', 'determinis'],
    builtin: true,
  },
];

export const DEFAULT_PREFS: StudyPrefs = {
  budgets: { pass1: 10, pass2: 60, pass3: 180 },
  weekly: { papers: 2, cards: 40 },
  readMode: {},
  splitPct: 58,
  matrixCols: [],
};

export function seedState(): ResearchState {
  return {
    version: SCHEMA_VERSION,
    papers: [],
    cards: [],
    log: [],
    highlights: [],
    prefs: { ...DEFAULT_PREFS, budgets: { ...DEFAULT_PREFS.budgets }, weekly: { ...DEFAULT_PREFS.weekly }, readMode: {}, matrixCols: [] },
    ratings: {},
    activeDays: [],
    rqs: RQS.map((q) => ({ ...q, keywords: [...q.keywords] })),
    topics: TOPICS.map((t) => ({ ...t, keywords: [...t.keywords] })),
    topicSeenAt: {},
    seededFromContent: false,
  };
}
