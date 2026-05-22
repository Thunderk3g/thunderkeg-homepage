"use client";

import { useEffect, useState } from "react";
import { ResumeSchema, type Resume } from "@/lib/resume/schema";

// Module-level cache so multiple consumers share a single fetch.
let cachedPromise: Promise<Resume> | null = null;
let cachedResume: Resume | null = null;

function fetchResume(): Promise<Resume> {
  if (cachedResume) return Promise.resolve(cachedResume);
  if (cachedPromise) return cachedPromise;

  cachedPromise = (async () => {
    const res = await fetch("/resume.json", { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Failed to load resume.json (${res.status})`);
    }
    const json = (await res.json()) as unknown;
    const parsed = ResumeSchema.parse(json);
    cachedResume = parsed;
    return parsed;
  })();

  cachedPromise.catch(() => {
    // On failure, drop the cached promise so future calls can retry.
    cachedPromise = null;
  });

  return cachedPromise;
}

export interface UseResumeData {
  data: Resume | null;
  loading: boolean;
  error: Error | null;
  reload: () => void;
}

export function useResumeData(): UseResumeData {
  const [data, setData] = useState<Resume | null>(cachedResume);
  const [loading, setLoading] = useState<boolean>(cachedResume === null);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(cachedResume === null);
    setError(null);

    fetchResume()
      .then((resume) => {
        if (cancelled) return;
        setData(resume);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tick]);

  const reload = () => {
    cachedPromise = null;
    cachedResume = null;
    setTick((t) => t + 1);
  };

  return { data, loading, error, reload };
}
