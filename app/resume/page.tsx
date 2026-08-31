import type { Metadata } from 'next';
import { awards, education, profile, projects, research, roles, skills } from '@/data/resume';

export const metadata: Metadata = {
  title: 'Résumé — Diwakar Adhikari',
  description:
    'Diwakar Adhikari — Technical Lead, AI Engineering at Bajaj Life Insurance. Retrieval-grounded compliance AI, speech and call intelligence, evaluation methodology.',
};

export default function ResumePage() {
  return (
    <div className="doc-page">
      <main className="doc-wrap">
        <nav className="doc-nav">
          <a href="/">desktop</a>
          <span aria-current="page">résumé</span>
          <a href="/writing">writing</a>
          <a href="/learning">learning os</a>
        </nav>

        <h1>{profile.name}</h1>
        <p className="doc-role">
          {profile.title} · {profile.company}
        </p>
        <p className="doc-contact">
          {profile.location} · <a href={`mailto:${profile.email}`}>{profile.email}</a> ·{' '}
          {profile.phone} ·{' '}
          <a href={profile.githubUrl} target="_blank" rel="noreferrer">
            github.com/{profile.github}
          </a>
        </p>

        <h2>Profile</h2>
        {profile.summary.map((s, i) => (
          <p key={i} className="doc-para">
            {s}
          </p>
        ))}

        <h2>Experience</h2>
        {roles.map((r) => (
          <section key={r.id} className="doc-role-block">
            <h3>
              {r.title} · {r.org}
            </h3>
            <p className="doc-meta">{r.period}</p>
            <p className="doc-para">{r.blurb}</p>
            {r.groups.map((g, gi) => (
              <div key={gi}>
                {g.heading && <h4>{g.heading}</h4>}
                <ul>
                  {g.points.map((p, pi) => (
                    <li key={pi}>{p}</li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        ))}

        <h2>Selected independent projects</h2>
        {projects.map((p) => (
          <section key={p.name} className="doc-project">
            <h3>
              {p.name} <span className="doc-kind">— {p.kind}</span>
            </h3>
            <p className="doc-para">{p.blurb}</p>
            {p.caveat && <p className="doc-caveat">{p.caveat}</p>}
          </section>
        ))}

        <h2>Research</h2>
        {[...research.inPreparation, ...research.published].map((r) => (
          <section key={r.title} className="doc-project">
            <h3>{r.title}</h3>
            <p className="doc-meta">{r.venue}</p>
            <p className="doc-para">{r.summary}</p>
          </section>
        ))}
        <h4>Research directions</h4>
        <ul>
          {research.directions.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
        <p className="doc-para">{research.track}</p>
        <p className="doc-para">
          Longer notes and a reading shelf live in <a href="/writing">/writing</a>.
        </p>

        <h2>Technical skills</h2>
        <dl className="doc-skills">
          {skills.map((s) => (
            <div key={s.group}>
              <dt>{s.group}</dt>
              <dd>{s.items}</dd>
            </div>
          ))}
        </dl>

        <h2>Education</h2>
        <ul>
          {education.map((e) => (
            <li key={e.degree}>
              <strong>{e.degree}</strong> — {e.org} · {e.period} · {e.detail}
            </li>
          ))}
        </ul>

        <h2>Awards</h2>
        <ul>
          {awards.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>

        <p className="doc-note">
          Employer-internal production metrics are deliberately not published on this page. Figures
          that appear here come from public corpora or personal repositories; the rest are available
          on request, subject to clearance.
        </p>

        <footer className="doc-foot">
          <a className="doc-cta" href="/">
            ▸ Boot the interactive desktop
          </a>
        </footer>
      </main>
    </div>
  );
}
