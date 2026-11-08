/**
 * Research tracks — the separate areas the Research app keeps current on.
 *
 * Each track owns its own arXiv topics (seed.ts), its own news wire
 * (os/ai/news.ts) and a short "Essentials" reading list: the papers to have
 * read before the weekly feed makes sense. Every arXiv id below was checked
 * against the arXiv API when it was added.
 */

export type TrackId = 'core' | 'defense' | 'cyber' | 'aiops' | 'markets';

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
    ],
  },
  {
    id: 'cyber',
    label: 'Cyber AI',
    blurb:
      'AI agents in security and hacking: autonomous pentesting and CTF agents, LLM-driven vulnerability discovery and fuzzing, exploit and malware analysis, SOC automation — and attacks on the agents themselves, from prompt injection to tool poisoning.',
    tag: 'cyber-ai',
    essentials: [
      '2308.06782', // PentestGPT
      '2402.06664', // LLM agents can autonomously hack websites
      '2404.08144', // LLM agents can autonomously exploit one-day vulnerabilities
      '2406.01637', // Teams of LLM agents can exploit zero-day vulnerabilities
      '2409.16165', // EnIGMA: interactive tools for LM agents in CTFs
      '2408.08926', // Cybench
      '2406.05590', // NYU CTF Bench
      '2312.04724', // Purple Llama CyberSecEval
      '2403.18624', // Vulnerability detection with code LMs: how far are we?
      '2308.04748', // Fuzz4All
      '2302.12173', // Indirect prompt injection in LLM-integrated apps
      '2306.05499', // Prompt injection against LLM-integrated applications
      '2403.02691', // InjecAgent
      '2406.13352', // AgentDojo
      '2405.04760', // LLMs for cyber security: systematic review
    ],
  },
  {
    id: 'aiops',
    label: 'AI Ops & CI/CD',
    blurb:
      'Running large, config-heavy AI applications autonomously: coding and SWE agents, CI/CD and build repair, configuration validation and drift, infrastructure-as-code, incident root-cause analysis, and keeping LLM apps testable as prompts, models and configs change.',
    tag: 'ai-ops',
    essentials: [
      '2011.09926', // Challenges in deploying ML: survey of case studies
      '2308.10620', // LLMs for software engineering: systematic review
      '2409.02977', // LLM-based agents for software engineering: survey
      '2310.06770', // SWE-bench
      '2405.15793', // SWE-agent
      '2407.01489', // Agentless
      '2407.16741', // OpenHands
      '2310.09690', // Configuration validation with LLMs (Ciri)
      '2301.03797', // Root-cause and mitigation for cloud incidents with LLMs
      '2305.15778', // RCACopilot: automatic RCA for cloud incidents
      '2310.03714', // DSPy: declarative LM pipelines instead of prompt strings
      '2404.12272', // Who validates the validators? (LLM-assisted evals)
      '2408.05002', // Challenges for LLM application developers
      '2503.13657', // Why do multi-agent LLM systems fail?
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
  if (['security', 'sec', 'hacking', 'infosec', 'pentest', 'cyber-ai'].includes(w)) return 'cyber';
  if (['ops', 'devops', 'cicd', 'ci', 'mlops', 'llmops', 'sre', 'config'].includes(w)) return 'aiops';
  if (['trading', 'finance', 'quant', 'market', 'stocks'].includes(w)) return 'markets';
  return undefined;
}
