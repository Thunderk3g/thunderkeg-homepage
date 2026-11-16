'use client';

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { dominant, readout, weights } from '../dimensions';
import { arcPath, pointAt, type Pt } from '../geometry';
import type { DimensionInfo } from '../protocol';

/**
 * Everything drawn over the text: the crosshair, the steering web and the
 * stack of dials. It hangs from the head line, so the instrument is always
 * where the next words will appear and never on top of words already written.
 *
 * Greyscale throughout; the one accent marks what is active: the handle of the
 * dial in hand, its chosen pole, its node in the web.
 */

export type DialVariant = 'arc' | 'ticks' | 'segments';

export const RING_0 = 84;
export const RING_GAP = 15;
/** how far below the head line the instrument reaches, before scaling */
export const DIAL_DEPTH = RING_0 + 5 * RING_GAP + 20 + 26;
const LABEL_PAD = 20;
const WEB_OFFSET = 86;
const WEB_STEP = 21;

export const ringRadius = (i: number, scale: number) => (RING_0 + i * RING_GAP) * scale;
export const labelRadius = (count: number, scale: number) => (RING_0 + (count - 1) * RING_GAP + LABEL_PAD) * scale;
/** where the web's column of nodes starts, measured from the dial's centre */
export const webX = (count: number, scale: number) => labelRadius(count, scale) + WEB_OFFSET * scale;

const O: Pt = { x: 0, y: 0 };
const pct = (w: number) => `${Math.round(w * 100)}%`;

/**
 * The dial positions as drawn: each eases toward where its dial was set, so a
 * keyboard step or a click on a pole glides instead of jumping. The dial under
 * the hand (`direct`) is never eased: it stays exactly on the pointer.
 */
function useEased(dims: readonly DimensionInfo[], values: Record<string, number | null>, direct: string | null): Record<string, number | null> {
  const shown = useRef<Record<string, number | null>>({ ...values });
  const target = useRef(values);
  const [, redraw] = useState(0);
  const frame = useRef(0);
  target.current = values;
  const key = dims.map((d) => values[d.name] ?? 'x').join(',') + '|' + (direct ?? '');

  useEffect(() => {
    const step = () => {
      frame.current = 0;
      let moving = false;
      for (const d of dims) {
        const to = target.current[d.name] ?? null;
        let from = shown.current[d.name] ?? null;
        // a bipolar dial that has just been set swings out from its neutral centre
        if (from == null && to != null && d.kind === 'bipolar') from = 0.5;
        if (to == null || from == null || d.name === direct || Math.abs(to - from) < 0.003) {
          shown.current[d.name] = to;
        } else {
          shown.current[d.name] = from + (to - from) * 0.3;
          moving = true;
        }
      }
      redraw((n) => n + 1);
      if (moving) frame.current = requestAnimationFrame(step);
    };
    if (!frame.current) frame.current = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
    // `key` is the values and the dial in hand, flattened: the objects themselves change every render
  }, [key, dims]);

  const still = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  return still ? values : shown.current;
}

export interface OverlayProps {
  width: number;
  height: number;
  /** the active point: the dial's centre, on the bottom edge of the head line */
  center: Pt;
  /** the middle of the block cursor */
  head: Pt;
  scale: number;
  dims: readonly DimensionInfo[];
  /** where each dial sits; null is unset */
  values: Record<string, number | null>;
  active: string;
  variant: DialVariant;
  showWeb: boolean;
  /** which lines the active dial rewrites, e.g. "L4–9" */
  zone: string;
  generating: boolean;
  /** the hand is on a dial: the instrument holds still */
  held: boolean;
  onRingDown: (dim: string, e: ReactPointerEvent) => void;
  onSelect: (dim: string) => void;
  onPole: (dim: string, pole: string) => void;
  onUnset: (dim: string) => void;
}

function ActiveRing({ dim, value, r, variant, scale }: { dim: DimensionInfo; value: number | null; r: number; variant: DialVariant; scale: number }) {
  const n = dim.poles.length;
  const poleAt = (k: number) => (dim.kind === 'bipolar' ? k : k / (n - 1));
  const handle = value == null ? null : pointAt(O, r, value);
  const w = value == null ? {} : weights(dim, value);

  if (variant === 'ticks') {
    const ticks = [];
    for (let k = 0; k <= dim.steps; k++) {
      const v = k / dim.steps;
      const major = dim.poles.some((_, j) => Math.abs(poleAt(j) - v) < 1e-6) || (dim.kind === 'bipolar' && k * 2 === dim.steps);
      const len = (major ? 6 : 3) * scale;
      const a = pointAt(O, r - len, v);
      const b = pointAt(O, r + len, v);
      ticks.push(<line key={k} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={major ? 'stc-tick major' : 'stc-tick'} />);
    }
    return (
      <g>
        {ticks}
        {handle && (
          <>
            <line x1={handle.x * 0.72} y1={handle.y * 0.72} x2={handle.x} y2={handle.y} className="stc-needle" />
            <rect x={handle.x - 3.5} y={handle.y - 3.5} width={7} height={7} className="stc-handle" />
          </>
        )}
      </g>
    );
  }

  if (variant === 'segments') {
    const band = 9 * scale;
    const gap = 0.012;
    const segs =
      dim.kind === 'bipolar'
        ? [
            { pole: dim.poles[0].name, from: 0, to: 0.5 },
            { pole: dim.poles[1].name, from: 0.5, to: 1 },
          ]
        : dim.poles.map((p, k) => ({ pole: p.name, from: Math.max(0, (k - 0.5) / (n - 1)), to: Math.min(1, (k + 0.5) / (n - 1)) }));
    const tip = handle ? [pointAt(O, r - band * 0.9, value!), pointAt(O, r + band * 0.9, value!)] : null;
    return (
      <g>
        {segs.map((s) => (
          <g key={s.pole}>
            <path d={arcPath(O, r, s.from + gap, s.to - gap)} className="stc-seg" strokeWidth={band} />
            {w[s.pole] != null && <path d={arcPath(O, r, s.from + gap, s.to - gap)} className="stc-seg on" strokeWidth={band} strokeOpacity={0.25 + 0.75 * w[s.pole]} />}
          </g>
        ))}
        {tip && <line x1={tip[0].x} y1={tip[0].y} x2={tip[1].x} y2={tip[1].y} className="stc-needle thick" />}
      </g>
    );
  }

  // arc: a line, the stretch from neutral to the value drawn brighter, a dot for the hand
  const from = dim.kind === 'bipolar' ? 0.5 : value == null ? 0 : Math.max(0, value - 0.035);
  const to = dim.kind === 'bipolar' ? (value ?? 0.5) : value == null ? 0 : Math.min(1, value + 0.035);
  return (
    <g>
      <path d={arcPath(O, r)} className="stc-ring active" />
      {value != null && Math.abs(to - from) > 1e-3 && <path d={arcPath(O, r, Math.min(from, to), Math.max(from, to))} className="stc-ring lit" />}
      {dim.poles.map((p, k) => {
        const a = pointAt(O, r - 4 * scale, poleAt(k));
        const b = pointAt(O, r + 4 * scale, poleAt(k));
        return <line key={p.name} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="stc-tick major" />;
      })}
      {handle && (
        <>
          <circle cx={handle.x} cy={handle.y} r={9} className="stc-halo" />
          <circle cx={handle.x} cy={handle.y} r={4.5} className="stc-handle" />
        </>
      )}
    </g>
  );
}

export function Overlay(props: OverlayProps) {
  const { width, height, center, head, scale, dims, active, variant, showWeb, zone, generating, held } = props;
  const values = useEased(dims, props.values, held ? active : null);
  const count = dims.length;
  const rl = labelRadius(count, scale);
  const x0 = webX(count, scale);
  const activeDim = dims.find((d) => d.name === active) ?? dims[0];
  const activeValue = activeDim ? (values[activeDim.name] ?? null) : null;
  const top = activeDim && activeValue != null ? dominant(activeDim, activeValue) : null;
  // The instrument eases to the head, except when the head moves down: lagging
  // then would leave it over the line just written, so it goes at once.
  const lastY = useRef(center.y);
  const down = center.y > lastY.current + 0.5;
  useEffect(() => {
    lastY.current = center.y;
  });
  const style: CSSProperties = { transform: `translate(${center.x}px, ${center.y}px)`, transition: held || down ? 'none' : undefined };
  const hx = head.x - center.x;
  const hy = head.y - center.y;

  return (
    <svg className="stc-overlay" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <g className="stc-instrument" style={style}>
        {/* crosshair: faint rules through the active point */}
        <line x1={-center.x} y1={0} x2={width - center.x} y2={0} className="stc-cross" />
        <line x1={0} y1={-center.y} x2={0} y2={height - center.y} className="stc-cross" />

        {/* the steering web: one ray per dimension, from the cursor to its node */}
        {showWeb &&
          dims.map((d, i) => {
            const y = (18 + i * WEB_STEP) * scale;
            const v = values[d.name] ?? null;
            const on = d.name === active;
            const lead = v == null ? null : dominant(d, v);
            const label = v == null ? '—' : readout(d, v) + (on && d.kind === 'bipolar' && lead ? ` ${pct(lead.weight)}` : '');
            return (
              <g key={d.name} className={'stc-node' + (on ? ' on' : v == null ? ' unset' : '')} onClick={() => props.onSelect(d.name)} onDoubleClick={() => props.onUnset(d.name)}>
                <line x1={hx} y1={hy} x2={x0} y2={y} className={'stc-ray' + (on && generating ? ' live' : '')} />
                <circle cx={x0} cy={y} r={on ? 3.5 : 2.25} className="stc-dot" />
                <text x={x0 + 10} y={y + 4}>
                  <tspan className="stc-node-name">{d.name}: </tspan>
                  {label}
                </text>
                <rect x={x0 - 8} y={y - WEB_STEP * scale * 0.5} width={190} height={WEB_STEP * scale} className="stc-hit" />
              </g>
            );
          })}

        {/* the stack: every dial has a ring; the one in hand is drawn in full */}
        {dims.map((d, i) => {
          const r = ringRadius(i, scale);
          const v = values[d.name] ?? null;
          const on = d.name === active;
          const mark = v == null ? null : [pointAt(O, r - 3.5 * scale, v), pointAt(O, r + 3.5 * scale, v)];
          return (
            <g key={d.name} className="stc-dial">
              {on ? (
                <ActiveRing dim={d} value={v} r={r} variant={variant} scale={scale} />
              ) : (
                <>
                  <path d={arcPath(O, r)} className={'stc-ring' + (v == null ? ' unset' : ' set')} />
                  {mark && <line x1={mark[0].x} y1={mark[0].y} x2={mark[1].x} y2={mark[1].y} className="stc-mark" />}
                </>
              )}
              <path
                d={arcPath(O, r)}
                className="stc-hit ring"
                strokeWidth={RING_GAP * scale}
                onPointerDown={(e) => props.onRingDown(d.name, e)}
                onDoubleClick={() => props.onUnset(d.name)}
              >
                <title>{`${d.name}: ${d.poles.map((p) => p.name).join(' · ')}`}</title>
              </path>
            </g>
          );
        })}

        {/* the poles of the dial in hand; the chosen one in an accent chip */}
        {activeDim &&
          activeDim.poles.map((p, k) => {
            const v = activeDim.kind === 'bipolar' ? k : k / (activeDim.poles.length - 1);
            const at = pointAt(O, rl, v);
            const side = Math.cos(Math.PI * (1 - v));
            const anchor = side < -0.3 ? 'end' : side > 0.3 ? 'start' : 'middle';
            const chosen = top?.pole === p.name;
            const w = p.name.length * 6.7 + 10;
            const tx = at.x + (anchor === 'end' ? -4 : anchor === 'start' ? 4 : 0);
            const ty = at.y + (anchor === 'middle' ? 12 : 4) + (v === 0 || v === 1 ? 6 : 0);
            const bx = anchor === 'end' ? tx - w + 5 : anchor === 'start' ? tx - 5 : tx - w / 2;
            // a faint spoke ties the label to its tick on the ring in hand, across the rings between
            const ringR = ringRadius(dims.indexOf(activeDim), scale);
            const s0 = pointAt(O, ringR + 7 * scale, v);
            const s1 = pointAt(O, rl - 5 * scale, v);
            return (
              <g key={p.name} className={'stc-pole' + (chosen ? ' on' : '')} onClick={() => props.onPole(activeDim.name, p.name)}>
                {s1.y - s0.y + Math.abs(s1.x - s0.x) > 8 && <line x1={s0.x} y1={s0.y} x2={s1.x} y2={s1.y} className="stc-spoke" />}
                <rect x={bx} y={ty - 11} width={w} height={15} className="stc-chip" />
                <text x={tx} y={ty} textAnchor={anchor}>
                  {p.name}
                </text>
                <title>{p.description}</title>
              </g>
            );
          })}

        {/* the readout: what the dial in hand holds, and which lines it rewrites */}
        {activeDim && (
          <g className="stc-readout">
            <text x={0} y={22 * scale} textAnchor="middle" className="name">
              {activeDim.name}
            </text>
            <text x={0} y={22 * scale + 17} textAnchor="middle" className="value">
              {activeValue == null ? 'unset' : readout(activeDim, activeValue) + (activeDim.kind === 'bipolar' && top ? ` ${pct(top.weight)}` : '')}
            </text>
            <text x={0} y={22 * scale + 33} textAnchor="middle" className={'zone' + (generating ? ' live' : '')}>
              {zone}
            </text>
          </g>
        )}
      </g>
    </svg>
  );
}
