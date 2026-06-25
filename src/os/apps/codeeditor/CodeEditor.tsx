'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CodeMirror, { type Extension } from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { javascript } from '@codemirror/lang-javascript';
import { FileCode, FileJson, FileText, FileType2, Save } from 'lucide-react';
import type { AppDefinition, AppProps } from '../../types';
import { useOS } from '../../store';

type Lang = 'ts' | 'json' | 'md' | 'text';

const DOCS_DIR = '/home/kali/Documents';
const EXTRA_FILES = ['/home/kali/about.txt', '/home/kali/README.md'];

function baseName(p: string): string {
  return p.split('/').filter(Boolean).pop() ?? p;
}

function langFor(path: string): Lang {
  const name = baseName(path).toLowerCase();
  if (name.endsWith('.json')) return 'json';
  if (name.endsWith('.md') || name.endsWith('.markdown')) return 'md';
  if (
    name.endsWith('.ts') ||
    name.endsWith('.tsx') ||
    name.endsWith('.js') ||
    name.endsWith('.jsx') ||
    name.endsWith('.mjs')
  ) {
    return 'ts';
  }
  return 'text';
}

function extensionsFor(lang: Lang): Extension[] {
  switch (lang) {
    case 'json':
      return [json()];
    case 'md':
      return [markdown()];
    case 'ts':
      return [javascript({ jsx: true, typescript: true })];
    case 'text':
    default:
      return [];
  }
}

function IconFor({ lang }: { lang: Lang }) {
  const size = 14;
  const style = { flexShrink: 0, opacity: 0.85 } as const;
  if (lang === 'json') return <FileJson size={size} style={style} aria-hidden />;
  if (lang === 'md') return <FileText size={size} style={style} aria-hidden />;
  if (lang === 'ts') return <FileCode size={size} style={style} aria-hidden />;
  return <FileType2 size={size} style={style} aria-hidden />;
}

const C = {
  bg: '#0b0f14',
  surface: '#11161d',
  panel: '#0e131a',
  border: '#1e2733',
  fg: '#cdd6e4',
  muted: '#7b8a9e',
  accent: '#33aaff',
  ok: '#3ddc84',
};

function CodeEditor({ windowId, args }: AppProps) {
  const fs = useOS((s) => s.fs);
  const setTitle = useOS((s) => s.setTitle);

  const initialPath = typeof args?.path === 'string' ? (args.path as string) : null;

  const files = useMemo<string[]>(() => {
    const docs = (fs.list(DOCS_DIR) ?? [])
      .map((name) => `${DOCS_DIR}/${name}`)
      .filter((p) => !fs.isDir(p));
    const seen = new Set<string>();
    const all: string[] = [];
    for (const p of [...EXTRA_FILES, ...docs]) {
      if (fs.exists(p) && !fs.isDir(p) && !seen.has(p)) {
        seen.add(p);
        all.push(p);
      }
    }
    if (initialPath && fs.exists(initialPath) && !seen.has(initialPath)) {
      all.unshift(initialPath);
    }
    return all;
  }, [fs, initialPath]);

  const [activePath, setActivePath] = useState<string | null>(null);
  const [content, setContent] = useState<string>('');
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadInto = useCallback(
    (path: string) => {
      const data = fs.read(path);
      setActivePath(path);
      setContent(data ?? '');
      setDirty(false);
      setTitle(windowId, `${baseName(path)} — Code`);
    },
    [fs, setTitle, windowId],
  );

  const initialised = useRef(false);
  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;
    const first = initialPath && fs.exists(initialPath) ? initialPath : files[0] ?? null;
    if (first) loadInto(first);
    else setTitle(windowId, 'Code');
  }, [fs, files, initialPath, loadInto, setTitle, windowId]);

  useEffect(() => {
    return () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, []);

  const lang = useMemo<Lang>(() => (activePath ? langFor(activePath) : 'text'), [activePath]);
  const extensions = useMemo(() => extensionsFor(lang), [lang]);

  const handleSave = useCallback(() => {
    if (!activePath) return;
    fs.write(activePath, content);
    setDirty(false);
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 1600);
  }, [activePath, content, fs]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
      }
    },
    [handleSave],
  );

  return (
    <div
      onKeyDown={onKeyDown}
      style={{
        display: 'flex',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        background: C.surface,
        color: C.fg,
        fontFamily: 'system-ui, sans-serif',
        fontSize: 13,
      }}
    >
      <aside
        aria-label="File explorer"
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: 196,
          flexShrink: 0,
          overflowY: 'auto',
          borderRight: `1px solid ${C.border}`,
          background: C.panel,
          padding: 8,
          gap: 2,
        }}
      >
        <div
          style={{
            padding: '4px 6px',
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: C.muted,
          }}
        >
          Explorer
        </div>
        {files.map((path) => {
          const active = path === activePath;
          return (
            <button
              key={path}
              type="button"
              title={path}
              onClick={() => loadInto(path)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                textAlign: 'left',
                padding: '5px 8px',
                borderRadius: 4,
                border: active ? `1px solid ${C.accent}55` : '1px solid transparent',
                background: active ? '#16202c' : 'transparent',
                color: active ? C.accent : C.fg,
                cursor: 'pointer',
                font: 'inherit',
              }}
            >
              <IconFor lang={langFor(path)} />
              <span
                style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {baseName(path)}
              </span>
            </button>
          );
        })}
      </aside>

      <div style={{ display: 'flex', minWidth: 0, flex: 1, flexDirection: 'column' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            height: 38,
            flexShrink: 0,
            padding: '0 10px',
            borderBottom: `1px solid ${C.border}`,
            background: C.panel,
          }}
        >
          <button
            type="button"
            onClick={handleSave}
            disabled={!activePath}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 12px',
              borderRadius: 5,
              border: `1px solid ${C.border}`,
              background: activePath ? C.accent : '#1a222c',
              color: activePath ? '#04121f' : C.muted,
              cursor: activePath ? 'pointer' : 'default',
              fontWeight: 600,
              fontSize: 12,
            }}
          >
            <Save size={13} aria-hidden /> Save
          </button>
          <span style={{ color: C.muted, fontSize: 12, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {activePath ?? 'No file open'}
            {dirty ? ' •' : ''}
          </span>
          <span
            style={{
              marginLeft: 'auto',
              color: C.ok,
              fontSize: 12,
              opacity: saved ? 1 : 0,
              transition: 'opacity 0.2s ease',
            }}
          >
            Saved ✓
          </span>
        </div>

        <div style={{ position: 'relative', minHeight: 0, flex: 1, background: C.bg }}>
          {activePath ? (
            <div style={{ position: 'absolute', inset: 0, overflow: 'auto' }}>
              <CodeMirror
                key={activePath}
                value={content}
                theme="dark"
                height="100%"
                extensions={extensions}
                basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true }}
                onChange={(value) => {
                  setContent(value);
                  setDirty(true);
                }}
                style={{ height: '100%', fontSize: 13, fontFamily: 'ui-monospace, monospace' }}
              />
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                height: '100%',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 32,
                color: C.muted,
                fontSize: 13,
              }}
            >
              Open a file from the sidebar to start editing.
            </div>
          )}
        </div>

        <footer
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 26,
            flexShrink: 0,
            padding: '0 12px',
            borderTop: `1px solid ${C.border}`,
            background: C.panel,
            color: C.muted,
            fontSize: 11,
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {activePath ? `${lang.toUpperCase()} · ${baseName(activePath)}` : 'Ready'}
          </span>
          <span style={{ flexShrink: 0 }}>Ctrl+S to save</span>
        </footer>
      </div>
    </div>
  );
}

export const codeEditorApp: AppDefinition = {
  id: 'code-editor',
  title: 'Code',
  icon: '💻',
  category: 'Development',
  component: CodeEditor,
  description: 'A code editor with syntax highlighting',
  defaultSize: { width: 880, height: 580 },
  minSize: { width: 480, height: 320 },
  desktop: true,
  multi: true,
  launchCommands: ['code', 'codium', 'vscode'],
};

export default CodeEditor;
