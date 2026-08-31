import { allEntries } from '@/content/writing';

/** Prerendered at build time, so nothing reads the filesystem at runtime. */
export const dynamic = 'force-static';

/** Feeds the in-OS Writing app and the terminal's `blog` / `papers` commands. */
export function GET() {
  return Response.json({ entries: allEntries() });
}
