'use client';

import { useEffect, useRef, useState } from 'react';
import { usePresence } from '../net/realtime';
import { useOS, isUndercover } from '../store';
import { SysIcon } from '../icons';
import { useClock } from './useClock';
import { Calendar } from './Calendar';
import { CpuGraph } from './CpuGraph';

type Pop = 'net' | 'vol' | 'bell' | 'bat' | 'cal' | null;

interface BatteryLike {
  level: number;
  charging: boolean;
  addEventListener: (t: string, f: () => void) => void;
  removeEventListener: (t: string, f: () => void) => void;
}

function useBattery() {
  const [bat, setBat] = useState<{ level: number; charging: boolean } | null>(null);
  useEffect(() => {
    const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryLike> };
    if (!nav.getBattery) return;
    let b: BatteryLike | null = null;
    const update = () => b && setBat({ level: b.level, charging: b.charging });
    nav
      .getBattery()
      .then((x) => {
        b = x;
        update();
        x.addEventListener('levelchange', update);
        x.addEventListener('chargingchange', update);
      })
      .catch(() => {});
    return () => {
      b?.removeEventListener('levelchange', update);
      b?.removeEventListener('chargingchange', update);
    };
  }, []);
  return bat;
}

/** The right-hand side of the Xfce panel: cpugraph · systray · volume · bell · battery · clock · lock · logout. */
export function SystemTray() {
  const { users, status } = usePresence('global');
  const now = useClock(1000);
  const clock24 = useOS((s) => s.settings.clock24);
  const showGraph = useOS((s) => s.settings.panelGraph);
  const undercover = useOS(isUndercover);
  const lock = useOS((s) => s.lock);
  const setSessionDialog = useOS((s) => s.setSessionDialog);
  const bat = useBattery();
  const [pop, setPop] = useState<Pop>(null);
  const [volume, setVolume] = useState(64);
  const [muted, setMuted] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pop) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setPop(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPop(null);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [pop]);

  const toggle = (p: Pop) => setPop((o) => (o === p ? null : p));
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: !clock24 });
  const date = now.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
  const shortDate = now.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' });
  const batPct = bat ? Math.round(bat.level * 100) : 100;
  const batIcon = bat?.charging ? 'battery-charging' : batPct > 70 ? 'battery-full' : batPct < 25 ? 'battery-low' : 'battery';

  return (
    <div className="kos-tray" ref={root}>
      {showGraph && !undercover && <CpuGraph />}

      <span
        className={'kos-tray-item kos-tray-presence s-' + status}
        title={`${users.length} online: ${users.map((u) => u.name).join(', ') || 'just you'}`}
      >
        <SysIcon name="users" size={15} />
        <span className="n">{users.length}</span>
      </span>

      <span className="kos-tray-pop">
        <button className={'kos-tray-item' + (pop === 'net' ? ' open' : '')} onClick={() => toggle('net')} aria-label="Network">
          <SysIcon name="network" size={15} />
        </button>
        {pop === 'net' && (
          <div className="kos-popover right" role="dialog" aria-label="Network">
            <div className="kos-pop-title">Ethernet Network</div>
            <div className="kos-pop-row on">
              <SysIcon name="network" size={14} /> Wired connection 1 <span className="tag">connected</span>
            </div>
            <div className="kos-pop-row">
              <SysIcon name="shield" size={14} /> VPN <span className="tag dim">disconnected</span>
            </div>
            <div className="kos-pop-sep" />
            <div className="kos-pop-mono">eth0 inet 10.0.2.15/24</div>
          </div>
        )}
      </span>

      <span className="kos-tray-pop">
        <button
          className={'kos-tray-item' + (pop === 'vol' ? ' open' : '')}
          onClick={() => toggle('vol')}
          aria-label="Volume"
          onWheel={(e) => setVolume((v) => Math.max(0, Math.min(100, v - Math.sign(e.deltaY) * 5)))}
        >
          <SysIcon name={muted || volume === 0 ? 'mute' : 'volume'} size={15} />
        </button>
        {pop === 'vol' && (
          <div className="kos-popover right" role="dialog" aria-label="Volume">
            <div className="kos-pop-title">Built-in Audio Analog Stereo</div>
            <div className="kos-pop-slider">
              <button onClick={() => setMuted((m) => !m)} aria-label={muted ? 'Unmute' : 'Mute'}>
                <SysIcon name={muted ? 'mute' : 'volume'} size={15} />
              </button>
              <input
                type="range"
                min={0}
                max={100}
                value={muted ? 0 : volume}
                onChange={(e) => {
                  setMuted(false);
                  setVolume(+e.target.value);
                }}
                aria-label="Volume level"
              />
              <span className="v">{muted ? 0 : volume}%</span>
            </div>
          </div>
        )}
      </span>

      <span className="kos-tray-pop kos-tray-hide-sm">
        <button className={'kos-tray-item' + (pop === 'bell' ? ' open' : '')} onClick={() => toggle('bell')} aria-label="Notifications">
          <SysIcon name="bell" size={15} />
        </button>
        {pop === 'bell' && (
          <div className="kos-popover right" role="dialog" aria-label="Notifications">
            <div className="kos-pop-title">Notifications</div>
            <div className="kos-pop-empty">No new notifications</div>
          </div>
        )}
      </span>

      <span className="kos-tray-pop kos-tray-hide-sm">
        <button className={'kos-tray-item' + (pop === 'bat' ? ' open' : '')} onClick={() => toggle('bat')} aria-label="Power manager">
          <SysIcon name={batIcon} size={16} />
        </button>
        {pop === 'bat' && (
          <div className="kos-popover right" role="dialog" aria-label="Battery">
            <div className="kos-pop-title">Power Manager</div>
            <div className="kos-pop-row on">
              <SysIcon name={batIcon} size={14} /> {bat ? `Battery ${batPct}%` : 'On AC power'}
              <span className="tag">{bat ? (bat.charging ? 'charging' : 'discharging') : 'plugged in'}</span>
            </div>
          </div>
        )}
      </span>

      <span className="kos-tray-pop">
        <button
          className={'kos-tray-clock' + (pop === 'cal' ? ' open' : '')}
          onClick={() => toggle('cal')}
          title={date}
          aria-label={`Clock, ${date} ${time}`}
        >
          <span className="t">{time}</span>
          {undercover && <span className="d">{shortDate}</span>}
        </button>
        {pop === 'cal' && (
          <div className="kos-popover right cal" role="dialog" aria-label="Calendar">
            <Calendar now={now} />
          </div>
        )}
      </span>

      {!undercover && (
        <button className="kos-tray-item kos-tray-action kos-tray-hide-sm" onClick={lock} title="Lock Screen (Super+L)" aria-label="Lock screen">
          <SysIcon name="lock" size={15} />
        </button>
      )}
      <button
        className="kos-tray-item kos-tray-action"
        onClick={() => setSessionDialog(true)}
        title="Log Out…"
        aria-label="Log out"
      >
        <SysIcon name="power" size={15} />
      </button>
    </div>
  );
}
