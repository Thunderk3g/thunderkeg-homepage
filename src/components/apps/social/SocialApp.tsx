'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  Github,
  Linkedin,
  Mail,
  Phone,
  Twitter,
  type LucideIcon,
} from 'lucide-react';
import { ResumeSchema, type Resume } from '@/lib/resume/schema';

type ChannelKind = 'email' | 'phone' | 'linkedin' | 'github' | 'twitter';

type ChannelRow = {
  kind: ChannelKind;
  icon: LucideIcon;
  label: string;
  value: string | undefined;
  /**
   * If undefined, the row renders as a missing-value placeholder.
   * For `mailto:` / `tel:` we copy the raw value; for external links we copy the URL.
   */
  href: string | undefined;
  action: 'copy-and-open' | 'external';
  /** Value that gets copied to the clipboard when the copy button is pressed. */
  copyValue: string | undefined;
  /** Whether to render the channel at all when the value is absent (twitter is optional). */
  optional?: boolean;
};

function buildRows(personal: Resume['personal']): ChannelRow[] {
  return [
    {
      kind: 'email',
      icon: Mail,
      label: 'Email',
      value: personal.email,
      href: personal.email ? `mailto:${personal.email}` : undefined,
      copyValue: personal.email,
      action: 'copy-and-open',
    },
    {
      kind: 'phone',
      icon: Phone,
      label: 'Phone',
      value: personal.phone,
      href: personal.phone ? `tel:${personal.phone.replace(/\s+/g, '')}` : undefined,
      copyValue: personal.phone,
      action: 'copy-and-open',
    },
    {
      kind: 'linkedin',
      icon: Linkedin,
      label: 'LinkedIn',
      value: personal.linkedin,
      href: personal.linkedin,
      copyValue: personal.linkedin,
      action: 'external',
    },
    {
      kind: 'github',
      icon: Github,
      label: 'GitHub',
      value: personal.github,
      href: personal.github,
      copyValue: personal.github,
      action: 'external',
    },
    {
      kind: 'twitter',
      icon: Twitter,
      label: 'Twitter',
      value: personal.twitter,
      href: personal.twitter,
      copyValue: personal.twitter,
      action: 'external',
      optional: true,
    },
  ];
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(value);
      } else {
        return;
      }
      setCopied(true);
    } catch {
      // Silently fail — clipboard may be blocked in iframes.
    }
  }, [value]);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1400);
    return () => window.clearTimeout(t);
  }, [copied]);

  const Icon = copied ? Check : Copy;
  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={`Copy ${label}`}
      className="inline-flex items-center justify-center rounded-md border border-border bg-elevated p-2 text-muted transition-colors hover:bg-white/5 hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <Icon size={14} className={copied ? 'text-success' : undefined} />
    </button>
  );
}

function ChannelRowItem({ row }: { row: ChannelRow }) {
  const Icon = row.icon;
  const hasValue = Boolean(row.value);

  return (
    <div className="flex items-center gap-3 border-b border-border px-4 py-3 transition-colors hover:bg-white/5">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-elevated text-accent">
        <Icon size={18} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-xs uppercase tracking-wide text-muted">{row.label}</span>
        {hasValue ? (
          row.action === 'external' && row.href ? (
            <a
              href={row.href}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate font-mono text-sm text-fg hover:text-accent"
            >
              {row.value}
            </a>
          ) : row.href ? (
            <a
              href={row.href}
              className="truncate font-mono text-sm text-fg hover:text-accent"
            >
              {row.value}
            </a>
          ) : (
            <span className="truncate font-mono text-sm text-fg">{row.value}</span>
          )
        ) : (
          <span className="font-mono text-sm text-muted">—</span>
        )}
      </div>

      <div className="flex flex-shrink-0 items-center gap-2">
        {hasValue && row.copyValue ? (
          <CopyButton value={row.copyValue} label={row.label} />
        ) : null}
        {hasValue && row.action === 'external' && row.href ? (
          <a
            href={row.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open ${row.label} in new tab`}
            className="inline-flex items-center justify-center rounded-md border border-border bg-elevated p-2 text-muted transition-colors hover:bg-white/5 hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <ExternalLink size={14} />
          </a>
        ) : null}
      </div>
    </div>
  );
}

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; resume: Resume }
  | { status: 'error'; message: string };

export default function SocialApp() {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/resume.json', { cache: 'force-cache' });
        if (!res.ok) {
          throw new Error(`Failed to fetch resume.json (HTTP ${res.status})`);
        }
        const raw: unknown = await res.json();
        const parsed = ResumeSchema.parse(raw);
        if (!cancelled) setState({ status: 'ready', resume: parsed });
      } catch (err) {
        if (!cancelled) {
          setState({
            status: 'error',
            message: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === 'loading') {
    return (
      <div className="flex h-full items-center justify-center bg-surface p-6 font-mono text-sm text-muted">
        Loading channels…
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="flex h-full items-center justify-center bg-surface p-6 font-mono text-sm text-danger">
        Failed to load social channels: {state.message}
      </div>
    );
  }

  const rows = buildRows(state.resume.personal).filter(
    (row) => !row.optional || Boolean(row.value),
  );

  return (
    <div className="flex h-full flex-col bg-surface">
      <header className="border-b border-border px-4 py-4">
        <h2 className="font-sans text-base text-fg">Find me online</h2>
        <p className="mt-1 font-mono text-xs text-muted">
          Reach out directly or follow along — all links sourced from resume.json.
        </p>
      </header>

      <div className="flex flex-1 flex-col overflow-y-auto">
        {rows.map((row) => (
          <ChannelRowItem key={row.kind} row={row} />
        ))}
      </div>
    </div>
  );
}
