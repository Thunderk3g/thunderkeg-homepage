"use client";

import { SoftShadows } from "@react-three/drei";

/**
 * Scene lighting. SEAM owned by the render/atmosphere agent — currently the
 * baseline warm-golden-hour rig moved out of GameCanvas. Will gain Environment
 * IBL, a fill light, and tuned shadows.
 */
export function Lighting() {
  return (
    <>
      <hemisphereLight args={["#ffe3b0", "#6b5840", 0.7]} />
      <directionalLight
        castShadow
        position={[14, 18, 8]}
        intensity={2.2}
        color="#ffd9a0"
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0003}
      >
        <orthographicCamera
          attach="shadow-camera"
          args={[-35, 35, 35, -35, 0.1, 70]}
        />
      </directionalLight>
      <SoftShadows samples={8} size={14} />
    </>
  );
}
