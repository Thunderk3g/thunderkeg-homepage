'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useOS } from '../../store';
import { Shell } from '../terminal/shell';
import { commandMap } from '../terminal/commands';
import { appLaunchCommands } from '../../registry';

interface Line {
  id: number;
  prompt?: string;
  text: string;
}

/**
 * A compact terminal, like Dolphin's F4 panel: it mounts the same Shell class
 * as the Terminal app and shares the pane's cwd. `cwd` drives the shell; when
 * the shell's cwd changes (via `cd`), `onCwd` navigates Dolphin to match.
 */
export function TerminalPanel({ cwd, onCwd }: { cwd: string; onCwd: (path: string) => void }) {
  const fs = useOS((s) => s.fs);
  const user = useOS((s) => s.user);
  const host = useOS((s) => s.host);
  const launch = useOS((s) => s.launch);
  const bumpFs = useOS((s) => s.bumpFs);

  const [lines, setLines] = useState<Line[]>([]);
  const [input, setInput] = useState('');
  const seq = useRef(0);
  const hIdx = useRef(-1);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
      onOutput: (text) => text.length && push({ text }),
      onClear: () => setLines([]),
    });
    s.api.setCwd(cwd);
    return s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const push = (l: Omit<Line, 'id'>) => setLines((ls) => [...ls.slice(-400), { ...l, id: seq.current++ }]);

  // Dolphin navigated → follow it in the shell.
  useEffect(() => {
    if (shell.cwd !== cwd) shell.api.setCwd(cwd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cwd]);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [lines]);

  const prompt = () => `┌──(kali㉿kali)-[${shell.prompt()}]\n└─$`;

  const submit = async () => {
    const line = input;
    push({ prompt: prompt(), text: line });
    setInput('');
    hIdx.current = -1;
    if (line.trim()) {
      const before = shell.cwd;
      await shell.run(line);
      bumpFs(); // commands may have written/removed files
      if (shell.cwd !== before) onCwd(shell.cwd); // `cd` in the panel navigates Dolphin
    }
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void submit();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const h = shell.history;
      if (!h.length) return;
      hIdx.current = hIdx.current < 0 ? h.length - 1 : Math.max(0, hIdx.current - 1);
      setInput(h[hIdx.current] ?? '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const h = shell.history;
      if (hIdx.current < 0) return;
      hIdx.current++;
      if (hIdx.current >= h.length) {
        hIdx.current = -1;
        setInput('');
      } else setInput(h[hIdx.current]);
    }
  };

  return (
    <div className="kos-dolphin-term" ref={bodyRef} onMouseDown={() => inputRef.current?.focus()}>
      {lines.map((l) =>
        l.prompt !== undefined ? (
          <div key={l.id} className="kos-dolphin-term-cmd">
            <span className="kos-dolphin-term-prompt">{l.prompt} </span>
            {l.text}
          </div>
        ) : (
          <pre key={l.id} className="kos-dolphin-term-out">
            {l.text}
          </pre>
        ),
      )}
      <div className="kos-dolphin-term-live">
        <span className="kos-dolphin-term-prompt">{prompt()} </span>
        <input
          ref={inputRef}
          value={input}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          aria-label="terminal panel input"
        />
      </div>
    </div>
  );
}
