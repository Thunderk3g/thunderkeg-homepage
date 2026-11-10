import type { Metadata } from 'next';
import Link from 'next/link';
import { allEntries, type Entry } from '@/content/writing';
import { ManPage, Sec } from '@/content/ManPage';
import { fmtDate, readingMinutes } from '@/content/site';
import { research } from '@/data/resume';

export const metadata: Metadata = {
  title: 'Writing — Diwakar Adhikari',
  description:
    'Posts and paper notes on retrieval-grounded regulatory compliance, code-switched speech recognition, and measuring the things that are supposed to be measured.',
  alternates: { canonical: '/writing', types: { 'application/rss+xml': '/writing/rss.xml' } },
};

function Row({ e }: { e: Entry }) {
  return (
    <li className="man-row">
      <time dateTime={e.date}>{fmtDate(e.date)}</time>
      <div>
        <Link href={`/writing/${e.slug}`} className="man-row-title">
          {e.title}
        </Link>
        {(e.authors || e.venue) && (
          <p className="man-aside">{[e.authors, e.venue].filter(Boolean).join(', ')}</p>
        )}
        <p>{e.summary}</p>
        <p className="man-meta">
          {e.status ? `${e.status}, ` : ''}
          {readingMinutes(e.body)} min read
          {e.tags.length > 0 && <span> / {e.tags.join(', ')}</span>}
        </p>
      </div>
    </li>
  );
}

export default function WritingIndex() {
  const entries = allEntries();
  const posts = entries.filter((e) => e.kind === 'post');
  const papers = entries.filter((e) => e.kind === 'paper');

  return (
    <ManPage name="WRITING" section={7} current="/writing">
      <Sec title="NAME">
        <h1>Writing</h1>
        <p className="man-role">
          Notes on retrieval-grounded compliance, code-switched speech, and measuring the things that are supposed
          to be measured.
        </p>
      </Sec>

      <Sec title="DESCRIPTION">
        <p>Negative results get equal billing here. They are usually the ones worth reading.</p>
        <p className="man-aside">
          {research.track} <a href="/writing/rss.xml">RSS feed</a>.
        </p>
      </Sec>

      <Sec title="POSTS">
        {posts.length === 0 ? (
          <p className="man-aside">Nothing published yet.</p>
        ) : (
          <ul className="man-rows">
            {posts.map((e) => (
              <Row key={e.slug} e={e} />
            ))}
          </ul>
        )}
      </Sec>

      <Sec title="READING">
        <p className="man-aside">
          What I am reading, why, and what it costs or gives my own work. Several of these pre-empt claims I would
          otherwise have made.
        </p>
        {papers.length === 0 ? (
          <p className="man-aside">Nothing on the shelf yet.</p>
        ) : (
          <ul className="man-rows">
            {papers.map((e) => (
              <Row key={e.slug} e={e} />
            ))}
          </ul>
        )}
      </Sec>

      <Sec title="SEE ALSO">
        <p className="man-seealso">
          <a href="/resume">diwakar(1)</a>, <a href="/hire">hire(1)</a>, <a href="/">desktop(1)</a>
        </p>
      </Sec>
    </ManPage>
  );
}
