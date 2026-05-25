"use client";
import { useEffect, useState, type RefObject } from "react";
import { useWindows } from "./WindowManager";
import { ThemeMenuItems } from "@/lib/theme/ThemeMenu";

export function ContextMenu({
  targetRef,
}: {
  targetRef: RefObject<HTMLDivElement | null>;
}) {
  const { open } = useWindows();
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const el = targetRef.current;
    if (!el) return;
    const onCtx = (e: MouseEvent) => {
      if (e.target === el) {
        e.preventDefault();
        setPos({ x: e.clientX, y: e.clientY });
      }
    };
    const onClick = () => setPos(null);
    el.addEventListener("contextmenu", onCtx);
    window.addEventListener("click", onClick);
    return () => {
      el.removeEventListener("contextmenu", onCtx);
      window.removeEventListener("click", onClick);
    };
  }, [targetRef]);

  if (!pos) return null;
  return (
    <ul
      style={{ top: pos.y, left: pos.x }}
      className="absolute z-[10001] w-48 rounded border border-border bg-elevated py-1 text-sm shadow-window"
    >
      <li>
        <button
          onClick={() => {
            open("about");
            setPos(null);
          }}
          className="block w-full px-3 py-1.5 text-left hover:bg-white/5"
        >
          About this desktop
        </button>
      </li>
      <li>
        <button
          onClick={() => {
            open("terminal");
            setPos(null);
          }}
          className="block w-full px-3 py-1.5 text-left hover:bg-white/5"
        >
          Open Terminal
        </button>
      </li>
      <li>
        <button
          onClick={() => {
            open("files");
            setPos(null);
          }}
          className="block w-full px-3 py-1.5 text-left hover:bg-white/5"
        >
          Open Files
        </button>
      </li>
      <li className="my-1 border-t border-border" aria-hidden />
      <li className="px-3 py-1 text-xs uppercase tracking-wider text-muted">
        Themes
      </li>
      <ThemeMenuItems />
    </ul>
  );
}
