import type { Metadata } from 'next';
import Link from 'next/link';
import { allEntries, type Entry } from '@/content/writing';
import { profile, research } from '@/data/resume';

export const metadata: Metadata = {
  title: 'Writing — Diwakar Adhikari',
  description:
    'Posts and paper notes on retrieval-grounded regulatory compliance, code-switched speech recognition, and measuring the things that are supposed to be measured.',
};

const fmt = (iso: string) =>
  iso
    ? new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      })
    : '';

function EntryRow({ e }: { e: Entry }) {
  return (
    <li className="w-item">
      <Link href={`/writing/${e.slug}`} className="w-item-title">
        {e.title}
      </Link>
      <div className="w-item-meta">
        <time dateTime={e.date}>{fmt(e.date)}</time>
        {e.authors && <span> · {e.authors}</span>}
        {e.venue && <span> · {e.venue}</span>}
        {e.status && <span className="w-badge">{e.status}</span>}
      </div>
      <p className="w-item-summary">{e.summary}</p>
      {e.tags.length > 0 && (
        <div className="w-tags">
          {e.tags.map((t) => (
            <span key={t}>#{t}</span>
          ))}
        </div>
      )}
    </li>
  );
}

export default function WritingIndex() {
  const entries = allEntries();
  const posts = entries.filter((e) => e.kind === 'post');
  const papers = entries.filter((e) => e.kind === 'paper');

  return (
    <div className="doc-page">
      <main className="doc-wrap">
        <nav className="doc-nav">
          <a href="/">desktop</a>
          <a href="/resume">résumé</a>
          <span aria-current="page">writing</span>
          <a href="/learning">learning os</a>
          <a href="/writing/rss.xml">rss</a>
        </nav>

        <h1>Writing</h1>
        <p className="doc-lede">
          Notes on retrieval-grounded regulatory compliance, code-switched speech, and measuring
          the things that are supposed to be measured. Negative results get equal billing —
          they are usually the ones worth reading.
        </p>
        <p className="doc-lede-small">{research.track}</p>

        <h2>Posts</h2>
        {posts.length === 0 ? (
          <p className="w-empty">Nothing published yet.</p>
        ) : (
          <ul className="w-list">
            {posts.map((e) => (
              <EntryRow key={e.slug} e={e} />
            ))}
          </ul>
        )}

        <h2>Papers I&rsquo;m reading</h2>
        <p className="doc-lede-small">
          What I am reading, why, and what it costs or gives my own work. Kept honest on purpose:
          several of these pre-empt claims I would otherwise have made.
        </p>
        {papers.length === 0 ? (
          <p className="w-empty">Nothing on the shelf yet.</p>
        ) : (
          <ul className="w-list">
            {papers.map((e) => (
              <EntryRow key={e.slug} e={e} />
            ))}
          </ul>
        )}

        <footer className="doc-foot">
          <a href={`mailto:${profile.email}`}>{profile.email}</a> ·{' '}
          <a href={profile.githubUrl} target="_blank" rel="noreferrer">
            github.com/{profile.github}
          </a>
        </footer>
      </main>
    </div>
  );
}
