"use client";

import { Sky } from "@react-three/drei";

/**
 * Sky, fog and background color. SEAM owned by the render/atmosphere agent —
 * currently the baseline moved out of GameCanvas. Will gain drifting clouds and
 * a tuned golden-hour gradient.
 */
export function Atmosphere() {
  return (
    <>
      <color attach="background" args={["#bfe3f0"]} />
      <fog attach="fog" args={["#cfe6e0", 45, 110]} />
      <Sky sunPosition={[40, 12, 20]} turbidity={8} rayleigh={2.4} mieCoefficient={0.02} />
    </>
  );
}
