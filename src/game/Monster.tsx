"use client";

/**
 * A roaming "glitch" skeleton for the Bug Hunt quest.
 *
 * Behavior (driven entirely in useFrame, allocation-free):
 *   - IDLE / WANDER gently around its spawn `position` while the player is far.
 *   - APPROACH the player once they enter the aggro radius (reads the live
 *     `playerPosition` from refs.ts — never written here).
 *   - Crossfades Idle ↔ Walking_A based on movement, and yaws to face travel /
 *     the player.
 *   - COMBAT: only while the monster's quest is "active" AND the player stands
 *     within strike range. A floating "E" billboard hints the interaction;
 *     pressing E (useInteractPressed) requests a hero swing (requestHeroAttack),
 *     plays Hit_A → Death_A (clamped), then fades/scales the monster out and
 *     calls useQuests.advance(questId) exactly once.
 *
 * Each instance must own its own skinned skeleton, so the loaded glTF scene is
 * cloned with three's SkeletonUtils (a plain clone shares the skeleton and
 * breaks animation). Per-frame work uses MODULE-LEVEL temp vectors so the hot
 * loop allocates nothing.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations, Billboard, Text } from "@react-three/drei";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";

import { MONSTERS, MONSTER_CLIPS, type MonsterModel } from "./assets";
import { playerPosition } from "./refs";
import { useInteractPressed, requestHeroAttack } from "./interaction";
import { useQuests, type QuestId } from "./quests";
import { useGame } from "./store";

export interface MonsterProps {
  /** Which KayKit skeleton model to use. */
  model: MonsterModel;
  /** Home/spawn position [x, y, z] (also the wander anchor). */
  position: [number, number, number];
  /** Quest advanced by one step when this monster is defeated. */
  questId: QuestId;
  /** Optional uniform scale (default 1). */
  scale?: number;
}

// ──────────────────────────────────────────────────────────────────────────
// TUNING CONSTANTS
// ──────────────────────────────────────────────────────────────────────────

/** Distance (XZ) at which the monster starts chasing the player. */
const AGGRO_RADIUS = 7;
/** Distance (XZ) within which the player may strike the monster. */
const STRIKE_RADIUS = 1.8;
/** How close the monster tries to get before it stops advancing. */
const STOP_DISTANCE = 1.3;
/** Radius of the wander circle around the spawn anchor. */
const WANDER_RADIUS = 3;
/** Move speeds (world units / sec). */
const WANDER_SPEED = 0.9;
const CHASE_SPEED = 2.2;
/** Yaw turn rate (radians / sec) toward the desired heading. */
const TURN_RATE = 8;
/** Animation crossfade duration (seconds). */
const FADE = 0.2;
/** Locomotion threshold — below this planar speed we play Idle. */
const MOVE_THRESHOLD = 0.05;
/** Seconds the death anim is allowed to play before we hide the monster. */
const DEATH_HIDE_DELAY = 1.4;
/** Fade-out duration after death (seconds). */
const DESPAWN_FADE = 0.5;

// ──────────────────────────────────────────────────────────────────────────
// MODULE-LEVEL TEMPORARIES — reused every frame so the loop never allocates.
// ──────────────────────────────────────────────────────────────────────────

const _toPlayer = new THREE.Vector3();
const _target = new THREE.Vector3();
const _move = new THREE.Vector3();

// Hint label hovers above the monster's head (skeletons are ~1.8u tall).
const HINT_OFFSET: [number, number, number] = [0, 2.1, 0];

// Preload all four skeleton models so first spawn doesn't hitch.
useGLTF.preload(MONSTERS.minion);
useGLTF.preload(MONSTERS.warrior);
useGLTF.preload(MONSTERS.mage);
useGLTF.preload(MONSTERS.rogue);

type Phase = "alive" | "dying" | "gone";

export function Monster({ model, position, questId, scale = 1 }: MonsterProps) {
  const group = useRef<THREE.Group>(null);

  // Load once (cached by drei), then clone per-instance with SkeletonUtils so
  // each monster has an independent, animatable skeleton.
  const { scene, animations } = useGLTF(MONSTERS[model]);
  const cloned = useMemo(() => {
    const c = cloneSkeleton(scene);
    c.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    return c;
  }, [scene]);

  const { actions } = useAnimations(animations, cloned);

  // Lifecycle / combat state.
  const [phase, setPhase] = useState<Phase>("alive");
  const [showHint, setShowHint] = useState(false);
  const advanced = useRef(false); // guard: advance the quest exactly once
  const dyingSince = useRef(0); // perf.now()/1000 when death started

  // Currently-playing locomotion clip (for crossfade bookkeeping).
  const current = useRef<string | null>(null);
  // Wander target offset (relative to spawn anchor), refreshed periodically.
  const wanderTarget = useRef(new THREE.Vector3());
  const nextWanderAt = useRef(0);
  // Cached spawn anchor as a Vector3 for cheap math.
  const anchor = useMemo(
    () => new THREE.Vector3(position[0], position[1], position[2]),
    [position],
  );

  // Helper: crossfade to a locomotion clip (no-op if already current).
  const playLocomotion = (clip: string) => {
    if (clip === current.current) return;
    const next = actions[clip];
    if (!next) return;
    const prev = current.current ? actions[current.current] : null;
    next.reset().setEffectiveWeight(1).fadeIn(FADE).play();
    if (prev && prev !== next) prev.fadeOut(FADE);
    current.current = clip;
  };

  // Start idling once actions exist; stop everything on unmount.
  useEffect(() => {
    const idle = actions[MONSTER_CLIPS.idle];
    if (idle) {
      idle.reset().fadeIn(FADE).play();
      current.current = MONSTER_CLIPS.idle;
    }
    return () => {
      Object.values(actions).forEach((a) => a?.stop());
      current.current = null;
    };
  }, [actions]);

  // Is this monster's quest currently live/targetable?
  const questActive = useQuests(
    (s) => s.status[questId] === "active",
  );

  // The strike happens when the player presses E in range while quest is live
  // and no modal is open. Compute `enabled` from the latest live values inside
  // the callback path; useInteractPressed reads `enabled` each frame.
  const inStrikeRange = useRef(false);
  const strikeEnabled =
    phase === "alive" && questActive && showHint;

  const onStrike = () => {
    if (phase !== "alive") return;
    if (useGame.getState().isModalOpen()) return;
    if (!inStrikeRange.current) return;
    if (useQuests.getState().status[questId] !== "active") return;

    // Knight swings, monster reels then dies.
    requestHeroAttack();
    setShowHint(false);
    setPhase("dying");
    dyingSince.current = performance.now() / 1000;

    const hit = actions[MONSTER_CLIPS.hit];
    const death = actions[MONSTER_CLIPS.death];
    const prev = current.current ? actions[current.current] : null;
    if (prev) prev.fadeOut(0.1);
    current.current = null;

    if (hit) {
      hit.reset().setLoop(THREE.LoopOnce, 1);
      hit.clampWhenFinished = true;
      hit.setEffectiveWeight(1).fadeIn(0.06).play();
    }
    if (death) {
      const hitDur = hit ? hit.getClip().duration * 0.5 : 0;
      death.reset().setLoop(THREE.LoopOnce, 1);
      death.clampWhenFinished = true;
      // Fade the death clip in just as the hit reaction finishes.
      death.setEffectiveWeight(1).fadeIn(0.15).play();
      if (hit && hitDur > 0) {
        // Bias weight toward death so the body settles into the death pose.
        death.startAt(hitDur);
      }
    }

    // Advance the quest exactly once on defeat.
    if (!advanced.current) {
      advanced.current = true;
      useQuests.getState().advance(questId);
    }
  };

  useInteractPressed(onStrike, strikeEnabled);

  useFrame((_, rawDelta) => {
    const grp = group.current;
    if (!grp) return;

    // Clamp delta so a tab-out / long frame can't fling the monster.
    const dt = Math.min(rawDelta, 0.05);

    // --- death / despawn handling ---
    if (phase === "dying") {
      const t = performance.now() / 1000 - dyingSince.current;
      // Fade + sink out after the death anim has had time to play.
      if (t > DEATH_HIDE_DELAY) {
        const k = Math.min((t - DEATH_HIDE_DELAY) / DESPAWN_FADE, 1);
        grp.scale.setScalar(scale * (1 - k));
        grp.position.y = anchor.y - k * 0.6;
        if (k >= 1) setPhase("gone");
      }
      return;
    }
    if (phase === "gone") return;

    // Freeze AI while a panel / minigame modal is open.
    if (useGame.getState().isModalOpen()) {
      if (showHint) setShowHint(false);
      inStrikeRange.current = false;
      return;
    }

    const live =
      useQuests.getState().status[questId] === "active";

    // Planar distance to the player.
    _toPlayer.subVectors(playerPosition, grp.position);
    _toPlayer.y = 0;
    const distToPlayer = _toPlayer.length();

    // Strike-range / hint bookkeeping (only meaningful while quest is live).
    const inRange = live && distToPlayer <= STRIKE_RADIUS;
    inStrikeRange.current = inRange;
    if (inRange !== showHint) setShowHint(inRange);

    // --- decide a destination ---
    let speed: number;
    if (live && distToPlayer <= AGGRO_RADIUS) {
      // Chase the player, but stop short so we don't shove through them.
      _target.copy(playerPosition);
      _target.y = grp.position.y;
      speed = distToPlayer > STOP_DISTANCE ? CHASE_SPEED : 0;
    } else {
      // Gentle wander: pick a new point inside the anchor circle now and then.
      const now = performance.now() / 1000;
      if (now >= nextWanderAt.current) {
        const ang = Math.random() * Math.PI * 2;
        const rad = Math.random() * WANDER_RADIUS;
        wanderTarget.current.set(
          anchor.x + Math.cos(ang) * rad,
          anchor.y,
          anchor.z + Math.sin(ang) * rad,
        );
        nextWanderAt.current = now + 3 + Math.random() * 3;
      }
      _target.copy(wanderTarget.current);
      _target.y = grp.position.y;
      const toTarget = _target.distanceTo(grp.position);
      speed = toTarget > 0.3 ? WANDER_SPEED : 0;
    }

    // --- move toward the destination ---
    _move.subVectors(_target, grp.position);
    _move.y = 0;
    const planar = _move.length();
    let moving = false;
    if (planar > 1e-4 && speed > 0) {
      _move.normalize();
      const step = Math.min(speed * dt, planar);
      grp.position.addScaledVector(_move, step);
      moving = step > MOVE_THRESHOLD * dt;
    }

    // --- face travel direction (or the player when standing in melee) ---
    let desiredYaw: number | null = null;
    if (moving) {
      desiredYaw = Math.atan2(_move.x, _move.z);
    } else if (live && distToPlayer <= AGGRO_RADIUS && distToPlayer > 1e-3) {
      desiredYaw = Math.atan2(_toPlayer.x, _toPlayer.z);
    }
    if (desiredYaw !== null) {
      // Shortest-arc damped turn.
      let diff = desiredYaw - grp.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      grp.rotation.y += diff * Math.min(TURN_RATE * dt, 1);
    }

    // --- locomotion animation ---
    playLocomotion(moving ? MONSTER_CLIPS.walk : MONSTER_CLIPS.idle);
  });

  if (phase === "gone") return null;

  return (
    <group ref={group} position={position} scale={scale}>
      <primitive object={cloned} />

      {showHint && (
        <Billboard position={HINT_OFFSET}>
          <Text
            fontSize={0.5}
            color="#ffe66d"
            outlineWidth={0.04}
            outlineColor="#1a1a1a"
            anchorX="center"
            anchorY="middle"
          >
            E
          </Text>
        </Billboard>
      )}
    </group>
  );
}
