"use client";

import { useMemo } from "react";
import { useTexture, Text } from "@react-three/drei";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import * as THREE from "three";

import { BUILDINGS } from "@/game/buildings";
import { PLAZA, GATE, frontOf } from "@/world/layout";

/**
 * Ground + village green + well + paths + gate + pond + background hills.
 * SEAM owned by the natural-environment agent.
 *
 * Physics: the player is a kinematic controller that walks on a FLAT physics
 * floor at y=0. The fixed-body CuboidCollider below MUST be preserved, and the
 * VISUAL ground in the play area (x∈[-16,16], z∈[-13,13]) must never poke above
 * y=0 (the player would clip through it). The play-area ground is therefore a
 * flat plane at y=0; only DECORATIVE landmarks (well, gate) rise above y=0, and
 * gently rolling hills are added solely as background scenery OUTSIDE the play
 * area (|x|>22 or z<-22 / z>24) so nothing intrudes over the walkable floor.
 */

const PATH_Y = 0.02;
const PATH_HALF_WIDTH = 1.1;

// Warm dirt palette reused by every path tile / node so they share one look.
const PATH_TINT = "#d9c4a3";

/** A single straight cobble/dirt ribbon segment between two XZ points. */
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
        color={PATH_TINT}
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
        color={PATH_TINT}
        roughness={0.95}
        polygonOffset
        polygonOffsetFactor={-1}
        polygonOffsetUnits={-1}
      />
    </mesh>
  );
}

/**
 * Charming low-poly wishing well at the plaza centre. Visual only (no collider):
 * a stone basin, a still water disc, two timber posts, and a little gable roof.
 * All flat-shaded with warm colours to read as hand-built.
 */
function WishingWell() {
  return (
    <group position={[PLAZA.x, 0, PLAZA.z]}>
      {/* stone basin (short, wide cylinder) */}
      <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.95, 1.05, 0.9, 12]} />
        <meshStandardMaterial color="#b7a890" roughness={1} flatShading />
      </mesh>
      {/* mossy stone rim */}
      <mesh position={[0, 0.92, 0]} castShadow>
        <cylinderGeometry args={[1.0, 1.0, 0.16, 12]} />
        <meshStandardMaterial color="#9aa07a" roughness={1} flatShading />
      </mesh>
      {/* still water just below the rim */}
      <mesh position={[0, 0.84, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.82, 16]} />
        <meshStandardMaterial
          color="#5fa8c0"
          roughness={0.3}
          metalness={0.05}
          transparent
          opacity={0.9}
        />
      </mesh>
      {/* two timber posts holding the roof */}
      {[-0.78, 0.78].map((x) => (
        <mesh key={x} position={[x, 1.55, 0]} castShadow>
          <boxGeometry args={[0.16, 1.3, 0.16]} />
          <meshStandardMaterial color="#8a5a3a" roughness={1} flatShading />
        </mesh>
      ))}
      {/* cross-beam + winding bucket */}
      <mesh position={[0, 2.15, 0]} castShadow>
        <boxGeometry args={[1.85, 0.14, 0.14]} />
        <meshStandardMaterial color="#9a6a44" roughness={1} flatShading />
      </mesh>
      <mesh position={[0, 1.55, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.16, 0.32, 8]} />
        <meshStandardMaterial color="#7a4a2a" roughness={1} flatShading />
      </mesh>
      {/* little gable roof (a flat-shaded cone reads as a thatched/shingle peak) */}
      <mesh position={[0, 2.5, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[1.5, 0.85, 4]} />
        <meshStandardMaterial color="#c8745f" roughness={1} flatShading />
      </mesh>
    </group>
  );
}

/**
 * South gate / entrance arch: two timber posts, a top beam, and a small hanging
 * "Welcome" sign. Decorative landmark only (no collider) — sits at the GATE.
 */
function GateArch() {
  const [gx, gz] = GATE;
  const span = 3.2;
  return (
    <group position={[gx, 0, gz]}>
      {[-span / 2, span / 2].map((x) => (
        <mesh key={x} position={[x, 1.7, 0]} castShadow>
          <boxGeometry args={[0.3, 3.4, 0.3]} />
          <meshStandardMaterial color="#8a5a3a" roughness={1} flatShading />
        </mesh>
      ))}
      {/* top beam */}
      <mesh position={[0, 3.45, 0]} castShadow>
        <boxGeometry args={[span + 0.7, 0.34, 0.34]} />
        <meshStandardMaterial color="#9a6a44" roughness={1} flatShading />
      </mesh>
      {/* hanging sign board */}
      <mesh position={[0, 2.95, 0.02]} castShadow>
        <boxGeometry args={[1.7, 0.62, 0.08]} />
        <meshStandardMaterial color="#e8d8b8" roughness={1} flatShading />
      </mesh>
      <Text
        position={[0, 2.95, 0.08]}
        fontSize={0.3}
        anchorX="center"
        anchorY="middle"
        color="#5a3a22"
      >
        Welcome
      </Text>
    </group>
  );
}

/**
 * Rolling background hills ringing the FAR edges only — well outside the play
 * area (|x|>22 or z<-22 / z>24). Their bases sit below y=0 so they only rise as
 * they recede from the centre, never intruding over the walkable floor, and
 * their warm tones dissolve into the fog at the horizon.
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
  { pos: [-32, -2.5, 38], scale: [20, 6, 20], color: "#6fae6a" },
  { pos: [10, -2.5, 46], scale: [24, 7.5, 22], color: "#4e8a52" },
  { pos: [40, -2.5, 40], scale: [18, 6, 18], color: "#6fae6a" },
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

  // A second, more tightly-tiled grass clone for the village green so it reads
  // as a slightly different, well-trodden tone without a second texture upload.
  const greenGrass = useMemo(() => {
    const t = grass.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(6, 6);
    t.anisotropy = 8;
    t.needsUpdate = true;
    return t;
  }, [grass]);

  water.wrapS = water.wrapT = THREE.RepeatWrapping;
  water.repeat.set(3, 3);

  // Build the path network from the shared layout: a ring node at the plaza
  // edge feeds a ribbon to each building's doorstep (frontOf) and to the gate.
  const ringNode: [number, number] = [PLAZA.x, PLAZA.z + PLAZA.radius];
  const segments = useMemo<Array<[[number, number], [number, number]]>>(() => {
    const segs: Array<[[number, number], [number, number]]> = [];
    // plaza out to each cottage doorstep
    for (const b of BUILDINGS) {
      segs.push([[PLAZA.x, PLAZA.z], frontOf(b.position, b.size)]);
    }
    // plaza down to the south gate, threaded through a ring node so the join
    // sits neatly on the green's southern edge
    segs.push([[PLAZA.x, PLAZA.z], ringNode]);
    segs.push([ringNode, GATE]);
    return segs;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

      {/* Village GREEN: a circular dirt/cobble ring around a fresher inner lawn,
          centred on the plaza. Sits a hair above the ground to avoid z-fight. */}
      <group position={[PLAZA.x, 0, PLAZA.z]}>
        {/* trodden dirt ring (the "cobble" margin of the green) */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]} receiveShadow>
          <ringGeometry args={[PLAZA.radius - 0.5, PLAZA.radius + 0.6, 40]} />
          <meshStandardMaterial map={path} color={PATH_TINT} roughness={0.95} />
        </mesh>
        {/* fresher inner lawn (distinct, tighter-tiled grass tone) */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]} receiveShadow>
          <circleGeometry args={[PLAZA.radius, 40]} />
          <meshStandardMaterial map={greenGrass} color="#bcdf9c" roughness={1} />
        </mesh>
      </group>

      {/* Warm cobble/dirt paths: ribbons + node pads at the joins. */}
      {segments.map((s, i) => (
        <PathSegment key={i} from={s[0]} to={s[1]} map={path} />
      ))}
      <PathNode at={ringNode} />
      {BUILDINGS.map((b, i) => (
        <PathNode key={i} at={frontOf(b.position, b.size)} />
      ))}

      {/* Plaza centrepiece + south gate landmarks. */}
      <WishingWell />
      <GateArch />

      {/* Stylized calm pond — off to the west between About and Experience, well
          clear of the spawn camera and of the paths/buildings. Centre matches the
          Scatter pond-avoidance constant (-9,-1) so lily pads land on it. */}
      <group position={[-9, 0, -1]}>
        {/* sandy/mud rim just under the water to fake a shoreline */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} receiveShadow>
          <circleGeometry args={[3.6, 36]} />
          <meshStandardMaterial color="#cdb58e" roughness={1} />
        </mesh>
        {/* low grassy rim ridge to read the shoreline edge */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.018, 0]} receiveShadow>
          <ringGeometry args={[3.2, 3.6, 36]} />
          <meshStandardMaterial color="#9fbf7a" roughness={1} />
        </mesh>
        {/* translucent tinted water disc */}
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

      {/* Background rolling hills (scenery only, outside the play area). */}
      {HILLS.map((h, i) => (
        <mesh key={i} position={h.pos} scale={h.scale} castShadow receiveShadow>
          <sphereGeometry args={[1, 16, 12]} />
          <meshStandardMaterial color={h.color} roughness={1} flatShading />
        </mesh>
      ))}
    </>
  );
}
