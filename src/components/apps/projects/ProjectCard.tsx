"use client";

import { ExternalLink } from "lucide-react";
import type { Project } from "@/lib/resume/schema";

interface ProjectCardProps {
  project: Project;
}

export default function ProjectCard({ project }: ProjectCardProps) {
  const { name, blurb, tech, link } = project;

  return (
    <article
      className="group flex h-full flex-col gap-3 rounded-md border border-border bg-elevated p-4 transition-colors hover:bg-white/5"
    >
      <header className="flex items-start justify-between gap-3">
        <h3 className="font-mono text-lg font-semibold leading-tight text-fg">
          {name}
        </h3>
        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open ${name} in a new tab`}
            className="shrink-0 rounded-sm p-1 text-muted transition-colors hover:text-accent focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
          >
            <ExternalLink size={16} />
          </a>
        ) : null}
      </header>

      <p className="text-sm leading-relaxed text-muted">{blurb}</p>

      {tech && tech.length > 0 ? (
        <ul className="mt-auto flex flex-wrap gap-1.5 pt-1">
          {tech.map((t) => (
            <li
              key={t}
              className="rounded-sm border border-border bg-surface px-2 py-0.5 font-mono text-xs text-accent2"
            >
              {t}
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
