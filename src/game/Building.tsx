"use client";

import { Component, Suspense, type ReactNode } from "react";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import { ActiveCollisionTypes } from "@dimforge/rapier3d-compat";
import { Text, Outlines, useGLTF } from "@react-three/drei";
import { Box3, Vector3 } from "three";
import type { BuildingDef } from "./buildings";
import { useGame } from "./store";

const SENSOR_PAD = 2.0;

/** Ghibli storybook palette helpers (shared accent colors). */
const CREAM = "#f7f1e3";
const INK = "#4a3f35";
const WOOD = "#8a6a4a";
const WOOD_DARK = "#5f4730";
const PANE = "#cfe6e0";
const STONE = "#b9ad97";
const STONE_DARK = "#9a8e78";

/** Cheap storybook ink edge shared by the walls + roof. */
const OUTLINE_THICKNESS = 0.015;

/**
 * A stylized low-poly cottage themed per résumé section. The VISUALS are either
 * an authored GLB model (when `def.model` is set AND loads) or a polished
 * procedural cottage built from primitives. Either way the physics + store
 * wiring are preserved exactly:
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

  // Front-facing direction: from the building toward town center (origin).
  // about sits AT the origin, so face +Z toward the spawn point instead.
  const isCenter = x === 0 && z === 0;
  const faceYaw = isCenter ? 0 : Math.atan2(-x, -z);

  return (
    <group position={[x, y, z]}>
      {/* ---- PHYSICS (UNCHANGED) ---- */}
      {/* solid body */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[hw, hh, hd]} position={[0, hh, 0]} />
      </RigidBody>

      {/* ---- VISUALS: rotated so the door + sign face town center ---- */}
      <group rotation={[0, faceYaw, 0]}>
        {def.model ? (
          // Authored-model path. The model component THROWS on a load failure
          // (e.g. a 404), and the boundary catches it and renders the
          // procedural cottage instead. While the GLB streams in, Suspense
          // shows the procedural cottage too, so there's never an empty plot.
          <ModelErrorBoundary fallback={<ProceduralCottage def={def} />}>
            <Suspense fallback={<ProceduralCottage def={def} />}>
              <AuthoredHouse url={def.model} def={def} />
            </Suspense>
          </ModelErrorBoundary>
        ) : (
          <ProceduralCottage def={def} />
        )}
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

// ──────────────────────────────────────────────────────────────────────────
// PROCEDURAL COTTAGE — the default, charming low-poly house.
// ──────────────────────────────────────────────────────────────────────────

/**
 * The polished primitive cottage. Built in cottage-local space with its front
 * (door + windows + sign) facing +Z; the parent group applies `faceYaw`.
 *
 * Doubles as the Suspense / error fallback for the authored-model path, so it
 * takes only `def` and re-derives its geometry from the footprint.
 */
function ProceduralCottage({ def }: { def: BuildingDef }) {
  const [hw, hh, hd] = def.size;

  // --- geometry derived from the footprint half-extents ---
  const wallW = hw * 2; // full wall width  (matches collider X span)
  const wallH = hh * 2; // full wall height (matches collider Y span)
  const wallD = hd * 2; // full wall depth  (matches collider Z span)

  // The plaster wall box is lifted by the stone skirt height, so its top sits
  // a touch above the collider top — that's the eave line the roof rests on.
  const skirtH = 0.24;
  const wallTop = wallH + skirtH; // local Y of the eave line

  // Gable roof: two slanted planes meeting at a ridge that runs along X.
  const eaveOverhang = 0.35;
  const roofRise = Math.min(hw, hd) * 1.15; // ridge height above the eaves
  const roofHalfDepth = hd + eaveOverhang; // eave-edge Z (with overhang)
  const slopeLen = Math.hypot(roofHalfDepth, roofRise); // length of one slope
  const slopeAngle = Math.atan2(roofRise, roofHalfDepth); // pitch from horizontal
  const ridgeY = wallTop + roofRise; // ridge height in local Y (ABOVE the eaves)
  const roofPlankW = wallW + eaveOverhang * 2;
  const roofThick = 0.18;

  // The "front" wall sits at +Z (local) before the facing rotation is applied.
  const frontZ = hd;

  return (
    <group>
      {/* ---- stone foundation / base skirt ---- */}
      <mesh receiveShadow position={[0, 0.12, 0]}>
        <boxGeometry args={[wallW + 0.18, 0.24, wallD + 0.18]} />
        <meshStandardMaterial color={STONE} flatShading roughness={1} />
      </mesh>
      {/* a couple of chunky cornerstones for storybook texture */}
      {[
        [-(hw + 0.06), wallD * 0.34],
        [hw + 0.06, -(wallD * 0.34)],
      ].map(([cx, cz], i) => (
        <mesh key={i} receiveShadow position={[cx, 0.16, cz]}>
          <boxGeometry args={[0.34, 0.32, 0.34]} />
          <meshStandardMaterial color={STONE_DARK} flatShading roughness={1} />
        </mesh>
      ))}

      {/* ---- plaster walls ---- */}
      <mesh castShadow receiveShadow position={[0, wallH / 2 + skirtH, 0]}>
        <boxGeometry args={[wallW, wallH, wallD]} />
        <meshStandardMaterial color={def.color} flatShading roughness={0.9} />
        <Outlines thickness={OUTLINE_THICKNESS} color={INK} />
      </mesh>

      {/* ---- gable triangle fills (front + back) under the pitched roof ---- */}
      {[frontZ - 0.001, -frontZ + 0.001].map((gz, i) => (
        <mesh
          key={i}
          castShadow
          position={[0, wallTop, gz]}
          rotation={[0, i === 0 ? 0 : Math.PI, 0]}
        >
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[
                new Float32Array([-hw, 0, 0, hw, 0, 0, 0, roofRise, 0]),
                3,
              ]}
            />
          </bufferGeometry>
          <meshStandardMaterial color={def.color} flatShading side={2} />
        </mesh>
      ))}

      {/* ---- timber gable trim (barge boards along the front gable edges) ---- */}
      {/*
        Each board runs along one sloping edge of the front gable triangle,
        from the apex (0, wallTop + roofRise) down to an eave corner (±hw,
        wallTop). A vertical box is rolled about Z by the edge's tilt from
        vertical, atan2(hw, roofRise), mirrored per side.
      */}
      {[1, -1].map((sx) => (
        <mesh
          key={sx}
          castShadow
          position={[(sx * hw) / 2, wallTop + roofRise / 2, frontZ + 0.04]}
          rotation={[0, 0, sx * Math.atan2(hw, roofRise)]}
        >
          <boxGeometry args={[0.12, Math.hypot(hw, roofRise), 0.1]} />
          <meshStandardMaterial color={WOOD_DARK} flatShading />
        </mesh>
      ))}

      {/* ---- GABLE ROOF: two slanted planks pivoting from the EAVE edge ---- */}
      {/*
        Each slope is a flat box whose pivot group sits ON the eave line
        (y = wallTop, z = ±roofHalfDepth). The group tilts UP toward the ridge
        so the plank's lower edge stays at the eave while it climbs to the ridge
        at (y = ridgeY, z = 0). The plank is offset by half its length toward
        the ridge (local ∓Z, away from the eave), planting its lower edge
        exactly at the pivot. Net: lower edge at the eave, upper edge at the
        ridge ABOVE the wall top — a proper, non-sunken gable.
      */}
      {[1, -1].map((side) => (
        <group
          key={side}
          position={[0, wallTop, side * roofHalfDepth]}
          // +Z slope tilts its top toward the ridge (-Z); -Z slope mirrors it.
          rotation={[side * slopeAngle, 0, 0]}
        >
          <mesh castShadow receiveShadow position={[0, 0, (-side * slopeLen) / 2]}>
            <boxGeometry args={[roofPlankW, roofThick, slopeLen]} />
            <meshStandardMaterial color={def.roof} flatShading roughness={0.85} />
            <Outlines thickness={OUTLINE_THICKNESS} color={INK} />
          </mesh>
        </group>
      ))}
      {/* ridge cap beam, sitting just above where the two slopes meet */}
      <mesh castShadow position={[0, ridgeY + roofThick * 0.6, 0]}>
        <boxGeometry args={[roofPlankW + 0.05, 0.16, 0.22]} />
        <meshStandardMaterial color={WOOD_DARK} flatShading />
      </mesh>

      {/* ---- DOOR (front, +Z) ---- */}
      <group position={[0, skirtH, frontZ + 0.01]}>
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
        {/* arched lintel stone above the door */}
        <mesh castShadow position={[0, wallH * 0.84, 0.02]}>
          <boxGeometry args={[1.1, 0.16, 0.1]} />
          <meshStandardMaterial color={STONE} flatShading roughness={1} />
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
          position={[sx * (hw * 0.62), wallH * 0.62 + skirtH, frontZ + 0.01]}
        >
          {/* cream frame */}
          <mesh castShadow>
            <boxGeometry args={[0.62, 0.62, 0.08]} />
            <meshStandardMaterial color={CREAM} flatShading />
          </mesh>
          {/* glowing pane (cheap emissive — no light, no texture) */}
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
          {/* a little flower-box sill beneath each window */}
          <mesh castShadow position={[0, -0.42, 0.07]}>
            <boxGeometry args={[0.6, 0.16, 0.18]} />
            <meshStandardMaterial color={WOOD} flatShading />
          </mesh>
          {[-0.16, 0.16].map((ox) => (
            <mesh key={ox} position={[ox, -0.34, 0.12]}>
              <icosahedronGeometry args={[0.09, 0]} />
              <meshStandardMaterial color="#d98ab0" flatShading />
            </mesh>
          ))}
        </group>
      ))}

      {/* ---- CHIMNEY (stone, with a warm cap) ---- */}
      <group position={[hw * 0.55, 0, -hd * 0.25]}>
        <mesh castShadow position={[0, ridgeY * 0.55, 0]}>
          <boxGeometry args={[0.5, ridgeY * 1.1, 0.5]} />
          <meshStandardMaterial color="#b07a5e" flatShading roughness={0.95} />
          <Outlines thickness={OUTLINE_THICKNESS} color={INK} />
        </mesh>
        <mesh castShadow position={[0, ridgeY * 1.1 + 0.08, 0]}>
          <boxGeometry args={[0.6, 0.16, 0.6]} />
          <meshStandardMaterial color={WOOD_DARK} flatShading />
        </mesh>
      </group>

      {/* ---- PER-SECTION FLAVOR PROP ---- */}
      <FlavorProp
        def={def}
        hw={hw}
        hd={hd}
        wallH={wallH}
        ridgeY={ridgeY}
        frontZ={frontZ}
      />

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
  );
}

// ──────────────────────────────────────────────────────────────────────────
// AUTHORED-MODEL PATH — load a GLB house, fall back to procedural on failure.
// ──────────────────────────────────────────────────────────────────────────

/**
 * Renders an authored GLB house, scaled + grounded to fill the footprint
 * `def.size`. `useGLTF` suspends while loading and THROWS on a load failure
 * (e.g. a 404), which the surrounding <ModelErrorBoundary> catches to fall back
 * to the procedural cottage. Models are assumed authored with their origin at
 * the base center and forward facing +Z, matching the procedural cottage.
 */
function AuthoredHouse({ url, def }: { url: string; def: BuildingDef }) {
  const { scene } = useGLTF(url);
  const [hw, hh, hd] = def.size;

  // Clone so multiple buildings can reuse the same cached GLB independently,
  // then measure its bounds to scale it into the footprint and sit it on y = 0.
  const root = scene.clone(true);
  const box = new Box3().setFromObject(root);
  const size = new Vector3();
  const center = new Vector3();
  box.getSize(size);
  box.getCenter(center);

  // Fit the model inside the footprint box (2*hw × 2*hh × 2*hd), preserving its
  // aspect ratio so it never looks squashed; guard against degenerate bounds.
  const fit = Math.min(
    size.x > 1e-4 ? (hw * 2) / size.x : 1,
    size.y > 1e-4 ? (hh * 2) / size.y : 1,
    size.z > 1e-4 ? (hd * 2) / size.z : 1
  );

  // After scaling, recenter on X/Z and drop the model's bottom onto y = 0.
  // The group's `position` lives in PARENT space (it is NOT affected by the
  // group's own `scale`), so the scaled-bounds offsets apply directly here.
  const offX = -center.x * fit;
  const offZ = -center.z * fit;
  const offY = -box.min.y * fit;

  return (
    <group scale={fit} position={[offX, offY, offZ]}>
      <primitive object={root} />
    </group>
  );
}

interface BoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}
interface BoundaryState {
  hasError: boolean;
}

/**
 * Local boundary for the authored-model path: if the GLB component throws
 * (load error / 404), render the procedural cottage fallback instead of
 * propagating the crash up to the whole-canvas CanvasErrorBoundary.
 */
class ModelErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { hasError: false };

  static getDerivedStateFromError(): BoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.warn("House model failed to load; using procedural cottage:", error);
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// FLAVOR PROPS — small charming touches unique to each section.
// ──────────────────────────────────────────────────────────────────────────

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
      // Cozy warm lantern beside the door (the chimney is now standard).
      return (
        <mesh position={[0.7, wallH * 0.62, frontZ + 0.06]}>
          <boxGeometry args={[0.16, 0.24, 0.16]} />
          <meshStandardMaterial
            color="#ffd98a"
            emissive="#ffb347"
            emissiveIntensity={0.8}
          />
        </mesh>
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
