'use client';

import { useState } from 'react';
import { SysIcon } from '../icons';

/** Orage-style month grid; Monday-first, today highlighted. */
export function Calendar({ now }: { now: Date }) {
  const [offset, setOffset] = useState(0);
  const view = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const y = view.getFullYear();
  const m = view.getMonth();
  const lead = (view.getDay() + 6) % 7;
  const days = new Date(y, m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const isToday = (d: number | null) =>
    d !== null && offset === 0 && d === now.getDate();

  return (
    <div className="kos-cal">
      <div className="kos-cal-today">
        <div className="w">{now.toLocaleDateString([], { weekday: 'long' })}</div>
        <div className="d">{now.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' })}</div>
      </div>
      <div className="kos-cal-head">
        <button aria-label="Previous month" onClick={() => setOffset((o) => o - 1)}>
          <SysIcon name="back" size={14} />
        </button>
        <button className="kos-cal-title" onClick={() => setOffset(0)} title="Back to today">
          {view.toLocaleDateString([], { month: 'long', year: 'numeric' })}
        </button>
        <button aria-label="Next month" onClick={() => setOffset((o) => o + 1)}>
          <SysIcon name="forward" size={14} />
        </button>
      </div>
      <div className="kos-cal-grid" role="grid">
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
          <span key={d} className="dow">
            {d}
          </span>
        ))}
        {cells.map((d, i) => (
          <span key={i} className={'day' + (isToday(d) ? ' today' : '') + (d === null ? ' empty' : '')}>
            {d ?? ''}
          </span>
        ))}
      </div>
    </div>
  );
}
