"use client";

import type { Resume } from "@/lib/resume/schema";
import { ExternalLink, Award, BookOpen } from "lucide-react";

interface ProjectsTabProps {
  resume: Resume;
  active: boolean;
}

export function ProjectsTab({ resume, active }: ProjectsTabProps) {
  return (
    <section
      role="tabpanel"
      id="resume-panel-projects"
      aria-labelledby="resume-tab-projects"
      hidden={!active}
      className="print:block"
    >
      <div className="space-y-6 px-6 py-5">
        <div>
          <h2 className="font-mono text-xs uppercase tracking-wider text-accent">
            Projects
          </h2>

          {resume.projects.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No projects yet.</p>
          ) : (
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {resume.projects.map((project) => (
                <li
                  key={project.name}
                  className="flex h-full flex-col rounded-sm border border-border bg-elevated p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-fg">
                      {project.name}
                    </h3>
                    {project.link ? (
                      <a
                        href={project.link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-accent hover:text-fg focus:text-fg focus:outline-none"
                        aria-label={`Open ${project.name} link`}
                      >
                        <ExternalLink size={14} aria-hidden="true" />
                      </a>
                    ) : null}
                  </div>
                  <p className="mt-2 flex-1 text-xs leading-relaxed text-fg">
                    {project.blurb}
                  </p>
                  {project.tech && project.tech.length > 0 ? (
                    <ul className="mt-3 flex flex-wrap gap-1.5">
                      {project.tech.map((t) => (
                        <li
                          key={t}
                          className="rounded-sm border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] text-muted"
                        >
                          {t}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        {resume.awards.length > 0 ? (
          <div>
            <h2 className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-accent">
              <Award size={12} aria-hidden="true" />
              Awards
            </h2>
            <ul className="mt-3 space-y-2">
              {resume.awards.map((award, idx) => (
                <li
                  key={idx}
                  className="rounded-sm border border-border bg-elevated px-3 py-2 text-sm text-fg"
                >
                  {award}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {resume.research.length > 0 ? (
          <div>
            <h2 className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-accent">
              <BookOpen size={12} aria-hidden="true" />
              Research
            </h2>
            <ul className="mt-3 space-y-3">
              {resume.research.map((paper, idx) => (
                <li
                  key={idx}
                  className="rounded-sm border border-border bg-elevated p-3"
                >
                  <p className="text-sm font-medium text-fg">{paper.title}</p>
                  {paper.venue ? (
                    <p className="mt-1 text-xs text-muted">{paper.venue}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
