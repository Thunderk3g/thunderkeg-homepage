import type { Metadata } from 'next';
import { awards, education, hire, profile, projects, research, roles, skills } from '@/data/resume';
import { ManPage, Sec } from '@/content/ManPage';
import { PrintButton } from '@/content/PrintButton';
import { SITE } from '@/content/site';

export const metadata: Metadata = {
  title: 'Résumé — Diwakar Adhikari',
  description:
    'Diwakar Adhikari — Technical Lead, AI Engineering. Retrieval-grounded LLM systems, evaluation, and code-switched speech; research in AI & Law.',
  alternates: { canonical: '/resume' },
};

const displayName = 'Diwakar Adhikari';

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: displayName,
  jobTitle: profile.title,
  worksFor: { '@type': 'Organization', name: profile.company },
  address: { '@type': 'PostalAddress', addressLocality: 'Pune', addressCountry: 'IN' },
  email: `mailto:${profile.email}`,
  url: SITE,
  sameAs: [profile.githubUrl],
  alumniOf: education.map((e) => ({ '@type': 'CollegeOrUniversity', name: e.org })),
  knowsAbout: hire.services.map((s) => s.name),
};

export default function ResumePage() {
  return (
    <ManPage name="DIWAKAR" section={1} current="/resume">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <Sec title="NAME">
        <h1>{displayName}</h1>
        <p className="man-role">
          {profile.title}, {profile.company}
        </p>
      </Sec>

      <Sec title="SYNOPSIS">
        <p className="man-synopsis">
          <b>diwakar</b> [<span>--email</span> <a href={`mailto:${profile.email}`}>{profile.email}</a>] [
          <span>--phone</span> <a href={`tel:${profile.phone.replace(/\s/g, '')}`}>{profile.phone}</a>] [
          <span>--github</span>{' '}
          <a href={profile.githubUrl} target="_blank" rel="noreferrer">
            {profile.github}
          </a>
          ] [<span>--location</span> {profile.location}]
        </p>
        <p className="man-actions">
          {hire.open && (
            <a className="man-btn primary" href="/hire">
              Work with me
            </a>
          )}
          <PrintButton>Print or save as PDF</PrintButton>
        </p>
        {hire.open && <p className="man-aside">{hire.status}.</p>}
      </Sec>

      <Sec title="DESCRIPTION">
        {profile.summary.map((s, i) => (
          <p key={i}>{s}</p>
        ))}
      </Sec>

      <Sec title="EXPERIENCE" id="experience">
        {roles.map((r) => (
          <article key={r.id} className="man-entry">
            <header>
              <h3>
                {r.title}, {r.org}
              </h3>
              <time>{r.period}</time>
            </header>
            <p>{r.blurb}</p>
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
          </article>
        ))}
      </Sec>

      <Sec title="PROJECTS">
        {projects.map((p) => (
          <article key={p.name} className="man-entry">
            <header>
              <h3>
                {p.url ? (
                  <a href={p.url} target="_blank" rel="noreferrer">
                    {p.name}
                  </a>
                ) : (
                  p.name
                )}
              </h3>
              <span>{p.kind}</span>
            </header>
            <p>{p.blurb}</p>
            {p.caveat && <p className="man-aside">{p.caveat}</p>}
          </article>
        ))}
      </Sec>

      <Sec title="RESEARCH">
        {[...research.inPreparation, ...research.published].map((r) => (
          <article key={r.title} className="man-entry">
            <h3>{r.title}</h3>
            <p className="man-aside">{r.venue}</p>
            <p>{r.summary}</p>
          </article>
        ))}
        <h4>Open questions</h4>
        <ul>
          {research.directions.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
        <p>{research.track}</p>
      </Sec>

      <Sec title="SKILLS">
        <dl className="man-options">
          {skills.map((s) => (
            <div key={s.group}>
              <dt>{s.group}</dt>
              <dd>{s.items.split(' · ').join(', ')}</dd>
            </div>
          ))}
        </dl>
      </Sec>

      <Sec title="EDUCATION">
        {education.map((e) => (
          <article key={e.degree} className="man-entry">
            <header>
              <h3>
                {e.degree}, {e.org}
              </h3>
              <time>{e.period}</time>
            </header>
            <p>{e.detail}</p>
          </article>
        ))}
      </Sec>

      <Sec title="AWARDS">
        <ul>
          {awards.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </Sec>

      <Sec title="CAVEATS">
        <p>
          Employer-internal production metrics are deliberately not published on this page. Figures that appear
          here come from public corpora or personal repositories; the rest are available on request, subject to
          clearance.
        </p>
      </Sec>

      <Sec title="SEE ALSO">
        <p className="man-seealso">
          <a href="/hire">hire(1)</a>, <a href="/writing">writing(7)</a>, <a href="/">desktop(1)</a>,{' '}
          <a href="/stacks">stacks(7)</a>
        </p>
      </Sec>
    </ManPage>
  );
}
