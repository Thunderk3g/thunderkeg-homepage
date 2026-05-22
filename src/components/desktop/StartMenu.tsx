"use client";
import { useWindows } from "./WindowManager";
import { Icon, type IconName } from "@/lib/theme/icons";
import type { AppKind } from "@/types/window";

const ITEMS: { kind: AppKind; icon: IconName; label: string }[] = [
  { kind: "terminal", icon: "terminal", label: "Terminal" },
  { kind: "voice",    icon: "voice",    label: "Voice Assistant" },
  { kind: "resume",   icon: "resume",   label: "Resume" },
  { kind: "projects", icon: "projects", label: "Projects" },
  { kind: "about",    icon: "about",    label: "About" },
  { kind: "social",   icon: "social",   label: "Social" },
  { kind: "tetris",   icon: "tetris",   label: "Tetris" },
  { kind: "doom",     icon: "doom",     label: "Doom" },
  { kind: "mp3",      icon: "mp3",      label: "MP3 Player" },
  { kind: "vlc",      icon: "vlc",      label: "Media Player" },
];

export function StartMenu({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { open: openWin } = useWindows();
  if (!open) return null;
  return (
    <div
      onMouseLeave={onClose}
      className="absolute bottom-10 left-2 z-[10000] w-64 rounded-md border border-border bg-elevated p-2 shadow-window"
    >
      {ITEMS.map((it) => (
        <button
          key={it.kind}
          onClick={() => {
            openWin(it.kind);
            onClose();
          }}
          className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm hover:bg-white/5"
        >
          <Icon name={it.icon} size={16} className="text-accent" />
          <span>{it.label}</span>
        </button>
      ))}
    </div>
  );
}
