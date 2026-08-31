import type { FsNode } from '../types';
import {
  awards,
  education,
  profile,
  projects,
  research,
  resumeText,
  roles,
  skills,
} from '@/data/resume';

const file = (content: string): FsNode => ({ type: 'file', content, mode: 'rw-r--r--' });
const dir = (children: Record<string, FsNode>): FsNode => ({ type: 'dir', children, mode: 'rwxr-xr-x' });

/* Everything below is derived from src/data/resume.ts — one source, many surfaces. */

const ABOUT = `${profile.name}
${profile.title} @ ${profile.company}
${profile.location}

${profile.summary.join('\n\n')}

${profile.email} · ${profile.phone} · github.com/${profile.github}

Type 'help' for commands, 'neofetch' for the obligatory ASCII dragon.
Try:  resume · blog · papers · news · ai <question> · firefox · games
`;

const section = (title: string, body: string) => `# ${title}\n\n${body}\n`;

const EXPERIENCE = section(
  'Work Experience',
  roles
    .map((r) => {
      const head = `## ${r.title} · ${r.org}\n${r.period}\n\n${r.blurb}\n`;
      const groups = r.groups
        .map((g) => (g.heading ? `\n### ${g.heading}\n` : '\n') + g.points.map((p) => `- ${p}`).join('\n'))
        .join('\n');
      return head + groups;
    })
    .join('\n\n'),
);

const PROJECTS = section(
  'Selected Projects',
  projects.map((p) => `## ${p.name} — ${p.kind}\n${p.blurb}${p.caveat ? `\n(${p.caveat})` : ''}`).join('\n\n'),
);

const RESEARCH = section(
  'Research',
  [
    ...[...research.inPreparation, ...research.published].map(
      (r) => `## ${r.title}\n${r.venue}\n\n${r.summary}`,
    ),
    '## Directions\n' + research.directions.map((d) => `- ${d}`).join('\n'),
    research.track,
    'Full notes and a reading shelf: open the Writing app, or visit /writing.',
  ].join('\n\n'),
);

const SKILLS = section('Skills', skills.map((s) => `${s.group}\n  ${s.items}`).join('\n\n'));

const EDUCATION = section(
  'Education',
  education.map((e) => `${e.degree}\n${e.org} · ${e.period} · ${e.detail}`).join('\n\n'),
);

const AWARDS = section('Awards', awards.map((a) => `- ${a}`).join('\n'));

const CONTACT = section(
  'Contact',
  [
    `Email   ${profile.email}`,
    `Phone   ${profile.phone}`,
    `Where   ${profile.location}`,
    `GitHub  github.com/${profile.github}`,
    `Now     ${profile.title} @ ${profile.company}`,
  ].join('\n'),
);

const DISCLOSURE = `Publication policy for this repository
=====================================

This portfolio is public and I work inside a regulated insurer.

Employer-internal production metrics — submission counts, latency
percentiles, corpus sizes, programme spend, reviewer-decision totals —
are NOT published here. They require written clearance and they live
only in a private master résumé.

What IS published: architecture, method, named negative results, and
numbers sourced from public corpora or from my own repositories.

If you need a figure that isn't here, ask. Some of it can be shared
under NDA; some of it can't be shared at all, and I'd rather say so.

  ${profile.email}
`;

const README = `Welcome — my portfolio, rendered as a Kali Linux desktop.

Everything here is interactive:
  • Terminal          try: help · resume · blog · papers · news · ai <question>
  • Whisker menu      top-left: Kali tools, the Games arcade, everything else
  • Writing           posts + the papers I'm reading (also at /writing)
  • AI Radar          live AI headlines from public feeds, with a catch-up brief
  • Learning OS       my skill-state model — evidence, dependencies, AI-free checks
                      (run 'learn'; state stays in your browser, never on a server)
  • Multiplayer       arcade games sync live — open two tabs and play
  • Documents         ~/Documents holds the real résumé content

Plain pages for humans in a hurry:  /resume  ·  /writing

— Diwakar
`;

const ZSHRC = `# ~/.zshrc — kali default-ish
export PS1='┌──(kali㉿kali)-[%~]\\n└─$ '
alias ll='ls -lah'
alias la='ls -A'
alias ..='cd ..'
neofetch
`;

/** /home/kali */
export function buildHomeTree(): FsNode {
  return dir({
    'about.txt': file(ABOUT),
    'README.md': file(README),
    '.zshrc': file(ZSHRC),
    Desktop: dir({}),
    Downloads: dir({}),
    Documents: dir({
      'resume.md': file(resumeText()),
      'experience.md': file(EXPERIENCE),
      'projects.md': file(PROJECTS),
      'research.md': file(RESEARCH),
      'skills.md': file(SKILLS),
      'education.md': file(EDUCATION),
      'awards.md': file(AWARDS),
      'contact.txt': file(CONTACT),
      'PUBLICATION-POLICY.txt': file(DISCLOSURE),
    }),
    Pictures: dir({}),
  });
}
