import { buildResumePdf, FILE_NAME } from '@/content/resumePdf';

// Built once, at build time, from src/data/resume.ts: a real file at a real URL,
// so it can be linked, downloaded without JavaScript, and attached to an application.
export const dynamic = 'force-static';

export function GET() {
  const pdf = buildResumePdf('cv').output('arraybuffer');
  return new Response(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${FILE_NAME.cv}"`,
    },
  });
}
