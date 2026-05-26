"use client";

import { RigidBody, CuboidCollider } from "@react-three/rapier";
import { ActiveCollisionTypes } from "@dimforge/rapier3d-compat";
import type { BuildingDef } from "./buildings";
import { useGame } from "./store";

const SENSOR_PAD = 2.0;

/**
 * A placeholder building: a colored box + pyramid roof, a solid body collider so
 * the player can't walk through it, and a larger sensor collider that flips
 * `nearBuilding` in the store so the HUD can show the "Press E" prompt.
 * Models from the art pass will replace the box/roof meshes; the colliders stay.
 */
export function Building({ def }: { def: BuildingDef }) {
  const setNear = useGame((s) => s.setNearBuilding);
  const [hw, hh, hd] = def.size;
  const [x, y, z] = def.position;
  const roofH = Math.min(hw, hd) * 1.1;
  const roofR = Math.max(hw, hd) * 1.3;

  return (
    <group position={[x, y, z]}>
      {/* solid body */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[hw, hh, hd]} position={[0, hh, 0]} />
      </RigidBody>

      {/* placeholder house */}
      <mesh castShadow receiveShadow position={[0, hh, 0]}>
        <boxGeometry args={[hw * 2, hh * 2, hd * 2]} />
        <meshStandardMaterial color={def.color} />
      </mesh>
      <mesh
        castShadow
        position={[0, hh * 2 + roofH / 2, 0]}
        rotation={[0, Math.PI / 4, 0]}
      >
        <coneGeometry args={[roofR, roofH, 4]} />
        <meshStandardMaterial color={def.roof} />
      </mesh>

      {/* proximity sensor */}
      <CuboidCollider
        args={[hw + SENSOR_PAD, hh + 1, hd + SENSOR_PAD]}
        position={[0, hh, 0]}
        sensor
        activeCollisionTypes={ActiveCollisionTypes.ALL}
        onIntersectionEnter={({ other }) => {
          if (other.rigidBodyObject?.name === "player") setNear(def.id);
        }}
        onIntersectionExit={({ other }) => {
          if (
            other.rigidBodyObject?.name === "player" &&
            useGame.getState().nearBuilding === def.id
          ) {
            setNear(null);
          }
        }}
      />
    </group>
  );
}
