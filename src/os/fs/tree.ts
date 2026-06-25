import type { FsNode } from '../types';

const file = (content: string): FsNode => ({ type: 'file', content, mode: 'rw-r--r--' });
const dir = (children: Record<string, FsNode>): FsNode => ({ type: 'dir', children, mode: 'rwxr-xr-x' });

const ABOUT = `Diwakar Adhikari
Technical Lead — AI Engineering @ Bajaj Life Insurance
Pune, India

AI/ML Lead Engineer specialising in AI/ML innovations for the insurance
sector. I deploy large language models and agent-based systems to enhance
risk assessment, claims automation, underwriting intelligence and customer
personalization.

Skilled in Python, deep-learning frameworks (PyTorch via Hugging Face) and
AWS, with strong experience leading cross-functional teams to architect
scalable, production-grade AI platforms. Actively researching quantized LLMs
and edge-efficient inference.

Type 'help' to see available commands, or run 'neofetch'.
Launch apps from here too:  firefox · thunar · games · msfconsole · nmap
`;

const EXPERIENCE = `# Work Experience

## Technical Lead — AI Engineering · Bajaj Life Insurance
Dec 2025 – Present
- Leads production-grade AI agent development to automate enterprise
  workflows, accelerating adoption of industry-scale agentic AI.
- Architects and deploys LLM-powered systems (Python, PyTorch, Hugging
  Face, AWS) with a focus on scalability, security and reliability.
- Partners with product, platform and business teams to turn slow
  enterprise processes into intelligent, autonomous AI pipelines.

## Dev Lead · Bajaj Finserv Direct Ltd, Pune
Jun 2022 – Nov 2025
- Led a 10-member crew delivering high-impact term-insurance journeys;
  owned APIs, deployments and cross-team integration with Bajaj Allianz
  (25% efficiency gain).
- Angular optimization + SSR: up to 30% performance and 20% engagement uplift.
- Enhanced scalability and security; fixed critical auth issues (VAPT).
- Contributed to the Bajaj Finserv AMC NFO launch, driving 50% adoption.
`;

const PROJECTS = `# Projects

- full-duplex-moshi-agent — Python build on the Moshi full-duplex spoken
  dialogue model (forked from kyutai-labs/moshi). Real-time voice-enabled
  LLM interaction for agentic, local-first conversational AI.

- compliance-agent-poc — TypeScript PoC for a compliance-centric AI agent
  enforcing rule-based checks in workflows. Governance and safety layers
  for autonomous systems.

- Teeny — research on LLM quantization and efficient inference: smaller
  footprint, edge-ready AI.
`;

const SKILLS = `# Skills

AI/ML     Python · LangChain · Hugging Face Transformers · PyTorch
Backend   Java · API design & integration · Redis · Apache Kafka
Frontend  Angular · Next.js · Vite
Infra     Docker · AWS
`;

const EDUCATION = `# Education

B.Tech, Computer Science Engineering — SRM University (Apr 2018 – May 2022)
- Graduated with an 8.8 CGPA.
- COMPEX Indian Embassy Scholarship Scheme Awardee.
`;

const AWARDS = `# Awards & Research

- Esteemed Contributor — Financial Innovation Award.
- COMPEX Indian Embassy Scholarship Scheme Awardee.
- "SustainAI: Enhancing Sustainable Energy Forecasting" — paper presented
  at the 1st International Conference on Computing for Science, Engineering
  & AI (CSEAI 2023), with California State University and the IAA.
`;

const CONTACT = `# Contact

Email   diwakar.adhikari0@gmail.com
Phone   9378067880
Where   Pune, India
Now     Technical Lead, AI Engineering @ Bajaj Life Insurance
`;

const ZSHRC = `# ~/.zshrc — kali default-ish
export PS1='┌──(kali㉿kali)-[%~]\\n└─$ '
alias ll='ls -lah'
alias la='ls -A'
alias ..='cd ..'
neofetch
`;

const README = `Welcome to my portfolio — rendered as a Kali Linux desktop.

Everything here is interactive:
  • Open the Terminal and poke around (try: help, neofetch, ls, cat about.txt)
  • The whisker menu (top-left) holds the Kali tools menu + the Games arcade
  • Multiplayer games sync live over Supabase — open two tabs and play
  • Real résumé content lives in ~/Documents

— Diwakar
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
      'resume.md': file(
        [README, '', ABOUT, '', EXPERIENCE, PROJECTS, SKILLS, EDUCATION, AWARDS, CONTACT].join('\n'),
      ),
      'experience.md': file(EXPERIENCE),
      'projects.md': file(PROJECTS),
      'skills.md': file(SKILLS),
      'education.md': file(EDUCATION),
      'awards.md': file(AWARDS),
      'contact.txt': file(CONTACT),
    }),
    Pictures: dir({}),
  });
}
