import assert from 'node:assert/strict';
// Run: npx tsx scripts/teardown-breakdowns.test.mts
import { LAYERS, LENSES } from '../src/os/teardown/anatomy.ts';
import { BREAKDOWNS, DRAWN, GROUPS, MAX_SLABS, local, pose, reach, slabBox, startOf } from '../src/os/teardown/breakdowns.ts';
import { frame, leaderPicks, project, quad, spots, type Cam } from '../src/os/teardown/camera.ts';

const ok = (c: boolean, m: string) => { assert.ok(c, m); console.log('ok -', m); };
const W = 1440;
const H = 900;
const rad = (d: number) => (d * Math.PI) / 180;
const kinds = Object.keys(BREAKDOWNS) as (keyof typeof BREAKDOWNS)[];

// every layer has a screen of its own, and no two layers come apart the same way
ok(kinds.every((k) => k === 'window' || k in LAYERS), 'every breakdown belongs to a layer');
ok((Object.keys(LAYERS) as string[]).every((k) => k in BREAKDOWNS), 'every layer has a breakdown');
const moves = kinds.map((k) => BREAKDOWNS[k].move).filter((m) => m !== 'none');
ok(new Set(moves).size === moves.length, 'no two layers share a move');
ok(kinds.every((k) => BREAKDOWNS[k].caption.length > 20 && BREAKDOWNS[k].title.length > 2), 'each move has a name and a caption');

// a layer either has live pieces to find, or components to draw, or is the board (time) or empty
for (const k of kinds) {
  const m = BREAKDOWNS[k].move;
  const drawn = DRAWN.includes(m);
  assert.ok(drawn || GROUPS[k] || m === 'replay' || m === 'none', `${k} has nothing to take apart`);
  if (drawn && k !== 'window') {
    for (const l of LENSES) assert.ok(LAYERS[k][l.id].pieces.length >= 2, `${k} under ${l.id} has too few components to draw`);
  }
}
console.log('ok - every layer has something to take apart, under every reading');

// at rest nothing has moved; drawn pieces are invisible until they leave the plate
for (const k of kinds) {
  const bd = BREAKDOWNS[k];
  for (let i = 0; i < 6; i++) {
    const at = pose(bd.move, i, 6, 0, bd.rise, W, H);
    assert.ok(at.x === 0 && at.y === 0 && at.z === 0 && at.rx === 0 && at.rz === 0, `${k}: piece ${i} is not at rest`);
    assert.equal(at.o, DRAWN.includes(bd.move) ? 0 : 1, `${k}: piece ${i} has the wrong opacity at rest`);
  }
}
console.log('ok - at rest every piece is exactly where it was');

// fully out, pieces are above the plate, never below it, and within the move's rise
for (const k of kinds) {
  const bd = BREAKDOWNS[k];
  if (bd.move === 'none' || bd.move === 'replay') continue;
  for (const n of [2, 4, 6]) {
    for (let i = 0; i < n; i++) {
      for (const role of [undefined, 'title', 'body', 'stand', 'lift'] as const) {
        const at = pose(bd.move, i, n, 1, bd.rise, W, H, role);
        assert.ok(at.z > 0 && at.z <= bd.rise + 40, `${k}: piece ${i} of ${n} ends at z ${at.z}`);
        assert.equal(at.o, 1);
      }
    }
  }
}
console.log('ok - fully out, every piece stands above its plate and inside the rise');

// drawn pieces rest on the plate, and stay on it (or near it) when out
for (const k of kinds) {
  const bd = BREAKDOWNS[k];
  if (!DRAWN.includes(bd.move)) continue;
  for (const n of [2, 3, 4, 5, MAX_SLABS]) {
    for (let i = 0; i < n; i++) {
      const b = slabBox(bd.move, i, n, W, H);
      assert.ok(b.w > 40 && b.h > 40 && b.x >= 0 && b.y >= 0 && b.x + b.w <= W && b.y + b.h <= H, `${k}: slab ${i} of ${n} is off its plate`);
      const at = pose(bd.move, i, n, 1, bd.rise, W, H);
      assert.ok(b.x + at.x > -W * 0.05 && b.x + b.w + at.x < W * 1.05 && b.y + at.y > -H * 0.05 && b.y + b.h + at.y < H * 1.08, `${k}: slab ${i} of ${n} flies off the plate`);
    }
  }
}
console.log('ok - drawn pieces rest on their plate and stay over it');

// the rings: piece 0 is innermost and ends highest; each ring leaves a band of the next one showing
{
  const n = 6;
  const boxes = Array.from({ length: n }, (_, i) => slabBox('rings', i, n, W, H));
  for (let i = 1; i < n; i++) {
    assert.ok(boxes[i].w > boxes[i - 1].w && boxes[i].h > boxes[i - 1].h, 'rings grow outward');
    assert.ok(boxes[i - 1].y + boxes[i - 1].h < boxes[i].y + boxes[i].h - 24, 'each ring shows a band wide enough for its name');
    assert.ok(pose('rings', i - 1, n, 1, 330, W, H).z > pose('rings', i, n, 1, 330, W, H).z, 'inner rings stand higher');
  }
  console.log('ok - the rings step up toward the middle');
}

// a cascade keeps every title strip in view: each card starts lower than the one before by more than a strip
{
  const strip = 0.042 * W;
  const a = pose('cascade', 0, 6, 1, 130, W, H);
  const b = pose('cascade', 1, 6, 1, 130, W, H);
  ok(b.y - a.y > strip && b.x > a.x && b.z > a.z, 'cascade cards step down, across and up');
}

// pieces start one after another and all finish
for (const k of kinds) {
  const m = BREAKDOWNS[k].move;
  for (let i = 0; i < 6; i++) {
    const s = startOf(m, i, 6, { x: i * 200, y: i * 100, w: 80, h: 80 }, W, H);
    assert.ok(s >= 0 && s <= 1, `${k}: start ${s}`);
    assert.equal(local(0, s), 0);
    assert.equal(local(1, s), 1);
    let last = 0;
    for (let p = 0; p <= 1.0001; p += 0.05) {
      const t = local(p, s);
      assert.ok(t >= last - 1e-9, `${k}: a piece goes backwards`);
      last = t;
    }
  }
}
console.log('ok - every piece starts, never goes backwards, and finishes');

// the camera for a layer's own screen keeps the layer and its pieces in frame, and uses the room it has
const area = { x0: 396, y0: 150, x1: W - 84, y1: H - 86 };
for (const k of kinds) {
  const bd = BREAKDOWNS[k];
  const rect = k === 'panel' ? { x: 0, y: 0, w: W, h: H * 0.34 } : k === 'window' ? { x: 220, y: 120, w: 760, h: 520 } : { x: 0, y: 0, w: W, h: H };
  const n = 5;
  const boxes = DRAWN.includes(bd.move) ? Array.from({ length: n }, (_, i) => slabBox(bd.move, i, n, W, H)) : [];
  for (const z0 of [0, 400, 1600]) {
    const pts = reach(bd.move, rect, z0, bd.rise, boxes, W, H);
    const f = frame(W, H, area, rad(bd.rx), rad(bd.rz), pts, 1.1);
    const cam: Cam = { rx: rad(bd.rx), rz: rad(bd.rz), s: f.s, tx: f.tx, ty: f.ty, g: 0 };
    const on = pts.map((p) => project(cam, W, H, p[0], p[1], p[2]));
    const xs = on.map((p) => p[0]);
    const ys = on.map((p) => p[1]);
    const m = 3;
    assert.ok(Math.min(...xs) > area.x0 - m && Math.max(...xs) < area.x1 + m && Math.min(...ys) > area.y0 - m && Math.max(...ys) < area.y1 + m, `${k} at z ${z0}: out of frame`);
    const fill = Math.max((Math.max(...xs) - Math.min(...xs)) / (area.x1 - area.x0), (Math.max(...ys) - Math.min(...ys)) / (area.y1 - area.y0));
    assert.ok(fill > 0.97 || f.s > 1.09, `${k} at z ${z0}: only fills ${(fill * 100).toFixed(0)}% of the sheet`);
  }
}
console.log('ok - every layer and its pieces fit its own screen, and fill it');

// a leader keeps aiming at the same corner while its layer moves: the pick is an index, not a point
{
  const cam: Cam = { rx: rad(58), rz: rad(-38), s: 0.36, tx: 180, ty: 60, g: 120 };
  const full = { x: 0, y: 0, w: W, h: H };
  const rows: [number, number][] = Array.from({ length: 8 }, (_, i) => [300, 110 + i * 32]);
  const rest = rows.map((_, i) => quad(cam, W, H, full, 0, (7 - i) * cam.g));
  const picks = leaderPicks(rows, rest);
  ok(picks.every((k) => k !== null && k >= 0 && k < 8), 'every leader picks one of the eight spots');
  const lifted = rows.map((_, i) => quad(cam, W, H, full, 0, (7 - i) * cam.g + (i < 4 ? 70 : 0)));
  const a = picks.map((k, i) => spots(rest[i])[k!]);
  const b = picks.map((k, i) => spots(lifted[i])[k!]);
  ok(a.every((p, i) => (i < 4 ? b[i][1] < p[1] : b[i][1] === p[1])), 'lifting a layer carries its leader with it and leaves the others alone');
}

console.log('\nall teardown breakdown checks passed');
