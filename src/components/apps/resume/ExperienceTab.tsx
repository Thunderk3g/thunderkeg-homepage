"use client";

import type { Resume } from "@/lib/resume/schema";

interface ExperienceTabProps {
  resume: Resume;
  active: boolean;
}

export function ExperienceTab({ resume, active }: ExperienceTabProps) {
  return (
    <section
      role="tabpanel"
      id="resume-panel-experience"
      aria-labelledby="resume-tab-experience"
      hidden={!active}
      className="print:block"
    >
      <div className="space-y-5 px-6 py-5">
        <h2 className="font-mono text-xs uppercase tracking-wider text-accent">
          Experience
        </h2>

        {resume.experience.length === 0 ? (
          <p className="text-sm text-muted">No experience entries yet.</p>
        ) : (
          <ol className="space-y-5">
            {resume.experience.map((exp, idx) => (
              <li
                key={`${exp.company}-${idx}`}
                className="relative rounded-sm border border-border bg-elevated p-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-fg">
                      {exp.title}
                    </h3>
                    <p className="text-xs text-accent">{exp.company}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-xs text-muted">
                      {exp.start_date} – {exp.end_date}
                    </p>
                    <p className="text-xs text-muted">{exp.location}</p>
                  </div>
                </div>

                {exp.bullets.length > 0 ? (
                  <ul className="mt-3 space-y-2 text-sm text-fg">
                    {exp.bullets.map((bullet, b) => (
                      <li
                        key={b}
                        className="relative pl-4 leading-relaxed before:absolute before:left-0 before:top-2 before:h-1.5 before:w-1.5 before:rounded-full before:bg-accent"
                      >
                        {bullet}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
