'use client';

import { useEffect, useRef, useState } from 'react';
import type { AppDefinition, AppProps } from '../../types';
import { useOS } from '../../store';

function TextEditorApp({ windowId, args }: AppProps) {
  const fs = useOS((s) => s.fs);
  const setTitle = useOS((s) => s.setTitle);
  const path = typeof args?.path === 'string' ? (args.path as string) : null;
  const [text, setText] = useState<string>('');
  const [dirty, setDirty] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    if (path) {
      const content = fs.read(path);
      setText(content ?? '');
      setTitle(windowId, `${baseName(path)} — Mousepad`);
    } else {
      setTitle(windowId, 'untitled — Mousepad');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = () => {
    if (!path) {
      setSavedMsg('No file path (open via Files to save).');
      setTimeout(() => setSavedMsg(''), 2500);
      return;
    }
    fs.write(path, text);
    setDirty(false);
    setSavedMsg('Saved ✓');
    setTimeout(() => setSavedMsg(''), 1800);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      save();
    }
  };

  return (
    <div className="kos-editor">
      <div className="kos-editor-menu">
        <button className="kos-editor-btn" onClick={save}>Save</button>
        <span className="kos-editor-file">{path ? path : 'untitled'}{dirty ? ' *' : ''}</span>
        <span className="kos-editor-msg">{savedMsg}</span>
      </div>
      <textarea
        className="kos-editor-area"
        value={text}
        spellCheck={false}
        onChange={(e) => {
          setText(e.target.value);
          setDirty(true);
        }}
        onKeyDown={onKey}
        placeholder="Type here…  (Ctrl+S to save)"
      />
    </div>
  );
}

function baseName(p: string): string {
  return p.split('/').filter(Boolean).pop() ?? p;
}

export const textEditorApp: AppDefinition = {
  id: 'editor',
  title: 'Mousepad',
  icon: '📝',
  category: 'Accessories',
  component: TextEditorApp,
  description: 'A simple text editor',
  defaultSize: { width: 640, height: 460 },
  minSize: { width: 320, height: 220 },
  multi: true,
  launchCommands: ['mousepad', 'edit', 'nano', 'vim'],
};

export default TextEditorApp;
