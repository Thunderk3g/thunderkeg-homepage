import type { LayerKind, Lens } from './anatomy';
import { GROUPS, type Group } from './breakdowns';
import type { Rect } from './camera';

/**
 * The live pieces of a layer: the real elements that lift out of it on the
 * layer's own screen (the panel's plugins, a window's title bar and client
 * area, the desktop's icons and card).
 *
 * Everything is measured with offsets, not getBoundingClientRect: offsets
 * ignore transforms, so the answer is the element's place on the flat
 * desktop even while the desktop is tilted.
 */

export interface LivePiece {
  el: HTMLElement;
  /** where it rests, in desktop px */
  box: Rect;
  /** which group of the layer it belongs to */
  group: number;
  role?: Group['role'];
}

export interface LiveGroup {
  /** index into GROUPS[kind] */
  at: number;
  /** the union of its pieces, in desktop px */
  box: Rect;
  names: Record<Lens, string>;
  flag: Group['flag'];
}

/** An element's rectangle on the flat desktop. */
export function flatRect(el: HTMLElement, root: HTMLElement): Rect {
  let x = 0;
  let y = 0;
  let at: HTMLElement | null = el;
  while (at && at !== root) {
    x += at.offsetLeft;
    y += at.offsetTop;
    at = at.offsetParent as HTMLElement | null;
  }
  return { x, y, w: el.offsetWidth, h: el.offsetHeight };
}

const union = (a: Rect, b: Rect): Rect => {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
};

/** The pieces of a live layer and the groups they fall into. Empty for a layer with nothing to lift. */
export function livePieces(kind: LayerKind, layer: HTMLElement | null, root: HTMLElement): { pieces: LivePiece[]; groups: LiveGroup[] } {
  const spec = GROUPS[kind];
  if (!spec || !layer) return { pieces: [], groups: [] };
  const pieces: LivePiece[] = [];
  const groups: LiveGroup[] = [];
  spec.forEach((g, at) => {
    let box: Rect | null = null;
    for (const el of layer.querySelectorAll<HTMLElement>(g.sel)) {
      // skip what is not laid out, and what is laid out but faded out (the card behind open windows).
      // Opacity, not visibility: a layer that has stepped away is hidden as a whole, and its
      // pieces inherit that, but they are still its pieces.
      if (!el.offsetWidth || !el.offsetHeight || getComputedStyle(el).opacity === '0') continue;
      const r = flatRect(el, root);
      pieces.push({ el, box: r, group: groups.length, role: g.role });
      box = box ? union(box, r) : r;
    }
    if (box) groups.push({ at, box, names: g.names, flag: g.flag });
  });
  return { pieces, groups };
}

/** Every element between a piece and its layer has to keep its children in 3D. */
export function chainOf(el: HTMLElement, layer: HTMLElement): HTMLElement[] {
  const chain: HTMLElement[] = [];
  let at = el.parentElement;
  while (at && at !== layer) {
    chain.push(at);
    at = at.parentElement;
  }
  return chain;
}
