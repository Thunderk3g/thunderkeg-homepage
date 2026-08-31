'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { AppDefinition, AppProps } from '../../types';
import { Markdown } from '@/content/Markdown';
import type { Entry } from '@/content/writing';

type Tab = 'post' | 'paper' | 'compose';

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'untitled';

const fmt = (iso: string) =>
  iso
    ? new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      })
    : '';

/* ───────────────────────── composer ───────────────────────── */

const TEMPLATE = `Write in markdown. Headings, lists, tables, \`code\`, **bold**, [links](https://example.com).

## A section

- a point
- another point
`;

function Composer() {
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<'post' | 'paper'>('post');
  const [summary, setSummary] = useState('');
  const [tags, setTags] = useState('');
  const [authors, setAuthors] = useState('');
  const [venue, setVenue] = useState('');
  const [link, setLink] = useState('');
  const [body, setBody] = useState(TEMPLATE);
  const [preview, setPreview] = useState(false);

  const slug = slugify(title);
  const today = new Date().toISOString().slice(0, 10);

  const markdown = useMemo(() => {
    const meta = [
      '---',
      `kind: ${kind}`,
      `title: ${title || 'Untitled'}`,
      `date: ${today}`,
      `summary: ${summary}`,
      ...(kind === 'paper'
        ? [`authors: ${authors}`, `venue: ${venue}`, `link: ${link}`, 'status: reading']
        : []),
      `tags: ${tags}`,
      '---',
      '',
    ];
    return meta.join('\n') + body.replace(/\r\n/g, '\n') + '\n';
  }, [kind, title, today, summary, authors, venue, link, tags, body]);

  const download = () => {
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${slug}.md downloaded`, { description: 'Drop it in /content and commit to publish.' });
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      toast.success('Markdown copied to clipboard');
    } catch {
      toast.error('Clipboard blocked — use Download instead');
    }
  };

  return (
    <div className="kos-writing-compose">
      <div className="kos-writing-fields">
        <label>
          <span>Kind</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as 'post' | 'paper')}>
            <option value="post">Post / article</option>
            <option value="paper">Paper note</option>
          </select>
        </label>
        <label>
          <span>Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Coverage is not constraint" />
        </label>
        <label className="wide">
          <span>Summary</span>
          <input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="One sentence for the index and the RSS feed." />
        </label>
        {kind === 'paper' && (
          <>
            <label>
              <span>Authors</span>
              <input value={authors} onChange={(e) => setAuthors(e.target.value)} placeholder="Robaldo, Bartolini et al." />
            </label>
            <label>
              <span>Venue</span>
              <input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="JURIX 2026 · arXiv:…" />
            </label>
            <label className="wide">
              <span>Link</span>
              <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://arxiv.org/abs/…" />
            </label>
          </>
        )}
        <label className="wide">
          <span>Tags</span>
          <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="compliance, retrieval, measurement" />
        </label>
      </div>

      {preview ? (
        <div className="kos-writing-preview">
          <Markdown source={body} />
        </div>
      ) : (
        <textarea
          className="kos-writing-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          spellCheck
        />
      )}

      <div className="kos-writing-actions">
        <span className="kos-writing-filename">content/{slug}.md</span>
        <button className="kos-game-btn" onClick={() => setPreview((p) => !p)}>
          {preview ? 'Edit' : 'Preview'}
        </button>
        <button className="kos-game-btn" onClick={copy}>
          Copy
        </button>
        <button className="kos-game-btn primary" onClick={download} disabled={!title.trim()}>
          Download .md
        </button>
      </div>
      <p className="kos-writing-hint">
        Publishing is a commit: drop the file in <code>/content</code>, push, and it appears here,
        on <code>/writing</code> and in the RSS feed. No CMS, no database.
      </p>
    </div>
  );
}

/* ───────────────────────── reader ───────────────────────── */

function WritingApp(_props: AppProps) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('post');
  const [openSlug, setOpenSlug] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/content')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: { entries: Entry[] }) => alive && setEntries(d.entries))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  const open = entries?.find((e) => e.slug === openSlug) ?? null;
  const listed = (entries ?? []).filter((e) => e.kind === tab);

  return (
    <div className="kos-writing">
      <div className="kos-writing-tabs">
        {(['post', 'paper', 'compose'] as Tab[]).map((t) => (
          <button
            key={t}
            className={'kos-writing-tab' + (tab === t ? ' active' : '')}
            onClick={() => {
              setTab(t);
              setOpenSlug(null);
            }}
          >
            {t === 'post' ? 'Posts' : t === 'paper' ? "Papers I'm reading" : 'Compose'}
          </button>
        ))}
        <a className="kos-writing-tab link" href="/writing" target="_blank" rel="noreferrer">
          /writing ↗
        </a>
      </div>

      {tab === 'compose' ? (
        <Composer />
      ) : open ? (
        <div className="kos-writing-reader">
          <button className="kos-writing-back" onClick={() => setOpenSlug(null)}>
            ← back
          </button>
          <h1>{open.title}</h1>
          <div className="kos-writing-meta">
            {fmt(open.date)}
            {open.authors && ` · ${open.authors}`}
            {open.venue && ` · ${open.venue}`}
          </div>
          {open.link && (
            <a className="kos-writing-link" href={open.link} target="_blank" rel="noreferrer">
              {open.link}
            </a>
          )}
          <Markdown source={open.body} />
        </div>
      ) : (
        <div className="kos-writing-list">
          {error && <p className="kos-writing-empty">Couldn&rsquo;t load content ({error}).</p>}
          {!entries && !error && <p className="kos-writing-empty">Loading…</p>}
          {entries && listed.length === 0 && <p className="kos-writing-empty">Nothing here yet.</p>}
          {listed.map((e) => (
            <button key={e.slug} className="kos-writing-item" onClick={() => setOpenSlug(e.slug)}>
              <span className="kos-writing-item-title">{e.title}</span>
              <span className="kos-writing-item-meta">
                {fmt(e.date)}
                {e.venue && ` · ${e.venue}`}
                {e.status && ` · ${e.status}`}
              </span>
              <span className="kos-writing-item-summary">{e.summary}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export const writingApp: AppDefinition = {
  id: 'writing',
  title: 'Writing',
  icon: '✎',
  category: 'Accessories',
  component: WritingApp,
  description: 'Blog posts, articles and the papers I am reading — plus a composer',
  defaultSize: { width: 880, height: 620 },
  minSize: { width: 420, height: 340 },
  desktop: true,
  launchCommands: ['writing', 'blog-app'],
};

export default WritingApp;
