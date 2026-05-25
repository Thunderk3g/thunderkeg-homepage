"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CodeMirror, { type Extension } from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { javascript } from "@codemirror/lang-javascript";
import {
  FileCode,
  FileJson,
  FileText,
  FileType2,
  X as CloseIcon,
} from "lucide-react";
import { type EditorFile, type EditorLang, useFakeFs } from "./fs";

// ─────────────────────────────────────────────────────────────────────────────
// Constants

const DEFAULT_OPEN_ID = "~/README.md";

// ─────────────────────────────────────────────────────────────────────────────
// Tab + sidebar state

interface TabState {
  openIds: string[];
  activeId: string | null;
}

function closeTab(state: TabState, id: string): TabState {
  const remaining = state.openIds.filter((x) => x !== id);
  let nextActive = state.activeId;
  if (state.activeId === id) {
    nextActive = remaining.length > 0 ? remaining[remaining.length - 1]! : null;
  }
  return { openIds: remaining, activeId: nextActive };
}

function openTab(state: TabState, id: string): TabState {
  if (state.openIds.includes(id)) {
    return { openIds: state.openIds, activeId: id };
  }
  return { openIds: [...state.openIds, id], activeId: id };
}

// ─────────────────────────────────────────────────────────────────────────────
// Icons & language

function iconFor(lang: EditorLang) {
  switch (lang) {
    case "json":
      return FileJson;
    case "md":
      return FileText;
    case "ts":
      return FileCode;
    case "text":
    default:
      return FileType2;
  }
}

function extensionsFor(lang: EditorLang): Extension[] {
  switch (lang) {
    case "json":
      return [json()];
    case "md":
      return [markdown()];
    case "ts":
      return [javascript({ jsx: true, typescript: true })];
    case "text":
    default:
      return [];
  }
}

function mimeFor(lang: EditorLang): string {
  switch (lang) {
    case "json":
      return "application/json";
    case "md":
      return "text/markdown";
    case "ts":
      return "text/typescript";
    case "text":
    default:
      return "text/plain";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Download helper

function downloadFile(name: string, lang: EditorLang, content: string): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: mimeFor(lang) });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar

function Sidebar({
  files,
  order,
  activeId,
  onOpen,
}: {
  files: Record<string, EditorFile>;
  order: string[];
  activeId: string | null;
  onOpen: (id: string) => void;
}) {
  // Group entries: top-level vs ~/projects/*.
  const top: EditorFile[] = [];
  const projects: EditorFile[] = [];
  for (const id of order) {
    const f = files[id];
    if (!f) continue;
    if (id.startsWith("~/projects/")) projects.push(f);
    else top.push(f);
  }

  return (
    <aside
      aria-label="File explorer"
      className="flex w-[200px] shrink-0 flex-col gap-1 overflow-y-auto border-r border-border bg-elevated p-2 font-sans text-sm"
    >
      <div className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
        Explorer
      </div>
      <ul className="flex flex-col">
        {top.map((f) => (
          <FileRow key={f.id} file={f} active={f.id === activeId} onOpen={onOpen} />
        ))}
      </ul>

      {projects.length > 0 && (
        <>
          <div className="mt-3 px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
            projects/
          </div>
          <ul className="flex flex-col">
            {projects.map((f) => (
              <FileRow
                key={f.id}
                file={f}
                active={f.id === activeId}
                onOpen={onOpen}
                indent
              />
            ))}
          </ul>
        </>
      )}
    </aside>
  );
}

function FileRow({
  file,
  active,
  onOpen,
  indent = false,
}: {
  file: EditorFile;
  active: boolean;
  onOpen: (id: string) => void;
  indent?: boolean;
}) {
  const Icon = iconFor(file.lang);
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(file.id)}
        className={[
          "flex w-full items-center gap-2 rounded-sm px-2 py-1 text-left transition-colors duration-100",
          indent ? "pl-5" : "",
          active
            ? "bg-elevated text-accent ring-1 ring-inset ring-accent/40"
            : "text-fg hover:bg-bg/60 hover:text-accent",
        ].join(" ")}
        title={file.id}
      >
        <Icon size={14} className="shrink-0 opacity-80" aria-hidden />
        <span className="truncate">{file.name}</span>
      </button>
    </li>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab bar

function TabBar({
  openIds,
  activeId,
  files,
  onActivate,
  onClose,
}: {
  openIds: string[];
  activeId: string | null;
  files: Record<string, EditorFile>;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Open files"
      className="flex h-9 shrink-0 items-stretch gap-px overflow-x-auto border-b border-border bg-elevated"
    >
      {openIds.length === 0 ? (
        <div className="flex items-center px-3 font-sans text-xs text-muted">
          No files open
        </div>
      ) : (
        openIds.map((id) => {
          const f = files[id];
          if (!f) return null;
          const active = id === activeId;
          const Icon = iconFor(f.lang);
          return (
            <div
              key={id}
              role="tab"
              aria-selected={active}
              className={[
                "group flex shrink-0 items-center gap-2 border-r border-border px-3 py-1.5 font-sans text-xs",
                active
                  ? "bg-surface text-accent"
                  : "bg-elevated text-muted hover:text-fg",
              ].join(" ")}
            >
              <button
                type="button"
                onClick={() => onActivate(id)}
                className="flex items-center gap-2"
                title={id}
              >
                <Icon size={12} aria-hidden />
                <span className="max-w-[160px] truncate">{f.name}</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(id);
                }}
                aria-label={`Close ${f.name}`}
                className="rounded-sm p-0.5 text-muted opacity-60 transition-opacity hover:bg-bg/60 hover:text-fg group-hover:opacity-100"
              >
                <CloseIcon size={12} aria-hidden />
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Status states

function LoadingState() {
  return (
    <div className="flex h-full items-center justify-center bg-surface">
      <div className="flex flex-col items-center gap-3 text-muted">
        <div className="h-2 w-24 animate-pulse2 rounded-sm bg-elevated" />
        <p className="font-sans text-sm">Loading workspace…</p>
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center bg-surface p-8">
      <div className="max-w-md rounded-md border border-danger/40 bg-elevated p-5 text-center">
        <p className="font-sans text-sm font-medium text-danger">
          Couldn&apos;t load workspace
        </p>
        <p className="mt-2 font-sans text-xs text-muted">{message}</p>
      </div>
    </div>
  );
}

function EmptyEditor() {
  return (
    <div className="flex h-full items-center justify-center bg-bg p-8 font-sans text-sm text-muted">
      Open a file from the sidebar to start reading.
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main app

export default function CodeEditorApp() {
  const { files, order, loading, error } = useFakeFs();

  const [tabs, setTabs] = useState<TabState>({
    openIds: [],
    activeId: null,
  });

  // Open the default file once the FS is ready and nothing is open yet.
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    if (loading || error) return;
    if (files[DEFAULT_OPEN_ID]) {
      setTabs({ openIds: [DEFAULT_OPEN_ID], activeId: DEFAULT_OPEN_ID });
      didInit.current = true;
    }
  }, [files, loading, error]);

  // If a tab points at an id that has gone away (shouldn't happen, but safe),
  // clean it up.
  useEffect(() => {
    setTabs((prev) => {
      const stillOpen = prev.openIds.filter((id) => files[id]);
      if (stillOpen.length === prev.openIds.length) return prev;
      const activeId =
        prev.activeId && files[prev.activeId]
          ? prev.activeId
          : stillOpen[stillOpen.length - 1] ?? null;
      return { openIds: stillOpen, activeId };
    });
  }, [files]);

  const handleOpen = useCallback((id: string) => {
    setTabs((prev) => openTab(prev, id));
  }, []);

  const handleClose = useCallback((id: string) => {
    setTabs((prev) => closeTab(prev, id));
  }, []);

  const handleActivate = useCallback((id: string) => {
    setTabs((prev) => ({ openIds: prev.openIds, activeId: id }));
  }, []);

  const activeFile: EditorFile | null = useMemo(() => {
    if (!tabs.activeId) return null;
    return files[tabs.activeId] ?? null;
  }, [files, tabs.activeId]);

  // Cmd/Ctrl+S → download.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isSave = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s";
      if (!isSave) return;
      if (!activeFile) return;
      e.preventDefault();
      downloadFile(activeFile.name, activeFile.lang, activeFile.content);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeFile]);

  const extensions = useMemo(
    () => (activeFile ? extensionsFor(activeFile.lang) : []),
    [activeFile],
  );

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="flex h-full w-full overflow-hidden bg-surface font-sans text-fg">
      <Sidebar
        files={files}
        order={order}
        activeId={tabs.activeId}
        onOpen={handleOpen}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <TabBar
          openIds={tabs.openIds}
          activeId={tabs.activeId}
          files={files}
          onActivate={handleActivate}
          onClose={handleClose}
        />

        <div className="relative min-h-0 flex-1 bg-bg">
          {activeFile ? (
            <div className="absolute inset-0 overflow-auto">
              <CodeMirror
                key={activeFile.id}
                value={activeFile.content}
                theme="dark"
                height="100%"
                readOnly
                editable={false}
                basicSetup={{
                  lineNumbers: true,
                  foldGutter: true,
                  highlightActiveLine: false,
                  highlightActiveLineGutter: false,
                  autocompletion: false,
                }}
                extensions={extensions}
                className="h-full font-mono text-[13px]"
              />
            </div>
          ) : (
            <EmptyEditor />
          )}
        </div>

        <footer className="flex h-7 shrink-0 items-center justify-between border-t border-border bg-elevated px-3 font-sans text-[11px] text-muted">
          <span className="truncate">
            {activeFile ? activeFile.id : "Read-only sandbox"}
          </span>
          <span className="shrink-0">
            Read-only sandbox — Cmd+S to download instead.
          </span>
        </footer>
      </div>
    </div>
  );
}
