'use client';

import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useOS } from '../store';
import { KaliMark } from '../icons';
import { prefersReducedMotion } from '../desktop/layout';
import { LENSES, type Lens } from './anatomy';
import { FLAT, ease, fit, inQuad, leaderEnds, quad, type Cam } from './camera';
import { heights, useTeardownModel, wiring, type Part } from './parts';
import { SPREAD_MAX, SPREAD_MIN, useTeardown } from './store';

/**
 * Teardown: the running desktop, tilted and pulled apart along one axis like
 * an exploded drawing, with a numbered parts list beside it.
 *
 * Nothing is re-drawn for this. The desktop element itself is given a 3D
 * transform and each of its real layers (wallpaper, board, icons, every
 * window, the panel) is raised to its own height, so the clock keeps
 * ticking and a terminal keeps printing while it hangs in the air. Under the
 * wallpaper the stack continues into plates drawn from live state: display,
 * session, file system, kernel, hardware (Plates.tsx, mounted by the desktop).
 *
 * The stack can be read three ways (anatomy.ts): as a Kali Linux machine, as
 * this site, and as an LLM system. The lens renames every layer, changes the
 * components named on its plate, and changes the lesson in the notes. Picking
 * a part also lights the parts it is wired to, so the stack shows how its
 * pieces depend on each other, and lists the subjects in the Stacks record
 * where I have worked at that layer.
 *
 * How it is kept honest and usable (docs/teardown-research.md has the sources):
 *   - It is a momentary overview, not a place to work: Esc puts it back.
 *     Permanent 3D desktops were dropped again and again; the overview is
 *     the part that survived.
 *   - One explosion axis, layers in their real stacking order, and any layer
 *     can be slid out of the stack so nothing stays hidden.
 *   - Balloons in one column, numbered top to bottom to match the stack;
 *     leaders are straight, drawn at an angle, and do not cross.
 *   - The desktop is `inert` while apart. Pointing is resolved here with the
 *     same arithmetic that places the layers (camera.ts), because browser
 *     hit-testing through 3D transforms is not reliable.
 *
 * The camera runs in one requestAnimationFrame loop and writes styles
 * directly: no React render per frame.
 */

const VIEW = { rx: (58 * Math.PI) / 180, rz: (-38 * Math.PI) / 180 };
const RX_MIN = (30 * Math.PI) / 180;
const RX_MAX = (80 * Math.PI) / 180;
/** room kept on the left for the parts list and its notes */
const RAIL_W = 332;
/** how far a picked layer slides out of the stack, as a share of the screen's width */
const PULL = 0.62;
/** how far everything unrelated to the picked layer fades */
const OTHERS = 0.42;

export function Teardown() {
  const on = useTeardown((s) => s.on);
  return on ? <Apart /> : null;
}

function Apart() {
  const { parts } = useTeardownModel();
  const hovered = useTeardown((s) => s.hovered);
  const pinned = useTeardown((s) => s.pinned);
  const spread = useTeardown((s) => s.spread);
  const closing = useTeardown((s) => s.closing);
  const lens = useTeardown((s) => s.lens);
  const hover = useTeardown((s) => s.hover);
  const pin = useTeardown((s) => s.pin);
  const setSpread = useTeardown((s) => s.setSpread);
  const setLens = useTeardown((s) => s.setLens);
  const close = useTeardown((s) => s.close);
  const launch = useOS((s) => s.launch);
  const user = useOS((s) => s.user);
  const host = useOS((s) => s.host);
  const reducedSetting = useOS((s) => s.settings.reducedMotion);

  const active = closing ? null : (hovered ?? pinned);
  const part = parts.find((p) => p.id === active);
  const numbers = useMemo(() => new Map(parts.map((p, i) => [p.id, String(i + 1).padStart(2, '0')])), [parts]);
  const wires = useMemo(() => (active ? wiring(parts, active) : []), [parts, active]);
  const windowCount = parts.filter((p) => p.kind === 'window').length;
  const lensInfo = LENSES.find((l) => l.id === lens) ?? LENSES[0];

  const [ready, setReady] = useState(false);
  const hud = useRef<HTMLDivElement>(null);
  const rowEls = useRef(new Map<string, HTMLElement>());
  const leaderEls = useRef(new Map<string, SVGPathElement>());
  const wireEls = useRef(new Map<string, SVGPathElement>());
  const wireEnds = useRef(new Map<string, SVGCircleElement>());
  const rodsEl = useRef<SVGPathElement>(null);
  const scaleEl = useRef<HTMLElement>(null);

  const live = useRef({
    parts,
    active: active as string | null,
    wired: new Set<string>(),
    view: { ...VIEW },
    cam: { ...FLAT } as Cam,
    pulls: new Map<string, number>(),
    /** where each balloon is on screen: the near end of its leader */
    rows: new Map<string, [number, number]>(),
    /** what the pointer can hit, top layer first */
    hits: [] as { id: string; q: [number, number][] }[],
    dirty: true,
  });
  live.current.parts = parts;
  live.current.active = active;
  live.current.wired = new Set(wires.map((w) => w.id));
  live.current.dirty = true;

  // where the balloons are: measured when the list changes, not every frame
  useLayoutEffect(() => {
    const measure = () => {
      const rows = new Map<string, [number, number]>();
      for (const [id, el] of rowEls.current) {
        const r = el.getBoundingClientRect();
        rows.set(id, [r.right + 3, r.top + r.height / 2]);
      }
      live.current.rows = rows;
      live.current.dirty = true;
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [parts, lens]);

  // the lens tints the whole drawing
  useEffect(() => {
    const root = document.querySelector<HTMLElement>('.kos');
    if (root) root.dataset.tdLens = lens;
    return () => {
      if (root) delete root.dataset.tdLens;
    };
  }, [lens]);

  // the camera
  useEffect(() => {
    const root = document.querySelector<HTMLElement>('.kos');
    const desk = root?.querySelector<HTMLElement>('.kos-desktop');
    if (!root || !desk) {
      useTeardown.getState().finish();
      return;
    }
    const L = live.current;
    const still = () => reducedSetting || prefersReducedMotion();
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const tagged = new Map<string, HTMLElement[]>();
    const t0 = performance.now();
    let last = t0;
    let raf = 0;
    let done = false;
    let closingSince = 0;

    // nothing may be left hanging open over a desktop that is about to tilt
    useOS.getState().setMenuOpen(false);
    useOS.getState().setPaletteOpen(false);
    root.dataset.teardown = 'on';
    desk.inert = true;
    hud.current?.focus({ preventScroll: true });
    const readyTimer = window.setTimeout(() => setReady(true), still() ? 0 : 520);

    /** the live layer and the plate that belong to a part */
    const elementsOf = (p: Part): HTMLElement[] => {
      const have = tagged.get(p.id);
      if (have && have.length && have.every((e) => e.isConnected)) return have;
      const els: HTMLElement[] = [];
      const layer = p.selector ? desk.querySelector<HTMLElement>(p.selector) : null;
      if (layer) els.push(layer);
      const plate = desk.querySelector<HTMLElement>(`[data-td-plate="${p.id}"]`);
      if (plate) els.push(plate);
      for (const e of els) e.dataset.tdPart = p.id;
      // a plate is mounted a render after the camera starts: look again until it is there
      if ((layer || !p.selector) && (plate || !p.plate)) tagged.set(p.id, els);
      return els;
    };
    const untag = (els: HTMLElement[]) => {
      for (const e of els) {
        delete e.dataset.tdPart;
        delete e.dataset.tdActive;
        delete e.dataset.tdWired;
        e.style.removeProperty('--td-z');
        e.style.removeProperty('--td-x');
        e.style.removeProperty('--td-o');
      }
    };

    const restore = () => {
      for (const els of tagged.values()) untag(els);
      tagged.clear();
      desk.style.transform = '';
      desk.inert = false;
      delete root.dataset.teardown;
      root.style.removeProperty('--td-in');
    };

    const frame = (now: number) => {
      raf = 0;
      // the easing is exponential, so a long frame is safe: it just takes a bigger step
      const dt = Math.min(0.5, (now - last) / 1000);
      last = now;
      const st = useTeardown.getState();
      const W = desk.clientWidth;
      const H = desk.clientHeight;
      const { z, units } = heights(L.parts);
      const cam = L.cam;

      // where the camera is headed.
      // the right of the stack is left clear: that is where a picked layer slides out to
      const area = { x0: RAIL_W + 52, y0: 50, x1: W - Math.min(230, W * 0.16), y1: H - 58 };
      const mid = (area.y0 + area.y1) / 2 - H / 2;
      const f = fit(W, H, area, L.view.rx, L.view.rz, units, st.spread);
      let to: Cam;
      if (st.closing) {
        // close the stack up first, then lay it flat
        to = cam.g > f.g * 0.18 && !still() ? { ...cam, g: 0 } : FLAT;
      } else {
        to = {
          rx: L.view.rx,
          rz: L.view.rz,
          s: f.s,
          tx: f.tx,
          // the stack drops as it opens, so it stays centred the whole way
          ty: mid + (f.ty - mid) * Math.min(1, cam.g / Math.max(1, f.g)),
          // tilt first, then pull apart
          g: now - t0 > 260 || still() ? f.g : 0,
        };
      }

      const prev = { ...cam };
      if (still()) Object.assign(cam, to);
      else {
        cam.rx = ease(cam.rx, to.rx, dt, 0.13);
        cam.rz = ease(cam.rz, to.rz, dt, 0.13);
        cam.s = ease(cam.s, to.s, dt, 0.13);
        cam.tx = ease(cam.tx, to.tx, dt, 0.13);
        cam.ty = ease(cam.ty, to.ty, dt, 0.13);
        cam.g = ease(cam.g, to.g, dt, 0.17);
      }

      // back together: close enough to flat, or out of time. The desktop must always come back.
      if (st.closing && !closingSince) closingSince = now;
      const flat = Math.abs(cam.rx) < 0.012 && Math.abs(cam.rz) < 0.012 && Math.abs(cam.s - 1) < 0.006 && cam.g < 1;
      if (st.closing && (flat || now - closingSince > 1500)) {
        done = true;
        restore();
        const focusId = st.focusAfter;
        st.finish();
        if (focusId) useOS.getState().focus(focusId);
        else before?.focus?.({ preventScroll: true });
        return;
      }

      let moved =
        L.dirty ||
        Math.abs(cam.rx - prev.rx) + Math.abs(cam.rz - prev.rz) + Math.abs(cam.s - prev.s) > 1e-5 ||
        Math.abs(cam.tx - prev.tx) + Math.abs(cam.ty - prev.ty) + Math.abs(cam.g - prev.g) > 0.01;

      // the picked layer slides out of the stack
      const pulls = new Map<string, number>();
      for (const p of L.parts) {
        const want = L.active === p.id && !st.closing ? PULL * W : 0;
        const have = L.pulls.get(p.id) ?? 0;
        const next = still() ? want : ease(have, want, dt, 0.1);
        if (Math.abs(next - have) > 0.05) moved = true;
        pulls.set(p.id, Math.abs(next - want) < 0.05 ? want : next);
      }
      L.pulls = pulls;

      if (moved) {
        L.dirty = false;
        desk.style.transform = `translate(${cam.tx}px, ${cam.ty}px) rotateX(${cam.rx}rad) rotateZ(${cam.rz}rad) scale3d(${cam.s}, ${cam.s}, ${cam.s})`;
        root.style.setProperty('--td-in', String(Math.min(1, cam.g / Math.max(1, f.g * 0.5))));
        if (scaleEl.current) scaleEl.current.textContent = cam.s.toFixed(2) + ' : 1';

        const ids = new Set(L.parts.map((p) => p.id));
        for (const [id, els] of tagged) {
          if (ids.has(id)) continue;
          untag(els);
          tagged.delete(id);
        }

        const hits: { id: string; q: [number, number][] }[] = [];
        const outlines = new Map<string, [number, number][]>();
        for (const p of L.parts) {
          const zpx = (z.get(p.id) ?? 0) * cam.g;
          const dx = pulls.get(p.id) ?? 0;
          const isActive = L.active === p.id;
          const isWired = L.wired.has(p.id);
          for (const e of elementsOf(p)) {
            e.style.setProperty('--td-z', zpx.toFixed(2) + 'px');
            e.style.setProperty('--td-x', dx.toFixed(2) + 'px');
            e.style.setProperty('--td-o', L.active && !isActive && !isWired ? String(OTHERS) : '1');
            if (isActive) e.dataset.tdActive = '';
            else delete e.dataset.tdActive;
            if (isWired) e.dataset.tdWired = '';
            else delete e.dataset.tdWired;
          }
          for (const r of p.hits ?? [p.rect]) hits.push({ id: p.id, q: quad(cam, W, H, r, dx, zpx) });
          outlines.set(p.id, quad(cam, W, H, p.rect, dx, zpx));
        }
        L.hits = hits;

        // the leaders: from each balloon to its part, never crossing
        const rows = L.parts.map((p) => L.rows.get(p.id));
        leaderEnds(rows, L.parts.map((p) => outlines.get(p.id)!)).forEach((a, i) => {
          const path = leaderEls.current.get(L.parts[i].id);
          const row = rows[i];
          if (!path || !row || !a) return;
          path.setAttribute(
            'd',
            `M${row[0].toFixed(1)} ${row[1].toFixed(1)}L${a[0].toFixed(1)} ${a[1].toFixed(1)}` +
              `M${(a[0] + 3).toFixed(1)} ${a[1].toFixed(1)}a3 3 0 1 0 -6 0a3 3 0 1 0 6 0`,
          );
        });

        // the wiring: from the picked part to each part it depends on, or that depends on it.
        // A wire leaves the middle of the picked part and lands on the near corner of the other,
        // the corner that is in view while it sits in the stack.
        const from = L.active ? outlines.get(L.active) : undefined;
        for (const [id, path] of wireEls.current) {
          const to2 = outlines.get(id);
          if (!from || !to2) {
            path.setAttribute('d', '');
            wireEnds.current.get(id)?.setAttribute('cy', '-99');
            continue;
          }
          const a: [number, number] = [(from[0][0] + from[2][0]) / 2, (from[0][1] + from[2][1]) / 2];
          const b = to2.reduce((best, c) => (c[1] > best[1] ? c : best), to2[0]);
          const bend = Math.min(90, Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.22);
          path.setAttribute(
            'd',
            `M${a[0].toFixed(1)} ${a[1].toFixed(1)}Q${((a[0] + b[0]) / 2 + bend).toFixed(1)} ${((a[1] + b[1]) / 2 + bend * 0.4).toFixed(1)} ${b[0].toFixed(1)} ${b[1].toFixed(1)}`,
          );
          const end = wireEnds.current.get(id);
          end?.setAttribute('cx', b[0].toFixed(1));
          end?.setAttribute('cy', b[1].toFixed(1));
        }

        // the explosion axis: one dashed line up each corner of the stack
        if (rodsEl.current) {
          const full = { x: 0, y: 0, w: W, h: H };
          const lo = quad(cam, W, H, full, 0, 0);
          const hi = quad(cam, W, H, full, 0, units * cam.g);
          rodsEl.current.setAttribute(
            'd',
            lo.map((c, i) => `M${c[0].toFixed(1)} ${c[1].toFixed(1)}L${hi[i][0].toFixed(1)} ${hi[i][1].toFixed(1)}`).join(''),
          );
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    // the desktop's own shortcuts stay out of the way while it is apart
    const onKey = (e: KeyboardEvent) => {
      const st = useTeardown.getState();
      const inField = e.target instanceof HTMLInputElement;
      const list = L.parts;
      const at = list.findIndex((p) => p.id === (st.pinned ?? st.hovered));
      const step = (d: number) => {
        const next = list[Math.max(0, Math.min(list.length - 1, at < 0 ? (d > 0 ? 0 : list.length - 1) : at + d))];
        if (!next) return;
        st.hover(null);
        st.pin(next.id);
        rowEls.current.get(next.id)?.closest('button')?.focus({ preventScroll: true });
      };
      if (e.type === 'keydown') {
        const k = e.key.toLowerCase();
        if (e.key === 'Escape' || (e.ctrlKey && e.altKey && k === 'x')) {
          e.preventDefault();
          st.close();
        } else if (inField || e.ctrlKey || e.metaKey || e.altKey) {
          // leave fields and browser chords alone
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          step(1);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          step(-1);
        } else if (e.key === '+' || e.key === '=') st.setSpread(st.spread * 1.15);
        else if (e.key === '-') st.setSpread(st.spread / 1.15);
        else if (e.key === '1' || e.key === '2' || e.key === '3') st.setLens(LENSES[+e.key - 1].id);
        else if (e.key === '0' || k === 'r') {
          L.view = { ...VIEW };
          st.setSpread(1);
        }
      }
      e.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKey, true);

    return () => {
      window.clearTimeout(readyTimer);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('keyup', onKey, true);
      if (raf) cancelAnimationFrame(raf);
      if (!done) restore();
    };
  }, [reducedSetting]);

  /* ── pointing at the stack ── */
  const drag = useRef<{ x: number; y: number; rx: number; rz: number; moved: boolean } | null>(null);
  const hitAt = (x: number, y: number) => live.current.hits.find((h) => inQuad(h.q, x, y))?.id ?? null;

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, rx: live.current.view.rx, rz: live.current.view.rz, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return hover(hitAt(e.clientX, e.clientY));
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.abs(dx) + Math.abs(dy) < 5) return;
    d.moved = true;
    hover(null);
    live.current.view = {
      rz: Math.max(-1.25, Math.min(1.25, d.rz + dx * 0.006)),
      rx: Math.max(RX_MIN, Math.min(RX_MAX, d.rx - dy * 0.005)),
    };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved) pin(hitAt(e.clientX, e.clientY));
  };
  const resetView = () => {
    live.current.view = { ...VIEW };
    setSpread(1);
  };
  const openSubject = (subjectId: string) => {
    close();
    // let the layers close up before the record opens over them
    window.setTimeout(() => launch('stacks', { subjectId }), 620);
  };

  const reading = part?.anatomy[lens];
  const others = LENSES.filter((l) => l.id !== lens);

  return (
    <div
      ref={hud}
      className={'td-hud' + (ready ? ' ready' : '') + (closing ? ' closing' : '')}
      role="dialog"
      aria-label="Teardown: the desktop taken apart into its layers"
      tabIndex={-1}
    >
      <div
        className="td-stage"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (drag.current = null)}
        onPointerLeave={() => !drag.current && hover(null)}
        onWheel={(e) => setSpread(spread * Math.exp(-e.deltaY * 0.0012))}
        onDoubleClick={(e) => {
          const p = parts.find((x) => x.id === hitAt(e.clientX, e.clientY));
          p?.action?.run();
        }}
      />

      <svg className="td-lines" aria-hidden="true">
        <path className="td-rods" ref={rodsEl} />
        {parts.map((p) => (
          <path
            key={p.id}
            className={'td-leader' + (active === p.id ? ' on' : '') + (wires.some((w) => w.id === p.id) ? ' wired' : '')}
            ref={(el) => {
              if (el) leaderEls.current.set(p.id, el);
              else leaderEls.current.delete(p.id);
            }}
          />
        ))}
        {wires.map((w) => (
          <Fragment key={active + '>' + w.id}>
            <path
              className={'td-wire ' + (w.dir === 'uses' ? 'out' : 'in')}
              ref={(el) => {
                if (el) wireEls.current.set(w.id, el);
                else wireEls.current.delete(w.id);
              }}
            />
            <circle
              className="td-wire-end"
              r="4.5"
              cy="-99"
              ref={(el) => {
                if (el) wireEnds.current.set(w.id, el);
                else wireEnds.current.delete(w.id);
              }}
            />
          </Fragment>
        ))}
      </svg>

      <div className="td-rail">
        <header className="td-title">
          <b>Teardown</b>
          <span>
            {user}@{host} · {parts.length} parts · {windowCount} window{windowCount === 1 ? '' : 's'} open
          </span>
        </header>

        <div className="td-lens" role="radiogroup" aria-label="Read the stack as">
          {LENSES.map((l, i) => (
            <button
              key={l.id}
              type="button"
              role="radio"
              aria-checked={lens === l.id}
              className={'l-' + l.id + (lens === l.id ? ' on' : '')}
              title={`${l.blurb} (press ${i + 1})`}
              onClick={() => setLens(l.id)}
            >
              {l.label}
            </button>
          ))}
        </div>

        <ol className="td-parts" aria-label="Parts, top layer first" onPointerLeave={() => hover(null)}>
          {parts.map((p, i) => (
            <Fragment key={p.id}>
              {p.group === 'under' && parts[i - 1]?.group !== 'under' && (
                <li className="td-glassline" aria-hidden="true">
                  under the wallpaper
                </li>
              )}
              <li>
                <button
                  type="button"
                  className={
                    (active === p.id ? 'on ' : '') + (pinned === p.id ? 'pinned ' : '') + (wires.some((w) => w.id === p.id) ? 'wired' : '')
                  }
                  aria-pressed={pinned === p.id}
                  onPointerEnter={() => hover(p.id)}
                  onClick={() => pin(pinned === p.id ? null : p.id)}
                  onDoubleClick={() => p.action?.run()}
                >
                  <span
                    className="td-n"
                    ref={(el) => {
                      if (el) rowEls.current.set(p.id, el);
                      else rowEls.current.delete(p.id);
                    }}
                  >
                    {numbers.get(p.id)}
                  </span>
                  <span className="td-nm">{p.name}</span>
                  <span className="td-rl">{p.anatomy[lens].name}</span>
                </button>
              </li>
            </Fragment>
          ))}
        </ol>

        <aside className="td-detail" aria-live="polite">
          {part && reading ? (
            <>
              <p className="td-detail-n">
                {numbers.get(part.id)} · {part.name} · {lensInfo.short}
              </p>
              <h2>{reading.name}</h2>
              <p className="td-detail-gist">{reading.gist}</p>
              {part.work.length > 0 && (
                <>
                  <h3>My work at this layer</h3>
                  <div className="td-work">
                    {part.work.map((w) => (
                      <button key={w.id} type="button" onClick={() => openSubject(w.id)} title="Reassemble and open this subject in Stacks">
                        {w.name}
                        {w.cubes > 0 && <b>{w.cubes}</b>}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {reading.piecesLabel && <h3>{reading.piecesLabel}</h3>}
              <dl className="td-pieces">
                {reading.pieces.map(([name, what]) => (
                  <Fragment key={name}>
                    <dt>{name}</dt>
                    <dd>{what}</dd>
                  </Fragment>
                ))}
              </dl>

              <div className="td-also">
                {others.map((l) => (
                  <button key={l.id} type="button" className={'l-' + l.id} onClick={() => setLens(l.id)} title={`Read the stack as: ${l.label}`}>
                    <i>{l.short}</i>
                    {part.anatomy[l.id].name}
                  </button>
                ))}
              </div>

              {wires.length > 0 && (
                <>
                  <h3>Wired to</h3>
                  <ul className="td-wires">
                    {wires.map((w) => {
                      const other = parts.find((p) => p.id === w.id);
                      if (!other) return null;
                      return (
                        <li key={w.id} className={w.dir === 'uses' ? 'out' : 'in'}>
                          <button type="button" onClick={() => pin(w.id)} title={`Pick ${other.name}`}>
                            <b>{numbers.get(w.id)}</b> {other.name}
                          </button>
                          <span>{w.how}</span>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}

              <h3>Right now, in this tab</h3>
              <dl className="td-facts">
                {part.facts.map(([k, v]) => (
                  <Fragment key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </Fragment>
                ))}
              </dl>
              {part.action && pinned === part.id && (
                <button type="button" className="td-btn" onClick={part.action.run}>
                  {part.action.label}
                </button>
              )}
            </>
          ) : (
            <>
              <p className="td-detail-n">exploded view · {lensInfo.short}</p>
              <h2>This is the desktop you were just using</h2>
              <p className="td-detail-gist">
                Not a model of it: the same elements, lifted apart in the order they are stacked, with the clock still
                running. Under the wallpaper are the layers that hold it up, read from this tab as it is right now.
              </p>
              <p className="td-detail-gist">
                <b>Reading it as {lensInfo.label.toLowerCase()}.</b> {lensInfo.blurb}
              </p>
              <p className="td-detail-gist">
                Point at a part to slide it out and see what it is wired to. Click to hold it. Keys 1, 2 and 3 change
                the reading.
              </p>
            </>
          )}
        </aside>
      </div>

      <footer className="td-controls">
        <span className="td-hint">Drag to turn · scroll to spread · ↑ ↓ step through parts · 1 2 3 change the reading</span>
        <label>
          <span>Spread</span>
          <input
            type="range"
            min={SPREAD_MIN}
            max={SPREAD_MAX}
            step={0.01}
            value={spread}
            onChange={(e) => setSpread(+e.target.value)}
            aria-label="How far apart the layers stand"
          />
        </label>
        <button type="button" className="td-btn" onClick={resetView}>
          Reset view
        </button>
        <button type="button" className="td-btn primary" onClick={() => close()}>
          Reassemble <kbd>Esc</kbd>
        </button>
      </footer>

      {/* the drawing's title block */}
      <div className="td-block" aria-hidden="true">
        <KaliMark size={30} className="td-block-mark" />
        <dl>
          <dt>Drawing</dt>
          <dd>Kali desktop, exploded</dd>
          <dt>Read as</dt>
          <dd className="lens">{lensInfo.label}</dd>
          <dt>Scale</dt>
          <dd ref={scaleEl}>1.00 : 1</dd>
          <dt>Sheet</dt>
          <dd>
            {parts.length} parts · drawn live
          </dd>
        </dl>
      </div>
    </div>
  );
}
