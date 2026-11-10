'use client';

import { useEffect, useState } from 'react';
import { TIMELINES, briefMailto, briefText, hire, profile, type Brief } from '@/data/resume';

/**
 * The project-brief builder. When the site has SMTP configured (/api/hire)
 * the brief is sent straight to my inbox with the visitor as Reply-To; when it
 * is not, or the send fails, the same brief opens as a pre-written email in
 * the visitor's own mail client. Nothing is stored either way. Shared by the
 * Hire app on the desktop and the plain /hire page.
 */
type Phase = 'idle' | 'sending' | 'sent' | 'error';

export function BriefForm({ initialEngagement = 'project' }: { initialEngagement?: string }) {
  const [b, setB] = useState<Brief>({
    engagement: initialEngagement,
    name: '',
    email: '',
    company: '',
    services: [],
    timeline: '',
    budget: '',
    details: '',
  });
  const [copied, setCopied] = useState<'brief' | 'email' | null>(null);
  /** null until the server has said whether it can send */
  const [canSend, setCanSend] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState('');
  /** honeypot: hidden from people, irresistible to form-filling bots */
  const [website, setWebsite] = useState('');

  useEffect(() => {
    let live = true;
    fetch('/api/hire')
      .then((r) => r.json())
      .then((d: { configured?: boolean }) => live && setCanSend(!!d.configured))
      .catch(() => live && setCanSend(false));
    return () => {
      live = false;
    };
  }, []);

  const send = async () => {
    setPhase('sending');
    setError('');
    try {
      const res = await fetch('/api/hire', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...b, website }),
      });
      const d = (await res.json()) as { ok?: boolean; reason?: string; error?: string };
      if (d.ok) return setPhase('sent');
      if (d.reason === 'unconfigured') {
        setCanSend(false);
        setPhase('idle');
        window.location.href = briefMailto(b);
        return;
      }
      setError(d.error ?? 'It did not send.');
      setPhase('error');
    } catch {
      setError('Could not reach the server.');
      setPhase('error');
    }
  };

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

  if (phase === 'sent') {
    return (
      <div className="hire-form hire-sent" role="status">
        <h3>Sent. Thank you{b.name ? `, ${b.name.split(' ')[0]}` : ''}.</h3>
        <p>
          Your brief is in my inbox and I will reply to <strong>{b.email}</strong>. Nothing was stored on this
          site.
        </p>
        <pre className="hire-sent-copy">{briefText(b)}</pre>
        <div className="hire-actions">
          <button type="button" className="hire-btn" onClick={() => copy('brief')}>
            {copied === 'brief' ? 'Brief copied' : 'Copy what you sent'}
          </button>
          <button
            type="button"
            className="hire-btn"
            onClick={() => {
              setB((p) => ({ ...p, details: '', budget: '', timeline: '', services: [] }));
              setPhase('idle');
            }}
          >
            Send another
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="hire-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (phase === 'sending') return;
        if (canSend) void send();
        else window.location.href = briefMailto(b);
      }}
    >
      <label className="hire-hp" aria-hidden="true">
        Website
        <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </label>

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
          <input value={b.name} onChange={(e) => set('name', e.target.value)} autoComplete="name" maxLength={120} />
        </label>
        <label className="hire-field">
          <span>Your email{canSend ? '' : ' (optional)'}</span>
          <input
            type="email"
            value={b.email}
            onChange={(e) => set('email', e.target.value)}
            autoComplete="email"
            inputMode="email"
            maxLength={254}
            required={!!canSend}
            placeholder="so I can reply"
          />
        </label>
      </div>

      <div className="hire-row">
        <label className="hire-field">
          <span>Company or team</span>
          <input
            value={b.company}
            onChange={(e) => set('company', e.target.value)}
            autoComplete="organization"
            maxLength={160}
          />
        </label>
        <label className="hire-field">
          <span>{isRole ? 'Start date' : 'Timeline'}</span>
          <select value={b.timeline} onChange={(e) => set('timeline', e.target.value)}>
            <option value="">Not sure yet</option>
            {TIMELINES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="hire-field">
        <span>{isRole ? 'Compensation range (optional)' : 'Budget (optional)'}</span>
        <input value={b.budget} onChange={(e) => set('budget', e.target.value)} maxLength={160} />
      </label>

      <label className="hire-field">
        <span>{isRole ? 'The role, the team and why you thought of me' : 'What you need, and what “done” looks like'}</span>
        <textarea
          rows={5}
          value={b.details}
          onChange={(e) => set('details', e.target.value)}
          maxLength={5000}
          required={!!canSend}
          minLength={canSend ? 10 : undefined}
        />
      </label>

      <div className="hire-actions">
        <button type="submit" className="hire-btn primary" disabled={phase === 'sending'}>
          {phase === 'sending' ? 'Sending…' : canSend ? 'Send brief' : 'Email this brief'}
        </button>
        {canSend && (
          <a className="hire-btn" href={briefMailto(b)}>
            Use my mail app instead
          </a>
        )}
        <button type="button" className="hire-btn" onClick={() => copy('brief')}>
          {copied === 'brief' ? 'Brief copied' : 'Copy brief'}
        </button>
        <button type="button" className="hire-btn" onClick={() => copy('email')}>
          {copied === 'email' ? 'Email address copied' : 'Copy email address'}
        </button>
      </div>
      {phase === 'error' && (
        <p className="hire-error" role="alert">
          {error} <a href={briefMailto(b)}>Open it in your mail app</a> or write to{' '}
          <a href={`mailto:${profile.email}`}>{profile.email}</a>.
        </p>
      )}
      <p className="hire-note">
        {canSend
          ? '“Send brief” delivers this to my inbox and I reply to your address. Nothing is stored by this site.'
          : '“Email this brief” opens your own mail app with the message written. Nothing is sent or stored by this site.'}
      </p>
    </form>
  );
}
