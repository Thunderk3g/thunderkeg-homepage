'use client';

import { useEffect, useRef } from 'react';
import { live, useGame } from './store';
import { buildings, roadLines, landmarks, ROAD, HALF } from './city';

const SIZE = 180;
const SCALE = 0.62; // world units -> px

export default function Minimap() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const g = canvas.getContext('2d')!;
    let raf = 0;
    let last = 0;

    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      if (t - last < 66) return; // ~15fps is plenty for a radar
      last = t;
      const { completed, inCar } = useGame.getState();
      const cx = SIZE / 2;
      const cy = SIZE / 2;

      g.clearRect(0, 0, SIZE, SIZE);
      g.save();
      g.beginPath();
      g.arc(cx, cy, SIZE / 2 - 3, 0, Math.PI * 2);
      g.clip();

      // ground
      g.fillStyle = '#3c4438';
      g.fillRect(0, 0, SIZE, SIZE);

      // rotate radar so "up" = camera forward (GTA style)
      g.translate(cx, cy);
      g.rotate(live.camYaw + Math.PI);
      g.translate(-live.px * SCALE, -live.pz * SCALE);

      // roads
      g.fillStyle = '#8c8678';
      for (const line of roadLines) {
        g.fillRect(-HALF * SCALE, (line - ROAD / 2) * SCALE, HALF * 2 * SCALE, ROAD * SCALE);
        g.fillRect((line - ROAD / 2) * SCALE, -HALF * SCALE, ROAD * SCALE, HALF * 2 * SCALE);
      }
      // buildings
      g.fillStyle = '#5a6150';
      for (const b of buildings) {
        g.fillRect((b.x - b.sx / 2) * SCALE, (b.z - b.sz / 2) * SCALE, b.sx * SCALE, b.sz * SCALE);
      }
      // mission blips — SA-style squares, kept screen-axis-aligned
      const unrotate = -(live.camYaw + Math.PI);
      for (const l of landmarks) {
        g.save();
        g.translate(l.marker.x * SCALE, l.marker.z * SCALE);
        g.rotate(unrotate);
        g.fillStyle = completed.includes(l.missionId) ? '#58c858' : '#f5c542';
        g.fillRect(-4, -4, 8, 8);
        g.strokeStyle = '#181410';
        g.lineWidth = 1.5;
        g.strokeRect(-4, -4, 8, 8);
        g.restore();
      }
      // car blip — blue square
      if (!inCar) {
        g.save();
        g.translate(live.carX * SCALE, live.carZ * SCALE);
        g.rotate(unrotate);
        g.fillStyle = '#4ab8e8';
        g.fillRect(-3.5, -3.5, 7, 7);
        g.strokeStyle = '#181410';
        g.lineWidth = 1.5;
        g.strokeRect(-3.5, -3.5, 7, 7);
        g.restore();
      }
      g.restore();

      // player arrow (always centered, pointing up)
      g.save();
      g.translate(cx, cy);
      g.rotate(((inCar ? live.carHeading : live.pHeading) - live.camYaw) * -1 + Math.PI);
      g.fillStyle = '#ffffff';
      g.strokeStyle = '#181410';
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(0, -7);
      g.lineTo(5, 6);
      g.lineTo(0, 3);
      g.lineTo(-5, 6);
      g.closePath();
      g.fill();
      g.stroke();
      g.restore();

      // bezel — thick dark SA radar ring
      g.strokeStyle = '#0c0a08';
      g.lineWidth = 8;
      g.beginPath();
      g.arc(cx, cy, SIZE / 2 - 4, 0, Math.PI * 2);
      g.stroke();
      g.strokeStyle = '#3a362c';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(cx, cy, SIZE / 2 - 1, 0, Math.PI * 2);
      g.stroke();
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={ref} width={SIZE} height={SIZE} className="minimap" />;
}
