'use client';

import { useMemo } from 'react';
import { useOS } from '../store';
import { useEntries } from '../content';
import { hire, profile } from '@/data/resume';
import { useLearning } from '@/learning/store';
import { dueForReview } from '@/learning/priority';
import { counts, useResearch } from '@/research/store';
import { stacksOn } from './wallpapers';

/**
 * The card on the desktop: who this is, how to get in touch, and what the
 * skyline behind it means. Its numbers are read from the same local stores the
 * Research and Learning apps write to, so they are the visitor's (or my)
 * current state, not a snapshot. It steps aside while windows are open; on
 * phones it is the first thing on the screen.
 */
export function WelcomeCard() {
  const launch = useOS((s) => s.launch);
  const user = useOS((s) => s.user);
  const host = useOS((s) => s.host);
  const live = useOS((s) => stacksOn(s.settings));
  const skills = useLearning((s) => s.skills);
  const papers = useResearch((s) => s.papers);
  const cards = useResearch((s) => s.cards);
  const posts = useEntries().filter((e) => e.kind === 'post').length;

  const t = useMemo(() => {
    const c = counts({ papers, cards });
    return {
      proven: skills.filter((s) => s.independent === true).length,
      skills: skills.length,
      papers: papers.filter((p) => p.status !== 'dropped').length,
      reading: c.reading,
      due: c.due + dueForReview({ skills } as Parameters<typeof dueForReview>[0]).length,
    };
  }, [skills, papers, cards]);

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
        <button onClick={() => launch('learning')} title="Open Learning OS">
          <b>
            {t.proven}
            <small>/{t.skills}</small>
          </b>
          <span>skills proven without AI</span>
        </button>
        <button onClick={() => launch('research', { arg: 'library' })} title="Open the research library">
          <b>{t.papers}</b>
          <span>papers, {t.reading} in progress</span>
        </button>
        <button onClick={() => launch('writing')} title="Open Writing">
          <b>{posts}</b>
          <span>posts published</span>
        </button>
        <button onClick={() => launch('research', { arg: 'review' })} title="Open today's review">
          <b>{t.due}</b>
          <span>due for review today</span>
        </button>
      </div>

      {live && (
        <p className="kos-welcome-legend">
          The skyline is that record, live. Each column is one
          <span className="lg k-skill"> skill</span>,<span className="lg k-paper"> paper</span> or
          <span className="lg k-post"> post</span>; taller means deeper, and a skill lights up once it is proven
          without AI. Hover to read one, click to open it.
        </p>
      )}

      <p className="kos-welcome-hint">
        <kbd>Ctrl</kbd>+<kbd>K</kbd> searches every app, paper, post and skill.
      </p>
    </section>
  );
}
