"use client";

import { useEffect, useMemo, useState } from "react";
import { ResumeSchema, type Resume } from "@/lib/resume/schema";
import { buildFs, type FsEntry } from "./fs";

interface FsRootState {
  root: FsEntry;
  loading: boolean;
  error: string | null;
}

/**
 * Loads /resume.json (force-cache shared with About) and returns the derived
 * fake-FS root. Always returns a valid `root` — when the resume is still
 * loading or failed, the FS is built from `null` (placeholder content).
 */
export function useFsRoot(): FsRootState {
  const [resume, setResume] = useState<Resume | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load(): Promise<void> {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/resume.json", {
          signal: controller.signal,
          cache: "force-cache",
        });
        if (!res.ok) throw new Error(`Failed to load resume.json (${res.status})`);
        const json: unknown = await res.json();
        const parsed = ResumeSchema.safeParse(json);
        if (!parsed.success) throw new Error("Invalid resume schema");
        if (!cancelled) setResume(parsed.data);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const root = useMemo(() => buildFs(resume), [resume]);
  return { root, loading, error };
}
