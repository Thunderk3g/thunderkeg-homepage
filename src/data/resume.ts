export const profile = {
  name: 'DIWAKAR ADHIKARI',
  title: 'Technical Lead — AI Engineering',
  company: 'Bajaj Life Insurance',
  location: 'Pune, India',
  phone: '9378067880',
  email: 'diwakar.adhikari0@gmail.com',
  summary: [
    'AI/ML Lead Engineer at Bajaj Life Insurance, specializing in AI/ML innovations for the insurance sector.',
    'Passionate about deploying large language models (LLMs) and agent-based systems to enhance risk assessment, claims automation, underwriting intelligence, and customer personalization.',
    'Skilled in Python, deep learning frameworks (PyTorch via Hugging Face) and AWS, with strong experience leading cross-functional teams to architect scalable, production-grade AI platforms.',
    'Actively engaged in research on quantized LLMs and edge-efficient inference.',
  ],
};

export interface Mission {
  id: string;
  /** GTA-style mission title */
  title: string;
  /** location name shown under the title */
  place: string;
  /** what the marker board in the world says */
  sign: string;
  /** intro line, in the style of a mission briefing */
  brief: string;
  lines: string[];
  respect: number;
}

export const missions: Mission[] = [
  {
    id: 'bajaj-life',
    title: 'THE AI TAKEOVER',
    place: 'Bajaj Life Tower, Downtown',
    sign: 'BAJAJ LIFE',
    brief: 'Dec 2025 – Present · Technical Lead – AI Engineering, Bajaj Life Insurance',
    lines: [
      'Leads production-grade AI agent development to automate enterprise workflows, accelerating adoption of industry-scale agentic AI solutions.',
      'Architects and deploys LLM-powered systems (Python, PyTorch, Hugging Face, AWS) with a strong focus on scalability, security and reliability.',
      'Works with product, platform and business teams to turn slow-moving enterprise processes into intelligent, autonomous AI pipelines.',
      'Drives AI innovation across insurance use cases — risk assessment, automation, personalization — with production readiness and measurable impact.',
    ],
    respect: 25,
  },
  {
    id: 'finserv',
    title: 'THE TERM LIFE HUSTLE',
    place: 'Finserv Direct HQ, Commerce District',
    sign: 'FINSERV DIRECT',
    brief: 'June 2022 – Nov 2025 · Dev Lead, Bajaj Finserv Direct Ltd, Pune',
    lines: [
      'Dev Lead for a 10-member crew delivering high-impact term-insurance journeys; led APIs, deployments and cross-team integration with Bajaj Allianz (25% efficiency gain).',
      'Improved performance, SEO and engagement via Angular optimization and SSR — up to 30% performance and 20% engagement uplift.',
      'Enhanced scalability and security, fixed critical auth issues (VAPT).',
      'Contributed to the Bajaj Finserv Asset Management NFO launch driving 50% user adoption.',
    ],
    respect: 25,
  },
  {
    id: 'projects',
    title: 'GARAGE EXPERIMENTS',
    place: "Diwakar's Garage, Industrial Side",
    sign: 'THE GARAGE',
    brief: 'Side hustles. Open-source builds. Things that go fast.',
    lines: [
      'full-duplex-moshi-agent — Python build on the Moshi full-duplex spoken dialogue model (forked from kyutai-labs/moshi). Real-time voice-enabled LLM interaction for agentic, local-first conversational AI.',
      'compliance-agent-poc — TypeScript proof-of-concept for a compliance-centric AI agent enforcing rule-based checks in workflows. Governance and safety layers for autonomous systems.',
      'Teeny — research on LLM quantization and efficient inference: smaller footprint, edge-ready AI.',
    ],
    respect: 20,
  },
  {
    id: 'skills',
    title: 'PUMP UP THE STACK',
    place: 'The Skills Gym, East Side',
    sign: 'SKILLS GYM',
    brief: 'No pain, no production gains. Current stats:',
    lines: [
      'AI/ML — Python, LangChain, Hugging Face Transformers, PyTorch.',
      'Backend — Java, API design & integration, Redis, Apache Kafka.',
      'Frontend — Angular, Next.js, Vite.',
      'Infra — Docker, AWS.',
    ],
    respect: 15,
  },
  {
    id: 'education',
    title: 'SCHOOL DAYS',
    place: 'SRM University Campus',
    sign: 'SRM UNIVERSITY',
    brief: 'Apr 2018 – May 2022 · Where it all started.',
    lines: [
      'Bachelor of Technology in Computer Science Engineering, SRM University.',
      'Graduated with an 8.8 CGPA.',
      'COMPEX Indian Embassy Scholarship Scheme Awardee.',
    ],
    respect: 15,
  },
  {
    id: 'awards',
    title: 'RESPECT EARNED',
    place: 'City Hall Plaza',
    sign: 'CITY HALL',
    brief: 'Trophies, papers and street cred.',
    lines: [
      'Esteemed Contributor — Financial Innovation Award.',
      'COMPEX Indian Embassy Scholarship Scheme Awardee.',
      '"SustainAI: Enhancing Sustainable Energy Forecasting" — paper presented at the 1st International Conference on Computing for Science, Engineering & AI (CSEAI 2023), organized with California State University and the International Association of Academicians.',
    ],
    respect: 20,
  },
  {
    id: 'contact',
    title: 'GIVE ME A CALL',
    place: 'Payphone, Central Park',
    sign: 'PHONE',
    brief: 'The mission giver is one call away.',
    lines: [
      'Phone — 9378067880',
      'Email — diwakar.adhikari0@gmail.com',
      'Turf — Pune, India',
      'Currently: Technical Lead, AI Engineering @ Bajaj Life Insurance.',
    ],
    respect: 30,
  },
];

export const totalRespect = missions.reduce((s, m) => s + m.respect, 0);
