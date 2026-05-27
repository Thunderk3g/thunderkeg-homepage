"use client";

import { Sky, Clouds, Cloud, Sparkles } from "@react-three/drei";
import * as THREE from "three";

/**
 * Sky, fog, background color and drifting clouds. SEAM owned by the
 * render/atmosphere agent. Tuned for a warm, soft, late-golden-afternoon
 * Studio Ghibli mood — distant edges melt into a dreamy haze, slow cumulus
 * drift overhead, and a few warm pollen motes float in the sun.
 *
 * `clouds=false` (lite tier) keeps the cheap sky/fog but drops the volumetric
 * <Clouds> and <Sparkles>, which are comparatively GPU-hungry.
 */
export function Atmosphere({ clouds = true }: { clouds?: boolean }) {
  return (
    <>
      {/* Soft warm sky-blue clear color, nudged a touch warmer/creamier so the
          horizon glows golden rather than going cool or flat white. */}
      <color attach="background" args={["#cce6ec"]} />

      {/* Warm, slightly peachy-cream haze. Pulled the far plane in (near 38 /
          far 105) and warmed the tint so distant hills melt away into a dreamy
          golden veil while the playable area stays crisp. */}
      <fog attach="fog" args={["#ece6d0", 38, 105]} />

      {/* Late-afternoon sun sitting low and warm. Higher rayleigh + mild
          turbidity gives the soft peachy gradient instead of a harsh blue;
          a slightly higher mie scatters more warm light around the low sun. */}
      <Sky
        sunPosition={[40, 8, 22]}
        turbidity={7}
        rayleigh={3.1}
        mieCoefficient={0.021}
        mieDirectionalG={0.88}
      />

      {clouds && (
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
