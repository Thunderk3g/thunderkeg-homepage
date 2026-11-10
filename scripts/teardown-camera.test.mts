import assert from 'node:assert/strict';
// Run: npx tsx scripts/teardown-camera.test.mts
import { FLAT, crosses, fit, inQuad, leaderEnds, project, quad, type Cam } from '../src/os/teardown/camera.ts';

const ok = (c: boolean, m: string) => { assert.ok(c, m); console.log('ok -', m); };
const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;
const W = 1440;
const H = 900;
const rad = (d: number) => (d * Math.PI) / 180;

// laid flat, a point is where it always was
for (const [x, y] of [[0, 0], [W, H], [300, 720]]) {
  const [sx, sy] = project(FLAT, W, H, x, y, 0);
  assert.ok(near(sx, x) && near(sy, y), `flat: ${x},${y}`);
}
console.log('ok - the flat camera leaves every point where it was');

// tilted back, a raised layer sits higher on screen, and the centre stays put
const tilt: Cam = { rx: rad(58), rz: rad(-38), s: 0.4, tx: 0, ty: 0, g: 100 };
const c0 = project(tilt, W, H, W / 2, H / 2, 0);
const c1 = project(tilt, W, H, W / 2, H / 2, 500);
ok(near(c0[0], W / 2) && near(c0[1], H / 2), 'the centre of the bottom layer is the centre of the screen');
ok(near(c1[0], W / 2) && c1[1] < c0[1], 'raising a layer moves it straight up the screen');
ok(project(tilt, W, H, W / 2 + 400, H / 2, 0)[0] > c0[0], 'sliding a layer along its width moves it to the right');

// the whole stack fits its area at every spread and angle
const area = { x0: 352, y0: 50, x1: 1210, y1: 842 };
for (const spread of [0.55, 1, 1.6, 2.4]) {
  for (const rz of [-70, -38, 0, 45]) {
    for (const rx of [30, 58, 80]) {
      const units = 12.9;
      const f = fit(W, H, area, rad(rx), rad(rz), units, spread);
      const cam: Cam = { rx: rad(rx), rz: rad(rz), s: f.s, tx: f.tx, ty: f.ty, g: f.g };
      const pts = [...quad(cam, W, H, { x: 0, y: 0, w: W, h: H }, 0, 0), ...quad(cam, W, H, { x: 0, y: 0, w: W, h: H }, 0, units * f.g)];
      const m = 2;
      for (const [x, y] of pts) {
        assert.ok(x > area.x0 - m && x < area.x1 + m && y > area.y0 - m && y < area.y1 + m, `spread ${spread}, rz ${rz}, rx ${rx}: ${x.toFixed(0)},${y.toFixed(0)} is outside`);
      }
      assert.ok(f.g > 0 && f.s > 0.05, 'a positive gap and a usable scale');
    }
  }
}
console.log('ok - the stack stays inside its area at every spread and angle');
ok(fit(W, H, area, rad(58), rad(-38), 12, 2).s < fit(W, H, area, rad(58), rad(-38), 12, 1).s, 'more spread means smaller plates');
ok(fit(W, H, area, rad(58), rad(-38), 12, 2).g > fit(W, H, area, rad(58), rad(-38), 12, 1).g, 'and more air between them');

// pointing
const q = quad(tilt, W, H, { x: 200, y: 200, w: 400, h: 300 }, 0, 0);
const mid = project(tilt, W, H, 400, 350, 0);
ok(inQuad(q, mid[0], mid[1]), 'the middle of a window is inside its outline');
ok(!inQuad(q, 0, 0), 'the corner of the screen is not');

// leaders
ok(crosses([0, 0], [10, 10], [0, 10], [10, 0]), 'an X crosses');
ok(!crosses([0, 0], [10, 0], [0, 5], [10, 5]), 'parallels do not');
ok(!crosses([0, 0], [10, 10], [10, 10], [20, 0]), 'meeting at an end is not a crossing');
const f = fit(W, H, area, rad(58), rad(-38), 10, 1);
const cam: Cam = { rx: rad(58), rz: rad(-38), s: f.s, tx: f.tx, ty: f.ty, g: f.g };
const rows = Array.from({ length: 11 }, (_, i): [number, number] => [286, 78 + i * 35]);
// a panel, two windows wherever they happen to be, then full plates down the stack
const rects = [
  { x: 0, y: 0, w: W, h: 34 },
  { x: 700, y: 90, w: 600, h: 400 },
  { x: 380, y: 117, w: 880, h: 620 },
  ...Array.from({ length: 8 }, () => ({ x: 0, y: 0, w: W, h: H })),
];
const outlines = rects.map((r, i) => quad(cam, W, H, r, 0, (10 - i) * f.g));
const ends = leaderEnds(rows, outlines);
ok(ends.every((e) => e !== null), 'every balloon gets a leader');
let crossings = 0;
for (let i = 0; i < ends.length; i++) for (let j = i + 1; j < ends.length; j++) if (crosses(rows[i], ends[i]!, rows[j], ends[j]!)) crossings++;
ok(crossings === 0, 'no two leaders cross');
ok(leaderEnds([undefined], [outlines[0]])[0] === null, 'a balloon that is not on screen yet gets none');
console.log('\nall teardown camera checks passed');
