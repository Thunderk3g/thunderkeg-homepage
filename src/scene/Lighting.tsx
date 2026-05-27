"use client";

import { Environment, Lightformer } from "@react-three/drei";

/**
 * Scene lighting. SEAM owned by the render/atmosphere agent.
 *
 * Warm golden-hour rig:
 *  - A network-free image-based environment (drei <Environment> with hand-placed
 *    <Lightformer> children — NO `preset`, so nothing is fetched from a CDN).
 *  - One strong warm key directional light = the sun, casting soft shadows.
 *  - A warm/earthy hemisphere ambient plus a low cool fill for dimensional shape.
 *
 * `lite` (set after a WebGL context loss) drops the IBL cubemap + shadows and
 * leans harder on cheap ambient/directional lights so a weak GPU can sustain it.
 *
 * NOTE: PCSS <SoftShadows> was removed — it was the single heaviest GPU cost
 * (per-pixel multi-tap + a global shadow-shader patch that also emitted compiler
 * warnings). The default PCF soft shadow map looks nearly identical for far less.
 */
export function Lighting({ lite = false }: { lite?: boolean }) {
  return (
    <>
      {/* Soft IBL with zero network dependency. Static (frames={1}) and modest
          resolution keeps it cheap. Skipped entirely on the lite tier. */}
      {!lite && (
        <Environment resolution={128} frames={1} background={false}>
          {/* Warm sky dome — large soft fill from above. */}
          <Lightformer
            form="rect"
            intensity={0.9}
            color="#fbe9c8"
            position={[0, 12, 0]}
            rotation={[Math.PI / 2, 0, 0]}
            scale={[40, 40, 1]}
          />
          {/* The sun — a bright warm disc high on the key side. */}
          <Lightformer
            form="circle"
            intensity={4}
            color="#ffd9a0"
            position={[14, 14, 8]}
            rotation={[0, -Math.PI / 2.4, 0]}
            scale={[10, 10, 1]}
          />
          {/* Cool sky fill from the opposite side for soft shadow color. */}
          <Lightformer
            form="rect"
            intensity={0.6}
            color="#cfe2f0"
            position={[-16, 8, -6]}
            rotation={[0, Math.PI / 2, 0]}
            scale={[20, 16, 1]}
          />
          {/* Earthy/sage ground bounce from below — warms up undersides. */}
          <Lightformer
            form="rect"
            intensity={0.5}
            color="#a8cf8f"
            position={[0, -4, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            scale={[40, 40, 1]}
          />
        </Environment>
      )}

      {/* Warm sky / earthy ground ambient — lifts shadows without flattening.
          Lite leans on this more since there's no IBL. */}
      <hemisphereLight args={["#ffe3b0", "#6b5840", lite ? 0.95 : 0.55]} />

      {/* THE SUN — strong warm key. Soft (PCF) shadows over the play area on the
          high tier; no shadow casting on lite. */}
      <directionalLight
        castShadow={!lite}
        position={[14, 18, 8]}
        intensity={lite ? 1.7 : 2.3}
        color="#ffd9a0"
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0003}
        shadow-normalBias={0.02}
      >
        <orthographicCamera
          attach="shadow-camera"
          args={[-35, 35, 35, -35, 0.1, 70]}
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
