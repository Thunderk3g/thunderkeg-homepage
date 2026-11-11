'use client';

import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useOS } from '../store';
import { KaliMark } from '../icons';
import { prefersReducedMotion } from '../desktop/layout';
import { useStacksView } from '@/stacks/useBoard';
import { LENSES } from './anatomy';
import { BREAKDOWNS, DRAWN, MAX_SLABS, local, pose, reach, slabBox, startOf, type Move } from './breakdowns';
import { FLAT, ease, fit, frame, inQuad, leaderPicks, quad, spots, type Cam, type Rect } from './camera';
import { heights, useTeardownModel, wiring, type Part } from './parts';
import { chainOf, livePieces, type LivePiece } from './pieces';
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
 * There are two levels. The stack is the overview: pointing at a layer leafs
 * the stack open above it, the way a thumb opens a pile of paper, and nothing
 * else moves. Clicking a layer opens that layer's own screen: the rest of the
 * stack steps away, the camera takes the angle that suits the layer, and the
 * layer comes apart in its own way (breakdowns.ts): the panel's plugins lift
 * out like keys, a window parts into frame, title bar and app, the kernel
 * rises in rings. Esc steps back out, one level at a time.
 *
 * How it is kept honest and usable (docs/teardown-research.md has the sources):
 *   - It is a momentary overview, not a place to work: Esc puts it back.
 *     Permanent 3D desktops were dropped again and again; the overview is
 *     the part that survived.
 *   - One explosion axis, layers in their real stacking order, and any layer
 *     can be opened on its own, so nothing stays hidden.
 *   - Balloons in one column, numbered top to bottom to match the stack;
 *     leaders are straight, drawn at an angle, and do not cross.
 *   - The desktop is `inert` while apart. Pointing is resolved here with the
 *     same arithmetic that places the layers (camera.ts), because browser
 *     hit-testing through 3D transforms is not reliable. The hit test uses
 *     the stack at rest, not as displaced by the pointer: a layer that moved
 *     out from under the pointer would lose it, come back, and flicker.
 *
 * The camera runs in one requestAnimationFrame loop and writes styles
 * directly: no React render per frame.
 *
 * What keeps it fast (docs/teardown-research.md, section 8, has the traces):
 * a layer is a finished picture that the compositor only moves and fades.
 * So nothing here may change what a big layer looks like while it is moving:
 * no colour is animated on a plate (the highlight is a ring of its own), the
 * loop writes `translate` and `opacity` and nothing else, every piece of a
 * layer is given its own picture in the frame the layer opens instead of one
 * by one as it starts to move, and each write is skipped when the value has
 * not changed.
 */

const RAD = Math.PI / 180;
const VIEW = { rx: 58 * RAD, rz: -38 * RAD };
const RX_MIN = 24 * RAD;
const RX_MAX = 80 * RAD;
/** room kept on the left for the parts list and its notes */
const RAIL_W = 332;
/** how far the stack opens above the layer being pointed at, in gaps */
const LEAF = 0.62;
/** how far the rest of the stack steps away from an opened layer, as a share of the screen's height */
const AWAY = 0.95;
/** seconds for a layer to come apart, and to close again */
const OPEN_S = 0.95;
const SHUT_S = 0.36;

/** The pieces of a layer that is open or closing, and what was changed on the page to move them. */
interface Kit {
  move: Move;
  rise: number;
  layer: HTMLElement | null;
  plate: HTMLElement | null;
  /** real elements of the live desktop */
  live: LivePiece[];
  /** pieces the plate draws */
  slabs: { el: HTMLElement; box: Rect }[];
  /** when each piece starts, 0..1 */
  starts: number[];
  chain: HTMLElement[];
  /** what was on the plate before its pieces rose: the live figures and the lip, which make way */
  body: HTMLElement | null;
  lip: HTMLElement | null;
}

/**
 * Write a style only when it has changed. A settled drawing is rewritten on
 * every frame the camera moves, and most of what is written is the same as
 * the frame before; the browser should not have to find that out.
 */
const written = new WeakMap<HTMLElement, Map<string, string>>();
function put(el: HTMLElement, prop: string, value: string) {
  let have = written.get(el);
  if (!have) written.set(el, (have = new Map()));
  if (have.get(prop) === value) return;
  have.set(prop, value);
  if (value) el.style.setProperty(prop, value);
  else el.style.removeProperty(prop);
}
const clear = (el: HTMLElement, ...props: string[]) => {
  for (const prop of props) el.style.removeProperty(prop);
  written.delete(el);
};

export function Teardown() {
  const on = useTeardown((s) => s.on);
  return on ? <Apart /> : null;
}

function Apart() {
  const { parts, years } = useTeardownModel();
  const hovered = useTeardown((s) => s.hovered);
  const pinned = useTeardown((s) => s.pinned);
  const openedId = useTeardown((s) => s.opened);
  const hotPiece = useTeardown((s) => s.piece);
  const spread = useTeardown((s) => s.spread);
  const closing = useTeardown((s) => s.closing);
  const lens = useTeardown((s) => s.lens);
  const hover = useTeardown((s) => s.hover);
  const pin = useTeardown((s) => s.pin);
  const enter = useTeardown((s) => s.enter);
  const leave = useTeardown((s) => s.leave);
  const setPiece = useTeardown((s) => s.setPiece);
  const setSpread = useTeardown((s) => s.setSpread);
  const setLens = useTeardown((s) => s.setLens);
  const close = useTeardown((s) => s.close);
  const launch = useOS((s) => s.launch);
  const user = useOS((s) => s.user);
  const host = useOS((s) => s.host);
  const reducedSetting = useOS((s) => s.settings.reducedMotion);
  const asOf = useStacksView((s) => s.asOf);

  // a layer that has gone (its window was closed) cannot stay open
  const opened = closing ? null : (parts.find((p) => p.id === openedId)?.id ?? null);
  /** the layer picked out in the stack: under the pointer, or held by the keyboard */
  const selected = closing || opened ? null : (hovered ?? pinned);
  const active = opened ?? selected;

  // the notes follow the pointer a beat late, so sweeping across the stack does not churn them
  const [noted, setNoted] = useState<string | null>(active);
  useEffect(() => {
    if (opened || active === null) {
      setNoted(active);
      return;
    }
    const t = window.setTimeout(() => setNoted(active), 90);
    return () => window.clearTimeout(t);
  }, [active, opened]);

  const part = parts.find((p) => p.id === noted);
  const openPart = parts.find((p) => p.id === opened);
  const numbers = useMemo(() => new Map(parts.map((p, i) => [p.id, String(i + 1).padStart(2, '0')])), [parts]);
  const wires = useMemo(() => (selected ? wiring(parts, selected) : []), [parts, selected]);
  const notedWires = useMemo(() => (noted ? wiring(parts, noted) : []), [parts, noted]);
  const windowCount = parts.filter((p) => p.kind === 'window').length;
  const lensInfo = LENSES.find((l) => l.id === lens) ?? LENSES[0];
  const breakdown = openPart ? BREAKDOWNS[openPart.kind] : null;

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
    selected: selected as string | null,
    opened: opened as string | null,
    wired: new Set<string>(),
    /** the stack's own angle, and what a drag has added to an opened layer's */
    view: { ...VIEW },
    dv: { rx: 0, rz: 0 },
    cam: { ...FLAT } as Cam,
    /** how far each layer is leafed up, stepped away, and come apart: 0..1 each */
    leaf: new Map<string, number>(),
    away: new Map<string, number>(),
    side: new Map<string, number>(),
    openP: new Map<string, number>(),
    kits: new Map<string, Kit>(),
    /** where each balloon is on screen: the near end of its leader */
    rows: new Map<string, [number, number]>(),
    /** what the pointer can hit, top layer first */
    hits: [] as { id: string; q: [number, number][] }[],
    dirty: true,
  });
  live.current.parts = parts;
  live.current.selected = selected;
  if (live.current.opened !== opened) live.current.dv = { rx: 0, rz: 0 };
  live.current.opened = opened;
  live.current.wired = new Set(wires.map((w) => w.id));
  live.current.dirty = true;

  // where the balloons are: measured when the list changes or comes back, not every frame
  useLayoutEffect(() => {
    const measure = () => {
      const rows = new Map<string, [number, number]>();
      for (const [id, el] of rowEls.current) {
        const r = el.getBoundingClientRect();
        if (r.width) rows.set(id, [r.right + 3, r.top + r.height / 2]);
      }
      live.current.rows = rows;
      live.current.dirty = true;
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [parts, lens, opened]);

  // the lens tints the whole drawing
  useEffect(() => {
    const root = document.querySelector<HTMLElement>('.kos');
    if (root) root.dataset.tdLens = lens;
    return () => {
      if (root) delete root.dataset.tdLens;
    };
  }, [lens]);

  // the board's own move is time: its screen rebuilds the record year by year
  const openKind = openPart?.kind;
  const yearsKey = years.join(',');
  useEffect(() => {
    if (openKind !== 'board' || !years.length) return;
    const view = useStacksView.getState();
    if (reducedSetting || prefersReducedMotion()) return;
    let i = -1;
    let step = 0;
    // start once the camera has arrived
    const start = window.setTimeout(() => {
      view.show(years[0] - 1);
      step = window.setInterval(() => {
        i += 1;
        if (i >= years.length) {
          window.clearInterval(step);
          view.show(null);
        } else view.show(years[i]);
      }, 560);
    }, 650);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(step);
      useStacksView.setState({ asOf: null });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openKind, yearsKey, reducedSetting]);

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
    let picks: (number | null)[] = [];
    let picksKey = '';

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
      if ((layer || !p.selector) && plate) tagged.set(p.id, els);
      return els;
    };
    const untag = (els: HTMLElement[]) => {
      for (const e of els) {
        delete e.dataset.tdPart;
        clear(e, 'translate', 'opacity', 'visibility');
      }
    };

    /* ── a layer's own pieces ── */

    const buildKit = (p: Part): Kit => {
      const bd = BREAKDOWNS[p.kind];
      const layer = p.selector ? desk.querySelector<HTMLElement>(p.selector) : null;
      const plate = desk.querySelector<HTMLElement>(`[data-td-plate="${p.id}"]`);
      const W = desk.clientWidth;
      const H = desk.clientHeight;
      const kit: Kit = { move: bd.move, rise: bd.rise, layer, plate, live: [], slabs: [], starts: [], chain: [], body: null, lip: null };
      kit.body = plate?.querySelector<HTMLElement>('.td-body') ?? null;
      kit.lip = plate?.querySelector<HTMLElement>('.td-lip') ?? null;
      if (DRAWN.includes(bd.move)) {
        const els = plate ? [...plate.querySelectorAll<HTMLElement>('[data-td-slab]')] : [];
        kit.slabs = els.map((el, i) => ({ el, box: slabBox(bd.move, i, els.length, W, H) }));
        kit.starts = kit.slabs.map((s, i) => startOf(bd.move, i, els.length, s.box, W, H));
      } else if (layer) {
        kit.live = livePieces(p.kind, layer, desk).pieces;
        kit.starts = kit.live.map((q, i) => startOf(bd.move, i, kit.live.length, q.box, W, H));
        const chain = new Set<HTMLElement>();
        for (const q of kit.live) for (const c of chainOf(q.el, layer)) chain.add(c);
        kit.chain = [...chain];
        for (const c of kit.chain) c.dataset.tdChain = '';
        for (const q of kit.live) q.el.dataset.tdPiece = q.role ?? '';
      }
      if (layer) layer.dataset.tdOpen = '';
      if (plate) plate.dataset.tdOpen = '';
      return kit;
    };
    const dropKit = (kit: Kit) => {
      for (const q of kit.live) {
        clear(q.el, 'translate', 'rotate');
        delete q.el.dataset.tdPiece;
      }
      for (const s of kit.slabs) clear(s.el, 'translate', 'rotate', 'opacity');
      for (const c of kit.chain) delete c.dataset.tdChain;
      for (const f of kit.plate?.querySelectorAll<HTMLElement>('[data-td-flag]') ?? []) clear(f, 'translate', 'opacity');
      if (kit.body) clear(kit.body, 'opacity', 'visibility');
      if (kit.lip) clear(kit.lip, 'opacity', 'visibility');
      if (kit.layer) delete kit.layer.dataset.tdOpen;
      if (kit.plate) delete kit.plate.dataset.tdOpen;
    };
    const kitOk = (kit: Kit) =>
      kit.live.every((q) => q.el.isConnected) && kit.slabs.every((s) => s.el.isConnected) && (!DRAWN.includes(kit.move) || kit.slabs.length > 0);

    /** put every piece of a kit where it belongs at progress P */
    const placeKit = (kit: Kit, P: number, W: number, H: number) => {
      const n = kit.slabs.length || kit.live.length;
      const top: number[] = [];
      for (let i = 0; i < n; i++) {
        const q = kit.live[i];
        const el = q ? q.el : kit.slabs[i].el;
        const at = pose(kit.move, i, n, local(P, kit.starts[i] ?? 0), kit.rise, W, H, q?.role);
        put(el, 'translate', `${at.x.toFixed(1)}px ${at.y.toFixed(1)}px ${at.z.toFixed(1)}px`);
        put(el, 'rotate', at.rx ? `x ${at.rx.toFixed(1)}deg` : at.rz ? `${at.rz.toFixed(1)}deg` : '');
        if (!q) put(el, 'opacity', at.o.toFixed(2));
        else top[q.group] = Math.max(top[q.group] ?? 0, at.z);
      }
      // a flag rides at the height of the group it names, and appears as the layer opens
      for (const f of kit.plate?.querySelectorAll<HTMLElement>('[data-td-flag]') ?? []) {
        put(f, 'translate', `0 0 ${(top[+f.dataset.tdFlag!] ?? 0).toFixed(1)}px`);
        put(f, 'opacity', P.toFixed(2));
      }
      // what was on the plate makes way for the pieces, and once gone is not drawn at all
      for (const e of [kit.body, kit.lip]) {
        if (!e) continue;
        put(e, 'opacity', Math.max(0, 1 - P * 1.6).toFixed(2));
        put(e, 'visibility', P * 1.6 >= 1 ? 'hidden' : '');
      }
    };

    const restore = () => {
      for (const kit of L.kits.values()) dropKit(kit);
      L.kits.clear();
      for (const els of tagged.values()) untag(els);
      tagged.clear();
      desk.style.transform = '';
      desk.inert = false;
      delete root.dataset.teardown;
      delete root.dataset.tdOpen;
    };

    const frameFn = (now: number) => {
      raf = 0;
      // the easing is exponential, so a long frame is safe: it just takes a bigger step
      const dt = Math.min(0.5, (now - last) / 1000);
      last = now;
      const st = useTeardown.getState();
      const W = desk.clientWidth;
      const H = desk.clientHeight;
      const { z, units } = heights(L.parts);
      const cam = L.cam;
      const opened = st.closing ? null : L.opened;
      const openIndex = L.parts.findIndex((p) => p.id === opened);
      const openPart = openIndex < 0 ? null : L.parts[openIndex];
      const selIndex = opened ? -1 : L.parts.findIndex((p) => p.id === L.selected);
      let moved = L.dirty;

      /* ── how far each layer is leafed, away, and open ── */
      for (let i = 0; i < L.parts.length; i++) {
        const id = L.parts[i].id;
        const step = (map: Map<string, number>, want: number, tau: number) => {
          const have = map.get(id) ?? 0;
          let next = still() ? want : ease(have, want, dt, tau);
          if (Math.abs(next - want) < 0.002) next = want;
          if (next !== have) moved = true;
          map.set(id, next);
          return next;
        };
        // everything above the layer being pointed at lifts, which opens the stack at that layer
        step(L.leaf, selIndex >= 0 && i < selIndex && !st.closing ? 1 : 0, 0.13);
        // which way a layer steps away is remembered, so it comes back the way it went
        if (openPart && id !== openPart.id) L.side.set(id, i < openIndex ? 1 : -1);
        step(L.away, openPart && id !== openPart.id ? 1 : 0, openPart ? 0.17 : 0.14);

        // coming apart runs on a clock, so its pieces can start one after another
        const have = L.openP.get(id) ?? 0;
        const want = openPart?.id === id ? 1 : 0;
        const next = still() ? want : want > have ? Math.min(1, have + dt / OPEN_S) : Math.max(0, have - dt / SHUT_S);
        if (next !== have) moved = true;
        L.openP.set(id, next);
      }

      /* ── where the camera is headed ── */
      // the right of the stack is left clear for the index tabs
      const area = { x0: RAIL_W + 52, y0: 64, x1: W - Math.min(230, W * 0.16), y1: H - 58 };
      const mid = (area.y0 + area.y1) / 2 - H / 2;
      const f = fit(W, H, area, L.view.rx, L.view.rz, units, st.spread);
      let to: Cam;
      if (st.closing) {
        // close the stack up first, then lay it flat
        to = cam.g > f.g * 0.18 && !still() ? { ...cam, g: 0 } : FLAT;
      } else if (openPart) {
        // the layer's own screen: its angle, and room for its pieces at their furthest
        const bd = BREAKDOWNS[openPart.kind];
        const rx = Math.max(RX_MIN * 0.5, Math.min(RX_MAX, bd.rx * RAD + L.dv.rx));
        const rz = Math.max(-1.3, Math.min(1.3, bd.rz * RAD + L.dv.rz));
        const kit = L.kits.get(openPart.id);
        // a panel is a sliver: frame it with some of the glass under it, or it would fill the screen edge to edge
        const rect = openPart.kind === 'panel' ? { x: 0, y: 0, w: W, h: H * 0.34 } : openPart.rect;
        const pts = reach(bd.move, rect, (z.get(openPart.id) ?? 0) * f.g, bd.rise, kit?.slabs.map((s) => s.box) ?? [], W, H);
        const fr = frame(W, H, { x0: RAIL_W + 64, y0: 150, x1: W - 84, y1: H - 86 }, rx, rz, pts, 1.1);
        to = { rx, rz, s: fr.s, tx: fr.tx, ty: fr.ty, g: f.g };
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
        const tau = openPart || L.kits.size ? 0.19 : 0.13;
        cam.rx = ease(cam.rx, to.rx, dt, tau);
        cam.rz = ease(cam.rz, to.rz, dt, tau);
        cam.s = ease(cam.s, to.s, dt, tau);
        cam.tx = ease(cam.tx, to.tx, dt, tau);
        cam.ty = ease(cam.ty, to.ty, dt, tau);
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

      moved =
        moved ||
        Math.abs(cam.rx - prev.rx) + Math.abs(cam.rz - prev.rz) + Math.abs(cam.s - prev.s) > 1e-5 ||
        Math.abs(cam.tx - prev.tx) + Math.abs(cam.ty - prev.ty) + Math.abs(cam.g - prev.g) > 0.01;

      if (moved) {
        L.dirty = false;
        desk.style.transform = `translate(${cam.tx.toFixed(2)}px, ${cam.ty.toFixed(2)}px) rotateX(${cam.rx.toFixed(5)}rad) rotateZ(${cam.rz.toFixed(5)}rad) scale3d(${cam.s.toFixed(5)}, ${cam.s.toFixed(5)}, ${cam.s.toFixed(5)})`;
        // the plates fade in as the stack opens
        const plateIn = Math.min(1, cam.g / Math.max(1, f.g * 0.5));
        if (opened && root.dataset.tdOpen === undefined) root.dataset.tdOpen = '';
        else if (!opened && root.dataset.tdOpen !== undefined) delete root.dataset.tdOpen;
        const scale = cam.s.toFixed(2) + ' : 1';
        if (scaleEl.current && scaleEl.current.textContent !== scale) scaleEl.current.textContent = scale;

        const ids = new Set(L.parts.map((p) => p.id));
        for (const [id, els] of tagged) {
          if (ids.has(id)) continue;
          untag(els);
          tagged.delete(id);
        }
        for (const [id, kit] of L.kits) {
          if (ids.has(id)) continue;
          dropKit(kit);
          L.kits.delete(id);
        }

        const hits: { id: string; q: [number, number][] }[] = [];
        const rest: [number, number][][] = [];
        const outlines = new Map<string, [number, number][]>();
        for (const p of L.parts) {
          const base = (z.get(p.id) ?? 0) * cam.g;
          const away = L.away.get(p.id) ?? 0;
          const zpx = base + (L.leaf.get(p.id) ?? 0) * LEAF * cam.g + (L.side.get(p.id) ?? 1) * away * away * AWAY * H;
          const o = (1 - away) * (1 - away);
          const isActive = (opened ?? L.selected) === p.id;
          const isWired = L.wired.has(p.id);
          const lift = `0 0 ${zpx.toFixed(1)}px`;
          // a layer that has stepped right away is not painted at all
          const hide = o < 0.02 && openPart?.id !== p.id ? 'hidden' : '';
          for (const e of elementsOf(p)) {
            put(e, 'translate', lift);
            put(e, 'visibility', hide);
            put(e, 'opacity', (e.dataset.tdPlate !== undefined ? o * plateIn : o).toFixed(2));
          }
          // the highlight ring exists only while its layer is picked or wired (Plates.tsx): keep it at the layer's height
          if (isActive || isWired) {
            const ring = desk.querySelector<HTMLElement>(`[data-td-ring="${p.id}"]`);
            if (ring) put(ring, 'translate', lift);
          }

          // its own pieces, while it is open or closing
          const P = L.openP.get(p.id) ?? 0;
          let kit = L.kits.get(p.id);
          if (P > 0 || openPart?.id === p.id) {
            if (kit && !kitOk(kit)) {
              dropKit(kit);
              kit = undefined;
            }
            if (!kit) {
              kit = buildKit(p);
              L.kits.set(p.id, kit);
            }
            placeKit(kit, P, W, H);
          } else if (kit) {
            placeKit(kit, 0, W, H);
            dropKit(kit);
            L.kits.delete(p.id);
          }

          // pointing is resolved against the stack at rest
          for (const r of p.hits ?? [p.rect]) hits.push({ id: p.id, q: quad(cam, W, H, r, 0, base) });
          rest.push(quad(cam, W, H, p.rect, 0, base));
          outlines.set(p.id, quad(cam, W, H, p.rect, 0, zpx));
        }
        L.hits = opened ? [] : hits;

        // a layer's own screen has no stack to draw lines to: leave them alone, they are not shown
        if (!opened) {
          // the leaders: from each balloon to its part, never crossing. Which corner each one
          // aims at is decided on the stack at rest and only when the camera has really moved,
          // so a leader follows its layer and never changes its mind mid-movement
          const rows = L.parts.map((p) => L.rows.get(p.id));
          const key = [L.parts.map((p) => p.id).join(), L.rows.size, to.rx.toFixed(2), to.rz.toFixed(2), to.s.toFixed(2), (to.g / 8).toFixed(0)].join('|');
          if (key !== picksKey || picks.length !== L.parts.length) {
            picks = leaderPicks(rows, rest);
            picksKey = key;
          }
          L.parts.forEach((p, i) => {
            const path = leaderEls.current.get(p.id);
            const row = rows[i];
            const k = picks[i];
            if (!path || !row || k === null || k === undefined) return;
            const a = spots(outlines.get(p.id)!)[k];
            path.setAttribute(
              'd',
              `M${row[0].toFixed(1)} ${row[1].toFixed(1)}L${a[0].toFixed(1)} ${a[1].toFixed(1)}` +
                `M${(a[0] + 3).toFixed(1)} ${a[1].toFixed(1)}a3 3 0 1 0 -6 0a3 3 0 1 0 6 0`,
            );
          });

          // the wiring: from the picked part to each part it depends on, or that depends on it.
          // A wire leaves the middle of the picked part and lands on the near corner of the other,
          // the corner that is in view while it sits in the stack.
          const from = L.selected ? outlines.get(L.selected) : undefined;
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
      }
      raf = requestAnimationFrame(frameFn);
    };
    raf = requestAnimationFrame(frameFn);

    // the desktop's own shortcuts stay out of the way while it is apart
    const onKey = (e: KeyboardEvent) => {
      const st = useTeardown.getState();
      const inField = e.target instanceof HTMLInputElement;
      const list = L.parts;
      const openNow = list.some((p) => p.id === st.opened) ? st.opened : null;
      const at = list.findIndex((p) => p.id === (openNow ?? st.pinned ?? st.hovered));
      const step = (d: number) => {
        const next = list[Math.max(0, Math.min(list.length - 1, at < 0 ? (d > 0 ? 0 : list.length - 1) : at + d))];
        if (!next) return;
        // on a layer's screen the arrows turn to the next layer's screen
        if (openNow) return st.enter(next.id);
        st.hover(null);
        st.pin(next.id);
        rowEls.current.get(next.id)?.closest('button')?.focus({ preventScroll: true });
      };
      if (e.type === 'keydown') {
        const k = e.key.toLowerCase();
        if (e.ctrlKey && e.altKey && k === 'x') {
          e.preventDefault();
          st.close();
        } else if (e.key === 'Escape') {
          // one level at a time: out of the layer, then out of the teardown
          e.preventDefault();
          if (openNow) st.leave();
          else st.close();
        } else if (inField || e.ctrlKey || e.metaKey || e.altKey) {
          // leave fields and browser chords alone
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          step(1);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          step(-1);
        } else if ((e.key === 'ArrowRight' || (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement))) && !openNow && at >= 0) {
          e.preventDefault();
          st.enter(list[at].id);
        } else if ((e.key === 'ArrowLeft' || e.key === 'Backspace') && openNow) {
          e.preventDefault();
          st.leave();
        } else if (e.key === '+' || e.key === '=') st.setSpread(st.spread * 1.15);
        else if (e.key === '-') st.setSpread(st.spread / 1.15);
        else if (e.key === '1' || e.key === '2' || e.key === '3') st.setLens(LENSES[+e.key - 1].id);
        else if (e.key === '0' || k === 'r') {
          L.view = { ...VIEW };
          L.dv = { rx: 0, rz: 0 };
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
    const L = live.current;
    const from = L.opened ? L.dv : L.view;
    drag.current = { x: e.clientX, y: e.clientY, rx: from.rx, rz: from.rz, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const L = live.current;
    if (!d) {
      if (!L.opened) hover(hitAt(e.clientX, e.clientY));
      return;
    }
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.abs(dx) + Math.abs(dy) < 5) return;
    d.moved = true;
    hover(null);
    if (L.opened) {
      // an opened layer turns about the angle it was given
      L.dv = { rz: Math.max(-0.9, Math.min(0.9, d.rz + dx * 0.006)), rx: Math.max(-0.6, Math.min(0.6, d.rx - dy * 0.005)) };
    } else {
      L.view = {
        rz: Math.max(-1.25, Math.min(1.25, d.rz + dx * 0.006)),
        rx: Math.max(RX_MIN, Math.min(RX_MAX, d.rx - dy * 0.005)),
      };
    }
    L.dirty = true;
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.moved) return;
    // a click on a layer opens it; a click on the empty sheet steps back out
    if (live.current.opened) return leave();
    const id = hitAt(e.clientX, e.clientY);
    if (id) enter(id);
    else pin(null);
  };
  const resetView = () => {
    live.current.view = { ...VIEW };
    live.current.dv = { rx: 0, rz: 0 };
    live.current.dirty = true;
    setSpread(1);
  };
  const openSubject = (subjectId: string) => {
    close();
    // let the layers close up before the record opens over them
    window.setTimeout(() => launch('stacks', { subjectId }), 620);
  };
  const turnTo = (d: number) => {
    const at = parts.findIndex((p) => p.id === opened);
    const next = parts[at + d];
    if (next) enter(next.id);
  };

  const reading = part?.anatomy[lens];
  const others = LENSES.filter((l) => l.id !== lens);
  const openAt = parts.findIndex((p) => p.id === opened);
  const pieceCount = breakdown && DRAWN.includes(breakdown.move) ? MAX_SLABS : 0;

  return (
    <div
      ref={hud}
      className={'td-hud' + (ready ? ' ready' : '') + (closing ? ' closing' : '') + (opened ? ' opened' : '')}
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
        onWheel={(e) => !opened && setSpread(spread * Math.exp(-e.deltaY * 0.0012))}
      />

      <svg className="td-lines" aria-hidden="true">
        <path className="td-rods" ref={rodsEl} />
        {parts.map((p) => (
          <path
            key={p.id}
            className={'td-leader' + (selected === p.id ? ' on' : '') + (wires.some((w) => w.id === p.id) ? ' wired' : '')}
            ref={(el) => {
              if (el) leaderEls.current.set(p.id, el);
              else leaderEls.current.delete(p.id);
            }}
          />
        ))}
        {wires.map((w) => (
          <Fragment key={selected + '>' + w.id}>
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

      {/* a layer's own screen: what it is called, and how it is coming apart */}
      {openPart && breakdown && (
        <header className="td-screen" key={openPart.id}>
          <p>
            <b>{numbers.get(openPart.id)}</b>
            {openPart.name} · {lensInfo.short}
          </p>
          <h1>{openPart.anatomy[lens].name}</h1>
          <p className="td-screen-move">
            <i>{breakdown.title}</i>
            {openPart.kind === 'board' && asOf !== null ? `The record as it stood at the end of ${asOf}.` : breakdown.caption}
          </p>
        </header>
      )}

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

        {openPart && (
          <nav className="td-crumb" aria-label="Layer">
            <button type="button" className="td-btn" onClick={leave} title="Back to the whole stack (Esc)">
              ← Stack
            </button>
            <span>
              <b>{numbers.get(openPart.id)}</b> of {String(parts.length).padStart(2, '0')}
            </span>
            <button type="button" className="td-btn step" onClick={() => turnTo(-1)} disabled={openAt <= 0} aria-label="The layer above" title="The layer above (↑)">
              ↑
            </button>
            <button
              type="button"
              className="td-btn step"
              onClick={() => turnTo(1)}
              disabled={openAt >= parts.length - 1}
              aria-label="The layer below"
              title="The layer below (↓)"
            >
              ↓
            </button>
          </nav>
        )}

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
                  className={(selected === p.id ? 'on ' : '') + (pinned === p.id ? 'pinned ' : '') + (wires.some((w) => w.id === p.id) ? 'wired' : '')}
                  title="Open this layer's own screen"
                  onPointerEnter={() => hover(p.id)}
                  onFocus={() => pin(p.id)}
                  onClick={() => enter(p.id)}
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
            <div className="td-card" key={part.id + lens}>
              <p className="td-detail-n">
                {numbers.get(part.id)} · {part.name} · {lensInfo.short}
              </p>
              <h2>{reading.name}</h2>
              <p className="td-detail-gist">{reading.gist}</p>
              {!opened && (
                <button type="button" className="td-btn open" onClick={() => enter(part.id)}>
                  Open this layer <kbd>click</kbd>
                </button>
              )}
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
              <dl className="td-pieces" onPointerLeave={() => setPiece(null)}>
                {reading.pieces.map(([name, what], i) => (
                  <div
                    key={name}
                    className={opened && i < pieceCount ? (hotPiece === i ? 'piece hot' : 'piece') : undefined}
                    onPointerEnter={() => opened && setPiece(i < pieceCount ? i : null)}
                  >
                    <dt>
                      {opened && i < pieceCount && <b>{i + 1}</b>}
                      {name}
                    </dt>
                    <dd>{what}</dd>
                  </div>
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

              {notedWires.length > 0 && (
                <>
                  <h3>Wired to</h3>
                  <ul className="td-wires">
                    {notedWires.map((w) => {
                      const other = parts.find((p) => p.id === w.id);
                      if (!other) return null;
                      return (
                        <li key={w.id} className={w.dir === 'uses' ? 'out' : 'in'}>
                          <button type="button" onClick={() => (opened ? enter(w.id) : pin(w.id))} title={opened ? `Open ${other.name}` : `Pick ${other.name}`}>
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
              {part.action && opened === part.id && (
                <button type="button" className="td-btn" onClick={part.action.run}>
                  {part.action.label}
                </button>
              )}
            </div>
          ) : (
            <div className="td-card" key="intro">
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
                Point at a layer and the stack opens above it. <b>Click it</b> and it gets a screen of its own, where
                it comes apart in its own way. Keys 1, 2 and 3 change the reading.
              </p>
            </div>
          )}
        </aside>
      </div>

      <footer className="td-controls">
        <span className="td-hint">
          {opened
            ? 'Drag to turn · ↑ ↓ the next layer · Esc back to the stack · 1 2 3 change the reading'
            : 'Point to leaf through · click a layer to open it · drag to turn · scroll to spread · 1 2 3 change the reading'}
        </span>
        {!opened && (
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
        )}
        <button type="button" className="td-btn" onClick={resetView}>
          Reset view
        </button>
        {opened && (
          <button type="button" className="td-btn" onClick={leave}>
            Back to the stack <kbd>Esc</kbd>
          </button>
        )}
        <button type="button" className="td-btn primary" onClick={() => close()}>
          Reassemble {opened ? <kbd>Ctrl Alt X</kbd> : <kbd>Esc</kbd>}
        </button>
      </footer>

      {/* the drawing's title block */}
      <div className="td-block" aria-hidden="true">
        <KaliMark size={30} className="td-block-mark" />
        <dl>
          <dt>Drawing</dt>
          <dd>{openPart ? `${openPart.name}, taken apart` : 'Kali desktop, exploded'}</dd>
          <dt>Read as</dt>
          <dd className="lens">{lensInfo.label}</dd>
          <dt>{openPart ? 'Move' : 'Scale'}</dt>
          {/* the scale is written by the camera loop; the move's name replaces it on a layer's screen */}
          <dd ref={openPart ? undefined : scaleEl}>{openPart && breakdown ? breakdown.title : '1.00 : 1'}</dd>
          <dt>Sheet</dt>
          <dd>
            {openPart ? `${numbers.get(openPart.id)} of ${parts.length}` : `${parts.length} parts`} · drawn live
          </dd>
        </dl>
      </div>
    </div>
  );
}
