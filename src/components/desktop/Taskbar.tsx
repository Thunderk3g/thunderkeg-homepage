"use client";
import { useEffect, useState } from "react";
import { useWindows } from "./WindowManager";
import { Icon } from "@/lib/theme/icons";
import { StartMenu } from "./StartMenu";

export function Taskbar() {
  const { windows, order, focus, minimise } = useWindows();
  const [open, setOpen] = useState(false);
  const [time, setTime] = useState("");

  useEffect(() => {
    const tick = () =>
      setTime(
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    tick();
    const i = setInterval(tick, 30_000);
    return () => clearInterval(i);
  }, []);

  const visible = order.map((id) => windows[id]).filter(Boolean);

  return (
    <div className="absolute inset-x-0 bottom-0 z-[9999] flex h-10 items-center gap-2 border-t border-border bg-elevated/90 px-2 backdrop-blur">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Start menu"
        className="rounded p-1 text-accent hover:bg-white/5"
      >
        <Icon name="power" />
      </button>
      <StartMenu open={open} onClose={() => setOpen(false)} />
      <div className="mx-2 h-5 w-px bg-border" />
      <div className="flex flex-1 items-center gap-1 overflow-x-auto">
        {visible.map((w) => (
          <button
            key={w.id}
            onClick={() => (w.minimised ? focus(w.id) : minimise(w.id))}
            className={`flex items-center gap-2 rounded px-2 py-1 text-xs ${
              w.minimised ? "text-muted" : "bg-white/5 text-fg"
            }`}
          >
            {w.title}
          </button>
        ))}
      </div>
      <div className="font-mono text-xs text-muted">{time}</div>
    </div>
  );
}
