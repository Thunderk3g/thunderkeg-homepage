'use client';

import { useLayoutEffect, useState } from 'react';
import { KALI_MARK_PATH } from '../icons';
import type { Lens } from './anatomy';
import { kb, useTeardownModel, type Part, type Under } from './parts';
import { useTeardown } from './store';

/**
 * The plates the teardown adds to the desktop. Every layer gets one, drawn in
 * the desktop's own plane and sized to the screen:
 *
 *   tab      an index tab hanging off the near-left edge, with the layer's
 *            number and its name under the current lens. Tabs are the one
 *            thing that is never covered, so the stack can be read at rest.
 *   lip      on the plates under the wallpaper, the layer's components in a
 *            row along the near edge: the strip that stays in view.
 *   body     live figures from this tab: the display, the process table, the
 *            file tree and what is stored, the two kernels, the machine.
 *   notes    on the panel's glass, a label under each real plugin.
 *
 * Type is set in viewport units: at the scale the stack is shown, 2.2vw is
 * about a caption. Decoration only: everything here is also in the HUD as text.
 *
 * Mounted inside the desktop element (Desktop.tsx), because that element is
 * the 3D scene; it renders nothing until the desktop is taken apart.
 */
export function TeardownPlates() {
  const on = useTeardown((s) => s.on);
  return on ? <Plates /> : null;
}

function Plates() {
  const { parts, under } = useTeardownModel();
  const lens = useTeardown((s) => s.lens);
  return (
    <>
      {parts
        .filter((p) => p.plate)
        .map((p) => {
          const reading = p.anatomy[lens];
          return (
            <div key={p.id} className={`td-plate ${p.plate} k-${p.kind}`} data-td-plate={p.id} aria-hidden="true">
              <span className="td-tab">
                <b>{String(parts.indexOf(p) + 1).padStart(2, '0')}</b>
                {reading.name}
              </span>
              {p.kind === 'panel' && <PanelNotes lens={lens} />}
              {p.kind === 'nowindows' && <p className="td-plate-empty">no windows open</p>}
              {p.plate === 'solid' && (
                <>
                  <div className="td-body">
                    {p.kind === 'display' && <Display d={under.display} />}
                    {p.kind === 'session' && <Session procs={under.procs} />}
                    {p.kind === 'fs' && <Files fs={under.fs} storage={under.storage} />}
                    {p.kind === 'kernel' && <Kernel k={under.kernel} />}
                    {p.kind === 'hardware' && <Hardware h={under.hardware} />}
                  </div>
                  <Lip part={p} lens={lens} />
                </>
              )}
            </div>
          );
        })}
    </>
  );
}

/** The layer's components, named, along the edge that stays in view. */
function Lip({ part, lens }: { part: Part; lens: Lens }) {
  const pieces = part.anatomy[lens].pieces.slice(0, 6);
  return (
    <ul className="td-lip" key={lens}>
      {pieces.map(([name], i) => (
        <li key={name} style={{ ['--i' as string]: i }}>
          {name}
        </li>
      ))}
    </ul>
  );
}

/**
 * A label under each plugin of the real panel. Positions are measured from
 * the live panel once, in the frame before the desktop tilts.
 */
const PANEL_SPOTS: { sel: string; kali: string; site: string; llm: string }[] = [
  { sel: '.kos-panel-menu', kali: 'Whisker Menu', site: 'menu', llm: 'tool menu' },
  { sel: '.kos-panel-launcher', kali: 'launchers', site: 'launchers', llm: 'pinned tools' },
  { sel: '.kos-pager', kali: 'workspace switcher', site: 'pager', llm: 'sessions' },
  { sel: '.kos-task', kali: 'window buttons', site: 'task list', llm: 'traces' },
  { sel: '.kos-cpugraph', kali: 'CPU graph', site: 'load graph', llm: 'latency' },
  { sel: '.kos-tray-item', kali: 'status tray', site: 'tray', llm: 'cost meters' },
  { sel: '.kos-tray-clock', kali: 'clock', site: 'clock', llm: 'timestamps' },
];

function PanelNotes({ lens }: { lens: Lens }) {
  const [spots, setSpots] = useState<{ x: number; w: number; i: number }[]>([]);
  useLayoutEffect(() => {
    const found: { x: number; w: number; i: number }[] = [];
    PANEL_SPOTS.forEach((s, i) => {
      const els = [...document.querySelectorAll<HTMLElement>('.kos-panel ' + s.sel)].filter((e) => e.offsetWidth > 0);
      if (!els.length) return;
      const rects = els.map((e) => e.getBoundingClientRect());
      const left = Math.min(...rects.map((r) => r.left));
      const right = Math.max(...rects.map((r) => r.right));
      // only trust the measurement while the desktop is still flat
      if (rects[0].top > 4 || right - left < 4) return;
      found.push({ x: left, w: right - left, i });
    });
    if (found.length) setSpots(found);
  }, []);
  return (
    <div className="td-notes">
      {spots.map((s, n) => (
        <span key={s.i} className={n % 2 ? 'low' : ''} style={{ left: s.x + s.w / 2 }}>
          {PANEL_SPOTS[s.i][lens]}
        </span>
      ))}
    </div>
  );
}

function Display({ d }: { d: Under['display'] }) {
  return (
    <div className="td-display">
      <span className="td-ruler x">
        {Array.from({ length: Math.floor(d.w / 200) + 1 }, (_, i) => (
          <i key={i} style={{ left: i * 200 }}>
            {i * 200}
          </i>
        ))}
      </span>
      <strong>
        {d.w} × {d.h}
      </strong>
      <span>
        {d.dpr}× pixels · {d.hz ? `${d.hz} Hz` : 'timing'} · {d.depth}-bit
      </span>
    </div>
  );
}

function Session({ procs }: { procs: Under['procs'] }) {
  return (
    <ul className="td-procs">
      {procs.slice(0, 15).map((p) => (
        <li key={p.id} className={'s-' + p.state}>
          <b>{p.name}</b>
          <span>{p.state === 'daemon' ? p.note : `${p.note} · ${p.state === 'elsewhere' ? 'other workspace' : p.state}`}</span>
        </li>
      ))}
    </ul>
  );
}

function Files({ fs, storage }: { fs: Under['fs']; storage: Under['storage'] }) {
  const most = Math.max(1, ...storage.keys.map((k) => k.bytes));
  return (
    <div className="td-files">
      <div className="td-tree">
        <em>the tree, rebuilt on every load</em>
        <div>
          {fs.top.slice(0, 6).map((d) => (
            // area is the directory's share of the bytes; the floor keeps a small one legible
            <span key={d.name} style={{ flexGrow: Math.max(d.bytes, fs.bytes * 0.05) }}>
              <b>~/{d.name}</b>
              {d.files} file{d.files === 1 ? '' : 's'} · {kb(d.bytes)}
            </span>
          ))}
        </div>
      </div>
      <div className="td-kept">
        <em>kept in this browser, sent nowhere</em>
        <ul>
          {!storage.ok && <li className="none">storage is blocked here</li>}
          {storage.ok && !storage.keys.length && <li className="none">nothing stored yet</li>}
          {storage.keys.slice(0, 5).map((k) => (
            <li key={k.key}>
              <b>{k.key}</b>
              <span className="bar">
                <i style={{ width: `${Math.max(3, (k.bytes / most) * 100)}%` }} />
              </span>
              <span>{kb(k.bytes)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Kernel({ k }: { k: Under['kernel'] }) {
  return (
    <div className="td-kernel">
      <div className="host on">
        <em>the pretend kernel</em>
        <b>browser runtime</b>
        <span>event loop {k.lagMs} ms late{k.heapMB !== null ? ` · heap ${k.heapMB} MB` : ''}</span>
      </div>
      <div className={'guest' + (k.vmOpen ? ' on' : '')}>
        <em>the real one</em>
        <b>{k.guest}</b>
        <span>
          x86 in WebAssembly · {k.guestMB} MB · {k.vmOpen ? 'running' : 'not booted'}
        </span>
      </div>
      <div className={k.psqlOpen ? 'on' : ''}>
        <em>a database engine</em>
        <b>PostgreSQL 18</b>
        <span>WebAssembly · {k.psqlOpen ? 'running' : 'not started'}</span>
      </div>
      <div className="on">
        <em>the network stack</em>
        <b>{k.routes} routes</b>
        <span>arXiv · a language model · radio</span>
      </div>
    </div>
  );
}

function Hardware({ h }: { h: Under['hardware'] }) {
  const cores = Math.min(h.cores ?? 0, 32);
  return (
    <div className="td-hardware">
      <svg className="td-mark" viewBox="0 0 24 24">
        <path d={KALI_MARK_PATH} />
      </svg>
      <div className="td-cores" style={{ ['--n' as string]: Math.max(2, Math.ceil(Math.sqrt(cores || 1) * 1.4)) }}>
        {cores ? Array.from({ length: cores }, (_, i) => <i key={i} />) : <span>cores not reported</span>}
      </div>
      <div className="td-hardware-side">
        <b>{h.cores ? `${h.cores} cores` : 'cores hidden'}</b>
        <span>{h.memoryGB ? `${h.memoryGB} GB+ memory` : 'memory not reported'}</span>
        <span>{h.platform}</span>
      </div>
    </div>
  );
}
