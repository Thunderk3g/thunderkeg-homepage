"use client";

import { useMemo } from "react";
import { useTexture } from "@react-three/drei";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import * as THREE from "three";

/**
 * Ground + path + water. SEAM owned by the natural-environment agent.
 *
 * Physics: the player is a kinematic controller that walks on a FLAT physics
 * floor at y=0. The fixed-body CuboidCollider below MUST be preserved, and the
 * VISUAL ground in the play area (x∈[-16,16], z∈[-12,18]) must never poke above
 * y=0 (the player would clip through it). The play-area ground is therefore a
 * flat plane at y=0; gently rolling hills are added only as background scenery
 * OUTSIDE the play radius (and their crests are pushed down toward the centre so
 * nothing rises above y=0 where the player can reach).
 */

// ---- Shared path geometry (also consumed conceptually by Scatter via the
// same control points; kept local here since file ownership is strict). -------

/** Town-center hub the spawn path threads through (just south of About). */
const HUB: [number, number] = [0, 4];

/** Endpoints of each path branch: building "doorstep" points on the XZ plane. */
const PATH_TARGETS: Array<[number, number]> = [
  [0, 6], // spawn (player start)
  [0, 0.2], // about / town center
  [-9.5, -6.5], // experience
  [9.5, -6.5], // projects
  [-10.5, 5.2], // skills
  [10.5, 5.2], // awards
  [0, 16.5], // contact
];

const PATH_Y = 0.02;
const PATH_HALF_WIDTH = 1.1;

/** A single straight ribbon segment between two XZ points. */
function PathSegment({
  from,
  to,
  map,
}: {
  from: [number, number];
  to: [number, number];
  map: THREE.Texture;
}) {
  const [x0, z0] = from;
  const [x1, z1] = to;
  const dx = x1 - x0;
  const dz = z1 - z0;
  const len = Math.hypot(dx, dz);
  const angle = Math.atan2(dx, dz); // rotate around Y so +Z plane aligns to dir
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  // overlap the ends a touch so joints don't crack
  const planeLen = len + PATH_HALF_WIDTH * 1.6;
  const repeat = Math.max(1, Math.round(planeLen / 2));
  const tex = useMemo(() => {
    const t = map.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1, repeat);
    t.anisotropy = 8;
    t.needsUpdate = true;
    return t;
  }, [map, repeat]);

  return (
    <mesh
      position={[cx, PATH_Y, cz]}
      rotation={[-Math.PI / 2, 0, -angle]}
      receiveShadow
    >
      <planeGeometry args={[PATH_HALF_WIDTH * 2, planeLen]} />
      <meshStandardMaterial
        map={tex}
        color="#d9c4a3"
        roughness={0.95}
        polygonOffset
        polygonOffsetFactor={-1}
        polygonOffsetUnits={-1}
      />
    </mesh>
  );
}

/** A soft circular pad to mask the corner where several ribbons meet. */
function PathNode({ at }: { at: [number, number] }) {
  return (
    <mesh
      position={[at[0], PATH_Y - 0.001, at[1]]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
    >
      <circleGeometry args={[PATH_HALF_WIDTH * 1.25, 24]} />
      <meshStandardMaterial
        color="#d9c4a3"
        roughness={0.95}
        polygonOffset
        polygonOffsetFactor={-1}
        polygonOffsetUnits={-1}
      />
    </mesh>
  );
}

/**
 * Rolling background hills: low cones/spheres ringing the play area, well
 * outside x∈[-16,16] z∈[-12,18]. Their bases sit at y=0 and they only rise as
 * they recede from the centre, so they never intrude over the walkable floor.
 */
const HILLS: Array<{
  pos: [number, number, number];
  scale: [number, number, number];
  color: string;
}> = [
  { pos: [-34, -2.5, -30], scale: [22, 7, 22], color: "#6fae6a" },
  { pos: [4, -2.5, -42], scale: [26, 8.5, 24], color: "#4e8a52" },
  { pos: [36, -2.5, -28], scale: [20, 6.5, 20], color: "#6fae6a" },
  { pos: [-44, -2.5, 4], scale: [22, 7.5, 22], color: "#4e8a52" },
  { pos: [46, -2.5, 6], scale: [24, 8, 22], color: "#6fae6a" },
  { pos: [-32, -2.5, 36], scale: [20, 6, 20], color: "#6fae6a" },
  { pos: [10, -2.5, 44], scale: [24, 7.5, 22], color: "#4e8a52" },
  { pos: [40, -2.5, 38], scale: [18, 6, 18], color: "#6fae6a" },
];

export function Terrain() {
  const [grass, path, water] = useTexture([
    "/textures/grass.png",
    "/textures/path.png",
    "/textures/water.png",
  ]);

  grass.wrapS = grass.wrapT = THREE.RepeatWrapping;
  grass.repeat.set(40, 40);
  grass.anisotropy = 8;

  water.wrapS = water.wrapT = THREE.RepeatWrapping;
  water.repeat.set(3, 3);

  // Build the path as a spanning set of ribbons: spawn -> hub -> about, and a
  // branch from the hub out to every building doorstep.
  const segments = useMemo<Array<[[number, number], [number, number]]>>(() => {
    const [spawn, about, exp, proj, skills, awards, contact] = PATH_TARGETS;
    return [
      [spawn, HUB], // player start into town
      [HUB, about], // hub to town center
      [HUB, exp],
      [HUB, proj],
      [HUB, skills],
      [HUB, awards],
      [HUB, contact],
    ];
  }, []);

  return (
    <>
      {/* PHYSICS GROUND — DO NOT MODIFY. Player walks on this flat y=0 floor. */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[70, 0.5, 70]} position={[0, -0.5, 0]} />
      </RigidBody>

      {/* Flat grass ground for the whole walkable area, exactly at y=0. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[140, 140]} />
        <meshStandardMaterial map={grass} color="#a8cf8f" roughness={1} />
      </mesh>

      {/* Background rolling hills (scenery only, outside the play radius). */}
      {HILLS.map((h, i) => (
        <mesh key={i} position={h.pos} scale={h.scale} castShadow receiveShadow>
          <sphereGeometry args={[1, 16, 12]} />
          <meshStandardMaterial color={h.color} roughness={1} flatShading />
        </mesh>
      ))}

      {/* Warm winding path: ribbons + node pads at the joins. */}
      {segments.map((s, i) => (
        <PathSegment key={i} from={s[0]} to={s[1]} map={path} />
      ))}
      <PathNode at={HUB} />
      {PATH_TARGETS.slice(1).map((t, i) => (
        <PathNode key={i} at={t} />
      ))}

      {/* Stylized calm pond — off to the west between About and Experience, well
          clear of the spawn camera (which sits behind +Z) so it never looms over
          the opening view. */}
      <group position={[-9, 0, -1]}>
        {/* sandy/mud rim just under the water to fake a shoreline */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} receiveShadow>
          <circleGeometry args={[3.6, 36]} />
          <meshStandardMaterial color="#cdb58e" roughness={1} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
          <circleGeometry args={[3.1, 36]} />
          <meshStandardMaterial
            map={water}
            color="#7fc4d6"
            transparent
            opacity={0.82}
            roughness={0.25}
            metalness={0.05}
          />
        </mesh>
      </group>
    </>
  );
}
