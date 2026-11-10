/** The names the résumé PDFs are saved under. Kept apart from the builder so the page never loads a PDF library. */
export type Variant = 'resume' | 'cv';

export const FILE_NAME: Record<Variant, string> = {
  resume: 'Diwakar-Adhikari-Resume.pdf',
  cv: 'Diwakar-Adhikari-CV.pdf',
};
