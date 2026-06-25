import type { Metadata } from 'next';
import { missions, profile } from '@/data/resume';

export const metadata: Metadata = {
  title: 'Resume — Diwakar Adhikari',
  description: 'Diwakar Adhikari — Technical Lead, AI Engineering at Bajaj Life Insurance. Plain-HTML resume.',
};

const byId = (id: string) => missions.find((m) => m.id === id)!;

export default function ResumePage() {
  const work = [byId('bajaj-life'), byId('finserv')];
  return (
    <div className="resume-page">
      <main className="resume-wrap">
        <h1>{profile.name}</h1>
        <p className="resume-contact">
          {profile.location} · {profile.phone} · <a href={`mailto:${profile.email}`}>{profile.email}</a>
        </p>

        <h2>SUMMARY</h2>
        {profile.summary.map((s, i) => (
          <p key={i} style={{ marginTop: i ? '0.5rem' : 0, lineHeight: 1.65, color: '#ddd4c0' }}>
            {s}
          </p>
        ))}

        <h2>WORK EXPERIENCE</h2>
        {work.map((m) => (
          <section key={m.id}>
            <h3>{m.id === 'bajaj-life' ? 'Technical Lead – AI Engineering · Bajaj Life Insurance' : 'Dev Lead · Bajaj Finserv Direct Ltd'}</h3>
            <p className="resume-meta">{m.brief}</p>
            <ul>
              {m.lines.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          </section>
        ))}

        <h2>PROJECTS &amp; RESEARCH</h2>
        <ul>
          {byId('projects').lines.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>

        <h2>SKILLS</h2>
        <ul>
          {byId('skills').lines.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>

        <h2>EDUCATION</h2>
        <ul>
          {byId('education').lines.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>

        <h2>AWARDS</h2>
        <ul>
          {byId('awards').lines.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>

        <a className="gta-btn back-to-game" href="/">
          ► PLAY THE PORTFOLIO
        </a>
      </main>
    </div>
  );
}
