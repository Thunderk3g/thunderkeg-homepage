import type { LayerKind, Lens } from './anatomy';
import type { Rect } from './camera';

/**
 * Each layer of the stack has its own screen, and on it the layer comes apart
 * in its own way. The stack is one explosion along one axis; a layer's screen
 * is a second, smaller explosion whose shape says something about the layer:
 *
 *   panel     keys      every plugin lifts out of the bar, like keys off a keyboard
 *   window    lid       title bar, client area and frame part like a sandwich
 *   desk      popup     the icons and the card stand up, like a pop-up book
 *   board     replay    the record is rebuilt year by year
 *   wall      fan       the layer's components fan out like paint swatches
 *   display   sheets    full-size sheets separate, like the planes of a picture
 *   session   cascade   cards step out diagonally, like a cascade of windows
 *   fs        drawers   slabs slide out in a staircase, like a filing cabinet
 *   kernel    rings     concentric rings rise to a ziggurat, the first component on top
 *   hardware  chips     chips lift off the board to different heights
 *
 * This file is the arithmetic only (no DOM): where each piece rests, where it
 * goes, when it starts, and what the camera has to keep in frame.
 * scripts/teardown-breakdowns.test.mts checks it.
 */

export type Move = 'keys' | 'lid' | 'popup' | 'replay' | 'fan' | 'sheets' | 'cascade' | 'drawers' | 'rings' | 'chips' | 'none';

export interface Breakdown {
  move: Move;
  /** the move's name, for the title block */
  title: string;
  /** one line under the screen's title: what is being shown */
  caption: string;
  /** the camera for this layer's screen, in degrees */
  rx: number;
  rz: number;
  /** how high the pieces rise, desktop px */
  rise: number;
}

export const BREAKDOWNS: Record<LayerKind, Breakdown> = {
  panel: { move: 'keys', title: 'Keys', caption: 'A panel is a row of plugins. Each one lifts out of the bar.', rx: 47, rz: -12, rise: 120 },
  window: { move: 'lid', title: 'Lid', caption: 'A window is three things: the frame, the title bar the window manager draws, and the app inside.', rx: 57, rz: -30, rise: 210 },
  nowindows: { move: 'none', title: 'Empty', caption: 'Nothing is open on this workspace, so this layer is only a place.', rx: 58, rz: -38, rise: 0 },
  desk: { move: 'popup', title: 'Pop-up', caption: 'The launchers and the card stand up off the desktop.', rx: 60, rz: -22, rise: 120 },
  board: { move: 'replay', title: 'Replay', caption: 'The record, rebuilt one year at a time.', rx: 20, rz: -6, rise: 0 },
  wall: { move: 'fan', title: 'Fan', caption: 'What a wallpaper is made of, fanned out like swatches.', rx: 50, rz: -34, rise: 190 },
  display: { move: 'sheets', title: 'Sheets', caption: 'Everything between a picture and the glass, one sheet each.', rx: 66, rz: -42, rise: 420 },
  session: { move: 'cascade', title: 'Cascade', caption: 'What is running, stepped out like a cascade of windows.', rx: 54, rz: -32, rise: 130 },
  fs: { move: 'drawers', title: 'Drawers', caption: 'Where things are kept, pulled out like the drawers of a cabinet.', rx: 60, rz: -48, rise: 300 },
  kernel: { move: 'rings', title: 'Rings', caption: 'Its components as rings, stepping up to the one at the centre.', rx: 52, rz: -45, rise: 330 },
  hardware: { move: 'chips', title: 'Chips', caption: 'The parts on the board, lifted off it.', rx: 58, rz: -26, rise: 200 },
};

/** Moves whose pieces are drawn by the plate from the layer's components, rather than found in the live desktop. */
export const DRAWN: Move[] = ['fan', 'sheets', 'cascade', 'drawers', 'rings', 'chips'];

/** At most this many components become pieces. */
export const MAX_SLABS = 6;

/* ───────────────────────── live pieces ───────────────────────── */

/**
 * The parts of a live layer that lift out, as selectors inside the layer's
 * element, each named under the three readings.
 */
export interface Group {
  sel: string;
  names: Record<Lens, string>;
  /** where its label sits relative to the group */
  flag: 'below' | 'right' | 'above';
  /** how the group's elements move, where a move has more than one way */
  role?: 'title' | 'body' | 'stand' | 'lift';
}

export const GROUPS: Partial<Record<LayerKind, Group[]>> = {
  panel: [
    { sel: '.kos-panel-menu', names: { kali: 'Whisker Menu', site: 'menu', llm: 'tool menu' }, flag: 'below' },
    { sel: '.kos-panel-launcher', names: { kali: 'launchers', site: 'launchers', llm: 'pinned tools' }, flag: 'below' },
    { sel: '.kos-pager', names: { kali: 'workspace switcher', site: 'pager', llm: 'sessions' }, flag: 'below' },
    { sel: '.kos-task', names: { kali: 'window buttons', site: 'task list', llm: 'traces' }, flag: 'below' },
    { sel: '.kos-panel-hire', names: { kali: 'a custom plugin', site: 'open to work', llm: 'status line' }, flag: 'below' },
    { sel: '.kos-cpugraph', names: { kali: 'CPU graph', site: 'load graph', llm: 'latency' }, flag: 'below' },
    { sel: '.kos-tray-item', names: { kali: 'status tray', site: 'tray', llm: 'cost meters' }, flag: 'below' },
    { sel: '.kos-tray-clock', names: { kali: 'clock', site: 'clock', llm: 'timestamps' }, flag: 'below' },
  ],
  window: [
    { sel: ':scope > .kos-titlebar', names: { kali: 'title bar · drawn by xfwm4', site: 'title bar · Window.tsx', llm: 'the tool’s name' }, flag: 'right', role: 'title' },
    { sel: ':scope > .kos-window-body', names: { kali: 'client area · the app draws this', site: 'the app’s component', llm: 'the tool’s output' }, flag: 'right', role: 'body' },
  ],
  desk: [
    { sel: '.kos-desk-icon', names: { kali: 'launchers · xfdesktop', site: 'app registry, as icons', llm: 'the tool list' }, flag: 'right', role: 'stand' },
    { sel: '.kos-welcome', names: { kali: 'Conky-style card', site: 'welcome card', llm: 'the system prompt' }, flag: 'above', role: 'stand' },
    { sel: '.kos-stacks-bar', names: { kali: 'a desktop widget', site: 'year strip', llm: 'standing facts' }, flag: 'above', role: 'lift' },
  ],
};

/* ───────────────────────── where pieces go ───────────────────────── */

export interface Pose {
  /** translation, desktop px */
  x: number;
  y: number;
  z: number;
  /** rotation about the piece's own x axis (through its origin), degrees */
  rx: number;
  /** rotation about z, degrees */
  rz: number;
  o: number;
}

const REST: Pose = { x: 0, y: 0, z: 0, rx: 0, rz: 0, o: 1 };

/** A stable pseudo-random number in [0, 1) for piece i: the same every frame. */
const scatter = (i: number) => {
  const v = Math.sin((i + 1) * 127.1) * 43758.5453;
  return v - Math.floor(v);
};

/**
 * Where a drawn piece rests on its plate, in desktop px. The plate is the
 * size of the screen, W × H.
 */
export function slabBox(move: Move, i: number, n: number, W: number, H: number): Rect {
  switch (move) {
    case 'sheets':
      return { x: W * 0.05, y: H * 0.06, w: W * 0.9, h: H * 0.88 };
    case 'cascade': {
      const w = W * 0.36;
      const h = H * 0.34;
      return { x: (W - w) / 2, y: (H - h) / 2, w, h };
    }
    case 'drawers':
      return { x: W * 0.08, y: H * 0.06, w: W * 0.84, h: H * 0.34 };
    case 'rings': {
      // piece 0 is the innermost ring
      const k = n - 1 - i;
      const dx = (W * 0.4) / n;
      const dy = (H * 0.4) / n;
      return { x: W * 0.05 + k * dx, y: H * 0.05 + k * dy, w: W * 0.9 - 2 * k * dx, h: H * 0.9 - 2 * k * dy };
    }
    case 'chips': {
      const cols = Math.ceil(n / 2);
      const rows = n > cols ? 2 : 1;
      const gap = W * 0.025;
      const w = (W * 0.86 - gap * (cols - 1)) / cols;
      const h = (H * 0.76 - gap * (rows - 1)) / rows;
      return { x: W * 0.07 + (i % cols) * (w + gap), y: H * 0.12 + Math.floor(i / cols) * (h + gap), w, h };
    }
    case 'fan': {
      const w = W * 0.19;
      const h = H * 0.34;
      return { x: (W - w) / 2, y: H * 0.36, w, h };
    }
    default:
      return { x: 0, y: 0, w: W, h: H };
  }
}

/**
 * Where piece i of n is when its own movement is t of the way through
 * (0 at rest, 1 fully out). `role` picks between a move's variants.
 */
export function pose(move: Move, i: number, n: number, t: number, rise: number, W: number, H: number, role?: Group['role']): Pose {
  if (t <= 0) return move === 'none' || !DRAWN.includes(move) ? REST : { ...REST, o: 0 };
  const mid = i - (n - 1) / 2;
  const step = rise / Math.max(1, n);
  switch (move) {
    case 'keys':
      // three tiers, so neighbours never hide each other
      return { ...REST, z: t * rise * (0.42 + 0.29 * (i % 3)) };
    case 'lid':
      return role === 'title' ? { ...REST, y: -t * 26, z: t * rise } : { ...REST, z: t * rise * 0.46 };
    case 'popup':
      return role === 'lift' ? { ...REST, z: t * rise * 0.5 } : { ...REST, z: t * 6, rx: -t * 68 };
    case 'sheets':
      return { ...REST, z: t * step * (i + 1), o: Math.min(1, t * 2) };
    case 'cascade':
      // each card steps down by more than its title strip, so every title stays in view
      return { ...REST, x: t * mid * W * 0.1, y: t * mid * H * 0.12, z: t * (24 + step * i), o: Math.min(1, t * 2) };
    case 'drawers':
      // the top drawer stays back and high; each one below comes further out and sits lower
      return { ...REST, y: t * i * ((H * 0.52) / Math.max(1, n - 1)), z: t * (30 + step * (n - 1 - i)), o: Math.min(1, t * 2) };
    case 'rings':
      // piece 0, the innermost, ends highest
      return { ...REST, z: t * step * (n - i), o: Math.min(1, t * 2) };
    case 'chips':
      return { ...REST, z: t * rise * (0.3 + 0.7 * scatter(i)), o: Math.min(1, t * 2) };
    case 'fan':
      return { ...REST, z: t * (36 + step * i), rz: t * mid * 17, o: Math.min(1, t * 2) };
    default:
      return REST;
  }
}

/**
 * When piece i starts, as a share of the whole movement (0 first, 1 last).
 * `box` is where it rests; live pieces go in the order the eye reads them.
 */
export function startOf(move: Move, i: number, n: number, box: Rect, W: number, H: number): number {
  if (n <= 1) return 0;
  switch (move) {
    case 'keys':
      return Math.max(0, Math.min(1, box.x / Math.max(1, W)));
    case 'popup':
      // a ripple from the top-left corner
      return Math.max(0, Math.min(1, (box.x + box.y) / (W * 0.5 + H)));
    case 'chips':
      return scatter(i + 7);
    case 'rings':
      // from the outside in
      return 1 - i / (n - 1);
    case 'drawers':
      return i / (n - 1);
    default:
      return i / (n - 1);
  }
}

/** How much of the movement is spent waiting for the last piece to start. */
const STAGGER = 0.55;

/** Piece progress from the layer's progress p (0..1) and the piece's start. Eased out, with a little settle. */
export function local(p: number, start: number): number {
  const t = Math.max(0, Math.min(1, (p - start * STAGGER) / (1 - STAGGER)));
  // ease-out cubic: fast off the plate, slow into place
  return 1 - Math.pow(1 - t, 3);
}

/**
 * The points the camera must keep in frame for a layer's screen: the layer's
 * own rectangle, and the far corners of every piece once it is fully out.
 * `z0` is the layer's height in the stack; `boxes` are the pieces at rest.
 */
export function reach(move: Move, rect: Rect, z0: number, rise: number, boxes: Rect[], W: number, H: number): [number, number, number][] {
  const pts: [number, number, number][] = [];
  const corners = (r: Rect, dx: number, dy: number, z: number) => {
    pts.push([r.x + dx, r.y + dy, z], [r.x + r.w + dx, r.y + dy, z], [r.x + r.w + dx, r.y + r.h + dy, z], [r.x + dx, r.y + r.h + dy, z]);
  };
  corners(rect, 0, 0, z0);
  boxes.forEach((b, i) => {
    const at = pose(move, i, boxes.length, 1, rise, W, H);
    corners(b, at.x, at.y, z0 + at.z);
  });
  if (!boxes.length && rise > 0) corners(rect, 0, 0, z0 + rise);
  return pts;
}
