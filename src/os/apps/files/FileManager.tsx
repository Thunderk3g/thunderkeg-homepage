'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { AppDefinition, AppProps, FsNode } from '../../types';
import { useOS } from '../../store';
import { getApp } from '../../registry';
import { FileIcon } from './icons';
import { InfoPanel } from './InfoPanel';
import { TerminalPanel } from './TerminalPanel';
import {
  modifiedText,
  sizeText,
  usePane,
  useVisibleEntries,
  type Entry,
  type Pane,
  type SortKey,
} from './useFsPane';
import './dolphin.css';

/* ───────────────────────── places ───────────────────────── */

interface Place {
  label: string;
  path: string;
  group: 'Places' | 'Devices' | 'Recent';
  /** launch an app instead of navigating */
  launch?: string;
}

const PLACES: Place[] = [
  { label: 'Home', path: '/home/kali', group: 'Places' },
  { label: 'Desktop', path: '/home/kali/Desktop', group: 'Places' },
  { label: 'Documents', path: '/home/kali/Documents', group: 'Places' },
  { label: 'Downloads', path: '/home/kali/Downloads', group: 'Places' },
  { label: 'Pictures', path: '/home/kali/Pictures', group: 'Places' },
  { label: 'Root', path: '/', group: 'Places' },
  { label: 'Linux VM share (9p)', path: '/home/kali/Documents', group: 'Devices' },
  { label: 'PostgreSQL workspace', path: '', group: 'Devices', launch: 'psql' },
  { label: 'Recently Saved', path: '/home/kali/Documents', group: 'Recent' },
];

/* ───────────────────────── fs helpers ───────────────────────── */

function dirAndName(path: string): { dir: string; name: string } {
  const parts = path.split('/').filter(Boolean);
  const name = parts.pop() ?? '';
  return { dir: '/' + parts.join('/'), name };
}

/** Icon-string for the window title bar. */
const EDIT_APPS = { editor: 'editor', code: 'code-editor' } as const;

function openerFor(name: string): string {
  if (/\.(md|markdown|txt|log|csv)$/i.test(name)) return EDIT_APPS.editor;
  if (/\.(ts|tsx|js|jsx|mjs|cjs|json|css|html|sh)$/i.test(name)) return getApp(EDIT_APPS.code) ? EDIT_APPS.code : EDIT_APPS.editor;
  return EDIT_APPS.editor;
}

/* ───────────────────────── main ───────────────────────── */

type Menu =
  | null
  | { x: number; y: number; kind: 'item'; entry: Entry; pane: 0 | 1 }
  | { x: number; y: number; kind: 'empty'; pane: 0 | 1 };

function FileManagerApp({ args }: AppProps) {
  const fs = useOS((s) => s.fs);
  const fsVersion = useOS((s) => s.fsVersion);
  const bumpFs = useOS((s) => s.bumpFs);
  const launch = useOS((s) => s.launch);

  const start = typeof args?.path === 'string' ? (args.path as string) : '/home/kali';
  const left = usePane(start);
  const right = usePane('/home/kali');

  const [split, setSplit] = useState(false);
  const [activePane, setActivePane] = useState<0 | 1>(0);
  const [showInfo, setShowInfo] = useState(false);
  const [showTerm, setShowTerm] = useState(false);
  const [menu, setMenu] = useState<Menu>(null);
  const [editingPath, setEditingPath] = useState<string | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const active = activePane === 0 ? left : right;

  const mutate = useCallback(
    (fn: () => void) => {
      fn();
      bumpFs();
    },
    [bumpFs],
  );

  /* ---- fs operations ---- */

  const createNode = (pane: Pane, kind: 'dir' | 'file', ext = '') => {
    const base = kind === 'dir' ? 'New Folder' : `New File${ext}`;
    let name = base;
    let n = 1;
    while (fs.exists((pane.cwd.endsWith('/') ? pane.cwd : pane.cwd + '/') + name)) name = base.replace(ext, '') + ` ${++n}` + ext;
    const path = (pane.cwd.endsWith('/') ? pane.cwd : pane.cwd + '/') + name;
    mutate(() => (kind === 'dir' ? fs.mkdir(path, pane.cwd) : fs.write(path, '', pane.cwd)));
    pane.setSelection([path]);
    setEditingPath(path);
  };

  const rename = (path: string, nextName: string) => {
    setEditingPath(null);
    const trimmed = nextName.trim();
    const { dir, name } = dirAndName(path);
    if (!trimmed || trimmed === name || trimmed.includes('/')) return;
    const parent = fs.get(dir);
    if (!parent || parent.type !== 'dir' || !parent.children) return;
    if (parent.children[trimmed]) {
      toast.error(`"${trimmed}" already exists`);
      return;
    }
    mutate(() => {
      const node = parent.children![name];
      delete parent.children![name];
      parent.children![trimmed] = node;
    });
    active.setSelection([dir === '/' ? '/' + trimmed : dir + '/' + trimmed]);
  };

  const remove = (entries: Entry[]) => {
    const saved = entries
      .map((e) => {
        const { dir } = dirAndName(e.path);
        const parent = fs.get(dir);
        const node = parent?.children?.[e.name];
        return node ? { path: e.path, dir, name: e.name, node } : null;
      })
      .filter(Boolean) as { path: string; dir: string; name: string; node: FsNode }[];
    if (!saved.length) return;
    mutate(() => saved.forEach((s) => fs.remove(s.path)));
    active.setSelection([]);
    toast(`Moved ${saved.length} item${saved.length === 1 ? '' : 's'} to trash`, {
      action: {
        label: 'Undo',
        onClick: () =>
          mutate(() =>
            saved.forEach((s) => {
              const parent = fs.get(s.dir);
              if (parent?.type === 'dir') (parent.children ??= {})[s.name] = s.node;
            }),
          ),
      },
    });
  };

  /* ---- opening ---- */

  const openEntry = useCallback(
    (pane: Pane, e: Entry) => {
      if (e.isDir) {
        pane.go(e.path);
        return;
      }
      launch(openerFor(e.name), { path: e.path });
    },
    [launch],
  );

  /* ---- keyboard ---- */

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA';
      if (typing && e.key !== 'Escape') return;
      const p = active;
      const entries = activePane === 0 ? leftEntries : rightEntries;
      if (e.key === 'F3') {
        e.preventDefault();
        setSplit((s) => !s);
      } else if (e.key === 'F4') {
        e.preventDefault();
        setShowTerm((s) => !s);
      } else if (e.key === 'F9') {
        e.preventDefault();
        setShowPlaces((s) => !s);
      } else if (e.key === 'F11') {
        e.preventDefault();
        setShowInfo((s) => !s);
      } else if (e.key === 'F5') {
        e.preventDefault();
        bumpFs();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        setLocEditing(true);
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F' || e.key === 'i' || e.key === 'I')) {
        e.preventDefault();
        setShowFilter(true);
        setTimeout(() => filterRef.current?.focus(), 0);
      } else if ((e.ctrlKey || e.metaKey) && e.key === '1') {
        e.preventDefault();
        p.setView('icons');
      } else if ((e.ctrlKey || e.metaKey) && e.key === '2') {
        e.preventDefault();
        p.setView('compact');
      } else if ((e.ctrlKey || e.metaKey) && e.key === '3') {
        e.preventDefault();
        p.setView('details');
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        p.setSelection(entries.map((x) => x.path));
      } else if (e.key === '/' && !typing) {
        e.preventDefault();
        setShowFilter(true);
        setTimeout(() => filterRef.current?.focus(), 0);
      } else if (e.key === 'Backspace' && !typing) {
        e.preventDefault();
        p.go(fs.resolve('..', p.cwd));
      } else if (e.key === 'Delete' && p.selection.length) {
        e.preventDefault();
        remove(entries.filter((x) => p.selection.includes(x.path)));
      } else if (e.key === 'F2' && p.selection.length === 1) {
        e.preventDefault();
        setEditingPath(p.selection[0]);
      } else if (e.key === 'Enter' && p.selection.length === 1 && !editingPath) {
        e.preventDefault();
        const sel = entries.find((x) => x.path === p.selection[0]);
        if (sel) openEntry(p, sel);
      } else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !typing) {
        e.preventDefault();
        if (!entries.length) return;
        const cur = entries.findIndex((x) => x.path === p.selection[p.selection.length - 1]);
        const perRow = p.view === 'icons' ? Math.max(1, Math.floor((el.clientWidth - 220) / (p.zoom + 24))) : 1;
        const step = e.key === 'ArrowDown' ? perRow : e.key === 'ArrowUp' ? -perRow : e.key === 'ArrowRight' ? 1 : -1;
        const next = Math.max(0, Math.min(entries.length - 1, (cur < 0 ? 0 : cur) + step));
        p.setSelection([entries[next].path]);
        p.setAnchor(entries[next].path);
      }
    };
    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  });

  const [showPlaces, setShowPlaces] = useState(true);
  const [showFilter, setShowFilter] = useState(false);
  const [locEditing, setLocEditing] = useState(false);
  const filterRef = useRef<HTMLInputElement>(null);

  const leftEntries = useVisibleEntries(fs, left, fsVersion);
  const rightEntries = useVisibleEntries(fs, right, fsVersion);

  /* close context menu on outside click / Esc */
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(null);
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', onEsc);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', onEsc);
    };
  }, [menu]);

  const totalItems = (activePane === 0 ? leftEntries : rightEntries).length;
  const selCount = active.selection.length;

  return (
    <div className="kos-dolphin" ref={rootRef} tabIndex={0} onMouseDown={() => rootRef.current?.focus()}>
      <Toolbar
        pane={active}
        split={split}
        onSplit={() => setSplit((s) => !s)}
        showInfo={showInfo}
        onInfo={() => setShowInfo((s) => !s)}
        showTerm={showTerm}
        onTerm={() => setShowTerm((s) => !s)}
        showFilter={showFilter}
        onFilter={() => {
          setShowFilter((s) => !s);
          setTimeout(() => filterRef.current?.focus(), 0);
        }}
        filterRef={filterRef}
        locEditing={locEditing}
        setLocEditing={setLocEditing}
      />
      <div className="kos-dolphin-body">
        {showPlaces && (
          <PlacesBar
            cwd={active.cwd}
            onGo={(p) => {
              active.go(p);
              setActivePane(activePane);
            }}
            onLaunch={(id) => launch(id)}
          />
        )}
        <div className="kos-dolphin-panes">
          <PaneView
            index={0}
            pane={left}
            entries={leftEntries}
            active={activePane === 0 && split}
            split={split}
            onActivate={() => setActivePane(0)}
            onOpen={(e) => openEntry(left, e)}
            onMenu={(m) => setMenu(m)}
            editingPath={editingPath}
            onRename={rename}
            onCancelEdit={() => setEditingPath(null)}
          />
          {split && (
            <PaneView
              index={1}
              pane={right}
              entries={rightEntries}
              active={activePane === 1}
              split={split}
              onActivate={() => setActivePane(1)}
              onOpen={(e) => openEntry(right, e)}
              onMenu={(m) => setMenu(m)}
              editingPath={editingPath}
              onRename={rename}
              onCancelEdit={() => setEditingPath(null)}
            />
          )}
        </div>
        {showInfo && (
          <div className="kos-dolphin-infowrap">
            <InfoPanel cwd={active.cwd} selection={active.selection} fsVersion={fsVersion} />
          </div>
        )}
      </div>
      {showTerm && (
        <div className="kos-dolphin-termwrap">
          <div className="kos-dolphin-panel-head">
            <span>Terminal — {active.cwd}</span>
            <button className="kos-dolphin-x" aria-label="close terminal panel" onClick={() => setShowTerm(false)}>
              ×
            </button>
          </div>
          <TerminalPanel cwd={active.cwd} onCwd={(p) => active.go(p)} />
        </div>
      )}
      <StatusBar items={totalItems} selected={selCount} pane={active} />

      {menu && (
        <ContextMenu
          menu={menu}
          onClose={() => setMenu(null)}
          onOpen={(e) => openEntry(activePane === 0 ? left : right, e)}
          onOpenWith={(e) => launch('editor', { path: e.path })}
          onTerminalHere={(path) => launch('terminal', { cwd: path })}
          onNewFolder={(pane) => createNode(pane === 0 ? left : right, 'dir')}
          onNewText={(pane) => createNode(pane === 0 ? left : right, 'file', '.txt')}
          onNewMarkdown={(pane) => createNode(pane === 0 ? left : right, 'file', '.md')}
          onRename={(e) => setEditingPath(e.path)}
          onDelete={(e) => remove([e])}
          onCopyPath={(path) => {
            void navigator.clipboard?.writeText(path).catch(() => {});
            toast(`Copied ${path}`);
          }}
          onProperties={() => setShowInfo(true)}
          panes={{ left, right }}
        />
      )}
    </div>
  );
}

/* ───────────────────────── toolbar ───────────────────────── */

function Toolbar({
  pane,
  split,
  onSplit,
  showInfo,
  onInfo,
  showTerm,
  onTerm,
  showFilter,
  onFilter,
  filterRef,
  locEditing,
  setLocEditing,
}: {
  pane: Pane;
  split: boolean;
  onSplit: () => void;
  showInfo: boolean;
  onInfo: () => void;
  showTerm: boolean;
  onTerm: () => void;
  showFilter: boolean;
  onFilter: () => void;
  filterRef: React.RefObject<HTMLInputElement | null>;
  locEditing: boolean;
  setLocEditing: (v: boolean) => void;
}) {
  const fs = useOS((s) => s.fs);
  const [locValue, setLocValue] = useState(pane.cwd);
  useEffect(() => setLocValue(pane.cwd), [pane.cwd]);

  const crumbs = pane.cwd === '/' ? [] : pane.cwd.split('/').filter(Boolean);

  const commitLoc = () => {
    const resolved = fs.resolve(locValue, pane.cwd);
    if (fs.isDir(resolved)) pane.go(resolved);
    else toast.error(`No such folder: ${locValue}`);
    setLocEditing(false);
  };

  return (
    <div className="kos-dolphin-toolbar">
      <div className="kos-dolphin-nav">
        <TBtn label="Back" disabled={!pane.canBack} onClick={pane.back} path="M10 3L4 8l6 5" />
        <TBtn label="Forward" disabled={!pane.canForward} onClick={pane.forward} path="M6 3l6 5-6 5" />
        <TBtn label="Up" onClick={() => pane.go(fs.resolve('..', pane.cwd))} path="M8 4l5 5H3z" />
      </div>
      {locEditing ? (
        <input
          className="kos-dolphin-locedit"
          autoFocus
          value={locValue}
          spellCheck={false}
          onChange={(e) => setLocValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitLoc();
            else if (e.key === 'Escape') {
              setLocValue(pane.cwd);
              setLocEditing(false);
            }
          }}
          onBlur={() => setLocEditing(false)}
          aria-label="location"
        />
      ) : (
        <div className="kos-dolphin-crumbs" onClick={(e) => e.currentTarget === e.target && setLocEditing(true)} title="click the empty area to type a path">
          <button className="kos-dolphin-crumb" onClick={() => pane.go('/')}>
            /
          </button>
          {crumbs.map((c, i) => (
            <button key={i} className="kos-dolphin-crumb" onClick={() => pane.go('/' + crumbs.slice(0, i + 1).join('/'))}>
              {c}
            </button>
          ))}
          <span className="kos-dolphin-crumb-fill" />
        </div>
      )}
      <div className="kos-dolphin-views">
        <ViewToggle pane={pane} />
        <TBtn label="Split view (F3)" active={split} onClick={onSplit} path="M8 2v12M3 2h10v12H3z" stroke />
        <TBtn label="Terminal panel (F4)" active={showTerm} onClick={onTerm} path="M3 4l4 4-4 4M8 12h5" stroke />
        <TBtn label="Information panel (F11)" active={showInfo} onClick={onInfo} path="M8 7v5M8 4.5v.5" stroke circle />
        <TBtn label="Filter (Ctrl+I)" active={showFilter} onClick={onFilter} path="M3 4h10l-4 5v4l-2 1V9z" stroke />
      </div>
      {showFilter && (
        <input
          ref={filterRef}
          className="kos-dolphin-filter"
          placeholder="Filter…"
          value={pane.filter}
          spellCheck={false}
          onChange={(e) => pane.setFilter(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && (pane.setFilter(''), (e.target as HTMLInputElement).blur())}
          aria-label="filter"
        />
      )}
    </div>
  );
}

function TBtn({
  label,
  path,
  onClick,
  disabled,
  active,
  stroke,
  circle,
}: {
  label: string;
  path: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  stroke?: boolean;
  circle?: boolean;
}) {
  return (
    <button
      className={'kos-dolphin-tbtn' + (active ? ' active' : '')}
      disabled={disabled}
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
    >
      <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden>
        {circle && <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.3" />}
        <path d={path} fill={stroke ? 'none' : 'currentColor'} stroke={stroke ? 'currentColor' : 'none'} strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    </button>
  );
}

function ViewToggle({ pane }: { pane: Pane }) {
  const modes: { k: Pane['view']; label: string; path: string }[] = [
    { k: 'icons', label: 'Icons (Ctrl+1)', path: 'M3 3h4v4H3zM9 3h4v4H9zM3 9h4v4H3zM9 9h4v4H9z' },
    { k: 'compact', label: 'Compact (Ctrl+2)', path: 'M3 4h4M3 8h4M3 12h4M9 4h4M9 8h4M9 12h4' },
    { k: 'details', label: 'Details (Ctrl+3)', path: 'M3 4h10M3 8h10M3 12h10' },
  ];
  return (
    <div className="kos-dolphin-viewtoggle" role="group" aria-label="view mode">
      {modes.map((m) => (
        <button
          key={m.k}
          className={'kos-dolphin-tbtn' + (pane.view === m.k ? ' active' : '')}
          onClick={() => pane.setView(m.k)}
          title={m.label}
          aria-label={m.label}
          aria-pressed={pane.view === m.k}
        >
          <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden>
            <path d={m.path} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>
      ))}
    </div>
  );
}

/* ───────────────────────── places ───────────────────────── */

function PlacesBar({ cwd, onGo, onLaunch }: { cwd: string; onGo: (p: string) => void; onLaunch: (id: string) => void }) {
  const groups: Place['group'][] = ['Places', 'Devices', 'Recent'];
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  return (
    <nav className="kos-dolphin-places" aria-label="places">
      {groups.map((g) => {
        const items = PLACES.filter((p) => p.group === g);
        const isCol = collapsed[g];
        return (
          <div key={g} className="kos-dolphin-placegroup">
            <button className="kos-dolphin-placehdr" onClick={() => setCollapsed((c) => ({ ...c, [g]: !c[g] }))}>
              <span className="kos-dolphin-caret">{isCol ? '▸' : '▾'}</span> {g}
            </button>
            {!isCol &&
              items.map((p) => (
                <button
                  key={p.label}
                  className={'kos-dolphin-place' + (!p.launch && p.path === cwd ? ' active' : '')}
                  title={p.launch ? 'Open the psql app' : p.label === 'Linux VM share (9p)' ? 'Virtual folder shared by the Linux VM app' : p.path}
                  onClick={() => (p.launch ? onLaunch(p.launch) : onGo(p.path))}
                >
                  <PlaceIcon place={p} />
                  <span>{p.label}</span>
                </button>
              ))}
          </div>
        );
      })}
      <div className="kos-dolphin-free">Free space: 7.3 GiB / 20 GiB</div>
    </nav>
  );
}

function PlaceIcon({ place }: { place: Place }) {
  if (place.launch)
    return (
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden className="kos-dolphin-placeicon">
        <ellipse cx="8" cy="4" rx="5" ry="2" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <path d="M3 4v8c0 1.1 2.2 2 5 2s5-.9 5-2V4" fill="none" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    );
  if (place.group === 'Devices')
    return (
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden className="kos-dolphin-placeicon">
        <rect x="2" y="4" width="12" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="11.5" cy="8" r="0.9" fill="currentColor" />
      </svg>
    );
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden className="kos-dolphin-placeicon">
      <path d="M2 7l6-5 6 5v6a1 1 0 0 1-1 1h-3V9H6v5H3a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

/* ───────────────────────── pane ───────────────────────── */

function PaneView({
  index,
  pane,
  entries,
  active,
  split,
  onActivate,
  onOpen,
  onMenu,
  editingPath,
  onRename,
  onCancelEdit,
}: {
  index: 0 | 1;
  pane: Pane;
  entries: Entry[];
  active: boolean;
  split: boolean;
  onActivate: () => void;
  onOpen: (e: Entry) => void;
  onMenu: (m: Menu) => void;
  editingPath: string | null;
  onRename: (path: string, name: string) => void;
  onCancelEdit: () => void;
}) {
  const click = (e: React.MouseEvent, entry: Entry) => {
    onActivate();
    if (e.metaKey || e.ctrlKey) {
      pane.setSelection(pane.selection.includes(entry.path) ? pane.selection.filter((p) => p !== entry.path) : [...pane.selection, entry.path]);
      pane.setAnchor(entry.path);
    } else if (e.shiftKey && pane.anchor) {
      const a = entries.findIndex((x) => x.path === pane.anchor);
      const b = entries.findIndex((x) => x.path === entry.path);
      if (a >= 0 && b >= 0) {
        const [lo, hi] = a < b ? [a, b] : [b, a];
        pane.setSelection(entries.slice(lo, hi + 1).map((x) => x.path));
      }
    } else {
      pane.setSelection([entry.path]);
      pane.setAnchor(entry.path);
    }
  };

  return (
    <div
      className={'kos-dolphin-pane' + (active ? ' active' : '') + (split ? ' split' : '')}
      onMouseDown={onActivate}
      onContextMenu={(e) => {
        // item cells stop propagation and open their own menu; reaching here means empty space
        e.preventDefault();
        onActivate();
        pane.setSelection([]);
        onMenu({ x: e.clientX, y: e.clientY, kind: 'empty', pane: index });
      }}
    >
      {pane.view === 'details' ? (
        <DetailsView
          entries={entries}
          pane={pane}
          editingPath={editingPath}
          onClick={click}
          onOpen={onOpen}
          onRename={onRename}
          onCancelEdit={onCancelEdit}
          onItemMenu={(ev, entry) => {
            ev.preventDefault();
            ev.stopPropagation();
            onActivate();
            if (!pane.selection.includes(entry.path)) pane.setSelection([entry.path]);
            onMenu({ x: ev.clientX, y: ev.clientY, kind: 'item', entry, pane: index });
          }}
        />
      ) : (
        <div className={pane.view === 'compact' ? 'kos-dolphin-compact' : 'kos-dolphin-icons'} style={pane.view === 'icons' ? { ['--kos-icon' as string]: pane.zoom + 'px' } : undefined}>
          {entries.length === 0 && <div className="kos-dolphin-empty">This folder is empty</div>}
          {entries.map((e) => (
            <ItemCell
              key={e.path}
              entry={e}
              view={pane.view}
              selected={pane.selection.includes(e.path)}
              editing={editingPath === e.path}
              zoom={pane.zoom}
              onClick={(ev) => click(ev, e)}
              onOpen={() => onOpen(e)}
              onRename={(name) => onRename(e.path, name)}
              onCancelEdit={onCancelEdit}
              onMenu={(ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                onActivate();
                if (!pane.selection.includes(e.path)) pane.setSelection([e.path]);
                onMenu({ x: ev.clientX, y: ev.clientY, kind: 'item', entry: e, pane: index });
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RenameInput({ name, onRename, onCancel }: { name: string; onRename: (v: string) => void; onCancel: () => void }) {
  const [v, setV] = useState(name);
  const ref = useRef<HTMLInputElement>(null);
  // ignore a spurious blur fired while the menu that spawned us is still unmounting
  const ready = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    const dot = name.lastIndexOf('.');
    el.setSelectionRange(0, dot > 0 ? dot : name.length);
    const t = setTimeout(() => (ready.current = true), 180);
    return () => clearTimeout(t);
  }, [name]);
  return (
    <input
      ref={ref}
      className="kos-dolphin-rename"
      value={v}
      spellCheck={false}
      onChange={(e) => setV(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onRename(v);
        else if (e.key === 'Escape') onCancel();
        e.stopPropagation();
      }}
      onBlur={() => {
        if (ready.current) onRename(v);
        else ref.current?.focus();
      }}
      aria-label="rename"
    />
  );
}

function ItemCell({
  entry,
  view,
  selected,
  editing,
  zoom,
  onClick,
  onOpen,
  onRename,
  onCancelEdit,
  onMenu,
}: {
  entry: Entry;
  view: Pane['view'];
  selected: boolean;
  editing: boolean;
  zoom: number;
  onClick: (e: React.MouseEvent) => void;
  onOpen: () => void;
  onRename: (name: string) => void;
  onCancelEdit: () => void;
  onMenu: (e: React.MouseEvent) => void;
}) {
  const iconSize = view === 'compact' ? 18 : Math.round(zoom * 0.72);
  return (
    <button
      className={'kos-dolphin-item ' + view + (selected ? ' selected' : '')}
      onClick={onClick}
      onDoubleClick={onOpen}
      onContextMenu={onMenu}
      title={entry.name}
    >
      <span className="kos-dolphin-ico">
        <FileIcon name={entry.name} isDir={entry.isDir} size={iconSize} />
      </span>
      {editing ? <RenameInput name={entry.name} onRename={onRename} onCancel={onCancelEdit} /> : <span className="kos-dolphin-label">{entry.name}</span>}
    </button>
  );
}

function DetailsView({
  entries,
  pane,
  editingPath,
  onClick,
  onOpen,
  onRename,
  onCancelEdit,
  onItemMenu,
}: {
  entries: Entry[];
  pane: Pane;
  editingPath: string | null;
  onClick: (e: React.MouseEvent, entry: Entry) => void;
  onOpen: (e: Entry) => void;
  onRename: (path: string, name: string) => void;
  onCancelEdit: () => void;
  onItemMenu: (e: React.MouseEvent, entry: Entry) => void;
}) {
  const header = (key: SortKey, label: string) => (
    <th onClick={() => pane.sortBy(key)} className={pane.sort.key === key ? 'sorted' : ''}>
      {label}
      {pane.sort.key === key && <span className="kos-dolphin-sortarrow">{pane.sort.asc ? ' ▲' : ' ▼'}</span>}
    </th>
  );
  return (
    <table className="kos-dolphin-details">
      <thead>
        <tr>
          {header('name', 'Name')}
          {header('size', 'Size')}
          {header('modified', 'Modified')}
          {header('type', 'Type')}
        </tr>
      </thead>
      <tbody>
        {entries.length === 0 && (
          <tr>
            <td colSpan={4} className="kos-dolphin-empty">
              This folder is empty
            </td>
          </tr>
        )}
        {entries.map((e) => (
          <tr
            key={e.path}
            className={pane.selection.includes(e.path) ? 'selected' : ''}
            onClick={(ev) => onClick(ev, e)}
            onDoubleClick={() => onOpen(e)}
            onContextMenu={(ev) => onItemMenu(ev, e)}
          >
            <td className="kos-dolphin-dname">
              <span className="kos-dolphin-ico">
                <FileIcon name={e.name} isDir={e.isDir} size={18} />
              </span>
              {editingPath === e.path ? <RenameInput name={e.name} onRename={(n) => onRename(e.path, n)} onCancel={onCancelEdit} /> : e.name}
            </td>
            <td className="kos-dolphin-num">{sizeText(e)}</td>
            <td>{modifiedText(e.mtime)}</td>
            <td>{e.isDir ? 'Folder' : (/\.[^.]+$/.exec(e.name)?.[0]?.slice(1).toUpperCase() ?? '') + ' file'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ───────────────────────── context menu ───────────────────────── */

function ContextMenu({
  menu,
  onClose,
  onOpen,
  onOpenWith,
  onTerminalHere,
  onNewFolder,
  onNewText,
  onNewMarkdown,
  onRename,
  onDelete,
  onCopyPath,
  onProperties,
  panes,
}: {
  menu: NonNullable<Menu>;
  onClose: () => void;
  onOpen: (e: Entry) => void;
  onOpenWith: (e: Entry) => void;
  onTerminalHere: (path: string) => void;
  onNewFolder: (pane: 0 | 1) => void;
  onNewText: (pane: 0 | 1) => void;
  onNewMarkdown: (pane: 0 | 1) => void;
  onRename: (e: Entry) => void;
  onDelete: (e: Entry) => void;
  onCopyPath: (path: string) => void;
  onProperties: () => void;
  panes: { left: Pane; right: Pane };
}) {
  const cwd = menu.pane === 0 ? panes.left.cwd : panes.right.cwd;
  const item = (label: string, fn: () => void, danger?: boolean) => (
    <button
      className={'kos-dolphin-mi' + (danger ? ' danger' : '')}
      onMouseDown={(e) => {
        e.stopPropagation();
        fn();
        onClose();
      }}
    >
      {label}
    </button>
  );
  const style: React.CSSProperties = { left: Math.min(menu.x, window.innerWidth - 220), top: Math.min(menu.y, window.innerHeight - 320) };
  return (
    <div className="kos-dolphin-menu" style={style} onMouseDown={(e) => e.stopPropagation()} role="menu">
      {menu.kind === 'item' ? (
        <>
          {item(menu.entry.isDir ? 'Open' : 'Open', () => onOpen(menu.entry))}
          {!menu.entry.isDir && item('Open with Text Editor', () => onOpenWith(menu.entry))}
          {menu.entry.isDir && item('Open Terminal Here', () => onTerminalHere(menu.entry.path))}
          <div className="kos-dolphin-sep" />
          {item('Rename', () => onRename(menu.entry))}
          {item('Copy path', () => onCopyPath(menu.entry.path))}
          {item('Delete', () => onDelete(menu.entry), true)}
          <div className="kos-dolphin-sep" />
          {item('Properties', onProperties)}
        </>
      ) : (
        <>
          {item('Open Terminal Here', () => onTerminalHere(cwd))}
          <div className="kos-dolphin-sep" />
          <div className="kos-dolphin-mi-label">Create New</div>
          {item('Folder', () => onNewFolder(menu.pane))}
          {item('Text File', () => onNewText(menu.pane))}
          {item('Markdown File', () => onNewMarkdown(menu.pane))}
          <div className="kos-dolphin-sep" />
          {item('Copy path', () => onCopyPath(cwd))}
          {item('Properties', onProperties)}
        </>
      )}
    </div>
  );
}

/* ───────────────────────── status bar ───────────────────────── */

function StatusBar({ items, selected, pane }: { items: number; selected: number; pane: Pane }) {
  return (
    <div className="kos-dolphin-status">
      <span>
        {items} item{items === 1 ? '' : 's'}
        {selected > 0 ? ` (${selected} selected)` : ''} · free space 7.3 GiB
      </span>
      {pane.view === 'icons' && (
        <label className="kos-dolphin-zoom" title="icon size">
          <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden>
            <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
            <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <input
            type="range"
            min={40}
            max={128}
            step={8}
            value={pane.zoom}
            onChange={(e) => pane.setZoom(Number(e.target.value))}
            aria-label="icon size"
          />
        </label>
      )}
    </div>
  );
}

export const fileManagerApp: AppDefinition = {
  id: 'files',
  title: 'Dolphin',
  icon: '📁',
  category: 'System',
  component: FileManagerApp,
  description: 'Dolphin file manager',
  defaultSize: { width: 860, height: 560 },
  minSize: { width: 420, height: 300 },
  desktop: true,
  launchCommands: ['thunar', 'files', 'nautilus', 'dolphin'],
};

export default FileManagerApp;
