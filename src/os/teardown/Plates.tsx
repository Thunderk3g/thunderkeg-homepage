'use client';

import { kb, useTeardownModel, type Under } from './parts';
import { useTeardown } from './store';

/**
 * The plates the teardown adds to the desktop: a pane of glass around each
 * see-through layer so it reads as a layer, and one solid plate for each
 * thing under the wallpaper. They are drawn in the desktop's own plane and
 * sized to the screen, so type is set in viewport units: at the scale the
 * stack is shown, 2.4vw is about a caption.
 *
 * Decoration only. Every figure on a plate is also in the parts list, as text.
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
  const number = (id: string) => String(parts.findIndex((p) => p.id === id) + 1).padStart(2, '0');
  return (
    <>
      {parts
        .filter((p) => p.plate)
        .map((p) => (
          <div key={p.id} className={'td-plate ' + p.plate + ' k-' + p.kind} data-td-plate={p.id} aria-hidden="true">
            {p.plate === 'solid' && (
              <header className="td-plate-head">
                <b>{number(p.id)}</b>
                <span>{p.name}</span>
                <i>{p.role}</i>
              </header>
            )}
            {p.kind === 'nowindows' && <p className="td-plate-empty">no windows open</p>}
            {p.kind === 'display' && <Display d={under.display} />}
            {p.kind === 'session' && <Session procs={under.procs} />}
            {p.kind === 'fs' && <Files fs={under.fs} />}
            {p.kind === 'storage' && <Storage s={under.storage} />}
            {p.kind === 'machine' && <Machine m={under.machine} />}
          </div>
        ))}
    </>
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
      <span className="td-ruler y">
        {Array.from({ length: Math.floor(d.h / 200) + 1 }, (_, i) => (
          <i key={i} style={{ top: i * 200 }}>
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

function Files({ fs }: { fs: Under['fs'] }) {
  const shown = fs.top.slice(0, 8);
  return (
    <div className="td-files">
      {shown.map((d) => (
        // area is the directory's share of the bytes; the floor keeps a small one legible
        <div key={d.name} style={{ flexGrow: Math.max(d.bytes, fs.bytes * 0.04) }}>
          <b>~/{d.name}</b>
          <span>
            {d.files} file{d.files === 1 ? '' : 's'} · {kb(d.bytes)}
          </span>
        </div>
      ))}
    </div>
  );
}

function Storage({ s }: { s: Under['storage'] }) {
  const most = Math.max(1, ...s.keys.map((k) => k.bytes));
  return (
    <ul className="td-storage">
      {!s.ok && <li className="none">storage is blocked in this browser</li>}
      {s.ok && !s.keys.length && <li className="none">nothing stored yet</li>}
      {s.keys.slice(0, 7).map((k) => (
        <li key={k.key}>
          <b>{k.key}</b>
          <span className="bar">
            <i style={{ width: `${Math.max(2, (k.bytes / most) * 100)}%` }} />
          </span>
          <span>{kb(k.bytes)}</span>
        </li>
      ))}
    </ul>
  );
}

function Machine({ m }: { m: Under['machine'] }) {
  const cores = Math.min(m.cores ?? 0, 32);
  return (
    <div className="td-machine">
      <div className="td-cores" style={{ ['--n' as string]: Math.ceil(Math.sqrt(cores || 1) * 1.4) }}>
        {cores ? Array.from({ length: cores }, (_, i) => <i key={i} />) : <span>cores not reported</span>}
      </div>
      <div className="td-machine-side">
        <b>{m.cores ? `${m.cores} cores` : 'cores hidden'}</b>
        <span>{m.memoryGB ? `${m.memoryGB} GB+ memory` : 'memory not reported'}</span>
        <span>{m.platform}</span>
        <span className={'vm' + (m.vmOpen ? ' on' : '')}>{m.vmOpen ? 'Linux guest running' : 'Linux guest not booted'}</span>
      </div>
    </div>
  );
}
