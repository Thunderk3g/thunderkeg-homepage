'use client';

import { useState } from 'react';
import type { AppDefinition, AppProps } from '../../types';
import { profile, missions } from '@/data/resume';

interface PageDef {
  id: string;
  url: string;
  title: string;
  render: () => React.ReactNode;
}

const m = (id: string) => missions.find((x) => x.id === id)!;

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="kos-web-section">
    <h2>{title}</h2>
    {children}
  </section>
);

const MissionBlock = ({ id }: { id: string }) => {
  const mi = m(id);
  return (
    <div className="kos-web-card">
      <div className="kos-web-card-head">
        <strong>{mi.place}</strong>
        <span>{mi.brief}</span>
      </div>
      <ul>
        {mi.lines.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>
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
          <span>{profile.phone}</span>
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
        <MissionBlock id="bajaj-life" />
        <MissionBlock id="finserv" />
      </Section>
    ),
  },
  {
    id: 'projects',
    url: 'about:projects',
    title: 'Projects',
    render: () => (
      <Section title="Projects & Open Source">
        <ul className="kos-web-list">
          {m('projects').lines.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
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
          {m('skills').lines.map((l, i) => (
            <li key={i}>{l}</li>
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
      <Section title="Education">
        <ul className="kos-web-list">
          {m('education').lines.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      </Section>
    ),
  },
  {
    id: 'awards',
    url: 'about:awards',
    title: 'Awards',
    render: () => (
      <Section title="Awards & Research">
        <ul className="kos-web-list">
          {m('awards').lines.map((l, i) => (
            <li key={i}>{l}</li>
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
          <li>Plain résumé — <a href="/resume" target="_blank" rel="noreferrer">/resume</a></li>
        </ul>
      </Section>
    ),
  },
];

function BrowserApp({ args }: AppProps) {
  const initial = typeof args?.page === 'string' ? (args.page as string) : 'home';
  const [active, setActive] = useState(PAGES.find((p) => p.id === initial) ?? PAGES[0]);

  return (
    <div className="kos-web">
      <div className="kos-web-toolbar">
        <div className="kos-web-nav">
          <button className="kos-web-btn" title="back">‹</button>
          <button className="kos-web-btn" title="forward">›</button>
          <button className="kos-web-btn" title="reload">⟳</button>
        </div>
        <div className="kos-web-urlbar">
          <span className="kos-web-lock">🔒</span>
          {active.url}
        </div>
      </div>
      <div className="kos-web-body">
        <nav className="kos-web-side">
          {PAGES.map((p) => (
            <button
              key={p.id}
              className={'kos-web-tab' + (p.id === active.id ? ' active' : '')}
              onClick={() => setActive(p)}
            >
              {p.title}
            </button>
          ))}
        </nav>
        <main className="kos-web-content">{active.render()}</main>
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
  defaultSize: { width: 860, height: 580 },
  minSize: { width: 420, height: 320 },
  desktop: true,
  launchCommands: ['firefox', 'about'],
};

export default BrowserApp;
