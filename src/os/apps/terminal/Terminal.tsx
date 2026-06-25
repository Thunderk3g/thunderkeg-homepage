'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { AppDefinition, AppProps } from '../../types';
import { useOS } from '../../store';
import { Shell } from './shell';
import { commandMap } from './commands';
import { appLaunchCommands } from '../../registry';

interface Block {
  id: number;
  prompt?: { path: string };
  text: string;
}

const WELCOME = [
  'Kali GNU/Linux Rolling — web edition',
  'Portfolio of Diwakar Adhikari · Technical Lead, AI Engineering',
  "Type 'help' for commands, 'neofetch' for system info, or 'games' to play.",
  '',
].join('\n');

function PromptLine({ path }: { path: string }) {
  return (
    <span className="kos-term-prompt">
      <span className="p-deco">┌──(</span>
      <span className="p-user">kali㉿kali</span>
      <span className="p-deco">)-[</span>
      <span className="p-path">{path}</span>
      <span className="p-deco">]</span>
      {'\n'}
      <span className="p-deco">└─</span>
      <span className="p-dollar">$</span>{' '}
    </span>
  );
}

function TerminalApp({ windowId }: AppProps) {
  const fs = useOS((s) => s.fs);
  const user = useOS((s) => s.user);
  const host = useOS((s) => s.host);
  const launch = useOS((s) => s.launch);

  const [blocks, setBlocks] = useState<Block[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const histIdx = useRef<number>(-1);
  const seq = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const mergedCommands = useMemo(() => {
    const map = new Map(commandMap);
    for (const c of appLaunchCommands) if (!map.has(c.name)) map.set(c.name, c);
    return map;
  }, []);

  const shell = useMemo(() => {
    const s = new Shell({
      fs,
      commands: mergedCommands,
      user,
      host,
      launch,
      onOutput: (text) => {
        if (text.length) push({ text });
      },
      onClear: () => setBlocks([]),
    });
    return s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const push = (b: Omit<Block, 'id'>) => setBlocks((bs) => [...bs, { ...b, id: seq.current++ }]);

  useEffect(() => {
    push({ text: WELCOME });
    void shell.run('neofetch').then(() => focusInput());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [blocks, busy]);

  const focusInput = () => inputRef.current?.focus();

  const submit = async () => {
    const line = input;
    push({ prompt: { path: shell.prompt() }, text: line });
    setInput('');
    histIdx.current = -1;
    if (line.trim()) {
      setBusy(true);
      await shell.run(line);
      setBusy(false);
    }
    setTimeout(focusInput, 0);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void submit();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const h = shell.history;
      if (h.length === 0) return;
      histIdx.current = histIdx.current < 0 ? h.length - 1 : Math.max(0, histIdx.current - 1);
      setInput(h[histIdx.current] ?? '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const h = shell.history;
      if (histIdx.current < 0) return;
      histIdx.current = histIdx.current + 1;
      if (histIdx.current >= h.length) {
        histIdx.current = -1;
        setInput('');
      } else setInput(h[histIdx.current]);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const matches = shell.completions(input);
      if (matches.length === 1) {
        const tokens = input.split(/\s+/);
        tokens[tokens.length - 1] = matches[0];
        setInput(tokens.join(' '));
      } else if (matches.length > 1) {
        push({ prompt: { path: shell.prompt() }, text: input });
        push({ text: matches.join('  ') });
      }
    } else if (e.ctrlKey && (e.key === 'l' || e.key === 'L')) {
      e.preventDefault();
      setBlocks([]);
    } else if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) {
      e.preventDefault();
      push({ prompt: { path: shell.prompt() }, text: input + '^C' });
      setInput('');
    }
  };

  return (
    <div className="kos-term" onMouseDown={focusInput} ref={bodyRef} data-window={windowId}>
      <div className="kos-term-inner">
        {blocks.map((b) => (
          <div key={b.id} className="kos-term-block">
            {b.prompt && <PromptLine path={b.prompt.path} />}
            <span className="kos-term-text">{colorize(b.text)}</span>
          </div>
        ))}
        {!busy && (
          <div className="kos-term-block kos-term-active">
            <PromptLine path={shell.prompt()} />
            <input
              ref={inputRef}
              className="kos-term-input"
              value={input}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              aria-label="terminal input"
            />
          </div>
        )}
      </div>
    </div>
  );
}

/** Tiny token colouriser: directories (trailing /) and prompt-ish bits. */
function colorize(text: string): React.ReactNode {
  if (!text.includes('/') || text.length > 4000) return text;
  return text.split('\n').map((line, i) => (
    <span key={i}>
      {line.split(/(\s+)/).map((tok, j) =>
        /^\S+\/$/.test(tok) ? (
          <span key={j} className="kos-term-dir">
            {tok}
          </span>
        ) : (
          <span key={j}>{tok}</span>
        ),
      )}
      {'\n'}
    </span>
  ));
}

export const terminalApp: AppDefinition = {
  id: 'terminal',
  title: 'Terminal',
  icon: '🖳',
  category: 'System',
  component: TerminalApp,
  description: 'qterminal — a real-feeling Kali shell',
  defaultSize: { width: 720, height: 460 },
  minSize: { width: 360, height: 220 },
  desktop: true,
  multi: true,
  launchCommands: ['xterm', 'qterminal'],
};

export default TerminalApp;
