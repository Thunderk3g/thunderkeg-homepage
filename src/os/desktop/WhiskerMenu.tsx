'use client';

import { useMemo, useState } from 'react';
import { useOS } from '../store';
import { apps, appsByCategory } from '../registry';
import type { AppCategory } from '../types';

const CATEGORY_ICONS: Partial<Record<AppCategory, string>> = {
  Favorites: '★',
  'Information Gathering': '🔍',
  'Vulnerability Analysis': '🐞',
  'Web Application Analysis': '🌐',
  'Password Attacks': '🔑',
  'Wireless Attacks': '📡',
  'Exploitation Tools': '🎯',
  'Sniffing & Spoofing': '👃',
  Forensics: '🔬',
  'Reverse Engineering': '⚙',
  'Reporting Tools': '📊',
  Internet: '🌍',
  Development: '💻',
  Accessories: '🧰',
  Games: '🎮',
  System: '🖥',
};

const FAVORITES = ['terminal', 'browser', 'files', 'games', 'msfconsole', 'settings'];

export function WhiskerMenu({ onClose }: { onClose: () => void }) {
  const launch = useOS((s) => s.launch);
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState<AppCategory | 'Favorites'>('Favorites');

  const categories = useMemo(() => appsByCategory(), []);
  const catList = useMemo(
    () => ['Favorites', ...[...categories.keys()].sort()] as (AppCategory | 'Favorites')[],
    [categories],
  );

  const open = (id: string) => {
    launch(id);
    onClose();
  };

  const visible = useMemo(() => {
    if (query.trim()) {
      const q = query.toLowerCase();
      return apps.filter(
        (a) => !a.hidden && (a.title.toLowerCase().includes(q) || a.description?.toLowerCase().includes(q)),
      );
    }
    if (cat === 'Favorites') {
      return FAVORITES.map((id) => apps.find((a) => a.id === id)).filter(Boolean) as typeof apps;
    }
    return categories.get(cat) ?? [];
  }, [query, cat, categories]);

  return (
    <>
      <div className="kos-whisker-backdrop" onClick={onClose} />
      <div className="kos-whisker" role="menu">
        <div className="kos-whisker-head">
          <div className="kos-whisker-user">
            <div className="kos-whisker-avatar">DA</div>
            <div>
              <strong>kali</strong>
              <span>Diwakar Adhikari</span>
            </div>
          </div>
          <input
            className="kos-whisker-search"
            placeholder="Search applications…"
            value={query}
            autoFocus
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="kos-whisker-body">
          {!query && (
            <div className="kos-whisker-cats">
              {catList.map((c) => (
                <button
                  key={c}
                  className={'kos-whisker-cat' + (cat === c ? ' active' : '')}
                  onClick={() => setCat(c)}
                >
                  <span>{CATEGORY_ICONS[c as AppCategory] ?? '•'}</span> {c}
                </button>
              ))}
            </div>
          )}
          <div className="kos-whisker-apps">
            {visible.map((a) => (
              <button key={a.id} className="kos-whisker-app" onClick={() => open(a.id)} title={a.description}>
                <span className="kos-whisker-app-icon">{a.icon}</span>
                <span className="kos-whisker-app-name">{a.title}</span>
              </button>
            ))}
            {visible.length === 0 && <div className="kos-whisker-empty">No applications found.</div>}
          </div>
        </div>
        <div className="kos-whisker-foot">
          <a href="/resume" target="_blank" rel="noreferrer">📄 Plain résumé</a>
        </div>
      </div>
    </>
  );
}
