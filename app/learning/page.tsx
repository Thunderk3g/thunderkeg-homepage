import type { Metadata } from 'next';
import { LearningOS } from '@/learning/LearningOS';

export const metadata: Metadata = {
  title: 'Learning OS — Diwakar Adhikari',
  description:
    'A persistent skill-state model for the transition into senior AI systems engineering: evidence, dependencies, AI-free checks.',
  // A working record, not a portfolio page — keep it out of search results.
  robots: { index: false, follow: false },
};

export default function LearningPage() {
  return (
    <div className="doc-page">
      <main className="doc-wrap wide">
        <nav className="doc-nav">
          <a href="/">desktop</a>
          <a href="/resume">résumé</a>
          <a href="/writing">writing</a>
          <span aria-current="page">learning os</span>
        </nav>

        <h1>Learning OS</h1>
        <p className="doc-lede">
          A persistent model of what I actually know — separated from what an AI agent produced on my
          behalf. Skill states move on evidence, in both directions, and the only thing that
          establishes independence is passing the AI-free check.
        </p>
        <p className="doc-lede-small">
          State lives in this browser only. Nothing is sent to a server and nothing is committed to
          git, so the record stays honest.
        </p>

        <LearningOS />
      </main>
    </div>
  );
}
