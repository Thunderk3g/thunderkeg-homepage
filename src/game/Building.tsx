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
          {/* louvered shutters flanking each pane (shared cottage nicety) */}
          {[-1, 1].map((sh) => (
            <mesh
              key={sh}
              castShadow
              position={[sh * 0.42, 0, 0.04]}
              rotation={[0, sh * 0.18, 0]}
            >
              <boxGeometry args={[0.2, 0.66, 0.05]} />
              <meshStandardMaterial color={def.roof} flatShading roughness={0.85} />
            </mesh>
          ))}
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

      {/* ---- PER-SECTION STRUCTURAL EXTRAS (varies the cottage form) ---- */}
      <CottageExtras
        def={def}
        hw={hw}
        hd={hd}
        wallH={wallH}
        wallTop={wallTop}
        ridgeY={ridgeY}
        roofRise={roofRise}
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
      // Cozy home: a warm lantern beside the door + a welcome bench under it.
      return (
        <group>
          {/* glowing lantern by the door */}
          <mesh position={[0.7, wallH * 0.62, frontZ + 0.06]}>
            <boxGeometry args={[0.16, 0.24, 0.16]} />
            <meshStandardMaterial
              color="#ffd98a"
              emissive="#ffb347"
              emissiveIntensity={0.8}
            />
          </mesh>
          {/* a small wooden bench by the door */}
          <group position={[-hw * 0.62, 0, frontZ + 0.55]} rotation={[0, -0.25, 0]}>
            <mesh castShadow position={[0, 0.34, 0]}>
              <boxGeometry args={[1.1, 0.1, 0.34]} />
              <meshStandardMaterial color={WOOD} flatShading roughness={0.9} />
            </mesh>
            <mesh castShadow position={[0, 0.56, -0.13]}>
              <boxGeometry args={[1.1, 0.34, 0.08]} />
              <meshStandardMaterial color={WOOD} flatShading roughness={0.9} />
            </mesh>
            {[-0.46, 0.46].map((lx) => (
              <mesh key={lx} castShadow position={[lx, 0.17, 0]}>
                <boxGeometry args={[0.1, 0.34, 0.3]} />
                <meshStandardMaterial color={WOOD_DARK} flatShading />
              </mesh>
            ))}
          </group>
        </group>
      );

    case "experience":
      // Tall townhouse: a dormer window high on the gable + a brass weather-vane.
      return (
        <group>
          {/* dormer window */}
          <group position={[0, wallH + 0.5, frontZ - 0.1]}>
            <mesh castShadow>
              <boxGeometry args={[0.6, 0.6, 0.32]} />
              <meshStandardMaterial color={CREAM} flatShading />
            </mesh>
            <mesh position={[0, 0, 0.18]}>
              <boxGeometry args={[0.42, 0.42, 0.06]} />
              <meshStandardMaterial
                color={PANE}
                emissive={PANE}
                emissiveIntensity={0.32}
                flatShading
              />
            </mesh>
            {/* tiny dormer roof */}
            <mesh castShadow position={[0, 0.42, 0.02]} rotation={[Math.PI / 4, 0, 0]}>
              <boxGeometry args={[0.7, 0.06, 0.42]} />
              <meshStandardMaterial color={def.roof} flatShading />
            </mesh>
          </group>
          {/* weather-vane on the ridge: post + arrow + N marker */}
          <group position={[0, ridgeY + 0.2, 0]}>
            <mesh castShadow position={[0, 0.35, 0]}>
              <cylinderGeometry args={[0.03, 0.03, 0.7, 6]} />
              <meshStandardMaterial color={WOOD_DARK} flatShading metalness={0.3} />
            </mesh>
            <mesh position={[0, 0.7, 0]} rotation={[0, 0, Math.PI / 2]}>
              <coneGeometry args={[0.1, 0.34, 4]} />
              <meshStandardMaterial
                color="#e8c87a"
                emissive="#3a2f10"
                metalness={0.5}
                roughness={0.4}
              />
            </mesh>
            <mesh position={[0, 0.7, 0]}>
              <sphereGeometry args={[0.06, 6, 6]} />
              <meshStandardMaterial color="#e8c87a" metalness={0.5} roughness={0.4} />
            </mesh>
          </group>
        </group>
      );

    case "projects":
      // Workshop: a workbench, stacked crates with tools, and a barrel.
      return (
        <group>
          {/* stacked crates by the wall */}
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
          {/* workbench out front with a couple of upright tools */}
          <group position={[hw * 0.7, 0, frontZ + 0.7]} rotation={[0, -0.3, 0]}>
            <mesh castShadow position={[0, 0.5, 0]}>
              <boxGeometry args={[1.2, 0.12, 0.5]} />
              <meshStandardMaterial color={WOOD} flatShading roughness={0.9} />
            </mesh>
            {[-0.5, 0.5].map((lx) => (
              <mesh key={lx} castShadow position={[lx, 0.25, 0]}>
                <boxGeometry args={[0.1, 0.5, 0.1]} />
                <meshStandardMaterial color={WOOD_DARK} flatShading />
              </mesh>
            ))}
            {/* tool: a hammer leaning on the bench */}
            <mesh castShadow position={[-0.35, 0.85, 0.1]} rotation={[0, 0, 0.35]}>
              <cylinderGeometry args={[0.03, 0.03, 0.7, 6]} />
              <meshStandardMaterial color={WOOD_DARK} flatShading />
            </mesh>
            <mesh castShadow position={[-0.46, 1.16, 0.1]}>
              <boxGeometry args={[0.18, 0.1, 0.12]} />
              <meshStandardMaterial color={STONE_DARK} flatShading metalness={0.3} />
            </mesh>
          </group>
          {/* a wooden barrel */}
          <group position={[hw + 0.55, 0, frontZ - 0.4]}>
            <mesh castShadow position={[0, 0.45, 0]}>
              <cylinderGeometry args={[0.36, 0.32, 0.9, 10]} />
              <meshStandardMaterial color={WOOD} flatShading roughness={0.9} />
            </mesh>
            {[0.18, 0.72].map((by) => (
              <mesh key={by} position={[0, by, 0]}>
                <torusGeometry args={[0.36, 0.03, 6, 12]} />
                <meshStandardMaterial color={WOOD_DARK} flatShading metalness={0.3} />
              </mesh>
            ))}
          </group>
        </group>
      );

    case "skills":
      // Greenhouse garden: planter boxes with rows of little plants.
      return (
        <group position={[0, 0, frontZ + 0.45]}>
          {[-1, 1].map((sx) => (
            <group key={sx} position={[sx * hw * 0.55, 0, 0]}>
              <mesh castShadow position={[0, 0.18, 0]}>
                <boxGeometry args={[1.0, 0.34, 0.34]} />
                <meshStandardMaterial color={WOOD} flatShading />
              </mesh>
              {[-0.3, 0, 0.3].map((ox, i) => (
                <mesh key={i} position={[ox, 0.45, 0]}>
                  <icosahedronGeometry args={[0.16, 0]} />
                  <meshStandardMaterial
                    color={i % 2 ? "#6fae6a" : "#8fc88a"}
                    flatShading
                  />
                </mesh>
              ))}
              {/* a couple of little flower sprigs */}
              {[-0.18, 0.18].map((ox) => (
                <mesh key={ox} position={[ox, 0.5, 0.05]}>
                  <coneGeometry args={[0.07, 0.22, 6]} />
                  <meshStandardMaterial
                    color="#e7b6d0"
                    emissive="#e7b6d0"
                    emissiveIntensity={0.1}
                    flatShading
                  />
                </mesh>
              ))}
            </group>
          ))}
        </group>
      );

    case "awards":
      // Small hall: a trophy on a plinth out front + pennant on the gable.
      return (
        <group>
          {/* a pennant banner strung from the gable apex */}
          <group position={[0, ridgeY - 0.1, frontZ + 0.05]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.04, 0.04, 0.9, 6]} />
              <meshStandardMaterial color={WOOD_DARK} flatShading />
            </mesh>
            <mesh position={[0.28, 0.05, 0]} rotation={[0, 0, -0.4]}>
              <coneGeometry args={[0.22, 0.5, 3]} />
              <meshStandardMaterial color="#c98a8a" flatShading side={2} />
            </mesh>
          </group>
          {/* trophy on a stone plinth out front */}
          <group position={[hw + 0.7, 0, frontZ + 0.6]}>
            <mesh castShadow receiveShadow position={[0, 0.3, 0]}>
              <boxGeometry args={[0.6, 0.6, 0.6]} />
              <meshStandardMaterial color={STONE} flatShading roughness={1} />
              <Outlines thickness={OUTLINE_THICKNESS} color={INK} />
            </mesh>
            {/* gold cup: bowl + stem + base */}
            <mesh castShadow position={[0, 0.95, 0]}>
              <cylinderGeometry args={[0.18, 0.1, 0.26, 10]} />
              <meshStandardMaterial
                color="#e8c87a"
                emissive="#5a4410"
                emissiveIntensity={0.4}
                metalness={0.6}
                roughness={0.35}
              />
            </mesh>
            <mesh position={[0, 0.74, 0]}>
              <cylinderGeometry args={[0.04, 0.04, 0.18, 8]} />
              <meshStandardMaterial color="#e8c87a" metalness={0.6} roughness={0.35} />
            </mesh>
            <mesh position={[0, 0.65, 0]}>
              <cylinderGeometry args={[0.14, 0.16, 0.08, 10]} />
              <meshStandardMaterial color="#e8c87a" metalness={0.6} roughness={0.35} />
            </mesh>
          </group>
        </group>
      );

    case "contact":
      // Post office: a mailbox on a post + a "POST" sign by the door.
      return (
        <group>
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
          {/* small "POST" sign mounted beside the door */}
          <group position={[0.95, wallH * 0.6, frontZ + 0.06]}>
            <mesh castShadow>
              <boxGeometry args={[0.66, 0.28, 0.06]} />
              <meshStandardMaterial color="#3f6f9c" flatShading roughness={0.85} />
            </mesh>
            <Text
              position={[0, 0, 0.05]}
              fontSize={0.16}
              anchorX="center"
              anchorY="middle"
              color={CREAM}
            >
              POST
            </Text>
          </group>
        </group>
      );

    default:
      return null;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// COTTAGE EXTRAS — per-section tweaks to the cottage FORM itself.
// (Layered on top of the base shell so the silhouette differs per section.)
// ──────────────────────────────────────────────────────────────────────────

/** Per-section structural overlays in cottage-local space (+Z front). */
function CottageExtras({
  def,
  hw,
  hd,
  wallH,
  wallTop,
  ridgeY,
  roofRise,
  frontZ,
}: {
  def: BuildingDef;
  hw: number;
  hd: number;
  wallH: number;
  wallTop: number;
  ridgeY: number;
  roofRise: number;
  frontZ: number;
}) {
  switch (def.id) {
    case "about":
      // Cozy home: flower window-boxes get an extra trailing-bloom touch and a
      // taller secondary chimney pot on the standard chimney's cap.
      return (
        <group position={[hw * 0.55, ridgeY * 1.18 + 0.18, -hd * 0.25]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.12, 0.14, 0.4, 8]} />
            <meshStandardMaterial color="#9a5e44" flatShading roughness={0.95} />
          </mesh>
        </group>
      );

    case "experience": {
      // Tall townhouse: a clock face set into the upper gable.
      const cy = wallTop + roofRise * 0.45;
      return (
        <group position={[0, cy, frontZ + 0.04]}>
          <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.42, 0.42, 0.1, 16]} />
            <meshStandardMaterial color={CREAM} flatShading />
          </mesh>
          <mesh position={[0, 0, 0.06]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.34, 0.34, 0.04, 16]} />
            <meshStandardMaterial color="#f3ede0" flatShading />
          </mesh>
          {/* hands */}
          <mesh position={[0, 0.08, 0.1]}>
            <boxGeometry args={[0.04, 0.22, 0.02]} />
            <meshStandardMaterial color={INK} />
          </mesh>
          <mesh position={[0.1, 0, 0.1]} rotation={[0, 0, Math.PI / 2]}>
            <boxGeometry args={[0.03, 0.3, 0.02]} />
            <meshStandardMaterial color={INK} />
          </mesh>
        </group>
      );
    }

    case "projects": {
      // Workshop: a lean-to shed roof tacked onto the +X side wall.
      const leanW = 1.5;
      return (
        <group position={[hw + leanW / 2, wallH * 0.55, 0]}>
          {/* slanted lean-to roof plane */}
          <mesh castShadow receiveShadow rotation={[0, 0, -0.5]} position={[0, 0.3, 0]}>
            <boxGeometry args={[leanW + 0.3, 0.12, hd * 1.6]} />
            <meshStandardMaterial color={def.roof} flatShading roughness={0.85} />
            <Outlines thickness={OUTLINE_THICKNESS} color={INK} />
          </mesh>
          {/* two support posts at the outer eave */}
          {[-1, 1].map((sz) => (
            <mesh
              key={sz}
              castShadow
              position={[leanW / 2 - 0.1, -wallH * 0.27, sz * hd * 0.6]}
            >
              <cylinderGeometry args={[0.07, 0.08, wallH * 0.6, 6]} />
              <meshStandardMaterial color={WOOD_DARK} flatShading />
            </mesh>
          ))}
        </group>
      );
    }

    case "skills": {
      // Greenhouse: a translucent glass roof section over the +Z front slope.
      return (
        <mesh
          position={[0, wallTop + roofRise * 0.5, frontZ * 0.5 + 0.05]}
          rotation={[-Math.atan2(roofRise, hd) , 0, 0]}
        >
          <boxGeometry args={[hw * 1.4, 0.06, hd * 1.05]} />
          <meshStandardMaterial
            color="#cfeee6"
            emissive="#bfe6dc"
            emissiveIntensity={0.25}
            transparent
            opacity={0.5}
            flatShading
            roughness={0.2}
          />
        </mesh>
      );
    }

    case "awards": {
      // Small hall: a string of pennant flags across the front gable, posts to apex.
      const flags = [-0.7, -0.35, 0, 0.35, 0.7];
      const palette = ["#c98a8a", "#e8c0c0", "#f0d27a", "#9fcf9a", "#bcd9e8"];
      return (
        <group position={[0, wallTop + roofRise * 0.55, frontZ + 0.08]}>
          {/* slack string line (a thin box dipping below the apex) */}
          <mesh position={[0, -0.1, 0]}>
            <boxGeometry args={[hw * 1.8, 0.02, 0.02]} />
            <meshStandardMaterial color={WOOD_DARK} />
          </mesh>
          {flags.map((fx, i) => (
            <mesh
              key={i}
              position={[fx * hw, -0.28, 0]}
              rotation={[Math.PI, 0, 0]}
            >
              <coneGeometry args={[0.1, 0.3, 3]} />
              <meshStandardMaterial color={palette[i]} flatShading side={2} />
            </mesh>
          ))}
        </group>
      );
    }

    case "contact": {
      // Post office: a horizontal letter slot recessed into the door.
      return (
        <mesh position={[0, wallH * 0.5, frontZ + 0.09]}>
          <boxGeometry args={[0.34, 0.07, 0.04]} />
          <meshStandardMaterial color={INK} />
        </mesh>
      );
    }

    default:
      return null;
  }
}
