"use client";

import { Canvas } from "@react-three/fiber";
import { KeyboardControls, AdaptiveDpr, AdaptiveEvents } from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import { Suspense } from "react";
import { keyboardMap } from "./controls";
import { World } from "./World";
import { Player } from "./Player";
import { FollowCamera } from "./FollowCamera";
import { Lighting } from "@/scene/Lighting";
import { Atmosphere } from "@/scene/Atmosphere";
import { PostFX } from "@/scene/PostFX";
import { useQuality } from "./quality";

export default function GameCanvas() {
  const tier = useQuality((s) => s.tier);
  const failed = useQuality((s) => s.failed);
  const lite = tier === "lite";

  // Even the lite tier couldn't hold a context — give a usable DOM fallback.
  if (failed) {
    return (
      <div className="webgl-fallback">
        <div className="webgl-fallback__card">
          <h2>3D view isn’t available here</h2>
          <p>
            Your browser or GPU keeps losing the 3D context. You can still read
            the full résumé as text.
          </p>
          <div className="webgl-fallback__actions">
            <button onClick={() => window.location.reload()}>Try again</button>
            <a href="/resume">Open text résumé →</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <KeyboardControls map={keyboardMap}>
      <Canvas
        // Remount with a fresh GL context when the tier changes (after a loss).
        key={tier}
        shadows={!lite}
        dpr={lite ? 1 : [1, 1.5]}
        camera={{ position: [0, 6, 14], fov: 50 }}
        gl={{
          antialias: false, // SMAA in PostFX handles edges; canvas MSAA is wasted on the offscreen pipeline
          powerPreference: "high-performance",
          failIfMajorPerformanceCaveat: false,
        }}
        performance={{ min: 0.5 }}
        onCreated={({ gl }) => {
          // On context loss, prevent the default (which would kill it permanently)
          // and step the quality tier down, remounting a lighter scene.
          gl.domElement.addEventListener(
            "webglcontextlost",
            (e) => {
              e.preventDefault();
              useQuality.getState().onContextLost();
            },
            { once: true }
          );
        }}
      >
        {/* sky / fog / background — render-atmosphere seam */}
        <Atmosphere lite={lite} />
        {/* lights + shadow config — render-atmosphere seam */}
        <Lighting lite={lite} />

        <Suspense fallback={null}>
          <Physics timeStep={1 / 60}>
            <World />
            <Player />
          </Physics>
        </Suspense>

        <FollowCamera />

        {/* post-processing MUST be the last child — render-atmosphere seam.
            Skipped on the lite tier (full-res post stack is a heavy GPU cost). */}
        {!lite && <PostFX />}

        {/* Throttle resolution under sustained load instead of losing the context. */}
        <AdaptiveDpr />
        <AdaptiveEvents />
      </Canvas>
    </KeyboardControls>
  );
}
