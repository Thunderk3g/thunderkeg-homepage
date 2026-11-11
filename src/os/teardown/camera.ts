/**
 * Teardown camera: the arithmetic behind the exploded view.
 *
 * The desktop element is transformed with
 *
 *   translate(tx, ty) rotateX(rx) rotateZ(rz) scale3d(s, s, s)
 *
 * inside a parent with `perspective: PERSPECTIVE`, and each layer is raised
 * by `translate: x 0 z`. project() repeats that arithmetic so the leader
 * lines and the hit test land exactly where the browser paints, without
 * measuring the DOM on every frame.
 *
 * Pure functions, no DOM: scripts/teardown-camera.test.mts checks them.
 */
export const PERSPECTIVE = 3200;

export interface Cam {
  /** tilt back, radians */
  rx: number;
  /** turn, radians */
  rz: number;
  s: number;
  tx: number;
  ty: number;
  /** one unit of gap between layers, px in desktop space */
  g: number;
}

export const FLAT: Cam = { rx: 0, rz: 0, s: 1, tx: 0, ty: 0, g: 0 };

/** A point on a layer (desktop px, z up from the desktop plane) → screen px. */
export function project(cam: Cam, W: number, H: number, x: number, y: number, z: number): [number, number] {
  const px = (x - W / 2) * cam.s;
  const py = (y - H / 2) * cam.s;
  const pz = z * cam.s;
  const cz = Math.cos(cam.rz);
  const sz = Math.sin(cam.rz);
  const x1 = px * cz - py * sz;
  const y1 = px * sz + py * cz;
  const cx = Math.cos(cam.rx);
  const sx = Math.sin(cam.rx);
  const y2 = y1 * cx - pz * sx;
  const z2 = y1 * sx + pz * cx;
  const f = PERSPECTIVE / (PERSPECTIVE - z2);
  return [W / 2 + (x1 + cam.tx) * f, H / 2 + (y2 + cam.ty) * f];
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The four corners of a rectangle on a layer, on screen: top-left, top-right, bottom-right, bottom-left. */
export function quad(cam: Cam, W: number, H: number, r: Rect, dx: number, z: number): [number, number][] {
  return [
    project(cam, W, H, r.x + dx, r.y, z),
    project(cam, W, H, r.x + r.w + dx, r.y, z),
    project(cam, W, H, r.x + r.w + dx, r.y + r.h, z),
    project(cam, W, H, r.x + dx, r.y + r.h, z),
  ];
}

export function inQuad(q: [number, number][], x: number, y: number): boolean {
  let hit = false;
  for (let i = 0, j = q.length - 1; i < q.length; j = i++) {
    const [xi, yi] = q[i];
    const [xj, yj] = q[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

export interface Area {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Scale, gap and offset that stand the whole exploded stack inside `area`.
 * `units` is the stack's height in gaps. The stack always fits: `spread`
 * decides how the height is shared between the plates' own footprint and the
 * air between them, so more spread means smaller plates further apart.
 */
export function fit(W: number, H: number, area: Area, rx: number, rz: number, units: number, spread: number) {
  const c = Math.abs(Math.cos(rz));
  const sn = Math.abs(Math.sin(rz));
  const aw = area.x1 - area.x0;
  const ah = area.y1 - area.y0;
  const footW = W * c + H * sn;
  const footH = (W * sn + H * c) * Math.cos(rx);
  const share = Math.max(0.15, Math.min(0.74, 0.4 / spread));
  let s = Math.max(0.12, Math.min(0.8, aw / footW, (ah * share) / Math.max(1, footH)));
  const rise = Math.sin(rx) * s; // screen px per px of height
  const room = Math.max(24, ah - footH * s);
  let g = room / Math.max(1, units) / Math.max(0.05, rise);
  let tx = (area.x0 + area.x1) / 2 - W / 2;
  let ty = (area.y0 + area.y1) / 2 - H / 2 + (units * g * rise) / 2;

  // That was the flat arithmetic. Perspective swells whatever is near the
  // eye, so measure the stack as it will really be drawn and correct for it.
  const full = { x: 0, y: 0, w: W, h: H };
  for (let i = 0; i < 3; i++) {
    const cam = { rx, rz, s, tx, ty, g };
    const pts = [...quad(cam, W, H, full, 0, 0), ...quad(cam, W, H, full, 0, units * g)];
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const bw = Math.max(...xs) - Math.min(...xs);
    const bh = Math.max(...ys) - Math.min(...ys);
    const k = Math.min(1, aw / bw, ah / bh);
    s *= k;
    g *= k;
    tx += (area.x0 + area.x1) / 2 - (Math.max(...xs) + Math.min(...xs)) / 2;
    ty += (area.y0 + area.y1) / 2 - (Math.max(...ys) + Math.min(...ys)) / 2;
  }
  return { s, g, tx, ty };
}

/** Do the segments a–b and c–d cross? Touching at an end does not count. */
export function crosses(a: [number, number], b: [number, number], c: [number, number], d: [number, number]): boolean {
  const side = (p: [number, number], q: [number, number], r: [number, number]) =>
    Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
}

/**
 * Scale and offset that stand a set of points (desktop px, z up) inside
 * `area` at a given tilt and turn: the camera for one layer's own screen.
 * Measured the way it will be drawn, so perspective is accounted for.
 */
export function frame(W: number, H: number, area: Area, rx: number, rz: number, pts: [number, number, number][], sMax = 1.15) {
  const aw = area.x1 - area.x0;
  const ah = area.y1 - area.y0;
  let s = 0.5;
  let tx = 0;
  let ty = 0;
  for (let i = 0; i < 6; i++) {
    const cam = { rx, rz, s, tx, ty, g: 0 };
    const on = pts.map((p) => project(cam, W, H, p[0], p[1], p[2]));
    const xs = on.map((p) => p[0]);
    const ys = on.map((p) => p[1]);
    const bw = Math.max(1, Math.max(...xs) - Math.min(...xs));
    const bh = Math.max(1, Math.max(...ys) - Math.min(...ys));
    const k = Math.min(aw / bw, ah / bh, sMax / s);
    s *= k;
    // the offsets are in screen space before perspective: scale them with the picture, then re-centre
    tx = tx * k + ((area.x0 + area.x1) / 2 - W / 2 - ((Math.max(...xs) + Math.min(...xs)) / 2 - W / 2) * k);
    ty = ty * k + ((area.y0 + area.y1) / 2 - H / 2 - ((Math.max(...ys) + Math.min(...ys)) / 2 - H / 2) * k);
  }
  return { s, tx, ty };
}

/** The eight places a leader may land on a part: its corners, then the middle of each edge. */
export function spots(q: [number, number][]): [number, number][] {
  return [...q, ...q.map((c, k): [number, number] => [(c[0] + q[(k + 1) % 4][0]) / 2, (c[1] + q[(k + 1) % 4][1]) / 2])];
}

/**
 * Which spot each leader lands on. A leader runs from its balloon to the edge
 * of its part, and leaders must not cross (ISO 6433). Each part offers its
 * corners and edge midpoints, nearest the balloons first. The widest parts
 * are placed first, since full plates share one clean column of corners; then
 * any leader still crossing another is re-aimed at whichever of its spots
 * crosses least. `rows` and `quads` are in the same order, top part first.
 *
 * The answer is an index into spots(), so it can be worked out once on the
 * stack at rest and then followed while a layer moves: a leader that changed
 * its mind mid-movement would jump.
 */
export function leaderPicks(rows: ([number, number] | undefined)[], quads: [number, number][][]): (number | null)[] {
  type Pt = [number, number];
  const width = (q: Pt[]) => Math.max(...q.map((c) => c[0])) - Math.min(...q.map((c) => c[0]));
  const all = quads.map(spots);
  // each part's spots, leftmost (nearest the balloons) first
  const tryOrder = all.map((sp) => sp.map((_, k) => k).sort((m, n) => sp[m][0] - sp[n][0]));
  const pick: (number | null)[] = quads.map(() => null);
  /** how many placed leaders part i would cross if it aimed at spot k */
  const cost = (i: number, k: number) => {
    let n = 0;
    for (let j = 0; j < quads.length; j++) {
      const pj = pick[j];
      if (j === i || pj === null) continue;
      if (crosses(rows[i]!, all[i][k], rows[j]!, all[j][pj])) n++;
    }
    return n;
  };
  const best = (i: number) => {
    let at = tryOrder[i][0];
    let least = Infinity;
    for (const k of tryOrder[i]) {
      const c = cost(i, k);
      if (c < least) {
        least = c;
        at = k;
      }
      if (least === 0) break;
    }
    return at;
  };

  const order = quads.map((_, i) => i).filter((i) => rows[i]).sort((i, j) => width(quads[j]) - width(quads[i]) || i - j);
  for (const i of order) pick[i] = best(i);
  // re-aim anything still crossing; a few rounds settle it or it cannot be settled
  for (let round = 0; round < 4; round++) {
    let changed = false;
    for (const i of order) {
      if (cost(i, pick[i]!) === 0) continue;
      const k = best(i);
      if (k !== pick[i]) {
        pick[i] = k;
        changed = true;
      }
    }
    if (!changed) break;
  }
  return pick;
}

/** Where each leader lands, as points. */
export function leaderEnds(rows: ([number, number] | undefined)[], quads: [number, number][][]): ([number, number] | null)[] {
  const pick = leaderPicks(rows, quads);
  return quads.map((q, i) => (pick[i] === null ? null : spots(q)[pick[i]!]));
}

/** Frame-rate independent easing toward a target. */
export const ease = (v: number, to: number, dt: number, tau: number) => v + (to - v) * (1 - Math.exp(-dt / tau));
