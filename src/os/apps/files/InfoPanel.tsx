'use client';

import { Markdown } from '@/content/Markdown';
import { useOS } from '../../store';
import { FileIcon, kindLabel } from './icons';
import { entriesOf, modifiedText, sizeText, type Entry } from './useFsPane';

/** Dolphin's Information panel (F11): metadata + a live preview of the selection. */
export function InfoPanel({ cwd, selection, fsVersion }: { cwd: string; selection: string[]; fsVersion: number }) {
  const fs = useOS((s) => s.fs);
  void fsVersion;
  const entries = entriesOf(fs, cwd);

  if (selection.length > 1) {
    const sel = entries.filter((e) => selection.includes(e.path));
    const bytes = sel.reduce((n, e) => n + (e.isDir ? 0 : e.size), 0);
    return (
      <div className="kos-dolphin-info">
        <div className="kos-dolphin-info-head">
          <FileIcon name="" isDir size={48} />
          <div className="kos-dolphin-info-name">{selection.length} items selected</div>
        </div>
        <dl className="kos-dolphin-meta">
          <dt>Folders</dt>
          <dd>{sel.filter((e) => e.isDir).length}</dd>
          <dt>Files</dt>
          <dd>{sel.filter((e) => !e.isDir).length}</dd>
          <dt>Total size</dt>
          <dd>{bytes} B</dd>
        </dl>
      </div>
    );
  }

  const target = selection[0] ?? cwd;
  const e: Entry =
    selection.length === 1
      ? (entries.find((x) => x.path === selection[0]) ?? folderEntry(fs, cwd))
      : folderEntry(fs, cwd);

  return (
    <div className="kos-dolphin-info">
      <div className="kos-dolphin-info-head">
        <FileIcon name={e.name} isDir={e.isDir} size={48} />
        <div className="kos-dolphin-info-name" title={e.name}>
          {e.name || '/'}
        </div>
      </div>
      <dl className="kos-dolphin-meta">
        <dt>Type</dt>
        <dd>{kindLabel(e.name, e.isDir)}</dd>
        <dt>Size</dt>
        <dd>{sizeText(e)}</dd>
        <dt>Modified</dt>
        <dd>{modifiedText(e.mtime)}</dd>
        <dt>Permissions</dt>
        <dd className="kos-dolphin-mono">{(e.isDir ? 'd' : '-') + e.mode}</dd>
        <dt>Location</dt>
        <dd className="kos-dolphin-mono" title={target}>
          {target}
        </dd>
      </dl>
      <Preview entry={e} />
    </div>
  );
}

function folderEntry(fs: ReturnType<typeof useOS.getState>['fs'], cwd: string): Entry {
  const node = fs.get(cwd);
  const size = node?.children ? Object.keys(node.children).length : 0;
  return {
    name: cwd.split('/').filter(Boolean).pop() ?? '/',
    path: cwd,
    isDir: true,
    size,
    mtime: Date.UTC(2025, 8, 20),
    mode: node?.mode ?? 'rwxr-xr-x',
  };
}

function Preview({ entry }: { entry: Entry }) {
  const fs = useOS((s) => s.fs);
  if (entry.isDir) {
    const items = fs.list(entry.path) ?? [];
    return (
      <div className="kos-dolphin-preview">
        <div className="kos-dolphin-preview-label">Contents</div>
        <div className="kos-dolphin-preview-count">
          {items.length} item{items.length === 1 ? '' : 's'}
        </div>
        <ul className="kos-dolphin-preview-list">
          {items.slice(0, 12).map((n) => (
            <li key={n}>{n}</li>
          ))}
          {items.length > 12 && <li className="kos-dolphin-dim">… {items.length - 12} more</li>}
        </ul>
      </div>
    );
  }
  const content = fs.read(entry.path) ?? '';
  const isMd = /\.(md|markdown)$/i.test(entry.name);
  return (
    <div className="kos-dolphin-preview">
      <div className="kos-dolphin-preview-label">Preview</div>
      {isMd ? (
        <div className="kos-dolphin-md md" data-testid="dolphin-md-preview">
          <Markdown source={content.slice(0, 4000)} />
        </div>
      ) : (
        <pre className="kos-dolphin-text-preview">{content.slice(0, 4000) || '(empty file)'}</pre>
      )}
    </div>
  );
}
