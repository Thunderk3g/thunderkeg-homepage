"use client";

import { Sky, Clouds, Cloud, Sparkles } from "@react-three/drei";
import * as THREE from "three";

/**
 * Sky, fog, background color and drifting clouds. SEAM owned by the
 * render/atmosphere agent. Tuned for a warm, soft, late-golden-afternoon
 * Studio Ghibli mood — distant edges melt into a dreamy haze, slow cumulus
 * drift overhead, and a few warm pollen motes float in the sun.
 *
 * `lite` (after a WebGL context loss) keeps the cheap sky/fog but drops the
 * volumetric <Clouds> and <Sparkles>, which are comparatively GPU-hungry.
 */
export function Atmosphere({ lite = false }: { lite?: boolean }) {
  return (
    <>
      {/* Soft warm sky-blue clear color so the horizon glows rather than going
          flat white. */}
      <color attach="background" args={["#bfe3f0"]} />

      {/* Warm, slightly green-cream haze. Near 42 / far 118 keeps the playable
          area crisp while distant world edges dissolve into a painterly fog. */}
      <fog attach="fog" args={["#e3ead8", 42, 118]} />

      {/* Late-afternoon sun sitting low and warm. Higher rayleigh + mild
          turbidity gives the soft peachy gradient instead of a harsh blue. */}
      <Sky
        sunPosition={[40, 9, 22]}
        turbidity={6}
        rayleigh={2.8}
        mieCoefficient={0.018}
        mieDirectionalG={0.86}
      />

      {!lite && (
        <>
          {/* Drifting Ghibli cumulus — soft, high up, slow. Low segment counts
              and a shared instanced material (via <Clouds>) keep this cheap. */}
          <Clouds material={THREE.MeshLambertMaterial} limit={120} range={90}>
            <Cloud
              position={[-14, 24, -22]}
              segments={18}
              bounds={[14, 3, 6]}
              volume={9}
              color="#fff6e8"
              opacity={0.5}
              speed={0.12}
              growth={3}
              fade={60}
            />
            <Cloud
              position={[16, 27, -30]}
              segments={20}
              bounds={[18, 3.5, 7]}
              volume={11}
              color="#fdeed4"
              opacity={0.45}
              speed={0.1}
              growth={3.5}
              fade={70}
            />
            <Cloud
              position={[2, 30, 18]}
              segments={16}
              bounds={[12, 3, 6]}
              volume={8}
              color="#ffffff"
              opacity={0.38}
              speed={0.14}
              growth={3}
              fade={64}
            />
          </Clouds>

          {/* Very subtle warm pollen/dust motes catching the light. Low count,
              large spread so it reads as ambient sparkle, not snow. */}
          <Sparkles
            count={40}
            scale={[34, 10, 34]}
            position={[0, 5, 3]}
            size={2.4}
            speed={0.25}
            opacity={0.35}
            color="#ffe6b0"
            noise={1}
          />
        </>
      )}
    </>
  );
}
