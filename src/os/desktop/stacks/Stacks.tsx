'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useOS } from '../../store';
import { useEntries } from '../../content';
import { useHydrated, useLearning } from '@/learning/store';
import { useResearch, useResearchHydrated } from '@/research/store';
import { isPhone, prefersReducedMotion } from '../layout';
import { buildCity, type City, type Column, type District } from './model';

/**
 * The live skyline, drawn over whichever wallpaper is chosen. One canvas,
 * from model.ts; columns rise once when the desktop appears and afterwards
 * only when the data behind them changes. Hovering a column names it,
 * clicking opens it in its app. The canvas is decoration for assistive tech:
 * every item is reachable through the apps and the command palette.
 *
 * What the marks mean (also in the legend):
 *   height          depth: knowledge state, reading pass, or length
 *   bright blue     a skill proven without AI
 *   lit cap         touched in the last week
 *   outline above   where the skill being studied is headed
 *   amber diamond   something due today
 */

interface Shade {
  top: string;
  left: string;
  right: string;
}
const SHADES: Record<string, Shade> = {
  skillProven: { top: '#9dbdff', left: '#4173ea', right: '#2b51b8' },
  skill: { top: '#4f63a6', left: '#313f7c', right: '#252f60' },
  paper: { top: '#bda8ff', left: '#7a5cdb', right: '#553aa9' },
  post: { top: '#86f2db', left: '#30b59d', right: '#1f8272' },
};
const shadeOf = (c: Column): Shade =>
  c.kind === 'skill' ? (c.proven === true ? SHADES.skillProven : SHADES.skill) : SHADES[c.kind];

const KIND_LABEL: Record<Column['kind'], string> = { skill: 'Skill', paper: 'Paper', post: 'Post' };
const OPENS_IN: Record<Column['kind'], string> = { skill: 'Learning OS', paper: 'Research', post: 'Writing' };

interface Geo {
  U: number;
  ox: number;
  oy: number;
}

/** grid point → screen */
const P = (g: Geo, a: number, b: number): [number, number] => [g.ox + (a - b) * g.U, g.oy + ((a + b) * g.U) / 2];

/**
 * Scale and place the city in the free part of the desktop: right of the
 * launcher icons, and clear of the welcome card, which sits in the empty
 * corner below the city's near-right edge.
 */
function fit(city: City, vw: number, vh: number, panelH: number, phone: boolean): Geo {
  const left = phone ? 12 : 196;
  const right = vw - (phone ? 12 : 28);
  const top = panelH + 18;
  const bottom = vh - 22;
  const span = city.w + city.h;
  const headroom = 2.9; // tallest stack, in cells
  let U = Math.max(10, Math.min(46, (right - left) / span, (bottom - top) / (span / 2 + headroom + 0.8)));

  const card = phone ? null : document.querySelector('.kos-welcome')?.getBoundingClientRect();
  for (let i = 0; i < 24; i++) {
    const width = span * U;
    const height = (span / 2 + headroom) * U;
    let ox = left + Math.max(0, (right - left - width) * 0.5) + city.h * U;
    const oy = top + Math.max(0, (bottom - top - height) * 0.4) + headroom * U;
    if (!card || card.width === 0) return { U, ox, oy };
    // how far the near-right edge reaches below the card's top-left corner
    // (zero when the city's right corner stops short of the card)
    const over = (cx: number) => {
      const rx = cx + city.w * U;
      return rx <= card.left - 14 ? 0 : oy + (city.w * U) / 2 + (rx - card.left) / 2 - (card.top - 14);
    };
    const slack = ox - city.h * U - left;
    ox -= Math.max(0, Math.min(slack, over(ox) * 2));
    if (over(ox) <= 0 || U <= 14) return { U, ox, oy };
    U *= 0.97;
  }
  return { U, ox: left + city.h * U, oy: top + headroom * U };
}

function poly(ctx: CanvasRenderingContext2D, pts: [number, number][]) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

/** footprint geometry of one column */
function foot(g: Geo, c: Column) {
  const [cx, cy] = P(g, c.gx + 0.5, c.gy + 0.5);
  const hw = g.U * 0.8;
  return { cx, cy, hw, hh: hw / 2, ch: g.U * 0.44 };
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

function silhouette(g: Geo, c: Column, shown: number): [number, number][] {
  const { cx, cy, hw, hh, ch } = foot(g, c);
  const H = Math.max(shown, 0.25) * ch;
  return [
    [cx - hw, cy - H], [cx, cy - hh - H], [cx + hw, cy - H],
    [cx + hw, cy], [cx, cy + hh], [cx - hw, cy],
  ];
}

function floorPath(ctx: CanvasRenderingContext2D, g: Geo, d: District) {
  const m = 0.18;
  poly(ctx, [
    P(g, d.gx - m, d.gy - m), P(g, d.gx + d.w + m, d.gy - m),
    P(g, d.gx + d.w + m, d.gy + d.h + m), P(g, d.gx - m, d.gy + d.h + m),
  ]);
}

function drawFloor(ctx: CanvasRenderingContext2D, g: Geo, d: District, alpha: number) {
  floorPath(ctx, g, d);
  const tint = d.wing === 'research' ? '170, 150, 255' : '120, 160, 255';
  ctx.fillStyle = `rgba(${tint}, ${0.06 * alpha})`;
  ctx.fill();
  ctx.strokeStyle = `rgba(${tint}, ${0.22 * alpha})`;
  ctx.lineWidth = 1;
  ctx.stroke();
}

/** The district's name, painted flat on its front row. Up to two lines. */
function drawLabel(ctx: CanvasRenderingContext2D, g: Geo, d: District, alpha: number, hot: boolean) {
  const size = Math.max(9, Math.min(12.5, g.U * 0.34));
  const edge = Math.hypot(1, 0.5) * g.U; // screen length of one cell edge
  const room = d.w * edge - 4;
  ctx.save();
  const [px, py] = P(g, d.gx + 0.06, d.gy + d.h - 0.92);
  const k = 1 / Math.hypot(1, 0.5);
  ctx.transform(k, k * 0.5, -k, k * 0.5, px, py);
  ctx.font = `700 ${size}px ${getComputedStyle(ctx.canvas).fontFamily}`;
  ctx.textBaseline = 'top';
  const lines: string[] = [];
  let line = '';
  for (const word of d.label.split(' ')) {
    const next = line ? line + ' ' + word : word;
    if (line && ctx.measureText(next).width > room) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  ctx.fillStyle = hot ? `rgba(255, 255, 255, ${alpha})` : `rgba(206, 215, 255, ${0.7 * alpha})`;
  lines.slice(0, 2).forEach((l, i) => ctx.fillText(l, 0, i * size * 1.18));
  ctx.restore();
}

function drawColumn(
  ctx: CanvasRenderingContext2D,
  g: Geo,
  c: Column,
  shown: number,
  hot: boolean,
  pulse: number,
) {
  const { cx, hw, hh, ch } = foot(g, c);
  let { cy } = foot(g, c);
  if (hot) cy -= 3;

  if (c.target > c.level) {
    // where this stack is headed: the outline of the cubes still to earn
    const T = c.target * ch;
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(200, 216, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const x of [cx - hw, cx, cx + hw]) {
      const y0 = x === cx ? cy + hh : cy;
      ctx.moveTo(x, y0 - shown * ch);
      ctx.lineTo(x, y0 - T);
    }
    ctx.stroke();
    poly(ctx, [[cx - hw, cy - T], [cx, cy - hh - T], [cx + hw, cy - T], [cx, cy + hh - T]]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (c.level === 0 && shown < 0.05) {
    // an empty lot: a skill with no evidence yet
    poly(ctx, [[cx - hw, cy], [cx, cy - hh], [cx + hw, cy], [cx, cy + hh]]);
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = hot ? 'rgba(200, 214, 255, 0.95)' : 'rgba(150, 170, 255, 0.42)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.setLineDash([]);
  } else {
    const s = shadeOf(c);
    const H = shown * ch;
    poly(ctx, [[cx - hw, cy], [cx, cy + hh], [cx, cy + hh - H], [cx - hw, cy - H]]);
    ctx.fillStyle = s.left;
    ctx.fill();
    poly(ctx, [[cx, cy + hh], [cx + hw, cy], [cx + hw, cy - H], [cx, cy + hh - H]]);
    ctx.fillStyle = s.right;
    ctx.fill();
    // seams between the cubes of a stack
    ctx.strokeStyle = 'rgba(8, 10, 30, 0.34)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < shown; i++) {
      const y = cy - i * ch;
      ctx.moveTo(cx - hw, y);
      ctx.lineTo(cx, y + hh);
      ctx.lineTo(cx + hw, y);
    }
    ctx.stroke();
    poly(ctx, [[cx - hw, cy - H], [cx, cy - hh - H], [cx + hw, cy - H], [cx, cy + hh - H]]);
    ctx.fillStyle = s.top;
    ctx.fill();
    if (c.recent && !hot) {
      // touched this week: the cap is lit
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 1.25;
      ctx.stroke();
    }
    if (hot) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.fill();
      poly(ctx, silhouette({ ...g, oy: g.oy - 3 }, c, shown));
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = 1.25;
      ctx.stroke();
    }
  }

  const topY = cy - hh - Math.max(shown, c.target) * ch;
  if (c.due) {
    // something to do today: a marker floating over the stack
    const y = topY - 9 - pulse * 3;
    const r = 4;
    poly(ctx, [[cx - r, y], [cx, y - r], [cx + r, y], [cx, y + r]]);
    ctx.fillStyle = `rgba(255, 200, 87, ${0.55 + 0.45 * (1 - pulse)})`;
    ctx.fill();
  }
}

/** "studying now" / "reading now": a flag on a pole, drawn over everything so it is never hidden. */
function drawFlag(ctx: CanvasRenderingContext2D, g: Geo, c: Column, shown: number, text: string) {
  const { cx, cy, hh, ch } = foot(g, c);
  const topY = cy - hh - Math.max(shown, c.target) * ch;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx, topY + hh);
  ctx.lineTo(cx, topY - 18);
  ctx.stroke();
  ctx.font = `600 10.5px ${getComputedStyle(ctx.canvas).fontFamily}`;
  const w = ctx.measureText(text).width;
  ctx.fillStyle = 'rgba(10, 12, 28, 0.78)';
  ctx.beginPath();
  ctx.roundRect(cx + 1, topY - 23, w + 12, 16, 3);
  ctx.fill();
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.fillText(text, cx + 7, topY - 14.5);
}

/** A soft dark pool under the city so it reads the same on a busy wallpaper as on a plain one. */
function drawVeil(ctx: CanvasRenderingContext2D, g: Geo, city: City, alpha: number) {
  const [lx] = P(g, 0, city.h);
  const [rx] = P(g, city.w, 0);
  const [, ty] = P(g, 0, 0);
  const [, by] = P(g, city.w, city.h);
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

interface Tip {
  col: Column;
  x: number;
  y: number;
}

export function Stacks({ veil = false }: { veil?: boolean }) {
  const launch = useOS((s) => s.launch);
  const reducedSetting = useOS((s) => s.settings.reducedMotion);
  const learningReady = useHydrated();
  const researchReady = useResearchHydrated();
  const skills = useLearning((s) => s.skills);
  const currentSkillId = useLearning((s) => s.currentSkillId);
  const papers = useResearch((s) => s.papers);
  const cards = useResearch((s) => s.cards);
  const rqs = useResearch((s) => s.rqs);
  const entries = useEntries();

  const ready = learningReady && researchReady;
  const city = useMemo(
    () => (ready ? buildCity({ learning: { skills, currentSkillId }, papers, cards, rqs, entries }) : null),
    [ready, skills, currentSkillId, papers, cards, rqs, entries],
  );

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  const live = useRef<{
    city: City | null;
    geo: Geo | null;
    shown: Map<string, number>;
    born: Map<string, number>;
    hot: string | null;
    order: Column[];
    veil: boolean;
    kick: () => void;
  }>({ city: null, geo: null, shown: new Map(), born: new Map(), hot: null, order: [], veil, kick: () => {} });

  // a different wallpaper: same city, with or without the pool beneath it
  useEffect(() => {
    live.current.veil = veil;
    live.current.kick();
  }, [veil]);

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

    const frame = (now: number) => {
      raf = 0;
      const { city: c, geo: g } = L;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (!c || !g) return;

      let moving = false;
      const first = Math.min(...L.born.values(), now);
      const floorAlpha = still() ? 1 : Math.min(1, (now - first) / 500);
      if (floorAlpha < 1) moving = true;
      if (L.veil) drawVeil(ctx, g, c, floorAlpha);
      for (const d of c.districts) {
        drawFloor(ctx, g, d, floorAlpha);
        drawLabel(ctx, g, d, floorAlpha, false);
      }

      const pulse = still() ? 0 : (Math.sin(now / 520) + 1) / 2;
      for (const col of L.order) {
        let s = L.shown.get(col.id) ?? 0;
        if (still()) s = col.level;
        else if (now >= (L.born.get(col.id) ?? 0)) {
          const diff = col.level - s;
          if (Math.abs(diff) > 0.01) {
            s += diff * 0.13;
            moving = true;
          } else s = col.level;
        } else moving = true;
        L.shown.set(col.id, s);
        drawColumn(ctx, g, col, s, L.hot === col.id, pulse);
      }

      for (const col of L.order) {
        if (col.current) drawFlag(ctx, g, col, L.shown.get(col.id) ?? col.level, 'studying now');
        else if (col.reading) drawFlag(ctx, g, col, L.shown.get(col.id) ?? col.level, 'reading now');
      }

      // the hovered column's district: outline it and bring its name to the front
      const hotDistrict = L.hot && c.districts.find((d) => d.columns.some((x) => x.id === L.hot));
      if (hotDistrict) {
        floorPath(ctx, g, hotDistrict);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
        drawLabel(ctx, g, hotDistrict, 1, true);
      }

      const beacons = !still() && c.totals.due > 0 && !document.hidden;
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
      if (L.city) {
        const panelH = parseFloat(getComputedStyle(canvas).getPropertyValue('--kos-panel-h')) || 34;
        L.geo = fit(L.city, canvas.clientWidth, canvas.clientHeight, panelH, isPhone());
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

  // new data: keep the heights already on screen, stagger in anything new
  useEffect(() => {
    const L = live.current;
    const canvas = canvasRef.current;
    L.city = city;
    if (!city || !canvas) return;
    const panelH = parseFloat(getComputedStyle(canvas).getPropertyValue('--kos-panel-h')) || 34;
    L.geo = fit(city, canvas.clientWidth, canvas.clientHeight, panelH, isPhone());
    L.order = city.districts
      .flatMap((d) => d.columns)
      .sort((a, b) => a.gx + a.gy - (b.gx + b.gy) || a.gx - b.gx);
    const now = performance.now();
    const firstBuild = L.born.size === 0;
    L.order.forEach((c, i) => {
      if (!L.born.has(c.id)) L.born.set(c.id, now + (firstBuild ? 260 + i * 14 : 0));
    });
    L.kick();
  }, [city]);

  // hover and click, read from the bare desktop only
  useEffect(() => {
    const L = live.current;
    const onDesktop = (t: EventTarget | null) =>
      t instanceof HTMLElement && (t.classList.contains('kos-desktop-surface') || t.classList.contains('kos-desktop-icons'));
    const pick = (x: number, y: number): Column | null => {
      if (!L.geo) return null;
      for (let i = L.order.length - 1; i >= 0; i--) {
        const c = L.order[i];
        if (inside(silhouette(L.geo, c, L.shown.get(c.id) ?? c.level), x, y)) return c;
      }
      return null;
    };
    const setHot = (c: Column | null, surface?: HTMLElement) => {
      if ((c?.id ?? null) === L.hot) return;
      L.hot = c?.id ?? null;
      if (surface) surface.style.cursor = c ? 'pointer' : '';
      if (c && L.geo) {
        const f = foot(L.geo, c);
        setTip({ col: c, x: f.cx, y: f.cy - f.hh - Math.max(c.level, c.target) * f.ch });
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
      const c = pick(e.clientX, e.clientY);
      if (c) launch(c.open.app, c.open.args);
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
      {city && (
        <ul className={'kos-stacks-legend' + (veil ? ' veiled' : '')} aria-hidden="true">
          <li><i className="sw k-skill" />skill</li>
          <li><i className="sw k-proven" />proven without AI</li>
          <li><i className="sw k-paper" />paper</li>
          <li><i className="sw k-post" />post</li>
          <li><i className="sw k-recent" />touched this week{city.totals.recent ? ` (${city.totals.recent})` : ''}</li>
          <li><i className="sw k-due" />due today{city.totals.due ? ` (${city.totals.due})` : ''}</li>
          <li className="dim">taller is deeper</li>
        </ul>
      )}
      {tip && (
        <div
          className={'kos-stacks-tip' + (tip.x > window.innerWidth - 340 ? ' flip' : '')}
          style={{ left: tip.x, top: tip.y }}
          aria-hidden="true"
        >
          <span className={'kos-stacks-kind k-' + tip.col.kind}>{KIND_LABEL[tip.col.kind]}</span>
          <strong>{tip.col.title}</strong>
          <span className="kos-stacks-state">{tip.col.state}</span>
          {tip.col.detail && <span className="kos-stacks-detail">{tip.col.detail}</span>}
          {tip.col.target > tip.col.level && (
            <span className="kos-stacks-detail">The outline is the target: internalized, without AI.</span>
          )}
          <span className="kos-stacks-hint">
            {tip.col.due ? 'Due today. ' : ''}Click to open in {OPENS_IN[tip.col.kind]}
          </span>
        </div>
      )}
    </>
  );
}
