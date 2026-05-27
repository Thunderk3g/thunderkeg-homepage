"use client";

import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
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
import { useQuality, settingsFor } from "./quality";

export default function GameCanvas() {
  const tier = useQuality((s) => s.tier);
  const failed = useQuality((s) => s.failed);
  const q = settingsFor(tier);

  // Even the lowest tier couldn't hold a context — give a usable DOM fallback.
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
        shadows={q.shadows}
        dpr={q.dpr}
        camera={{ position: [0, 6, 14], fov: 50 }}
        gl={{
          antialias: false, // MSAA is slow + capped on Intel; SMAA (high tier) covers edges
          powerPreference: "high-performance",
          failIfMajorPerformanceCaveat: false,
        }}
        performance={{ min: 0.5 }}
        onCreated={({ gl }) => {
          // Filmic warm grade on the renderer itself — the cheap substitute for
          // a tone-mapping post pass (no EffectComposer / HDR buffers needed).
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;

          // On context loss, prevent the default and step the quality tier down.
          // (On drivers with `exit_on_context_lost` the GPU process exits, so the
          // remount happens on the *next* load via the persisted tier; either way
          // we never sit on a permanently blank canvas.)
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
        <Atmosphere clouds={q.clouds} />
        {/* lights + shadow config — render-atmosphere seam */}
        <Lighting shadows={q.shadows} ibl={q.ibl} />

        <Suspense fallback={null}>
          <Physics timeStep={1 / 60}>
            <World />
            <Player />
          </Physics>
        </Suspense>

        <FollowCamera />

        {/* post-processing MUST be the last child — render-atmosphere seam.
            Only on the high tier; the full-res HDR stack is the prime suspect
            for OOM context loss on integrated GPUs. */}
        {q.postfx && <PostFX />}

        {/* Throttle resolution under sustained load instead of losing the context. */}
        <AdaptiveDpr />
        <AdaptiveEvents />
      </Canvas>
    </KeyboardControls>
  );
}
