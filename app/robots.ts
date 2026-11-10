import type { MetadataRoute } from 'next';
import { SITE } from '@/content/site';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/learning'] },
    sitemap: `${SITE}/sitemap.xml`,
  };
}
