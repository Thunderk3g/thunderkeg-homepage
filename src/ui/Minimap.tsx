"use client";

/**
 * Storybook corner minimap (bottom-right). A pure DOM overlay rendered with an
 * HTML <canvas> 2D context — NOT part of the R3F tree. It maps the village's
 * world XZ (within ±WORLD_EXTENT) into a round parchment frame, with north
 * (-Z) pointing up.
 *
 * Static scenery (ground, grid, pond, forest, mountains, plaza/gate, building
 * dots, the active-quest marker) is painted to an offscreen layer that is only
 * rebuilt on resize or when the active quest changes. Every frame we copy that
 * layer to the visible canvas and stamp the live PLAYER arrow + a pulsing quest
 * marker on top, reading playerPosition/playerForward from refs.ts directly so
 * there is zero React churn per frame.
 */

import { useEffect, useRef } from "react";
import {
  WORLD_EXTENT,
  MOUNTAINS,
  FOREST,
  POND,
  PLAZA,
  GATE,
  MONSTER_FIELD,
} from "@/world/layout";
import { BUILDINGS, getBuilding } from "@/game/buildings";
import { playerPosition, playerForward } from "@/game/refs";
import { useQuests, type QuestId } from "@/game/quests";
import { useGame } from "@/game/store";
import styles from "./Minimap.module.css";

/* ---- palette (storybook) ---- */
const INK = "#4a3f35";
const CREAM = "#f7f1e3";
const TERRACOTTA = "#c8745f";
const SAGE = "#6fae6a";

/** Logical drawing size (CSS px); the backing store is scaled by DPR. */
const SIZE = 160;
/** Inset from the round frame edge so nothing clips the parchment ring. */
const PAD = 8;

/** Where each active quest's objective lives, for the pulsing target marker. */
const QUEST_TARGET: Record<QuestId, { x: number; z: number }> = {
  // Squash the glitch-skeletons in the north field.
  "bug-hunt": { x: MONSTER_FIELD.x, z: MONSTER_FIELD.z },
  // Carry letters out of the Projects cottage (the "post office").
  "kafka-courier": {
    x: getBuilding("projects").position[0],
    z: getBuilding("projects").position[2],
  },
  // Activate the cache shrine by the Skills cottage.
  "cache-match": {
    x: getBuilding("skills").position[0],
    z: getBuilding("skills").position[2],
  },
};

export function Minimap() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  /** Offscreen static-scenery layer (logical SIZE×SIZE, DPR-scaled). */
  const sceneryRef = useRef<HTMLCanvasElement | null>(null);
  const dprRef = useRef(1);

  const ready = useGame((s) => s.ready);
  const activeQuest = useQuests((s) => s.active);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    dprRef.current = dpr;

    // Size both the visible canvas and the offscreen scenery layer.
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;

    const scenery = document.createElement("canvas");
    scenery.width = SIZE * dpr;
    scenery.height = SIZE * dpr;
    sceneryRef.current = scenery;

    // --- world XZ -> minimap pixel mapping (north = -Z is up) ---
    const span = SIZE - PAD * 2;
    const scale = span / (WORLD_EXTENT * 2);
    const center = SIZE / 2;
    const toX = (wx: number) => center + wx * scale;
    const toY = (wz: number) => center + wz * scale; // +Z is south -> downward

    /** Draw the static scenery into the offscreen layer (logical coords). */
    function paintScenery() {
      const layer = sceneryRef.current;
      if (!layer) return;
      const g = layer.getContext("2d");
      if (!g) return;

      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, SIZE, SIZE);

      // Ground disc (sage-tinted parchment) clipped to a circle.
      g.save();
      g.beginPath();
      g.arc(center, center, span / 2, 0, Math.PI * 2);
      g.clip();

      g.fillStyle = "#e7ecd6";
      g.fillRect(0, 0, SIZE, SIZE);

      // Subtle grid.
      g.strokeStyle = "rgba(74, 63, 53, 0.08)";
      g.lineWidth = 1;
      const gridStep = span / 8;
      for (let i = 1; i < 8; i++) {
        const p = PAD + i * gridStep;
        g.beginPath();
        g.moveTo(p, PAD);
        g.lineTo(p, SIZE - PAD);
        g.stroke();
        g.beginPath();
        g.moveTo(PAD, p);
        g.lineTo(SIZE - PAD, p);
        g.stroke();
      }

      // Mountains (gray blobs sized by radius, with a little snow cap hint).
      for (const m of MOUNTAINS) {
        const r = m.radius * scale;
        g.beginPath();
        g.arc(toX(m.x), toY(m.z), r, 0, Math.PI * 2);
        g.fillStyle = "rgba(140, 132, 120, 0.55)";
        g.fill();
        // small lighter cap toward the north side
        g.beginPath();
        g.arc(toX(m.x), toY(m.z) - r * 0.28, r * 0.42, 0, Math.PI * 2);
        g.fillStyle = "rgba(231, 226, 214, 0.7)";
        g.fill();
      }

      // Forest grove (green blob).
      g.beginPath();
      g.arc(toX(FOREST.x), toY(FOREST.z), FOREST.radius * scale, 0, Math.PI * 2);
      g.fillStyle = "rgba(111, 174, 106, 0.6)";
      g.fill();

      // Pond (blue blob).
      g.beginPath();
      g.arc(toX(POND.x), toY(POND.z), POND.radius * scale, 0, Math.PI * 2);
      g.fillStyle = "rgba(110, 162, 196, 0.78)";
      g.fill();
      g.strokeStyle = "rgba(74, 63, 53, 0.18)";
      g.lineWidth = 1;
      g.stroke();

      // Village green / plaza (warm ring with a well dot).
      g.beginPath();
      g.arc(toX(PLAZA.x), toY(PLAZA.z), PLAZA.radius * scale, 0, Math.PI * 2);
      g.fillStyle = "rgba(159, 207, 154, 0.5)";
      g.fill();
      g.strokeStyle = "rgba(74, 63, 53, 0.25)";
      g.setLineDash([2, 2]);
      g.stroke();
      g.setLineDash([]);
      g.beginPath();
      g.arc(toX(PLAZA.x), toY(PLAZA.z), 1.6, 0, Math.PI * 2);
      g.fillStyle = INK;
      g.fill();

      // South gate (a small terracotta arch tick at the entrance).
      const gx = toX(GATE[0]);
      const gy = toY(GATE[1]);
      g.fillStyle = TERRACOTTA;
      g.fillRect(gx - 3, gy - 2, 6, 4);
      g.strokeStyle = CREAM;
      g.lineWidth = 1;
      g.strokeRect(gx - 3, gy - 2, 6, 4);

      // Building dots (each uses its cottage roof colour), with first-letter tag.
      for (const b of BUILDINGS) {
        const bx = toX(b.position[0]);
        const by = toY(b.position[2]);
        g.beginPath();
        g.arc(bx, by, 3.4, 0, Math.PI * 2);
        g.fillStyle = b.roof;
        g.fill();
        g.lineWidth = 1.2;
        g.strokeStyle = CREAM;
        g.stroke();

        g.font = "700 5.5px 'Baloo 2', 'Nunito', system-ui, sans-serif";
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillStyle = INK;
        g.fillText(b.label.charAt(0).toUpperCase(), bx, by + 0.4);
      }

      g.restore();
    }

    paintScenery();

    // --- per-frame loop: copy scenery, stamp live player + quest pulse ---
    let raf = 0;
    let start = performance.now();

    const drawArrow = (px: number, py: number, fx: number, fz: number) => {
      // Heading from forward vector. Screen Y grows downward and matches +Z,
      // so atan2(fx, -fz) gives the on-screen angle (0 = up / north).
      const angle = Math.atan2(fx, -fz);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(0, -7); // nose
      ctx.lineTo(5, 6);
      ctx.lineTo(0, 3);
      ctx.lineTo(-5, 6);
      ctx.closePath();
      ctx.fillStyle = TERRACOTTA;
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = CREAM;
      ctx.stroke();
      ctx.restore();
    };

    const render = () => {
      const layer = sceneryRef.current;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (layer) ctx.drawImage(layer, 0, 0);

      // From here on, draw in logical coords.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Pulsing active-quest target marker.
      if (activeQuest) {
        const t = QUEST_TARGET[activeQuest];
        const qx = toX(t.x);
        const qy = toY(t.z);
        const phase = (performance.now() - start) / 700;
        const pulse = 0.5 + 0.5 * Math.sin(phase);
        const r = 4 + pulse * 4;
        ctx.beginPath();
        ctx.arc(qx, qy, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200, 116, 95, ${0.35 - pulse * 0.22})`;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(qx, qy, 2.6, 0, Math.PI * 2);
        ctx.fillStyle = TERRACOTTA;
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = CREAM;
        ctx.stroke();
      }

      // Player arrow, clamped to the round map so it never leaves the frame.
      let px = toX(playerPosition.x);
      let py = toY(playerPosition.z);
      const dx = px - center;
      const dy = py - center;
      const maxR = span / 2 - 6;
      const dist = Math.hypot(dx, dy);
      if (dist > maxR) {
        px = center + (dx / dist) * maxR;
        py = center + (dy / dist) * maxR;
      }
      drawArrow(px, py, playerForward.x, playerForward.z);

      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      sceneryRef.current = null;
    };
    // Re-init (and repaint scenery) when the active quest changes so the static
    // layer's quest context stays correct; the rAF closure also captures it.
  }, [activeQuest]);

  return (
    <div
      className={`${styles.root}${ready ? ` ${styles.visible}` : ""}`}
      aria-hidden="true"
    >
      <div className={styles.frame}>
        <span className={styles.compass}>N</span>
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          width={SIZE}
          height={SIZE}
        />
      </div>
    </div>
  );
}
