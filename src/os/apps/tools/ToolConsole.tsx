'use client';

import { useEffect, useRef, useState } from 'react';

export interface ToolConsoleProps {
  banner?: string;
  prompt: string;
  /** Handle a submitted command. Return text/lines to print, or use the printer. */
  onCommand: (cmd: string, print: (text: string) => void) => void | Promise<void>;
  intro?: string;
}

/**
 * Reusable "interactive console" for simulated Kali tools (msfconsole, sqlmap…).
 * Educational simulation only — produces canned, realistic-looking output.
 */
export function ToolConsole({ banner, prompt, onCommand, intro }: ToolConsoleProps) {
  const [lines, setLines] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const history = useRef<string[]>([]);
  const hidx = useRef(-1);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const print = (text: string) => setLines((l) => [...l, text]);

  useEffect(() => {
    if (banner) print(banner);
    if (intro) print(intro);
    inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [lines]);

  const submit = async () => {
    const cmd = input;
    print(prompt + ' ' + cmd);
    setInput('');
    history.current.push(cmd);
    hidx.current = -1;
    if (cmd.trim()) await onCommand(cmd.trim(), print);
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void submit();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const h = history.current;
      if (!h.length) return;
      hidx.current = hidx.current < 0 ? h.length - 1 : Math.max(0, hidx.current - 1);
      setInput(h[hidx.current]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const h = history.current;
      if (hidx.current < 0) return;
      hidx.current++;
      if (hidx.current >= h.length) {
        hidx.current = -1;
        setInput('');
      } else setInput(h[hidx.current]);
    }
  };

  return (
    <div className="kos-tool" ref={bodyRef} onMouseDown={() => inputRef.current?.focus()}>
      <div className="kos-tool-inner">
        {lines.map((l, i) => (
          <pre key={i} className="kos-tool-line">{l}</pre>
        ))}
        <div className="kos-tool-active">
          <span className="kos-tool-prompt">{prompt}</span>
          <input
            ref={inputRef}
            className="kos-tool-input"
            value={input}
            spellCheck={false}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            aria-label="tool input"
          />
        </div>
      </div>
    </div>
  );
}
