"use client";

import { BUILDINGS } from "@/game/buildings";
import { Building } from "@/game/Building";

/**
 * The six résumé buildings. SEAM owned by the town/buildings agent. Maps the
 * BUILDINGS data to <Building> instances; the per-building colliders and store
 * wiring live inside Building.tsx and must be preserved.
 *
 * A small decorative wishing well sits off to one side of the town center as a
 * landmark. It is placed clear of the spawn point (0, ~1, 6) and the About
 * house (0, 0, 0), and is purely visual (no collider).
 */
export function Town() {
  return (
    <>
      {BUILDINGS.map((b) => (
        <Building key={b.id} def={b} />
      ))}
      <TownWell />
    </>
  );
}

/** A tiny low-poly wishing well — storybook town-center flavor (visual only). */
function TownWell() {
  return (
    <group position={[6, 0, 5]}>
      {/* stone basin */}
      <mesh castShadow receiveShadow position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.8, 0.85, 0.8, 12]} />
        <meshStandardMaterial color="#b9ad97" flatShading roughness={1} />
      </mesh>
      {/* water */}
      <mesh position={[0, 0.78, 0]}>
        <cylinderGeometry args={[0.66, 0.66, 0.05, 12]} />
        <meshStandardMaterial
          color="#cfe6e0"
          emissive="#cfe6e0"
          emissiveIntensity={0.2}
          roughness={0.2}
        />
      </mesh>
      {/* support posts */}
      {[-1, 1].map((s) => (
        <mesh key={s} castShadow position={[s * 0.7, 1.3, 0]}>
          <boxGeometry args={[0.12, 1.4, 0.12]} />
          <meshStandardMaterial color="#8a6a4a" flatShading />
        </mesh>
      ))}
      {/* little gable roof */}
      <mesh castShadow position={[0, 2.05, 0.42]} rotation={[-0.7, 0, 0]}>
        <boxGeometry args={[1.8, 0.1, 1.0]} />
        <meshStandardMaterial color="#c8745f" flatShading />
      </mesh>
      <mesh castShadow position={[0, 2.05, -0.42]} rotation={[0.7, 0, 0]}>
        <boxGeometry args={[1.8, 0.1, 1.0]} />
        <meshStandardMaterial color="#c8745f" flatShading />
      </mesh>
    </group>
  );
}
