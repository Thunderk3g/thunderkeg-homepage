'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGame } from './store';
import {
  buildings, sidewalks, palms, lamps, roadLines, BLOCK, ROAD, HALF, EXTENT,
} from './city';

const tmpM = new THREE.Matrix4();
const tmpP = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const tmpS = new THREE.Vector3();
const tmpC = new THREE.Color();
const Y_AXIS = new THREE.Vector3(0, 1, 0);

/* deterministic PRNG (mulberry32) — no Math.random in render paths */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- canvas textures ---------- */

function makeWindowTexture() {
  const rnd = mulberry32(0x5eed);
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const g = c.getContext('2d')!;
  g.fillStyle = '#cfc6b8';
  g.fillRect(0, 0, 256, 512);

  // facade tone bands: slightly different plaster tint every ~4 floors
  for (let band = 0; band * 80 < 448; band++) {
    const v = Math.round((rnd() - 0.5) * 20);
    g.fillStyle = `rgb(${207 + v},${198 + v},${184 + v})`;
    g.fillRect(0, band * 80, 256, 80);
    // thin floor ledge at the bottom of each band
    g.fillStyle = 'rgba(0,0,0,0.08)';
    g.fillRect(0, band * 80 + 78, 256, 2);
  }

  // subtle vertical ledge lines between window columns
  for (let x = 6; x < 256; x += 16) {
    g.fillStyle = 'rgba(0,0,0,0.10)';
    g.fillRect(x - 3, 0, 1, 448);
    g.fillStyle = 'rgba(255,255,255,0.10)';
    g.fillRect(x - 2, 0, 1, 448);
  }

  // windows (stop above the storefront band)
  for (let y = 8; y < 440; y += 20) {
    for (let x = 6; x < 250; x += 16) {
      const lit = rnd() < 0.15;
      g.fillStyle = lit ? '#ffd98a' : rnd() < 0.5 ? '#3a4450' : '#566270';
      g.fillRect(x, y, 10, 13);
      // sun-catching sill
      g.fillStyle = 'rgba(255,235,200,0.30)';
      g.fillRect(x, y + 13, 10, 1);
    }
  }

  // ground-floor storefront band (canvas bottom = building base)
  g.fillStyle = '#564c43';
  g.fillRect(0, 448, 256, 64);
  const awnings = ['#8a4f38', '#6f6a4a', '#4f5e6e', '#7a4444'];
  for (let x = 0; x < 256; x += 64) {
    // awning / signage strip
    g.fillStyle = awnings[Math.floor(rnd() * awnings.length)];
    g.fillRect(x + 2, 448, 60, 9);
    // shop glass
    g.fillStyle = rnd() < 0.3 ? '#46555f' : '#33414c';
    g.fillRect(x + 5, 462, 16, 34);
    g.fillRect(x + 44, 462, 15, 34);
    // door
    g.fillStyle = rnd() < 0.5 ? '#241f1c' : '#2e3a44';
    g.fillRect(x + 25, 466, 15, 46);
  }

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function makeCloudTexture() {
  const rnd = mulberry32(0xc10d);
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  for (let i = 0; i < 14; i++) {
    const x = 24 + rnd() * 80;
    const y = 44 + rnd() * 40;
    const r = 14 + rnd() * 22;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(255,245,230,0.55)');
    grad.addColorStop(1, 'rgba(255,245,230,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ---------- sky dome (vertex-gradient, San Andreas smog dusk) ---------- */

function SkyDome() {
  const geo = useMemo(() => {
    const g = new THREE.SphereGeometry(900, 24, 12);
    const pos = g.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const top = new THREE.Color('#2e5181'); // darker zenith
    const mid = new THREE.Color('#cd8c52');
    const hor = new THREE.Color('#f6ca8e'); // warm smog horizon
    const col = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const h = THREE.MathUtils.clamp(pos.getY(i) / 900, -0.1, 1);
      if (h < 0.16) col.copy(hor).lerp(mid, Math.max(0, h) / 0.16);
      else col.copy(mid).lerp(top, (h - 0.16) / 0.84);
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return g;
  }, []);
  return (
    <mesh geometry={geo}>
      <meshBasicMaterial vertexColors side={THREE.BackSide} fog={false} depthWrite={false} />
    </mesh>
  );
}

function Sun() {
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,236,190,1)');
    grad.addColorStop(0.25, 'rgba(255,206,130,0.9)');
    grad.addColorStop(1, 'rgba(255,170,80,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  return (
    <sprite position={[-420, 180, -680]} scale={[280, 280, 1]}>
      <spriteMaterial map={tex} fog={false} depthWrite={false} transparent />
    </sprite>
  );
}

function Clouds({ count }: { count: number }) {
  const tex = useMemo(makeCloudTexture, []);
  const group = useRef<THREE.Group>(null!);
  const seeds = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        x: -600 + ((i * 953) % 1200),
        y: 150 + ((i * 379) % 90),
        z: -600 + ((i * 631) % 1200),
        s: 120 + ((i * 247) % 140),
        v: 1.2 + ((i * 83) % 10) / 8,
      })),
    [count],
  );
  useFrame((_, dt) => {
    group.current.children.forEach((c, i) => {
      c.position.x += seeds[i].v * dt;
      if (c.position.x > 700) c.position.x = -700;
    });
  });
  return (
    <group ref={group}>
      {seeds.map((s, i) => (
        <sprite key={i} position={[s.x, s.y, s.z]} scale={[s.s, s.s * 0.45, 1]}>
          <spriteMaterial map={tex} fog={false} depthWrite={false} transparent opacity={0.8} />
        </sprite>
      ))}
    </group>
  );
}

/** faint distant skyline ring beyond the hills — fakes a bigger Los Santos */
function Skyline() {
  const ref = useRef<THREE.InstancedMesh>(null!);
  const items = useMemo(() => {
    const rnd = mulberry32(0x10535); // "LOS35"
    return Array.from({ length: 48 }, (_, i) => {
      const a = (i / 48) * Math.PI * 2 + (rnd() - 0.5) * 0.08;
      const r = 560 + rnd() * 140;
      return {
        x: Math.cos(a) * r,
        z: Math.sin(a) * r,
        yaw: -a,
        w: 26 + rnd() * 46,
        h: 22 + rnd() * 72,
        t: rnd(), // haze mix
      };
    });
  }, []);
  useLayoutEffect(() => {
    const near = new THREE.Color('#9a7458');
    const far = new THREE.Color('#c39a72');
    items.forEach((b, i) => {
      tmpM.compose(
        tmpP.set(b.x, 0, b.z),
        tmpQ.setFromAxisAngle(Y_AXIS, b.yaw),
        tmpS.set(b.w, b.h, 10),
      );
      ref.current.setMatrixAt(i, tmpM);
      ref.current.setColorAt(i, tmpC.copy(near).lerp(far, b.t));
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  }, [items]);
  const geo = useMemo(() => {
    const g = new THREE.BoxGeometry(1, 1, 1);
    g.translate(0, 0.5, 0);
    return g;
  }, []);
  return (
    <instancedMesh ref={ref} args={[geo, undefined, items.length]}>
      <meshBasicMaterial fog={false} />
    </instancedMesh>
  );
}

/* ---------- instanced city pieces ---------- */

function Buildings() {
  const ref = useRef<THREE.InstancedMesh>(null!);
  const tex = useMemo(makeWindowTexture, []);
  const geo = useMemo(() => {
    const g = new THREE.BoxGeometry(1, 1, 1);
    g.translate(0, 0.5, 0);
    return g;
  }, []);
  useLayoutEffect(() => {
    buildings.forEach((b, i) => {
      tmpM.compose(
        tmpP.set(b.x, 0.3, b.z),
        tmpQ.identity(),
        tmpS.set(b.sx, b.sy, b.sz),
      );
      ref.current.setMatrixAt(i, tmpM);
      ref.current.setColorAt(i, tmpC.set(b.color));
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  }, []);
  return (
    <instancedMesh ref={ref} args={[geo, undefined, buildings.length]} receiveShadow>
      <meshLambertMaterial map={tex} />
    </instancedMesh>
  );
}

/** rooftop dressing: one AC-unit/penthouse box on every building taller than 12u */
function RoofDressing() {
  const ref = useRef<THREE.InstancedMesh>(null!);
  const items = useMemo(() => {
    const r = mulberry32(0xf00f);
    const out: { x: number; y: number; z: number; sx: number; sy: number; sz: number; c: string }[] = [];
    buildings.forEach((b) => {
      const r1 = r();
      const r2 = r();
      const r3 = r();
      const r4 = r();
      if (b.sy <= 12) return;
      const w = b.sx * (0.22 + r1 * 0.2);
      const d = b.sz * (0.22 + r2 * 0.2);
      out.push({
        x: b.x + (r4 - 0.5) * (b.sx - w) * 0.6,
        y: 0.3 + b.sy,
        z: b.z + (r1 - 0.5) * (b.sz - d) * 0.6,
        sx: w,
        sy: 1.2 + r3 * 2.4,
        sz: d,
        c: r2 < 0.5 ? '#9a948a' : '#7c766c',
      });
    });
    return out;
  }, []);
  useLayoutEffect(() => {
    if (!ref.current) return;
    items.forEach((it, i) => {
      tmpM.compose(tmpP.set(it.x, it.y, it.z), tmpQ.identity(), tmpS.set(it.sx, it.sy, it.sz));
      ref.current.setMatrixAt(i, tmpM);
      ref.current.setColorAt(i, tmpC.set(it.c));
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  }, [items]);
  const geo = useMemo(() => {
    const g = new THREE.BoxGeometry(1, 1, 1);
    g.translate(0, 0.5, 0);
    return g;
  }, []);
  if (items.length === 0) return null;
  return (
    <instancedMesh ref={ref} args={[geo, undefined, items.length]}>
      <meshLambertMaterial />
    </instancedMesh>
  );
}

function Sidewalks() {
  const ref = useRef<THREE.InstancedMesh>(null!);
  useLayoutEffect(() => {
    sidewalks.forEach((s, i) => {
      tmpM.compose(tmpP.set(s.x, 0.15, s.z), tmpQ.identity(), tmpS.set(BLOCK + 2, 0.3, BLOCK + 2));
      ref.current.setMatrixAt(i, tmpM);
      ref.current.setColorAt(i, tmpC.set(s.grass ? '#6c8f4f' : '#b5b0a4'));
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  }, []);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, sidewalks.length]} receiveShadow>
      <boxGeometry />
      <meshLambertMaterial />
    </instancedMesh>
  );
}

/** lighter curb strip wrapped around every block edge — single instanced mesh */
function Curbs() {
  const ref = useRef<THREE.InstancedMesh>(null!);
  const items = useMemo(() => {
    const d = (BLOCK + 2) / 2 + 0.25;
    const len = BLOCK + 3.1;
    const out: { x: number; z: number; sx: number; sz: number }[] = [];
    for (const s of sidewalks) {
      out.push({ x: s.x, z: s.z - d, sx: len, sz: 0.5 });
      out.push({ x: s.x, z: s.z + d, sx: len, sz: 0.5 });
      out.push({ x: s.x - d, z: s.z, sx: 0.5, sz: len });
      out.push({ x: s.x + d, z: s.z, sx: 0.5, sz: len });
    }
    return out;
  }, []);
  useLayoutEffect(() => {
    items.forEach((c, i) => {
      tmpM.compose(tmpP.set(c.x, 0.17, c.z), tmpQ.identity(), tmpS.set(c.sx, 0.34, c.sz));
      ref.current.setMatrixAt(i, tmpM);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  }, [items]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]}>
      <boxGeometry />
      <meshLambertMaterial color="#cfcabd" />
    </instancedMesh>
  );
}

/** zebra crosswalk bars across the four road ends of every intersection */
function Crosswalks() {
  const ref = useRef<THREE.InstancedMesh>(null!);
  const items = useMemo(() => {
    const off = ROAD / 2 + 2.0;
    const out: { x: number; z: number; alongX: boolean }[] = [];
    for (const X of roadLines) {
      for (const Z of roadLines) {
        for (let k = -2; k <= 2; k++) {
          const s = k * 2.1;
          out.push({ x: X + off, z: Z + s, alongX: true }); // east crossing
          out.push({ x: X - off, z: Z + s, alongX: true }); // west crossing
          out.push({ x: X + s, z: Z + off, alongX: false }); // south crossing
          out.push({ x: X + s, z: Z - off, alongX: false }); // north crossing
        }
      }
    }
    return out;
  }, []);
  useLayoutEffect(() => {
    items.forEach((b, i) => {
      tmpM.compose(
        tmpP.set(b.x, 0.05, b.z),
        tmpQ.identity(),
        b.alongX ? tmpS.set(2.6, 0.08, 0.65) : tmpS.set(0.65, 0.08, 2.6),
      );
      ref.current.setMatrixAt(i, tmpM);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  }, [items]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]}>
      <boxGeometry />
      <meshBasicMaterial color="#ded6c0" />
    </instancedMesh>
  );
}

function RoadDashes() {
  const items = useMemo(() => {
    const out: { x: number; z: number; rot: number }[] = [];
    for (const line of roadLines) {
      for (let a = -HALF + 8; a < HALF - 8; a += 9) {
        out.push({ x: a, z: line, rot: Math.PI / 2 });
        out.push({ x: line, z: a, rot: 0 });
      }
    }
    return out;
  }, []);
  const ref = useRef<THREE.InstancedMesh>(null!);
  useLayoutEffect(() => {
    items.forEach((d, i) => {
      tmpM.compose(
        tmpP.set(d.x, 0.04, d.z),
        tmpQ.setFromAxisAngle(Y_AXIS, d.rot),
        tmpS.set(0.35, 0.08, 3.2),
      );
      ref.current.setMatrixAt(i, tmpM);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  }, [items]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]}>
      <boxGeometry />
      <meshBasicMaterial color="#e8e0c8" />
    </instancedMesh>
  );
}

function Palms() {
  const trunkRef = useRef<THREE.InstancedMesh>(null!);
  const frondRef = useRef<THREE.InstancedMesh>(null!);
  const fronds = useMemo(() => {
    const out: { x: number; y: number; z: number; yaw: number; tilt: number; s: number }[] = [];
    palms.forEach((p) => {
      const n = 6;
      for (let k = 0; k < n; k++) {
        out.push({
          x: p.x,
          y: 5.6 * p.s,
          z: p.z,
          yaw: (k / n) * Math.PI * 2 + p.x * 0.1,
          tilt: -0.5 - (k % 3) * 0.14,
          s: p.s,
        });
      }
    });
    return out;
  }, []);
  useLayoutEffect(() => {
    palms.forEach((p, i) => {
      tmpM.compose(tmpP.set(p.x, 0.3, p.z), tmpQ.identity(), tmpS.set(p.s, p.s, p.s));
      trunkRef.current.setMatrixAt(i, tmpM);
    });
    trunkRef.current.instanceMatrix.needsUpdate = true;
    const e = new THREE.Euler();
    fronds.forEach((f, i) => {
      e.set(f.tilt, f.yaw, 0, 'YXZ');
      tmpM.compose(tmpP.set(f.x, f.y, f.z), tmpQ.setFromEuler(e), tmpS.set(f.s, f.s, f.s));
      frondRef.current.setMatrixAt(i, tmpM);
    });
    frondRef.current.instanceMatrix.needsUpdate = true;
  }, [fronds]);
  const frondGeo = useMemo(() => {
    const g = new THREE.BoxGeometry(0.5, 0.08, 2.6);
    g.translate(0, 0, 1.3);
    return g;
  }, []);
  const trunkGeo = useMemo(() => new THREE.CylinderGeometry(0.14, 0.26, 5.6, 5).translate(0, 2.8, 0), []);
  return (
    <group>
      <instancedMesh ref={trunkRef} args={[trunkGeo, undefined, palms.length]}>
        <meshLambertMaterial color="#8a6844" />
      </instancedMesh>
      <instancedMesh ref={frondRef} args={[frondGeo, undefined, fronds.length]}>
        <meshLambertMaterial color="#4d7a35" />
      </instancedMesh>
    </group>
  );
}

/** bushes/shrubs scattered over the grass blocks (park + campus) */
function Bushes() {
  const ref = useRef<THREE.InstancedMesh>(null!);
  const items = useMemo(() => {
    const rnd = mulberry32(0xb05c);
    const out: { x: number; z: number; s: number; c: string }[] = [];
    for (const s of sidewalks) {
      if (!s.grass) continue;
      for (let k = 0; k < 14; k++) {
        const r1 = rnd();
        const r2 = rnd();
        const r3 = rnd();
        // keep off the very center where markers/paths live
        const ox = (r1 - 0.5) * (BLOCK - 8);
        const oz = (r2 - 0.5) * (BLOCK - 8);
        if (Math.abs(ox) < 5 && Math.abs(oz) < 5) continue;
        out.push({
          x: s.x + ox,
          z: s.z + oz,
          s: 0.7 + r3 * 1.1,
          c: r3 < 0.5 ? '#4f7a38' : '#5e8a42',
        });
      }
    }
    return out;
  }, []);
  useLayoutEffect(() => {
    if (!ref.current) return;
    items.forEach((b, i) => {
      tmpM.compose(
        tmpP.set(b.x, 0.3 + b.s * 0.55, b.z),
        tmpQ.setFromAxisAngle(Y_AXIS, (i * 1.7) % Math.PI),
        tmpS.set(b.s, b.s * 0.8, b.s),
      );
      ref.current.setMatrixAt(i, tmpM);
      ref.current.setColorAt(i, tmpC.set(b.c));
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  }, [items]);
  const geo = useMemo(() => new THREE.IcosahedronGeometry(1, 0), []);
  if (items.length === 0) return null;
  return (
    <instancedMesh ref={ref} args={[geo, undefined, items.length]}>
      <meshLambertMaterial flatShading />
    </instancedMesh>
  );
}

function Lamps() {
  const poleRef = useRef<THREE.InstancedMesh>(null!);
  const headRef = useRef<THREE.InstancedMesh>(null!);
  const poleGeo = useMemo(() => new THREE.CylinderGeometry(0.07, 0.1, 5, 5).translate(0, 2.5, 0), []);
  useLayoutEffect(() => {
    lamps.forEach((l, i) => {
      tmpM.compose(tmpP.set(l.x, 0.3, l.z), tmpQ.identity(), tmpS.set(1, 1, 1));
      poleRef.current.setMatrixAt(i, tmpM);
      tmpM.compose(tmpP.set(l.x, 5.1, l.z), tmpQ.identity(), tmpS.set(1, 1, 1));
      headRef.current.setMatrixAt(i, tmpM);
    });
    poleRef.current.instanceMatrix.needsUpdate = true;
    headRef.current.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <group>
      <instancedMesh ref={poleRef} args={[poleGeo, undefined, lamps.length]}>
        <meshLambertMaterial color="#4a4a4a" />
      </instancedMesh>
      <instancedMesh ref={headRef} args={[undefined, undefined, lamps.length]}>
        <sphereGeometry args={[0.22, 6, 6]} />
        <meshBasicMaterial color="#ffe2a0" />
      </instancedMesh>
    </group>
  );
}

function Hills() {
  const ref = useRef<THREE.InstancedMesh>(null!);
  const items = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => {
        const a = (i / 18) * Math.PI * 2 + (i % 3) * 0.12;
        const r = HALF + 90 + ((i * 137) % 110);
        return {
          x: Math.cos(a) * r,
          z: Math.sin(a) * r,
          s: 50 + ((i * 211) % 80),
          h: 26 + ((i * 89) % 42),
          c: i % 3 === 0 ? '#7a8a55' : '#a08a62',
        };
      }),
    [],
  );
  useLayoutEffect(() => {
    items.forEach((h, i) => {
      tmpM.compose(tmpP.set(h.x, 0, h.z), tmpQ.identity(), tmpS.set(h.s, h.h, h.s));
      ref.current.setMatrixAt(i, tmpM);
      ref.current.setColorAt(i, tmpC.set(h.c));
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  }, [items]);
  const geo = useMemo(() => new THREE.ConeGeometry(1, 1, 7).translate(0, 0.5, 0), []);
  return (
    <instancedMesh ref={ref} args={[geo, undefined, items.length]}>
      <meshLambertMaterial flatShading />
    </instancedMesh>
  );
}

/* ---------- main world ---------- */

export default function World() {
  const tier = useGame((s) => s.tier);
  const high = tier === 'high';
  return (
    <group>
      <SkyDome />
      <Sun />
      <Clouds count={high ? 10 : 4} />
      {/* golden-hour smog */}
      <fog attach="fog" args={['#dba869', 60, high ? 420 : 260]} />
      <hemisphereLight args={['#ffe0b0', '#6b5640', 0.75]} />
      {/* low golden-hour sun */}
      <directionalLight
        position={[-110, 90, -70]}
        intensity={1.75}
        color="#ffbe85"
        castShadow={high}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={60}
        shadow-camera-bottom={-60}
        shadow-camera-far={300}
        shadow-bias={-0.0005}
      />
      {/* faint cool fill from the opposite side so shadowed faces aren't mud */}
      <directionalLight position={[90, 60, 80]} intensity={0.22} color="#8fa3c8" />
      {/* desert ground beyond the city */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.2} receiveShadow>
        <planeGeometry args={[1800, 1800]} />
        <meshLambertMaterial color="#b59a6d" />
      </mesh>
      {/* city asphalt slab */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.0} receiveShadow>
        <planeGeometry args={[EXTENT + ROAD, EXTENT + ROAD]} />
        <meshLambertMaterial color="#55524e" />
      </mesh>
      <RoadDashes />
      <Sidewalks />
      <Curbs />
      {high && <Crosswalks />}
      <Buildings />
      {high && <RoofDressing />}
      <Palms />
      <Bushes />
      <Lamps />
      <Hills />
      {high && <Skyline />}
    </group>
  );
}
