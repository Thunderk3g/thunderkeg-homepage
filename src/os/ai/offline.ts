import { awards, education, profile, projects, research, roles, skills } from '@/data/resume';

/**
 * Deterministic fallback answerer.
 *
 * The hosted assistant needs LLM_API_KEY. Most visitors land on a deployment
 * that has no key, and a chat box that only ever says "offline" is a dead
 * feature. This does keyword retrieval over the résumé and answers from it —
 * no network, no key, no invention: every line it prints is a line that exists
 * in `src/data/resume.ts`.
 *
 * ponytail: term-overlap scoring, not embeddings. The corpus is ~120 short
 * chunks; anything cleverer would need a model, which is the thing we don't have.
 */

interface Chunk {
  /** where the text came from, shown to the user */
  source: string;
  text: string;
  /** extra terms that should match this chunk without appearing in the text */
  hints?: string;
}

const STOP = new Set([
  'a', 'about', 'an', 'and', 'any', 'are', 'as', 'at', 'be', 'been', 'but', 'by', 'can', 'did',
  'do', 'does', 'for', 'from', 'has', 'have', 'he', 'her', 'him', 'his', 'how', 'i', 'in', 'is',
  'it', 'its', 'me', 'much', 'of', 'on', 'or', 'she', 'so', 'some', 'tell', 'that', 'the',
  'their', 'them', 'they', 'this', 'to', 'was', 'were', 'what', 'when', 'where', 'which', 'who',
  'why', 'with', 'you', 'your', 'diwakar', 'adhikari',
]);

function terms(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

let cache: Chunk[] | null = null;

function corpus(): Chunk[] {
  if (cache) return cache;
  const out: Chunk[] = [];

  profile.summary.forEach((s) => out.push({ source: 'Profile', text: s, hints: 'summary about who overview background' }));

  for (const r of roles) {
    const where = `${r.title} · ${r.org} (${r.period})`;
    out.push({ source: where, text: r.blurb, hints: 'experience role job work current' });
    for (const g of r.groups) {
      for (const p of g.points) {
        out.push({ source: g.heading ? `${r.org} — ${g.heading}` : where, text: p, hints: g.heading });
      }
    }
  }

  for (const p of projects) {
    out.push({ source: `Project — ${p.name}`, text: `${p.name} (${p.kind}). ${p.blurb}`, hints: 'project projects side open source built' });
  }

  for (const r of [...research.inPreparation, ...research.published]) {
    out.push({ source: `Research — ${r.venue}`, text: `${r.title}. ${r.summary}`, hints: 'research paper publication writing academic' });
  }
  research.directions.forEach((d) =>
    out.push({ source: 'Research directions', text: d, hints: 'research interests directions open questions phd masters' }),
  );
  out.push({ source: 'Research track', text: research.track, hints: 'masters phd study europe scholarship applying' });

  skills.forEach((s) => out.push({ source: `Skills — ${s.group}`, text: `${s.group}: ${s.items}`, hints: 'skills stack technologies tools languages' }));

  education.forEach((e) =>
    out.push({ source: 'Education', text: `${e.degree}, ${e.org}, ${e.period}, ${e.detail}`, hints: 'education degree university college study cgpa' }),
  );

  out.push({ source: 'Awards', text: awards.join('. '), hints: 'awards scholarship prize recognition' });
  out.push({
    source: 'Contact',
    text: `Email ${profile.email} · Phone ${profile.phone} · ${profile.location} · github.com/${profile.github}`,
    hints: 'contact email phone reach hire location where based github',
  });

  cache = out;
  return out;
}

const OFFLINE_NOTE =
  '(offline mode — answering by keyword search over the résumé. Set LLM_API_KEY to enable the model.)';

/** Best-effort answer to `question`, drawn only from the résumé data. */
export function offlineAnswer(question: string): string {
  const q = terms(question);
  if (q.length === 0) {
    return `Ask me about Diwakar's experience, projects, research, skills, education or contact details.\n\n${OFFLINE_NOTE}`;
  }

  const scored = corpus()
    .map((c) => {
      const hay = (c.text + ' ' + (c.hints ?? '') + ' ' + c.source).toLowerCase();
      let score = 0;
      for (const t of q) {
        if (hay.includes(t)) score += 1;
        // reward stem-ish matches so "compliance"/"compliant", "grades"/"grading" land
        else if (t.length > 5 && hay.includes(t.slice(0, Math.max(4, t.length - 3)))) score += 0.5;
      }
      return { c, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  if (scored.length === 0) {
    return [
      "I don't have that detail in the résumé I'm grounded on.",
      `Try: experience · compliance · speech · research · skills · projects · education · contact`,
      '',
      `Or email him directly: ${profile.email}`,
      '',
      OFFLINE_NOTE,
    ].join('\n');
  }

  const lines = scored.map(({ c }) => `• [${c.source}]\n  ${c.text}`);
  return [...lines, '', OFFLINE_NOTE].join('\n');
}
