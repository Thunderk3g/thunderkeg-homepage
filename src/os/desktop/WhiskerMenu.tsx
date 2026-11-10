'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useOS, isUndercover } from '../store';
import { apps, getApp } from '../registry';
import type { AppDefinition } from '../types';
import { AppIcon, SysIcon } from '../icons';

/**
 * xfce4-whiskermenu-plugin as Kali ships it: search on top, application list
 * on the left, category column on the right, user + Settings / Log Out below.
 * Keyboard: type to search, ↑/↓ to move, ←/→ (empty search) to change
 * category, Enter to launch, Esc to close.
 */

interface Entry {
  key: string;
  title: string;
  description?: string;
  category: string;
  icon: { id: string; fallback?: string };
  run: () => void;
}

/** Kali's numbered menu sections. */
const KALI_CATS = [
  '01 - Information Gathering',
  '02 - Vulnerability Analysis',
  '03 - Web Application Analysis',
  '04 - Database Assessment',
  '05 - Password Attacks',
  '06 - Wireless Attacks',
  '07 - Reverse Engineering',
  '08 - Exploitation Tools',
  '09 - Sniffing & Spoofing',
  '10 - Post Exploitation',
  '11 - Forensics',
  '12 - Reporting Tools',
  '13 - Social Engineering Tools',
];
const USUAL = 'Usual Applications';
const FAV = 'Favorites';
const RECENT = 'Recently Used';
const ALL = 'All Applications';

function kaliSection(a: AppDefinition): string[] {
  const c = a.category as string;
  const hit = KALI_CATS.find((k) => k.slice(5).toLowerCase() === c.toLowerCase());
  const out = hit ? [hit] : [];
  // Kali lists sqlmap under both web apps and database assessment; psql is a DB client
  if (a.id === 'sqlmap' || a.id === 'psql' || /database/i.test(c)) out.push(KALI_CATS[3]);
  return out.length ? [...new Set(out)] : [USUAL];
}

const FAVORITE_IDS = ['hire', 'research', 'terminal', 'root-terminal', 'files', 'editor', 'browser', 'vm', 'psql'];
const WEB_LINKS = [
  { key: 'link-kali', title: 'Kali Linux', description: 'kali.org', url: 'https://www.kali.org/' },
  { key: 'link-tools', title: 'Kali Tools', description: 'Tool documentation', url: 'https://www.kali.org/tools/' },
  { key: 'link-docs', title: 'Kali Docs', description: 'Official documentation', url: 'https://www.kali.org/docs/' },
  { key: 'link-edb', title: 'Exploit-DB', description: 'Exploit database archive', url: 'https://www.exploit-db.com/' },
];

/** subsequence fuzzy score; 0 = no match, higher = better */
function fuzzy(q: string, text: string): number {
  const t = text.toLowerCase();
  const i = t.indexOf(q);
  if (i >= 0) return 100 - i + (i === 0 || t[i - 1] === ' ' ? 40 : 0);
  let ti = 0;
  let score = 0;
  for (const ch of q) {
    const found = t.indexOf(ch, ti);
    if (found < 0) return 0;
    score += found === ti ? 3 : 1;
    ti = found + 1;
  }
  return score;
}

export function WhiskerMenu() {
  const launch = useOS((s) => s.launch);
  const setMenuOpen = useOS((s) => s.setMenuOpen);
  const setSessionDialog = useOS((s) => s.setSessionDialog);
  const toggleUndercover = useOS((s) => s.toggleUndercover);
  const recentIds = useOS((s) => s.recent);
  const user = useOS((s) => s.user);
  const undercover = useOS(isUndercover);
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState(FAV);
  const [sel, setSel] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const onClose = () => setMenuOpen(false);

  const entries = useMemo(() => {
    const fromApp = (a: AppDefinition): Entry => ({
      key: a.id,
      title: a.title,
      description: a.description,
      category: a.category,
      icon: { id: a.id, fallback: a.icon },
      run: () => launch(a.id),
    });
    const visible = apps.filter((a) => !a.hidden);
    const byCat = new Map<string, Entry[]>();
    for (const a of visible) for (const c of kaliSection(a)) {
      if (!byCat.has(c)) byCat.set(c, []);
      byCat.get(c)!.push(fromApp(a));
    }
    const undercoverEntry: Entry = {
      key: 'undercover',
      title: 'Kali Undercover Mode',
      description: 'Make the desktop look like Windows 10',
      category: 'System',
      icon: { id: 'undercover' },
      run: () => {
        toggleUndercover();
      },
    };
    byCat.set(USUAL, [...(byCat.get(USUAL) ?? []), undercoverEntry].sort((a, b) => a.title.localeCompare(b.title)));

    const favs: Entry[] = [];
    for (const id of FAVORITE_IDS) {
      if (id === 'root-terminal') {
        if (getApp('terminal'))
          favs.push({
            key: 'root-terminal',
            title: 'Root Terminal Emulator',
            description: 'Terminal as root (sudo -i)',
            category: 'System',
            icon: { id: 'terminal' },
            run: () => launch('terminal', { root: true }),
          });
        continue;
      }
      const a = getApp(id);
      if (a) favs.push(fromApp(a));
    }
    for (const l of WEB_LINKS)
      favs.push({
        key: l.key,
        title: l.title,
        description: l.description,
        category: 'Web',
        icon: { id: 'browser' },
        run: () => window.open(l.url, '_blank', 'noopener'),
      });

    const all = [...visible.map(fromApp), undercoverEntry].sort((a, b) => a.title.localeCompare(b.title));
    return { byCat, favs, all };
  }, [launch, toggleUndercover]);

  const rail = [FAV, RECENT, ALL, ...KALI_CATS, USUAL];

  const list: Entry[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) {
      return entries.all
        .map((e) => ({
          e,
          s: Math.max(fuzzy(q, e.title) * 2, fuzzy(q, e.description ?? ''), fuzzy(q, e.category) * 0.8),
        }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s)
        .map((x) => x.e);
    }
    if (cat === FAV) return entries.favs;
    if (cat === ALL) return entries.all;
    if (cat === RECENT)
      return recentIds.map((id) => entries.all.find((e) => e.key === id)).filter(Boolean) as Entry[];
    return entries.byCat.get(cat) ?? [];
  }, [query, cat, entries, recentIds]);

  useEffect(() => setSel(0), [query, cat]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${sel}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [sel]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (root.current?.contains(t) || t.closest('[data-whisker-button]')) return;
      onClose();
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const open = (e: Entry | undefined) => {
    if (!e) return;
    onClose();
    e.run();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (query) setQuery('');
      else onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSel((s) => Math.min(list.length - 1, s + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSel((s) => Math.max(0, s - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      open(list[sel]);
    } else if (!query && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      e.preventDefault();
      const i = rail.indexOf(cat);
      setCat(rail[(i + (e.key === 'ArrowRight' ? 1 : -1) + rail.length) % rail.length]);
    }
  };

  return (
    <div
      className={'kos-whisker' + (undercover ? ' start' : '')}
      role="menu"
      aria-label="Applications"
      ref={root}
      onKeyDown={onKey}
    >
      <div className="kos-whisker-head">
        <span className="kos-whisker-search-ico">
          <SysIcon name="search" size={15} />
        </span>
        <input
          className="kos-whisker-search"
          placeholder="Search Applications"
          value={query}
          autoFocus
          aria-label="Search applications"
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="kos-whisker-body">
        <div className="kos-whisker-apps" ref={listRef} role="listbox" aria-label={query ? 'Search results' : cat}>
          {list.map((e, i) => (
            <button
              key={e.key}
              data-idx={i}
              role="option"
              aria-selected={i === sel}
              className={'kos-whisker-app' + (i === sel ? ' sel' : '')}
              onClick={() => open(e)}
              onPointerMove={() => i !== sel && setSel(i)}
            >
              <AppIcon id={e.icon.id} size={32} fallback={e.icon.fallback} />
              <span className="kos-whisker-app-text">
                <span className="kos-whisker-app-name">{e.title}</span>
                {e.description && <span className="kos-whisker-app-desc">{e.description}</span>}
              </span>
            </button>
          ))}
          {list.length === 0 && (
            <div className="kos-whisker-empty">
              {query ? `No applications match “${query}”.` : cat === RECENT ? 'Nothing launched yet.' : 'Nothing installed in this category yet.'}
            </div>
          )}
        </div>

        <div className="kos-whisker-cats" role="tablist" aria-label="Categories">
          {rail.map((c) => (
            <button
              key={c}
              role="tab"
              aria-selected={!query && cat === c}
              className={'kos-whisker-cat' + (!query && cat === c ? ' active' : '')}
              onClick={() => {
                setQuery('');
                setCat(c);
              }}
              onPointerEnter={() => !query && setCat(c)}
            >
              <CatIcon c={c} />
              <span>{c}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="kos-whisker-foot">
        <div className="kos-avatar sm" aria-hidden="true">
          DA
        </div>
        <div className="kos-whisker-who">
          <strong>{user}</strong>
          <span>Diwakar Adhikari</span>
        </div>
        <button
          className="kos-whisker-foot-btn"
          onClick={() => {
            onClose();
            launch('settings');
          }}
          title="All Settings"
          aria-label="Settings"
        >
          <SysIcon name="settings" size={16} />
        </button>
        <button
          className="kos-whisker-foot-btn"
          onClick={() => {
            onClose();
            setSessionDialog(true);
          }}
          title="Log Out"
          aria-label="Log out"
        >
          <SysIcon name="logout" size={16} />
        </button>
      </div>
    </div>
  );
}

function CatIcon({ c }: { c: string }) {
  if (c === FAV) return <SysIcon name="star" size={15} />;
  if (c === RECENT) return <SysIcon name="history" size={15} />;
  if (c === ALL) return <SysIcon name="grid" size={15} />;
  if (c === USUAL) return <SysIcon name="window" size={15} />;
  const n = c.slice(0, 2);
  return <span className="kos-whisker-cat-n">{n}</span>;
}

