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
        backgroundImage: "url(/wallpapers/kali-purple-dragon.jpg)",
        backgroundSize: "cover",
        backgroundPosition: "center",
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
