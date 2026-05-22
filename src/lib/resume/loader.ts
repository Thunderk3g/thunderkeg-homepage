import fs from "node:fs/promises";
import path from "node:path";
import { ResumeSchema, type Resume } from "./schema";

let cached: Resume | null = null;

export async function loadResume(): Promise<Resume> {
  if (cached) return cached;
  const file = path.join(process.cwd(), "public", "resume.json");
  const raw = await fs.readFile(file, "utf8");
  const parsed = ResumeSchema.parse(JSON.parse(raw));
  cached = parsed;
  return parsed;
}

export async function loadResumeContext(): Promise<string> {
  const r = await loadResume();
  const exp = r.experience
    .map((e) => `- ${e.title} at ${e.company} (${e.start_date} – ${e.end_date}): ${e.bullets.join(" ")}`)
    .join("\n");
  const projects = r.projects.map((p) => `- ${p.name}: ${p.blurb}`).join("\n");
  return [
    `NAME: ${r.personal.full_name}`,
    `TITLE: ${r.personal.title}`,
    `LOCATION: ${r.personal.location}`,
    `SUMMARY: ${r.summary}`,
    `EXPERIENCE:\n${exp}`,
    `PROJECTS:\n${projects}`,
    `SKILLS: ${r.skills.join(", ")}`,
    `AWARDS: ${r.awards.join("; ")}`,
  ].join("\n\n");
}
