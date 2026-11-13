import type { ReactNode } from 'react';
import { profile } from '@/data/resume';

/**
 * The frame for every plain page (/resume, /writing, /hire): a Unix manual
 * page. The header and footer lines, the section names (NAME, SYNOPSIS,
 * SEE ALSO) and the hanging indent are the man(7) conventions; the body is
 * set in a reading face rather than a terminal's monospace.
 */
const LINKS = [
  { href: '/', label: 'desktop' },
  { href: '/resume', label: 'résumé' },
  { href: '/writing', label: 'writing' },
  { href: '/stacks', label: 'stacks' },
  { href: '/hire', label: 'hire' },
];

export function ManPage({
  name,
  section,
  current,
  children,
  wide,
}: {
  /** the page's manual name, e.g. DIWAKAR */
  name: string;
  /** manual section number: 1 commands, 7 miscellany */
  section: number;
  /** href of the current page, for the nav */
  current?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const id = `${name}(${section})`;
  return (
    <div className={'man' + (wide ? ' man-wide' : '')}>
      <header className="man-top">
        <span className="man-id">{id}</span>
        <nav aria-label="Site">
          {LINKS.map((l) =>
            l.href === current ? (
              <span key={l.href} aria-current="page">
                {l.label}
              </span>
            ) : (
              <a key={l.href} href={l.href}>
                {l.label}
              </a>
            ),
          )}
        </nav>
        <span className="man-id" aria-hidden="true">
          {id}
        </span>
      </header>
      <main>{children}</main>
      <footer className="man-foot">
        <span>
          <a href={`mailto:${profile.email}`}>{profile.email}</a>
        </span>
        <span>
          <a href={profile.githubUrl} target="_blank" rel="noreferrer">
            github.com/{profile.github}
          </a>
        </span>
        <span aria-hidden="true">{id}</span>
      </footer>
    </div>
  );
}

/** One manual section: the name hangs in the left margin, the body sits beside it. */
export function Sec({ title, id, children }: { title: string; id?: string; children: ReactNode }) {
  return (
    <section className="man-sec" id={id}>
      <h2>{title}</h2>
      <div className="man-body">{children}</div>
    </section>
  );
}
