import { wrap } from './layout';

/**
 * The canvas's arithmetic, kept apart from React so it can be tested: where a
 * dial value sits on its arc, which ring a pointer is on, and how tokens fall
 * into rows.
 *
 * A dial is the lower half of a circle hanging from the head line: value 0 at
 * the left end, 1 at the right, the midpoint at the bottom.
 */

export interface Pt {
  x: number;
  y: number;
}

export function pointAt(c: Pt, r: number, v: number): Pt {
  const a = Math.PI * (1 - v);
  return { x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) };
}

/** SVG path for the part of a ring between two values. */
export function arcPath(c: Pt, r: number, v0 = 0, v1 = 1): string {
  const a = pointAt(c, r, v0);
  const b = pointAt(c, r, v1);
  const f = (n: number) => n.toFixed(2);
  return `M${f(a.x)} ${f(a.y)}A${f(r)} ${f(r)} 0 0 0 ${f(b.x)} ${f(b.y)}`;
}

/** The dial value under a pointer. Above the flat edge it sticks to the nearer end. */
export function valueAt(c: Pt, x: number, y: number): number {
  if (y <= c.y) return x < c.x ? 0 : 1;
  const a = Math.atan2(y - c.y, x - c.x);
  return Math.min(1, Math.max(0, 1 - a / Math.PI));
}

/** Which ring a pointer is on, or -1. `radii` are the ring radii, `reach` how far off a ring still counts. */
export function ringAt(c: Pt, x: number, y: number, radii: readonly number[], reach: number): number {
  if (y < c.y - reach) return -1;
  const d = Math.hypot(x - c.x, y - c.y);
  let best = -1;
  let bestGap = reach;
  radii.forEach((r, i) => {
    const gap = Math.abs(d - r);
    if (gap <= bestGap) {
      best = i;
      bestGap = gap;
    }
  });
  return best;
}

export interface Row {
  /** first token on this row and one past the last; equal on an empty row */
  start: number;
  end: number;
  /** what each token shows: a word that starts a row loses its leading spaces, a newline shows nothing */
  shown: string[];
  /** the column each token starts at */
  cols: number[];
  width: number;
}

export interface Rows {
  rows: Row[];
  /** the row each token is on */
  lineOf: number[];
  /** where the block cursor sits after `visible` tokens */
  cursor: { row: number; col: number };
}

/** Lay tokens out in rows of `cols` characters. Blank lines get rows of their own, so the gutter stays aligned. */
export function layoutRows(tokens: readonly string[], cols: number, visible = tokens.length): Rows {
  const lineOf = wrap(tokens, cols);
  const rows: Row[] = [];
  const row = (i: number) => {
    while (rows.length <= i) rows.push({ start: tokens.length, end: tokens.length, shown: [], cols: [], width: 0 });
    return rows[i];
  };
  let cursor = { row: 0, col: 0 };
  tokens.forEach((tok, i) => {
    const r = row(lineOf[i]);
    if (r.start > i) r.start = i;
    r.end = i + 1;
    const newline = tok.startsWith('\n');
    const shown = newline ? '' : r.shown.length === 0 || r.width === 0 ? tok.replace(/^[ \t]+/, '') : tok;
    r.cols.push(r.width);
    r.shown.push(shown);
    r.width += [...shown].length;
    if (newline) row(lineOf[i] + tok.length);
    if (i === visible - 1) cursor = newline ? { row: lineOf[i] + tok.length, col: 0 } : { row: lineOf[i], col: r.width };
  });
  if (!rows.length) row(0);
  rows.forEach((r, i) => {
    if (r.start > r.end || r.shown.length === 0) {
      const at = i > 0 ? rows[i - 1].end : 0;
      r.start = r.end = at;
    }
  });
  row(cursor.row);
  return { rows, lineOf, cursor };
}

/** The score at or above which a value is in the top `share` of the non-zero values. */
export function topThreshold(values: readonly number[], share: number): number {
  const present = values.filter((v) => v > 0).sort((a, b) => b - a);
  if (!present.length) return Infinity;
  return present[Math.max(0, Math.ceil(present.length * share) - 1)];
}
