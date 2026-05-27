"use client";

import { RigidBody, CuboidCollider } from "@react-three/rapier";
import { ActiveCollisionTypes } from "@dimforge/rapier3d-compat";
import { Text } from "@react-three/drei";
import type { BuildingDef } from "./buildings";
import { useGame } from "./store";

const SENSOR_PAD = 2.0;

/** Ghibli storybook palette helpers (shared accent colors). */
const CREAM = "#f7f1e3";
const INK = "#4a3f35";
const WOOD = "#8a6a4a";
const WOOD_DARK = "#5f4730";
const PANE = "#cfe6e0";

/**
 * A stylized low-poly cottage built entirely from primitives, themed per résumé
 * section. The VISUALS replace the old box + cone placeholder, but the physics
 * and store wiring are preserved exactly:
 *   - a solid fixed CuboidCollider so the player can't walk through the house,
 *   - a larger sensor collider that flips `nearBuilding` for the "Press E" HUD.
 *
 * The cottage "front" (door, windows, flavor prop, signpost) is built in local
 * space facing +Z, then the whole presentation group is rotated by `faceYaw`
 * so the door + sign face roughly toward town center / the player's approach.
 */
export function Building({ def }: { def: BuildingDef }) {
  const setNear = useGame((s) => s.setNearBuilding);
  const [hw, hh, hd] = def.size;
  const [x, y, z] = def.position;

  // --- geometry derived from the footprint half-extents ---
  const wallW = hw * 2; // full wall width  (matches collider X span)
  const wallH = hh * 2; // full wall height (matches collider Y span)
  const wallD = hd * 2; // full wall depth  (matches collider Z span)

  // Gable roof: two slanted planes meeting at a ridge that runs along X.
  const eaveOverhang = 0.35;
  const roofRise = Math.min(hw, hd) * 1.15; // ridge height above the eaves
  const roofHalfDepth = hd + eaveOverhang;
  const slopeLen = Math.hypot(roofHalfDepth, roofRise); // length of one slope
  const slopeAngle = Math.atan2(roofRise, roofHalfDepth);
  const ridgeY = wallH + roofRise; // ridge height in local Y
  const roofPlankW = wallW + eaveOverhang * 2;
  const roofThick = 0.18;

  // Front-facing direction: from the building toward town center (origin).
  // about sits AT the origin, so face +Z toward the spawn point instead.
  const isCenter = x === 0 && z === 0;
  const faceYaw = isCenter ? 0 : Math.atan2(-x, -z);

  // The "front" wall sits at +Z (local) before the facing rotation is applied.
  const frontZ = hd;

  return (
    <group position={[x, y, z]}>
      {/* ---- PHYSICS (UNCHANGED) ---- */}
      {/* solid body */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[hw, hh, hd]} position={[0, hh, 0]} />
      </RigidBody>

      {/* ---- VISUALS: rotated so the door + sign face town center ---- */}
      <group rotation={[0, faceYaw, 0]}>
        {/* stone foundation / base skirt */}
        <mesh receiveShadow position={[0, 0.12, 0]}>
          <boxGeometry args={[wallW + 0.18, 0.24, wallD + 0.18]} />
          <meshStandardMaterial color="#b9ad97" flatShading roughness={1} />
        </mesh>

        {/* plaster walls */}
        <mesh castShadow receiveShadow position={[0, wallH / 2 + 0.24, 0]}>
          <boxGeometry args={[wallW, wallH, wallD]} />
          <meshStandardMaterial color={def.color} flatShading roughness={0.9} />
        </mesh>

        {/* gable triangle fills (front + back) under the pitched roof */}
        {[frontZ - 0.001, -frontZ + 0.001].map((gz, i) => (
          <mesh
            key={i}
            castShadow
            position={[0, wallH + 0.24, gz]}
            rotation={[0, i === 0 ? 0 : Math.PI, 0]}
          >
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                args={[
                  new Float32Array([
                    -hw, 0, 0,
                    hw, 0, 0,
                    0, roofRise, 0,
                  ]),
                  3,
                ]}
              />
            </bufferGeometry>
            <meshStandardMaterial color={def.color} flatShading side={2} />
          </mesh>
        ))}

        {/* ---- GABLE ROOF: two slanted planks meeting at the ridge ---- */}
        {/* +Z slope */}
        <mesh
          castShadow
          receiveShadow
          position={[0, (wallH + 0.24 + ridgeY + 0.24) / 2, roofHalfDepth / 2]}
          rotation={[-slopeAngle, 0, 0]}
        >
          <boxGeometry args={[roofPlankW, roofThick, slopeLen + 0.1]} />
          <meshStandardMaterial color={def.roof} flatShading roughness={0.85} />
        </mesh>
        {/* -Z slope */}
        <mesh
          castShadow
          receiveShadow
          position={[0, (wallH + 0.24 + ridgeY + 0.24) / 2, -roofHalfDepth / 2]}
          rotation={[slopeAngle, 0, 0]}
        >
          <boxGeometry args={[roofPlankW, roofThick, slopeLen + 0.1]} />
          <meshStandardMaterial color={def.roof} flatShading roughness={0.85} />
        </mesh>
        {/* ridge cap beam */}
        <mesh castShadow position={[0, ridgeY + 0.24, 0]}>
          <boxGeometry args={[roofPlankW + 0.05, 0.16, 0.22]} />
          <meshStandardMaterial color={WOOD_DARK} flatShading />
        </mesh>

        {/* ---- DOOR (front, +Z) ---- */}
        <group position={[0, 0.24, frontZ + 0.01]}>
          {/* frame */}
          <mesh castShadow position={[0, wallH * 0.42, 0]}>
            <boxGeometry args={[1.0, wallH * 0.82, 0.08]} />
            <meshStandardMaterial color={WOOD_DARK} flatShading />
          </mesh>
          {/* door panel */}
          <mesh castShadow position={[0, wallH * 0.42, 0.04]}>
            <boxGeometry args={[0.78, wallH * 0.7, 0.06]} />
            <meshStandardMaterial color={WOOD} flatShading roughness={0.8} />
          </mesh>
          {/* knob */}
          <mesh position={[0.26, wallH * 0.42, 0.1]}>
            <sphereGeometry args={[0.06, 8, 8]} />
            <meshStandardMaterial
              color="#e8c87a"
              emissive="#3a2f10"
              metalness={0.4}
              roughness={0.4}
            />
          </mesh>
        </group>

        {/* ---- WINDOWS (front, flanking the door) ---- */}
        {[-1, 1].map((sx) => (
          <group
            key={sx}
            position={[sx * (hw * 0.62), wallH * 0.62 + 0.24, frontZ + 0.01]}
          >
            {/* cream frame */}
            <mesh castShadow>
              <boxGeometry args={[0.62, 0.62, 0.08]} />
              <meshStandardMaterial color={CREAM} flatShading />
            </mesh>
            {/* glowing pane */}
            <mesh position={[0, 0, 0.05]}>
              <boxGeometry args={[0.44, 0.44, 0.04]} />
              <meshStandardMaterial
                color={PANE}
                emissive={PANE}
                emissiveIntensity={0.35}
                roughness={0.3}
              />
            </mesh>
            {/* muntin cross */}
            <mesh position={[0, 0, 0.08]}>
              <boxGeometry args={[0.5, 0.05, 0.02]} />
              <meshStandardMaterial color={CREAM} />
            </mesh>
            <mesh position={[0, 0, 0.08]}>
              <boxGeometry args={[0.05, 0.5, 0.02]} />
              <meshStandardMaterial color={CREAM} />
            </mesh>
          </group>
        ))}

        {/* ---- PER-SECTION FLAVOR PROP ---- */}
        <FlavorProp def={def} hw={hw} hd={hd} wallH={wallH} ridgeY={ridgeY} frontZ={frontZ} />

        {/* ---- SIGNPOST (front approach, offset from the door) ---- */}
        <group position={[hw + 0.9, 0, frontZ + 0.6]}>
          {/* post */}
          <mesh castShadow position={[0, 0.85, 0]}>
            <cylinderGeometry args={[0.06, 0.07, 1.7, 8]} />
            <meshStandardMaterial color={WOOD} flatShading />
          </mesh>
          {/* board */}
          <mesh castShadow position={[0, 1.55, 0]}>
            <boxGeometry args={[1.9, 0.6, 0.08]} />
            <meshStandardMaterial color={CREAM} flatShading roughness={0.9} />
          </mesh>
          {/* board trim */}
          <mesh position={[0, 1.55, -0.05]}>
            <boxGeometry args={[2.0, 0.7, 0.06]} />
            <meshStandardMaterial color={WOOD_DARK} flatShading />
          </mesh>
          {/* label text (faces outward, +Z) */}
          <Text
            position={[0, 1.55, 0.06]}
            fontSize={0.24}
            maxWidth={1.7}
            lineHeight={1}
            textAlign="center"
            anchorX="center"
            anchorY="middle"
            color={INK}
          >
            {def.label}
          </Text>
        </group>
      </group>

      {/* ---- PROXIMITY SENSOR (UNCHANGED) ---- */}
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

/** Small charming prop unique to each section, in cottage-local space (+Z front). */
function FlavorProp({
  def,
  hw,
  hd,
  wallH,
  ridgeY,
  frontZ,
}: {
  def: BuildingDef;
  hw: number;
  hd: number;
  wallH: number;
  ridgeY: number;
  frontZ: number;
}) {
  switch (def.id) {
    case "about":
      // Cozy chimney + a warm lantern beside the door.
      return (
        <group>
          <mesh castShadow position={[hw * 0.5, ridgeY + 0.45, hd * 0.2]}>
            <boxGeometry args={[0.45, 1.0, 0.45]} />
            <meshStandardMaterial color="#b07a5e" flatShading />
          </mesh>
          <mesh position={[hw * 0.5, ridgeY + 1.0, hd * 0.2]}>
            <boxGeometry args={[0.55, 0.15, 0.55]} />
            <meshStandardMaterial color={WOOD_DARK} flatShading />
          </mesh>
          {/* lantern on a little bracket by the door */}
          <mesh position={[0.7, wallH * 0.62, frontZ + 0.06]}>
            <boxGeometry args={[0.16, 0.24, 0.16]} />
            <meshStandardMaterial
              color="#ffd98a"
              emissive="#ffb347"
              emissiveIntensity={0.8}
            />
          </mesh>
        </group>
      );

    case "experience":
      // Tall townhouse: an extra dormer window high on the front gable.
      return (
        <mesh castShadow position={[0, wallH + 0.5, frontZ - 0.1]}>
          <boxGeometry args={[0.5, 0.5, 0.3]} />
          <meshStandardMaterial
            color={PANE}
            emissive={PANE}
            emissiveIntensity={0.3}
            flatShading
          />
        </mesh>
      );

    case "projects":
      // Workshop: a couple of stacked crates by the wall.
      return (
        <group position={[-hw - 0.45, 0, frontZ - 0.3]}>
          <mesh castShadow position={[0, 0.35, 0]}>
            <boxGeometry args={[0.7, 0.7, 0.7]} />
            <meshStandardMaterial color={WOOD} flatShading />
          </mesh>
          <mesh castShadow position={[0.1, 0.95, 0.15]} rotation={[0, 0.3, 0]}>
            <boxGeometry args={[0.55, 0.55, 0.55]} />
            <meshStandardMaterial color="#9c7a52" flatShading />
          </mesh>
        </group>
      );

    case "skills":
      // Garden shed: a planter box with little leafy spheres.
      return (
        <group position={[0, 0, frontZ + 0.45]}>
          <mesh castShadow position={[hw * 0.55, 0.18, 0]}>
            <boxGeometry args={[1.0, 0.34, 0.34]} />
            <meshStandardMaterial color={WOOD} flatShading />
          </mesh>
          {[-0.3, 0, 0.3].map((ox, i) => (
            <mesh key={i} position={[hw * 0.55 + ox, 0.45, 0]}>
              <icosahedronGeometry args={[0.16, 0]} />
              <meshStandardMaterial color="#6fae6a" flatShading />
            </mesh>
          ))}
        </group>
      );

    case "awards":
      // A little pennant banner strung from the gable.
      return (
        <group position={[0, ridgeY - 0.1, frontZ + 0.05]}>
          <mesh castShadow position={[0, 0, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 0.9, 6]} />
            <meshStandardMaterial color={WOOD_DARK} flatShading />
          </mesh>
          <mesh position={[0.28, 0.05, 0]} rotation={[0, 0, -0.4]}>
            <coneGeometry args={[0.22, 0.5, 3]} />
            <meshStandardMaterial color="#c98a8a" flatShading side={2} />
          </mesh>
        </group>
      );

    case "contact":
      // Post office: a blue mailbox on a post beside the door.
      return (
        <group position={[-hw - 0.5, 0, frontZ + 0.3]}>
          <mesh castShadow position={[0, 0.5, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 1.0, 8]} />
            <meshStandardMaterial color={WOOD} flatShading />
          </mesh>
          <mesh castShadow position={[0, 1.05, 0]}>
            <boxGeometry args={[0.34, 0.34, 0.5]} />
            <meshStandardMaterial color={def.roof} flatShading />
          </mesh>
          {/* little red flag */}
          <mesh position={[0.2, 1.18, 0.05]}>
            <boxGeometry args={[0.04, 0.18, 0.02]} />
            <meshStandardMaterial color="#d9534f" flatShading />
          </mesh>
        </group>
      );

    default:
      return null;
  }
}
