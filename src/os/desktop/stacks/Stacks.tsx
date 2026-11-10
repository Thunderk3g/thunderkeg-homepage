'use client';

import { useEffect, useRef, useState } from 'react';
import { useOS } from '../../store';
import { isPhone, prefersReducedMotion } from '../layout';
import { KIND_LABEL, type CubeKind } from '@/data/record';
import { MAX_CUBES, cubesAsOf, type Board, type Cube, type Lane, type Stack } from '@/stacks/model';
import { useBoard, useStacksView } from '@/stacks/useBoard';

/**
 * The board, drawn over whichever wallpaper is chosen. One canvas, from
 * src/stacks/model.ts.
 *
 *   lane          one field, its name on the plate at the near end
 *   stack         one subject
 *   cube          one dated thing: built, measured, studied or wrote,
 *                 oldest at the bottom
 *   outline       a paper saved to the Research inbox, not read yet
 *   dashed lot    a subject I follow and have nothing on yet
 *   lit cap       the top cube was added this month
 *   coral diamond recall cards due today on that stack's papers
 *
 * Cubes go up in the order they happened when the desktop appears, and move
 * afterwards only when the data behind them changes or the timeline asks for
 * an earlier year. Hovering a cube reads it out, clicking opens it. The
 * canvas is decoration for assistive tech: the same record is the Stacks app
 * and the /stacks page.
 */

interface Shade {
  top: string;
  left: string;
  right: string;
}
const SHADES: Record<CubeKind, Shade> = {
  built: { top: '#a9c4ff', left: '#4a7af0', right: '#2f55c0' },
  measured: { top: '#ffe0a3', left: '#eaa93a', right: '#b57a1e' },
  studied: { top: '#e2c2ff', left: '#b06ae8', right: '#8145bd' },
  wrote: { top: '#9ff5e1', left: '#34bfa5', right: '#228a78' },
};

/** cube height and half-width, in cells */
const CUBE_H = 0.46;
const HALF_W = 0.72;
/** inbox outlines drawn on a stack; the rest are counted in the readout */
const QUEUED_SHOWN = 2;

interface Geo {
  U: number;
  ox: number;
  oy: number;
}

/** grid point → screen */
const P = (g: Geo, a: number, b: number): [number, number] => [g.ox + (a - b) * g.U, g.oy + ((a + b) * g.U) / 2];

/** how far the tallest thing rises above the board's back corner, in px */
function lift(board: Board, U: number): number {
  let px = 0;
  for (const s of board.stacks) {
    const n = Math.min(MAX_CUBES, s.cubes.length) + Math.min(QUEUED_SHOWN, s.queued.length);
    px = Math.max(px, n * CUBE_H * U + 30 - ((s.gx + s.gy) * U) / 2);
  }
  return px;
}

/**
 * Scale and place the board in the free part of the desktop: right of the
 * launcher icons, above the timeline, and clear of the welcome card, which
 * sits in the corner below the board's near-right edge.
 */
function fit(board: Board, vw: number, vh: number, panelH: number, phone: boolean): Geo {
  const left = phone ? 12 : 196;
  const right = vw - (phone ? 12 : 28);
  const top = panelH + 14;
  const bottom = vh - (phone ? 20 : 92);
  const span = board.w + board.h;
  let U = Math.max(12, Math.min(58, (right - left) / span));
  while (U > 12 && lift(board, U) + (span * U) / 2 > bottom - top) U *= 0.97;

  const card = phone ? null : document.querySelector('.kos-welcome')?.getBoundingClientRect();
  for (let i = 0; i < 40; i++) {
    const up = lift(board, U);
    const height = (span * U) / 2;
    let ox = left + Math.max(0, (right - left - span * U) * 0.5) + board.h * U;
    const oy = top + up + Math.max(0, (bottom - top - up - height) * 0.45);
    if (!card || card.width === 0) return { U, ox, oy };
    // how far the near-right edge dips below the card's top-left corner
    const over = (x: number) => {
      const rx = x + board.w * U;
      const ry = oy + (board.w * U) / 2;
      if (rx <= card.left - 16) return 0;
      const fx = x + (board.w - board.h) * U;
      return ry + (rx - Math.max(card.left - 16, fx)) / 2 - (card.top - 16);
    };
    const slack = ox - board.h * U - left;
    ox -= Math.max(0, Math.min(slack, over(ox) * 2));
    if (over(ox) <= 0 || U <= 14) return { U, ox, oy };
    U *= 0.97;
  }
  return { U, ox: left + board.h * U, oy: top + lift(board, U) };
}

function poly(ctx: CanvasRenderingContext2D, pts: [number, number][]) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

/** footprint of one stack, and the height of one of its cubes */
function foot(g: Geo, s: Stack) {
  const [cx, cy] = P(g, s.gx, s.gy);
  const hw = g.U * HALF_W;
  const unit = g.U * CUBE_H * Math.min(1, MAX_CUBES / Math.max(1, s.cubes.length));
  return { cx, cy, hw, hh: hw / 2, unit, wire: g.U * CUBE_H };
}

function inside(pts: [number, number][], x: number, y: number) {
  let hit = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/** the outline of a box standing on the footprint, from `from` px up to `to` px */
function hull(cx: number, cy: number, hw: number, hh: number, from: number, to: number): [number, number][] {
  return [
    [cx - hw, cy - to], [cx, cy - hh - to], [cx + hw, cy - to],
    [cx + hw, cy - from], [cx, cy + hh - from], [cx - hw, cy - from],
  ];
}

/* ───────────────────────── lanes ───────────────────────── */

const TINT = '150, 170, 255';

function drawLane(ctx: CanvasRenderingContext2D, g: Geo, lane: Lane, board: Board, alpha: number, hot: boolean, font: string) {
  const t = g.U * 0.11; // the tile has a little thickness, so the lanes read as plates
  const a = P(g, lane.x0, lane.y0);
  const b = P(g, lane.x1, lane.y0);
  const c = P(g, lane.x1, lane.y1);
  const d = P(g, lane.x0, lane.y1);

  poly(ctx, [d, c, [c[0], c[1] + t], [d[0], d[1] + t]]);
  ctx.fillStyle = `rgba(40, 50, 120, ${0.55 * alpha})`;
  ctx.fill();
  poly(ctx, [c, b, [b[0], b[1] + t], [c[0], c[1] + t]]);
  ctx.fillStyle = `rgba(28, 36, 96, ${0.6 * alpha})`;
  ctx.fill();

  poly(ctx, [a, b, c, d]);
  ctx.fillStyle = `rgba(${TINT}, ${(hot ? 0.13 : 0.075) * alpha})`;
  ctx.fill();
  ctx.strokeStyle = `rgba(${TINT}, ${(hot ? 0.6 : 0.26) * alpha})`;
  ctx.lineWidth = 1;
  ctx.stroke();

  // the name plate
  poly(ctx, [P(g, board.apron.x0, lane.y0), b, c, P(g, board.apron.x0, lane.y1)]);
  ctx.fillStyle = `rgba(${TINT}, ${(hot ? 0.16 : 0.09) * alpha})`;
  ctx.fill();

  const edge = Math.hypot(1, 0.5) * g.U; // screen length of one cell edge
  const size = Math.max(9.5, Math.min(13.5, g.U * 0.31));
  const room = (board.apron.x1 - board.apron.x0) * edge - size * 1.3;
  ctx.save();
  const [px, py] = P(g, board.apron.x0, lane.y0);
  const k = 1 / Math.hypot(1, 0.5);
  ctx.transform(k, k * 0.5, -k, k * 0.5, px, py);
  ctx.font = `700 ${size}px ${font}`;
  ctx.textBaseline = 'top';
  const lines: string[] = [];
  let line = '';
  for (const word of lane.field.name.split(' ')) {
    const next = line ? line + ' ' + word : word;
    if (line && ctx.measureText(next).width > room) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  const lh = size * 1.2;
  const y0 = Math.max(size * 0.5, ((lane.y1 - lane.y0) * edge - lines.length * lh) / 2);
  ctx.fillStyle = hot ? `rgba(255, 255, 255, ${alpha})` : `rgba(214, 222, 255, ${0.82 * alpha})`;
  lines.slice(0, 3).forEach((l, i) => ctx.fillText(l, size * 0.65, y0 + i * lh));
  ctx.restore();
}

/* ───────────────────────── stacks ───────────────────────── */

function drawStack(
  ctx: CanvasRenderingContext2D,
  g: Geo,
  s: Stack,
  shown: number,
  hot: boolean,
  hotCube: number,
  now: boolean,
  pulse: number,
) {
  const { cx, hw, hh, unit, wire } = foot(g, s);
  let { cy } = foot(g, s);
  if (hot) cy -= 3;
  const H = shown * unit;

  if (shown < 0.04) {
    // an empty lot: a subject with nothing on it yet (or not yet, at this year)
    poly(ctx, [[cx - hw, cy], [cx, cy - hh], [cx + hw, cy], [cx, cy + hh]]);
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = hot ? 'rgba(220, 228, 255, 0.95)' : `rgba(${TINT}, ${s.cubes.length ? 0.22 : 0.4})`;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.setLineDash([]);
  } else {
    const count = Math.ceil(shown - 1e-6);
    for (let i = 0; i < count; i++) {
      const sh = SHADES[s.cubes[i].kind];
      const from = i * unit;
      const to = Math.min(H, from + unit);
      poly(ctx, [[cx - hw, cy - from], [cx, cy + hh - from], [cx, cy + hh - to], [cx - hw, cy - to]]);
      ctx.fillStyle = sh.left;
      ctx.fill();
      poly(ctx, [[cx, cy + hh - from], [cx + hw, cy - from], [cx + hw, cy - to], [cx, cy + hh - to]]);
      ctx.fillStyle = sh.right;
      ctx.fill();
    }
    // seams between the cubes
    ctx.strokeStyle = 'rgba(8, 10, 30, 0.42)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < count; i++) {
      const y = cy - i * unit;
      ctx.moveTo(cx - hw, y);
      ctx.lineTo(cx, y + hh);
      ctx.lineTo(cx + hw, y);
    }
    ctx.stroke();

    const topCube = s.cubes[count - 1];
    poly(ctx, [[cx - hw, cy - H], [cx, cy - hh - H], [cx + hw, cy - H], [cx, cy + hh - H]]);
    ctx.fillStyle = SHADES[topCube.kind].top;
    ctx.fill();
    if (now && topCube.recent && !hot) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    if (hot) {
      poly(ctx, hull(cx, cy, hw, hh, 0, H));
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = 1;
      ctx.stroke();
      if (hotCube >= 0 && hotCube < count) {
        const from = hotCube * unit;
        const to = Math.min(H, from + unit);
        poly(ctx, hull(cx, cy, hw, hh, from, to));
        ctx.fillStyle = 'rgba(255, 255, 255, 0.26)';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }

  if (!now) return;

  // the inbox: outlines of cubes still to be earned
  const q = Math.min(QUEUED_SHOWN, s.queued.length);
  for (let j = 0; j < q; j++) {
    const from = H + j * wire;
    const lit = hot && hotCube === s.cubes.length + j;
    poly(ctx, hull(cx, cy, hw, hh, from, from + wire));
    if (lit) {
      ctx.fillStyle = 'rgba(226, 194, 255, 0.2)';
      ctx.fill();
    }
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = lit ? '#fff' : 'rgba(226, 194, 255, 0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - hw, cy - from - wire);
    ctx.lineTo(cx, cy + hh - from - wire);
    ctx.lineTo(cx + hw, cy - from - wire);
    ctx.moveTo(cx, cy + hh - from - wire);
    ctx.lineTo(cx, cy + hh - from);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (s.due) {
    const y = cy - hh - H - q * wire - 10 - pulse * 3;
    const r = 4.5;
    poly(ctx, [[cx - r, y], [cx, y - r], [cx + r, y], [cx, y + r]]);
    ctx.fillStyle = `rgba(255, 138, 128, ${0.6 + 0.4 * (1 - pulse)})`;
    ctx.fill();
  }
}

/** "reading now": a flag on a pole, drawn over everything so it is never hidden. */
function drawFlag(ctx: CanvasRenderingContext2D, g: Geo, s: Stack, shown: number, text: string, font: string) {
  const { cx, cy, hh, unit, wire } = foot(g, s);
  const topY = cy - hh - shown * unit - Math.min(QUEUED_SHOWN, s.queued.length) * wire;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx, topY + hh);
  ctx.lineTo(cx, topY - 18);
  ctx.stroke();
  ctx.font = `600 10.5px ${font}`;
  const w = ctx.measureText(text).width;
  ctx.fillStyle = 'rgba(10, 12, 28, 0.78)';
  ctx.beginPath();
  ctx.roundRect(cx + 1, topY - 23, w + 12, 16, 3);
  ctx.fill();
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.fillText(text, cx + 7, topY - 14.5);
}

/** A soft dark pool under the board so it reads the same on a busy wallpaper as on a plain one. */
function drawVeil(ctx: CanvasRenderingContext2D, g: Geo, board: Board, alpha: number) {
  const [lx] = P(g, 0, board.h);
  const [rx] = P(g, board.w, 0);
  const [, ty] = P(g, 0, 0);
  const [, by] = P(g, board.w, board.h);
  const cx = (lx + rx) / 2;
  const cy = (ty + by) / 2 - g.U * 0.6;
  const rxr = (rx - lx) / 2 + g.U * 3;
  const ryr = (by - ty) / 2 + g.U * 3.4;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, ryr / rxr);
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, rxr);
  grad.addColorStop(0, `rgba(8, 10, 30, ${0.74 * alpha})`);
  grad.addColorStop(0.62, `rgba(8, 10, 30, ${0.6 * alpha})`);
  grad.addColorStop(1, 'rgba(8, 10, 30, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, rxr, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/* ───────────────────────── readout ───────────────────────── */

interface Tip {
  stack: Stack;
  /** index into cubes, or cubes.length + j for a queued outline; -1 = the stack as a whole */
  cube: number;
  /** the stack's right edge and its width, so the card can sit on either side */
  x: number;
  y: number;
  w: number;
}

const TIP_ROWS = 7;

function TipCard({ tip }: { tip: Tip }) {
  const { stack, cube } = tip;
  const n = stack.cubes.length;
  // the list mirrors the stack: what is on top is at the top
  const rows: { c: Cube; queued: boolean; index: number }[] = [
    ...stack.queued.map((c, j) => ({ c, queued: true, index: n + j })).reverse(),
    ...stack.cubes.map((c, i) => ({ c, queued: false, index: i })).reverse(),
  ];
  const at = Math.max(0, rows.findIndex((r) => r.index === cube));
  const start = Math.max(0, Math.min(rows.length - TIP_ROWS, at - Math.floor(TIP_ROWS / 2)));
  const view = rows.slice(start, start + TIP_ROWS);
  const picked = rows.find((r) => r.index === cube);

  const height = 74 + view.length * 21 + (picked?.c.detail ? 34 : 0);
  const top = Math.max(44 + height / 2, Math.min(window.innerHeight - height / 2 - 10, tip.y));
  const flip = tip.x > window.innerWidth - 400;
  const hint = !picked
    ? stack.subject.following
      ? 'An area I follow. Papers I read here land on this lot.'
      : 'Click to open the record'
    : picked.c.open?.app === 'research'
      ? 'Click to open the paper in Research'
      : picked.c.open?.app === 'writing'
        ? 'Click to read it in Writing'
        : 'Click to open the record';

  return (
    <div className={'kos-stacks-tip' + (flip ? ' flip' : '')} style={{ left: flip ? tip.x - tip.w : tip.x, top }} aria-hidden="true">
      <span className="kos-stacks-field">{stack.field.name}</span>
      <strong>{stack.subject.name}</strong>
      {!rows.length && <span className="kos-stacks-detail">{stack.subject.blurb}</span>}
      {start > 0 && <span className="kos-stacks-more">{start} newer</span>}
      <ul className="kos-stacks-rows">
        {view.map(({ c, queued, index }) => (
          <li key={c.id} className={(index === cube ? 'on ' : '') + (queued ? 'queued' : 'k-' + c.kind)}>
            <i />
            <span className="t">{c.title}</span>
            <span className="w">{queued ? 'queued' : c.when}</span>
          </li>
        ))}
      </ul>
      {start + TIP_ROWS < rows.length && (
        <span className="kos-stacks-more">{rows.length - start - TIP_ROWS} older</span>
      )}
      {picked && (
        <span className="kos-stacks-detail">
          <b className={picked.queued ? 'queued' : 'k-' + picked.c.kind}>
            {picked.queued ? 'In the Research inbox' : KIND_LABEL[picked.c.kind]}
          </b>
          {picked.c.detail ? ' · ' + picked.c.detail : ''}
        </span>
      )}
      <span className="kos-stacks-hint">
        {stack.due ? `${stack.due} recall card${stack.due === 1 ? '' : 's'} due today. ` : ''}
        {hint}
      </span>
    </div>
  );
}

/* ───────────────────────── component ───────────────────────── */

export function Stacks({ veil = false }: { veil?: boolean }) {
  const launch = useOS((s) => s.launch);
  const reducedSetting = useOS((s) => s.settings.reducedMotion);
  const { board, ready } = useBoard();
  const asOf = useStacksView((s) => s.asOf);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  const live = useRef<{
    board: Board | null;
    geo: Geo | null;
    /** cubes on screen per stack, eased toward the target */
    shown: Map<string, number>;
    /** when each cube is allowed up: the first build goes in the order things happened */
    born: Map<string, number>;
    hot: string | null;
    hotCube: number;
    order: Stack[];
    asOf: number | null;
    veil: boolean;
    kick: () => void;
  }>({ board: null, geo: null, shown: new Map(), born: new Map(), hot: null, hotCube: -1, order: [], asOf: null, veil, kick: () => {} });

  useEffect(() => {
    live.current.veil = veil;
    live.current.kick();
  }, [veil]);

  useEffect(() => {
    live.current.asOf = asOf;
    live.current.kick();
  }, [asOf]);

  // the draw loop: runs while something is moving, then parks
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const L = live.current;
    let raf = 0;
    let lastPulse = 0;
    const still = () => reducedSetting || prefersReducedMotion();
    const font = getComputedStyle(canvas).fontFamily;

    const frame = (now: number) => {
      raf = 0;
      const { board: b, geo: g } = L;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (!b || !g) return;

      let moving = false;
      const first = Math.min(...L.born.values(), now);
      const floorAlpha = still() ? 1 : Math.min(1, (now - first + 300) / 500);
      if (floorAlpha < 1) moving = true;
      if (L.veil) drawVeil(ctx, g, b, floorAlpha);
      const hotStack = L.hot ? L.order.find((s) => s.subject.id === L.hot) : undefined;
      for (const lane of b.lanes) drawLane(ctx, g, lane, b, floorAlpha, lane.field.id === hotStack?.field.id, font);

      const isNow = L.asOf === null;
      const pulse = still() ? 0 : (Math.sin(now / 520) + 1) / 2;
      const settled: [Stack, number][] = [];
      for (const s of L.order) {
        // how many of this stack's cubes may be up yet
        let target = 0;
        const upTo = cubesAsOf(s, L.asOf);
        for (let i = 0; i < upTo; i++) {
          if (still() || now >= (L.born.get(s.cubes[i].id) ?? 0)) target = i + 1;
          else {
            moving = true;
            break;
          }
        }
        let n = L.shown.get(s.subject.id) ?? 0;
        if (still()) n = target;
        else if (Math.abs(target - n) > 0.01) {
          n += (target - n) * 0.17;
          moving = true;
        } else n = target;
        L.shown.set(s.subject.id, n);
        settled.push([s, n]);
      }
      // the marks that describe today wait until the cubes have stopped moving
      const marks = isNow && !moving;
      for (const [s, n] of settled) drawStack(ctx, g, s, n, L.hot === s.subject.id, L.hotCube, marks, pulse);
      if (marks) {
        for (const [s, n] of settled) if (s.reading) drawFlag(ctx, g, s, n, 'reading now', font);
      }

      const beacons = !still() && isNow && b.totals.due > 0 && !document.hidden;
      if (moving) raf = requestAnimationFrame(frame);
      else if (beacons) {
        // the due markers breathe at a few frames a second, nothing more
        const wait = Math.max(0, 90 - (now - lastPulse));
        lastPulse = now + wait;
        window.setTimeout(() => {
          if (!raf) raf = requestAnimationFrame(frame);
        }, wait);
      }
    };

    L.kick = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };
    const refit = () => {
      if (L.board) {
        const panelH = parseFloat(getComputedStyle(canvas).getPropertyValue('--kos-panel-h')) || 34;
        L.geo = fit(L.board, canvas.clientWidth, canvas.clientHeight, panelH, isPhone());
      }
      L.kick();
    };
    const ro = new ResizeObserver(refit);
    ro.observe(canvas);
    document.addEventListener('visibilitychange', L.kick);
    refit();
    return () => {
      ro.disconnect();
      document.removeEventListener('visibilitychange', L.kick);
      if (raf) cancelAnimationFrame(raf);
      L.kick = () => {};
    };
  }, [reducedSetting]);

  // new data: keep what is already standing, raise anything new
  useEffect(() => {
    const L = live.current;
    const canvas = canvasRef.current;
    L.board = ready ? board : null;
    if (!ready || !canvas) return;
    const panelH = parseFloat(getComputedStyle(canvas).getPropertyValue('--kos-panel-h')) || 34;
    L.geo = fit(board, canvas.clientWidth, canvas.clientHeight, panelH, isPhone());
    // painter's order: far cells first
    L.order = [...board.stacks].sort((a, b) => a.gx + a.gy - (b.gx + b.gy) || a.gx - b.gx);
    const now = performance.now();
    if (L.born.size === 0) {
      // first build: the whole record goes up in the order it happened
      const all = board.stacks.flatMap((s) => s.cubes).sort((a, b) => a.at - b.at);
      const step = Math.min(26, 1900 / Math.max(1, all.length));
      all.forEach((c, i) => L.born.set(c.id, now + 380 + i * step));
    } else {
      for (const s of board.stacks) for (const c of s.cubes) if (!L.born.has(c.id)) L.born.set(c.id, now);
    }
    L.kick();
  }, [board, ready]);

  // hover and click, read from the bare desktop only
  useEffect(() => {
    const L = live.current;
    const onDesktop = (t: EventTarget | null) =>
      t instanceof HTMLElement && (t.classList.contains('kos-desktop-surface') || t.classList.contains('kos-desktop-icons'));
    const pick = (x: number, y: number): { stack: Stack; cube: number } | null => {
      if (!L.geo) return null;
      for (let i = L.order.length - 1; i >= 0; i--) {
        const s = L.order[i];
        const f = foot(L.geo, s);
        const n = L.shown.get(s.subject.id) ?? s.cubes.length;
        const q = L.asOf === null ? Math.min(QUEUED_SHOWN, s.queued.length) : 0;
        const H = n * f.unit;
        if (!inside(hull(f.cx, f.cy, f.hw, f.hh, 0, Math.max(H + q * f.wire, 2)), x, y)) continue;
        // height of the pointer above the stack's bottom edge at that x
        const up = f.cy + f.hh - (Math.abs(x - f.cx) * f.hh) / f.hw - y;
        const whole = Math.round(n);
        let cube = -1;
        if (up > H && q) cube = whole + Math.min(q - 1, Math.floor((up - H) / f.wire));
        else if (whole > 0) cube = Math.max(0, Math.min(whole - 1, Math.floor(up / f.unit)));
        return { stack: s, cube };
      }
      return null;
    };
    const setHot = (hit: { stack: Stack; cube: number } | null, surface?: HTMLElement) => {
      const id = hit?.stack.subject.id ?? null;
      const cube = hit?.cube ?? -1;
      if (id === L.hot && cube === L.hotCube) return;
      L.hot = id;
      L.hotCube = cube;
      if (surface) surface.style.cursor = hit ? 'pointer' : '';
      if (hit && L.geo) {
        const f = foot(L.geo, hit.stack);
        const H = (L.shown.get(hit.stack.subject.id) ?? 0) * f.unit;
        setTip({ stack: hit.stack, cube, x: f.cx + f.hw, y: f.cy - H / 2, w: f.hw * 2 });
      } else setTip(null);
      L.kick();
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch' || isPhone()) return;
      if (!onDesktop(e.target)) return setHot(null);
      setHot(pick(e.clientX, e.clientY), document.querySelector<HTMLElement>('.kos-desktop-surface') ?? undefined);
    };
    const onClick = (e: MouseEvent) => {
      if (isPhone() || !onDesktop(e.target)) return;
      const hit = pick(e.clientX, e.clientY);
      if (!hit) return;
      const c = hit.cube < hit.stack.cubes.length ? hit.stack.cubes[hit.cube] : hit.stack.queued[hit.cube - hit.stack.cubes.length];
      if (c?.open) launch(c.open.app, c.open.args);
      else launch('stacks', { subjectId: hit.stack.subject.id });
    };
    const onLeave = () => setHot(null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('click', onClick);
    document.addEventListener('pointerleave', onLeave);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('click', onClick);
      document.removeEventListener('pointerleave', onLeave);
      const surface = document.querySelector<HTMLElement>('.kos-desktop-surface');
      if (surface) surface.style.cursor = '';
    };
  }, [launch]);

  return (
    <>
      <canvas ref={canvasRef} className="kos-stacks" aria-hidden="true" />
      {tip && <TipCard tip={tip} />}
    </>
  );
}
