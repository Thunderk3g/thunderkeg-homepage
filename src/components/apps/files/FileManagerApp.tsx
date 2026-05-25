"use client";

import { useMemo, useState } from "react";
import { AppWindow, FileJson, FileText, File as FileIcon, Folder } from "lucide-react";
import { useWindows } from "@/components/desktop/WindowManager";
import { ancestorPaths, resolvePath, splitPath, type FsEntry } from "./fs";
import { useFsRoot } from "./useFsRoot";

/** Sidebar shortcuts (label + absolute home-relative path). */
const SHORTCUTS: ReadonlyArray<{ label: string; path: string }> = [
  { label: "Home",     path: "~" },
  { label: "Projects", path: "~/projects" },
  { label: "Games",    path: "~/games" },
  { label: "Media",    path: "~/media" },
];

interface ChildEntry {
  name: string;
  node: FsEntry;
}

function iconFor(name: string, node: FsEntry) {
  if (node.kind === "dir")  return Folder;
  if (node.kind === "app")  return AppWindow;
  if (name.endsWith(".json")) return FileJson;
  if (name.endsWith(".txt"))  return FileText;
  return FileIcon;
}

function typeLabel(node: FsEntry, name: string): string {
  if (node.kind === "dir") return "Folder";
  if (node.kind === "app") return "App shortcut";
  if (name.endsWith(".json")) return "JSON file";
  if (name.endsWith(".txt"))  return "Text file";
  return "File";
}

function joinPath(parent: string, name: string): string {
  return parent === "~" ? `~/${name}` : `${parent}/${name}`;
}

export default function FileManagerApp() {
  const { root, loading, error } = useFsRoot();
  const { open } = useWindows();

  const [path, setPath] = useState<string>("~");
  const [selected, setSelected] = useState<string | null>(null);

  const current = useMemo<FsEntry | null>(() => resolvePath(root, path), [root, path]);

  const children = useMemo<ChildEntry[]>(() => {
    if (!current || current.kind !== "dir") return [];
    return Object.entries(current.children)
      .map(([name, node]) => ({ name, node }))
      .sort((a, b) => {
        // Folders first, then alphabetic within group.
        const aDir = a.node.kind === "dir" ? 0 : 1;
        const bDir = b.node.kind === "dir" ? 0 : 1;
        if (aDir !== bDir) return aDir - bDir;
        return a.name.localeCompare(b.name);
      });
  }, [current]);

  const crumbs = useMemo(() => {
    return ancestorPaths(path).map((p) => {
      const segs = splitPath(p);
      const label = segs[segs.length - 1] ?? "~";
      return { path: p, label };
    });
  }, [path]);

  const selectedChild = useMemo<ChildEntry | null>(() => {
    if (!selected) return null;
    return children.find((c) => c.name === selected) ?? null;
  }, [children, selected]);

  function navigateTo(next: string): void {
    setPath(next);
    setSelected(null);
  }

  function handleActivate(entry: ChildEntry): void {
    const { name, node } = entry;
    if (node.kind === "dir") {
      navigateTo(joinPath(path, name));
      return;
    }
    if (node.kind === "app") {
      open(node.app);
      return;
    }
    if (name.endsWith(".txt")) {
      // Inline preview already visible. Just keep selection.
      setSelected(name);
      return;
    }
    // JSON / other files — placeholder until Code Editor app lands.
    if (typeof window !== "undefined") {
      window.alert("Open in Code Editor (coming soon)");
    }
  }

  // Mobile sidebar shortcut as <select>.
  function handleShortcutSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    navigateTo(e.target.value);
  }

  return (
    <div className="flex h-full flex-col bg-surface text-fg">
      {/* Mobile shortcut dropdown */}
      <div className="border-b border-border bg-elevated px-3 py-2 sm:hidden">
        <select
          value={SHORTCUTS.some((s) => s.path === path) ? path : "~"}
          onChange={handleShortcutSelect}
          className="w-full rounded-sm border border-border bg-surface px-2 py-1 font-sans text-sm text-fg"
          aria-label="Jump to folder"
        >
          {SHORTCUTS.map((s) => (
            <option key={s.path} value={s.path}>{s.label}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside
          className="hidden w-[180px] shrink-0 flex-col border-r border-border bg-elevated p-2 sm:flex"
          aria-label="Sidebar"
        >
          <h2 className="px-2 pb-2 pt-1 font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
            Places
          </h2>
          <ul className="flex flex-col gap-0.5">
            {SHORTCUTS.map((s) => {
              const active = path === s.path || path.startsWith(s.path + "/");
              return (
                <li key={s.path}>
                  <button
                    type="button"
                    onClick={() => navigateTo(s.path)}
                    className={[
                      "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left font-sans text-sm transition-colors",
                      active
                        ? "bg-surface text-accent ring-1 ring-accent/40"
                        : "text-fg hover:bg-white/5",
                    ].join(" ")}
                  >
                    <Folder size={14} className="shrink-0" aria-hidden />
                    <span className="truncate">{s.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* Main pane */}
        <main className="flex flex-1 min-w-0 flex-col">
          {/* Breadcrumb */}
          <nav
            aria-label="Breadcrumb"
            className="flex flex-wrap items-center gap-1 border-b border-border bg-elevated px-3 py-2 font-mono text-xs text-muted"
          >
            {crumbs.map((c, i) => (
              <span key={c.path} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => navigateTo(c.path)}
                  className={[
                    "rounded-sm px-1 py-0.5 transition-colors hover:bg-white/5 hover:text-fg",
                    i === crumbs.length - 1 ? "text-accent" : "",
                  ].join(" ")}
                >
                  {c.label}
                </button>
                {i < crumbs.length - 1 && <span aria-hidden>/</span>}
              </span>
            ))}
          </nav>

          {/* Grid + optional preview */}
          <div className="flex flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto p-3">
              {loading && children.length === 0 ? (
                <p className="font-sans text-sm text-muted">Loading filesystem…</p>
              ) : error ? (
                <p className="font-sans text-sm text-danger">{error}</p>
              ) : !current ? (
                <p className="font-sans text-sm text-muted">Path not found.</p>
              ) : current.kind !== "dir" ? (
                <p className="font-sans text-sm text-muted">Not a directory.</p>
              ) : children.length === 0 ? (
                <p className="font-sans text-sm text-muted">(empty)</p>
              ) : (
                <ul
                  role="grid"
                  className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2"
                >
                  {children.map((entry) => {
                    const Icon = iconFor(entry.name, entry.node);
                    const isSelected = selected === entry.name;
                    return (
                      <li key={entry.name} role="gridcell">
                        <button
                          type="button"
                          onClick={() => setSelected(entry.name)}
                          onDoubleClick={() => handleActivate(entry)}
                          className={[
                            "flex w-full flex-col items-center gap-1 rounded-sm px-2 py-3 text-center transition-colors",
                            isSelected
                              ? "bg-elevated ring-1 ring-accent"
                              : "hover:bg-white/5",
                          ].join(" ")}
                          title={typeLabel(entry.node, entry.name)}
                        >
                          <Icon
                            size={32}
                            className={isSelected ? "text-accent" : "text-fg"}
                            aria-hidden
                          />
                          <span className="line-clamp-2 break-all font-sans text-xs text-fg">
                            {entry.name}
                          </span>
                          <span className="font-sans text-[10px] uppercase tracking-wider text-muted">
                            {typeLabel(entry.node, entry.name)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Inline .txt preview */}
            {selectedChild &&
              selectedChild.node.kind === "file" &&
              selectedChild.name.endsWith(".txt") && (
                <aside
                  aria-label="Preview"
                  className="hidden w-[40%] max-w-[400px] shrink-0 flex-col border-l border-border bg-elevated md:flex"
                >
                  <div className="border-b border-border px-3 py-2 font-mono text-[11px] text-muted">
                    {joinPath(path, selectedChild.name)}
                  </div>
                  <pre className="flex-1 overflow-auto whitespace-pre-wrap break-words px-3 py-2 font-mono text-xs text-fg">
                    {selectedChild.node.content.slice(0, 400)}
                    {selectedChild.node.content.length > 400 ? "…" : ""}
                  </pre>
                </aside>
              )}
          </div>

          {/* Status bar */}
          <footer className="flex items-center justify-between gap-2 border-t border-border bg-elevated px-3 py-1.5 font-mono text-[11px] text-muted">
            <span>
              {children.length} item{children.length === 1 ? "" : "s"} · {children.length} visible
            </span>
            <span className="truncate text-right">
              {selectedChild ? joinPath(path, selectedChild.name) : path}
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
