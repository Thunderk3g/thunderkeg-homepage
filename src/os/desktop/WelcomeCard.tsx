'use client';

import { useOS } from '../store';
import { hire, profile } from '@/data/resume';
import { useBoard } from '@/stacks/useBoard';
import { stacksOn } from './wallpapers';

/**
 * The card on the desktop: who this is, how to get in touch, and what the
 * board behind it means. Its numbers are the board's own totals
 * (src/stacks/model.ts), so the card and the picture cannot disagree. It
 * steps aside while windows are open; on phones it is the first thing on the
 * screen.
 */
export function WelcomeCard() {
  const launch = useOS((s) => s.launch);
  const user = useOS((s) => s.user);
  const host = useOS((s) => s.host);
  const live = useOS((s) => stacksOn(s.settings));
  const { board } = useBoard();
  const t = board.totals;

  return (
    <section className="kos-welcome" aria-label="Introduction">
      <div className="kos-welcome-prompt">
        <span className="p-user">
          {user}@{host}
        </span>
        :<span className="p-path">~</span>$ whoami
      </div>
      <h1 className="kos-welcome-name">Diwakar Adhikari</h1>
      <p className="kos-welcome-role">
        {profile.title}, {profile.company}
      </p>
      <p className="kos-welcome-tagline">{profile.tagline}</p>

      {hire.open && (
        <p className="kos-welcome-open">
          <span className="hire-dot" aria-hidden="true" />
          {hire.status}
        </p>
      )}
      <div className="kos-welcome-actions">
        <button className="kos-welcome-btn primary" onClick={() => launch('hire')}>
          Work with me
        </button>
        <a className="kos-welcome-btn" href="/resume" target="_blank" rel="noreferrer">
          Résumé
        </a>
        <button className="kos-welcome-btn" onClick={() => launch('browser', { page: 'home' })}>
          About me
        </button>
      </div>

      <div className="kos-welcome-stats">
        <button onClick={() => launch('stacks')} title="Open the record in Stacks">
          <b>
            {t.byKind.built + t.byKind.measured}
            <small> on {t.subjects} subjects</small>
          </b>
          <span>things built or measured</span>
        </button>
        <button onClick={() => launch('research', { arg: 'library' })} title="Open the research library">
          <b>{t.papers}</b>
          <span>papers studied, {t.reading} in progress</span>
        </button>
        <button onClick={() => launch('writing')} title="Open Writing">
          <b>{t.posts}</b>
          <span>posts published</span>
        </button>
        <button onClick={() => launch('research', { arg: 'review' })} title="Open today's review">
          <b>{t.due}</b>
          <span>recall cards due today</span>
        </button>
      </div>

      {live && (
        <p className="kos-welcome-legend">
          The board behind this card is that record. Each stack is one subject, and each cube one thing I
          <span className="lg k-built"> built</span>,<span className="lg k-measured"> measured</span>,
          <span className="lg k-studied"> studied</span> or<span className="lg k-wrote"> wrote</span>, oldest at the
          bottom. Hover a cube to read it, click to open it.
        </p>
      )}

      <p className="kos-welcome-hint">
        <kbd>Ctrl</kbd>+<kbd>K</kbd> searches every app, paper, post and subject.
      </p>
    </section>
  );
}
