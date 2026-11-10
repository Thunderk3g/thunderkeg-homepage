'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CodeMirror, { EditorView, type Extension } from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { javascript } from '@codemirror/lang-javascript';
import { Columns2, Eye, FileCode, FileJson, FileText, FileType2, PanelLeft, PencilLine, Save } from 'lucide-react';
import { toast } from 'sonner';
import type { AppDefinition, AppProps } from '../../types';
import { useOS } from '../../store';
import { Markdown } from '@/content/Markdown';

/**
 * The Text Editor: one CodeMirror editor for everything (Mousepad, nano, vim
 * and `code` all open it). Markdown gets an edit / split / preview switch
 * rendered by the same renderer as /writing; Ctrl+S writes to the VFS.
 */

type Lang = 'ts' | 'json' | 'md' | 'text';
type View = 'edit' | 'split' | 'preview';

const HOME = '/home/kali';
const DOCS_DIR = `${HOME}/Documents`;
const EXTRA_FILES = [`${HOME}/README.md`, `${HOME}/about.txt`];
const APP_TITLE = 'Text Editor';

function baseName(p: string): string {
  return p.split('/').filter(Boolean).pop() ?? p;
}

function langFor(path: string): Lang {
  const name = baseName(path).toLowerCase();
  if (name.endsWith('.json')) return 'json';
  if (/\.(md|markdown)$/.test(name)) return 'md';
  if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(name)) return 'ts';
  return 'text';
}

function extensionsFor(lang: Lang): Extension[] {
  switch (lang) {
    case 'json':
      return [json()];
    case 'md':
      return [markdown(), EditorView.lineWrapping];
    case 'ts':
      return [javascript({ jsx: true, typescript: true })];
    default:
      return [EditorView.lineWrapping];
  }
}

function IconFor({ lang }: { lang: Lang }) {
  const p = { size: 14, className: 'kos-ce-file-ico', 'aria-hidden': true } as const;
  if (lang === 'json') return <FileJson {...p} />;
  if (lang === 'md') return <FileText {...p} />;
  if (lang === 'ts') return <FileCode {...p} />;
  return <FileType2 {...p} />;
}

function countWords(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

/** `args.path` (Dolphin, launchers) or `args.arg` (a bare terminal argument). */
function requestedPath(args?: Record<string, unknown>): string | null {
  if (typeof args?.path === 'string' && args.path) return args.path;
  if (typeof args?.arg === 'string' && args.arg) {
    const a = args.arg;
    return a.startsWith('/') ? a : `${HOME}/${a.replace(/^~\//, '')}`;
  }
  return null;
}

function CodeEditor({ windowId, args }: AppProps) {
  const fs = useOS((s) => s.fs);
  const fsVersion = useOS((s) => s.fsVersion);
  const bumpFs = useOS((s) => s.bumpFs);
  const setTitle = useOS((s) => s.setTitle);

  const initialPath = useMemo(() => requestedPath(args), [args]);

  const [activePath, setActivePath] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [dirty, setDirty] = useState(false);
  const [view, setView] = useState<View>('edit');
  const [sidebar, setSidebar] = useState(true);

  const files = useMemo<string[]>(() => {
    void fsVersion;
    const docs = (fs.list(DOCS_DIR) ?? []).map((name) => `${DOCS_DIR}/${name}`).filter((p) => !fs.isDir(p));
    const out: string[] = [];
    for (const p of [...(activePath ? [activePath] : []), ...EXTRA_FILES, ...docs]) {
      if (!out.includes(p) && (fs.exists(p) || p === activePath) && !fs.isDir(p)) out.push(p);
    }
    return out;
  }, [fs, fsVersion, activePath]);

  const open = useCallback(
    (path: string) => {
      const data = fs.read(path);
      setActivePath(path);
      setContent(data ?? '');
      setDirty(false);
      // Markdown opens side by side on a roomy window, as source otherwise
      setView(langFor(path) === 'md' && data ? 'split' : 'edit');
    },
    [fs],
  );

  const initialised = useRef(false);
  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;
    const first = initialPath ?? (fs.exists(`${DOCS_DIR}/resume.md`) ? `${DOCS_DIR}/resume.md` : files[0]);
    if (first) open(first);
  }, [fs, files, initialPath, open]);

  useEffect(() => {
    setTitle(windowId, activePath ? `${baseName(activePath)}${dirty ? ' •' : ''} — ${APP_TITLE}` : APP_TITLE);
  }, [activePath, dirty, setTitle, windowId]);

  const lang: Lang = activePath ? langFor(activePath) : 'text';
  const extensions = useMemo(() => extensionsFor(lang), [lang]);
  const isMd = lang === 'md';
  const shown: View = isMd ? view : 'edit';

  const save = useCallback(() => {
    if (!activePath) return;
    if (fs.write(activePath, content)) {
      setDirty(false);
      bumpFs();
      toast.success(`Saved ${baseName(activePath)}`, { description: activePath });
    } else {
      toast.error(`Could not save ${baseName(activePath)}`, { description: 'The folder does not exist.' });
    }
  }, [activePath, content, fs, bumpFs]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 's') {
        e.preventDefault();
        save();
      } else if (k === 'e' && e.shiftKey && isMd) {
        e.preventDefault();
        setView((v) => (v === 'preview' ? 'edit' : 'preview'));
      }
    },
    [save, isMd],
  );

  const words = useMemo(() => countWords(content), [content]);
  const lines = useMemo(() => (content ? content.split('\n').length : 0), [content]);

  return (
    <div className="kos-ce" onKeyDown={onKeyDown}>
      <div className="kos-ce-bar" role="toolbar" aria-label="Editor">
        <button
          type="button"
          className={'kos-ce-btn icon' + (sidebar ? ' on' : '')}
          onClick={() => setSidebar((s) => !s)}
          title="Toggle file list"
          aria-label="Toggle file list"
          aria-pressed={sidebar}
        >
          <PanelLeft size={15} aria-hidden />
        </button>
        <button type="button" className="kos-ce-btn primary" onClick={save} disabled={!activePath} title="Save (Ctrl+S)">
          <Save size={13} aria-hidden /> Save
        </button>
        <span className="kos-ce-path" title={activePath ?? undefined}>
          {activePath ? activePath.replace(HOME, '~') : 'No file open'}
          {dirty && <span className="kos-ce-dirty"> • modified</span>}
        </span>
        {isMd && (
          <div className="kos-ce-seg" role="group" aria-label="Markdown view">
            {(
              [
                ['edit', 'Edit', PencilLine],
                ['split', 'Split', Columns2],
                ['preview', 'Preview', Eye],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                className={'kos-ce-seg-btn' + (view === id ? ' on' : '')}
                aria-pressed={view === id}
                onClick={() => setView(id)}
                title={id === 'preview' ? 'Preview (Ctrl+Shift+E)' : label}
              >
                <Icon size={13} aria-hidden /> <span>{label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="kos-ce-main">
        {sidebar && (
          <aside className="kos-ce-side" aria-label="Files">
            <div className="kos-ce-side-h">Files</div>
            {files.map((path) => (
              <button
                key={path}
                type="button"
                title={path}
                className={'kos-ce-file' + (path === activePath ? ' on' : '')}
                onClick={() => path !== activePath && open(path)}
              >
                <IconFor lang={langFor(path)} />
                <span>{baseName(path)}</span>
              </button>
            ))}
          </aside>
        )}

        {activePath ? (
          <div className={'kos-ce-panes v-' + shown}>
            {shown !== 'preview' && (
              <div className="kos-ce-code">
                <CodeMirror
                  key={activePath}
                  value={content}
                  theme="dark"
                  height="100%"
                  extensions={extensions}
                  basicSetup={{ lineNumbers: true, foldGutter: !isMd, highlightActiveLine: true }}
                  onChange={(value) => {
                    setContent(value);
                    setDirty(true);
                  }}
                />
              </div>
            )}
            {shown !== 'edit' && (
              <div className="kos-ce-preview" aria-label="Markdown preview">
                {content.trim() ? <Markdown source={content} /> : <p className="kos-ce-empty">Nothing to preview yet.</p>}
              </div>
            )}
          </div>
        ) : (
          <div className="kos-ce-empty">Open a file from the list to start editing.</div>
        )}
      </div>

      <footer className="kos-ce-status">
        <span>{activePath ? (isMd ? 'Markdown' : lang === 'ts' ? 'TypeScript' : lang === 'json' ? 'JSON' : 'Plain text') : 'Ready'}</span>
        {activePath && (
          <span>
            {words.toLocaleString()} {words === 1 ? 'word' : 'words'} · {lines.toLocaleString()} lines ·{' '}
            {content.length.toLocaleString()} chars
          </span>
        )}
        <span className="kos-ce-hint">Ctrl+S save{isMd ? ' · Ctrl+Shift+E preview' : ''}</span>
      </footer>
    </div>
  );
}

export const codeEditorApp: AppDefinition = {
  id: 'code-editor',
  title: APP_TITLE,
  icon: '📝',
  category: 'Accessories',
  component: CodeEditor,
  description: 'Edit files with syntax highlighting and a Markdown preview',
  defaultSize: { width: 980, height: 620 },
  minSize: { width: 420, height: 300 },
  desktop: true,
  multi: true,
  launchCommands: ['mousepad', 'nano', 'vim', 'vi', 'edit', 'code', 'codium', 'gedit'],
};

export default CodeEditor;
