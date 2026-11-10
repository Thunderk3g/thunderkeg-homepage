'use client';

import type { Command } from '../../../types';
import { FILE_NAME, type Variant } from '@/content/resumeFiles';

/**
 * The résumé as a file. Both PDFs are built on the server from
 * src/data/resume.ts (src/content/resumePdf.ts) and served at /resume.pdf and
 * /cv.pdf, so the desktop only has to fetch them.
 */
export function downloadResumePdf(variant: Variant = 'resume'): void {
  const a = document.createElement('a');
  a.href = variant === 'cv' ? '/cv.pdf' : '/resume.pdf';
  a.download = FILE_NAME[variant];
  document.body.appendChild(a);
  a.click();
  a.remove();
}

const download = (variant: Variant): Command['run'] => () => {
  if (typeof window === 'undefined') return 'downloads are only available in the browser.';
  downloadResumePdf(variant);
  return variant === 'cv'
    ? `Downloading ${FILE_NAME.cv}: the academic CV, education and research first. For the two-page résumé, run 'resume'.`
    : `Downloading ${FILE_NAME.resume}: two pages. For the academic CV, run 'cv'.`;
};

export const pdfCommands: Command[] = [
  {
    name: 'resume',
    summary: 'download my résumé as a PDF (two pages)',
    usage: 'resume',
    category: 'system',
    run: download('resume'),
  },
  {
    name: 'cv',
    summary: 'download my academic CV as a PDF (education and research first)',
    usage: 'cv',
    category: 'system',
    run: download('cv'),
  },
];
