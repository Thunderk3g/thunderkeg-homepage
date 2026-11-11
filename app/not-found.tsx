import type { Metadata } from 'next';
import { ManPage, Sec } from '@/content/ManPage';

export const metadata: Metadata = { title: 'No such page — Diwakar Adhikari' };

/** A wrong address gets a page in the site's own voice, with the ways back, not the framework's blank one. */
export default function NotFound() {
  return (
    <ManPage name="ENOENT" section={2} current="">
      <Sec title="NAME">
        <h1>No such page</h1>
        <p className="man-role">Nothing lives at this address.</p>
      </Sec>
      <Sec title="SEE ALSO">
        <p>
          <a className="man-btn primary" href="/">
            The desktop
          </a>{' '}
          <a className="man-btn" href="/resume">
            Résumé
          </a>{' '}
          <a className="man-btn" href="/writing">
            Writing
          </a>{' '}
          <a className="man-btn" href="/stacks">
            Stacks
          </a>{' '}
          <a className="man-btn" href="/hire">
            Work with me
          </a>
        </p>
      </Sec>
    </ManPage>
  );
}
