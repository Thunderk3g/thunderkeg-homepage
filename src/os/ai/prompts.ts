import { profile, missions } from '@/data/resume';

export function buildResumeContext(): string {
  const lines: string[] = [];
  lines.push(`Name: ${profile.name}`);
  lines.push(`Title: ${profile.title} at ${profile.company}`);
  lines.push(`Location: ${profile.location} · Email: ${profile.email} · Phone: ${profile.phone}`);
  lines.push('', 'Summary:');
  profile.summary.forEach((s) => lines.push('- ' + s));
  for (const m of missions) {
    lines.push('', `${m.title} — ${m.place}`, `(${m.brief})`);
    m.lines.forEach((l) => lines.push('  • ' + l));
  }
  return lines.join('\n');
}

export function systemPrompt(): { role: 'system'; content: string } {
  return {
    role: 'system',
    content:
      `You are the AI assistant embedded in Diwakar Adhikari's interactive Kali-Linux ` +
      `portfolio. Answer questions about Diwakar — his experience, skills, projects and ` +
      `background — professionally and concisely. Refer to Diwakar in the third person. ` +
      `Use ONLY the context below; if something isn't covered, say you don't have that ` +
      `detail and suggest contacting him. Prefer short, terminal-friendly answers.\n\n` +
      `--- RÉSUMÉ CONTEXT ---\n${buildResumeContext()}`,
  };
}
