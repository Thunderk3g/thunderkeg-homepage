'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { Paper } from '@/research/types';
import { useResearch } from '@/research/store';
import { isoDay } from '@/research/schedule';
import { toBibtexAll } from '@/research/bibtex';
import { copyText, download } from '@/research/client';
import {
  MATRIX_COLS,
  matrixCsv,
  matrixMarkdown,
  matrixRows,
  relatedWorkMarkdown,
  sortRows,
  truncate,
  type MatrixKey,
  type MatrixRow,
} from '@/research/matrix';

type Exported = { kind: 'md' | 'csv' | 'related' | 'bib'; text: string; filename: string; type: string };

/**
 * Literature matrix: rows are papers, columns the things a related-work section
 * needs. Cells he has not written himself (derived from a published note's
 * paragraphs) are shown dimmed and marked. Custom columns (Elicit-style
 * "dataset", "baseline"…) are free text per paper, edited in place.
 */
export function Matrix({ papers, onOpen }: { papers: Paper[]; onOpen: (id: string) => void }) {
  const rqs = useResearch((s) => s.rqs);
  const custom = useResearch((s) => s.prefs.matrixCols);
  const addCol = useResearch((s) => s.addMatrixCol);
  const removeCol = useResearch((s) => s.removeMatrixCol);
  const setExtra = useResearch((s) => s.setExtra);

  const [rq, setRq] = useState('');
  const [hideDropped, setHideDropped] = useState(true);
  const [sort, setSort] = useState<{ key: MatrixKey | `x:${string}`; dir: 1 | -1 }>({ key: 'status', dir: 1 });
  const [exp, setExp] = useState<Exported | null>(null);
  const [newCol, setNewCol] = useState('');

  const byId = useMemo(() => new Map(papers.map((p) => [p.id, p])), [papers]);

  const rows = useMemo(() => {
    const base = matrixRows(papers.filter((p) => (!rq || p.rqIds.includes(rq)) && (!hideDropped || p.status !== 'dropped')));
    if (sort.key.startsWith('x:')) {
      const col = sort.key.slice(2);
      const v = (r: MatrixRow) => byId.get(r.id)?.extra?.[col] ?? '';
      return [...base].sort((a, b) => (!v(a) !== !v(b) ? (!v(a) ? 1 : -1) : v(a).localeCompare(v(b)) * sort.dir));
    }
    return sortRows(base, sort.key as MatrixKey, sort.dir);
  }, [papers, rq, hideDropped, sort, byId]);

  // custom columns ride along in the CSV (his raw extraction); the Markdown stays the fixed synthesis set
  const csvWithCustom = () => {
    const base = matrixCsv(rows).split('\r\n');
    if (!custom.length) return base.join('\r\n');
    const esc = (s: string) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
    return base
      .map((line, i) => {
        if (!line) return line;
        if (i === 0) return line + ',' + custom.map(esc).join(',');
        const r = rows[i - 1];
        return line + ',' + custom.map((c) => esc(byId.get(r.id)?.extra?.[c] ?? '')).join(',');
      })
      .join('\r\n');
  };

  const today = isoDay();
  const exportAs = (kind: Exported['kind']) => {
    const scope = rq ? `-${rq}` : '';
    if (kind === 'md')
      setExp({ kind, text: matrixMarkdown(rows), filename: `literature-matrix${scope}-${today}.md`, type: 'text/markdown' });
    else if (kind === 'csv') setExp({ kind, text: csvWithCustom(), filename: `literature-matrix${scope}-${today}.csv`, type: 'text/csv' });
    else if (kind === 'related')
      setExp({
        kind,
        text: relatedWorkMarkdown(rows, rq ? rqs.filter((q) => q.id === rq) : rqs),
        filename: `related-work${scope}-${today}.md`,
        type: 'text/markdown',
      });
    else
      setExp({
        kind,
        text: toBibtexAll(rows.map((r) => byId.get(r.id)!).filter(Boolean)) + '\n',
        filename: `library${scope}-${today}.bib`,
        type: 'application/x-bibtex',
      });
  };

  const header = (key: MatrixKey | `x:${string}`, label: string, extra?: React.ReactNode) => {
    const on = sort.key === key;
    return (
      <th key={key} scope="col" aria-sort={on ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'} className={`c-${key.replace(':', '-')}`}>
        <button className="rsx-mx-sort" onClick={() => setSort({ key, dir: on ? (sort.dir === 1 ? -1 : 1) : 1 })}>
          {label}
          <span aria-hidden className="rsx-mx-arrow">
            {on ? (sort.dir === 1 ? '▲' : '▼') : ''}
          </span>
        </button>
        {extra}
      </th>
    );
  };

  const cell = (r: MatrixRow, k: 'method' | 'result' | 'critique' | 'delta', n: number) => {
    const c = r[k];
    if (!c.text) return <td className="rsx-mx-empty">—</td>;
    return (
      <td className={c.derived ? 'rsx-mx-derived' : ''} title={(c.derived ? 'From the published note (not a structured field): ' : '') + c.text}>
        {truncate(c.text, n)}
      </td>
    );
  };

  return (
    <div className="rsx-mx" data-testid="rsx-matrix">
      <div className="rsx-mx-bar">
        <select value={rq} onChange={(e) => setRq(e.target.value)} aria-label="filter by research question">
          <option value="">All RQs</option>
          {rqs.map((q) => (
            <option key={q.id} value={q.id}>
              {q.short}
            </option>
          ))}
        </select>
        <label className="rsx-mx-check">
          <input type="checkbox" checked={hideDropped} onChange={(e) => setHideDropped(e.target.checked)} /> hide dropped
        </label>
        <span className="lrn-dim">{rows.length} papers</span>
        <span className="rsx-spacer" />
        <form
          className="rsx-mx-addcol"
          onSubmit={(e) => {
            e.preventDefault();
            addCol(newCol);
            setNewCol('');
          }}
        >
          <input value={newCol} onChange={(e) => setNewCol(e.target.value)} placeholder="+ column (dataset…)" aria-label="add a custom column" maxLength={40} />
        </form>
        <span className="rsx-mx-exports" role="group" aria-label="Export">
          <button className="lrn-btn tiny" onClick={() => exportAs('md')}>
            Markdown
          </button>
          <button className="lrn-btn tiny" onClick={() => exportAs('csv')}>
            CSV
          </button>
          <button className="lrn-btn tiny" onClick={() => exportAs('bib')}>
            BibTeX
          </button>
          <button className="lrn-btn tiny" onClick={() => exportAs('related')}>
            Related-work draft
          </button>
        </span>
      </div>

      {exp && (
        <div className="rsx-mx-export">
          <div className="lrn-btn-row">
            <span className="rsx-answer-label">{exp.filename}</span>
            <span className="rsx-spacer" />
            <button
              className="lrn-btn tiny"
              onClick={async () => {
                if (await copyText(exp.text)) toast.success('Copied');
                else toast.error('Clipboard blocked — use Download');
              }}
            >
              Copy
            </button>
            <button className="lrn-btn tiny primary" onClick={() => download(exp.filename, exp.text, exp.type)}>
              Download
            </button>
            <button className="lrn-btn tiny" onClick={() => setExp(null)}>
              Close
            </button>
          </div>
          <textarea className="rsx-mx-preview" readOnly value={exp.text} aria-label="export preview" data-testid="rsx-export" />
        </div>
      )}

      {papers.length === 0 ? (
        <p className="lrn-empty">No papers yet.</p>
      ) : (
        <div className="rsx-mx-wrap">
          <table className="rsx-mx-table">
            <thead>
              <tr>
                {MATRIX_COLS.map((c) => header(c.key, c.label))}
                {custom.map((c) =>
                  header(
                    `x:${c}`,
                    c,
                    <button className="rsx-link-btn bad" title={`Remove column ${c} (values are kept on the papers)`} onClick={() => removeCol(c)}>
                      ×
                    </button>,
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <th scope="row" className="c-title">
                    <button className="rsx-link-btn" onClick={() => onOpen(r.id)} title="Open paper">
                      {r.title}
                    </button>
                    <span className="rsx-row-meta">{r.bibKey}</span>
                  </th>
                  <td className="c-rqs">
                    {r.rqIds.length ? r.rqIds.map((x) => <span key={x} className="rsx-rq">{x.toUpperCase()} </span>) : <span className="rsx-mx-empty">—</span>}
                  </td>
                  <td>
                    <span className={`rsx-pill st-${r.status}`}>{r.status.replace('pass', 'p')}</span>
                  </td>
                  <td className="c-year">{r.year}</td>
                  <td className="c-venue">{truncate(r.venue, 40) || <span className="rsx-mx-empty">—</span>}</td>
                  {cell(r, 'method', 90)}
                  {cell(r, 'result', 120)}
                  {cell(r, 'critique', 90)}
                  {cell(r, 'delta', 90)}
                  {custom.map((c) => (
                    <td key={c} className="c-extra">
                      <input
                        defaultValue={byId.get(r.id)?.extra?.[c] ?? ''}
                        aria-label={`${c} for ${r.title}`}
                        onBlur={(e) => {
                          if ((byId.get(r.id)?.extra?.[c] ?? '') !== e.target.value) setExtra(r.id, c, e.target.value);
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="rsx-foot">
        Dimmed italic cells come from a published note&apos;s paragraphs, not a structured field — write the field to replace them.
      </p>
    </div>
  );
}
