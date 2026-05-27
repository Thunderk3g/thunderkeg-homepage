import type { Metadata } from "next";
import Link from "next/link";
import { resume } from "@/data/resume";

const {
  personal_information: personal,
  summary,
  skills,
  work_experience,
  education,
  certifications,
  awards,
  projects,
  research_and_recognition,
  technologies_and_tools,
} = resume;

const summaryPreview =
  summary.length > 155 ? `${summary.slice(0, 152).trimEnd()}…` : summary;

export const metadata: Metadata = {
  title: `Résumé — ${personal.full_name}`,
  description: summaryPreview,
};

export default function ResumePage() {
  return (
    <main className="rz-page">
      <div className="rz-shell">
        <nav className="rz-topbar" aria-label="Page actions">
          <Link href="/" className="rz-back">
            ← Back to the 3D world
          </Link>
          <span className="rz-printhint">
            Tip: press Ctrl / Cmd + P to save as PDF.
          </span>
        </nav>

        <header className="rz-header">
          <h1 className="rz-name">{personal.full_name}</h1>
          {personal.location ? (
            <p className="rz-location">{personal.location}</p>
          ) : null}
          <ul className="rz-contacts" aria-label="Contact information">
            {personal.email ? (
              <li>
                <a className="rz-contact" href={`mailto:${personal.email}`}>
                  {personal.email}
                </a>
              </li>
            ) : null}
            {personal.phone ? (
              <li>
                <a
                  className="rz-contact"
                  href={`tel:${personal.phone.replace(/\s+/g, "")}`}
                >
                  {personal.phone}
                </a>
              </li>
            ) : null}
            {personal.linkedin ? (
              <li>
                <a
                  className="rz-contact"
                  href={personal.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  LinkedIn
                </a>
              </li>
            ) : null}
            {personal.github ? (
              <li>
                <a
                  className="rz-contact"
                  href={personal.github}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  GitHub
                </a>
              </li>
            ) : null}
          </ul>
        </header>

        {summary ? (
          <section className="rz-section" aria-labelledby="rz-h-summary">
            <h2 id="rz-h-summary" className="rz-h2">
              Summary
            </h2>
            <p className="rz-summary">{summary}</p>
          </section>
        ) : null}

        {work_experience.length > 0 ? (
          <section className="rz-section" aria-labelledby="rz-h-experience">
            <h2 id="rz-h-experience" className="rz-h2">
              Work Experience
            </h2>
            <div className="rz-stack">
              {work_experience.map((job, i) => (
                <article
                  className="rz-entry"
                  key={`${job.company}-${job.job_title}-${i}`}
                >
                  <div className="rz-entry-head">
                    <h3 className="rz-entry-title">{job.job_title}</h3>
                    <span className="rz-entry-dates">
                      {job.start_date} – {job.end_date}
                    </span>
                  </div>
                  <p className="rz-entry-meta">
                    {job.company}
                    {job.location ? ` · ${job.location}` : ""}
                  </p>
                  {job.responsibilities.length > 0 ? (
                    <ul className="rz-bullets">
                      {job.responsibilities.map((item, j) => (
                        <li key={j}>{item}</li>
                      ))}
                    </ul>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {projects.length > 0 ? (
          <section className="rz-section" aria-labelledby="rz-h-projects">
            <h2 id="rz-h-projects" className="rz-h2">
              Projects
            </h2>
            <div className="rz-stack">
              {projects.map((project, i) => (
                <article className="rz-entry" key={`${project.title}-${i}`}>
                  <h3 className="rz-entry-title">{project.title}</h3>
                  <p className="rz-entry-desc">{project.description}</p>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {skills.length > 0 ? (
          <section className="rz-section" aria-labelledby="rz-h-skills">
            <h2 id="rz-h-skills" className="rz-h2">
              Skills
            </h2>
            <ul className="rz-chips" aria-label="Skills">
              {skills.map((skill, i) => (
                <li className="rz-chip" key={`${skill}-${i}`}>
                  {skill}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {technologies_and_tools.length > 0 ? (
          <section className="rz-section" aria-labelledby="rz-h-tech">
            <h2 id="rz-h-tech" className="rz-h2">
              Technologies &amp; Tools
            </h2>
            <ul className="rz-chips" aria-label="Technologies and tools">
              {technologies_and_tools.map((tech, i) => (
                <li className="rz-chip rz-chip-alt" key={`${tech}-${i}`}>
                  {tech}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {education.length > 0 ? (
          <section className="rz-section" aria-labelledby="rz-h-education">
            <h2 id="rz-h-education" className="rz-h2">
              Education
            </h2>
            <div className="rz-stack">
              {education.map((edu, i) => (
                <article
                  className="rz-entry"
                  key={`${edu.university}-${edu.degree}-${i}`}
                >
                  <div className="rz-entry-head">
                    <h3 className="rz-entry-title">
                      {edu.degree}
                      {edu.major ? `, ${edu.major}` : ""}
                    </h3>
                    <span className="rz-entry-dates">
                      {edu.start_date} – {edu.end_date}
                    </span>
                  </div>
                  <p className="rz-entry-meta">
                    {edu.university}
                    {edu.cgpa ? ` · CGPA ${edu.cgpa}` : ""}
                  </p>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {certifications.length > 0 ? (
          <section className="rz-section" aria-labelledby="rz-h-certs">
            <h2 id="rz-h-certs" className="rz-h2">
              Certifications
            </h2>
            <ul className="rz-list">
              {certifications.map((cert, i) => (
                <li className="rz-list-item" key={`${cert.title}-${i}`}>
                  <span className="rz-list-strong">{cert.title}</span>
                  <span className="rz-list-meta">
                    {cert.issuer}
                    {cert.duration ? ` · ${cert.duration}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {awards.length > 0 ? (
          <section className="rz-section" aria-labelledby="rz-h-awards">
            <h2 id="rz-h-awards" className="rz-h2">
              Awards
            </h2>
            <ul className="rz-bullets">
              {awards.map((award, i) => (
                <li key={`${award}-${i}`}>{award}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {research_and_recognition.length > 0 ? (
          <section className="rz-section" aria-labelledby="rz-h-research">
            <h2 id="rz-h-research" className="rz-h2">
              Research &amp; Recognition
            </h2>
            <ul className="rz-list">
              {research_and_recognition.map((item, i) => (
                <li className="rz-list-item" key={`${item.title}-${i}`}>
                  <span className="rz-list-strong">{item.title}</span>
                  {item.institution ? (
                    <span className="rz-list-meta">{item.institution}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <style>{`
        .rz-page {
          --rz-cream: #f7f1e3;
          --rz-ink: #4a3f35;
          --rz-terracotta: #c8745f;
          --rz-sage: #6fae6a;
          --rz-sky: #bfe3f0;
          --rz-lavender: #cdbce8;
          --rz-display: "Baloo 2", system-ui, sans-serif;
          --rz-body: "Nunito", system-ui, sans-serif;
          background: var(--rz-cream);
          color: var(--rz-ink);
          font-family: var(--rz-body);
          line-height: 1.6;
          min-height: 100vh;
          padding: clamp(1.25rem, 4vw, 3rem) clamp(1rem, 4vw, 2rem);
          -webkit-font-smoothing: antialiased;
        }
        .rz-shell {
          max-width: 760px;
          margin: 0 auto;
        }
        .rz-topbar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          margin-bottom: clamp(1.5rem, 4vw, 2.25rem);
        }
        .rz-back {
          font-family: var(--rz-display);
          font-weight: 600;
          color: var(--rz-terracotta);
          text-decoration: none;
          font-size: 0.95rem;
          padding: 0.4rem 0.85rem;
          border: 1.5px solid rgba(200, 116, 95, 0.4);
          border-radius: 999px;
          background: rgba(200, 116, 95, 0.08);
          transition: background 0.15s ease;
        }
        .rz-back:hover {
          background: rgba(200, 116, 95, 0.16);
        }
        .rz-printhint {
          font-size: 0.82rem;
          color: rgba(74, 63, 53, 0.7);
        }
        .rz-header {
          margin-bottom: clamp(1.75rem, 5vw, 2.75rem);
          padding-bottom: 1.25rem;
          border-bottom: 2px solid rgba(111, 174, 106, 0.35);
        }
        .rz-name {
          font-family: var(--rz-display);
          font-weight: 700;
          font-size: clamp(2rem, 7vw, 2.85rem);
          line-height: 1.1;
          margin: 0 0 0.35rem;
          color: var(--rz-ink);
        }
        .rz-location {
          margin: 0 0 0.75rem;
          font-size: 1rem;
          color: rgba(74, 63, 53, 0.78);
        }
        .rz-contacts {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem 1.1rem;
          list-style: none;
          margin: 0;
          padding: 0;
        }
        .rz-contact {
          color: var(--rz-terracotta);
          text-decoration: none;
          font-weight: 600;
          font-size: 0.95rem;
          border-bottom: 1.5px solid transparent;
        }
        .rz-contact:hover {
          border-bottom-color: var(--rz-terracotta);
        }
        .rz-section {
          margin-bottom: clamp(1.75rem, 5vw, 2.5rem);
        }
        .rz-h2 {
          font-family: var(--rz-display);
          font-weight: 600;
          font-size: clamp(1.25rem, 3.5vw, 1.5rem);
          color: var(--rz-terracotta);
          margin: 0 0 1rem;
          padding-left: 0.7rem;
          border-left: 4px solid var(--rz-sage);
          line-height: 1.2;
        }
        .rz-summary {
          margin: 0;
          font-size: 1.02rem;
        }
        .rz-stack {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .rz-entry-head {
          display: flex;
          flex-wrap: wrap;
          align-items: baseline;
          justify-content: space-between;
          gap: 0.25rem 1rem;
        }
        .rz-entry-title {
          font-family: var(--rz-display);
          font-weight: 600;
          font-size: 1.12rem;
          margin: 0;
          color: var(--rz-ink);
        }
        .rz-entry-dates {
          font-size: 0.85rem;
          font-weight: 600;
          color: rgba(74, 63, 53, 0.65);
          white-space: nowrap;
        }
        .rz-entry-meta {
          margin: 0.15rem 0 0.6rem;
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--rz-sage);
        }
        .rz-entry-desc {
          margin: 0.25rem 0 0;
          font-size: 0.98rem;
        }
        .rz-bullets {
          margin: 0;
          padding-left: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }
        .rz-bullets li {
          font-size: 0.98rem;
        }
        .rz-bullets li::marker {
          color: var(--rz-terracotta);
        }
        .rz-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 0.55rem;
          list-style: none;
          margin: 0;
          padding: 0;
        }
        .rz-chip {
          font-size: 0.9rem;
          font-weight: 600;
          padding: 0.32rem 0.85rem;
          border-radius: 999px;
          background: rgba(111, 174, 106, 0.18);
          border: 1.5px solid rgba(111, 174, 106, 0.55);
          color: var(--rz-ink);
        }
        .rz-chip-alt {
          background: rgba(191, 227, 240, 0.3);
          border-color: rgba(120, 180, 205, 0.55);
        }
        .rz-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
        }
        .rz-list-item {
          display: flex;
          flex-direction: column;
          gap: 0.1rem;
        }
        .rz-list-strong {
          font-weight: 700;
          font-size: 0.98rem;
        }
        .rz-list-meta {
          font-size: 0.9rem;
          color: rgba(74, 63, 53, 0.72);
        }

        @media (max-width: 420px) {
          .rz-entry-dates {
            white-space: normal;
          }
        }

        @media print {
          .rz-page {
            background: #fff;
            color: #1a1a1a;
            padding: 0;
            font-size: 11pt;
            line-height: 1.4;
          }
          .rz-topbar {
            display: none;
          }
          .rz-header {
            border-bottom-color: #999;
            margin-bottom: 1rem;
            padding-bottom: 0.75rem;
          }
          .rz-name {
            color: #1a1a1a;
          }
          .rz-h2 {
            color: #1a1a1a;
            border-left-color: #777;
            margin-bottom: 0.5rem;
          }
          .rz-section {
            margin-bottom: 1rem;
            page-break-inside: avoid;
          }
          .rz-stack {
            gap: 0.85rem;
          }
          .rz-entry {
            page-break-inside: avoid;
          }
          .rz-contact,
          .rz-entry-meta {
            color: #1a1a1a;
          }
          .rz-chips {
            gap: 0.35rem;
          }
          .rz-chip {
            background: transparent;
            border-color: #999;
            color: #1a1a1a;
            padding: 0.1rem 0.5rem;
          }
          .rz-chip-alt {
            background: transparent;
            border-color: #999;
          }
        }
      `}</style>
    </main>
  );
}
