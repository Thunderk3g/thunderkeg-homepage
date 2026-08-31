import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { allEntries, getEntry } from '@/content/writing';
import { Markdown } from '@/content/Markdown';
import { profile } from '@/data/resume';

export function generateStaticParams() {
  return allEntries().map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const entry = getEntry(slug);
  if (!entry) return { title: 'Not found' };
  return {
    title: `${entry.title} — Diwakar Adhikari`,
    description: entry.summary,
  };
}

const fmt = (iso: string) =>
  iso
    ? new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      })
    : '';

export default async function EntryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = getEntry(slug);
  if (!entry) notFound();

  return (
    <div className="doc-page">
      <main className="doc-wrap">
        <nav className="doc-nav">
          <a href="/">desktop</a>
          <a href="/resume">résumé</a>
          <a href="/writing">writing</a>
        </nav>

        <h1>{entry.title}</h1>
        <div className="w-entry-meta">
          <time dateTime={entry.date}>{fmt(entry.date)}</time>
          {entry.kind === 'paper' && <span className="w-badge">paper note</span>}
          {entry.status && <span className="w-badge">{entry.status}</span>}
        </div>

        {entry.kind === 'paper' && (
          <dl className="w-cite">
            {entry.authors && (
              <>
                <dt>Authors</dt>
                <dd>{entry.authors}</dd>
              </>
            )}
            {entry.venue && (
              <>
                <dt>Venue</dt>
                <dd>{entry.venue}</dd>
              </>
            )}
            {entry.link && (
              <>
                <dt>Link</dt>
                <dd>
                  <a href={entry.link} target="_blank" rel="noreferrer">
                    {entry.link}
                  </a>
                </dd>
              </>
            )}
          </dl>
        )}

        <Markdown source={entry.body} />

        {entry.tags.length > 0 && (
          <div className="w-tags w-tags-foot">
            {entry.tags.map((t) => (
              <span key={t}>#{t}</span>
            ))}
          </div>
        )}

        <footer className="doc-foot">
          <a href="/writing">← all writing</a> ·{' '}
          <a href={`mailto:${profile.email}`}>{profile.email}</a>
        </footer>
      </main>
    </div>
  );
}
