'use client';

import { useState } from 'react';
import { TIMELINES, briefMailto, briefText, hire, profile, type Brief } from '@/data/resume';

/**
 * The project-brief builder. There is no server behind it: the brief becomes
 * a pre-written email in the visitor's own mail client, or text on their
 * clipboard. Shared by the Hire app on the desktop and the plain /hire page.
 */
export function BriefForm({ initialEngagement = 'project' }: { initialEngagement?: string }) {
  const [b, setB] = useState<Brief>({
    engagement: initialEngagement,
    name: '',
    company: '',
    services: [],
    timeline: '',
    budget: '',
    details: '',
  });
  const [copied, setCopied] = useState<'brief' | 'email' | null>(null);

  const set = <K extends keyof Brief>(k: K, v: Brief[K]) => setB((p) => ({ ...p, [k]: v }));
  const toggle = (id: string) =>
    set('services', b.services.includes(id) ? b.services.filter((s) => s !== id) : [...b.services, id]);

  const copy = async (what: 'brief' | 'email') => {
    try {
      await navigator.clipboard.writeText(what === 'brief' ? briefText(b) : profile.email);
      setCopied(what);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      /* clipboard blocked: the email link still works */
    }
  };

  const isRole = b.engagement === 'role';

  return (
    <form
      className="hire-form"
      onSubmit={(e) => {
        e.preventDefault();
        window.location.href = briefMailto(b);
      }}
    >
      <fieldset className="hire-field">
        <legend>What are you looking for?</legend>
        <div className="hire-choices">
          {hire.engagements.map((e) => (
            <label key={e.id} className={'hire-choice' + (b.engagement === e.id ? ' on' : '')}>
              <input
                type="radio"
                name="engagement"
                value={e.id}
                checked={b.engagement === e.id}
                onChange={() => set('engagement', e.id)}
              />
              <span className="hire-choice-label">{e.label}</span>
              <span className="hire-choice-blurb">{e.blurb}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="hire-field">
        <legend>Which area? Pick any that apply</legend>
        <div className="hire-chips">
          {hire.services.map((s) => (
            <label key={s.id} className={'hire-chip' + (b.services.includes(s.id) ? ' on' : '')}>
              <input type="checkbox" checked={b.services.includes(s.id)} onChange={() => toggle(s.id)} />
              {s.name}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="hire-row">
        <label className="hire-field">
          <span>Your name</span>
          <input value={b.name} onChange={(e) => set('name', e.target.value)} autoComplete="name" />
        </label>
        <label className="hire-field">
          <span>Company or team</span>
          <input value={b.company} onChange={(e) => set('company', e.target.value)} autoComplete="organization" />
        </label>
      </div>

      <div className="hire-row">
        <label className="hire-field">
          <span>{isRole ? 'Start date' : 'Timeline'}</span>
          <select value={b.timeline} onChange={(e) => set('timeline', e.target.value)}>
            <option value="">Not sure yet</option>
            {TIMELINES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="hire-field">
          <span>{isRole ? 'Compensation range (optional)' : 'Budget (optional)'}</span>
          <input value={b.budget} onChange={(e) => set('budget', e.target.value)} />
        </label>
      </div>

      <label className="hire-field">
        <span>{isRole ? 'The role, the team and why you thought of me' : 'What you need, and what “done” looks like'}</span>
        <textarea rows={5} value={b.details} onChange={(e) => set('details', e.target.value)} />
      </label>

      <div className="hire-actions">
        <button type="submit" className="hire-btn primary">
          Email this brief
        </button>
        <button type="button" className="hire-btn" onClick={() => copy('brief')}>
          {copied === 'brief' ? 'Brief copied' : 'Copy brief'}
        </button>
        <button type="button" className="hire-btn" onClick={() => copy('email')}>
          {copied === 'email' ? 'Email address copied' : 'Copy email address'}
        </button>
      </div>
      <p className="hire-note">
        “Email this brief” opens your own mail app with the message written. Nothing is sent or stored by this site.
      </p>
    </form>
  );
}
