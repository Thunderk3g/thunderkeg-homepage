"use client";

import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CuboidCollider } from "@react-three/rapier";
import { ActiveCollisionTypes } from "@dimforge/rapier3d-compat";
import { Billboard, Text } from "@react-three/drei";

import { Monster } from "./Monster";
import { useQuests, QUEST_GOAL, type QuestId, type QuestStatus } from "./quests";
import { useGame } from "./store";
import { useInteractPressed } from "./interaction";
import { playerPosition } from "./refs";
import { BUILDINGS, getBuilding } from "./buildings";
import { MONSTER_FIELD, frontOf } from "@/world/layout";
import type { MonsterModel } from "./assets";

/**
 * In-world quest entities, rendered INSIDE the Canvas/Physics tree.
 * Each group is gated on its quest status (subscribed via selectors so a group
 * only mounts while its quest is active).
 *
 * Kept deliberately cheap for the Intel iGPU budget: low-poly primitives,
 * emissive accents, no post-processing, and allocation-free per-frame reads of
 * playerPosition.
 */
export function QuestEntities() {
  const bugHunt = useQuests((s) => s.status["bug-hunt"]);
  const kafka = useQuests((s) => s.status["kafka-courier"]);
  const cache = useQuests((s) => s.status["cache-match"]);

  return (
    <>
      {bugHunt === "active" && <BugHunt />}
      {kafka === "active" && <KafkaCourier />}
      {cache === "active" && <CacheShrine />}

      {/* Quest-giver markers float above each cottage that offers a quest,
          reflecting its status (! to start · ▶ in progress · ✓ done). */}
      <QuestGiverMarkers />

      {/* A soft objective beacon glows over the active quest's target so the
          player knows where to go next. */}
      <ObjectiveBeacons />
    </>
  );
}

/* ============================================================
   QUEST-GIVER MARKERS — a bobbing billboard icon above each
   cottage that has a `quest`, gated by that quest's status.
   ============================================================ */

/** Per-status glyph + palette for the floating marker. */
const MARKER_STYLE: Record<
  QuestStatus,
  { glyph: string; color: string; emissive: string; intensity: number }
> = {
  inactive: { glyph: "!", color: "#f0d27a", emissive: "#f0c84a", intensity: 1.3 },
  active: { glyph: "▶", color: "#bfe3f0", emissive: "#7fc8e0", intensity: 1.0 },
  complete: { glyph: "✓", color: "#9fcf9a", emissive: "#6fae6a", intensity: 0.8 },
};

function QuestGiverMarkers() {
  // Buildings that offer a quest, with the marker hover-point above the roof.
  const givers = useMemo(
    () =>
      BUILDINGS.filter(
        (b): b is typeof b & { quest: QuestId } => b.quest != null,
      ).map((b) => ({
        questId: b.quest,
        // hover a touch above the roof apex (center y + roof half-height).
        position: [
          b.position[0],
          b.position[1] + b.size[1] + 1.6,
          b.position[2],
        ] as [number, number, number],
      })),
    [],
  );

  return (
    <>
      {givers.map((g) => (
        <QuestGiverMarker
          key={g.questId}
          questId={g.questId}
          position={g.position}
        />
      ))}
    </>
  );
}

function QuestGiverMarker({
  questId,
  position,
}: {
  questId: QuestId;
  position: [number, number, number];
}) {
  const status = useQuests((s) => s.status[questId]);
  const ref = useRef<THREE.Group>(null);
  // Stable per-marker phase so the cluster doesn't bob in lockstep.
  const phase = useMemo(() => position[0] * 0.7 + position[2] * 0.3, [position]);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.position.y = position[1] + Math.sin(t * 1.5 + phase) * 0.18;
    // a gentle "alive" pulse — bigger when there's something to do.
    const pulse = status === "inactive" ? 1 + Math.sin(t * 4) * 0.08 : 1;
    ref.current.scale.setScalar(pulse);
  });

  const style = MARKER_STYLE[status];

  return (
    <group ref={ref} position={position}>
      <Billboard>
        {/* soft paper disc behind the glyph for legibility */}
        <mesh>
          <circleGeometry args={[0.42, 24]} />
          <meshBasicMaterial
            color="#f7f1e3"
            transparent
            opacity={0.82}
            depthWrite={false}
          />
        </mesh>
        <mesh position={[0, 0, -0.01]}>
          <ringGeometry args={[0.42, 0.5, 24]} />
          <meshBasicMaterial
            color={style.emissive}
            transparent
            opacity={0.9}
            depthWrite={false}
          />
        </mesh>
        <Text
          position={[0, 0.01, 0.01]}
          fontSize={0.5}
          color={style.color}
          outlineWidth={0.03}
          outlineColor="#4a3f35"
          anchorX="center"
          anchorY="middle"
        >
          {style.glyph}
        </Text>
      </Billboard>
      <pointLight
        color={style.emissive}
        intensity={style.intensity}
        distance={3}
        decay={2}
      />
    </group>
  );
}

/* ============================================================
   OBJECTIVE BEACONS — a faint emissive pillar + ground ring over
   the active quest's destination (field / parcel / shrine).
   ============================================================ */

/** XZ destination + tint for each quest's "go here" beacon. */
function useBeaconTargets() {
  return useMemo(() => {
    const projects = getBuilding("projects");
    const [px, pz] = frontOf(projects.position, projects.size, 0.9);
    const skills = getBuilding("skills");
    const [sx, sz] = frontOf(skills.position, skills.size, 1.1);
    return {
      "bug-hunt": {
        position: [MONSTER_FIELD.x, 0, MONSTER_FIELD.z] as [number, number, number],
        color: "#c8745f",
      },
      "kafka-courier": {
        position: [px, 0, pz] as [number, number, number],
        color: "#f0c84a",
      },
      "cache-match": {
        position: [sx, 0, sz] as [number, number, number],
        color: "#b79ce8",
      },
    } satisfies Record<
      QuestId,
      { position: [number, number, number]; color: string }
    >;
  }, []);
}

function ObjectiveBeacons() {
  const bugHunt = useQuests((s) => s.status["bug-hunt"]);
  const kafka = useQuests((s) => s.status["kafka-courier"]);
  const cache = useQuests((s) => s.status["cache-match"]);
  const targets = useBeaconTargets();

  return (
    <>
      {bugHunt === "active" && (
        <ObjectiveBeacon {...targets["bug-hunt"]} radius={MONSTER_FIELD.radius} />
      )}
      {kafka === "active" && <ObjectiveBeacon {...targets["kafka-courier"]} />}
      {cache === "active" && <ObjectiveBeacon {...targets["cache-match"]} />}
    </>
  );
}

function ObjectiveBeacon({
  position,
  color,
  radius = 1.4,
}: {
  position: [number, number, number];
  color: string;
  radius?: number;
}) {
  const ringRef = useRef<THREE.Mesh>(null);
  const pillarRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    // slow breathing pulse on the pillar; ring slowly spins for a beacon feel.
    if (pillarRef.current) {
      const m = pillarRef.current.material as THREE.MeshBasicMaterial;
      m.opacity = 0.1 + (Math.sin(t * 1.4) * 0.5 + 0.5) * 0.14;
    }
    if (ringRef.current) {
      ringRef.current.rotation.z = t * 0.4;
      const s = 1 + Math.sin(t * 1.6) * 0.06;
      ringRef.current.scale.set(s, s, 1);
    }
  });

  return (
    <group position={position}>
      {/* faint light column rising from the destination */}
      <mesh ref={pillarRef} position={[0, 4, 0]} renderOrder={-1}>
        <cylinderGeometry args={[radius * 0.5, radius * 0.62, 8, 16, 1, true]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.18}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* glowing ground ring marking the spot */}
      <mesh
        ref={ringRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.06, 0]}
      >
        <ringGeometry args={[radius * 0.78, radius, 48]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.5}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/* ============================================================
   BUG HUNT — a roaming cluster of glitch-skeletons in the field.
   ============================================================ */

const MONSTER_MODELS: MonsterModel[] = ["minion", "warrior", "mage", "rogue"];

function BugHunt() {
  // Deterministic spread of QUEST_GOAL["bug-hunt"] (5) skeletons within the
  // MONSTER_FIELD disc using a golden-angle spiral — stable across renders.
  const monsters = useMemo(() => {
    const count = QUEST_GOAL["bug-hunt"];
    const golden = Math.PI * (3 - Math.sqrt(5));
    const out: {
      key: string;
      model: MonsterModel;
      position: [number, number, number];
    }[] = [];
    for (let i = 0; i < count; i += 1) {
      // radius grows toward the field edge; angle steps by the golden angle.
      const t = (i + 0.5) / count;
      const radius = MONSTER_FIELD.radius * Math.sqrt(t) * 0.9;
      const angle = i * golden;
      const x = MONSTER_FIELD.x + Math.cos(angle) * radius;
      const z = MONSTER_FIELD.z + Math.sin(angle) * radius;
      out.push({
        key: `bug-${i}`,
        model: MONSTER_MODELS[i % MONSTER_MODELS.length],
        position: [x, 0, z],
      });
    }
    return out;
  }, []);

  return (
    <>
      {monsters.map((m) => (
        <Monster
          key={m.key}
          model={m.model}
          position={m.position}
          questId="bug-hunt"
        />
      ))}
    </>
  );
}

/* ============================================================
   KAFKA COURIER — pick up the parcel near Projects, then walk it
   to 3 other cottages. Each delivery marker is a glowing object +
   a rapier sensor that advances the quest once on player entry.
   ============================================================ */

/** Pick the parcel-source building (Projects holds the courier quest). */
const SOURCE_BUILDING = "projects" as const;

function KafkaCourier() {
  // Choose 3 delivery cottages: the nearest distinct buildings to the source,
  // excluding the source itself. Deterministic from the layout.
  const { source, markers } = useMemo(() => {
    const src = getBuilding(SOURCE_BUILDING);
    const others = BUILDINGS.filter((b) => b.id !== SOURCE_BUILDING)
      .map((b) => ({
        b,
        d: Math.hypot(
          b.position[0] - src.position[0],
          b.position[2] - src.position[2],
        ),
      }))
      .sort((a, z) => a.d - z.d)
      .slice(0, QUEST_GOAL["kafka-courier"]) // 3
      .map(({ b }, i) => {
        // place the marker just in front of the cottage (toward plaza/origin).
        const len = Math.hypot(b.position[0], b.position[2]) || 1;
        const back = b.size[2] + 0.9;
        const mx = b.position[0] - (b.position[0] / len) * back;
        const mz = b.position[2] - (b.position[2] / len) * back;
        return {
          id: b.id,
          index: i,
          position: [mx, 0.9, mz] as [number, number, number],
        };
      });
    // parcel pickup glows just in front of the source cottage.
    const slen = Math.hypot(src.position[0], src.position[2]) || 1;
    const sback = src.size[2] + 0.9;
    const sx = src.position[0] - (src.position[0] / slen) * sback;
    const sz = src.position[2] - (src.position[2] / slen) * sback;
    return {
      source: [sx, 0.9, sz] as [number, number, number],
      markers: others,
    };
  }, []);

  // Track which markers have already been delivered so re-entry never
  // double-counts. A ref drives the sensor callback; state drives visuals.
  const deliveredRef = useRef<Set<string>>(new Set());
  const [deliveredView, setDeliveredView] = useState<Record<string, boolean>>(
    {},
  );

  return (
    <>
      {/* Parcel pickup — glowing satchel of "letters" near Projects. */}
      <Parcel position={source} />

      {markers.map((m) => {
        const done = deliveredView[m.id] === true;
        return (
          <group key={m.id} position={m.position}>
            <DeliveryMarker delivered={done} />
            {!done && (
              <CuboidCollider
                args={[0.9, 1.2, 0.9]}
                sensor
                activeCollisionTypes={ActiveCollisionTypes.ALL}
                onIntersectionEnter={({ other }) => {
                  if (other.rigidBodyObject?.name !== "player") return;
                  if (deliveredRef.current.has(m.id)) return;
                  deliveredRef.current.add(m.id);
                  useQuests.getState().advance("kafka-courier");
                  setDeliveredView((prev) => ({ ...prev, [m.id]: true }));
                }}
              />
            )}
          </group>
        );
      })}
    </>
  );
}

/** Glowing parcel/letters bundle that gently bobs above the ground. */
function Parcel({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.position.y = position[1] + Math.sin(t * 1.6) * 0.12;
    ref.current.rotation.y = t * 0.6;
  });
  return (
    <group ref={ref} position={position}>
      {/* envelope-ish box */}
      <mesh castShadow>
        <boxGeometry args={[0.5, 0.34, 0.06]} />
        <meshStandardMaterial
          color="#f7f1e3"
          emissive="#f0d27a"
          emissiveIntensity={0.6}
        />
      </mesh>
      {/* ribbon/seal accent */}
      <mesh position={[0, 0, 0.04]}>
        <boxGeometry args={[0.12, 0.34, 0.02]} />
        <meshStandardMaterial
          color="#c8745f"
          emissive="#c8745f"
          emissiveIntensity={0.5}
        />
      </mesh>
      <pointLight color="#f0d27a" intensity={1.4} distance={3} decay={2} />
    </group>
  );
}

/** A small glowing delivery beacon; dims to a "done" sage once delivered. */
function DeliveryMarker({ delivered }: { delivered: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.position.y = Math.sin(t * 2) * 0.1;
    ref.current.rotation.y = t * 1.2;
  });
  const color = delivered ? "#6fae6a" : "#bfe3f0";
  const emissive = delivered ? "#6fae6a" : "#7fc8e0";
  return (
    <group>
      {/* floating diamond beacon */}
      <mesh ref={ref} castShadow>
        <octahedronGeometry args={[0.28, 0]} />
        <meshStandardMaterial
          color={color}
          emissive={emissive}
          emissiveIntensity={delivered ? 0.5 : 1.1}
        />
      </mesh>
      {/* ground ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.88, 0]}>
        <ringGeometry args={[0.5, 0.62, 24]} />
        <meshStandardMaterial
          color={emissive}
          emissive={emissive}
          emissiveIntensity={0.8}
          transparent
          opacity={delivered ? 0.4 : 0.85}
        />
      </mesh>
      {!delivered && (
        <pointLight color={emissive} intensity={1.2} distance={3} decay={2} />
      )}
    </group>
  );
}

/* ============================================================
   CACHE MATCH — a glowing crystal shrine near the Skills cottage.
   Walk within ~2u and press E (while active & no modal open) to
   open the existing Cache Match puzzle modal.
   ============================================================ */

const SHRINE_RANGE = 2;

function CacheShrine() {
  const shrinePos = useMemo<[number, number, number]>(() => {
    const skills = getBuilding("skills");
    const len = Math.hypot(skills.position[0], skills.position[2]) || 1;
    const back = skills.size[2] + 1.1;
    const x = skills.position[0] - (skills.position[0] / len) * back;
    const z = skills.position[2] - (skills.position[2] / len) * back;
    return [x, 0, z];
  }, []);

  const crystalRef = useRef<THREE.Mesh>(null);
  const [near, setNear] = useState(false);

  // Allocation-free proximity check: compare flat XZ distance squared.
  useFrame((state) => {
    const dx = playerPosition.x - shrinePos[0];
    const dz = playerPosition.z - shrinePos[2];
    const isNear = dx * dx + dz * dz <= SHRINE_RANGE * SHRINE_RANGE;
    if (isNear !== near) setNear(isNear);

    if (crystalRef.current) {
      const t = state.clock.elapsedTime;
      crystalRef.current.position.y = 0.95 + Math.sin(t * 1.5) * 0.1;
      crystalRef.current.rotation.y = t * 0.8;
    }
  });

  // E opens the puzzle. Enabled while near (this group only mounts while the
  // quest is active); the live modal-open guard is re-checked in the callback
  // so a press is ignored if a panel/minigame is already showing.
  useInteractPressed(() => {
    if (useGame.getState().isModalOpen()) return;
    useGame.getState().startMinigame("cache-match");
  }, near);

  return (
    <group position={shrinePos}>
      {/* stone pedestal */}
      <mesh castShadow receiveShadow position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.55, 0.7, 0.6, 8]} />
        <meshStandardMaterial color="#b9a98c" roughness={0.9} />
      </mesh>
      {/* glowing crystal/orb */}
      <mesh ref={crystalRef} castShadow position={[0, 0.95, 0]}>
        <octahedronGeometry args={[0.34, 0]} />
        <meshStandardMaterial
          color="#cdbce8"
          emissive="#9f7fd6"
          emissiveIntensity={near ? 1.6 : 1.0}
          roughness={0.25}
          metalness={0.1}
        />
      </mesh>
      <pointLight
        color="#b79ce8"
        intensity={near ? 2.2 : 1.4}
        distance={4}
        decay={2}
        position={[0, 1.1, 0]}
      />
    </group>
  );
}
