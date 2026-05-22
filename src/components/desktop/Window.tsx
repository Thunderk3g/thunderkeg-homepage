"use client";
import { Rnd } from "react-rnd";
import { motion as fm } from "framer-motion";
import { useWindows } from "./WindowManager";
import { Icon } from "@/lib/theme/icons";
import { motion as motionPresets } from "@/lib/theme/motion";

export function Window({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const { windows, focus, close, minimise, toggleMaximise, setBounds } = useWindows();
  const w = windows[id];
  if (!w || w.minimised) return null;

  return (
    <Rnd
      size={{ width: w.bounds.width, height: w.bounds.height }}
      position={{ x: w.bounds.x, y: w.bounds.y }}
      minWidth={320}
      minHeight={220}
      bounds="parent"
      dragHandleClassName="window-drag-handle"
      onMouseDown={() => focus(id)}
      onDragStop={(_, d) => setBounds(id, { ...w.bounds, x: d.x, y: d.y })}
      onResizeStop={(_, __, ref, ___, pos) =>
        setBounds(id, {
          x: pos.x,
          y: pos.y,
          width: parseInt(ref.style.width, 10),
          height: parseInt(ref.style.height, 10),
        })
      }
      style={{ zIndex: w.zIndex }}
      disableDragging={w.maximised}
      enableResizing={!w.maximised}
    >
      <fm.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={motionPresets.glide}
        className="flex h-full w-full flex-col overflow-hidden rounded-md bg-surface shadow-window ring-1 ring-border"
      >
        <div className="window-drag-handle flex h-9 select-none items-center justify-between border-b border-border bg-elevated px-3 text-xs text-muted">
          <div className="flex items-center gap-2">
            <button
              aria-label="close"
              onClick={() => close(id)}
              className="h-3 w-3 rounded-full bg-danger transition-transform hover:scale-110"
            />
            <button
              aria-label="minimise"
              onClick={() => minimise(id)}
              className="h-3 w-3 rounded-full bg-warning transition-transform hover:scale-110"
            />
            <button
              aria-label="maximise"
              onClick={() => toggleMaximise(id)}
              className="h-3 w-3 rounded-full bg-success transition-transform hover:scale-110"
            />
            <span className="ml-3 font-mono text-fg">{w.title}</span>
          </div>
          <Icon name="menu" size={14} />
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-surface">{children}</div>
      </fm.div>
    </Rnd>
  );
}
