import type { Metadata } from 'next';
import { allEntries } from '@/content/writing';
import { StacksRecord } from '@/stacks/StacksRecord';

export const metadata: Metadata = {
  title: 'Stacks — Diwakar Adhikari',
  description:
    'What I have learnt, as a dated record: every subject, and each thing built, measured, studied or written under it.',
};

export default function StacksPage() {
  // the record needs each entry's metadata, not its text
  const entries = allEntries().map((e) => ({ ...e, body: '' }));
  return (
    <div className="doc-page">
      <main className="doc-wrap wide">
        <nav className="doc-nav">
          <a href="/">desktop</a>
          <a href="/resume">résumé</a>
          <a href="/writing">writing</a>
          <a href="/hire">hire</a>
          <span aria-current="page">stacks</span>
        </nav>

        <h1>Stacks</h1>
        <p className="doc-lede">
          The same record the desktop draws as a board of cubes, in words. A field is a lane, a subject is a stack, and
          a cube is one thing that happened, with its date.
        </p>
        <p className="doc-lede-small">
          Work and projects come from the résumé and my own repositories; papers and posts are read from this site as
          they are published. Where a date is only a year, a year is all I can honestly give.
        </p>

        <StacksRecord entries={entries} />
      </main>
    </div>
  );
}
