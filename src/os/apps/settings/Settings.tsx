'use client';

import { useEffect, useState, version as reactVersion } from 'react';
import type { AppDefinition, AppProps } from '../../types';
import { useOS, isUndercover, UNDERCOVER_THEME } from '../../store';
import { getDisplayName, setDisplayName } from '../../net/supabase';
import { THEMES } from '../../themes';
import { SysIcon, KaliMark } from '../../icons';
import { WALLPAPERS } from '../../desktop/wallpapers';
import { SHORTCUTS } from '../../desktop/Shortcuts';
import pkg from '../../../../package.json';

const ACCENTS = ['#2777ff', '#367bf0', '#16a085', '#e0322f', '#9b59b6', '#f39c12', '#2ecc71'];

type Page = 'appearance' | 'wallpaper' | 'panel' | 'wm' | 'keyboard' | 'multiplayer' | 'a11y' | 'about';

const PAGES: { id: Page; label: string; icon: string }[] = [
  { id: 'appearance', label: 'Appearance', icon: 'desktop' },
  { id: 'wallpaper', label: 'Wallpaper', icon: 'image' },
  { id: 'panel', label: 'Panel', icon: 'panel' },
  { id: 'wm', label: 'Window Manager Tweaks', icon: 'window' },
  { id: 'keyboard', label: 'Keyboard Shortcuts', icon: 'keyboard' },
  { id: 'multiplayer', label: 'Multiplayer', icon: 'users' },
  { id: 'a11y', label: 'Accessibility', icon: 'a11y' },
  { id: 'about', label: 'About Kali OS', icon: 'info' },
];

const deps = (pkg as { dependencies?: Record<string, string> }).dependencies ?? {};
const ver = (name: string) => (deps[name] ? deps[name].replace(/^[\^~]/, '') : 'not installed');

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="kos-set-row">
      <span className="kos-set-row-text">
        <span>{label}</span>
        {hint && <small>{hint}</small>}
      </span>
      <input type="checkbox" className="kos-switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function SettingsApp({ args }: AppProps) {
  const settings = useOS((s) => s.settings);
  const setWallpaper = useOS((s) => s.setWallpaper);
  const setTheme = useOS((s) => s.setTheme);
  const setAccent = useOS((s) => s.setAccent);
  const setReducedMotion = useOS((s) => s.setReducedMotion);
  const setTerminalOpacity = useOS((s) => s.setTerminalOpacity);
  const setSetting = useOS((s) => s.setSetting);
  const toggleUndercover = useOS((s) => s.toggleUndercover);
  const undercover = useOS(isUndercover);
  const [name, setName] = useState(getDisplayName());
  const requested = typeof args?.page === 'string' ? (args.page as Page) : undefined;
  const [page, setPage] = useState<Page>(requested ?? 'appearance');

  useEffect(() => {
    if (requested && PAGES.some((p) => p.id === requested)) setPage(requested);
  }, [requested, args]);

  const current = PAGES.find((p) => p.id === page)!;

  return (
    <div className="kos-settings">
      <nav className="kos-settings-nav" aria-label="Settings categories">
        {PAGES.map((p) => (
          <button
            key={p.id}
            className={'kos-settings-cat' + (page === p.id ? ' active' : '')}
            onClick={() => setPage(p.id)}
            aria-current={page === p.id ? 'page' : undefined}
          >
            <SysIcon name={p.icon} size={16} />
            <span>{p.label}</span>
          </button>
        ))}
      </nav>

      <div className="kos-settings-pane">
        <h2 className="kos-settings-title">{current.label}</h2>

        {page === 'appearance' && (
          <>
            <div className="kos-settings-group">
              <h3>Style</h3>
              <div className="kos-theme-grid">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    className={'kos-theme-card' + (settings.theme === t.id ? ' active' : '')}
                    onClick={() => setTheme(t.id)}
                    style={{
                      ['--sw-bg' as string]: t.vars['--kos-win'],
                      ['--sw-bar' as string]: t.vars['--kos-titlebar-active'],
                      ['--sw-acc' as string]: t.vars['--kos-accent'],
                    }}
                  >
                    <span className="kos-theme-swatch" aria-hidden="true">
                      <i />
                      <b />
                    </span>
                    <span className="kos-theme-name">{t.label}</span>
                    {t.note && <small>{t.note}</small>}
                  </button>
                ))}
              </div>
            </div>
            <div className="kos-settings-group">
              <h3>Accent colour</h3>
              <div className="kos-settings-accents">
                {ACCENTS.map((c) => (
                  <button
                    key={c}
                    className={'kos-accent-dot' + (settings.accent.toLowerCase() === c ? ' active' : '')}
                    style={{ background: c }}
                    onClick={() => setAccent(c)}
                    aria-label={`Accent ${c}`}
                  />
                ))}
              </div>
            </div>
            <div className="kos-settings-group">
              <h3>Kali Undercover</h3>
              <Toggle
                checked={undercover}
                onChange={() => toggleUndercover()}
                label="Kali Undercover mode"
                hint="Switch to a Windows-10 look, bottom taskbar and plain prompt — for working in public."
              />
              {settings.theme !== UNDERCOVER_THEME && (
                <p className="kos-settings-hint">Also in the Applications menu and the command palette.</p>
              )}
            </div>
            <div className="kos-settings-group">
              <h3>Terminal opacity</h3>
              <div className="kos-set-slider">
                <input
                  type="range"
                  min={0.5}
                  max={1}
                  step={0.01}
                  value={settings.terminalOpacity}
                  onChange={(e) => setTerminalOpacity(parseFloat(e.target.value))}
                  aria-label="Terminal opacity"
                />
                <span className="kos-settings-val">{Math.round(settings.terminalOpacity * 100)}%</span>
              </div>
            </div>
          </>
        )}

        {page === 'wallpaper' && (
          <div className="kos-settings-group">
            {undercover && <p className="kos-settings-hint">Undercover mode uses its own wallpaper while it is on.</p>}
            <div className="kos-settings-walls">
              {WALLPAPERS.map((w) => (
                <button
                  key={w.id}
                  className={'kos-wall-thumb wall-' + w.id + (settings.wallpaper === w.id ? ' active' : '')}
                  onClick={() => setWallpaper(w.id)}
                  title={w.label}
                  aria-pressed={settings.wallpaper === w.id}
                >
                  <span>{w.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {page === 'panel' && (
          <div className="kos-settings-group">
            <Toggle checked={settings.clock24} onChange={(v) => setSetting('clock24', v)} label="24-hour clock" hint="Format %H:%M" />
            <Toggle
              checked={settings.panelGraph}
              onChange={(v) => setSetting('panelGraph', v)}
              label="CPU graph"
              hint="xfce4-cpugraph, 128 px, bar mode"
            />
            <div className="kos-set-row static">
              <span className="kos-set-row-text">
                <span>Position</span>
                <small>{undercover ? 'Bottom, 44 px (Undercover)' : 'Top, 34 px'}</small>
              </span>
            </div>
          </div>
        )}

        {page === 'wm' && (
          <div className="kos-settings-group">
            <Toggle
              checked={settings.snapping}
              onChange={(v) => setSetting('snapping', v)}
              label="Snap windows to screen edges"
              hint="Drag to the top edge to maximise, to the sides to tile."
            />
            <Toggle
              checked={!settings.reducedMotion}
              onChange={(v) => setReducedMotion(!v)}
              label="Animate windows"
              hint="Open, close, minimise and tiling transitions."
            />
          </div>
        )}

        {page === 'keyboard' && (
          <div className="kos-settings-group">
            <table className="kos-keys-table">
              <thead>
                <tr>
                  <th>Command</th>
                  <th>Shortcut</th>
                </tr>
              </thead>
              <tbody>
                {SHORTCUTS.map((s) => (
                  <tr key={s.keys}>
                    <td>{s.action}</td>
                    <td>
                      <code>{s.keys}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {page === 'multiplayer' && (
          <div className="kos-settings-group">
            <h3>Handle</h3>
            <p className="kos-settings-hint">Shown to other players in online games and chat.</p>
            <input
              className="kos-settings-input"
              value={name}
              maxLength={24}
              aria-label="Multiplayer handle"
              onChange={(e) => {
                setName(e.target.value);
                setDisplayName(e.target.value);
              }}
            />
          </div>
        )}

        {page === 'a11y' && (
          <div className="kos-settings-group">
            <Toggle
              checked={settings.reducedMotion}
              onChange={setReducedMotion}
              label="Reduce motion"
              hint="Turns off window animations and the wallpaper drift. Also follows your system setting."
            />
            <Toggle
              checked={settings.hidpi}
              onChange={(v) => setSetting('hidpi', v)}
              label="Kali HiDPI mode"
              hint="Larger interface text (14 → 16 px)."
            />
          </div>
        )}

        {page === 'about' && (
          <div className="kos-settings-group kos-about">
            <div className="kos-about-head">
              <span className="kos-about-mark">
                <KaliMark size={40} />
              </span>
              <div>
                <strong>Kali OS — web edition</strong>
                <span>A Kali-inspired Xfce desktop, built as a portfolio</span>
              </div>
            </div>
            <table className="kos-keys-table">
              <tbody>
                <tr>
                  <td>Kali OS</td>
                  <td>
                    <code>{(pkg as { version?: string }).version ?? '—'}</code>
                  </td>
                </tr>
                <tr>
                  <td>Next.js</td>
                  <td>
                    <code>{ver('next')}</code>
                  </td>
                </tr>
                <tr>
                  <td>React</td>
                  <td>
                    <code>{reactVersion}</code>
                  </td>
                </tr>
                <tr>
                  <td>v86</td>
                  <td>
                    <code>{ver('v86')}</code>
                  </td>
                </tr>
                <tr>
                  <td>PGlite</td>
                  <td>
                    <code>{ver('@electric-sql/pglite')}</code>
                  </td>
                </tr>
                <tr>
                  <td>Desktop</td>
                  <td>
                    <code>Xfce-style · xfwm4-style window manager</code>
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="kos-settings-hint kos-about-tm">
              KALI LINUX ™ is a trademark of OffSec. This site is an independent, Kali-inspired project and is not
              affiliated with or endorsed by OffSec. All artwork here is original.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export const settingsApp: AppDefinition = {
  id: 'settings',
  title: 'Settings',
  icon: '⚙',
  category: 'System',
  component: SettingsApp,
  description: 'Appearance, panel, window manager and accessibility',
  defaultSize: { width: 780, height: 540 },
  minSize: { width: 420, height: 360 },
  launchCommands: ['settings', 'xfce4-settings', 'xfce4-settings-manager'],
};

export default SettingsApp;
