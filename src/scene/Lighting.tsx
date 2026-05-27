"use client";

import { Environment, Lightformer } from "@react-three/drei";
import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Scene lighting. SEAM owned by the render/atmosphere agent.
 *
 * Warm golden-hour rig:
 *  - A network-free image-based environment (drei <Environment> with hand-placed
 *    <Lightformer> children — NO `preset`, so nothing is fetched from a CDN).
 *  - One strong warm key directional light = the sun, casting soft shadows.
 *  - A warm/earthy hemisphere ambient plus a low cool fill for dimensional shape.
 *
 * Feature flags come from the quality tier:
 *  - `ibl`     — render the <Environment> cubemap (image-based lighting). When
 *                off we lean harder on cheap ambient/directional fill.
 *  - `shadows` — let the sun cast a shadow map.
 *
 * NOTE: PCSS <SoftShadows> was removed — it was the single heaviest GPU cost
 * (per-pixel multi-tap + a global shadow-shader patch that also emitted compiler
 * warnings). The default PCF soft shadow map looks nearly identical for far less.
 */
export function Lighting({
  shadows = true,
  ibl = true,
}: {
  shadows?: boolean;
  ibl?: boolean;
}) {
  // The sun and every shadow caster in the village are static, so we render the
  // shadow map exactly once and then freeze it (autoUpdate=false). This drops the
  // per-frame depth re-render entirely — a real win on the context-fragile iGPU.
  const sunRef = useRef<THREE.DirectionalLight>(null);
  useEffect(() => {
    const sun = sunRef.current;
    if (!sun || !shadows) return;
    // Render one fresh depth pass next frame, then stop auto-updating.
    sun.shadow.needsUpdate = true;
    sun.shadow.autoUpdate = false;
  }, [shadows]);

  return (
    <>
      {/* Soft IBL with zero network dependency. Static (frames={1}) and modest
          resolution keeps it cheap. Skipped when the tier disables IBL. */}
      {ibl && (
        <Environment resolution={128} frames={1} background={false}>
          {/* Warm sky dome — large soft fill from above, faintly peachy so the
              whole scene sits under a golden-hour wash rather than neutral white. */}
          <Lightformer
            form="rect"
            intensity={1.0}
            color="#fce6c0"
            position={[0, 12, 0]}
            rotation={[Math.PI / 2, 0, 0]}
            scale={[40, 40, 1]}
          />
          {/* The sun — a bright warm disc high on the key side. Pushed a touch
              hotter/amber so speculars catch a real golden glint. */}
          <Lightformer
            form="circle"
            intensity={4.6}
            color="#ffcf8a"
            position={[14, 14, 8]}
            rotation={[0, -Math.PI / 2.4, 0]}
            scale={[11, 11, 1]}
          />
          {/* Cool sky fill from the opposite side for soft shadow color — keeps
              shadowed faces reading blue-ish so forms feel three-dimensional. */}
          <Lightformer
            form="rect"
            intensity={0.65}
            color="#c5dcf2"
            position={[-16, 8, -6]}
            rotation={[0, Math.PI / 2, 0]}
            scale={[20, 16, 1]}
          />
          {/* Soft warm low sun-side glow band near the horizon — adds a hazy rim
              of warmth to silhouettes facing the sun. Cheap (one more rect). */}
          <Lightformer
            form="rect"
            intensity={0.7}
            color="#ffd9a8"
            position={[10, 2, 10]}
            rotation={[0, -Math.PI / 3, 0]}
            scale={[24, 6, 1]}
          />
          {/* Earthy/sage ground bounce from below — warms up undersides. */}
          <Lightformer
            form="rect"
            intensity={0.5}
            color="#aacf8c"
            position={[0, -4, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            scale={[40, 40, 1]}
          />
        </Environment>
      )}

      {/* Warm sky / earthy ground ambient — lifts shadows without flattening.
          Warm peach sky over a deeper earthy ground tint reads as bounced
          golden light. Leans on this more when there's no IBL to provide fill. */}
      <hemisphereLight args={["#ffe1a8", "#5e4d36", ibl ? 0.55 : 0.95]} />

      {/* THE SUN — strong warm key. Soft (PCF) shadows over the play area when
          the tier enables them. Shadow frustum is tightened to roughly the
          play area (was a loose ±35) so the 1024² map packs far more texels
          onto what's actually on screen — crisper shadows, no extra fill. */}
      <directionalLight
        ref={sunRef}
        castShadow={shadows}
        position={[14, 18, 8]}
        intensity={ibl ? 2.4 : 1.8}
        color="#ffd29a"
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0003}
        shadow-normalBias={0.02}
      >
        <orthographicCamera
          attach="shadow-camera"
          args={[-24, 24, 22, -18, 1, 55]}
        />
      </directionalLight>

      {/* Low cool fill from the opposite side — gives forms a soft cool edge so
          faces read dimensionally rather than washing out. No shadows (cheap). */}
      <directionalLight
        position={[-12, 9, -8]}
        intensity={0.45}
        color="#cdbce8"
      />
    </>
  );
}
