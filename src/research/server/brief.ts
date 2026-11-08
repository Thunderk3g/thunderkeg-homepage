/**
 * The weekly brief for one track — server side.
 *
 * Scans every built-in topic of the track on arXiv (plus Hugging Face Daily
 * for AI/ML), scores each paper against the topic's keywords and the track's
 * research questions, weights by recency, and keeps a diverse shortlist. The
 * track's news wire comes along so the client can summarise both at once.
 *
 * Topic searches share cache keys with /api/research/papers, so a brief warms
 * the Papers tab and vice versa.
 */

import type { PaperHit } from '../types';
import { RQS, TOPICS } from '../seed';
import { relevance } from '../rank';
import type { TrackId } from '../tracks';
import { cached } from './cache';
import { arxivSearch } from './arxiv';
import { hfDaily } from './hf';
import { cachedNews, type NewsItem } from '@/os/ai/news';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const PICKS = 8;
const PER_TOPIC = 2;
/** below this a paper only matched in passing; better a short list than a padded one */
const MIN_SCORE = 4;
/** stop starting new arXiv queries after this, so the route answers inside its time limit */
const BUDGET_MS = 40_000;

export interface BriefPick {
  hit: PaperHit;
  topicId: string;
  topicLabel: string;
  rqId?: string;
  rqShort?: string;
  matched: string[];
  score: number;
  ageDays: number;
}

export interface BriefResponse {
  track: TrackId;
  picks: BriefPick[];
  news: NewsItem[];
  /** topic labels that answered */
  scanned: string[];
  /** topic labels that failed or were skipped for time */
  missed: string[];
  /** how many candidate papers were weighed */
  considered: number;
  fetchedAt: string;
}

/** Recent work first, but a strong older match can still make the list. */
function recency(ageDays: number): number {
  if (ageDays <= 7) return 1;
  if (ageDays <= 14) return 0.75;
  if (ageDays <= 30) return 0.45;
  return 0.2;
}

interface Source {
  id: string;
  label: string;
  keywords: string[];
  rqId?: string;
  load: () => Promise<PaperHit[]>;
}

export async function buildBrief(track: TrackId): Promise<BriefResponse> {
  const started = Date.now();
  const rqs = RQS.filter((q) => (q.track ?? 'core') === track);
  const sources: Source[] = TOPICS.filter((t) => (t.track ?? 'core') === track).map((t) => ({
    id: t.id,
    label: t.label,
    keywords: t.keywords,
    rqId: t.rqId,
    load: async () =>
      (
        await cached(`arxiv:q:${t.arxivQuery}:0:25`, HOUR, () => arxivSearch(t.arxivQuery, 0, 25), {
          label: 'arXiv',
          keep: (d) => d.items.length > 0,
        })
      ).data.items,
  }));
  if (track === 'core') {
    sources.unshift({
      id: 'hf-daily',
      label: 'HF Daily',
      keywords: [...new Set(rqs.flatMap((q) => q.keywords))],
      load: async () => (await cached('hf:daily:', HOUR / 2, async () => ({ items: await hfDaily() }), { label: 'Hugging Face' })).data.items,
    });
  }

  // the news wire doesn't touch arXiv's gate, so it runs alongside the scan
  const newsP = cachedNews(track).then(
    (r) => r.data.items,
    () => [] as NewsItem[],
  );

  const scanned: string[] = [];
  const missed: string[] = [];
  const best = new Map<string, BriefPick>();
  let considered = 0;
  const now = Date.now();

  for (const src of sources) {
    if (Date.now() - started > BUDGET_MS) {
      missed.push(src.label);
      continue;
    }
    let items: PaperHit[];
    try {
      items = await src.load();
      scanned.push(src.label);
    } catch {
      missed.push(src.label);
      continue;
    }
    for (const hit of items) {
      considered++;
      const rel = relevance(hit, src.keywords);
      if (rel.score === 0) continue;
      // which of the track's questions it bears on, if any plainly
      let rqId = src.rqId;
      let rqHits = 0;
      for (const q of rqs) {
        const m = relevance(hit, q.keywords).matched.length;
        if (m > rqHits) {
          rqHits = m;
          if (m >= 2) rqId = q.id;
        }
      }
      const ageDays = Math.max(0, (now - Date.parse(hit.published || '')) / DAY) || 0;
      const votes = hit.upvotes ? Math.log2(1 + hit.upvotes) : 0;
      const score = (rel.score + 2 * Math.min(rqHits, 3) + votes) * recency(ageDays);
      const prev = best.get(hit.id);
      if (!prev || prev.score < score) {
        const rq = rqs.find((q) => q.id === rqId);
        best.set(hit.id, {
          hit,
          topicId: src.id,
          topicLabel: src.label,
          rqId,
          rqShort: rq?.short,
          matched: rel.matched,
          score: Math.round(score * 10) / 10,
          ageDays: Math.round(ageDays),
        });
      }
    }
  }

  // greedy, at most PER_TOPIC from any one topic, so one busy topic can't take the list
  const perTopic = new Map<string, number>();
  const picks: BriefPick[] = [];
  for (const p of [...best.values()].sort((a, b) => b.score - a.score)) {
    if (p.score < MIN_SCORE) break;
    const n = perTopic.get(p.topicId) ?? 0;
    if (n >= PER_TOPIC) continue;
    perTopic.set(p.topicId, n + 1);
    picks.push(p);
    if (picks.length === PICKS) break;
  }

  // three freshest headlines per lane
  const all = await newsP;
  const news = (['research', 'industry', 'community'] as const).flatMap((lane) => all.filter((i) => i.lane === lane).slice(0, 3));

  return { track, picks, news, scanned, missed, considered, fetchedAt: new Date().toISOString() };
}
