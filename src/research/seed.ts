import type { ResearchQuestion, ResearchState, StudyPrefs, Topic } from './types';

export const SCHEMA_VERSION = 1;

/**
 * RQ1–RQ5 are the questions from content/why-a-research-masters.md; the D- and M-
 * questions frame the Defense AI and Trading & Markets tracks. Keywords are
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
  {
    id: 'rq-d1',
    short: 'D1 reliable autonomy',
    track: 'defense',
    question: 'What does it take for an AI system to stay reliable when the environment is actively adversarial — jamming, deception, poisoned data?',
    keywords: ['adversarial', 'robust', 'jamming', 'deception', 'poison', 'backdoor', 'spoof', 'resilien', 'uncertainty'],
  },
  {
    id: 'rq-d2',
    short: 'D2 LLMs in the loop',
    track: 'defense',
    question: 'Where can LLM agents safely sit in a command-and-decision loop, and how is human control kept meaningful?',
    keywords: ['decision support', 'human-in-the-loop', 'human oversight', 'wargam', 'escalat', 'command', 'planning', 'agent', 'meaningful human control'],
  },
  {
    id: 'rq-c1',
    short: 'C1 trustworthy offense',
    track: 'cyber',
    question: 'When can an autonomous agent be trusted with offensive security work — how is scope enforced, and how are its findings verified?',
    keywords: ['penetration test', 'pentest', 'exploit', 'red team', 'capture the flag', 'ctf', 'scope', 'verif', 'autonomous', 'agent'],
  },
  {
    id: 'rq-c2',
    short: 'C2 securing the agents',
    track: 'cyber',
    question: 'How do agents with tools resist prompt injection, tool poisoning and privilege abuse inside their own pipelines?',
    keywords: ['prompt injection', 'indirect', 'tool', 'privilege', 'sandbox', 'jailbreak', 'guardrail', 'agent security', 'exfiltrat'],
  },
  {
    id: 'rq-o1',
    short: 'O1 self-managing apps',
    track: 'aiops',
    question: 'Can an agent keep a large, configuration-heavy AI application healthy — validate config, catch drift, repair CI, roll back — without a human in the loop?',
    keywords: ['configuration', 'misconfig', 'drift', 'ci/cd', 'continuous integration', 'build', 'rollback', 'incident', 'root cause', 'self-healing'],
  },
  {
    id: 'rq-o2',
    short: 'O2 regression-proof LLM apps',
    track: 'aiops',
    question: 'What breaks when prompts, models and configs change in an LLM application, and how do you regression-test it?',
    keywords: ['regression', 'evaluation', 'testing', 'prompt', 'llm application', 'monitoring', 'observability', 'maintenance', 'production'],
  },
  {
    id: 'rq-m1',
    short: 'M1 LLM signal after costs',
    track: 'markets',
    question: 'Do LLM-derived signals carry alpha after transaction costs, once look-ahead and survivorship bias are ruled out?',
    keywords: ['alpha', 'return predict', 'look-ahead', 'lookahead', 'transaction cost', 'out-of-sample', 'sentiment', 'backtest', 'sharpe'],
  },
  {
    id: 'rq-m2',
    short: 'M2 agentic trading',
    track: 'markets',
    question: 'Can multi-agent LLM systems make, size and risk-manage trades better than a simple systematic baseline?',
    keywords: ['trading agent', 'multi-agent', 'agentic', 'portfolio', 'risk management', 'position sizing', 'reinforcement learning', 'execution'],
  },
];

/**
 * Built-in arXiv topics, grouped by track (tracks.ts). Each query was checked
 * live against the API; the noisy ones lean on ranking keywords.
 */
export const TOPICS: Topic[] = [
  {
    id: 't-constraints',
    track: 'core',
    label: 'Constrained retrieval',
    rqId: 'rq1',
    arxivQuery:
      '(abs:"metadata filter" OR abs:"hard constraint" OR abs:"filtered vector search" OR abs:"constrained retrieval") AND (cat:cs.IR OR cat:cs.CL OR cat:cs.DB)',
    keywords: ['metadata', 'filter', 'constraint', 'applicab', 'hybrid', 'vector search', 'predicate', 'retrieval'],
    builtin: true,
  },
  {
    id: 't-legal',
    track: 'core',
    label: 'Legal rule bases',
    rqId: 'rq2',
    arxivQuery:
      '(abs:"LegalRuleML" OR abs:"deontic logic" OR abs:"legal knowledge" OR abs:"regulatory compliance") AND (cat:cs.AI OR cat:cs.CL OR cat:cs.LO OR cat:cs.CY)',
    keywords: ['legalruleml', 'deontic', 'rule', 'formalis', 'formaliz', 'compliance', 'gdpr', 'obligation', 'regulat'],
    builtin: true,
  },
  {
    id: 't-pseudo',
    track: 'core',
    label: 'Pseudo-labelling (speech)',
    rqId: 'rq3',
    arxivQuery: '(abs:"pseudo-label" OR abs:"pseudo-labeling" OR abs:"pseudo-labelling") AND (cat:eess.AS OR cat:cs.SD)',
    keywords: ['pseudo-label', 'consensus', 'agreement', 'filter', 'confidence', 'self-training', 'asr', 'data selection'],
    builtin: true,
  },
  {
    id: 't-asr-eval',
    track: 'core',
    label: 'ASR evaluation',
    rqId: 'rq4',
    arxivQuery: '(abs:"word error rate" OR abs:WER) AND (abs:metric OR abs:evaluation) AND (cat:eess.AS OR cat:cs.CL)',
    keywords: ['wer', 'word error rate', 'metric', 'normalis', 'normaliz', 'transliterat', 'code-switch', 'romani', 'entity'],
    builtin: true,
  },
  {
    id: 't-codeswitch',
    track: 'core',
    label: 'Code-switching ASR',
    rqId: 'rq4',
    arxivQuery: '(abs:"code-switching" OR abs:"code-switched") AND (abs:"speech recognition" OR abs:ASR)',
    keywords: ['code-switch', 'hindi', 'hinglish', 'indic', 'romani', 'script', 'transliterat', 'bilingual'],
    builtin: true,
  },
  {
    id: 't-grounding',
    track: 'core',
    label: 'RAG grounding',
    arxivQuery:
      '(ti:"retrieval-augmented" OR ti:RAG) AND (abs:grounding OR abs:faithfulness OR abs:citation) AND (cat:cs.CL OR cat:cs.IR)',
    keywords: ['grounding', 'faithful', 'citation', 'attribution', 'hallucinat', 'evidence', 'entity'],
    builtin: true,
  },
  {
    id: 't-quant',
    track: 'core',
    label: 'Quantization on-device',
    arxivQuery:
      '(abs:quantization OR abs:"low-bit") AND (abs:"large language model" OR abs:LLM) AND (abs:edge OR abs:"on-device" OR abs:"consumer GPU")',
    keywords: ['quantiz', 'low-bit', '4-bit', 'int4', 'int8', 'on-device', 'edge', 'memory', 'latency'],
    builtin: true,
  },
  {
    id: 't-kb-identity',
    track: 'core',
    label: 'KB identity / dedup',
    rqId: 'rq5',
    arxivQuery:
      '(abs:"entity resolution" OR abs:deduplication OR abs:"knowledge graph construction") AND (abs:"large language model" OR abs:LLM) AND (cat:cs.CL OR cat:cs.DB OR cat:cs.IR)',
    // the query is noisy (200+ results); ranking does the real filtering
    keywords: ['dedup', 'identifier', 'hash', 'entity resolution', 'idempotent', 'cache', 'determinis'],
    builtin: true,
  },
  /* ── Defense AI ── */
  {
    id: 'd-autonomy',
    track: 'defense',
    label: 'Drones, swarms & autonomy',
    rqId: 'rq-d1',
    arxivQuery:
      '(abs:UAV OR abs:drone OR abs:"unmanned aerial" OR abs:swarm OR abs:"air combat") AND (abs:"reinforcement learning" OR abs:autonomous OR abs:"multi-agent") AND (abs:combat OR abs:military OR abs:pursuit OR abs:interception OR abs:"counter-UAV" OR abs:dogfight OR abs:adversary)',
    keywords: ['uav', 'drone', 'swarm', 'air combat', 'interception', 'pursuit', 'counter-uav', 'military', 'multi-agent', 'autonomous'],
    builtin: true,
  },
  {
    id: 'd-isr',
    track: 'defense',
    label: 'ISR: radar, SAR & target recognition',
    arxivQuery:
      '(abs:"synthetic aperture radar" OR abs:"automatic target recognition" OR abs:"radar signal" OR abs:"electronic warfare" OR abs:"SAR image") AND (abs:"deep learning" OR abs:"neural network" OR abs:"object detection" OR abs:"target recognition" OR abs:"reinforcement learning")',
    // SAR also pulls in earth observation; ranking pushes the military-relevant ones up
    keywords: ['target recognition', 'atr', 'sar', 'radar', 'electronic warfare', 'jamming', 'ship detection', 'vehicle', 'military', 'surveillance'],
    builtin: true,
  },
  {
    id: 'd-adversarial',
    track: 'defense',
    label: 'Adversarial ML & model security',
    rqId: 'rq-d1',
    arxivQuery:
      '(ti:adversarial OR ti:jailbreak OR ti:backdoor OR ti:poisoning) AND (abs:robustness OR abs:attack OR abs:defense) AND (cat:cs.LG OR cat:cs.CR OR cat:cs.CL)',
    keywords: ['adversarial', 'robust', 'jailbreak', 'backdoor', 'poison', 'evasion', 'certified', 'attack'],
    builtin: true,
  },
  {
    id: 'd-wargaming',
    track: 'defense',
    label: 'Wargaming & decision support',
    rqId: 'rq-d2',
    arxivQuery:
      '(abs:wargame OR abs:wargaming OR abs:"military decision" OR abs:battlefield OR abs:"military planning" OR abs:"course of action")',
    keywords: ['wargam', 'military', 'battlefield', 'course of action', 'decision support', 'planning', 'escalat', 'llm', 'reinforcement learning'],
    builtin: true,
  },
  {
    id: 'd-policy',
    track: 'defense',
    label: 'Military AI policy & safety',
    rqId: 'rq-d2',
    arxivQuery:
      '(abs:military OR abs:"autonomous weapon" OR abs:"national security" OR abs:warfare OR abs:"armed conflict") AND (abs:"artificial intelligence" OR abs:"machine learning" OR abs:"language model") AND (cat:cs.CY OR cat:cs.AI OR cat:cs.CL)',
    keywords: ['military', 'autonomous weapon', 'national security', 'warfare', 'governance', 'international humanitarian', 'arms control', 'escalat', 'dual-use'],
    builtin: true,
  },

  /* ── Cyber AI ── */
  {
    // was the Defense track's "LLMs for cyber operations"; the id stays so saved state carries over
    id: 'd-cyber',
    track: 'cyber',
    label: 'Pentest & CTF agents',
    rqId: 'rq-c1',
    arxivQuery:
      '(abs:"penetration testing" OR abs:pentest OR abs:"capture the flag" OR abs:CTF OR abs:"offensive security") AND (abs:agent OR abs:LLM OR abs:"large language model")',
    keywords: ['penetration test', 'pentest', 'capture the flag', 'ctf', 'exploit', 'red team', 'agent', 'offensive', 'privilege escalation'],
    builtin: true,
  },
  {
    id: 'c-vuln',
    track: 'cyber',
    label: 'Vulnerability discovery & repair',
    arxivQuery:
      '(abs:"vulnerability detection" OR abs:"vulnerability repair" OR abs:"secure code generation" OR abs:"vulnerable code") AND (abs:LLM OR abs:"large language model")',
    keywords: ['vulnerab', 'cve', 'cwe', 'patch', 'repair', 'static analysis', 'secure code', 'llm'],
    builtin: true,
  },
  {
    id: 'c-fuzz',
    track: 'cyber',
    label: 'LLM-guided fuzzing',
    arxivQuery: '(abs:fuzzing OR abs:fuzzer) AND (abs:LLM OR abs:"large language model")',
    keywords: ['fuzz', 'coverage', 'seed', 'harness', 'crash', 'llm', 'protocol'],
    builtin: true,
  },
  {
    id: 'c-injection',
    track: 'cyber',
    label: 'Prompt injection & agent security',
    rqId: 'rq-c2',
    arxivQuery: '(abs:"prompt injection" OR abs:"tool poisoning" OR abs:"agent security" OR abs:"agent hijacking")',
    keywords: ['prompt injection', 'indirect', 'tool poisoning', 'agent', 'hijack', 'exfiltrat', 'guardrail', 'defense', 'mcp'],
    builtin: true,
  },
  {
    id: 'c-malware',
    track: 'cyber',
    label: 'Malware & intrusion detection',
    arxivQuery:
      '(abs:malware OR abs:"intrusion detection" OR abs:ransomware OR abs:phishing) AND (abs:LLM OR abs:"large language model" OR abs:transformer OR abs:"deep learning") AND cat:cs.CR',
    keywords: ['malware', 'intrusion', 'ransomware', 'phishing', 'detection', 'llm', 'adversarial', 'evasion'],
    builtin: true,
  },
  {
    id: 'c-soc',
    track: 'cyber',
    label: 'SOC automation & threat intel',
    arxivQuery:
      '(abs:"security operations" OR abs:"threat intelligence" OR abs:"incident response" OR abs:"alert triage" OR abs:"threat hunting") AND (abs:LLM OR abs:"large language model" OR abs:agent)',
    keywords: ['soc', 'security operations', 'threat intelligence', 'incident response', 'triage', 'mitre', 'att&ck', 'agent'],
    builtin: true,
  },
  {
    id: 'c-reverse',
    track: 'cyber',
    label: 'Reverse engineering & binaries',
    arxivQuery:
      '(abs:"binary analysis" OR abs:decompilation OR abs:decompiler OR abs:"reverse engineering") AND (abs:LLM OR abs:"large language model" OR abs:"language model")',
    keywords: ['binary', 'decompil', 'reverse engineering', 'disassembl', 'firmware', 'llm', 'function'],
    builtin: true,
  },

  /* ── AI Ops & CI/CD ── */
  {
    id: 'o-swe',
    track: 'aiops',
    label: 'Coding & SWE agents',
    rqId: 'rq-o1',
    arxivQuery: '(abs:"SWE-bench" OR abs:"software engineering agent" OR abs:"coding agent" OR abs:"issue resolution")',
    keywords: ['swe-bench', 'coding agent', 'software engineering', 'issue', 'repository', 'patch', 'agent', 'test'],
    builtin: true,
  },
  {
    id: 'o-cicd',
    track: 'aiops',
    label: 'CI/CD & build repair',
    rqId: 'rq-o1',
    arxivQuery:
      '(abs:"continuous integration" OR abs:"CI/CD" OR abs:"build failure" OR abs:"build repair" OR abs:"flaky test" OR abs:"GitHub Actions") AND (abs:LLM OR abs:"large language model" OR abs:agent OR abs:"machine learning")',
    keywords: ['continuous integration', 'ci/cd', 'build', 'pipeline', 'flaky', 'github actions', 'deployment', 'repair'],
    builtin: true,
  },
  {
    id: 'o-config',
    track: 'aiops',
    label: 'Configuration errors & validation',
    rqId: 'rq-o1',
    arxivQuery:
      '(abs:misconfiguration OR abs:"configuration error" OR abs:"configuration validation" OR abs:"configuration drift" OR abs:"configuration management") AND (abs:LLM OR abs:"large language model" OR abs:agent OR abs:"machine learning")',
    keywords: ['configuration', 'misconfig', 'config', 'drift', 'validation', 'parameter', 'yaml', 'tuning'],
    builtin: true,
  },
  {
    id: 'o-iac',
    track: 'aiops',
    label: 'Infrastructure as code',
    arxivQuery:
      '(abs:"infrastructure as code" OR abs:Terraform OR abs:Kubernetes OR abs:Ansible OR abs:Helm) AND (abs:LLM OR abs:"large language model" OR abs:agent)',
    keywords: ['infrastructure as code', 'terraform', 'kubernetes', 'ansible', 'helm', 'cloud', 'deployment', 'llm'],
    builtin: true,
  },
  {
    id: 'o-incident',
    track: 'aiops',
    label: 'Incidents & root cause (AIOps)',
    rqId: 'rq-o1',
    arxivQuery:
      '(abs:"root cause analysis" OR abs:"incident management" OR abs:AIOps OR abs:"log analysis" OR abs:"cloud incident") AND (abs:LLM OR abs:"large language model" OR abs:agent)',
    keywords: ['root cause', 'incident', 'aiops', 'log', 'alert', 'microservice', 'cloud', 'mitigation', 'on-call'],
    builtin: true,
  },
  {
    id: 'o-llmapps',
    track: 'aiops',
    label: 'Testing & operating LLM apps',
    rqId: 'rq-o2',
    arxivQuery:
      '(abs:"LLM application" OR abs:"LLM-based application" OR abs:"compound AI" OR abs:"LLM-integrated application" OR abs:LLMOps) AND (abs:testing OR abs:evaluation OR abs:monitoring OR abs:observability OR abs:maintenance OR abs:production)',
    keywords: ['llm application', 'compound ai', 'llmops', 'evaluation', 'regression', 'monitoring', 'observability', 'prompt', 'production'],
    builtin: true,
  },
  {
    id: 'o-agentrel',
    track: 'aiops',
    label: 'Agent system reliability',
    rqId: 'rq-o2',
    arxivQuery:
      '(abs:"agentic system" OR abs:"agentic workflow" OR abs:"LLM agent" OR abs:"multi-agent system") AND (abs:failure OR abs:"fault tolerance" OR abs:reliability) AND (cat:cs.SE OR cat:cs.AI OR cat:cs.MA)',
    keywords: ['failure', 'reliab', 'fault', 'recovery', 'orchestrat', 'multi-agent', 'workflow', 'production'],
    builtin: true,
  },
  {
    id: 'o-mlops',
    track: 'aiops',
    label: 'MLOps & technical debt',
    arxivQuery:
      '(abs:MLOps OR abs:"technical debt" OR abs:"ML pipeline" OR abs:"machine learning pipeline") AND (abs:production OR abs:deployment OR abs:maintenance) AND (cat:cs.SE OR cat:cs.LG)',
    keywords: ['mlops', 'technical debt', 'pipeline', 'deployment', 'maintenance', 'monitoring', 'drift', 'reproducib'],
    builtin: true,
  },

  /* ── Trading & Markets ── */
  {
    id: 'm-llm-finance',
    track: 'markets',
    label: 'LLMs in quant finance',
    rqId: 'rq-m1',
    arxivQuery:
      '(abs:"large language model" OR abs:LLM OR abs:GPT OR abs:ChatGPT) AND (cat:q-fin.TR OR cat:q-fin.CP OR cat:q-fin.ST OR cat:q-fin.PM OR cat:q-fin.GN OR cat:q-fin.RM)',
    keywords: ['llm', 'language model', 'gpt', 'stock', 'return', 'trading', 'alpha', 'sentiment', 'forecast'],
    builtin: true,
  },
  {
    id: 'm-agents',
    track: 'markets',
    label: 'LLM trading agents',
    rqId: 'rq-m2',
    arxivQuery:
      '(abs:agent OR abs:"multi-agent" OR abs:agentic) AND (abs:"large language model" OR abs:LLM) AND (abs:"stock trading" OR abs:"trading agent" OR abs:"financial trading" OR abs:"trading strategy" OR abs:"quantitative trading")',
    keywords: ['trading agent', 'multi-agent', 'agentic', 'stock trading', 'portfolio', 'backtest', 'risk', 'memory'],
    builtin: true,
  },
  {
    id: 'm-rl',
    track: 'markets',
    label: 'RL for trading & portfolios',
    rqId: 'rq-m2',
    arxivQuery:
      '(abs:"reinforcement learning") AND (abs:"stock trading" OR abs:"algorithmic trading" OR abs:"portfolio management" OR abs:"portfolio optimization" OR abs:"market making" OR abs:"optimal execution" OR abs:"quantitative trading")',
    keywords: ['reinforcement learning', 'trading', 'portfolio', 'market making', 'execution', 'sharpe', 'drawdown', 'reward'],
    builtin: true,
  },
  {
    id: 'm-alpha',
    track: 'markets',
    label: 'Alpha & factor mining',
    rqId: 'rq-m1',
    arxivQuery:
      '(abs:"alpha factor" OR abs:"factor mining" OR abs:"formulaic alpha" OR abs:"alpha mining" OR abs:"alpha factors")',
    keywords: ['alpha', 'factor', 'formulaic', 'ic', 'llm', 'genetic programming', 'cross-section', 'return'],
    builtin: true,
  },
  {
    id: 'm-sentiment',
    track: 'markets',
    label: 'News, filings & sentiment',
    rqId: 'rq-m1',
    arxivQuery:
      '(abs:sentiment OR abs:"earnings call" OR abs:"financial news" OR abs:"10-K") AND (abs:stock OR abs:returns OR abs:"asset pricing") AND (cat:q-fin.ST OR cat:q-fin.CP OR cat:q-fin.GN OR cat:cs.CL)',
    keywords: ['sentiment', 'earnings call', 'news', '10-k', 'filing', 'return', 'stock', 'llm'],
    builtin: true,
  },
  {
    id: 'm-microstructure',
    track: 'markets',
    label: 'Order books & microstructure',
    arxivQuery:
      '(abs:"limit order book" OR abs:"market microstructure" OR abs:"high-frequency trading" OR abs:"order flow") AND (abs:"deep learning" OR abs:"neural network" OR abs:"machine learning" OR abs:"reinforcement learning")',
    keywords: ['limit order book', 'lob', 'microstructure', 'order flow', 'high-frequency', 'market making', 'price impact', 'execution'],
    builtin: true,
  },
  {
    id: 'm-timeseries',
    track: 'markets',
    label: 'Time-series foundation models',
    arxivQuery:
      '(abs:"time series" OR abs:"time-series") AND (abs:"foundation model" OR abs:"language model" OR abs:"zero-shot") AND abs:forecast AND (cat:cs.LG OR cat:stat.ML OR cat:q-fin.ST)',
    keywords: ['time series', 'foundation model', 'zero-shot', 'forecast', 'financial', 'stock', 'volatility', 'transformer'],
    builtin: true,
  },
  {
    id: 'm-backtest',
    track: 'markets',
    label: 'Backtest bias & leakage',
    rqId: 'rq-m1',
    arxivQuery:
      '(abs:"look-ahead bias" OR abs:"lookahead bias" OR abs:"backtest overfitting" OR abs:"data snooping") AND (abs:stock OR abs:trading OR abs:returns OR abs:backtest)',
    keywords: ['look-ahead', 'lookahead', 'overfitting', 'data snooping', 'leakage', 'backtest', 'out-of-sample', 'memoriz'],
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
