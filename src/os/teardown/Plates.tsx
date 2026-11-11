'use client';

import { useLayoutEffect, useState } from 'react';
import { KALI_MARK_PATH } from '../icons';
import type { Lens } from './anatomy';
import { BREAKDOWNS, DRAWN, MAX_SLABS, slabBox } from './breakdowns';
import { kb, useTeardownModel, type Part, type Under } from './parts';
import { livePieces, type LiveGroup } from './pieces';
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
 *   slabs    the layer's components as pieces that rise off the plate on the
 *            layer's own screen, each layer in its own way (breakdowns.ts).
 *   flags    for a live layer, a label beside each real piece that lifts out:
 *            the panel's plugins, a window's title bar, the icons.
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
  const { parts, under, W, H } = useTeardownModel();
  const lens = useTeardown((s) => s.lens);
  const opened = useTeardown((s) => s.opened);
  const hot = useTeardown((s) => s.piece);
  return (
    <>
      {parts.map((p) => {
        const reading = p.anatomy[lens];
        const move = BREAKDOWNS[p.kind].move;
        const isOpen = opened === p.id;
        // a window has no plate of its own: only somewhere to hang its flags
        if (!p.plate) {
          return (
            <div key={p.id} className="td-plate bare" data-td-plate={p.id} aria-hidden="true">
              <Flags part={p} lens={lens} live={isOpen} />
            </div>
          );
        }
        return (
          <div key={p.id} className={`td-plate ${p.plate} k-${p.kind} m-${move}`} data-td-plate={p.id} aria-hidden="true">
            <span className="td-tab">
              <b>{String(parts.indexOf(p) + 1).padStart(2, '0')}</b>
              {reading.name}
            </span>
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
            {DRAWN.includes(move) ? <Slabs part={p} lens={lens} W={W} H={H} hot={isOpen ? hot : null} /> : <Flags part={p} lens={lens} live={isOpen} />}
          </div>
        );
      })}
    </>
  );
}

/**
 * The layer's components as pieces resting on the plate. They are laid out
 * here and moved by the camera loop (Teardown.tsx), which finds them by
 * data-td-slab; at rest they are invisible.
 */
function Slabs({ part, lens, W, H, hot }: { part: Part; lens: Lens; W: number; H: number; hot: number | null }) {
  const move = BREAKDOWNS[part.kind].move;
  const pieces = part.anatomy[lens].pieces.slice(0, MAX_SLABS);
  return (
    <div className="td-slabs" key={lens}>
      {pieces.map(([name], i) => {
        const b = slabBox(move, i, pieces.length, W, H);
        return (
          <div
            key={name}
            className={'td-slab' + (hot === i ? ' hot' : '')}
            data-td-slab={i}
            style={{ left: b.x, top: b.y, width: b.w, height: b.h, ['--i' as string]: i, ['--n' as string]: pieces.length }}
          >
            <span>
              <b>{String(i + 1)}</b>
              {name}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * A label beside each group of live pieces. Measured when the layer's screen
 * opens, since that is when the layer is as it will be shown; the loop lifts
 * each flag to the height of its group.
 */
function Flags({ part, lens, live }: { part: Part; lens: Lens; live: boolean }) {
  const [groups, setGroups] = useState<LiveGroup[]>([]);
  useLayoutEffect(() => {
    if (!live) return;
    const root = document.querySelector<HTMLElement>('.kos-desktop');
    const layer = root && part.selector ? root.querySelector<HTMLElement>(part.selector) : null;
    if (root) setGroups(livePieces(part.kind, layer, root).groups);
  }, [live, part.kind, part.selector]);
  return (
    <div className="td-flags">
      {groups.map((g, n) => {
        const at =
          g.flag === 'below'
            ? { left: g.box.x + g.box.w / 2, top: g.box.y + g.box.h }
            : g.flag === 'above'
              ? { left: g.box.x + g.box.w / 2, top: g.box.y }
              : { left: g.box.x + g.box.w, top: g.box.y + Math.min(g.box.h / 2, 40) };
        return (
          <span key={g.at} className={`td-flag f-${g.flag} t${n % 3}`} data-td-flag={n} style={at}>
            {g.names[lens]}
          </span>
        );
      })}
    </div>
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
