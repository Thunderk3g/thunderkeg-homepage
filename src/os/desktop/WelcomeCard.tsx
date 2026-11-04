'use client';

import { useOS } from '../store';
import { AppIcon } from '../icons';
import { profile } from '@/data/resume';
import { useClock } from './useClock';

/**
 * A Conky widget on the desktop: who this is and where to start. Monospaced,
 * translucent, bottom-right; it steps aside while windows are open on the
 * current workspace. On phones it is the hero at the top of the surface.
 */
export function WelcomeCard() {
  const launch = useOS((s) => s.launch);
  const user = useOS((s) => s.user);
  const host = useOS((s) => s.host);
  const now = useClock(60_000);

  const actions: { label: string; app: string; run: () => void }[] = [
    { label: 'Research', app: 'research', run: () => launch('research') },
    { label: 'Learning OS', app: 'learning', run: () => launch('learning') },
    { label: 'About me', app: 'browser', run: () => launch('browser', { page: 'home' }) },
    { label: 'Experience', app: 'file', run: () => launch('browser', { page: 'experience' }) },
    { label: 'Writing', app: 'writing', run: () => launch('writing') },
    { label: 'Terminal', app: 'terminal', run: () => launch('terminal') },
  ];

  const uptimeMin = Math.max(1, Math.round(performance.now() / 60000));

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
        {profile.title} · {profile.company}
      </p>
      <p className="kos-welcome-tagline">{profile.tagline}</p>

      <dl className="kos-welcome-stats">
        <div>
          <dt>location</dt>
          <dd>{profile.location}</dd>
        </div>
        <div>
          <dt>local</dt>
          <dd>{now.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}</dd>
        </div>
        <div>
          <dt>uptime</dt>
          <dd>{uptimeMin} min</dd>
        </div>
      </dl>

      <div className="kos-welcome-actions">
        {actions.map((a) => (
          <button key={a.label} className="kos-welcome-btn" onClick={a.run}>
            <AppIcon id={a.app} size={18} /> {a.label}
          </button>
        ))}
      </div>

      <div className="kos-welcome-links">
        <a href="/resume" target="_blank" rel="noreferrer">
          résumé ↗
        </a>
        <a href={profile.githubUrl} target="_blank" rel="noreferrer">
          github ↗
        </a>
        <a href={`mailto:${profile.email}`}>email ↗</a>
      </div>

      <p className="kos-welcome-hint">
        Press <kbd>Super</kbd> for applications, <kbd>Ctrl</kbd>+<kbd>K</kbd> to search.
      </p>
    </section>
  );
}
