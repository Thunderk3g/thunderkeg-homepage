import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
// Run: npx tsx scripts/resume-pdf.test.mts [out-dir]
import { buildResumePdf, FILE_NAME } from '../src/content/resumePdf.ts';
import { profile, roles } from '../src/data/resume.ts';

const ok = (c: boolean, m: string) => { assert.ok(c, m); console.log('ok -', m); };
const out = process.argv[2];

const resume = buildResumePdf('resume');
const cv = buildResumePdf('cv');
console.log('résumé pages:', resume.getNumberOfPages(), ' cv pages:', cv.getNumberOfPages());
ok(resume.getNumberOfPages() === 2, 'the industry résumé is exactly two pages');
ok(cv.getNumberOfPages() >= 2 && cv.getNumberOfPages() <= 4, 'the academic CV is two to four pages');

const bytes = Buffer.from(resume.output('arraybuffer'));
ok(bytes.subarray(0, 5).toString() === '%PDF-', 'it is a PDF');
ok(bytes.length < 400_000, `and a small one (${Math.round(bytes.length / 1024)} KB)`);
// real text, not an image of text: the strings are in the content streams
const raw = bytes.toString('latin1');
ok(raw.includes('Experience'.toUpperCase()) || raw.includes('E X P E R I E N C E') || /EXPERIENCE/.test(raw.replace(/\)\s*-?\d*\.?\d*\s*\(/g, '')), 'section headings are text');
ok(raw.includes(profile.email), 'the email is text and a link');
ok(/\/URI\s*\(mailto:/.test(raw), 'links are real PDF links');

// the bullets stay skimmable
for (const r of roles) for (const g of r.groups) for (const p of g.points) assert.ok(p.length <= 330, `a bullet runs long (${p.length}): ${p.slice(0, 60)}…`);
console.log('ok - no bullet is longer than three lines');
ok(FILE_NAME.resume === 'Diwakar-Adhikari-Resume.pdf', 'the file is named for the person, not "resume.pdf"');

if (out) {
  writeFileSync(`${out}/${FILE_NAME.resume}`, bytes);
  writeFileSync(`${out}/${FILE_NAME.cv}`, Buffer.from(cv.output('arraybuffer')));
  console.log('wrote both PDFs to', out);
}
console.log('\nall résumé PDF checks passed');
