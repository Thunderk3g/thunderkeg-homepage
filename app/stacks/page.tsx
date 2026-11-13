import type { Metadata } from 'next';
import { allEntries } from '@/content/writing';
import { ManPage, Sec } from '@/content/ManPage';
import { StacksRecord } from '@/stacks/StacksRecord';

export const metadata: Metadata = {
  title: 'Stacks — Diwakar Adhikari',
  description:
    'What I have learnt, as a dated record: every subject, and each thing built, measured, studied or written under it.',
  alternates: { canonical: '/stacks' },
};

export default function StacksPage() {
  // the record needs each entry's metadata, not its text
  const entries = allEntries().map((e) => ({ ...e, body: '' }));
  return (
    <ManPage name="STACKS" section={7} current="/stacks">
      <Sec title="NAME">
        <h1>Stacks</h1>
        <p className="man-role">What I have learnt, as a dated record.</p>
      </Sec>

      <Sec title="DESCRIPTION">
        <p>
          The same record the desktop draws as a board of cubes, in words. A field is a lane, a subject is a stack, and
          a cube is one thing that happened, with its date.
        </p>
        <p className="man-aside">
          Work and projects come from the résumé and my own repositories; papers and posts are read from this site as
          they are published. Where a date is only a year, a year is all I can honestly give.
        </p>
      </Sec>

      <StacksRecord entries={entries} />

      <Sec title="SEE ALSO">
        <p className="man-seealso">
          <a href="/resume">diwakar(1)</a>, <a href="/writing">writing(7)</a>, <a href="/hire">hire(1)</a>,{' '}
          <a href="/">desktop(1)</a>
        </p>
      </Sec>
    </ManPage>
  );
}
