"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useWindows } from "@/components/desktop/WindowManager";
import { TerminalHistory } from "./TerminalHistory";
import { TerminalPrompt, type TerminalPromptHandle } from "./TerminalPrompt";
import {
  DEFAULT_MODEL,
  useTerminalAgent,
  type AgentRole,
} from "./useTerminalAgent";
import { runShell, type ResumeShape } from "./shell";
import type { AppKind } from "@/types/window";

const MODEL_OPTIONS: Array<{ id: string; label: string }> = [
  { id: DEFAULT_MODEL, label: "openai/gpt-oss-120b" },
  { id: "llama-3.3-70b-versatile", label: "llama-3.3-70b" },
  { id: "mixtral-8x7b-32768", label: "mixtral-8x7b" },
];

const AGENT_ROLE_OPTIONS: Array<{ id: AgentRole; label: string }> = [
  { id: "recruiter", label: "Recruiter" },
  { id: "collaborator", label: "Collaborator" },
];

const SLASH_HELP_TEXT = [
  "Slash commands:",
  "  /help       Show this list",
  "  /clear      Clear the terminal",
  "  /resume     Open the Resume app",
  "  /projects   Open the Projects app",
  "  /voice      Open the Voice app",
  "  /contact    Show contact email",
  "",
  "Also try Linux commands: ls, cd, cat, pwd, whoami, neofetch, help.",
].join("\n");

/**
 * Hero app — the AI terminal. Hosts the agent hook, shell-command dispatcher,
 * slash-command dispatcher, header controls (agent role + model), the history,
 * and the prompt.
 */
export default function TerminalApp({ windowId }: { windowId?: string }) {
  const agent = useTerminalAgent();
  const { messages, isStreaming, agentRole, model, setAgentRole, setModel } =
    agent;

  const windows = useWindows();
  const promptRef = useRef<TerminalPromptHandle | null>(null);

  // Resume drives both /contact and the shell's fake filesystem.
  const [resume, setResume] = useState<ResumeShape | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/resume.json")
      .then((r) => (r.ok ? (r.json() as Promise<ResumeShape>) : null))
      .then((data) => {
        if (cancelled) return;
        if (data) setResume(data);
      })
      .catch(() => {
        /* silent — shell will render "Loading…" stubs */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Shell working directory persists across commands.
  const [cwd, setCwd] = useState("~");

  // Focus the prompt on mount.
  useEffect(() => {
    promptRef.current?.focus();
  }, []);

  const openByKind = useCallback(
    (kind: AppKind) => {
      const existing = Object.values(windows.windows).find(
        (w) => w.kind === kind,
      );
      if (existing) {
        windows.focus(existing.id);
      } else {
        windows.open(kind);
      }
    },
    [windows],
  );

  const closeSelf = useCallback(() => {
    // Best-effort: close the topmost terminal window if we know our own id,
    // else the most-recent terminal in the manager.
    const id =
      windowId ??
      Object.values(windows.windows)
        .filter((w) => w.kind === "terminal")
        .sort((a, b) => b.zIndex - a.zIndex)[0]?.id;
    if (id) windows.close(id);
  }, [windowId, windows]);

  const handleSubmit = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text) return;

      // Slash commands — client-side intercepts, never round-trip the API.
      if (text.startsWith("/")) {
        const cmd = text.split(/\s+/)[0]!.toLowerCase();
        agent.pushSystem(`${cwd}$ ${text}`);
        switch (cmd) {
          case "/help":
            agent.pushSystem(SLASH_HELP_TEXT);
            return;
          case "/clear":
            agent.clear();
            return;
          case "/resume":
            openByKind("resume");
            agent.pushSystem("Opening Resume…");
            return;
          case "/projects":
            openByKind("projects");
            agent.pushSystem("Opening Projects…");
            return;
          case "/voice":
            openByKind("voice");
            agent.pushSystem("Opening Voice…");
            return;
          case "/contact":
            agent.pushSystem(
              resume?.personal.email
                ? `Email: ${resume.personal.email}`
                : "Email not available — try the Social app for direct links.",
            );
            return;
          default:
            agent.pushSystem(
              `Unknown command: ${cmd}. Type /help for the list.`,
            );
            return;
        }
      }

      // Shell command dispatcher — tries built-ins, falls through to the AI.
      const result = runShell(text, cwd, {
        openApp: openByKind,
        exit: closeSelf,
        resume,
      });

      if (result.kind === "clear") {
        agent.clear();
        return;
      }
      if (result.kind === "output") {
        agent.pushSystem(`${cwd}$ ${text}`);
        if (result.lines.length > 0) {
          agent.pushSystem(result.lines.join("\n"));
        }
        if (result.newCwd) setCwd(result.newCwd);
        return;
      }

      // Passthrough — forward to the AI agent.
      void agent.send(text);
    },
    [agent, closeSelf, cwd, openByKind, resume],
  );

  return (
    <div className="flex h-full w-full flex-col bg-surface text-fg">
      <HeaderStrip
        cwd={cwd}
        agentRole={agentRole}
        model={model}
        onAgentRoleChange={setAgentRole}
        onModelChange={setModel}
        isStreaming={isStreaming}
      />
      <TerminalHistory messages={messages} isStreaming={isStreaming} />
      <TerminalPrompt
        ref={promptRef}
        disabled={isStreaming}
        onSubmit={handleSubmit}
        prefix={`${cwd}$`}
      />
    </div>
  );
}

interface HeaderProps {
  cwd: string;
  agentRole: AgentRole;
  model: string;
  isStreaming: boolean;
  onAgentRoleChange: (role: AgentRole) => void;
  onModelChange: (model: string) => void;
}

function HeaderStrip({
  cwd,
  agentRole,
  model,
  isStreaming,
  onAgentRoleChange,
  onModelChange,
}: HeaderProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border bg-elevated px-3 py-2 font-mono text-xs text-muted">
      <span className="text-fg">diwakar@kali</span>
      <span className="opacity-60">{cwd}</span>
      <div className="ml-auto flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5">
          <span className="select-none">agent</span>
          <select
            value={agentRole}
            onChange={(e) => onAgentRoleChange(e.target.value as AgentRole)}
            className="rounded-sm border border-border bg-surface px-1.5 py-0.5 text-fg focus:outline-none focus:ring-1 focus:ring-accent"
            aria-label="Agent role"
          >
            {AGENT_ROLE_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          <span className="select-none">model</span>
          <select
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            className="rounded-sm border border-border bg-surface px-1.5 py-0.5 text-fg focus:outline-none focus:ring-1 focus:ring-accent"
            aria-label="Model"
          >
            {MODEL_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <span
          className={`select-none rounded-sm px-1.5 py-0.5 ${
            isStreaming
              ? "bg-accent/15 text-accent"
              : "border border-border text-muted"
          }`}
          aria-live="polite"
        >
          {isStreaming ? "streaming" : "ready"}
        </span>
      </div>
    </div>
  );
}
