'use client';

import { useCallback, useMemo, useState } from 'react';
import type { AppDefinition, AppProps } from '../../types';
import { useOS } from '../../store';
import { awards, education, profile, projects, research, roles, skills } from '@/data/resume';

interface PageDef {
  id: string;
  url: string;
  title: string;
  render: () => React.ReactNode;
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="kos-web-section">
    <h2>{title}</h2>
    {children}
  </section>
);

const RoleBlock = ({ id }: { id: string }) => {
  const r = roles.find((x) => x.id === id)!;
  return (
    <div className="kos-web-card">
      <div className="kos-web-card-head">
        <strong>
          {r.title} · {r.org}
        </strong>
        <span>{r.period}</span>
      </div>
      <p className="kos-web-blurb">{r.blurb}</p>
      {r.groups.map((g, gi) => (
        <div key={gi}>
          {g.heading && <h3 className="kos-web-sub">{g.heading}</h3>}
          <ul>
            {g.points.map((p, pi) => (
              <li key={pi}>{p}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};

const PAGES: PageDef[] = [
  {
    id: 'home',
    url: 'about:me',
    title: 'Home',
    render: () => (
      <div className="kos-web-hero">
        <div className="kos-web-avatar">DA</div>
        <h1>{profile.name}</h1>
        <p className="kos-web-role">
          {profile.title} · {profile.company}
        </p>
        <p className="kos-web-loc">{profile.location}</p>
        <div className="kos-web-summary">
          {profile.summary.map((s, i) => (
            <p key={i}>{s}</p>
          ))}
        </div>
        <div className="kos-web-links">
          <a href={`mailto:${profile.email}`}>{profile.email}</a>
          <span>·</span>
          <a href={profile.githubUrl} target="_blank" rel="noreferrer">
            github.com/{profile.github}
          </a>
        </div>
      </div>
    ),
  },
  {
    id: 'experience',
    url: 'about:experience',
    title: 'Experience',
    render: () => (
      <Section title="Work Experience">
        {roles.map((r) => (
          <RoleBlock key={r.id} id={r.id} />
        ))}
      </Section>
    ),
  },
  {
    id: 'projects',
    url: 'about:projects',
    title: 'Projects',
    render: () => (
      <Section title="Selected Independent Projects">
        {projects.map((p) => (
          <div className="kos-web-card" key={p.name}>
            <div className="kos-web-card-head">
              <strong>{p.name}</strong>
              <span>{p.kind}</span>
            </div>
            <p className="kos-web-blurb">{p.blurb}</p>
            {p.caveat && <p className="kos-web-caveat">{p.caveat}</p>}
          </div>
        ))}
      </Section>
    ),
  },
  {
    id: 'research',
    url: 'about:research',
    title: 'Research',
    render: () => (
      <Section title="Research">
        {[...research.inPreparation, ...research.published].map((r) => (
          <div className="kos-web-card" key={r.title}>
            <div className="kos-web-card-head">
              <strong>{r.title}</strong>
              <span>{r.venue}</span>
            </div>
            <p className="kos-web-blurb">{r.summary}</p>
          </div>
        ))}
        <h3 className="kos-web-sub">Directions</h3>
        <ul className="kos-web-list">
          {research.directions.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
        <p className="kos-web-blurb">{research.track}</p>
        <p className="kos-web-blurb">
          Longer notes and the reading shelf live in the Writing app — or at{' '}
          <a href="/writing" target="_blank" rel="noreferrer">
            /writing
          </a>
          .
        </p>
      </Section>
    ),
  },
  {
    id: 'skills',
    url: 'about:skills',
    title: 'Skills',
    render: () => (
      <Section title="Technical Skills">
        <ul className="kos-web-list">
          {skills.map((s) => (
            <li key={s.group}>
              <strong>{s.group}</strong> — {s.items}
            </li>
          ))}
        </ul>
      </Section>
    ),
  },
  {
    id: 'education',
    url: 'about:education',
    title: 'Education',
    render: () => (
      <Section title="Education & Awards">
        <ul className="kos-web-list">
          {education.map((e) => (
            <li key={e.degree}>
              <strong>{e.degree}</strong> — {e.org} · {e.period} · {e.detail}
            </li>
          ))}
          {awards.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </Section>
    ),
  },
  {
    id: 'contact',
    url: 'about:contact',
    title: 'Contact',
    render: () => (
      <Section title="Get in touch">
        <ul className="kos-web-list">
          <li>
            Email — <a href={`mailto:${profile.email}`}>{profile.email}</a>
          </li>
          <li>Phone — {profile.phone}</li>
          <li>Location — {profile.location}</li>
          <li>
            GitHub —{' '}
            <a href={profile.githubUrl} target="_blank" rel="noreferrer">
              github.com/{profile.github}
            </a>
          </li>
          <li>
            Plain pages —{' '}
            <a href="/resume" target="_blank" rel="noreferrer">
              /resume
            </a>{' '}
            ·{' '}
            <a href="/writing" target="_blank" rel="noreferrer">
              /writing
            </a>
          </li>
        </ul>
      </Section>
    ),
  },
];

const indexOf = (id: string) => Math.max(0, PAGES.findIndex((p) => p.id === id));

function BrowserApp({ args }: AppProps) {
  const initial = typeof args?.page === 'string' ? (args.page as string) : 'home';
  /** Real session history: a stack of page indexes plus a cursor, like a browser. */
  const [history, setHistory] = useState<number[]>(() => [indexOf(initial)]);
  const [cursor, setCursor] = useState(0);
  /** Bumped by reload so the active page remounts. */
  const [epoch, setEpoch] = useState(0);
  const launch = useOS((s) => s.launch);

  const active = PAGES[history[cursor]];
  const canBack = cursor > 0;
  const canForward = cursor < history.length - 1;

  const visit = useCallback(
    (id: string) => {
      const next = indexOf(id);
      if (next === history[cursor]) return;
      setHistory((h) => [...h.slice(0, cursor + 1), next]);
      setCursor((c) => c + 1);
    },
    [cursor, history],
  );

  const body = useMemo(() => active.render(), [active, epoch]);

  return (
    <div className="kos-web">
      <div className="kos-web-toolbar">
        <div className="kos-web-nav">
          <button
            className="kos-web-btn"
            title="back"
            aria-label="back"
            disabled={!canBack}
            onClick={() => canBack && setCursor((c) => c - 1)}
          >
            ‹
          </button>
          <button
            className="kos-web-btn"
            title="forward"
            aria-label="forward"
            disabled={!canForward}
            onClick={() => canForward && setCursor((c) => c + 1)}
          >
            ›
          </button>
          <button
            className="kos-web-btn"
            title="reload"
            aria-label="reload"
            onClick={() => setEpoch((e) => e + 1)}
          >
            ⟳
          </button>
        </div>
        <div className="kos-web-urlbar">
          <span className="kos-web-lock">🔒</span>
          {active.url}
        </div>
        <button className="kos-web-btn" title="open Writing" onClick={() => launch('writing')}>
          ✎
        </button>
      </div>
      <div className="kos-web-body">
        <nav className="kos-web-side">
          {PAGES.map((p) => (
            <button
              key={p.id}
              className={'kos-web-tab' + (p.id === active.id ? ' active' : '')}
              onClick={() => visit(p.id)}
            >
              {p.title}
            </button>
          ))}
          <button className="kos-web-tab" onClick={() => launch('writing')}>
            Writing ↗
          </button>
        </nav>
        <main className="kos-web-content" key={`${active.id}-${epoch}`}>
          {body}
        </main>
      </div>
    </div>
  );
}

export const browserApp: AppDefinition = {
  id: 'browser',
  title: 'Firefox — About Me',
  icon: '🦊',
  category: 'Internet',
  component: BrowserApp,
  description: "Diwakar's portfolio in a browser",
  defaultSize: { width: 900, height: 600 },
  minSize: { width: 420, height: 320 },
  desktop: true,
  launchCommands: ['firefox', 'about'],
};

export default BrowserApp;
