"use client";

import dynamic from "next/dynamic";
import { Hud } from "@/ui/Hud";
import { Loader } from "@/ui/Loader";
import { MinigameHost } from "@/ui/MinigameHost";
import { MobileControls } from "@/ui/MobileControls";
import { CanvasErrorBoundary } from "@/ui/CanvasErrorBoundary";
import { QuestTracker } from "@/ui/QuestTracker";
import { Toast } from "@/ui/Toast";
import { Intro } from "@/ui/Intro";

// The 3D world is client-only (WebGL); never server-render it.
const GameCanvas = dynamic(() => import("@/game/GameCanvas"), { ssr: false });

export default function Home() {
  return (
    <main className="stage">
      <CanvasErrorBoundary>
        <GameCanvas />
      </CanvasErrorBoundary>
      <Hud />
      <QuestTracker />
      <Toast />
      <MobileControls />
      <MinigameHost />
      <Loader />
      <Intro />
    </main>
  );
}
