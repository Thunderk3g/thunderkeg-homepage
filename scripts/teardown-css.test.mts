import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// Run: npx tsx scripts/teardown-css.test.mts
//
// The rules that keep Teardown fast, checked on the stylesheet and the loop
// themselves. Each was a measured cause of lag (docs/teardown-research.md,
// section 8); each is easy to bring back by accident with one line of CSS.

const ok = (c: boolean, m: string) => { assert.ok(c, m); console.log('ok -', m); };
const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
const start = css.indexOf('TEARDOWN — the desktop tilted');
assert.ok(start > 0, 'the Teardown section is in globals.css');
const td = css.slice(start);
const loop = readFileSync(new URL('../src/os/teardown/Teardown.tsx', import.meta.url), 'utf8');

/** every rule of the section as [selector, body] */
const rules = [...td.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => [m[1].trim(), m[2]] as const);
const bodyOf = (pred: (sel: string) => boolean) => rules.filter(([sel]) => pred(sel));

// 1. Nothing painted into a big layer is animated: that repaints the whole layer every frame.
const big = /\.td-plate|\.td-tab|\.td-slab|\.td-body|\.td-lip(?! li)|\.kos-window|\.kos-panel|\.kos-wall|\.kos-desktop-surface/;
for (const [sel, body] of bodyOf((s) => big.test(s))) {
  const t = /transition\s*:\s*([^;]+)/.exec(body)?.[1] ?? '';
  assert.ok(!t || /^\s*none/.test(t), `"${sel}" animates "${t.trim()}" on a layer: write it from the loop, or use a ring`);
}
console.log('ok - no layer has a CSS transition of its own');

// 2. The loop writes translate, rotate, opacity and visibility, not custom properties:
//    a custom property is inherited, so changing one restyles everything under it.
ok(!/--td-(z|o|p|in|x)\b/.test(td), 'the stylesheet reads no per-frame custom property');
ok(!/setProperty\(\s*'--td-/.test(loop), 'the loop sets no custom property');

// 3. No effect that needs an off-screen pass on every frame the scene moves.
for (const [sel, body] of rules) {
  if (!/\.td-/.test(sel) || /@media/.test(sel)) continue;
  assert.ok(!/backdrop-filter\s*:\s*(?!none)/.test(body), `"${sel}" has a backdrop filter`);
  assert.ok(!/(^|[;\s])filter\s*:\s*(?!none)/.test(body), `"${sel}" has a filter`);
}
console.log('ok - no filter or backdrop blur on anything Teardown draws');
ok(/\.kos\[data-teardown\] \.kos-welcome \{[^}]*backdrop-filter: none/.test(td), 'the card on the desktop loses its blur while the desktop is apart');
ok(/\.kos\[data-teardown\] \.kos-window-body \{[^}]*filter: none/.test(td), 'unfocused windows lose their filter while the desktop is apart');

// 4. An animation that fills forwards keeps its element a compositor layer for good,
//    and a layer inside a layer makes the outer one an off-screen pass.
for (const [sel, body] of rules) {
  const a = /animation\s*:\s*([^;]+)/.exec(body)?.[1] ?? '';
  assert.ok(!/\b(both|forwards)\b/.test(a), `"${sel}" has an animation that fills forwards: ${a.trim()}`);
}
console.log('ok - no Teardown animation fills forwards');
for (const sel of ['.kos-desk-icon', '.kos-welcome', '.kos-window']) {
  const m = new RegExp(sel.replace('.', '\\.') + ' \\{([^}]*)\\}').exec(css);
  assert.ok(m, sel);
  const a = /animation\s*:\s*([^;]+)/.exec(m![1])?.[1] ?? '';
  assert.ok(!/\b(both|forwards)\b/.test(a), `${sel} fills forwards (${a.trim()}): it would stay a layer inside its layer`);
}
console.log('ok - the icons, the card and the windows do not stay layers after they have appeared');

// 5. The big surfaces are part of the 3D scene themselves, so they are painted straight to
//    the screen and not through an off-screen picture of their own size.
const three = rules.find(([sel]) => sel.includes('.td-ring') && sel.includes('.td-slab') && sel.includes('.td-plate.glass'));
ok(!!three && /transform-style:\s*preserve-3d/.test(three[1]), 'glass plates, rings and slabs are preserve-3d');
ok(/\.kos-wall[^{]*\{[^}]*preserve-3d|\.kos-wall,/.test(td), 'so is the wallpaper');

// 6. A layer's pieces all get a picture of their own in the frame it opens.
ok(/\[data-td-piece\] \{[^}]*will-change: transform/.test(td), 'live pieces are promoted together');
ok(/\[data-td-open\] \.td-slab \{[^}]*will-change: transform, opacity/.test(td), 'drawn pieces are promoted together');
ok(/\.td-slabs, \.td-flags \{ display: none; \}/.test(td), 'a closed plate has no pieces at all');

// 7. The loop skips a write when the value has not changed, and leaves the lines alone on a layer's screen.
ok(/function put\(/.test(loop) && /have\.get\(prop\) === value/.test(loop), 'style writes are cached');
ok(/if \(!opened\) \{\s*\/\/ the leaders/.test(loop), 'leaders, wires and rods are not redrawn on a layer\'s own screen');

console.log('\nall teardown stylesheet checks passed');
