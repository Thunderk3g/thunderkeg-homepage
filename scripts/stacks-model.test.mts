import assert from 'node:assert/strict';
// Run: npx tsx scripts/stacks-model.test.mts
import { FIELDS, RECORD, SUBJECTS } from '../src/data/record.ts';
import { buildBoard, cubesAsOf, parseWhen } from '../src/stacks/model.ts';
import { RQS } from '../src/research/seed.ts';
import { allEntries } from '../src/content/writing.ts';

const ok = (c: boolean, m: string) => { assert.ok(c, m); console.log('ok -', m); };

// dates
ok(parseWhen('2026').label === '2026' && parseWhen('2026').year === 2026, 'a year');
ok(parseWhen('2026-03').label === 'Mar 2026', 'a month');
ok(parseWhen('2026-08-19T12:00:00Z').label === 'Aug 2026', 'an ISO timestamp');
ok(parseWhen('2022–25').label === '2022–25' && parseWhen('2022–25').year === 2022, 'a range counts from its first year');
ok(parseWhen('2026').at < parseWhen('2026-01').at, 'a year-only date sorts before any month of that year');
ok(parseWhen('2025-12').at < parseWhen('2026').at, 'and after the year before');

// the record names only fields and subjects that exist
const fields = new Set(FIELDS.map((f) => f.id));
const subjects = new Set(SUBJECTS.map((s) => s.id));
ok(SUBJECTS.every((s) => fields.has(s.field)), 'every subject sits in a known field');
ok(new Set(SUBJECTS.map((s) => s.id)).size === SUBJECTS.length, 'subject ids are unique');
for (const r of RECORD) assert.ok(subjects.has(r.subject), `record entry names an unknown subject: ${r.subject} (${r.title})`);
console.log('ok - every record entry names a known subject');
const linked = SUBJECTS.flatMap((s) => s.rqIds ?? []);
ok(RQS.every((q) => linked.includes(q.id)), 'every research question has a stack its papers land on');
ok(new Set(linked).size === linked.length, 'no research question is claimed by two subjects');

// content: every `stack:` names a subject, and every post and note is on the board
const entries = allEntries();
for (const e of entries) if (e.stack) assert.ok(subjects.has(e.stack), `${e.slug}: unknown stack "${e.stack}"`);
console.log('ok - every stack: in content/ names a known subject');

const board = buildBoard({ entries, papers: [], cards: [], rqs: RQS });
const cubes = board.stacks.flatMap((s) => s.cubes);
ok(cubes.length === RECORD.length + entries.length, 'one cube per record entry, post and paper note');
ok(new Set(cubes.map((c) => c.id)).size === cubes.length, 'cube ids are unique');
ok(!board.stacks.some((s) => s.subject.id === 'wider-reading'), 'nothing fell through to wider reading');
ok(board.stacks.every((s) => s.cubes.every((c, i) => i === 0 || s.cubes[i - 1].at <= c.at)), 'each stack is oldest first');
ok(board.totals.posts === entries.filter((e) => e.kind === 'post').length, 'posts are counted');
ok(board.years.reduce((n, y) => n + y.count, 0) === cubes.length, 'the years account for every cube');

// layout: lanes share one front edge, and no two stacks share a cell
ok(board.lanes.every((l) => l.x1 === board.w && l.x1 - board.apron.x0 > 2), 'every lane ends at the same front edge, with its name plate');
ok(board.stacks.every((s) => s.gx < board.apron.x0), 'no stack stands on a name plate');
const cells = board.stacks.map((s) => `${s.gx},${s.gy}`);
ok(new Set(cells).size === cells.length, 'no two stacks share a cell');
for (const l of board.lanes) {
  const h = l.stacks.map((s) => s.cubes.length);
  assert.ok(h.every((n, i) => i === 0 || h[i - 1] >= n), `${l.field.name}: tallest at the back`);
}
console.log('ok - each lane runs tallest to shortest');

// time
const first = board.years[0].year;
ok(board.stacks.every((s) => cubesAsOf(s, first - 1) === 0), 'before the first year the board is empty');
ok(board.stacks.every((s) => cubesAsOf(s, null) === s.cubes.length), 'now shows everything');
const last = board.years[board.years.length - 1].year;
ok(board.stacks.reduce((n, s) => n + cubesAsOf(s, last), 0) === cubes.length, 'the last year is the same as now');

// the library: a read paper is a cube on its question's stack, the inbox waits as an outline
const paper = (id: string, status: string, rqIds: string[], extra = {}) => ({
  id, title: 'A paper about nothing in particular', authors: ['A. Author'], abstract: '', published: '2026-10-01', categories: [],
  absUrl: '', source: 'arxiv', savedAt: '2026-10-02T00:00:00Z', status, statusChangedAt: '2026-10-05T00:00:00Z', tags: [], rqIds,
  note: {}, bibKey: id, ...extra,
});
const live = buildBoard({
  entries,
  papers: [paper('arxiv:1', 'pass2', ['rq-c2']), paper('arxiv:2', 'inbox', ['rq4']), paper('arxiv:3', 'dropped', ['rq4']), paper('arxiv:4', 'done', [])] as never,
  cards: [{ id: 'c1', paperId: 'arxiv:1', due: '2000-01-01' }] as never,
  rqs: RQS,
});
const at = (id: string) => live.stacks.find((s) => s.subject.id === id)!;
ok(at('prompt-injection').cubes.some((c) => c.id === 'paper:arxiv:1'), 'a paper at pass 2 is a cube on its question\'s stack');
ok(at('prompt-injection').due === 1 && at('prompt-injection').reading, 'with its due cards and the reading flag');
ok(at('speech-eval').queued.length === 1 && !at('speech-eval').cubes.some((c) => c.id.startsWith('paper:')), 'an inbox paper waits as an outline');
ok(!live.stacks.some((s) => [...s.cubes, ...s.queued].some((c) => c.id === 'paper:arxiv:3')), 'a dropped paper is nowhere');
ok(at('wider-reading').cubes.length === 1, 'a paper under no subject goes to wider reading');
ok(live.totals.due === 1 && live.totals.queued === 1, 'totals follow');

// a note already in the library is one cube, not two
const noteSlug = entries.find((e) => e.kind === 'paper')!.slug;
const dup = buildBoard({ entries, papers: [paper('arxiv:9', 'pass3', ['rq1'], { contentSlug: noteSlug })] as never, cards: [], rqs: RQS });
ok(dup.stacks.flatMap((s) => s.cubes).length === cubes.length, 'a published note that is also in the library is one cube');
console.log('\nall stacks model checks passed');
