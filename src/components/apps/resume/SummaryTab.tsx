"use client";

import type { Resume } from "@/lib/resume/schema";

interface SummaryTabProps {
  resume: Resume;
  active: boolean;
}

export function SummaryTab({ resume, active }: SummaryTabProps) {
  return (
    <section
      role="tabpanel"
      id="resume-panel-summary"
      aria-labelledby="resume-tab-summary"
      hidden={!active}
      className="print:block"
    >
      <div className="space-y-6 px-6 py-5">
        <div>
          <h2 className="font-mono text-xs uppercase tracking-wider text-accent">
            Summary
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-fg">
            {resume.summary}
          </p>
        </div>

        <div>
          <h2 className="font-mono text-xs uppercase tracking-wider text-accent">
            Skills
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {resume.skills.map((skill) => (
              <li
                key={skill}
                className="rounded-sm border border-border bg-elevated px-2 py-1 text-xs text-fg"
              >
                {skill}
              </li>
            ))}
          </ul>
        </div>

        {resume.education.length > 0 ? (
          <div>
            <h2 className="font-mono text-xs uppercase tracking-wider text-accent">
              Education
            </h2>
            <ul className="mt-3 space-y-3">
              {resume.education.map((ed, idx) => (
                <li
                  key={`${ed.institution}-${idx}`}
                  className="rounded-sm border border-border bg-elevated p-3"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-medium text-fg">
                      {ed.degree}
                      {ed.major ? (
                        <span className="text-muted"> · {ed.major}</span>
                      ) : null}
                    </p>
                    <p className="font-mono text-xs text-muted">
                      {ed.start_date} – {ed.end_date}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {ed.institution}
                    {ed.cgpa ? (
                      <span className="text-accent"> · CGPA {ed.cgpa}</span>
                    ) : null}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
