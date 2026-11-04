'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { STATUS_LABEL, STATUS_ORDER, type GraphRef, type GraphResponse, type Paper, type PaperHit, type ReadStatus } from '@/research/types';
import { emptyNote, useResearch } from '@/research/store';
import { isoDay } from '@/research/schedule';
import { toBibtex } from '@/research/bibtex';
import { contentSlug, toContentMarkdown } from '@/research/markdown';
import { cardsPrompt, firstPassPrompt, offlineCards, offlineFirstPass, parseCardLines, parseFiveCs, type CardDraft } from '@/research/offline';
import { copyText, download, fetchGraph, searchPapers } from '@/research/client';
import { streamChat } from '@/os/ai/stream';
import { useLearning } from '@/learning/store';
import { ASSISTANCE_LABEL, type AiAssistance } from '@/learning/types';

/* ───────────────────────── small pieces ───────────────────────── */

function Field({
  label,
  value,
  onChange,
  rows = 2,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <label className="lrn-field">
      {label}
      <textarea rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

const PASS_GROUP: Record<ReadStatus, 'p1' | 'p2' | 'p3'> = {
  inbox: 'p1',
  pass1: 'p1',
  pass2: 'p2',
  pass3: 'p3',
  done: 'p3',
  dropped: 'p3',
};

/** RQ → the Learning OS skills that paper study on it most plausibly exercises. */
const RQ_SKILLS: Record<string, string[]> = {
  rq1: ['retrieval-design', 'rag'],
  rq2: ['eval-methodology'],
  rq3: ['speech-systems', 'eval-methodology'],
  rq4: ['eval-methodology', 'indic-speech-ecosystem'],
  rq5: ['llm-app-arch'],
};

const s2Link = (p: Paper) =>
  p.arxivId
    ? `https://www.semanticscholar.org/arxiv/${p.arxivId}`
    : `https://www.semanticscholar.org/search?q=${encodeURIComponent(p.title)}`;

/* ───────────────────────── detail ───────────────────────── */

export function PaperDetail({
  paper,
  onBack,
  onOpenPaper,
}: {
  paper: Paper;
  onBack: () => void;
  onOpenPaper: (id: string) => void;
}) {
  const rqs = useResearch((s) => s.rqs);
  const allCards = useResearch((s) => s.cards);
  const setStatus = useResearch((s) => s.setStatus);
  const patchNote = useResearch((s) => s.patchNote);
  const setTags = useResearch((s) => s.setTags);
  const toggleRq = useResearch((s) => s.toggleRq);
  const removePaper = useResearch((s) => s.removePaper);

  const cards = useMemo(() => allCards.filter((c) => c.paperId === paper.id), [allCards, paper.id]);
  const [tagText, setTagText] = useState(paper.tags.join(', '));
  const [warn, setWarn] = useState('');

  const note = paper.note ?? emptyNote();
  const group = PASS_GROUP[paper.status];
  const cs = note.fiveCs;

  const changeStatus = (s: ReadStatus) => {
    setStatus(paper.id, s);
    setWarn(s === 'done' && cards.length === 0 ? 'No recall cards — write 2–3 first.' : '');
  };

  const commitTags = () =>
    setTags(
      paper.id,
      [...new Set(tagText.split(',').map((t) => t.trim()).filter(Boolean))],
    );

  const groups = {
    p1: (
      <details key="p1" className="rsx-group" open={group === 'p1'}>
        <summary>Pass 1 — the five Cs</summary>
        <Field label="Category — what type of paper?" value={cs.category} onChange={(v) => patchNote(paper.id, { fiveCs: { category: v } })} />
        <Field label="Context — which papers is it related to?" value={cs.context} onChange={(v) => patchNote(paper.id, { fiveCs: { context: v } })} />
        <Field label="Correctness — do the assumptions look valid?" value={cs.correctness} onChange={(v) => patchNote(paper.id, { fiveCs: { correctness: v } })} />
        <Field label="Contributions — the main ones" value={cs.contributions} onChange={(v) => patchNote(paper.id, { fiveCs: { contributions: v } })} />
        <Field label="Clarity — is it well written?" value={cs.clarity} onChange={(v) => patchNote(paper.id, { fiveCs: { clarity: v } })} />
      </details>
    ),
    p2: (
      <details key="p2" className="rsx-group" open={group === 'p2'}>
        <summary>Pass 2 — the content</summary>
        <Field label="Problem" value={note.problem} onChange={(v) => patchNote(paper.id, { problem: v })} rows={3} />
        <Field label="Method" value={note.method} onChange={(v) => patchNote(paper.id, { method: v })} rows={3} />
        <Field label="Results (with the numbers)" value={note.results} onChange={(v) => patchNote(paper.id, { results: v })} rows={3} />
        <Field label="Limitations" value={note.limitations} onChange={(v) => patchNote(paper.id, { limitations: v })} rows={3} />
      </details>
    ),
    p3: (
      <details key="p3" className="rsx-group" open={group === 'p3'}>
        <summary>Pass 3 — re-derive and critique</summary>
        <Field label="My critique — what would break it?" value={note.critique} onChange={(v) => patchNote(paper.id, { critique: v })} rows={4} />
        <Field
          label="Delta — what is left for my work after this paper"
          value={note.delta}
          onChange={(v) => patchNote(paper.id, { delta: v })}
          rows={3}
        />
      </details>
    ),
  };
  const order = group === 'p1' ? ['p1', 'p2', 'p3'] : group === 'p2' ? ['p2', 'p1', 'p3'] : ['p3', 'p2', 'p1'];

  return (
    <div className="rsx-detail">
      <button className="lrn-btn tiny rsx-back" onClick={onBack}>
        ← Library
      </button>

      <header className="rsx-detail-head">
        <h2 className="rsx-detail-title">{paper.title}</h2>
        <p className="rsx-row-meta">
          {paper.authors.join(', ') || 'authors unknown'}
          {paper.arxivId && ` · arXiv:${paper.arxivId}`}
          {paper.primaryCategory && ` · ${paper.primaryCategory}`}
          {paper.venue && ` · ${paper.venue}`}
        </p>
        <p className="rsx-links">
          <a href={paper.absUrl} target="_blank" rel="noreferrer">
            {paper.arxivId ? 'abs' : 'link'}
          </a>
          {paper.pdfUrl && (
            <a href={paper.pdfUrl} target="_blank" rel="noreferrer">
              pdf
            </a>
          )}
          {paper.arxivId && (
            <a href={`https://www.alphaxiv.org/abs/${paper.arxivId}`} target="_blank" rel="noreferrer">
              alphaXiv
            </a>
          )}
          <a href={s2Link(paper)} target="_blank" rel="noreferrer">
            Semantic Scholar
          </a>
          {paper.contentSlug && (
            <a href={`/writing/${paper.contentSlug}`} target="_blank" rel="noreferrer">
              published note
            </a>
          )}
        </p>
      </header>

      <ol className="rsx-stepper" aria-label="Reading status">
        {STATUS_ORDER.map((s) => (
          <li key={s}>
            <button
              className={'rsx-step' + (paper.status === s ? ' on' : '') + (s === 'dropped' ? ' drop' : '')}
              aria-pressed={paper.status === s}
              onClick={() => changeStatus(s)}
            >
              {STATUS_LABEL[s]}
            </button>
          </li>
        ))}
      </ol>
      {warn && <p className="rsx-error">{warn}</p>}

      <div className="rsx-meta-row">
        <div className="rsx-rq-toggles" role="group" aria-label="Research questions">
          {rqs.map((q) => (
            <button
              key={q.id}
              className={'lrn-chip' + (paper.rqIds.includes(q.id) ? ' on' : '')}
              title={q.question}
              onClick={() => toggleRq(paper.id, q.id)}
            >
              {q.short}
            </button>
          ))}
        </div>
        <label className="lrn-field rsx-tags">
          Tags (comma-separated)
          <input
            value={tagText}
            onChange={(e) => setTagText(e.target.value)}
            onBlur={commitTags}
            onKeyDown={(e) => e.key === 'Enter' && commitTags()}
          />
        </label>
      </div>

      {paper.abstract && (
        <details className="rsx-group" open={paper.status === 'inbox' || paper.status === 'pass1'}>
          <summary>{paper.source === 'note' ? 'Summary' : 'Abstract'}</summary>
          <p className="rsx-abstract open">{paper.abstract}</p>
        </details>
      )}

      <h3 className="rsx-h">Notes</h3>
      <FirstPass paper={paper} />
      {order.map((k) => groups[k as keyof typeof groups])}
      <details className="rsx-group" open={!!note.freeform && paper.source === 'note' && group !== 'p1'}>
        <summary>Free-form notes{paper.contentSlug ? ' (imported from the published note)' : ''}</summary>
        <Field label="Markdown" value={note.freeform} onChange={(v) => patchNote(paper.id, { freeform: v })} rows={10} />
      </details>

      <h3 className="rsx-h">Recall cards ({cards.length})</h3>
      <Cards paper={paper} />

      <h3 className="rsx-h">Tools</h3>
      <Tools paper={paper} cardCount={cards.length} />

      <Connections paper={paper} onOpenPaper={onOpenPaper} />

      <div className="lrn-btn-row rsx-danger">
        <button
          className="lrn-btn tiny bad"
          onClick={() => {
            if (confirm(`Remove “${paper.title}” and its ${cards.length} cards from the library?`)) {
              removePaper(paper.id);
              onBack();
            }
          }}
        >
          Remove from library
        </button>
      </div>
    </div>
  );
}

/* ───────────────────────── first pass ───────────────────────── */

function FirstPass({ paper }: { paper: Paper }) {
  const rqs = useResearch((s) => s.rqs);
  const patchNote = useResearch((s) => s.patchNote);
  const [out, setOut] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    setOut('');
    let acc = '';
    const offline = () => offlineFirstPass(paper, rqs);
    const r = await streamChat(
      [{ role: 'user', content: firstPassPrompt(paper, rqs) }],
      (d) => {
        acc += d;
        setOut(acc);
      },
      { mode: 'paper', offline },
    );
    // a configured-but-failing model still gets him a usable template
    if (r.error && !r.text.trim()) setOut(offline());
    setBusy(false);
  };

  const copyIn = () => {
    const parsed = parseFiveCs(out);
    const cs = paper.note.fiveCs;
    // fill only empty fields: never overwrite what he wrote himself
    const fill = Object.fromEntries(Object.entries(parsed).filter(([k]) => !cs[k as keyof typeof cs].trim()));
    patchNote(paper.id, { fiveCs: fill });
    toast.success(`Copied ${Object.keys(fill).length} field(s) into the five Cs`);
  };

  return (
    <div className="rsx-ai">
      <div className="lrn-btn-row">
        <button className="lrn-btn" onClick={run} disabled={busy}>
          {busy ? 'Reading the abstract…' : 'First pass with AI'}
        </button>
        <span className="lrn-dim">Abstract only — a draft to argue with, not notes.</span>
      </div>
      {out && (
        <>
          <pre className="rsx-ai-out">{out}</pre>
          {!busy && (
            <div className="lrn-btn-row">
              <button className="lrn-btn tiny" onClick={copyIn}>
                Copy into my notes
              </button>
              <button className="lrn-btn tiny" onClick={() => setOut('')}>
                Dismiss
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ───────────────────────── cards ───────────────────────── */

function Cards({ paper }: { paper: Paper }) {
  const allCards = useResearch((s) => s.cards);
  const addCard = useResearch((s) => s.addCard);
  const deleteCard = useResearch((s) => s.deleteCard);
  const patchCard = useResearch((s) => s.patchCard);
  const rqs = useResearch((s) => s.rqs);
  const cards = allCards.filter((c) => c.paperId === paper.id);

  const [prompt, setPrompt] = useState('');
  const [answer, setAnswer] = useState('');
  const [elab, setElab] = useState('');
  const [origin, setOrigin] = useState<'me' | 'llm' | 'offline'>('me');
  const [drafts, setDrafts] = useState<(CardDraft & { origin: 'llm' | 'offline' })[]>([]);
  const [busy, setBusy] = useState(false);

  const rqName = rqs.find((q) => paper.rqIds.includes(q.id))?.id.toUpperCase() ?? 'RQn';

  const add = () => {
    if (!prompt.trim() || !answer.trim()) return;
    addCard({ paperId: paper.id, prompt, answer, elaboration: elab, origin });
    setPrompt('');
    setAnswer('');
    setElab('');
    setOrigin('me');
  };

  const suggest = async () => {
    setBusy(true);
    let usedOffline = false;
    const r = await streamChat([{ role: 'user', content: cardsPrompt(paper) }], () => {}, {
      mode: 'paper',
      offline: () => {
        usedOffline = true;
        return offlineCards(paper)
          .map((c) => `Q: ${c.prompt} || A: ${c.answer}`)
          .join('\n');
      },
    });
    let parsed = parseCardLines(r.text);
    let src: 'llm' | 'offline' = usedOffline ? 'offline' : 'llm';
    if (!parsed.length) {
      parsed = offlineCards(paper);
      src = 'offline';
    }
    setDrafts(parsed.map((d) => ({ ...d, origin: src })));
    if (!parsed.length) toast.message('No numeric claims in the abstract to cloze — write these yourself.');
    setBusy(false);
  };

  return (
    <div className="rsx-cards">
      {cards.length === 0 && <p className="lrn-empty">No cards yet. Two or three per paper: the claims you would cite.</p>}
      <ul className="rsx-card-list">
        {cards.map((c) => (
          <li key={c.id} className={c.suspended ? 'suspended' : ''}>
            <p className="rsx-card-q">{c.prompt}</p>
            <p className="rsx-card-a">{c.answer}</p>
            {c.elaboration && <p className="rsx-card-e">{c.elaboration}</p>}
            <p className="rsx-card-meta">
              due {c.due} · {c.reps} reviews{c.lapses ? ` · ${c.lapses} lapses` : ''} · {c.origin}
              <button className="rsx-link-btn" onClick={() => patchCard(c.id, { suspended: !c.suspended })}>
                {c.suspended ? 'unsuspend' : 'suspend'}
              </button>
              <button className="rsx-link-btn bad" onClick={() => deleteCard(c.id)}>
                delete
              </button>
            </p>
          </li>
        ))}
      </ul>

      {drafts.length > 0 && (
        <div className="rsx-drafts">
          <p className="lrn-dim">
            Suggested ({drafts[0].origin === 'llm' ? 'model' : 'offline cloze'}) — drafts only. Writing the card is part of
            learning it.
          </p>
          {drafts.map((d, i) => (
            <div key={i} className="rsx-draft">
              <p className="rsx-card-q">{d.prompt}</p>
              <p className="rsx-card-a">{d.answer}</p>
              <div className="lrn-btn-row">
                <button
                  className="lrn-btn tiny ok"
                  onClick={() => {
                    addCard({ paperId: paper.id, prompt: d.prompt, answer: d.answer, origin: d.origin });
                    setDrafts((ds) => ds.filter((_, j) => j !== i));
                  }}
                >
                  Accept
                </button>
                <button
                  className="lrn-btn tiny"
                  onClick={() => {
                    setPrompt(d.prompt);
                    setAnswer(d.answer);
                    setOrigin(d.origin);
                    setDrafts((ds) => ds.filter((_, j) => j !== i));
                  }}
                >
                  Edit
                </button>
                <button className="lrn-btn tiny" onClick={() => setDrafts((ds) => ds.filter((_, j) => j !== i))}>
                  Discard
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <form
        className="lrn-form"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <div className="rsx-form-row">
          <Field label="Prompt" value={prompt} onChange={setPrompt} placeholder="What does SN-WER canonicalise to, and why?" />
          <Field label="Answer" value={answer} onChange={setAnswer} />
        </div>
        <Field
          label="Elaboration (optional)"
          value={elab}
          onChange={setElab}
          placeholder={`Why is this true / what does it change for ${rqName}?`}
        />
        <div className="lrn-btn-row">
          <button className="lrn-btn primary" type="submit" disabled={!prompt.trim() || !answer.trim()}>
            Add card
          </button>
          <button className="lrn-btn" type="button" onClick={suggest} disabled={busy || !paper.abstract}>
            {busy ? 'Suggesting…' : 'Suggest cards'}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ───────────────────────── tools ───────────────────────── */

function Tools({ paper, cardCount }: { paper: Paper; cardCount: number }) {
  const markEvidenceLogged = useResearch((s) => s.markEvidenceLogged);
  const skills = useLearning((s) => s.skills);
  const addEvidence = useLearning((s) => s.addEvidence);
  const [logging, setLogging] = useState(false);
  const [skillIds, setSkillIds] = useState<string[]>(() => {
    const have = new Set(skills.map((s) => s.id));
    return [...new Set(paper.rqIds.flatMap((r) => RQ_SKILLS[r] ?? []))].filter((id) => have.has(id));
  });
  const [assistance, setAssistance] = useState<AiAssistance>('light');
  const [learned, setLearned] = useState(paper.note.delta || paper.note.fiveCs.contributions);

  const canLog = ['pass2', 'pass3', 'done'].includes(paper.status);
  const md = () => toContentMarkdown(paper);

  const logEvidence = () => {
    addEvidence({
      date: isoDay(),
      skillIds,
      kind: 'paper-notes',
      artifact: `Notes: ${paper.title}`,
      url: paper.absUrl,
      didMyself: `Structured notes + ${cardCount} recall cards`,
      assistance,
      whatLearned: learned.trim() || paper.note.delta || paper.note.fiveCs.contributions || '—',
      confidence: 0.5,
    });
    markEvidenceLogged(paper.id);
    setLogging(false);
    toast.success('Logged in the Learning OS evidence log');
  };

  return (
    <div className="rsx-tools">
      <div className="lrn-btn-row">
        <button
          className="lrn-btn"
          onClick={async () => {
            const ok = await copyText(toBibtex(paper));
            if (ok) toast.success('BibTeX copied');
            else download(`${paper.bibKey}.bib`, toBibtex(paper));
          }}
        >
          Copy BibTeX
        </button>
        <button
          className="lrn-btn"
          onClick={async () => {
            const ok = await copyText(md());
            if (ok) toast.success('Content note copied — save it as content/' + contentSlug(paper) + '.md');
            else download(`${contentSlug(paper)}.md`, md(), 'text/markdown');
          }}
        >
          Export as content note
        </button>
        <button className="lrn-btn tiny" onClick={() => download(`${contentSlug(paper)}.md`, md(), 'text/markdown')}>
          .md ↓
        </button>
        <button
          className="lrn-btn"
          disabled={!canLog}
          title={canLog ? 'Add to the Learning OS evidence log' : 'Available from Pass 2 on'}
          onClick={() => setLogging((v) => !v)}
        >
          Log as evidence
        </button>
      </div>
      {paper.evidenceLoggedAt && (
        <p className="lrn-dim">Logged as evidence on {paper.evidenceLoggedAt.slice(0, 10)}.</p>
      )}
      {!canLog && <p className="lrn-dim">Evidence logging unlocks at Pass 2 — a skim is not evidence.</p>}

      {logging && canLog && (
        <div className="lrn-form">
          <div className="rsx-form-row">
            <label className="lrn-field">
              Skills this exercised
              <select
                multiple
                size={6}
                value={skillIds}
                onChange={(e) => setSkillIds([...e.target.selectedOptions].map((o) => o.value))}
              >
                {skills.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <label className="lrn-field">
                AI assistance
                <select value={assistance} onChange={(e) => setAssistance(e.target.value as AiAssistance)}>
                  {(Object.keys(ASSISTANCE_LABEL) as AiAssistance[]).map((a) => (
                    <option key={a} value={a}>
                      {ASSISTANCE_LABEL[a]}
                    </option>
                  ))}
                </select>
              </label>
              <Field label="What I learned" value={learned} onChange={setLearned} rows={3} />
            </div>
          </div>
          <div className="lrn-btn-row">
            <button className="lrn-btn primary" onClick={logEvidence} disabled={skillIds.length === 0}>
              Add evidence ({skillIds.length} skill{skillIds.length === 1 ? '' : 's'})
            </button>
            <button className="lrn-btn" onClick={() => setLogging(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── connections (Semantic Scholar) ───────────────────────── */

function Connections({ paper, onOpenPaper }: { paper: Paper; onOpenPaper: (id: string) => void }) {
  const papers = useResearch((s) => s.papers);
  const savePaper = useResearch((s) => s.savePaper);
  const [graph, setGraph] = useState<GraphResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const gid = paper.arxivId ? `arXiv:${paper.arxivId}` : paper.doi ? `DOI:${paper.doi}` : '';
  const saved = new Set(papers.map((p) => p.id));

  const load = async () => {
    if (graph || loading || !gid) return;
    setLoading(true);
    setGraph(await fetchGraph(gid));
    setLoading(false);
  };

  const saveRef = async (ref: GraphRef) => {
    if (ref.arxivId) {
      // pull the full arXiv metadata so the library entry has an abstract
      const r = await searchPapers({ source: 'arxiv', ids: [ref.arxivId] });
      const hit = r.items[0];
      if (hit) {
        savePaper(hit, { rqIds: paper.rqIds });
        return;
      }
    }
    const hit: PaperHit = ref.arxivId
      ? {
          id: `arxiv:${ref.arxivId}`,
          arxivId: ref.arxivId,
          title: ref.title,
          authors: [],
          abstract: '',
          published: ref.year ? `${ref.year}-01-01` : '',
          categories: [],
          absUrl: `https://arxiv.org/abs/${ref.arxivId}`,
          pdfUrl: `https://arxiv.org/pdf/${ref.arxivId}`,
          source: 'manual',
        }
      : {
          id: ref.doi ? `doi:${ref.doi.toLowerCase()}` : `s2:${ref.s2Url.split('/').pop()}`,
          doi: ref.doi,
          title: ref.title,
          authors: [],
          abstract: '',
          published: ref.year ? `${ref.year}-01-01` : '',
          categories: [],
          absUrl: ref.doi ? `https://doi.org/${ref.doi}` : ref.s2Url,
          source: 'manual',
        };
    savePaper(hit, { rqIds: paper.rqIds });
  };

  const refId = (r: GraphRef) => (r.arxivId ? `arxiv:${r.arxivId}` : r.doi ? `doi:${r.doi.toLowerCase()}` : '');

  const list = (title: string, refs: GraphRef[]) =>
    refs.length > 0 && (
      <div className="rsx-conn-list">
        <h4>
          {title} ({refs.length})
        </h4>
        <ul>
          {refs.map((r, i) => {
            const id = refId(r);
            return (
              <li key={`${r.s2Url}-${i}`}>
                <a href={r.s2Url} target="_blank" rel="noreferrer">
                  {r.title}
                </a>
                <span className="lrn-dim">
                  {r.year ? ` · ${r.year}` : ''}
                  {typeof r.citationCount === 'number' ? ` · ${r.citationCount} cites` : ''}
                </span>
                {id &&
                  (saved.has(id) ? (
                    <button className="rsx-link-btn" onClick={() => onOpenPaper(id)}>
                      in library ✓
                    </button>
                  ) : (
                    <button className="rsx-link-btn" onClick={() => void saveRef(r)}>
                      save
                    </button>
                  ))}
              </li>
            );
          })}
        </ul>
      </div>
    );

  const fallback = (
    <p className="rsx-error">
      {graph?.reason === 'not-found'
        ? 'Semantic Scholar does not index this paper yet. '
        : 'Semantic Scholar is rate-limiting anonymous requests. Set S2_API_KEY, or '}
      <a href={s2Link(paper)} target="_blank" rel="noreferrer">
        open on semanticscholar.org ↗
      </a>
    </p>
  );

  return (
    <details className="rsx-group rsx-conn" onToggle={(e) => (e.currentTarget as HTMLDetailsElement).open && void load()}>
      <summary>Connections — references, citations, recommendations</summary>
      {!gid ? (
        <p className="lrn-empty">
          No arXiv id or DOI to look up.{' '}
          <a href={s2Link(paper)} target="_blank" rel="noreferrer">
            Search Semantic Scholar ↗
          </a>
        </p>
      ) : loading ? (
        <p className="lrn-empty">Asking Semantic Scholar… (four calls, one after another)</p>
      ) : graph ? (
        <>
          {(!graph.available || graph.reason) && fallback}
          {graph.paper && (
            <p className="lrn-note">
              {typeof graph.paper.citationCount === 'number' && `${graph.paper.citationCount} citations · `}
              {typeof graph.paper.referenceCount === 'number' && `${graph.paper.referenceCount} references`}
              {graph.paper.venue && ` · ${graph.paper.venue}`}
              {graph.paper.tldr && (
                <>
                  <br />
                  <strong>TLDR:</strong> {graph.paper.tldr}
                </>
              )}
            </p>
          )}
          {list('References', graph.references)}
          {list('Cited by', graph.citations)}
          {list('Recommended', graph.recommendations)}
        </>
      ) : null}
    </details>
  );
}
