'use client';

import type { Command } from '../../../types';
import { awards, education, profile, projects, research, roles, skills } from '@/data/resume';
import { jsPDF } from 'jspdf';

/* ───────────────────────── layout constants ───────────────────────── */

const PAGE_W = 210; // A4 width  (mm)
const PAGE_H = 297; // A4 height (mm)
const MARGIN = 16;
const CONTENT_W = PAGE_W - MARGIN * 2;
const BOTTOM = 280; // start a new page once the cursor passes this
const FILE_NAME = 'Diwakar-Adhikari-Resume.pdf';

/* ───────────────────────── pdf builder ───────────────────────── */

function buildResume(): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = MARGIN;

  /** Move the cursor down, paginating when we run past the bottom margin. */
  const advance = (amount: number): void => {
    y += amount;
    if (y > BOTTOM) {
      doc.addPage();
      y = MARGIN;
    }
  };

  /** Render wrapped text in the given font, returning the new cursor. */
  const writeWrapped = (
    text: string,
    size: number,
    style: 'normal' | 'bold' | 'italic',
    lineHeight: number,
    indent = 0,
  ): void => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, CONTENT_W - indent) as string[];
    for (const line of lines) {
      if (y > BOTTOM) {
        doc.addPage();
        y = MARGIN;
      }
      doc.text(line, MARGIN + indent, y);
      y += lineHeight;
    }
  };

  const rule = (): void => {
    doc.setDrawColor(180);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  };

  const sectionHeading = (label: string): void => {
    advance(4);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(20, 20, 20);
    doc.text(label.toUpperCase(), MARGIN, y);
    advance(1.5);
    rule();
    advance(5);
    doc.setTextColor(40, 40, 40);
  };

  /* ── header ── */
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(15, 15, 15);
  doc.text(profile.name, MARGIN, y);
  advance(8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(70, 70, 70);
  doc.text(`${profile.title} @ ${profile.company}`, MARGIN, y);
  advance(6);

  const contact = [profile.location, profile.email, profile.phone]
    .filter(Boolean)
    .join('  ·  ');
  doc.setFontSize(10);
  doc.setTextColor(110, 110, 110);
  doc.text(contact, MARGIN, y);
  advance(3);
  rule();
  advance(6);
  doc.setTextColor(40, 40, 40);

  /* ── summary ── */
  sectionHeading('Summary');
  for (const para of profile.summary) {
    writeWrapped(para, 10, 'normal', 5);
    advance(1.5);
  }

  /** One bulleted line, hanging-indented under its marker. */
  const bullet = (text: string): void => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    if (y > BOTTOM) {
      doc.addPage();
      y = MARGIN;
    }
    doc.text('•', MARGIN, y);
    writeWrapped(text, 10, 'normal', 5, 5);
    advance(1);
  };

  const subHeading = (label: string): void => {
    advance(1.5);
    writeWrapped(label, 10, 'bold', 5);
  };

  /* ── experience ── */
  sectionHeading('Experience');
  for (const role of roles) {
    writeWrapped(`${role.title} · ${role.org}`, 11, 'bold', 5.5);
    writeWrapped(role.period, 9, 'italic', 4.5);
    advance(1);
    writeWrapped(role.blurb, 10, 'normal', 5);
    advance(1.5);
    for (const group of role.groups) {
      if (group.heading) subHeading(group.heading);
      for (const point of group.points) bullet(point);
    }
    advance(3);
  }

  /* ── projects ── */
  sectionHeading('Selected independent projects');
  for (const project of projects) {
    writeWrapped(`${project.name} — ${project.kind}`, 10, 'bold', 5);
    writeWrapped(project.blurb, 10, 'normal', 5);
    if (project.caveat) writeWrapped(project.caveat, 9, 'italic', 4.5);
    advance(2.5);
  }

  /* ── research ── */
  sectionHeading('Research');
  for (const item of [...research.inPreparation, ...research.published]) {
    writeWrapped(item.title, 10, 'bold', 5);
    writeWrapped(item.venue, 9, 'italic', 4.5);
    writeWrapped(item.summary, 10, 'normal', 5);
    advance(2.5);
  }
  subHeading('Research directions');
  for (const direction of research.directions) bullet(direction);
  advance(1.5);
  writeWrapped(research.track, 10, 'normal', 5);
  advance(2);

  /* ── skills ── */
  sectionHeading('Technical skills');
  for (const skill of skills) {
    writeWrapped(skill.group, 10, 'bold', 5);
    writeWrapped(skill.items, 9.5, 'normal', 4.8);
    advance(2);
  }

  /* ── education & awards ── */
  sectionHeading('Education');
  for (const e of education) bullet(`${e.degree} — ${e.org} · ${e.period} · ${e.detail}`);
  advance(2);

  sectionHeading('Awards');
  for (const a of awards) bullet(a);
  advance(2);

  /* ── footer on every page ── */
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p += 1) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `${profile.name} — Resume`,
      MARGIN,
      PAGE_H - 8,
    );
    doc.text(`Page ${p} / ${pageCount}`, PAGE_W - MARGIN, PAGE_H - 8, {
      align: 'right',
    });
  }

  return doc;
}

/* ───────────────────────── command ───────────────────────── */

const generate: Command['run'] = () => {
  if (typeof window === 'undefined') {
    return 'pdf generation is only available in the browser.';
  }
  try {
    const doc = buildResume();
    doc.save(FILE_NAME);
    return `Generated ${FILE_NAME} — check your downloads.`;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return `Failed to generate PDF: ${reason}`;
  }
};

export const pdfCommands: Command[] = [
  {
    name: 'resume',
    summary: 'generate and download a PDF résumé',
    usage: 'resume',
    category: 'system',
    run: generate,
  },
  {
    name: 'cv',
    summary: 'alias for resume — download a PDF résumé',
    usage: 'cv',
    category: 'system',
    run: generate,
  },
];
