"use client";

import { Canvas } from "@react-three/fiber";
import { KeyboardControls, Sky, SoftShadows } from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import { Suspense } from "react";
import { keyboardMap } from "./controls";
import { World } from "./World";
import { Player } from "./Player";
import { FollowCamera } from "./FollowCamera";

export default function GameCanvas() {
  return (
    <KeyboardControls map={keyboardMap}>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 6, 14], fov: 50 }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={["#bfe3f0"]} />
        <fog attach="fog" args={["#cfe6e0", 45, 110]} />

        {/* warm golden-hour lighting */}
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

        <Sky sunPosition={[40, 12, 20]} turbidity={8} rayleigh={2.4} mieCoefficient={0.02} />
        <SoftShadows samples={8} size={14} />

        <Suspense fallback={null}>
          <Physics timeStep={1 / 60}>
            <World />
            <Player />
          </Physics>
        </Suspense>

        <FollowCamera />
      </Canvas>
    </KeyboardControls>
  );
}
