'use client';

import { useState } from 'react';
import type { AppDefinition, AppProps } from '../../types';
import { useOS } from '../../store';

const PLACES = [
  { label: 'Home', path: '/home/kali', icon: '🏠' },
  { label: 'Desktop', path: '/home/kali/Desktop', icon: '🖥' },
  { label: 'Documents', path: '/home/kali/Documents', icon: '📄' },
  { label: 'Downloads', path: '/home/kali/Downloads', icon: '📥' },
  { label: 'Pictures', path: '/home/kali/Pictures', icon: '🖼' },
  { label: 'File System', path: '/', icon: '💽' },
];

function FileManagerApp({ args }: AppProps) {
  const fs = useOS((s) => s.fs);
  const launch = useOS((s) => s.launch);
  const [cwd, setCwd] = useState<string>(
    typeof args?.path === 'string' ? (args.path as string) : '/home/kali',
  );

  const entries = (fs.list(cwd) ?? []).map((name) => ({
    name,
    isDir: fs.isDir(cwd + (cwd.endsWith('/') ? '' : '/') + name),
  }));
  entries.sort((a, b) => Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name));

  const open = (name: string, isDir: boolean) => {
    const path = (cwd.endsWith('/') ? cwd : cwd + '/') + name;
    if (isDir) setCwd(path);
    else launch('editor', { path });
  };

  const up = () => setCwd(fs.resolve('..', cwd));
  const crumbs = cwd === '/' ? [''] : cwd.split('/');

  return (
    <div className="kos-fm">
      <div className="kos-fm-toolbar">
        <button className="kos-fm-btn" onClick={up} title="up">↑</button>
        <button className="kos-fm-btn" onClick={() => setCwd('/home/kali')} title="home">🏠</button>
        <div className="kos-fm-path">
          {crumbs.map((c, i) => {
            const p = '/' + crumbs.slice(1, i + 1).join('/');
            return (
              <span key={i}>
                <button className="kos-fm-crumb" onClick={() => setCwd(i === 0 ? '/' : p)}>
                  {c === '' ? '/' : c}
                </button>
                {i < crumbs.length - 1 && i > 0 ? ' / ' : ''}
              </span>
            );
          })}
        </div>
      </div>
      <div className="kos-fm-body">
        <nav className="kos-fm-side">
          <div className="kos-fm-side-label">Places</div>
          {PLACES.map((p) => (
            <button
              key={p.path}
              className={'kos-fm-place' + (p.path === cwd ? ' active' : '')}
              onClick={() => setCwd(p.path)}
            >
              <span>{p.icon}</span> {p.label}
            </button>
          ))}
        </nav>
        <div className="kos-fm-grid">
          {entries.length === 0 && <div className="kos-fm-empty">This folder is empty</div>}
          {entries.map((e) => (
            <button key={e.name} className="kos-fm-item" onDoubleClick={() => open(e.name, e.isDir)}>
              <span className="kos-fm-icon">{e.isDir ? '📁' : fileIcon(e.name)}</span>
              <span className="kos-fm-name">{e.name}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="kos-fm-status">{entries.length} items · {cwd}</div>
    </div>
  );
}

function fileIcon(name: string): string {
  if (name.endsWith('.md')) return '📝';
  if (name.endsWith('.txt')) return '📄';
  if (name.endsWith('.png') || name.endsWith('.jpg')) return '🖼';
  if (name.startsWith('.')) return '⚙';
  return '📃';
}

export const fileManagerApp: AppDefinition = {
  id: 'files',
  title: 'Files',
  icon: '📁',
  category: 'System',
  component: FileManagerApp,
  description: 'Thunar file manager',
  defaultSize: { width: 720, height: 460 },
  minSize: { width: 380, height: 260 },
  desktop: true,
  launchCommands: ['thunar', 'files', 'nautilus'],
};

export default FileManagerApp;
