import type { MetadataRoute } from 'next';
import { allEntries } from '@/content/writing';
import { SITE } from '@/content/site';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE, priority: 1 },
    { url: `${SITE}/hire`, priority: 0.9 },
    { url: `${SITE}/resume`, priority: 0.9 },
    { url: `${SITE}/writing`, priority: 0.8 },
    { url: `${SITE}/stacks`, priority: 0.7 },
    ...allEntries().map((e) => ({
      url: `${SITE}/writing/${e.slug}`,
      lastModified: e.date || undefined,
      priority: e.kind === 'post' ? 0.7 : 0.4,
    })),
  ];
}
