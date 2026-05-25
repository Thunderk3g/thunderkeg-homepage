"use client";
import { useEffect, useRef } from "react";
import { WindowManagerProvider, useWindows } from "./WindowManager";
import { Window } from "./Window";
import { DesktopIcons } from "./DesktopIcons";
import { Taskbar } from "./Taskbar";
import { ContextMenu } from "./ContextMenu";
import { APP_REGISTRY } from "@/components/apps/registry";

function DesktopBody() {
  const { windows, open } = useWindows();
  const bgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    open("terminal", { bounds: { x: 320, y: 80, width: 760, height: 520 } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={bgRef}
      className="relative h-screen w-screen overflow-hidden bg-bg text-fg"
      style={{
        background:
          "radial-gradient(ellipse at 30% 30%, #1a0f3a 0%, #0b0d12 60%), " +
          "radial-gradient(circle at 80% 70%, rgba(124,92,255,0.18) 0%, transparent 50%), " +
          "linear-gradient(180deg, #0b0d12 0%, #07080d 100%)",
        backgroundColor: "#0b0d12",
      }}
    >
      <DesktopIcons />
      {Object.values(windows).map((w) => {
        const App = APP_REGISTRY[w.kind];
        return (
          <Window key={w.id} id={w.id}>
            <App />
          </Window>
        );
      })}
      <ContextMenu targetRef={bgRef} />
      <Taskbar />
    </div>
  );
}

export function Desktop() {
  return (
    <WindowManagerProvider>
      <DesktopBody />
    </WindowManagerProvider>
  );
}
