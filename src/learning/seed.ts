import type {
  Domain,
  InterviewDomain,
  KnowledgeState,
  LearningState,
  Project,
  Resource,
  RoadmapPhase,
  Skill,
  Story,
} from './types';

/* ───────────────────────── skill builder ─────────────────────────
   Terse on purpose: this file is data, and data that is painful to edit
   stops getting edited. Defaults cover the common case. */

interface SkillSeed {
  id: string;
  name: string;
  domain: Domain;
  /** roleImportance / interviewRelevance, 1–5 */
  imp: number;
  ivr?: number;
  state: KnowledgeState;
  /** confidence in the estimate, 0–1 */
  conf: number;
  /** independent capability: true / false / null (never tested) */
  ind?: boolean | null;
  deps?: string[];
  obj: string;
  check: string;
}

const skill = (s: SkillSeed): Skill => ({
  id: s.id,
  name: s.name,
  domain: s.domain,
  roleImportance: s.imp,
  interviewRelevance: s.ivr ?? s.imp,
  state: s.state,
  confidence: s.conf,
  independent: s.ind ?? null,
  deps: s.deps ?? [],
  objective: s.obj,
  aiFreeCheck: s.check,
});

/* ───────────────────────── seed skills ─────────────────────────
   Starting hypotheses from a self-assessment, not measurements. Anything
   without attached evidence carries low confidence by construction, which is
   what pushes it up the priority ranking until it is tested. */

const SEED_SKILLS: SkillSeed[] = [
  /* ── Strong: evidenced repeatedly in production work ── */
  { id: 'applied-ai-arch', name: 'Applied AI product architecture', domain: 'Product & leadership', imp: 4, ivr: 5, state: 'STRONG', conf: 0.9, ind: true, obj: 'Maintain. Use as the frame for every new system.', check: 'Whiteboard an end-to-end AI product from a one-line business ask.' },
  { id: 'requirements-decomposition', name: 'Requirement → system decomposition', domain: 'Product & leadership', imp: 4, ivr: 5, state: 'STRONG', conf: 0.9, ind: true, obj: 'Maintain.', check: 'Turn an ambiguous stakeholder ask into components, contracts and failure modes on a blank page.' },
  { id: 'rest-apis', name: 'REST / API integration', domain: 'Systems & backend', imp: 3, ivr: 3, state: 'STRONG', conf: 0.9, ind: true, obj: 'Maintain.', check: 'Design and implement a versioned API with auth and pagination, no scaffolding.' },
  { id: 'enterprise-integration', name: 'Enterprise AI integration', domain: 'Product & leadership', imp: 3, ivr: 3, state: 'STRONG', conf: 0.85, ind: true, obj: 'Maintain.', check: 'Describe how to land an AI system inside a regulated org, including the approval path.' },
  { id: 'llm-app-arch', name: 'LLM application architecture', domain: 'Retrieval & agents', imp: 4, ivr: 5, state: 'STRONG', conf: 0.88, ind: true, obj: 'Maintain.', check: 'Design a grounded LLM system with failure gates from an empty canvas.' },
  { id: 'rag', name: 'RAG mechanics', domain: 'Retrieval & agents', imp: 4, ivr: 5, state: 'STRONG', conf: 0.9, ind: true, deps: ['embeddings'], obj: 'Maintain. Push toward retrieval evaluation rather than more RAG.', check: 'Diagnose why retrieval failed and propose diagnostics with no assistant.' },
  { id: 'embeddings', name: 'Embeddings', domain: 'Retrieval & agents', imp: 4, ivr: 4, state: 'APPLIED', conf: 0.75, ind: true, obj: 'Move to INTERNALIZED: derive cosine/dot equivalence and explain anisotropy.', check: 'Explain what an embedding model optimises, and why cosine is the usual metric.' },
  { id: 'agentic-workflows', name: 'Agentic workflows', domain: 'Retrieval & agents', imp: 4, ivr: 4, state: 'STRONG', conf: 0.85, ind: true, obj: 'Maintain.', check: 'Design an agent with a tool firewall, taint tracking and an audit trail.' },
  { id: 'retrieval-design', name: 'Retrieval system design', domain: 'Retrieval & agents', imp: 4, ivr: 4, state: 'STRONG', conf: 0.85, ind: true, deps: ['embeddings'], obj: 'Maintain.', check: 'Specify hybrid retrieval with RRF and justify every knob.' },
  { id: 'rare-event-eval', name: 'Rare-event model evaluation', domain: 'Evaluation', imp: 4, ivr: 4, state: 'STRONG', conf: 0.85, ind: true, obj: 'Maintain.', check: 'Design an evaluation for a 1-in-1000 positive rate and defend the metric choice.' },
  { id: 'pr-auc', name: 'PR-AUC / lift / calibration reasoning', domain: 'Evaluation', imp: 4, ivr: 4, state: 'STRONG', conf: 0.85, ind: true, obj: 'Maintain.', check: 'Explain why PR-AUC beats ROC-AUC under class imbalance, from memory.' },
  { id: 'leakage', name: 'Leakage & point-in-time reasoning', domain: 'Evaluation', imp: 5, ivr: 4, state: 'STRONG', conf: 0.9, ind: true, obj: 'Maintain — this is a differentiator.', check: 'Find the leak in a described feature pipeline and name the barrier that fixes it.' },
  { id: 'eval-mindset', name: 'AI evaluation mindset', domain: 'Evaluation', imp: 5, ivr: 5, state: 'STRONG', conf: 0.9, ind: true, obj: 'Maintain. Convert into published methodology.', check: 'State the falsifying measurement for any claim before running it.' },
  { id: 'indic-speech-ecosystem', name: 'Indian-language speech ecosystem', domain: 'Speech', imp: 5, ivr: 4, state: 'STRONG', conf: 0.85, ind: true, obj: 'Maintain — direct differentiator for Sarvam-class roles.', check: 'Compare the available Indic ASR options on data, script and licence terms.' },
  { id: 'speech-economics', name: 'Speech pipeline economics', domain: 'Speech', imp: 4, ivr: 3, state: 'STRONG', conf: 0.85, ind: true, obj: 'Maintain.', check: 'Build a per-1000-call cost model for two architectures from scratch.' },
  { id: 'cost-engineering', name: 'Model / API cost engineering', domain: 'Infrastructure', imp: 4, ivr: 3, state: 'STRONG', conf: 0.85, ind: true, obj: 'Maintain.', check: 'Design budget guards and an invoice-faithful meter from an empty file.' },
  { id: 'docker', name: 'Docker fundamentals', domain: 'Infrastructure', imp: 3, ivr: 3, state: 'APPLIED', conf: 0.8, ind: true, obj: 'Deepen toward GPU containers and image size discipline.', check: 'Write a multi-stage Dockerfile for a CUDA-enabled service from memory.' },
  { id: 'prod-debugging', name: 'Production integration & debugging', domain: 'Systems & backend', imp: 4, ivr: 4, state: 'STRONG', conf: 0.88, ind: true, obj: 'Maintain.', check: 'Walk an interviewer through a real root-cause analysis you led.' },
  { id: 'stakeholder-translation', name: 'Stakeholder / technical translation', domain: 'Product & leadership', imp: 3, ivr: 4, state: 'STRONG', conf: 0.9, ind: true, obj: 'Maintain.', check: 'Explain a fail-closed design decision to a non-technical approver.' },

  /* ── Applied, worth deepening ── */
  { id: 'python', name: 'Python', domain: 'Foundations', imp: 5, ivr: 5, state: 'APPLIED', conf: 0.6, ind: null, obj: 'Prove closed-book fluency: no assistant, no autocomplete.', check: 'Implement a non-trivial module from an empty file in 45 minutes.' },
  { id: 'backend', name: 'Backend engineering', domain: 'Systems & backend', imp: 4, ivr: 4, state: 'APPLIED', conf: 0.7, ind: null, deps: ['python'], obj: 'Deepen: transactions, idempotency, backpressure.', check: 'Build a FastAPI endpoint plus persistence layer from scratch.' },
  { id: 'postgres', name: 'PostgreSQL', domain: 'Systems & backend', imp: 3, ivr: 4, state: 'APPLIED', conf: 0.65, ind: null, obj: 'Deepen: query plans, index choice, isolation levels.', check: 'Read an EXPLAIN ANALYZE plan and name the fix without help.' },
  { id: 'redis', name: 'Redis', domain: 'Systems & backend', imp: 2, ivr: 3, state: 'APPLIED', conf: 0.6, ind: null, obj: 'Deepen: eviction, persistence trade-offs, cache stampede.', check: 'Design a cache with stampede protection on a blank page.' },
  { id: 'cloud', name: 'Cloud infrastructure', domain: 'Infrastructure', imp: 3, ivr: 3, state: 'APPLIED', conf: 0.6, ind: null, obj: 'Deepen toward GPU instances and spot economics.', check: 'Size and cost a GPU training run end to end.' },
  { id: 'system-design', name: 'System design', domain: 'Systems & backend', imp: 4, ivr: 5, state: 'APPLIED', conf: 0.65, ind: null, deps: ['distributed-systems'], obj: 'Reach interview-grade: capacity numbers, not just boxes.', check: 'Design model-serving infrastructure on a blank canvas in 45 minutes.' },
  { id: 'speech-systems', name: 'Speech systems (pipeline level)', domain: 'Speech', imp: 5, ivr: 4, state: 'APPLIED', conf: 0.75, ind: true, deps: ['speech-fundamentals'], obj: 'Push from pipeline into model internals.', check: 'Draw an ASR pipeline from audio bytes to scored transcript, from memory.' },
  { id: 'model-serving', name: 'Model serving', domain: 'Inference & serving', imp: 5, ivr: 5, state: 'AWARE', conf: 0.4, ind: false, deps: ['inference-internals'], obj: 'Serve a real model yourself and measure it.', check: 'Stand up a served model and report p50/p99 and VRAM with no assistant.' },
  { id: 'llm-inference', name: 'LLM inference (applied)', domain: 'Inference & serving', imp: 5, ivr: 5, state: 'APPLIED', conf: 0.5, ind: false, deps: ['autoregressive-decoding'], obj: 'Understand the internals you currently only consume.', check: 'Explain prefill vs decode and where the time actually goes.' },
  { id: 'fastapi', name: 'FastAPI', domain: 'Systems & backend', imp: 3, ivr: 3, state: 'APPLIED', conf: 0.7, ind: null, deps: ['python'], obj: 'Deepen: async, lifespans, streaming responses.', check: 'Write a streaming endpoint with graceful shutdown from an empty file.' },
  { id: 'vector-db', name: 'Vector databases', domain: 'Retrieval & agents', imp: 3, ivr: 3, state: 'APPLIED', conf: 0.7, ind: true, deps: ['embeddings'], obj: 'Deepen: HNSW parameters and recall/latency trade-off.', check: 'Explain HNSW ef/M and predict the recall effect of changing them.' },
  { id: 'eval-methodology', name: 'Evaluation methodology', domain: 'Evaluation', imp: 5, ivr: 4, state: 'APPLIED', conf: 0.75, ind: true, deps: ['eval-mindset'], obj: 'Add inter-annotator agreement and significance testing.', check: 'Design an annotation protocol and report κ, unprompted.' },
  { id: 'ai-observability', name: 'AI observability', domain: 'Evaluation', imp: 3, ivr: 3, state: 'APPLIED', conf: 0.6, ind: null, obj: 'Deepen: drift detection and online/offline metric divergence.', check: 'Specify what to log so a silent model regression is detectable.' },
  { id: 'prod-ai-architecture', name: 'Production AI architecture', domain: 'Product & leadership', imp: 4, ivr: 4, state: 'STRONG', conf: 0.8, ind: true, obj: 'Maintain.', check: 'Design a fail-closed AI pipeline and justify every gate.' },

  /* ── Foundations behind the gaps ── */
  // Deliberately NOT a hard prerequisite for PyTorch. You can open an editor and
  // start today; the maths deepens the same work rather than gating it. Making it
  // gating produced a ranking that told you not to study the thing you must study.
  { id: 'ml-math', name: 'ML mathematics', domain: 'Foundations', imp: 4, ivr: 3, state: 'AWARE', conf: 0.3, ind: false, obj: 'Enough linear algebra and calculus to derive backprop and attention.', check: 'Derive the gradient of a matmul layer by hand.' },
  { id: 'linear-algebra', name: 'Linear algebra for DL', domain: 'Foundations', imp: 4, ivr: 3, state: 'AWARE', conf: 0.35, ind: false, obj: 'Shapes, broadcasting and matmul as the unit of thought.', check: 'Predict every tensor shape in an attention block without running it.' },
  { id: 'closed-book-python', name: 'Closed-book Python implementation', domain: 'Interview craft', imp: 5, ivr: 5, state: 'AWARE', conf: 0.35, ind: false, deps: ['python'], obj: 'Remove the assistant from the loop for 45-minute blocks.', check: 'Solve a medium problem in a timed editor, no completion, no assistant.' },
  { id: 'dsa', name: 'Algorithms & data structures', domain: 'Interview craft', imp: 4, ivr: 5, state: 'AWARE', conf: 0.35, ind: false, deps: ['closed-book-python'], obj: 'Reach reliable medium-level performance under time pressure.', check: 'Two mediums in 45 minutes, timed, no assistance.' },

  /* ── Training chain ── */
  { id: 'pytorch', name: 'PyTorch', domain: 'Training', imp: 5, ivr: 5, state: 'AWARE', conf: 0.3, ind: false, deps: ['python'], obj: 'Tensors, shapes, devices, modules — fluent without lookup.', check: 'Build and train a small model from an empty file, no assistant.' },
  { id: 'backprop', name: 'Backpropagation', domain: 'Training', imp: 5, ivr: 5, state: 'AWARE', conf: 0.3, ind: false, deps: ['linear-algebra'], obj: 'Derive it, then implement it by hand for a tiny MLP.', check: 'Derive and implement backprop through a 2-layer MLP with no framework.' },
  { id: 'autograd', name: 'PyTorch autograd', domain: 'Training', imp: 5, ivr: 4, state: 'UNKNOWN', conf: 0.2, ind: false, deps: ['pytorch', 'backprop'], obj: 'Understand the tape, leaf tensors and where grads vanish.', check: 'Explain why a gradient is None, from the graph, without running anything.' },
  { id: 'optimization', name: 'Optimization (SGD/Adam/schedules)', domain: 'Training', imp: 4, ivr: 4, state: 'AWARE', conf: 0.3, ind: false, deps: ['backprop'], obj: 'Know what each hyperparameter physically does.', check: 'Implement Adam from the update rule, no reference.' },
  { id: 'training-loops', name: 'Training loops', domain: 'Training', imp: 5, ivr: 5, state: 'UNKNOWN', conf: 0.2, ind: false, deps: ['autograd', 'optimization'], obj: 'Write one from an empty file, including eval and checkpointing.', check: 'Minimal PyTorch training loop from a blank file, no assistant.' },
  { id: 'transformer-training', name: 'Transformer training', domain: 'Training', imp: 4, ivr: 4, state: 'UNKNOWN', conf: 0.15, ind: false, deps: ['training-loops', 'transformer-internals'], obj: 'Train a tiny transformer end to end and watch the loss curve.', check: 'Explain what a diverging loss curve means and name three causes.' },
  { id: 'finetuning', name: 'Fine-tuning', domain: 'Training', imp: 5, ivr: 5, state: 'AWARE', conf: 0.25, ind: false, deps: ['transformer-training'], obj: 'Run one real adaptation with a protected eval split.', check: 'Design a fine-tune with the leakage barriers, then run it yourself.' },
  { id: 'lora', name: 'LoRA / QLoRA implementation', domain: 'Training', imp: 4, ivr: 4, state: 'AWARE', conf: 0.25, ind: false, deps: ['finetuning'], obj: 'Implement the adapter, not just call the library.', check: 'Write a LoRA layer from the paper equation and verify rank behaviour.' },
  { id: 'distributed-training', name: 'Distributed training', domain: 'Training', imp: 3, ivr: 3, state: 'UNKNOWN', conf: 0.15, ind: false, deps: ['finetuning', 'gpu-memory'], obj: 'Not yet — sits behind single-GPU competence.', check: 'Explain DDP gradient synchronisation and its bandwidth cost.' },

  /* ── Transformer / inference chain ── */
  { id: 'transformer-internals', name: 'Transformer internals', domain: 'Model internals', imp: 5, ivr: 5, state: 'CONCEPTUAL', conf: 0.3, ind: false, deps: ['attention-math'], obj: 'Rebuild a block from scratch and match reference outputs.', check: 'Implement a transformer block from memory; match PyTorch reference within tolerance.' },
  { id: 'attention-math', name: 'Attention mathematics', domain: 'Model internals', imp: 5, ivr: 5, state: 'CONCEPTUAL', conf: 0.3, ind: false, deps: ['linear-algebra'], obj: 'Implement scaled dot-product attention from scratch and explain every dimension.', check: 'Write SDPA in PyTorch with no AI, then diff against F.scaled_dot_product_attention.' },
  { id: 'tokenizers', name: 'Tokenizers', domain: 'Model internals', imp: 3, ivr: 3, state: 'APPLIED', conf: 0.55, ind: null, obj: 'Understand BPE merges and why script choice changes token counts.', check: 'Explain measured romanized-vs-Devanagari token inflation from first principles.' },
  { id: 'autoregressive-decoding', name: 'Autoregressive decoding', domain: 'Inference & serving', imp: 5, ivr: 5, state: 'CONCEPTUAL', conf: 0.35, ind: false, deps: ['transformer-internals'], obj: 'Implement greedy and sampled decode loops yourself.', check: 'Write a decode loop from scratch; explain temperature and top-p mathematically.' },
  { id: 'kv-cache', name: 'KV cache', domain: 'Inference & serving', imp: 5, ivr: 5, state: 'AWARE', conf: 0.25, ind: false, deps: ['autoregressive-decoding'], obj: 'Implement a minimal KV cache and measure the latency delta.', check: 'Implement a KV cache with no AI; state its memory complexity in tokens × layers × heads.' },
  { id: 'batching', name: 'Batching', domain: 'Inference & serving', imp: 4, ivr: 4, state: 'AWARE', conf: 0.25, ind: false, deps: ['kv-cache'], obj: 'Understand padding waste and the throughput/latency curve.', check: 'Predict throughput change from batch size and explain why it saturates.' },
  { id: 'continuous-batching', name: 'Continuous batching', domain: 'Inference & serving', imp: 4, ivr: 4, state: 'UNKNOWN', conf: 0.15, ind: false, deps: ['batching'], obj: 'Later — after static batching is measured.', check: 'Explain iteration-level scheduling and what it fixes.' },
  { id: 'vllm', name: 'vLLM / high-performance serving', domain: 'Inference & serving', imp: 4, ivr: 4, state: 'AWARE', conf: 0.2, ind: false, deps: ['continuous-batching', 'gpu-memory'], obj: 'Later. Read PagedAttention only once KV cache is implemented.', check: 'Explain PagedAttention and the fragmentation problem it solves.' },
  { id: 'inference-internals', name: 'LLM inference internals', domain: 'Inference & serving', imp: 5, ivr: 5, state: 'AWARE', conf: 0.25, ind: false, deps: ['kv-cache'], obj: 'Know where the milliseconds and the gigabytes go.', check: 'Break a request into prefill/decode and attribute time and memory to each.' },
  { id: 'quantization', name: 'Quantization implementation', domain: 'Inference & serving', imp: 4, ivr: 4, state: 'AWARE', conf: 0.25, ind: false, deps: ['gpu-memory'], obj: 'Quantise a real model and measure quality loss, not just size.', check: 'Implement int8 symmetric quantisation of a linear layer and measure the error.' },
  { id: 'distributed-inference', name: 'Distributed inference', domain: 'Inference & serving', imp: 3, ivr: 3, state: 'UNKNOWN', conf: 0.15, ind: false, deps: ['vllm'], obj: 'Not yet.', check: 'Explain tensor vs pipeline parallelism and when each wins.' },

  /* ── GPU chain ── */
  { id: 'gpu-memory', name: 'GPU memory reasoning', domain: 'Infrastructure', imp: 5, ivr: 5, state: 'AWARE', conf: 0.25, ind: false, deps: ['pytorch'], obj: 'Predict VRAM before launching a run, and be right.', check: 'Compute VRAM for weights + activations + optimiser state on paper, then verify.' },
  { id: 'cuda', name: 'CUDA fundamentals', domain: 'Infrastructure', imp: 2, ivr: 3, state: 'UNKNOWN', conf: 0.15, ind: false, deps: ['gpu-memory'], obj: 'Later. Low ROI until training and serving are real.', check: 'Explain memory coalescing and occupancy.' },

  /* ── Systems gaps ── */
  { id: 'networking', name: 'Networking fundamentals', domain: 'Systems & backend', imp: 3, ivr: 4, state: 'AWARE', conf: 0.35, ind: false, obj: 'TCP, TLS, HTTP/2, and where latency actually comes from.', check: 'Trace a request end to end and name every hop that can add 100ms.' },
  { id: 'concurrency', name: 'Concurrency', domain: 'Systems & backend', imp: 4, ivr: 4, state: 'AWARE', conf: 0.35, ind: false, deps: ['python'], obj: 'asyncio, the GIL, and when processes beat threads.', check: 'Explain why an async endpoint blocked, from the code, unaided.' },
  { id: 'distributed-systems', name: 'Distributed systems', domain: 'Systems & backend', imp: 4, ivr: 5, state: 'AWARE', conf: 0.3, ind: false, deps: ['networking'], obj: 'Consistency, partitions, retries, idempotency.', check: 'Design an at-least-once pipeline that is safe to retry, on paper.' },
  { id: 'security-engineering', name: 'Security engineering habits', domain: 'Systems & backend', imp: 3, ivr: 3, state: 'APPLIED', conf: 0.5, ind: null, obj: 'Formalise: threat model each new surface.', check: 'Threat-model an LLM tool gateway without a checklist.' },

  /* ── Speech chain ── */
  { id: 'speech-fundamentals', name: 'Speech fundamentals (DSP)', domain: 'Speech', imp: 4, ivr: 3, state: 'AWARE', conf: 0.35, ind: false, obj: 'Sampling, framing, spectra — enough to reason about 8 kHz telephony.', check: 'Explain what an 8 kHz bandwidth costs you, in Hz and in phonemes.' },
  { id: 'feature-representation', name: 'Feature representation (mel/fbank)', domain: 'Speech', imp: 4, ivr: 3, state: 'AWARE', conf: 0.3, ind: false, deps: ['speech-fundamentals'], obj: 'Compute a log-mel spectrogram yourself.', check: 'Implement log-mel from raw audio with numpy, no assistant.' },
  { id: 'asr-architecture', name: 'ASR architectures', domain: 'Speech', imp: 5, ivr: 5, state: 'CONCEPTUAL', conf: 0.35, ind: false, deps: ['feature-representation', 'transformer-internals'], obj: 'Know what Whisper actually does, layer by layer.', check: 'Draw Whisper encoder-decoder data flow from memory.' },
  { id: 'ctc-seq2seq', name: 'CTC / seq2seq / transducer', domain: 'Speech', imp: 4, ivr: 4, state: 'AWARE', conf: 0.25, ind: false, deps: ['asr-architecture'], obj: 'Understand the alignment problem each one solves.', check: 'Explain the CTC blank symbol and why the loss marginalises alignments.' },
  { id: 'asr-finetuning', name: 'ASR fine-tuning', domain: 'Speech', imp: 5, ivr: 5, state: 'AWARE', conf: 0.2, ind: false, deps: ['ctc-seq2seq', 'finetuning'], obj: 'The headline artifact: one real adaptation run, honestly evaluated.', check: 'Fine-tune an ASR model on a protected split and defend every choice.' },
  { id: 'wer-eval', name: 'WER & speech evaluation', domain: 'Speech', imp: 5, ivr: 4, state: 'APPLIED', conf: 0.7, ind: true, deps: ['eval-methodology'], obj: 'Extend to script-normalised and entity-weighted scoring.', check: 'Implement WER with script normalisation from scratch.' },
  { id: 'indic-adaptation', name: 'Indic / Hinglish adaptation', domain: 'Speech', imp: 5, ivr: 5, state: 'CONCEPTUAL', conf: 0.5, ind: null, deps: ['asr-finetuning', 'wer-eval'], obj: 'Turn existing corpus knowledge into a measured adaptation result.', check: 'Explain why canonicalisation is ill-posed for code-switched text, then measure it.' },
  { id: 'speech-model-internals', name: 'Speech model internals', domain: 'Speech', imp: 4, ivr: 4, state: 'AWARE', conf: 0.25, ind: false, deps: ['asr-architecture'], obj: 'Get below the API boundary you have been working above.', check: 'Explain Whisper decoder loops as a decoding artefact, mechanistically.' },
];

export const seedSkills: Skill[] = SEED_SKILLS.map(skill);

/* ───────────────────────── primary project ───────────────────────── */

const ms = (id: string, title: string, mine: string, agentOk: string) => ({
  id,
  title,
  done: false,
  mine,
  agentOk,
});

const seedProjects: Project[] = [
  {
    id: 'indic-asr-lab',
    name: 'Indic ASR Adaptation Lab',
    stage: 'Proposed',
    primary: true,
    objective:
      'Take an existing Indian-language / Hinglish ASR model and run a genuine adaptation experiment end to end — dataset, protected split, baseline, fine-tune, error analysis, quantisation, serving, write-up.',
    develops: ['pytorch', 'training-loops', 'finetuning', 'asr-finetuning', 'gpu-memory', 'quantization', 'model-serving'],
    proves: ['asr-finetuning', 'indic-adaptation', 'wer-eval', 'training-loops'],
    evaluation:
      'WER and entity accuracy on a protected split that never touched training, with the split carved agent-atomically. Report the negative case if adaptation hurts code-switched utterances.',
    artifact: 'Reproducible GitHub repo: data card, training script, eval harness, benchmark table, write-up.',
    resumeValue: 'Converts "speech pipeline engineer" into "speech model engineer" with a measured result.',
    interviewValue: 'A deep-dive project with real numbers, a protected split and an honest negative finding.',
    researchPotential: 'Feeds the script-aware evaluation paper; a CALCS-style short paper is the cheapest publication path.',
    milestones: [
      ms('m1', 'Dataset preparation + data card', 'Write the loader and the data card yourself.', 'Boilerplate download scripts.'),
      ms('m2', 'Protected evaluation split (leakage-checked)', 'Design the barriers; verify speaker-level leakage is zero yourself.', 'Nothing — this is the integrity core.'),
      ms('m3', 'Baseline measurement + WER harness', 'Implement WER with script normalisation from scratch.', 'Plotting and table formatting.'),
      ms('m4', 'First real GPU training run', 'Write the training loop from an empty file.', 'Environment setup, driver debugging.'),
      ms('m5', 'Fine-tune + experiment tracking', 'Own the hyperparameter decisions and log them.', 'Tracking wiring.'),
      ms('m6', 'Error analysis + hyperparameter experiments', 'Do the error taxonomy by hand on real samples.', 'Aggregation scripts.'),
      ms('m7', 'Quantization + inference benchmark (latency/throughput/VRAM)', 'Compute the VRAM budget on paper first, then measure.', 'Benchmark harness scaffolding.'),
      ms('m8', 'Serving + technical write-up', 'Write every word of the analysis.', 'Dockerfile, CI.'),
    ],
  },
  {
    id: 'attention-from-scratch',
    name: 'Transformer from scratch (educational)',
    stage: 'Proposed',
    objective:
      'A readable, tested, from-memory implementation of attention → block → tiny model, each piece diffed against the PyTorch reference.',
    develops: ['attention-math', 'transformer-internals', 'pytorch', 'autograd'],
    proves: ['attention-math', 'transformer-internals'],
    evaluation: 'Numerical agreement with torch reference implementations, within tolerance, with shape assertions.',
    artifact: 'GitHub repo with a notebook per concept and a test suite.',
    resumeValue: 'The single clearest signal that model-level understanding is real and not agent-produced.',
    interviewValue: 'Directly answers "implement attention" and "explain every dimension".',
    milestones: [
      ms('t1', 'Scaled dot-product attention, no AI', 'All of it, from an empty file.', 'Nothing.'),
      ms('t2', 'Multi-head + shape assertions', 'All of it.', 'Nothing.'),
      ms('t3', 'Full block (norm, residual, MLP)', 'All of it.', 'Test scaffolding.'),
      ms('t4', 'Tiny model trained on a toy corpus', 'The training loop.', 'Data plumbing.'),
      ms('t5', 'KV cache + measured decode speedup', 'Cache implementation and the benchmark.', 'Charting.'),
    ],
  },
];

/* ───────────────────────── reading queue ───────────────────────── */

const seedResources: Resource[] = [
  { id: 'r-autograd', title: 'PyTorch autograd mechanics (official)', url: 'https://pytorch.org/docs/stable/notes/autograd.html', reason: 'Blocks the training loop milestone — you cannot debug a None gradient without it.', state: 'needed-now', skillIds: ['autograd', 'pytorch'] },
  { id: 'r-annotated', title: 'The Annotated Transformer', url: 'https://nlp.seas.harvard.edu/annotated-transformer/', reason: 'Reference to diff your from-scratch attention against — read after you implement, not before.', state: 'supporting-build', skillIds: ['transformer-internals', 'attention-math'] },
  { id: 'r-karpathy', title: 'Karpathy — Let\'s build GPT (video + repo)', url: 'https://github.com/karpathy/nanoGPT', reason: 'The closest thing to the artifact you want to produce yourself. Watch once, then build without it open.', state: 'supporting-build', skillIds: ['transformer-training', 'training-loops'] },
  { id: 'r-attention', title: 'Attention Is All You Need', url: 'https://arxiv.org/abs/1706.03762', reason: 'Read for the exact equation you will implement, not for history.', state: 'needed-now', skillIds: ['attention-math'] },
  { id: 'r-lora', title: 'LoRA: Low-Rank Adaptation of Large Language Models', url: 'https://arxiv.org/abs/2106.09685', reason: 'You will implement the adapter from this equation, so read it before the fine-tune milestone.', state: 'later', skillIds: ['lora'] },
  { id: 'r-vllm', title: 'Efficient Memory Management for LLM Serving (PagedAttention)', url: 'https://arxiv.org/abs/2309.06180', reason: 'Deferred on purpose: it only makes sense after you have implemented a KV cache and felt the fragmentation problem.', state: 'later', skillIds: ['vllm', 'kv-cache'] },
  { id: 'r-whisper', title: 'Robust Speech Recognition via Large-Scale Weak Supervision (Whisper)', url: 'https://arxiv.org/abs/2212.04356', reason: 'The model you are adapting. Read the architecture and the decoding section closely.', state: 'needed-now', skillIds: ['asr-architecture', 'speech-model-internals'] },
  { id: 'r-ctc', title: 'Sequence Modeling with CTC (distill.pub)', url: 'https://distill.pub/2017/ctc/', reason: 'The alignment problem, explained well enough to derive. Needed before ASR fine-tuning.', state: 'supporting-build', skillIds: ['ctc-seq2seq'] },
];

/* ───────────────────────── interview domains ───────────────────────── */

const IV: [string, string, number, number, number, number][] = [
  ['iv-python', 'Python coding', 3, 2, 3, 2],
  ['iv-dsa', 'DSA', 2, 1, 2, 1],
  ['iv-backend', 'Backend engineering', 4, 3, 4, 3],
  ['iv-apis', 'APIs', 4, 4, 4, 4],
  ['iv-db', 'Databases', 3, 2, 3, 3],
  ['iv-networking', 'Networking', 2, 1, 2, 2],
  ['iv-os', 'Operating systems', 2, 1, 2, 2],
  ['iv-concurrency', 'Concurrency', 2, 1, 2, 2],
  ['iv-distsys', 'Distributed systems', 2, 1, 3, 2],
  ['iv-ml', 'ML fundamentals', 3, 1, 3, 2],
  ['iv-stats', 'Statistics', 3, 2, 3, 3],
  ['iv-transformers', 'Transformers', 2, 1, 2, 1],
  ['iv-pytorch', 'PyTorch', 1, 1, 1, 1],
  ['iv-finetune', 'Fine-tuning', 2, 1, 2, 1],
  ['iv-inference', 'LLM inference', 2, 1, 2, 1],
  ['iv-gpu', 'GPU systems', 1, 1, 1, 1],
  ['iv-quant', 'Quantization', 1, 1, 2, 1],
  ['iv-rag', 'RAG', 5, 5, 5, 5],
  ['iv-agents', 'Agents', 4, 4, 4, 4],
  ['iv-eval', 'Evaluation', 5, 4, 5, 5],
  ['iv-speech', 'Speech AI', 4, 3, 4, 4],
  ['iv-aisysdesign', 'AI system design', 4, 3, 4, 4],
  ['iv-sysdesign', 'General system design', 3, 2, 3, 3],
  ['iv-deepdive', 'Project deep dives', 5, 5, 5, 4],
  ['iv-behavioural', 'Leadership / behavioural', 4, 4, 4, 4],
];

const seedInterview: InterviewDomain[] = IV.map(([id, name, k, i, e, c]) => ({
  id,
  name,
  knowledge: k,
  implementation: i,
  explanation: e,
  confidence: c,
  evidenceIds: [],
}));

/* ───────────────────────── story bank ───────────────────────── */

const story = (id: string, title: string, category: string, followUps: string[]): Story => ({
  id,
  title,
  category,
  situation: '',
  problem: '',
  constraints: '',
  decision: '',
  alternatives: '',
  implementation: '',
  result: '',
  lesson: '',
  owned: '',
  followUps,
});

const seedStories: Story[] = [
  story('s-metric', 'A metric that stopped carrying information', 'Correcting a misleading ML metric', ['What would you have replaced it with?', 'How would you detect this earlier next time?']),
  story('s-leakage', 'Speaker leakage in a protected split', 'Leakage prevention', ['Why agent-atomic and not random?', 'How did you verify zero leakage?']),
  story('s-channel', 'Channel-split versus neural diarization', 'Speech pipeline architecture', ['n=8 — why should I believe it?', 'Where does the failure mode move to?']),
  story('s-cost', 'Running a paid-API research programme under budget guards', 'Cost optimisation', ['What would you do if the vendor under-reported usage?']),
  story('s-negative', 'Falsifying my own pseudo-labelling result', 'Negative experimental result', ['What made you re-run at full scale?', 'What would have happened if you had not?']),
  story('s-compliance', 'Fail-closed compliance grading', 'Compliance AI architecture', ['Why is a false negative worse here?', 'What did the applicability measurement change?']),
  story('s-supply', 'A correct filter, starved of metadata', 'Production debugging', ['How did the mechanism report itself healthy?']),
  story('s-ambiguity', 'Turning a vague marketing ask into an attribution pipeline', 'Business ambiguity → engineering', ['What did you refuse to build?']),
  story('s-multiagent', 'Running a multi-agent audit across a codebase', 'Leading a technical effort', ['How did you prevent conflicting edits?']),
];

/* ───────────────────────── roadmap ───────────────────────── */

const seedRoadmap: RoadmapPhase[] = [
  {
    id: 'p1',
    window: 'Day 0–30',
    theme: 'PyTorch, autograd and training fundamentals',
    artifacts: ['tensor exercises', 'autograd experiments', 'MLP from scratch', 'training loop from an empty file', 'scaled dot-product attention'],
    skillIds: ['pytorch', 'backprop', 'autograd', 'optimization', 'training-loops', 'attention-math'],
  },
  {
    id: 'p2',
    window: 'Day 31–60',
    theme: 'Transformers, fine-tuning and GPU reasoning',
    artifacts: ['tiny transformer', 'tokenizer study', 'LoRA experiment', 'VRAM calculations verified against nvidia-smi', 'first real adaptation run'],
    skillIds: ['transformer-internals', 'transformer-training', 'finetuning', 'lora', 'gpu-memory'],
  },
  {
    id: 'p3',
    window: 'Day 61–90',
    theme: 'Speech adaptation, evaluation and inference',
    artifacts: ['protected speech eval set', 'ASR baseline', 'fine-tune + error analysis', 'KV cache + inference benchmark', 'technical write-up'],
    skillIds: ['asr-finetuning', 'wer-eval', 'indic-adaptation', 'kv-cache', 'inference-internals', 'model-serving'],
  },
];

/* ───────────────────────── the initial state ───────────────────────── */

export const SCHEMA_VERSION = 1;

export function seedState(): LearningState {
  return {
    version: SCHEMA_VERSION,
    target: {
      northStar: 'Senior AI Systems / Model Engineering',
      spike: 'Indic speech + evaluation + model adaptation + inference',
      companies: ['Sarvam AI', 'AI4Bharat-adjacent labs', 'Indic speech / LLM infra teams'],
      notes:
        'Keep the existing strength — architecting and shipping AI systems inside real constraints — while closing the model-level gap. The transformation is additive, not a replacement.',
    },
    skills: seedSkills,
    evidence: [],
    projects: seedProjects,
    resources: seedResources,
    interview: seedInterview,
    stories: seedStories,
    sessions: [],
    reassessments: [],
    roadmap: seedRoadmap,
    currentSkillId: 'pytorch',
    todayFocus: [
      'Implement scaled dot-product attention from an empty file — no assistant.',
      'Explain every tensor dimension out loud before running it.',
      'Diff the output against torch.nn.functional.scaled_dot_product_attention.',
    ],
  };
}
