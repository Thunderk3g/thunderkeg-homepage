'use client';

import { useEffect, useState } from 'react';
import type { Paper } from '@/research/types';
import { checkReader, readerUrl, type FacetLevel } from '@/research/client';

/**
 * The reading pane. arXiv papers go through our same-origin proxy so the
 * browser's own PDF viewer renders them in an iframe; if the PDF cannot be
 * fetched, arXiv's HTML rendering is tried (sandboxed, scripts stripped, with
 * an optional faceted skim); otherwise it says so and links out.
 */

export type Source = 'pdf' | 'html';
type State =
  | { phase: 'checking' }
  | { phase: 'ready'; pdf: boolean; html: boolean }
  | { phase: 'none'; reason: string };

export function useReaderSources(paper: Paper): State {
  const [st, setSt] = useState<State>(paper.arxivId ? { phase: 'checking' } : { phase: 'none', reason: 'no-arxiv' });
  useEffect(() => {
    const id = paper.arxivId;
    if (!id) {
      setSt({ phase: 'none', reason: 'no-arxiv' });
      return;
    }
    let live = true;
    setSt({ phase: 'checking' });
    void (async () => {
      const pdf = await checkReader(id, 'pdf');
      // HTML is only probed when it is needed (or to offer the faceted skim)
      const html = await checkReader(id, 'html');
      if (!live) return;
      if (pdf.ok || html.ok) setSt({ phase: 'ready', pdf: pdf.ok, html: html.ok });
      else setSt({ phase: 'none', reason: pdf.error || html.error || 'unreachable' });
    })();
    return () => {
      live = false;
    };
  }, [paper.arxivId]);
  return st;
}

export function ReaderPane({
  paper,
  state,
  source,
  onSource,
  facets,
  onFacets,
}: {
  paper: Paper;
  state: State;
  source: Source;
  onSource: (s: Source) => void;
  facets: FacetLevel;
  onFacets: (f: FacetLevel) => void;
}) {
  const outLink = paper.pdfUrl ?? paper.absUrl;

  if (state.phase === 'checking') {
    return (
      <div className="rsx-reader-msg" data-testid="rsx-reader-checking">
        <p className="lrn-empty">Fetching arXiv:{paper.arxivId} through the reader proxy…</p>
      </div>
    );
  }

  if (state.phase === 'none') {
    return (
      <div className="rsx-reader-msg" data-testid="rsx-reader-fallback">
        <p className="rsx-reader-msg-h">{state.reason === 'no-arxiv' ? 'No arXiv copy to show here' : 'The paper could not be loaded here'}</p>
        <p className="lrn-dim">
          {state.reason === 'no-arxiv'
            ? `This entry comes from ${paper.source === 'note' ? 'a published note' : paper.source === 'hf' ? 'Hugging Face' : 'a manual link'}, not arXiv, so there is no PDF the reader proxy may fetch (it only talks to arxiv.org).`
            : `The reader proxy could not get it from arXiv (${state.reason}). Neither the PDF nor the HTML rendering is available right now.`}
        </p>
        <div className="lrn-btn-row">
          <a className="lrn-btn primary" href={outLink} target="_blank" rel="noreferrer">
            open {paper.pdfUrl ? 'PDF' : 'link'} ↗
          </a>
          {paper.arxivId && (
            <a className="lrn-btn" href={`https://arxiv.org/html/${paper.arxivId}`} target="_blank" rel="noreferrer">
              arXiv HTML ↗
            </a>
          )}
        </div>
        <p className="lrn-dim">Notes and highlights work the same with the paper open in another tab — paste sentences into the box below.</p>
      </div>
    );
  }

  const use: Source = source === 'html' ? (state.html ? 'html' : 'pdf') : state.pdf ? 'pdf' : 'html';
  const src = readerUrl(paper.arxivId!, use, facets);

  return (
    <div className="rsx-reader">
      <div className="rsx-reader-bar">
        <span className="rsx-seg" role="group" aria-label="Reader source">
          <button className={use === 'pdf' ? 'on' : ''} disabled={!state.pdf} onClick={() => onSource('pdf')} aria-pressed={use === 'pdf'}>
            PDF
          </button>
          <button className={use === 'html' ? 'on' : ''} disabled={!state.html} onClick={() => onSource('html')} aria-pressed={use === 'html'} title={state.html ? 'arXiv HTML rendering' : 'No HTML rendering for this paper'}>
            HTML
          </button>
        </span>
        {use === 'html' && (
          <label className="rsx-sort">
            <span>Skim</span>
            <select value={facets} onChange={(e) => onFacets(e.target.value as FacetLevel)} aria-label="faceted skim">
              <option value="off">plain</option>
              <option value="results">results only</option>
              <option value="all">goal · method · result</option>
            </select>
          </label>
        )}
        <span className="rsx-spacer" />
        <a href={src} target="_blank" rel="noreferrer" className="rsx-reader-out">
          new tab ↗
        </a>
      </div>
      {use === 'pdf' ? (
        <iframe key={src} className="rsx-reader-frame" src={src} title={`PDF: ${paper.title}`} data-testid="rsx-reader-frame" />
      ) : (
        <iframe
          key={src}
          className="rsx-reader-frame html"
          src={src}
          title={`HTML: ${paper.title}`}
          sandbox="allow-popups allow-popups-to-escape-sandbox"
          referrerPolicy="no-referrer"
          data-testid="rsx-reader-frame"
        />
      )}
    </div>
  );
}
