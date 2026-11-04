'use client';

import { useOS } from '../store';
import { profile } from '@/data/resume';

/**
 * Conky-style card pinned to the desktop so a first-time visitor sees who this
 * is and where to start, instead of an empty wallpaper and a column of icons.
 * Sits below every window (z-index 1), so it never gets in the way.
 */
export function WelcomeCard() {
  const launch = useOS((s) => s.launch);

  // six buttons: the card's grid is two columns wide
  const actions: { label: string; icon: string; run: () => void }[] = [
    { label: 'Research', icon: '🔬', run: () => launch('research') },
    { label: 'Learning OS', icon: '🧭', run: () => launch('learning') },
    { label: 'About me', icon: '🦊', run: () => launch('browser', { page: 'home' }) },
    { label: 'Experience', icon: '💼', run: () => launch('browser', { page: 'experience' }) },
    { label: 'Writing', icon: '✎', run: () => launch('writing') },
    { label: 'Terminal', icon: '🖳', run: () => launch('terminal') },
  ];

  return (
    <section className="kos-welcome" aria-label="Introduction">
      <div className="kos-welcome-prompt">
        <span className="p-user">kali@kali</span>:<span className="p-path">~</span>$ whoami
      </div>
      <h1 className="kos-welcome-name">Diwakar Adhikari</h1>
      <p className="kos-welcome-role">
        {profile.title} · {profile.company}
      </p>
      <p className="kos-welcome-tagline">{profile.tagline}</p>

      <div className="kos-welcome-actions">
        {actions.map((a) => (
          <button key={a.label} className="kos-welcome-btn" onClick={a.run}>
            <span aria-hidden="true">{a.icon}</span> {a.label}
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
        Open anything from <strong>Applications</strong>, the icons, or press <kbd>Ctrl</kbd>+<kbd>K</kbd>.
      </p>
    </section>
  );
}
