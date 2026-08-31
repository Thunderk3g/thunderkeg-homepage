'use client';

import type { ReactNode } from 'react';
import { STATE_BLURB, type KnowledgeState } from './types';

export function StateBadge({ state }: { state: KnowledgeState }) {
  return (
    <span className={`lrn-state s-${state.toLowerCase()}`} title={STATE_BLURB[state]}>
      {state}
    </span>
  );
}

/** Capability, not activity: three explicit marks, never a percentage. */
export function Independence({ value }: { value: boolean | null }) {
  const label = value === null ? 'untested' : value ? 'independent' : 'failed unaided';
  const cls = value === null ? 'untested' : value ? 'yes' : 'no';
  return <span className={`lrn-ind ${cls}`}>{value === null ? '?' : value ? '✓' : '✗'} {label}</span>;
}

export function Meter({ value, label }: { value: number; label?: string }) {
  return (
    <span className="lrn-meter" title={label}>
      <span className="lrn-meter-fill" style={{ width: `${Math.round(value * 100)}%` }} />
    </span>
  );
}

/** 0–5 clickable scale used by the interview tracker. */
export function Scale({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  return (
    <span className="lrn-scale" role="group" aria-label={label}>
      {[0, 1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          className={'lrn-scale-dot' + (n <= value ? ' on' : '')}
          onClick={() => onChange(n)}
          aria-label={`${label}: ${n}`}
          title={`${label}: ${n}/5`}
        />
      ))}
    </span>
  );
}

export function Card({
  title,
  hint,
  children,
  wide,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <section className={'lrn-card' + (wide ? ' wide' : '')}>
      <header className="lrn-card-head">
        <h3>{title}</h3>
        {hint && <span>{hint}</span>}
      </header>
      {children}
    </section>
  );
}

export function Field({
  label,
  value,
  onChange,
  area,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  area?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="lrn-field">
      <span>{label}</span>
      {area ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      )}
    </label>
  );
}

export const fmtDate = (iso?: string) =>
  iso
    ? new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
      })
    : '—';
