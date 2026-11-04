'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { Highlight, Paper } from '@/research/types';
import { useResearch } from '@/research/store';
import { draftCardFromHighlight } from '@/research/highlights';

/**
 * Quick-add box. The PDF iframe cannot hand its text selection to the page,
 * so the workflow is: select in the PDF, Ctrl+C, then paste here (h focuses it).
 * Ctrl/Cmd+Enter or the button adds.
 */
export function HighlightAdd({ paper, compact = false }: { paper: Paper; compact?: boolean }) {
  const addHighlight = useResearch((s) => s.addHighlight);
  const [text, setText] = useState('');
  const [where, setWhere] = useState('');
  const [why, setWhy] = useState('');

  const add = () => {
    if (!text.trim()) return;
    addHighlight({ paperId: paper.id, text, where, why });
    setText('');
    setWhy('');
    // keep `where`: consecutive highlights usually come from the same page
  };

  return (
    <form
      className={'rsx-hl-add' + (compact ? ' compact' : '')}
      onSubmit={(e) => {
        e.preventDefault();
        add();
      }}
    >
      <textarea
        data-k="hl-text"
        rows={compact ? 2 : 3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            add();
          }
          if (e.key === 'Escape') (e.target as HTMLTextAreaElement).blur();
        }}
        placeholder="Paste a sentence from the paper (h) — Ctrl+Enter adds it"
        aria-label="highlight text"
      />
      <div className="rsx-hl-add-row">
        <input value={where} onChange={(e) => setWhere(e.target.value)} placeholder="p. 4 / §3.2" aria-label="page or section" className="rsx-hl-where" />
        <input value={why} onChange={(e) => setWhy(e.target.value)} placeholder="why it matters (optional)" aria-label="why it matters" />
        <button className="lrn-btn tiny primary" type="submit" disabled={!text.trim()}>
          Add highlight
        </button>
      </div>
    </form>
  );
}

function CardFromHighlight({ h, paper, onDone }: { h: Highlight; paper: Paper; onDone: () => void }) {
  const addCard = useResearch((s) => s.addCard);
  const patchHighlight = useResearch((s) => s.patchHighlight);
  const draft = useMemo(() => draftCardFromHighlight(h, paper), [h, paper]);
  const [prompt, setPrompt] = useState(draft.prompt);
  const [answer, setAnswer] = useState(draft.answer);
  const [elab, setElab] = useState(draft.elaboration ?? '');

  const save = () => {
    if (!prompt.trim() || !answer.trim()) return;
    const id = addCard({ paperId: paper.id, prompt, answer, elaboration: elab, origin: 'me' });
    patchHighlight(h.id, { cardId: id });
    toast.success('Card added — due today');
    onDone();
  };

  return (
    <div className="rsx-hl-card lrn-form" data-testid="rsx-hl-card">
      <p className="lrn-dim">Draft ({draft.kind === 'cloze' ? 'cloze on the number' : 'question'}) — edit it into your own words.</p>
      <label className="lrn-field">
        Prompt
        <textarea rows={2} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
      </label>
      <label className="lrn-field">
        Answer
        <textarea rows={2} value={answer} onChange={(e) => setAnswer(e.target.value)} />
      </label>
      <label className="lrn-field">
        Elaboration (optional)
        <input value={elab} onChange={(e) => setElab(e.target.value)} />
      </label>
      <div className="lrn-btn-row">
        <button className="lrn-btn primary tiny" onClick={save} disabled={!prompt.trim() || !answer.trim()}>
          Add card
        </button>
        <button className="lrn-btn tiny" onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export function HighlightList({ paper }: { paper: Paper }) {
  const all = useResearch((s) => s.highlights);
  const cards = useResearch((s) => s.cards);
  const deleteHighlight = useResearch((s) => s.deleteHighlight);
  const hs = useMemo(() => all.filter((h) => h.paperId === paper.id), [all, paper.id]);
  const [carding, setCarding] = useState<string | null>(null);
  const cardIds = useMemo(() => new Set(cards.map((c) => c.id)), [cards]);

  if (!hs.length) return <p className="lrn-empty rsx-hl-empty">No highlights yet. Paste the sentences you would quote.</p>;

  return (
    <ul className="rsx-hl-list" data-testid="rsx-hl-list">
      {hs.map((h) => {
        const carded = !!h.cardId && cardIds.has(h.cardId);
        return (
          <li key={h.id}>
            <blockquote className="rsx-hl-text">{h.text}</blockquote>
            {h.why && <p className="rsx-card-e">{h.why}</p>}
            <p className="rsx-card-meta">
              {h.where && <span>{h.where} · </span>}
              {h.createdAt.slice(0, 10)}
              {carded ? (
                <span className="rsx-hl-carded"> · card made</span>
              ) : (
                <button className="rsx-link-btn" onClick={() => setCarding(carding === h.id ? null : h.id)}>
                  make card
                </button>
              )}
              <button className="rsx-link-btn bad" onClick={() => deleteHighlight(h.id)}>
                delete
              </button>
            </p>
            {carding === h.id && <CardFromHighlight h={h} paper={paper} onDone={() => setCarding(null)} />}
          </li>
        );
      })}
    </ul>
  );
}
