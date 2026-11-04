'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ExternalLink, Lock, Plus, RotateCw, X } from 'lucide-react';
import type { AppDefinition, AppProps } from '../../types';
import { useOS } from '../../store';
import { profile } from '@/data/resume';
import { EMBED_PROBES, embedHostKey, isEmbedHost } from './embeds';

/**
 * Firefox: real tabs over the site's own canonical pages (/resume, /writing,
 * /learning) in same-origin iframes, plus a few allow-listed research sites
 * when they permit framing. Everything else opens in a real browser tab.
 */

interface Tab {
  id: number;
  /** history of URLs: same-origin paths ("/resume#x") or absolute external URLs */
  history: string[];
  cursor: number;
  title: string;
  /** bumped to force a reload */
  epoch: number;
}

interface Notice {
  text: string;
  url?: string;
}

const START_PAGES = ['/resume', '/writing', '/learning'];
const NEW_TAB = 'about:newtab';

const BOOKMARKS: { label: string; url: string; external?: boolean }[] = [
  { label: 'Résumé', url: '/resume' },
  { label: 'Writing', url: '/writing' },
  { label: 'Learning OS', url: '/learning' },
  { label: 'GitHub', url: profile.githubUrl, external: true },
  { label: 'arXiv', url: 'https://arxiv.org/', external: true },
];

/** old in-app page ids (WelcomeCard, terminal) → canonical page. /resume has no section anchors yet. */
const LEGACY_PAGES: Record<string, string> = {
  home: '/resume',
  experience: '/resume',
  projects: '/resume',
  research: '/resume',
  skills: '/resume',
  education: '/resume',
  contact: '/resume',
  writing: '/writing',
  learning: '/learning',
};

const isExternal = (u: string) => /^https?:\/\//i.test(u);
const hostOf = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return u;
  }
};
const cleanTitle = (t: string) => t.replace(/\s+—\s+Diwakar Adhikari$/, '').trim();

function guessTitle(url: string): string {
  if (url === NEW_TAB) return 'New Tab';
  if (isExternal(url)) return hostOf(url);
  const p = url.split(/[?#]/)[0];
  if (p.startsWith('/resume')) return 'Résumé';
  if (p.startsWith('/writing')) return 'Writing';
  if (p.startsWith('/learning')) return 'Learning OS';
  return p;
}

type Resolved = { kind: 'local'; url: string } | { kind: 'embed'; url: string } | { kind: 'away'; url: string; why: string } | { kind: 'desktop' } | { kind: 'newtab' };

/** Turn whatever was typed or clicked into a destination. */
function resolve(input: string): Resolved {
  let raw = input.trim();
  if (!raw || raw === NEW_TAB) return { kind: 'newtab' };
  const origin = window.location.origin;
  if (raw.startsWith('/')) raw = origin + raw;
  else if (!/^[a-z]+:/i.test(raw)) {
    // "localhost:3000/resume", "arxiv.org/abs/…", or a bare word → site page
    if (/^[\w-]+(\.[\w-]+)+(:\d+)?(\/|$)/.test(raw) || raw.startsWith(window.location.host)) raw = 'https://' + raw;
    else raw = `${origin}/${raw.replace(/^\/+/, '')}`;
  }
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { kind: 'away', url: raw, why: 'That is not a valid address.' };
  }
  if (u.host === window.location.host) {
    const path = u.pathname + u.search + u.hash;
    if (u.pathname === '/' || u.pathname === '') return { kind: 'desktop' };
    if (u.pathname.startsWith('/api/')) return { kind: 'away', url: u.toString(), why: 'API endpoints open in a new tab.' };
    return { kind: 'local', url: path };
  }
  if (u.protocol === 'https:' && isEmbedHost(u.hostname)) return { kind: 'embed', url: u.toString() };
  return { kind: 'away', url: u.toString(), why: `${hostOf(u.toString())} opens in a new browser tab.` };
}

let tabSeq = 1;
const makeTab = (url: string): Tab => ({ id: tabSeq++, history: [url], cursor: 0, title: guessTitle(url), epoch: 0 });

function initialUrl(args?: Record<string, unknown>): string | null {
  if (typeof args?.url === 'string') return args.url;
  if (typeof args?.page === 'string') return LEGACY_PAGES[args.page] ?? '/resume';
  if (typeof args?.arg === 'string') return args.arg;
  return null;
}

function BrowserApp({ windowId, args }: AppProps) {
  const setTitle = useOS((s) => s.setTitle);
  const focus = useOS((s) => s.focus);
  const [tabs, setTabs] = useState<Tab[]>(() => START_PAGES.map(makeTab));
  const [activeId, setActiveId] = useState<number>(() => tabs[0].id);
  /** tabs that have been shown at least once keep their frame mounted */
  const [mounted, setMounted] = useState<Set<number>>(() => new Set([tabs[0].id]));
  const [address, setAddress] = useState('');
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  /** allow-listed host → may it be framed? (absent until the probe answers) */
  const [embedOk, setEmbedOk] = useState<Record<string, boolean>>({});

  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];
  const current = active.history[active.cursor];

  const updateTab = useCallback((id: number, fn: (t: Tab) => Tab) => {
    setTabs((ts) => ts.map((t) => (t.id === id ? fn(t) : t)));
  }, []);

  const activate = useCallback((id: number) => {
    setActiveId(id);
    setMounted((m) => (m.has(id) ? m : new Set(m).add(id)));
  }, []);

  /* Probe the allow-listed research sites once, so a refusal is known before the click
     and can open a real tab inside the user gesture (popup blockers allow that). */
  useEffect(() => {
    let live = true;
    for (const [host, probe] of Object.entries(EMBED_PROBES)) {
      fetch(`/api/browser/frame-check?url=${encodeURIComponent(probe)}`)
        .then((r) => r.json())
        .catch(() => ({ embeddable: false }))
        .then((r: { embeddable?: boolean }) => live && setEmbedOk((m) => ({ ...m, [host]: Boolean(r.embeddable) })));
    }
    return () => {
      live = false;
    };
  }, []);

  /** Navigate the given tab (default: active) to a typed/clicked destination. */
  const navigate = useCallback(
    (input: string, tabId?: number) => {
      const id = tabId ?? activeId;
      const r = resolve(input);
      setEditing(false);
      if (r.kind === 'desktop') {
        setNotice({ text: 'That address is this desktop — you are already here.' });
        return;
      }
      if (r.kind === 'away') {
        window.open(r.url, '_blank', 'noopener');
        setNotice({ text: r.why, url: r.url });
        return;
      }
      const url = r.kind === 'newtab' ? NEW_TAB : r.url;
      if (r.kind === 'embed' && embedOk[embedHostKey(hostOf(url))] === false) {
        window.open(url, '_blank', 'noopener');
        setNotice({ text: `${hostOf(url)} can't be shown inside this window, so it opened in a new browser tab.`, url });
        return;
      }
      setNotice(null);
      updateTab(id, (t) =>
        t.history[t.cursor] === url
          ? { ...t, epoch: t.epoch + 1 }
          : { ...t, history: [...t.history.slice(0, t.cursor + 1), url], cursor: t.cursor + 1, title: guessTitle(url) },
      );
    },
    [activeId, embedOk, updateTab],
  );

  const openTab = useCallback(
    (url: string) => {
      const r = resolve(url);
      if (r.kind === 'away' || r.kind === 'desktop') return navigate(url);
      const t = makeTab(NEW_TAB);
      setTabs((ts) => [...ts, t]);
      activate(t.id);
      if (r.kind !== 'newtab') navigate(url, t.id);
    },
    [activate, navigate],
  );

  const closeTab = (id: number) => {
    const idx = tabs.findIndex((t) => t.id === id);
    const rest = tabs.filter((t) => t.id !== id);
    if (rest.length === 0) {
      const t = makeTab(NEW_TAB);
      setTabs([t]);
      activate(t.id);
      return;
    }
    setTabs(rest);
    if (id === activeId) activate(rest[Math.max(0, idx - 1)].id);
  };

  /* single-instance: a later launch('browser', {page|url}) lands here */
  const lastArgs = useRef<Record<string, unknown> | undefined>(undefined);
  useEffect(() => {
    if (args === lastArgs.current) return;
    lastArgs.current = args;
    const url = initialUrl(args);
    if (!url) return;
    const r = resolve(url);
    if (r.kind === 'local') {
      const existing = tabs.find((t) => t.history[t.cursor].split('#')[0] === r.url.split('#')[0]);
      if (existing) {
        activate(existing.id);
        if (existing.history[existing.cursor] !== r.url) navigate(r.url, existing.id);
        return;
      }
    }
    openTab(url);
  }, [args]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setTitle(windowId, `${active.title} — Mozilla Firefox`);
  }, [active.title, setTitle, windowId]);

  useEffect(() => {
    if (!editing) setAddress(current === NEW_TAB ? '' : isExternal(current) ? current : window.location.host + current);
  }, [current, editing]);

  /** Same-origin frame loaded: read its title and URL, keep links inside the app, look native. */
  const onFrameLoad = (tab: Tab, el: HTMLIFrameElement) => {
    let doc: Document | null = null;
    try {
      doc = el.contentDocument;
    } catch {
      return;
    }
    if (!doc || !el.contentWindow) return;
    const loc = el.contentWindow.location;
    const here = loc.pathname + loc.search + loc.hash;
    updateTab(tab.id, (t) => {
      const title = cleanTitle(doc!.title) || guessTitle(here);
      if (t.history[t.cursor] === here || here === 'blank') return { ...t, title };
      // in-page navigation we didn't initiate (e.g. a form) → record it
      return { ...t, title, history: [...t.history.slice(0, t.cursor + 1), here], cursor: t.cursor + 1 };
    });
    if (!doc.getElementById('kos-ff-style')) {
      const st = doc.createElement('style');
      st.id = 'kos-ff-style';
      // the "desktop" crumb would boot the OS inside itself; the window chrome already says where you are
      st.textContent = '.doc-nav a[href="/"]{display:none}';
      doc.head.appendChild(st);
    }
    doc.addEventListener('pointerdown', () => focus(windowId), true);
    doc.addEventListener(
      'click',
      (e) => {
        const a = (e.target as Element | null)?.closest?.('a');
        if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
        const href = a.getAttribute('href');
        if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
        const target = new URL(href, loc.href);
        if (target.host !== window.location.host) {
          if (a.target === '_blank') return; // the page already opens it in a new tab
          e.preventDefault();
          navigate(target.toString(), tab.id);
          return;
        }
        e.preventDefault();
        navigate(target.pathname + target.search + target.hash, tab.id);
      },
      true,
    );
  };

  const go = (delta: number) => {
    const c = active.cursor + delta;
    if (c < 0 || c >= active.history.length) return;
    updateTab(active.id, (t) => ({ ...t, cursor: c, title: guessTitle(t.history[c]) }));
  };

  const reload = () => updateTab(active.id, (t) => ({ ...t, epoch: t.epoch + 1 }));

  const frameFor = (t: Tab) => {
    const url = t.history[t.cursor];
    if (url === NEW_TAB) return <NewTabPage onOpen={(u) => navigate(u, t.id)} />;
    if (isExternal(url)) {
      const ok = embedOk[embedHostKey(hostOf(url))];
      if (ok !== true) {
        return (
          <div className="kos-ff-blocked">
            {ok === undefined ? (
              <p>Checking whether {hostOf(url)} can be shown here…</p>
            ) : (
              <>
                <p>
                  <strong>{hostOf(url)}</strong> doesn&apos;t allow being shown inside another page.
                </p>
                <a className="kos-game-btn primary" href={url} target="_blank" rel="noreferrer">
                  Open in a new tab ↗
                </a>
              </>
            )}
          </div>
        );
      }
      return (
        <iframe
          key={`${url}#${t.epoch}`}
          className="kos-ff-frame"
          src={url}
          title={t.title}
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          referrerPolicy="no-referrer"
        />
      );
    }
    return (
      // a fresh frame per history entry: no entries leak into the top-level session history
      <iframe
        key={`${t.id}#${t.cursor}#${t.epoch}#${url}`}
        className="kos-ff-frame"
        src={url}
        title={t.title}
        onLoad={(e) => onFrameLoad(t, e.currentTarget)}
      />
    );
  };

  return (
    <div className="kos-ff">
      <div className="kos-ff-tabs" role="tablist" aria-label="Tabs">
        {tabs.map((t) => (
          <div
            key={t.id}
            role="tab"
            aria-selected={t.id === activeId}
            className={'kos-ff-tab' + (t.id === activeId ? ' on' : '')}
            onClick={() => activate(t.id)}
            onAuxClick={(e) => e.button === 1 && closeTab(t.id)}
            title={t.title}
          >
            <span className="kos-ff-tab-title">{t.title}</span>
            <button
              type="button"
              className="kos-ff-tab-x"
              aria-label={`Close ${t.title}`}
              onClick={(e) => {
                e.stopPropagation();
                closeTab(t.id);
              }}
            >
              <X size={12} aria-hidden />
            </button>
          </div>
        ))}
        <button type="button" className="kos-ff-newtab" onClick={() => openTab(NEW_TAB)} aria-label="New tab" title="New tab">
          <Plus size={14} aria-hidden />
        </button>
      </div>

      <div className="kos-ff-toolbar">
        <button type="button" className="kos-ff-btn" onClick={() => go(-1)} disabled={active.cursor === 0} aria-label="Back" title="Back">
          <ArrowLeft size={15} aria-hidden />
        </button>
        <button
          type="button"
          className="kos-ff-btn"
          onClick={() => go(1)}
          disabled={active.cursor >= active.history.length - 1}
          aria-label="Forward"
          title="Forward"
        >
          <ArrowRight size={15} aria-hidden />
        </button>
        <button type="button" className="kos-ff-btn" onClick={reload} aria-label="Reload" title="Reload">
          <RotateCw size={14} aria-hidden />
        </button>
        <form
          className="kos-ff-url"
          onSubmit={(e) => {
            e.preventDefault();
            navigate(address);
          }}
        >
          <Lock size={12} aria-hidden className="kos-ff-lock" />
          <input
            value={address}
            onChange={(e) => {
              setEditing(true);
              setAddress(e.target.value);
            }}
            onFocus={(e) => e.currentTarget.select()}
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => e.key === 'Escape' && (setEditing(false), e.currentTarget.blur())}
            placeholder="Search or enter address"
            aria-label="Address"
            spellCheck={false}
          />
        </form>
        {current !== NEW_TAB && (
          <a
            className="kos-ff-btn"
            href={current}
            target="_blank"
            rel="noreferrer"
            aria-label="Open this page in a new browser tab"
            title="Open in a new browser tab"
          >
            <ExternalLink size={14} aria-hidden />
          </a>
        )}
      </div>

      <div className="kos-ff-bookmarks" aria-label="Bookmarks">
        {BOOKMARKS.map((b) =>
          b.external ? (
            <a key={b.label} className="kos-ff-bm" href={b.url} target="_blank" rel="noreferrer">
              {b.label} ↗
            </a>
          ) : (
            <button key={b.label} type="button" className="kos-ff-bm" onClick={() => navigate(b.url)}>
              {b.label}
            </button>
          ),
        )}
      </div>

      {notice && (
        <div className="kos-ff-notice" role="status">
          <span>{notice.text}</span>
          {notice.url && (
            <a href={notice.url} target="_blank" rel="noreferrer">
              Open again ↗
            </a>
          )}
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss">
            <X size={13} aria-hidden />
          </button>
        </div>
      )}

      <div className="kos-ff-view">
        {tabs.map((t) =>
          mounted.has(t.id) ? (
            <div key={t.id} className="kos-ff-pane" hidden={t.id !== activeId}>
              {frameFor(t)}
            </div>
          ) : null,
        )}
      </div>
    </div>
  );
}

function NewTabPage({ onOpen }: { onOpen: (url: string) => void }) {
  return (
    <div className="kos-ff-start">
      <h2>Where to?</h2>
      <div className="kos-ff-tiles">
        {BOOKMARKS.map((b) =>
          b.external ? (
            <a key={b.label} className="kos-ff-tile" href={b.url} target="_blank" rel="noreferrer">
              <strong>{b.label} ↗</strong>
              <span>{hostOf(b.url)}</span>
            </a>
          ) : (
            <button key={b.label} type="button" className="kos-ff-tile" onClick={() => onOpen(b.url)}>
              <strong>{b.label}</strong>
              <span>{b.url}</span>
            </button>
          ),
        )}
      </div>
      <p className="kos-ff-start-hint">
        Pages on this site open here. arXiv, Hugging Face Papers and Google Scholar open here too when they allow it;
        anything else opens in a new browser tab.
      </p>
    </div>
  );
}

export const browserApp: AppDefinition = {
  id: 'browser',
  title: 'Firefox',
  icon: '🦊',
  category: 'Internet',
  component: BrowserApp,
  description: 'The résumé, writing and Learning OS pages, in tabs',
  defaultSize: { width: 1040, height: 680 },
  minSize: { width: 420, height: 320 },
  desktop: true,
  launchCommands: ['firefox', 'about'],
};

export default BrowserApp;
