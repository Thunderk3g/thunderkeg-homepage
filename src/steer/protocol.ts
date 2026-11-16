/**
 * Every message between the canvas and a steering backend. This mirrors
 * steering/steerable/protocol.py field for field; the Python file is the
 * reference and says what each message is for.
 */

export interface DimensionInfo {
  name: string;
  kind: 'bipolar' | 'blend';
  /** quanta along the arc; branches are cached per quantum */
  steps: number;
  description: string;
  poles: { name: string; description: string }[];
}

export interface TaskInfo {
  id: string;
  label: string;
  seed: string;
  /** the simulated backend can write this one */
  sim?: boolean;
}

/* ───────────────────────── client -> server ───────────────────────── */

export type ClientMsg =
  | { type: 'set_dial'; dim: string; value: number | null; pole?: string; seq?: number }
  | { type: 'pin'; start_tok: number; end_tok: number; weight: number; id?: string; seq?: number }
  | { type: 'unpin'; id: string; seq?: number }
  | { type: 'scrub'; position_tok: number; seq?: number }
  | { type: 'seed'; text: string; task?: string | null; cols?: number; seq?: number }
  | { type: 'stop'; seq?: number }
  | { type: 'commit'; seq?: number }
  | { type: 'reroll'; seq?: number }
  | { type: 'layout'; cols: number };

/* ───────────────────────── server -> client ───────────────────────── */

export interface TokensMsg {
  type: 'tokens';
  branch_id: string;
  from_tok: number;
  tokens: string[];
}

export interface AttentionMsg {
  type: 'attention';
  line_scores: number[];
  tok_scores: number[];
  /** heuristic | proxy:<model> | model */
  source: string;
}

export interface InvalidateMsg {
  type: 'invalidate';
  from_tok: number;
  /** every later `tokens` message must carry this id or be dropped */
  branch_id: string;
  cause_seq?: number | null;
  cached: boolean;
  reason: 'switch' | 'scrub' | 'seed';
}

export interface TelemetryMsg {
  type: 'telemetry';
  tok_s: number;
  latency_ms: number;
  steer: number;
  sim: number;
  tokens: number;
  paragraphs: number;
  cache_hits: number;
  cache_misses: number;
  hit_rate: number;
  branches: number;
  cancelled: number;
  inflight: number;
  orphans: number;
  latency_p50: number;
  latency_p95: number;
}

export interface PinState {
  id: string;
  start_tok: number;
  end_tok: number;
  weight: number;
  text: string;
}

export interface StateMsg {
  type: 'state';
  committed: number;
  /** where regeneration starts from */
  anchor: number;
  scrub: number;
  visible: number;
  /** tokens that exist on this path, including any hidden beyond the knob */
  cached_len: number;
  target: number;
  generating: boolean;
  variant: number;
  dials: Record<string, number | null>;
  /** the quantised values the engine actually steers with */
  quantised: Record<string, number>;
  pins: PinState[];
  active_dim?: string | null;
}

export interface ConfigMsg {
  type: 'config';
  backend: string;
  /** sim | A | B */
  tier: string;
  model?: string | null;
  attention_source: string;
  dimensions: DimensionInfo[];
  tasks: TaskInfo[];
  horizon: number;
  cols: number;
  frame_ms: number;
}

export interface ErrorMsg {
  type: 'error';
  message: string;
  retry_after?: number | null;
}

export type ServerMsg = TokensMsg | AttentionMsg | InvalidateMsg | TelemetryMsg | StateMsg | ConfigMsg | ErrorMsg;
