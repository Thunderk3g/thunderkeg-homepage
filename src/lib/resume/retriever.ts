import { loadResume } from "./loader";

export async function retrieveRelevant(query: string, max = 6): Promise<string[]> {
  const r = await loadResume();
  const corpus: string[] = [
    r.summary,
    ...r.experience.flatMap((e) => [`${e.title} at ${e.company}`, ...e.bullets]),
    ...r.projects.flatMap((p) => [`${p.name}: ${p.blurb}`]),
    ...r.skills,
    ...r.awards,
  ];
  const q = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  const scored = corpus.map((line) => {
    const lower = line.toLowerCase();
    const score = q.reduce((s, t) => s + (lower.includes(t) ? 1 : 0), 0);
    return { line, score };
  });
  return scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score).slice(0, max).map((s) => s.line);
}
