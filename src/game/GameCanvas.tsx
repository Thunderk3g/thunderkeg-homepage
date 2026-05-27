"use client";

import { Canvas } from "@react-three/fiber";
import { KeyboardControls } from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import { Suspense } from "react";
import { keyboardMap } from "./controls";
import { World } from "./World";
import { Player } from "./Player";
import { FollowCamera } from "./FollowCamera";
import { Lighting } from "@/scene/Lighting";
import { Atmosphere } from "@/scene/Atmosphere";
import { PostFX } from "@/scene/PostFX";

export default function GameCanvas() {
  return (
    <KeyboardControls map={keyboardMap}>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 6, 14], fov: 50 }}
        gl={{ antialias: true }}
      >
        {/* sky / fog / background — render-atmosphere seam */}
        <Atmosphere />
        {/* lights + shadow config — render-atmosphere seam */}
        <Lighting />

        <Suspense fallback={null}>
          <Physics timeStep={1 / 60}>
            <World />
            <Player />
          </Physics>
        </Suspense>

        <FollowCamera />

        {/* post-processing MUST be the last child — render-atmosphere seam */}
        <PostFX />
      </Canvas>
    </KeyboardControls>
  );
}
