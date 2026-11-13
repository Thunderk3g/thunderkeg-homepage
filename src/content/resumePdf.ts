import { jsPDF } from 'jspdf';
import { awards, education, profile, projects, research, roles, skills } from '@/data/resume';
import type { Variant } from './resumeFiles';
import { SITE } from './site';

/**
 * The résumé as a PDF, in two arrangements of the same content:
 *
 *   resume   two pages, for industry readers. Summary, skills, experience,
 *            projects, publications, education. Page one has to stand alone.
 *            Each stream of work prints only its lead bullets (`lead` in the
 *            data) and the page links to /resume for the rest.
 *   cv       for academic readers. Education and research first, manuscripts
 *            with their summaries and their exact status, then the rest.
 *
 * Why it looks the way it does: one column, real
 * selectable text, bold titles over short bullets, dates on the right where
 * the eye checks for them, and nothing that is only decoration. It is built
 * from src/data/resume.ts like every other surface, so the PDF cannot drift
 * from the page.
 *
 * No DOM is used: /resume.pdf and /cv.pdf build this on the server at build
 * time (app/resume.pdf, app/cv.pdf), and scripts/resume-pdf.test.mts checks
 * the page counts.
 */
export { FILE_NAME, type Variant } from './resumeFiles';

const PAGE_W = 210; // A4, mm
const PAGE_H = 297;
const M = 14.5;
const W = PAGE_W - M * 2;
const BOTTOM = PAGE_H - 13;

/**
 * jsPDF's built-in Helvetica is WinAnsi-encoded: characters outside it render
 * as garbage, so map the few this résumé uses to plain equivalents.
 */
const safe = (text: string): string => text.replace(/→/g, '->').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/₹\s?/g, 'INR ');

const titleCase = (s: string) => s.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase());

export function buildResumePdf(variant: Variant = 'resume'): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const tight = variant === 'resume';
  const BODY = tight ? 9.1 : 9.6;
  const LH = tight ? 4.05 : 4.5;
  let y = M + 3;

  const displayName = titleCase(profile.name);
  doc.setProperties({
    title: `${displayName}: ${variant === 'cv' ? 'curriculum vitae' : 'résumé'}`,
    author: displayName,
    subject: profile.title,
    keywords: skills.map((s) => s.group).join(', '),
  });

  const newPage = () => {
    doc.addPage();
    y = M + 2;
  };
  const gap = (mm: number) => {
    y += mm;
  };
  /** start a new page unless `space` mm are left, so a heading stays with its content */
  const keep = (space: number) => {
    if (y + space > BOTTOM) newPage();
  };

  const write = (text: string, size: number, style: 'normal' | 'bold' | 'italic', lh: number, indent = 0, width = W - indent) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(safe(text), width) as string[];
    // short blocks move whole; longer ones never strand a single line
    if (lines.length <= 3) keep((lines.length - 1) * lh);
    lines.forEach((line, i) => {
      const widow = i > 0 && i === lines.length - 2 && y + lh > BOTTOM;
      if (y > BOTTOM || widow) newPage();
      doc.text(line, M + indent, y);
      y += lh;
    });
  };

  const ink = (v: number) => doc.setTextColor(v, v, v);

  const section = (label: string) => {
    gap(tight ? 2.2 : 3.2);
    keep(16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.4);
    doc.setTextColor(28, 74, 160);
    doc.text(label.toUpperCase(), M, y, { charSpace: 0.45 });
    gap(1.4);
    doc.setDrawColor(190);
    doc.setLineWidth(0.25);
    doc.line(M, y, PAGE_W - M, y);
    gap(LH + 0.3);
    ink(35);
  };

  const bullet = (text: string, lead?: string) => {
    keep(LH);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(BODY);
    ink(90);
    doc.text('•', M + 0.6, y);
    ink(35);
    write((lead ? lead + ' ' : '') + text, BODY, lead ? 'bold' : 'normal', LH, 3.6);
    gap(tight ? 0.55 : 0.9);
  };

  /** a bold title on the left with something lighter (a date, a kind) on the right */
  const headline = (left: string, right: string, size = 10.2) => {
    keep(12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(BODY);
    const rw = right ? doc.getTextWidth(safe(right)) + 4 : 0;
    ink(15);
    const before = y;
    write(left, size, 'bold', LH + 0.5, 0, W - rw);
    if (right) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(BODY);
      ink(95);
      doc.text(safe(right), PAGE_W - M, before, { align: 'right' });
    }
    ink(35);
  };

  /* ── header ── */
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(21);
  ink(12);
  doc.text(displayName, M, y);
  gap(6.4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(28, 74, 160);
  doc.text(safe(`${profile.title}  ·  ${profile.company}  ·  ${profile.location}`), M, y);
  gap(5.2);

  // contact: each item is a real link, so it works from the PDF
  doc.setFontSize(BODY);
  const site = SITE.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const contact: [string, string | null][] = [
    [profile.email, `mailto:${profile.email}`],
    [site, SITE],
    [`github.com/${profile.github}`, profile.githubUrl],
    [profile.phone, `tel:${profile.phone.replace(/\s/g, '')}`],
  ];
  let x = M;
  contact.forEach(([label, href], i) => {
    ink(70);
    if (href) doc.textWithLink(label, x, y, { url: href });
    else doc.text(label, x, y);
    x += doc.getTextWidth(label);
    if (i < contact.length - 1) {
      ink(160);
      doc.text('  |  ', x, y);
      x += doc.getTextWidth('  |  ');
    }
  });
  gap(2.6);
  doc.setDrawColor(150);
  doc.setLineWidth(0.4);
  doc.line(M, y, PAGE_W - M, y);
  gap(LH + 0.6);
  ink(35);

  /* ── the sections ── */
  const summary = () => {
    section('Summary');
    for (const para of profile.summary) {
      write(para, BODY, 'normal', LH);
      gap(0.9);
    }
  };

  const skillsBlock = () => {
    section('Skills');
    for (const s of skills) {
      keep(LH * 2);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(BODY);
      const label = s.group + ':  ';
      const lw = doc.getTextWidth(label);
      doc.text(label, M, y);
      // the items run on after the label and wrap under it
      doc.setFont('helvetica', 'normal');
      const items = safe(s.items.split(' · ').join(', '));
      const first = doc.splitTextToSize(items, W - lw) as string[];
      doc.text(first[0], M + lw, y);
      y += LH;
      const rest = items.slice(first[0].length).trim();
      if (rest) write(rest, BODY, 'normal', LH);
      gap(0.5);
    }
  };

  const experience = () => {
    section('Experience');
    for (const role of roles) {
      headline(`${role.title}, ${role.org}`, role.period);
      doc.setTextColor(80, 80, 80);
      write(role.blurb, BODY, 'italic', LH);
      ink(35);
      gap(0.8);
      for (const g of role.groups) {
        if (g.heading) {
          // a stream never starts at the foot of a page with one bullet under it
          keep(LH * 8);
          gap(0.6);
          write(g.heading, BODY + 0.3, 'bold', LH + 0.3);
        }
        if (g.result) bullet(g.result, 'Result:');
        // two pages hold the lead bullets of each stream; the page and the CV hold them all
        for (const p of tight && g.lead !== undefined ? g.points.slice(0, g.lead) : g.points) bullet(p);
      }
      gap(1.6);
    }
    if (tight && roles.some((r) => r.groups.some((g) => g.lead !== undefined && g.lead < g.points.length))) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(BODY - 0.4);
      ink(95);
      keep(LH);
      doc.textWithLink(`The full account of every stream is at ${site}/resume`, M, y, { url: `${SITE.replace(/\/$/, '')}/resume` });
      ink(35);
      y += LH;
    }
  };

  const projectsBlock = () => {
    section(tight ? 'Selected projects' : 'Selected independent projects');
    for (const p of projects) {
      if (tight && p.pdf === false) continue;
      headline(p.name, p.kind, 9.8);
      // caveats stay on the page and the CV; two pages say what exists
      write(p.blurb + (!tight && p.caveat ? ' ' + p.caveat : ''), BODY, 'normal', LH);
      if (p.url) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(BODY - 0.5);
        doc.setTextColor(28, 74, 160);
        doc.textWithLink(p.url.replace(/^https?:\/\//, ''), M, y, { url: p.url });
        ink(35);
        y += LH;
      }
      gap(1.1);
    }
  };

  const publications = () => {
    if (tight) {
      section('Publications and working papers');
      // an industry reader needs the status and one line; "in preparation" is left for the CV
      for (const r of [...research.published, ...research.inPreparation.filter((i) => !/in preparation/i.test(i.venue))]) {
        keep(LH * 3);
        write(r.title, BODY, 'bold', LH);
        doc.setTextColor(80, 80, 80);
        write(r.venue, BODY, 'italic', LH);
        ink(35);
        const brief = (r as { brief?: string }).brief;
        if (brief) write(brief, BODY, 'normal', LH);
        gap(1);
      }
      return;
    }
    section('Research interests');
    for (const d of research.directions) bullet(d);
    section('Peer-reviewed');
    for (const r of research.published) {
      write(r.title, BODY, 'bold', LH);
      write(r.venue, BODY, 'italic', LH);
      gap(1.2);
    }
    section('Working papers and manuscripts in preparation');
    for (const r of research.inPreparation) {
      keep(LH * 4);
      write(r.title, BODY, 'bold', LH);
      doc.setTextColor(80, 80, 80);
      write(r.venue, BODY, 'italic', LH);
      ink(35);
      write(r.summary, BODY, 'normal', LH);
      gap(1.6);
    }
    write(research.track, BODY, 'italic', LH);
  };

  const educationBlock = () => {
    section(tight ? 'Education and awards' : 'Education');
    for (const e of education) {
      headline(`${e.degree}, ${e.org}`, e.period, 9.8);
      write(e.detail, BODY, 'normal', LH);
    }
    if (tight) {
      gap(0.8);
      write(awards.join('  ·  '), BODY, 'normal', LH);
    }
  };

  const awardsBlock = () => {
    section('Awards');
    for (const a of awards) bullet(a);
  };

  if (variant === 'resume') {
    summary();
    skillsBlock();
    experience();
    projectsBlock();
    publications();
    educationBlock();
  } else {
    summary();
    educationBlock();
    publications();
    experience();
    projectsBlock();
    skillsBlock();
    awardsBlock();
  }

  /* ── footer on every page ── */
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p += 1) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.6);
    ink(140);
    doc.text(safe(`${displayName}  ·  ${site}`), M, PAGE_H - 7);
    doc.text(`${p} / ${pages}`, PAGE_W - M, PAGE_H - 7, { align: 'right' });
  }
  return doc;
}
