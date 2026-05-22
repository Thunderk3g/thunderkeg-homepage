"use client";

import { useEffect, useState } from "react";
import {
  ResumeSchema,
  type Project,
  type Resume,
} from "@/lib/resume/schema";

type Award = Resume["awards"][number];
type Research = Resume["research"][number];

export interface ProjectsData {
  projects: Project[];
  awards: Award[];
  research: Research[];
  loading: boolean;
  error: string | null;
}

export function useProjectsData(): ProjectsData {
  const [projects, setProjects] = useState<Project[]>([]);
  const [awards, setAwards] = useState<Award[]>([]);
  const [research, setResearch] = useState<Research[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/resume.json", { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`Failed to load resume.json (${res.status})`);
        }
        const json = (await res.json()) as unknown;
        const parsed = ResumeSchema.parse(json);
        if (cancelled) return;
        setProjects(parsed.projects);
        setAwards(parsed.awards);
        setResearch(parsed.research);
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Unknown error loading projects";
        setError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  return { projects, awards, research, loading, error };
}
