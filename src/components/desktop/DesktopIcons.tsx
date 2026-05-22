"use client";
import { useWindows } from "./WindowManager";
import { Icon, type IconName } from "@/lib/theme/icons";
import type { AppKind } from "@/types/window";

const ICONS: { kind: AppKind; icon: IconName; label: string }[] = [
  { kind: "terminal", icon: "terminal", label: "Terminal" },
  { kind: "voice",    icon: "voice",    label: "Voice" },
  { kind: "resume",   icon: "resume",   label: "Resume" },
  { kind: "projects", icon: "projects", label: "Projects" },
  { kind: "about",    icon: "about",    label: "About" },
  { kind: "social",   icon: "social",   label: "Social" },
  { kind: "doom",     icon: "doom",     label: "Doom" },
  { kind: "tetris",   icon: "tetris",   label: "Tetris" },
  { kind: "mp3",      icon: "mp3",      label: "MP3" },
  { kind: "vlc",      icon: "vlc",      label: "Media" },
];

export function DesktopIcons() {
  const { open } = useWindows();
  return (
    <div className="absolute left-4 top-4 z-10 flex flex-col gap-3">
      {ICONS.map((it) => (
        <button
          key={it.kind}
          onDoubleClick={() => open(it.kind)}
          onKeyDown={(e) => {
            if (e.key === "Enter") open(it.kind);
          }}
          className="flex w-20 flex-col items-center gap-1 rounded p-2 text-xs text-fg/90 transition-colors hover:bg-white/5 focus:bg-white/5 focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <Icon name={it.icon} size={28} className="text-accent" />
          <span className="text-center leading-tight">{it.label}</span>
        </button>
      ))}
    </div>
  );
}
