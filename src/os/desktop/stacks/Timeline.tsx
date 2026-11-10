'use client';

import { useEffect } from 'react';
import { useOS } from '../../store';
import { prefersReducedMotion } from '../layout';
import { KINDS, KIND_LABEL, KIND_MEANING } from '@/data/record';
import { useBoard, useStacksView } from '@/stacks/useBoard';

/**
 * The strip under the board: what the colours mean, and the years. Pointing
 * at a year shows the board as it stood at the end of it; a click holds it
 * there, and Replay walks through them. The bar over each year is how much
 * was added in it.
 */
const STEP_MS = 1150;

export function StacksTimeline({ veil = false }: { veil?: boolean }) {
  const { board, ready } = useBoard();
  const asOf = useStacksView((s) => s.asOf);
  const pinned = useStacksView((s) => s.pinned);
  const playing = useStacksView((s) => s.playing);
  const hover = useStacksView((s) => s.hover);
  const pin = useStacksView((s) => s.pin);
  const setPlaying = useStacksView((s) => s.setPlaying);
  const show = useStacksView((s) => s.show);
  const reduced = useOS((s) => s.settings.reducedMotion);

  const years = board.years;

  // Replay: empty board, then one year at a time, then back to now
  useEffect(() => {
    if (!playing || !years.length) return;
    let i = -1;
    show(years[0].year - 1);
    const id = window.setInterval(() => {
      i++;
      if (i >= years.length) setPlaying(false);
      else show(years[i].year);
    }, STEP_MS);
    return () => window.clearInterval(id);
  }, [playing, years, show, setPlaying]);

  // leaving the desktop (a window opens over it, the wallpaper changes) returns to now
  useEffect(() => () => useStacksView.setState({ asOf: null, pinned: null, playing: false }), []);

  if (!ready || !years.length) return null;

  const most = Math.max(...years.map((y) => y.count));
  let running = 0;
  const upTo = years.map((y) => (running += y.count));
  const shown = asOf === null ? null : years.findLastIndex((y) => y.year <= asOf);
  const status =
    asOf === null
      ? `${board.totals.cubes} cubes on ${board.totals.subjects} stacks`
      : shown === null || shown < 0
        ? `Before ${years[0].year}`
        : `End of ${asOf}: ${upTo[shown]} of ${board.totals.cubes} cubes`;

  return (
    <div className={'kos-stacks-bar' + (veil ? ' veiled' : '')} onPointerLeave={() => hover(null)}>
      <ul className="kos-stacks-legend" aria-label="What the colours mean">
        {KINDS.map((k) => (
          <li key={k} title={KIND_MEANING[k]}>
            <i className={'sw k-' + k} />
            {KIND_LABEL[k]}
            <b>{board.totals.byKind[k]}</b>
          </li>
        ))}
        {board.totals.recent > 0 && (
          <li title="The top cube was added within the last month">
            <i className="sw recent" />
            added this month<b>{board.totals.recent}</b>
          </li>
        )}
        {board.totals.queued > 0 && (
          <li title="Saved to the Research inbox, not read yet">
            <i className="sw queued" />
            queued<b>{board.totals.queued}</b>
          </li>
        )}
        {board.totals.due > 0 && (
          <li title="Recall cards due today">
            <i className="sw due" />
            due today<b>{board.totals.due}</b>
          </li>
        )}
      </ul>

      <div className="kos-stacks-years" role="group" aria-label="The record by year">
        {years.map((y, i) => {
          const on = asOf !== null && y.year <= asOf;
          return (
            <button
              key={y.year}
              type="button"
              className={(on ? 'on ' : '') + (pinned === y.year ? 'pinned ' : '') + (asOf === y.year ? 'at' : '')}
              aria-pressed={pinned === y.year}
              title={`${y.count} added in ${y.year}. Click to hold the board at the end of ${y.year}.`}
              onPointerEnter={() => hover(y.year)}
              onFocus={() => hover(y.year)}
              onBlur={() => hover(null)}
              onClick={() => pin(pinned === y.year ? null : y.year)}
            >
              <span className="bar" style={{ height: 4 + Math.round(14 * Math.sqrt(y.count / most)) }} aria-hidden="true" />
              <span className="yr">{y.year}</span>
              <span className="sr-only">
                , {y.count} added, {upTo[i]} in total
              </span>
            </button>
          );
        })}
        <button
          type="button"
          className={'now' + (asOf === null ? ' at' : '')}
          onPointerEnter={() => hover(null)}
          onClick={() => pin(null)}
          title="The board as it stands today"
        >
          <span className="yr">now</span>
        </button>
        {!(reduced || prefersReducedMotion()) && (
          <button type="button" className="play" onClick={() => setPlaying(!playing)} aria-pressed={playing}>
            {playing ? 'Stop' : 'Replay'}
          </button>
        )}
        <span className="kos-stacks-status" aria-live="polite">
          {status}
        </span>
      </div>
    </div>
  );
}
