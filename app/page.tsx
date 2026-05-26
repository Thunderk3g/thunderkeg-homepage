"use client";

import dynamic from "next/dynamic";
import { Hud } from "@/ui/Hud";
import { Loader } from "@/ui/Loader";

// The 3D world is client-only (WebGL); never server-render it.
const GameCanvas = dynamic(() => import("@/game/GameCanvas"), { ssr: false });

export default function Home() {
  return (
    <main className="stage">
      <GameCanvas />
      <Hud />
      <Loader />
    </main>
  );
}
