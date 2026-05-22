"use client";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

export interface TerminalPromptHandle {
  focus: () => void;
}

interface Props {
  disabled?: boolean;
  placeholder?: string;
  onSubmit: (text: string) => void;
}

/**
 * Prompt input pinned to the bottom of the terminal. Enter submits, Shift+Enter
 * inserts a newline. The textarea auto-grows up to a small cap.
 */
export const TerminalPrompt = forwardRef<TerminalPromptHandle, Props>(
  function TerminalPrompt(
    { disabled, placeholder = "Ask me anything", onSubmit },
    ref,
  ) {
    const [value, setValue] = useState("");
    const taRef = useRef<HTMLTextAreaElement | null>(null);

    useImperativeHandle(ref, () => ({
      focus: () => taRef.current?.focus(),
    }));

    // Auto-resize the textarea to fit content (capped to ~6 lines).
    useEffect(() => {
      const el = taRef.current;
      if (!el) return;
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
    }, [value]);

    const submit = useCallback(() => {
      const trimmed = value.trim();
      if (!trimmed || disabled) return;
      onSubmit(trimmed);
      setValue("");
    }, [disabled, onSubmit, value]);

    const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submit();
      }
    };

    return (
      <form
        className="flex items-end gap-2 border-t border-border bg-elevated px-3 py-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <span
          className={`select-none font-mono text-sm leading-6 ${
            disabled ? "text-muted" : "text-accent"
          }`}
          aria-hidden
        >
          [ ▸ ]
        </span>
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled}
          rows={1}
          placeholder={placeholder}
          aria-label="Terminal prompt"
          className="flex-1 resize-none bg-transparent font-mono text-sm leading-6 text-fg placeholder:text-muted focus:outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={disabled || value.trim().length === 0}
          className="rounded-sm border border-border px-2 py-1 font-mono text-xs text-muted transition-colors hover:text-fg focus:outline-none focus:ring-1 focus:ring-accent disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Send"
        >
          ⏎
        </button>
      </form>
    );
  },
);
