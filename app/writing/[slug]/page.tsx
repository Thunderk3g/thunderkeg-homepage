import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { allEntries, getEntry } from '@/content/writing';
import { Markdown } from '@/content/Markdown';
import { ManPage } from '@/content/ManPage';
import { fmtDate, readingMinutes } from '@/content/site';
import { hire } from '@/data/resume';

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
    alternates: { canonical: `/writing/${entry.slug}` },
    openGraph: { type: 'article', title: entry.title, description: entry.summary, publishedTime: entry.date },
  };
}

export default async function EntryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = getEntry(slug);
  if (!entry) notFound();

  // neighbours of the same kind, newest first
  const same = allEntries().filter((e) => e.kind === entry.kind);
  const at = same.findIndex((e) => e.slug === entry.slug);
  const newer = same[at - 1];
  const older = same[at + 1];

  return (
    <ManPage name="WRITING" section={7}>
      <div className="man-progress" aria-hidden="true" />
      <article className="man-article">
        <header>
          <p className="man-meta">
            <time dateTime={entry.date}>{fmtDate(entry.date, 'long')}</time>
            <span> / {readingMinutes(entry.body)} min read</span>
            {entry.kind === 'paper' && <span> / paper note{entry.status ? `, ${entry.status}` : ''}</span>}
          </p>
          <h1>{entry.title}</h1>
          <p className="man-lede">{entry.summary}</p>
          {entry.kind === 'paper' && (
            <dl className="man-cite">
              {entry.authors && (
                <div>
                  <dt>Authors</dt>
                  <dd>{entry.authors}</dd>
                </div>
              )}
              {entry.venue && (
                <div>
                  <dt>Venue</dt>
                  <dd>{entry.venue}</dd>
                </div>
              )}
              {entry.link && (
                <div>
                  <dt>Source</dt>
                  <dd>
                    <a href={entry.link} target="_blank" rel="noreferrer">
                      {entry.link.replace(/^https?:\/\//, '')}
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          )}
        </header>

        <Markdown source={entry.body} />

        {entry.tags.length > 0 && <p className="man-meta man-tags">Filed under {entry.tags.join(', ')}</p>}

        {hire.open && entry.kind === 'post' && (
          <aside className="man-cta">
            <p>
              I take on this kind of work for other teams: grounded LLM systems, evaluation audits and speech
              pipelines.
            </p>
            <a className="man-btn primary" href="/hire">
              Work with me
            </a>
          </aside>
        )}

        <nav className="man-pager" aria-label="More writing">
          {older ? (
            <Link href={`/writing/${older.slug}`}>
              <span>Earlier</span>
              {older.title}
            </Link>
          ) : (
            <span />
          )}
          {newer ? (
            <Link href={`/writing/${newer.slug}`} className="next">
              <span>Later</span>
              {newer.title}
            </Link>
          ) : (
            <Link href="/writing" className="next">
              <span>Index</span>
              All writing
            </Link>
          )}
        </nav>
      </article>
    </ManPage>
  );
}
