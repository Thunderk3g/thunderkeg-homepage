"use client";

import { resume } from "@/data/resume";
import { useGame, type BuildingId } from "@/game/store";

const projectPosters: Record<string, string> = {
  METAPOD: "/art/project_metapod.png",
  "KRYPTO-TRACKER": "/art/project_krypto_tracker.png",
  PSEUDOSERVE: "/art/project_pseudoserve.png",
};

const awardBadges = [
  "/art/award_deployment_star.png",
  "/art/award_financial_innovation.png",
  "/art/award_compex.png",
];

export function PanelContent({ id }: { id: BuildingId }) {
  const r = resume;

  switch (id) {
    case "about": {
      const edu = r.education[0];
      const cert = r.certifications[0];
      return (
        <div className="content about">
          <div className="about-top">
            <img src="/art/avatar_portrait.png" alt={r.personal_information.full_name} className="avatar" />
            <div>
              <h3>{r.personal_information.full_name}</h3>
              <p className="muted">{r.personal_information.location}</p>
            </div>
          </div>
          <p>{r.summary}</p>
          <h4>Education</h4>
          <div className="note">
            <p>
              <strong>{edu.degree}</strong>, {edu.major}
              <br />
              {edu.university} · CGPA {edu.cgpa} · {edu.start_date}–{edu.end_date}
            </p>
          </div>
          <h4>Certification</h4>
          <div className="note">
            <p>
              {cert.title} — {cert.issuer} ({cert.duration})
            </p>
          </div>
        </div>
      );
    }

    case "experience": {
      const job = r.work_experience[0];
      return (
        <div className="content">
          <h3>{job.job_title}</h3>
          <p className="muted">
            {job.company} · {job.location} · {job.start_date}–{job.end_date}
          </p>
          <ul>
            {job.responsibilities.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      );
    }

    case "projects":
      return (
        <div className="content projects">
          {r.projects.map((p) => (
            <div className="project" key={p.title}>
              {projectPosters[p.title] && (
                <img src={projectPosters[p.title]} alt={p.title} className="poster" />
              )}
              <div>
                <h3>{p.title}</h3>
                <p>{p.description}</p>
              </div>
            </div>
          ))}
        </div>
      );

    case "skills":
      return (
        <div className="content">
          <h3>The tech garden</h3>
          <p className="muted">A handful of tools I tend to and grow with.</p>
          <div className="chips">
            {r.skills.map((s) => (
              <span className="chip" key={s}>
                {s}
              </span>
            ))}
          </div>
          <button
            className="play-btn"
            onClick={() => useGame.getState().startMinigame("cache-match")}
          >
            🎴 Play Cache Match (Redis)
          </button>
        </div>
      );

    case "awards":
      return (
        <div className="content">
          <h3>Awards</h3>
          <div className="awards">
            {r.awards.map((a, i) => (
              <div className="award" key={a}>
                {awardBadges[i] && <img src={awardBadges[i]} alt="" className="badge" />}
                <span>{a}</span>
              </div>
            ))}
          </div>
          <h4>Research &amp; Recognition</h4>
          <ul>
            {r.research_and_recognition.map((item) => (
              <li key={item.title}>
                {item.title}
                {item.institution ? <span className="muted"> — {item.institution}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      );

    case "contact": {
      const p = r.personal_information;
      return (
        <div className="content">
          <h3>Send a letter</h3>
          <p className="muted">Always happy to hear from a fellow traveller.</p>
          <div className="contact-list">
            <div className="contact-row">
              <span className="dot" aria-hidden="true" />
              <p>
                <a href={`mailto:${p.email}`}>{p.email}</a>
              </p>
            </div>
            <div className="contact-row">
              <span className="dot" aria-hidden="true" />
              <p>{p.phone}</p>
            </div>
            <div className="contact-row">
              <span className="dot" aria-hidden="true" />
              <p>{p.location}</p>
            </div>
            {p.linkedin && (
              <div className="contact-row">
                <span className="dot" aria-hidden="true" />
                <p>
                  <a href={p.linkedin} target="_blank" rel="noreferrer">
                    LinkedIn
                  </a>
                </p>
              </div>
            )}
            {p.github && (
              <div className="contact-row">
                <span className="dot" aria-hidden="true" />
                <p>
                  <a href={p.github} target="_blank" rel="noreferrer">
                    GitHub
                  </a>
                </p>
              </div>
            )}
          </div>
        </div>
      );
    }

    default:
      return null;
  }
}
