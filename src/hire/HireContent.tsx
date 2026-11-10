import type { ReactNode } from 'react';
import { hire, profile } from '@/data/resume';

/**
 * What I take on and how a first conversation goes. Server-renderable, so the
 * /hire page works without JavaScript; the Hire app mounts the same markup.
 * `onLink` lets the desktop open internal links in its own apps.
 */
export function Services({ renderLink }: { renderLink?: (href: string, label: string) => ReactNode }) {
  return (
    <ul className="hire-services">
      {hire.services.map((s) => (
        <li key={s.id}>
          <h3>{s.name}</h3>
          <p>{s.outcome}</p>
          <p className="hire-proof">
            {s.proof}
            {s.link && (
              <>
                {' '}
                {renderLink ? (
                  renderLink(s.link.href, s.link.label)
                ) : (
                  <a href={s.link.href} {...(s.link.href.startsWith('http') ? { target: '_blank', rel: 'noreferrer' } : {})}>
                    {s.link.label}
                  </a>
                )}
              </>
            )}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function Process() {
  return (
    <ol className="hire-process">
      {hire.process.map((p) => (
        <li key={p}>{p}</li>
      ))}
    </ol>
  );
}

export function Status() {
  return (
    <p className="hire-status">
      {hire.open && <span className="hire-dot" aria-hidden="true" />}
      <strong>{hire.open ? hire.status : 'Not taking on new work right now'}</strong>
      {hire.facts.map((f) => (
        <span key={f}>{f}</span>
      ))}
    </p>
  );
}

export function DirectLinks({ children }: { children?: ReactNode }) {
  return (
    <p className="hire-direct">
      <a href={`mailto:${profile.email}`}>{profile.email}</a>
      <a href={profile.githubUrl} target="_blank" rel="noreferrer">
        github.com/{profile.github}
      </a>
      {children}
    </p>
  );
}
