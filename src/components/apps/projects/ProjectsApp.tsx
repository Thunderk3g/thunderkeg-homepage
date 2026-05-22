"use client";

import ProjectCard from "./ProjectCard";
import { useProjectsData } from "./useProjectsData";

export default function ProjectsApp() {
  const { projects, awards, research, loading, error } = useProjectsData();

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-surface p-6 font-mono text-sm text-muted">
        Loading projects…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center bg-surface p-6 text-center font-mono text-sm text-danger">
        <div>
          <div className="mb-1 font-semibold">Failed to load projects</div>
          <div className="text-muted">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-surface">
      <div className="mx-auto flex max-w-4xl flex-col gap-8 p-6">
        <section>
          <header className="mb-4">
            <h2 className="font-mono text-xl font-semibold text-fg">
              Projects
            </h2>
            <p className="text-xs text-muted">
              Selected work — sourced from resume.json
            </p>
          </header>

          {projects.length === 0 ? (
            <p className="text-sm text-muted">No projects to show yet.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {projects.map((p) => (
                <ProjectCard key={p.name} project={p} />
              ))}
            </div>
          )}
        </section>

        <section>
          <header className="mb-3">
            <h2 className="font-mono text-lg font-semibold text-fg">Awards</h2>
          </header>
          {awards.length === 0 ? (
            <p className="text-sm text-muted">No awards listed.</p>
          ) : (
            <ul className="space-y-1.5">
              {awards.map((award) => (
                <li
                  key={award}
                  className="flex gap-2 text-sm leading-relaxed text-fg"
                >
                  <span aria-hidden="true" className="text-accent">
                    ▸
                  </span>
                  <span>{award}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <header className="mb-3">
            <h2 className="font-mono text-lg font-semibold text-fg">
              Research
            </h2>
          </header>
          {research.length === 0 ? (
            <p className="text-sm text-muted">No research listed.</p>
          ) : (
            <ul className="space-y-2">
              {research.map((r) => (
                <li
                  key={r.title}
                  className="rounded-sm border border-border bg-elevated p-3 transition-colors hover:bg-white/5"
                >
                  <div className="text-sm font-medium text-fg">{r.title}</div>
                  {r.venue ? (
                    <div className="mt-1 text-xs leading-relaxed text-muted">
                      {r.venue}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
