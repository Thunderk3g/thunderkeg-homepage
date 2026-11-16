'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { polePosition, quantise, readout } from './dimensions';
import { layoutRows, topThreshold, valueAt, type Pt } from './geometry';
import type { DimensionInfo, PinState, TaskInfo } from './protocol';
import { Session } from './session';
import type { SimPools } from './sim';
import { ApiSource, SimSource } from './sources';
import { LocalTransport, WsTransport } from './transport';
import type { EngineSettings } from './engine';
import { DIAL_DEPTH, Overlay, labelRadius, webX, type DialVariant } from './ui/Overlay';
import { TextRow, type GutterVariant, type RowView } from './ui/Rows';
import './steer.css';

/**
 * The steerable canvas: a writing surface where the text is shaped while it is
 * generated. One component; the backend is whatever `wsUrl` points at, or an
 * engine in the page when there is none.
 *
 *   <SteerableCanvas />                                  page engine, simulated or this site's model
 *   <SteerableCanvas wsUrl="ws://host:8017/ws" />        the Python backend (proxy focus monitor, Tier B)
 *
 * It needs a sized parent; it fills it.
 */

export interface SteerableCanvasProps {
  /** a steering backend's WebSocket; when it cannot be reached the canvas runs in the page */
  wsUrl?: string;
  /** the page engine's two endpoints */
  configUrl?: string;
  generateUrl?: string;
  /** start on this task (an id from the dimensions file) and, optionally, this text */
  task?: string;
  seed?: string;
  /** called with the visible text each time it comes to rest */
  onText?: (text: string) => void;
  /** take keyboard focus on mount; for a page that is nothing but the canvas */
  autoFocus?: boolean;
  className?: string;
}

interface HostConfig {
  dimensions: DimensionInfo[];
  tasks: TaskInfo[];
  sim: SimPools;
  llm: boolean;
  model: string | null;
  engine: Partial<EngineSettings>;
}

type Mode = 'ws' | 'api' | 'sim';

const LH = 20;
const PAD_X = 14;
const PAD_Y = 16;
const GUT_WIDE = 136;
const GUT_NARROW = 96;
const MAX_COLS = 76;
const DIALS: DialVariant[] = ['arc', 'ticks', 'segments'];
const GUTTERS: GutterVariant[] = ['heat', 'bar', 'weight'];

const stored = <T extends string>(key: string, allowed: readonly T[], fallback: T): T => {
  try {
    const v = window.localStorage.getItem(key) as T | null;
    return v && allowed.includes(v) ? v : fallback;
  } catch {
    return fallback;
  }
};
const store = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private mode: the choice lasts for the visit */
  }
};

const HELP: [string, string][] = [
  ['drag a ring', 'turn that dial; the ring in hand is drawn in full'],
  ['↑ ↓  or  1–6', 'choose a dial'],
  ['← →', 'step the dial one quantum'],
  ['backspace', 'return the dial to unset'],
  ['drag the bar,  [ ]  , .', 'scrub: back truncates, forward restores'],
  ['m', 'more: write one more stretch past the end'],
  ['select text, then p', 'pin the phrase (an attention lock)'],
  ['click a pinned phrase', 'release it'],
  ['drag a lock in the gutter', "change the lock's weight"],
  ['enter', 'commit everything visible'],
  ['r', 'another sample under the same controls'],
  ['esc', 'stop generating'],
];

export function SteerableCanvas({ wsUrl, configUrl = '/api/steer/config', generateUrl = '/api/steer/generate', task, seed, onText, autoFocus, className }: SteerableCanvasProps) {
  const [host, setHost] = useState<HostConfig | null>(null);
  const [hostError, setHostError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  /* ── what is available, and which backend to start on ── */

  useEffect(() => {
    let live = true;
    fetch(configUrl)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((cfg: HostConfig) => {
        if (!live) return;
        setHost(cfg);
        setMode((m) => m ?? (wsUrl ? 'ws' : cfg.llm ? 'api' : 'sim'));
      })
      .catch((err) => {
        if (!live) return;
        setHostError(String(err instanceof Error ? err.message : err));
        if (wsUrl) setMode((m) => m ?? 'ws');
      });
    return () => {
      live = false;
    };
  }, [configUrl, wsUrl]);

  const modes = useMemo<Mode[]>(() => [...(wsUrl ? (['ws'] as Mode[]) : []), ...(host?.llm ? (['api'] as Mode[]) : []), ...(host ? (['sim'] as Mode[]) : [])], [wsUrl, host]);

  useEffect(() => {
    if (!mode) return;
    if (mode !== 'ws' && !host) return;
    const s = new Session();
    if (mode === 'ws' && wsUrl) {
      s.attach(
        new WsTransport(wsUrl, s.receive, (reason) => {
          if (!host) return setNote(`backend ${reason}`);
          setNote(`backend ${reason}; running in the page`);
          setMode(host.llm ? 'api' : 'sim');
        }),
      );
    } else if (host) {
      const source = mode === 'api' ? new ApiSource(generateUrl, host.model) : new SimSource(host.sim, host.dimensions);
      // only the hosted model needs the gentler settings; the simulated source costs nothing
      s.attach(new LocalTransport(source, host.dimensions, host.tasks, s.receive, mode === 'api' ? host.engine : {}));
    }
    setSession(s);
    return () => s.close();
  }, [mode, host, wsUrl, generateUrl]);

  if (!session) {
    return (
      <div className={'stc stc-empty ' + (className ?? '')}>
        <span>{hostError && !wsUrl ? `steering config unavailable (${hostError})` : 'connecting…'}</span>
      </div>
    );
  }
  return (
    <Canvas
      key={session.id}
      session={session}
      mode={mode!}
      modes={modes}
      onMode={(m) => {
        setNote(null);
        setMode(m);
      }}
      note={note}
      task={task}
      seed={seed}
      onText={onText}
      autoFocus={autoFocus}
      className={className}
    />
  );
}

interface CanvasProps {
  session: Session;
  mode: Mode;
  modes: Mode[];
  onMode: (m: Mode) => void;
  note: string | null;
  task?: string;
  seed?: string;
  onText?: (text: string) => void;
  autoFocus?: boolean;
  className?: string;
}

function Canvas({ session, mode, modes, onMode, note, task, seed, onText, autoFocus, className }: CanvasProps) {
  const version = useSyncExternalStore(session.subscribe, session.getVersion, session.getVersion);
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const follow = useRef(true);
  const seeded = useRef(false);

  const [size, setSize] = useState({ w: 0, h: 0, ch: 7.8 });
  const [scrollTop, setScrollTop] = useState(0);
  const [active, setActive] = useState<string | null>(null);
  const [dialVariant, setDialVariant] = useState<DialVariant>('arc');
  const [gutterVariant, setGutterVariant] = useState<GutterVariant>('heat');
  const [help, setHelp] = useState(false);
  const [seedOpen, setSeedOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [held, setHeld] = useState<Pt | null>(null);
  const [selection, setSelection] = useState<{ start: number; end: number; x: number; y: number } | null>(null);
  const [scrubbing, setScrubbing] = useState(false);

  useEffect(() => {
    setDialVariant(stored('stc.dial', DIALS, 'arc'));
    setGutterVariant(stored('stc.gutter', GUTTERS, 'heat'));
    if (autoFocus) rootRef.current?.focus({ preventScroll: true });
  }, []);

  /* ── size: the stage, and the width of one character ── */

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () => {
      const probe = probeRef.current;
      const ch = probe ? probe.getBoundingClientRect().width / 20 : 7.8;
      setSize((prev) => (prev.w === stage.clientWidth && prev.h === stage.clientHeight && Math.abs(prev.ch - ch) < 0.01 ? prev : { w: stage.clientWidth, h: stage.clientHeight, ch: ch || 7.8 }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(stage);
    // the web font arrives after first paint and changes the character width
    document.fonts?.ready.then(measure).catch(() => undefined);
    return () => ro.disconnect();
  }, []);

  const narrow = size.w > 0 && size.w < 620;
  const gut = narrow ? GUT_NARROW : GUT_WIDE;
  const cols = Math.max(24, Math.min(MAX_COLS, Math.floor((size.w - gut - PAD_X * 2) / size.ch) || MAX_COLS));

  /* ── the session: seed once the backend has said what it offers ── */

  const config = session.config;
  const state = session.state;
  const dims = useMemo(() => config?.dimensions ?? [], [config]);
  const tasks = config?.tasks ?? [];

  useEffect(() => {
    if (!config || seeded.current || size.w === 0) return;
    seeded.current = true;
    const chosen = config.tasks.find((t) => t.id === task) ?? config.tasks[0];
    session.seed(seed ?? chosen?.seed ?? '', chosen?.id ?? null, cols);
    setActive(config.dimensions[0]?.name ?? null);
  }, [config, size.w]);

  useEffect(() => {
    if (seeded.current) session.layout(cols);
  }, [cols, session]);

  useEffect(() => {
    if (onText && state && !state.generating) onText(session.tokens.join(''));
  }, [state?.generating, version]);

  /* ── rows ── */

  const visible = session.tokens.length;
  const committed = state?.committed ?? 0;
  const anchor = Math.min(state?.anchor ?? visible, visible);
  const generating = !!state?.generating;
  const pins: PinState[] = state?.pins ?? [];
  const attention = session.attention;

  const { views, cursor, zoneLabel } = useMemo(() => {
    const all = session.ghost.length ? [...session.tokens, ...session.ghost] : session.tokens;
    const laid = layoutRows(all, cols, visible);
    const scores = attention?.tok_scores ?? [];
    const under = topThreshold(scores.slice(0, visible), 0.06);
    const pinOf = new Map<number, { id: string; edge: string }>();
    const lockAt = new Map<number, { id: string; weight: number }>();
    for (const p of pins) {
      if (p.end_tok > visible) continue;
      for (let i = p.start_tok; i < p.end_tok; i++) {
        const first = i === p.start_tok;
        const last = i === p.end_tok - 1;
        pinOf.set(i, { id: p.id, edge: first && last ? 'b' : first ? 'o' : last ? 'c' : 'm' });
      }
      const row = laid.lineOf[p.start_tok];
      if (row != null && !lockAt.has(row)) lockAt.set(row, { id: p.id, weight: p.weight });
    }
    // a line's score: the server's when its lines are ours, otherwise the sum of its tokens' scores
    const rowCount = laid.rows.length;
    let lineScores: number[] = [];
    const server = attention?.line_scores ?? [];
    const visibleRows = visible ? laid.lineOf[visible - 1] + 1 : 0;
    if (server.length === visibleRows && !session.ghost.length) {
      lineScores = server;
    } else {
      const sums = new Array<number>(rowCount).fill(0);
      for (let i = 0; i < Math.min(scores.length, visible); i++) sums[laid.lineOf[i]] += scores[i];
      const top = Math.max(...sums, 0) || 1;
      lineScores = sums.map((v) => v / top);
    }
    const topLine = topThreshold(lineScores, 0.1);
    const anchorRow = anchor < visible ? laid.lineOf[anchor] : laid.cursor.row;
    const lastRow = rowCount - 1;

    const out: RowView[] = laid.rows.map((row, index) => {
      let tone = '';
      let u = '';
      let edge = '';
      const rowPins: (string | null)[] = [];
      const cells = new Array<number>(10).fill(0);
      for (let i = row.start; i < row.end; i++) {
        const j = i - row.start;
        tone += i >= visible ? 'g' : i < committed ? 'k' : i < anchor ? 'a' : 's';
        const score = i < visible ? (scores[i] ?? 0) : 0;
        u += score >= 0.4 && score >= under ? '1' : '0';
        const pin = pinOf.get(i);
        rowPins.push(pin?.id ?? null);
        edge += pin?.edge ?? '-';
        if (score > 0 && row.shown[j]) {
          // the cell a token falls in is the tenth of the column it starts in
          const from = Math.min(9, Math.floor((row.cols[j] / cols) * 10));
          const to = Math.min(9, Math.floor(((row.cols[j] + row.shown[j].length - 1) / cols) * 10));
          const level = score >= 0.65 ? 3 : score >= 0.35 ? 2 : score >= 0.12 ? 1 : 0;
          for (let c = from; c <= to; c++) cells[c] = Math.max(cells[c], level);
        }
      }
      const score = index < visibleRows ? (lineScores[index] ?? 0) : 0;
      const top = score > 0 && score >= topLine;
      const zone: RowView['zone'] = index >= anchorRow && index <= lastRow && visible > committed ? (generating ? 'live' : 'steer') : 'none';
      const lock = lockAt.get(index) ?? null;
      const number = (index + 1) % 5 === 0 ? index + 1 : null;
      const sig = [row.start, row.end, row.shown.join(''), tone, u, edge, rowPins.join(','), cells.join(''), top ? 1 : 0, score.toFixed(2), lock ? `${lock.id}${lock.weight}` : '', zone].join('|');
      return { index, row, tokens: all, tone, under: u, pins: rowPins, pinEdge: edge, cells: cells.join(''), top, score, lock, zone, number, sig };
    });
    const label = visible > anchor ? `rewrites L${anchorRow + 1}–${(visible ? laid.lineOf[visible - 1] : 0) + 1}` : `writes from L${laid.cursor.row + 1}`;
    return { views: out, cursor: laid.cursor, zoneLabel: label };
    // the session's arrays are mutated in place; `version` is what says they changed
  }, [version, cols, committed, anchor, generating]);

  /* ── where the instrument hangs ── */

  const count = dims.length || 6;
  const scale = Math.max(0.58, Math.min(1, (size.h * 0.46) / DIAL_DEPTH, size.w / 900));
  const depth = DIAL_DEPTH * scale + 10;
  const rl = labelRadius(count, scale);
  const webFits = size.w >= 2 * (rl + 70) + (webX(count, scale) - rl) + 196;
  const headX = gut + PAD_X + cursor.col * size.ch;
  const headTop = PAD_Y + cursor.row * LH - scrollTop;
  const minX = Math.min(size.w / 2, rl + 70);
  const maxX = Math.max(minX, size.w - (webFits ? webX(count, scale) + 196 : rl + 70));
  const center: Pt = held ?? { x: Math.max(minX, Math.min(maxX, headX)), y: headTop + LH };
  const inView = center.y > LH && center.y < size.h - 24;

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (follow.current) el.scrollTop = el.scrollHeight - el.clientHeight;
    if (Math.abs(el.scrollTop - scrollTop) > 0.5) setScrollTop(el.scrollTop);
  });

  /* ── gestures ── */

  const dimOf = useCallback((name: string | null) => dims.find((d) => d.name === name) ?? null, [dims]);

  const onRingDown = useCallback(
    (dim: string, e: ReactPointerEvent) => {
      const stage = stageRef.current;
      if (!stage) return;
      e.preventDefault();
      rootRef.current?.focus({ preventScroll: true });
      setActive(dim);
      const at = { ...center };
      setHeld(at);
      const rect = stage.getBoundingClientRect();
      let next: number | null = null;
      let frame = 0;
      const apply = (ev: PointerEvent | ReactPointerEvent) => {
        next = valueAt(at, ev.clientX - rect.left, ev.clientY - rect.top);
        if (!frame) {
          frame = requestAnimationFrame(() => {
            frame = 0;
            if (next != null) session.setDial(dim, Math.round(next * 1000) / 1000);
          });
        }
      };
      apply(e);
      const move = (ev: PointerEvent) => apply(ev);
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
        setHeld(null);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    },
    [center, session],
  );

  const stepDial = useCallback(
    (dir: number) => {
      const d = dimOf(active);
      if (!d) return;
      const current = session.dial(d.name);
      const base = current == null ? 0.5 : quantise(d, current);
      const first = current == null && d.kind === 'blend';
      session.setDial(d.name, Math.min(1, Math.max(0, quantise(d, base) + (first ? 0 : dir / d.steps))));
    },
    [active, dimOf, session],
  );

  const scrubTo = useCallback((position: number) => session.scrub(Math.max(0, Math.round(position))), [session]);
  const cachedLen = state?.cached_len ?? visible;
  const more = useCallback(() => scrubTo(cachedLen + (config?.horizon ?? 120)), [scrubTo, cachedLen, config]);

  const readSelection = useCallback(() => {
    const sel = window.getSelection();
    const stage = stageRef.current;
    if (!sel || sel.isCollapsed || !stage || !sel.rangeCount) return setSelection(null);
    const range = sel.getRangeAt(0);
    if (!stage.contains(range.commonAncestorContainer)) return setSelection(null);
    let start = Infinity;
    let end = -1;
    stage.querySelectorAll<HTMLElement>('[data-i]').forEach((el) => {
      if (!sel.containsNode(el, true)) return;
      // a token that is only touched at its edge is not part of the phrase
      const own = document.createRange();
      own.selectNodeContents(el.lastElementChild ?? el);
      if (range.compareBoundaryPoints(Range.END_TO_START, own) >= 0 || range.compareBoundaryPoints(Range.START_TO_END, own) <= 0) return;
      const i = Number(el.dataset.i);
      start = Math.min(start, i);
      end = Math.max(end, i + 1);
    });
    end = Math.min(end, visible);
    if (end <= start) return setSelection(null);
    const box = range.getBoundingClientRect();
    const frame = stage.getBoundingClientRect();
    setSelection({ start, end, x: Math.min(frame.width - 60, Math.max(8, box.right - frame.left + 6)), y: box.top - frame.top - 4 });
  }, [visible]);

  const pinSelection = useCallback(() => {
    if (!selection) return;
    session.pin(selection.start, selection.end, 0.5);
    window.getSelection()?.removeAllRanges();
    setSelection(null);
  }, [selection, session]);

  const onStagePointerDown = (e: ReactPointerEvent) => {
    const lock = (e.target as HTMLElement).closest<HTMLElement>('[data-lock]');
    const pin = lock?.dataset.lock ? pins.find((p) => p.id === lock.dataset.lock) : null;
    if (!pin) return;
    e.preventDefault();
    const y0 = e.clientY;
    let frame = 0;
    let weight = pin.weight;
    const move = (ev: PointerEvent) => {
      weight = Math.round(Math.min(1, Math.max(0.05, pin.weight + (y0 - ev.clientY) / 110)) * 100) / 100;
      if (!frame) {
        frame = requestAnimationFrame(() => {
          frame = 0;
          session.pin(pin.start_tok, pin.end_tok, weight, pin.id);
        });
      }
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const onStageClick = (e: React.MouseEvent) => {
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) return;
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-pin]');
    if (el?.dataset.pin) session.unpin(el.dataset.pin);
  };

  const onStageDoubleClick = (e: React.MouseEvent) => {
    const lock = (e.target as HTMLElement).closest<HTMLElement>('[data-lock]');
    if (lock?.dataset.lock) session.unpin(lock.dataset.lock);
  };

  const onKeyDown = (e: ReactKeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'INPUT' || e.metaKey || e.ctrlKey) return;
    const names = dims.map((d) => d.name);
    const at = Math.max(0, names.indexOf(active ?? ''));
    const handled = () => e.preventDefault();
    switch (e.key) {
      case 'ArrowUp':
        setActive(names[(at - 1 + names.length) % names.length]);
        return handled();
      case 'ArrowDown':
        setActive(names[(at + 1) % names.length]);
        return handled();
      case 'ArrowLeft':
        stepDial(-1);
        return handled();
      case 'ArrowRight':
        stepDial(1);
        return handled();
      case 'Backspace':
      case 'Delete':
        if (active) session.setDial(active, null);
        return handled();
      case '[':
        scrubTo(visible - 8);
        return handled();
      case ']':
        scrubTo(visible + 8);
        return handled();
      case ',':
        scrubTo(visible - 1);
        return handled();
      case '.':
        scrubTo(visible + 1);
        return handled();
      case 'Home':
        scrubTo(committed);
        return handled();
      case 'End':
        scrubTo(cachedLen);
        return handled();
      case 'm':
        more();
        return handled();
      case 'Enter':
        session.commit();
        return handled();
      case 'r':
        session.reroll();
        return handled();
      case 'p':
        pinSelection();
        return handled();
      case 'Escape':
        if (help || seedOpen) {
          setHelp(false);
          setSeedOpen(false);
        } else session.stop();
        return handled();
      case '?':
        setHelp((h) => !h);
        return handled();
      default:
        if (/^[1-9]$/.test(e.key) && names[Number(e.key) - 1]) {
          setActive(names[Number(e.key) - 1]);
          handled();
        }
    }
  };

  /* ── the scrub bar ── */

  const span = Math.max(cachedLen, state?.target ?? 0, visible, 1);
  const barRef = useRef<HTMLDivElement>(null);
  const onBarDown = (e: ReactPointerEvent) => {
    const bar = barRef.current;
    if (!bar) return;
    e.preventDefault();
    rootRef.current?.focus({ preventScroll: true });
    setScrubbing(true);
    const rect = bar.getBoundingClientRect();
    let last = -1;
    const apply = (clientX: number) => {
      const p = Math.max(committed, Math.round(Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) * span));
      if (p !== last) {
        last = p;
        session.scrub(p);
      }
    };
    apply(e.clientX);
    const move = (ev: PointerEvent) => apply(ev.clientX);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setScrubbing(false);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const onWheelScrub = (e: React.WheelEvent) => {
    if (e.deltaY === 0) return;
    scrubTo(visible + (e.deltaY > 0 ? 4 : -4));
  };
  const share = (n: number) => `${(Math.min(span, Math.max(0, n)) / span) * 100}%`;

  /* ── the footer ── */

  const t = session.telemetry;
  const paint = session.paint;
  const sorted = [...paint].sort((a, b) => a - b);
  const q = (p: number) => (sorted.length ? Math.round(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]) : 0);
  // what is writing, and where the engine runs: "sim · no model · in page", "api · <model> · host:8017"
  const backend = config
    ? `${config.backend === 'sim' ? 'sim · no model' : `${config.backend}${config.model ? ` · ${config.model}` : ''}${config.tier === 'B' ? ' · tier B' : ''}`} · ${session.label}`
    : '…';
  const error = session.error && Date.now() - session.error.at < 8000 ? session.error.message : null;

  const record = () => {
    const done = session.toggleRecording();
    if (!done) return;
    const body = { name: `recorded-${new Date().toISOString().slice(0, 19)}`, seed: done.seed, task: done.task, events: done.events };
    const url = URL.createObjectURL(new Blob([JSON.stringify(body, null, 1)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${body.name.replace(/[:]/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const reseed = (text: string, taskId: string | null) => {
    follow.current = true;
    session.seed(text, taskId, cols);
    setSeedOpen(false);
    rootRef.current?.focus({ preventScroll: true });
  };

  const values: Record<string, number | null> = {};
  for (const d of dims) values[d.name] = session.dial(d.name);
  const activeName = active ?? dims[0]?.name ?? '';

  return (
    <div
      ref={rootRef}
      className={'stc ' + (narrow ? 'stc-narrow ' : '') + (className ?? '')}
      tabIndex={0}
      onKeyDown={onKeyDown}
      style={{ ['--gut' as string]: `${gut}px`, ['--ch' as string]: `${size.ch}px`, ['--cell' as string]: narrow ? '3px' : '5px' }}
      role="application"
      aria-label="Steerable writing canvas"
    >
      <header className="stc-top">
        <span className="stc-title">steerable canvas</span>
        <label className="stc-pick">
          <span>task</span>
          <select
            value={session.task ?? ''}
            onChange={(e) => {
              const next = tasks.find((x) => x.id === e.target.value);
              if (next) reseed(next.seed, next.id);
            }}
          >
            {tasks.map((x) => (
              <option key={x.id} value={x.id}>
                {x.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={seedOpen ? 'on' : ''}
          onClick={() => {
            setDraft(session.seedText);
            setSeedOpen((o) => !o);
          }}
        >
          seed
        </button>
        <span className="stc-fill" />
        <span className="stc-swatch" title="three looks for the dial">
          <span>dial</span>
          {DIALS.map((v) => (
            <button
              key={v}
              type="button"
              className={v === dialVariant ? 'on' : ''}
              onClick={() => {
                setDialVariant(v);
                store('stc.dial', v);
              }}
            >
              {v}
            </button>
          ))}
        </span>
        <span className="stc-swatch" title="three looks for the attention gutter">
          <span>gutter</span>
          {GUTTERS.map((v) => (
            <button
              key={v}
              type="button"
              className={v === gutterVariant ? 'on' : ''}
              onClick={() => {
                setGutterVariant(v);
                store('stc.gutter', v);
              }}
            >
              {v}
            </button>
          ))}
        </span>
        <button type="button" className={help ? 'on' : ''} onClick={() => setHelp((h) => !h)} aria-label="Keys and gestures">
          ?
        </button>
      </header>

      <div className="stc-stage" ref={stageRef} onPointerDown={onStagePointerDown} onClick={onStageClick} onDoubleClick={onStageDoubleClick} onWheel={(e) => e.altKey && onWheelScrub(e)}>
        <span className="stc-probe" ref={probeRef} aria-hidden="true">
          00000000000000000000
        </span>
        <div
          className="stc-scroll"
          ref={scrollRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            follow.current = el.scrollTop >= el.scrollHeight - el.clientHeight - 4;
            setScrollTop(el.scrollTop);
          }}
          onMouseUp={readSelection}
          onKeyUp={readSelection}
        >
          <div className="stc-lines" style={{ padding: `${PAD_Y}px ${PAD_X}px ${depth}px 0` }}>
            {views.map((view) => (
              <TextRow key={view.index} view={view} variant={gutterVariant} />
            ))}
            <span className={'stc-cursor' + (generating ? '' : ' idle')} style={{ left: gut + PAD_X + cursor.col * size.ch, top: PAD_Y + cursor.row * LH }} />
          </div>
        </div>

        {dims.length > 0 && inView && (
          <Overlay
            width={size.w}
            height={size.h}
            center={center}
            head={{ x: headX + size.ch / 2, y: headTop + LH / 2 }}
            scale={scale}
            dims={dims}
            values={values}
            active={activeName}
            variant={dialVariant}
            showWeb={webFits}
            zone={zoneLabel}
            generating={generating}
            held={held != null}
            onRingDown={onRingDown}
            onSelect={(d) => {
              setActive(d);
              rootRef.current?.focus({ preventScroll: true });
            }}
            onPole={(d, pole) => {
              const dim = dimOf(d);
              if (dim) session.setDial(d, polePosition(dim, pole));
            }}
            onUnset={(d) => session.setDial(d, null)}
          />
        )}

        {selection && (
          <button type="button" className="stc-pinit" style={{ left: selection.x, top: Math.max(4, selection.y - 18) }} onMouseDown={(e) => e.preventDefault()} onClick={pinSelection}>
            pin
          </button>
        )}

        {seedOpen && (
          <div className="stc-panel">
            <p>The text the session starts from. Everything in it is committed; the model writes on from its end.</p>
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={7} spellCheck={false} autoFocus />
            <div>
              <button type="button" onClick={() => reseed(draft, session.task)}>
                start from this
              </button>
              <button type="button" onClick={() => setSeedOpen(false)}>
                cancel
              </button>
            </div>
          </div>
        )}

        {help && (
          <div className="stc-panel stc-help" onClick={() => setHelp(false)}>
            <dl>
              {HELP.map(([keys, what]) => (
                <div key={keys}>
                  <dt>{keys}</dt>
                  <dd>{what}</dd>
                </div>
              ))}
            </dl>
            <p>
              Text before the knob is kept; a control change rewrites what follows it. The gutter shows where the model is looking
              {config ? ` (${config.attention_source === 'heuristic' ? 'here a lexical heuristic, not attention' : config.attention_source})` : ''}.
            </p>
          </div>
        )}
      </div>

      {!webFits && dims.length > 0 && (
        <div className="stc-chips">
          {dims.map((d) => (
            <button key={d.name} type="button" className={d.name === activeName ? 'on' : values[d.name] == null ? 'unset' : ''} onClick={() => setActive(d.name)}>
              {d.name}
              {values[d.name] != null && <span> {readout(d, values[d.name])}</span>}
            </button>
          ))}
        </div>
      )}

      <div className={'stc-scrub' + (scrubbing ? ' on' : '')} onWheel={onWheelScrub}>
        <span className="stc-scrub-end">{committed}</span>
        <div className="stc-track" ref={barRef} onPointerDown={onBarDown} role="slider" aria-label="Main knob: token position" aria-valuemin={committed} aria-valuemax={span} aria-valuenow={visible}>
          <i className="stc-seg-horizon" style={{ width: share(span) }} />
          <i className="stc-seg-cached" style={{ width: share(cachedLen) }} />
          <i className="stc-seg-visible" style={{ width: share(visible) }} />
          <i className="stc-seg-kept" style={{ width: share(anchor) }} />
          <i className="stc-seg-committed" style={{ width: share(committed) }} />
          <i className="stc-anchor" style={{ left: share(anchor) }} title="regeneration starts here" />
          <i className="stc-knob" style={{ left: share(visible) }} />
        </div>
        <span className="stc-scrub-end">{span}</span>
        <button type="button" onClick={more} title="write one more stretch past the end (m)">
          more
        </button>
      </div>

      <footer className="stc-foot">
        <span title="tokens per second of the stream now on screen; a display token is about a word">
          <b>{t ? Math.round(t.tok_s) : 0}</b> tok/s
        </span>
        <span title={`gesture to painted text, measured in this browser · p50 ${q(0.5)} ms · p95 ${q(0.95)} ms over ${paint.length} gestures · engine: p50 ${t?.latency_p50 ?? 0} ms, p95 ${t?.latency_p95 ?? 0} ms`}>
          <b>{Math.round(session.lastPaint)}</b> ms
          <em>
            {' '}
            p50 {q(0.5)} · p95 {q(0.95)}
          </em>
        </span>
        <span>
          ¶ <b>{t?.paragraphs ?? 0}</b>
        </span>
        <span>
          <b>{visible}</b> tok
        </span>
        <span title="branch switches: control changes that rewrote the text">
          steer <b>{t?.steer ?? 0}</b>
        </span>
        <span title="speculative branches generated ahead of need">
          sim <b>{t?.sim ?? 0}</b>
        </span>
        <span title={`${t?.cache_hits ?? 0} hits, ${t?.cache_misses ?? 0} misses, ${t?.branches ?? 0} branches held, ${t?.cancelled ?? 0} requests cancelled`}>
          cache <b>{t ? Math.round(t.hit_rate * 100) : 0}%</b>
        </span>
        <span>
          <b>{session.fps}</b> fps
        </span>
        {(session.stale > 0 || (t?.orphans ?? 0) > 0) && (
          <span className="warn" title="tokens that arrived for a branch no longer current were dropped; orphans are requests that outlived a cancel">
            stale <b>{session.stale}</b> · orphans <b>{t?.orphans ?? 0}</b>
          </span>
        )}
        <span className="stc-fill" />
        {(error || note) && <span className="warn">{error ?? note}</span>}
        <span title="where the focus monitor's scores come from">focus {config?.attention_source ?? '…'}</span>
        <button type="button" className={session.recording ? 'on' : ''} onClick={record} title="record gestures; stopping saves a file the latency harness replays">
          {session.recording ? `rec ${session.recording.events.length}` : 'rec'}
        </button>
        <button
          type="button"
          onClick={() => modes.length > 1 && onMode(modes[(modes.indexOf(mode) + 1) % modes.length])}
          disabled={modes.length < 2}
          title={modes.length > 1 ? `backend: ${modes.join(' / ')} — click to switch` : 'the only backend available here'}
        >
          {backend}
        </button>
      </footer>
    </div>
  );
}

export default SteerableCanvas;
