'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Grade } from '@/research/types';
import { dueCards, useResearch } from '@/research/store';
import { addDays, intervalFor, isoDay } from '@/research/schedule';

const GRADES: { grade: Grade; label: string; key: string; cls: string }[] = [
  { grade: 'again', label: 'Again', key: '1', cls: 'bad' },
  { grade: 'hard', label: 'Hard', key: '2', cls: '' },
  { grade: 'good', label: 'Good', key: '3', cls: 'ok' },
  { grade: 'easy', label: 'Easy', key: '4', cls: '' },
];

const fmtDays = (d: number) => (d < 31 ? `${d}d` : d < 365 ? `${Math.round(d / 30)}mo` : `${Math.round(d / 365)}y`);

/**
 * Retrieval practice: type a recall *before* the answer is shown (Karpicke &
 * Blunt 2011), across papers in a shuffled order, then grade. The typed text
 * is shown next to the answer so the grade is honest.
 */
export function ReviewDeck({ onOpenPaper }: { onOpenPaper: (id: string) => void }) {
  const cards = useResearch((s) => s.cards);
  const papers = useResearch((s) => s.papers);
  const rqs = useResearch((s) => s.rqs);
  const review = useResearch((s) => s.review);

  const today = isoDay();
  // the session's queue is fixed when it starts, so grading never reshuffles it
  const [queue, setQueue] = useState<string[]>(() => dueCards({ cards }, today).map((c) => c.id));
  const [idx, setIdx] = useState(0);
  const [typed, setTyped] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [tally, setTally] = useState<Record<Grade, number>>({ again: 0, hard: 0, good: 0, easy: 0 });
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const card = cards.find((c) => c.id === queue[idx]);
  const paper = card ? papers.find((p) => p.id === card.paperId) : undefined;
  const done = idx >= queue.length;
  const reviewed = Object.values(tally).reduce((a, b) => a + b, 0);

  const grade = (g: Grade) => {
    if (!card || !revealed) return;
    review(card.id, g, typed.trim().length > 0);
    setTally((t) => ({ ...t, [g]: t[g] + 1 }));
    setIdx((i) => i + 1);
    setTyped('');
    setRevealed(false);
  };

  /**
   * Scoped to this deck (not window), so other windows keep their keys.
   * Space reveals — from anywhere in the deck, or in the recall box while it is
   * still empty; 1–4 grade once the answer shows (the recall box is read-only then).
   */
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey || !card) return;
    const t = e.target as HTMLElement;
    const inRecall = t instanceof HTMLTextAreaElement;
    const editable = inRecall ? !(t as HTMLTextAreaElement).readOnly : t instanceof HTMLInputElement;
    if (!revealed && e.key === ' ' && (!editable || (inRecall && typed.length === 0))) {
      e.preventDefault();
      setRevealed(true);
      return;
    }
    if (revealed && !editable) {
      const g = GRADES.find((x) => x.key === e.key);
      if (g) {
        e.preventDefault();
        e.stopPropagation();
        grade(g.grade);
      }
    }
  };

  // after a reveal the deck itself holds focus, so 1–4 work without a click
  const deckRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (revealed) deckRef.current?.focus({ preventScroll: true });
  }, [revealed]);

  useEffect(() => {
    if (!revealed && card) inputRef.current?.focus({ preventScroll: true });
  }, [card, revealed]);

  const forecast = useMemo(() => {
    const days = Array.from({ length: 14 }, (_, i) => addDays(today, i));
    return days.map((d, i) => ({
      day: d,
      n: cards.filter((c) => !c.suspended && (i === 0 ? c.due <= d : c.due === d)).length,
    }));
  }, [cards, today]);
  const peak = Math.max(1, ...forecast.map((f) => f.n));

  const elaborationPrompt = () => {
    if (!card) return '';
    if (card.elaboration) return card.elaboration;
    const rq = rqs.find((q) => (card.rqIds.length ? card.rqIds : paper?.rqIds ?? []).includes(q.id));
    return rq ? `How does this bear on ${rq.id.toUpperCase()} — ${rq.question}` : 'Why is this true, and what would change if it were not?';
  };

  const scheduled = cards.filter((c) => !c.suspended);
  const nextDue = scheduled.map((c) => c.due).filter((d) => d > today).sort()[0];

  return (
    <div className="rsx-review" ref={deckRef} tabIndex={-1} onKeyDown={onKeyDown} data-testid="rsx-review">
      {!done && card ? (
        <div className="rsx-card-face">
          <p className="rsx-review-count">
            {idx + 1} / {queue.length}
            {paper && (
              <button className="rsx-link-btn" onClick={() => onOpenPaper(paper.id)} title="open paper">
                {paper.title}
              </button>
            )}
          </p>
          <p className="rsx-review-prompt">{card.prompt}</p>
          <textarea
            ref={inputRef}
            className="rsx-recall"
            rows={3}
            value={typed}
            readOnly={revealed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !revealed) {
                e.preventDefault();
                setRevealed(true);
              }
            }}
            placeholder="Recall before revealing — type anything"
            aria-label="your recall"
          />
          {!revealed ? (
            <button className="lrn-btn primary big" onClick={() => setRevealed(true)}>
              Reveal <span className="lrn-dim">(Enter / Space)</span>
            </button>
          ) : (
            <>
              <div className="rsx-answer">
                <p className="rsx-answer-label">Answer</p>
                <p className="rsx-answer-text">{card.answer}</p>
                <p className="rsx-answer-label">Elaborate</p>
                <p className="rsx-elab">{elaborationPrompt()}</p>
              </div>
              <div className="rsx-grades" role="group" aria-label="Grade">
                {GRADES.map((g) => (
                  <button key={g.grade} className={`lrn-btn ${g.cls}`} onClick={() => grade(g.grade)}>
                    {g.label} ({fmtDays(intervalFor(card, g.grade).days)})
                    <kbd>{g.key}</kbd>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="rsx-card-face">
          {reviewed > 0 ? (
            <>
              <p className="lrn-big">Session done — {reviewed} reviewed.</p>
              <p className="lrn-metrics">
                again {tally.again} · hard {tally.hard} · good {tally.good} · easy {tally.easy}
              </p>
            </>
          ) : null}
          <p className="lrn-empty">
            Nothing due. {scheduled.length} card{scheduled.length === 1 ? '' : 's'} scheduled
            {nextDue ? `; next due ${nextDue}.` : '. Write some from a paper’s detail view.'}
          </p>
          {dueCards({ cards }, today).length > 0 && (
            <button
              className="lrn-btn"
              onClick={() => {
                setQueue(dueCards({ cards }, today).map((c) => c.id));
                setIdx(0);
                setTally({ again: 0, hard: 0, good: 0, easy: 0 });
              }}
            >
              Review the {dueCards({ cards }, today).length} newly due
            </button>
          )}
        </div>
      )}

      <div className="rsx-forecast" aria-label="14-day forecast">
        <p className="rsx-answer-label">Next 14 days</p>
        <ol>
          {forecast.map((f, i) => (
            <li key={f.day} title={`${f.day}: ${f.n} due`}>
              <span className="rsx-bar" style={{ height: `${Math.round((f.n / peak) * 100)}%` }} />
              <span className="rsx-bar-n">{f.n || ''}</span>
              <span className="rsx-bar-d">{i === 0 ? 'today' : f.day.slice(8)}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
