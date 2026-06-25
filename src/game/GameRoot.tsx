'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import gsap from 'gsap';
import { useGame, type Tier } from './store';
import { attachControls } from './controls';
import World from './World';
import Player from './Player';
import PlayerCar from './Car';
import Traffic from './Traffic';
import Peds from './Peds';
import Missions from './Missions';
import CameraRig from './CameraRig';
import Hud from './Hud';
import { spawn } from './city';

type Probe = 'high' | 'lite' | 'none';

function probeGpu(): Probe {
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return 'none';
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = String(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '');
    if (/swiftshader|software|llvmpipe|microsoft basic/i.test(renderer)) return 'lite';
    if (/intel.*\b(hd|uhd)\b.*\b(5\d\d|6\d\d|4\d\d)\b/i.test(renderer)) return 'lite';
    return 'high';
  } catch {
    return 'none';
  }
}

function Menu({ probe, onStart }: { probe: Probe; onStart: (t: Tier) => void }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!el.current) return;
    const tl = gsap.timeline();
    tl.fromTo(
      el.current.querySelectorAll('.menu-anim'),
      { y: 28, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.55, stagger: 0.12, ease: 'power3.out' },
    );
    return () => {
      tl.kill();
    };
  }, []);
  return (
    <div className="menu" ref={el}>
      <div className="menu-inner">
        <div className="menu-anim gta-kicker">DIWAKAR ADHIKARI PRESENTS</div>
        <h1 className="menu-anim gta-title">
          GRAND&nbsp;THEFT
          <br />
          PORTFOLIO
        </h1>
        <div className="menu-anim gta-sub">SAN ADHIKARI · PUNE STORIES</div>
        <div className="menu-anim menu-buttons">
          <button className="gta-btn" onClick={() => onStart(probe === 'lite' ? 'lite' : 'high')}>
            ► NEW GAME
          </button>
          <button className="gta-btn alt" onClick={() => onStart('lite')}>
            LITE MODE (weak GPU)
          </button>
          <a className="gta-btn alt" href="/resume">
            PLAIN RESUME.HTML
          </a>
        </div>
        <div className="menu-anim menu-controls">
          <b>WASD</b> move · <b>SHIFT</b> sprint · <b>E</b> enter/exit car · <b>W/S A/D</b> drive ·{' '}
          <b>SPACE</b> handbrake — walk into the <span className="y">yellow markers</span> to unlock my resume,
          mission by mission. 7 missions. 100% = you should probably hire me.
        </div>
        <div className="menu-anim menu-foot">
          a fan-made homage to a certain 2004 classic · not affiliated with Rockstar Games · built with three.js + GSAP
        </div>
      </div>
    </div>
  );
}

function Loading() {
  return (
    <div className="loading">
      <div className="gta-title small">LOADING…</div>
      <div className="loading-sub">grove street. home.</div>
    </div>
  );
}

export default function GameRoot() {
  const started = useGame((s) => s.started);
  const tier = useGame((s) => s.tier);
  const start = useGame((s) => s.start);
  const [probe, setProbe] = useState<Probe | null>(null);

  useEffect(() => {
    attachControls();
    const q = new URLSearchParams(window.location.search).get('q');
    if (q === 'high' || q === 'lite') setProbe(q);
    else setProbe(probeGpu());
  }, []);

  if (probe === null) return <Loading />;
  if (probe === 'none') {
    if (typeof window !== 'undefined') window.location.replace('/resume');
    return null;
  }

  const high = started && tier === 'high';
  return (
    <div className="game-shell">
      <Canvas
        shadows={high}
        dpr={high ? [1, 1.5] : 1}
        gl={{
          antialias: high,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.05,
        }}
        camera={{ position: [spawn.x - 120, 150, spawn.z - 160], fov: 55, near: 0.5, far: 2000 }}
      >
        <Suspense fallback={null}>
          <World />
          <Player />
          <PlayerCar />
          <Traffic />
          <Peds />
          <Missions />
          <CameraRig />
        </Suspense>
      </Canvas>
      {!started && <Menu probe={probe} onStart={start} />}
      <Hud />
    </div>
  );
}
