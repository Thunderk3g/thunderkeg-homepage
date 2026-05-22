"use client";

import { useEffect, useState } from "react";
import { ResumeSchema, type Resume } from "@/lib/resume/schema";

type AboutDataState = {
  data: Resume | null;
  loading: boolean;
  error: string | null;
};

export function useAboutData(): AboutDataState {
  const [data, setData] = useState<Resume | null>(null);
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
        if (!res.ok) {
          throw new Error(`Failed to load resume.json (${res.status})`);
        }
        const json: unknown = await res.json();
        const parsed = ResumeSchema.safeParse(json);
        if (!parsed.success) {
          throw new Error(`Invalid resume schema: ${parsed.error.message}`);
        }
        if (!cancelled) {
          setData(parsed.data);
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Unknown error loading resume");
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

  return { data, loading, error };
}
