/**
 * Research tracks — the separate areas the Research app keeps current on.
 *
 * Each track owns its own arXiv topics (seed.ts), its own news wire
 * (os/ai/news.ts) and a short "Essentials" reading list: the papers to have
 * read before the weekly feed makes sense. Every arXiv id below was checked
 * against the arXiv API when it was added.
 */

export type TrackId = 'core' | 'defense' | 'markets';

export interface Track {
  id: TrackId;
  label: string;
  /** one-line framing shown above the feed */
  blurb: string;
  /** tag added to papers saved from this track (core adds none) */
  tag?: string;
  /** canonical reading list, at most 20 (the arXiv id endpoint's cap) */
  essentials: string[];
}

export const TRACKS: Track[] = [
  {
    id: 'core',
    label: 'AI / ML',
    blurb:
      'My research questions — constrained retrieval, legal rule bases, speech evaluation — plus quantization and the LLM fundamentals under all of it.',
    essentials: [
      '1706.03762', // Attention Is All You Need
      '2001.08361', // Scaling Laws for Neural Language Models
      '2203.15556', // Chinchilla: compute-optimal training
      '2203.02155', // InstructGPT: RLHF
      '2305.18290', // DPO
      '2201.11903', // Chain-of-thought prompting
      '2210.03629', // ReAct
      '2302.04761', // Toolformer
      '2005.11401', // RAG
      '2106.09685', // LoRA
      '2305.14314', // QLoRA
      '2208.07339', // LLM.int8()
      '2210.17323', // GPTQ
      '2211.10438', // SmoothQuant
      '2306.00978', // AWQ
    ],
  },
  {
    id: 'defense',
    label: 'Defense AI',
    blurb:
      'AI in military and national-security settings: autonomy and swarms, ISR and target recognition, cyber operations, adversarial robustness, wargaming, and the policy that governs all of it.',
    tag: 'defense-ai',
    essentials: [
      '1412.6572', // Explaining and Harnessing Adversarial Examples
      '1706.06083', // Madry et al. — adversarially robust deep learning
      '2307.15043', // Universal and transferable attacks on aligned LLMs
      '2302.10149', // Poisoning web-scale training datasets is practical
      '2401.05566', // Sleeper Agents
      '1606.06565', // Concrete Problems in AI Safety
      '1802.07228', // The Malicious Use of AI
      '2105.00990', // Hierarchical RL for air combat (AlphaDogfight)
      '2401.03408', // Escalation risks of LLMs in military decision-making
      '2308.06782', // PentestGPT
    ],
  },
  {
    id: 'markets',
    label: 'Trading & Markets',
    blurb:
      'LLMs and ML for trading: financial LLMs and agents, reinforcement learning for execution and portfolios, alpha mining, order-book models, time-series foundation models — and the biases that make backtests lie.',
    tag: 'ai-trading',
    essentials: [
      '1908.10063', // FinBERT
      '2303.17564', // BloombergGPT
      '2306.06031', // FinGPT
      '2304.07619', // Can ChatGPT forecast stock price movements?
      '2309.17322', // Look-ahead bias in GPT sentiment return predictions
      '2311.13743', // FinMem: LLM trading agent with layered memory
      '2412.20138', // TradingAgents: multi-agent LLM trading
      '1911.10107', // Deep RL for trading
      '2011.09607', // FinRL
      '1808.03668', // DeepLOB
      '2310.01728', // Time-LLM
      '2310.10688', // TimesFM
      '2403.07815', // Chronos
    ],
  },
];

export const TRACK_IDS = TRACKS.map((t) => t.id);

export const trackOf = (id: string | undefined): Track => TRACKS.find((t) => t.id === id) ?? TRACKS[0];

export const isTrackId = (s: unknown): s is TrackId => typeof s === 'string' && (TRACK_IDS as string[]).includes(s);

/** Words that select a track from a launch arg or a terminal command. */
export function trackFromWord(word: string): TrackId | undefined {
  const w = word.trim().toLowerCase();
  if (isTrackId(w)) return w;
  if (['ml', 'ai', 'general'].includes(w)) return 'core';
  if (['military', 'defence', 'mil', 'natsec'].includes(w)) return 'defense';
  if (['trading', 'finance', 'quant', 'market', 'stocks'].includes(w)) return 'markets';
  return undefined;
}
