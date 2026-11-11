/**
 * Absolute base URL for feeds, the sitemap and social cards.
 * NEXT_PUBLIC_SITE_URL wins (set it when a custom domain is attached);
 * otherwise Vercel's own production hostname, which it exposes at build time.
 * (diwakar.dev is not this site.)
 */
export const SITE =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'https://portfolio-flame-five.vercel.app');

export const fmtDate = (iso: string, month: 'short' | 'long' = 'short') =>
  iso
    ? new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {
        day: 'numeric',
        month,
        year: 'numeric',
        timeZone: 'UTC',
      })
    : '';

export const readingMinutes = (body: string) => Math.max(1, Math.round(body.split(/\s+/).length / 230));
