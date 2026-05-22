"use client";

import { useMemo } from "react";
import { useAboutData } from "./useAboutData";

/**
 * Split a long summary string into 3-4 readable paragraphs.
 *
 * Strategy:
 *   1. If the source already contains blank-line separators (\n\n), trust those.
 *   2. Otherwise split on sentence boundaries and chunk into ~3 paragraphs so the
 *      bio reads like a magazine piece rather than a wall of text.
 */
function splitIntoParagraphs(summary: string): string[] {
  const trimmed = summary.trim();
  if (!trimmed) return [];

  if (trimmed.includes("\n\n")) {
    return trimmed
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);
  }

  // Sentence-level split that keeps the terminating punctuation.
  const sentences = trimmed.match(/[^.!?]+[.!?]+(?:\s|$)/g)?.map((s) => s.trim()) ?? [trimmed];

  if (sentences.length <= 3) return sentences;

  const target = Math.min(4, Math.max(3, Math.ceil(sentences.length / 3)));
  const perChunk = Math.ceil(sentences.length / target);
  const paragraphs: string[] = [];
  for (let i = 0; i < sentences.length; i += perChunk) {
    paragraphs.push(sentences.slice(i, i + perChunk).join(" "));
  }
  return paragraphs;
}

function LoadingState() {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="flex flex-col items-center gap-3 text-muted">
        <div className="h-2 w-24 animate-pulse2 rounded-sm bg-elevated" />
        <p className="font-sans text-sm">Loading bio…</p>
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="max-w-md rounded-md border border-danger/40 bg-elevated p-5 text-center">
        <p className="font-sans text-sm font-medium text-danger">Couldn't load profile</p>
        <p className="mt-2 font-sans text-xs text-muted">{message}</p>
      </div>
    </div>
  );
}

export default function AboutApp() {
  const { data, loading, error } = useAboutData();

  const paragraphs = useMemo(
    () => (data ? splitIntoParagraphs(data.summary) : []),
    [data],
  );

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!data) return <ErrorState message="No profile data available." />;

  const { personal, skills } = data;

  return (
    <div className="h-full overflow-y-auto bg-surface">
      <article className="mx-auto flex max-w-3xl flex-col gap-10 px-8 py-12 font-sans">
        <header className="flex flex-col gap-2 border-b border-border pb-8">
          <h1 className="text-4xl font-semibold tracking-tight text-accent sm:text-5xl">
            {personal.full_name}
          </h1>
          <p className="text-lg text-muted sm:text-xl">{personal.title}</p>
          <p className="text-sm text-muted/80">{personal.location}</p>
        </header>

        <section
          aria-label="Biography"
          className="flex flex-col gap-5 text-base leading-relaxed text-fg sm:text-[1.05rem] sm:leading-[1.75]"
        >
          {paragraphs.length > 0 ? (
            paragraphs.map((para, i) => <p key={i}>{para}</p>)
          ) : (
            <p className="text-muted">No bio available yet.</p>
          )}
        </section>

        <section aria-label="Tech I work with" className="flex flex-col gap-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Tech I work with
          </h2>
          {skills.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {skills.map((skill) => (
                <li key={skill}>
                  <span className="inline-flex select-none items-center rounded-md border border-border bg-elevated px-3 py-1.5 text-sm text-fg transition-colors duration-150 hover:border-accent">
                    {skill}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Skills coming soon.</p>
          )}
        </section>
      </article>
    </div>
  );
}
