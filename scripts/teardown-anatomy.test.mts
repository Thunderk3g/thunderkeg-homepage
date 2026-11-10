import assert from 'node:assert/strict';
// Run: npx tsx scripts/teardown-anatomy.test.mts
import { APPS, LAYERS, LENSES, appAnatomy, windowAnatomy, type Anatomy, type Lens } from '../src/os/teardown/anatomy.ts';
import { SUBJECTS } from '../src/data/record.ts';

const ok = (c: boolean, m: string) => { assert.ok(c, m); console.log('ok -', m); };
const subjects = new Set(SUBJECTS.map((s) => s.id));
const kinds = new Set([...Object.keys(LAYERS), 'window']);
const lenses = LENSES.map((l) => l.id) as Lens[];

ok(lenses.join() === 'kali,site,llm', 'three lenses, in the order the keys 1 2 3 pick them');

const check = (where: string, a: Anatomy) => {
  for (const l of lenses) {
    const r = a[l];
    assert.ok(r.name && r.name.length <= 40, `${where}/${l}: a name that fits a tab ("${r.name}")`);
    assert.ok(r.gist.length > 24, `${where}/${l}: a gist ("${r.gist}")`);
    assert.ok(r.pieces.length >= 2 && r.pieces.length <= 7, `${where}/${l}: 2 to 7 pieces, has ${r.pieces.length}`);
    for (const [name, what] of r.pieces) {
      assert.ok(name.length <= 20, `${where}/${l}: piece name fits its chip ("${name}")`);
      assert.ok(what.length > 5 && what.length <= 130, `${where}/${l}/${name}: a one-line explanation`);
    }
    assert.ok(new Set(r.pieces.map((p) => p[0])).size === r.pieces.length, `${where}/${l}: piece names are unique`);
    assert.ok(!/[—–]/.test(r.gist + r.pieces.flat().join(' ')), `${where}/${l}: no dashes used as punctuation`);
  }
  for (const id of a.work) assert.ok(subjects.has(id), `${where}: work names an unknown Stacks subject "${id}"`);
  for (const [to] of a.links) assert.ok(kinds.has(to), `${where}: links to an unknown layer "${to}"`);
};

for (const [kind, a] of Object.entries(LAYERS)) check(kind, a);
console.log('ok - every layer has three complete readings, real subjects and real links');

for (const id of Object.keys(APPS)) check('app:' + id, windowAnatomy(id));
console.log('ok - every app window has three readings');

// every app on the desktop has its own entry, so no window falls back to the generic text
const registered = ['hire', 'terminal', 'browser', 'research', 'stacks', 'writing', 'files', 'vm', 'psql', 'assistant', 'code-editor', 'music', 'settings'];
for (const id of registered) assert.ok(APPS[id], `no anatomy for the "${id}" app`);
console.log('ok - all thirteen apps are described');
ok(appAnatomy('no-such-app').built[0] === 'A React component', 'an unknown app still gets a generic reading');

// nothing depends on itself, and the stack bottoms out at the hardware
for (const [kind, a] of Object.entries(LAYERS)) assert.ok(!a.links.some(([to]) => to === kind), `${kind} links to itself`);
ok(LAYERS.hardware.links.length === 0, 'the hardware depends on nothing');
const reach = (from: string, seen = new Set<string>()): Set<string> => {
  if (seen.has(from)) return seen;
  seen.add(from);
  for (const [to] of (LAYERS as Record<string, Anatomy>)[from]?.links ?? []) reach(to, seen);
  return seen;
};
for (const kind of Object.keys(LAYERS)) assert.ok(reach(kind).has('hardware') || kind === 'hardware', `${kind} never reaches the hardware`);
console.log('ok - every layer is wired down to the hardware');
console.log('\nall teardown anatomy checks passed');
