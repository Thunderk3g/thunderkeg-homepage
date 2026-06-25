'use client';

import { useState } from 'react';
import type { AppDefinition, AppProps } from '../../types';
import { useOS } from '../../store';
import { getDisplayName, setDisplayName } from '../../net/supabase';
import { THEMES } from '../../themes';

const WALLPAPERS = [
  { id: 'kali-dragon', label: 'Kali Dragon' },
  { id: 'kali-blue', label: 'Kali Blue' },
  { id: 'kali-mountains', label: 'Aurora' },
  { id: 'kali-matrix', label: 'Matrix' },
  { id: 'kali-void', label: 'Deep Void' },
];

const ACCENTS = ['#33aaff', '#16a085', '#e74c3c', '#9b59b6', '#f39c12', '#2ecc71'];

function SettingsApp() {
  const settings = useOS((s) => s.settings);
  const setWallpaper = useOS((s) => s.setWallpaper);
  const setTheme = useOS((s) => s.setTheme);
  const setAccent = useOS((s) => s.setAccent);
  const setReducedMotion = useOS((s) => s.setReducedMotion);
  const setTerminalOpacity = useOS((s) => s.setTerminalOpacity);
  const [name, setName] = useState(getDisplayName());

  return (
    <div className="kos-settings">
      <div className="kos-settings-group">
        <h3>Theme</h3>
        <div className="kos-settings-accents" style={{ flexWrap: 'wrap', gap: 8 }}>
          {THEMES.map((t) => (
            <button
              key={t.id}
              className={'kos-game-btn' + (settings.theme === t.id ? ' primary' : '')}
              onClick={() => setTheme(t.id)}
              style={{ borderColor: t.vars['--kos-accent'] }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: t.vars['--kos-accent'],
                  marginRight: 6,
                }}
              />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="kos-settings-group">
        <h3>Wallpaper</h3>
        <div className="kos-settings-walls">
          {WALLPAPERS.map((w) => (
            <button
              key={w.id}
              className={'kos-wall-thumb wall-' + w.id + (settings.wallpaper === w.id ? ' active' : '')}
              onClick={() => setWallpaper(w.id)}
              title={w.label}
            >
              <span>{w.label}</span>
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
              className={'kos-accent-dot' + (settings.accent === c ? ' active' : '')}
              style={{ background: c }}
              onClick={() => setAccent(c)}
            />
          ))}
        </div>
      </div>

      <div className="kos-settings-group">
        <h3>Multiplayer handle</h3>
        <p className="kos-settings-hint">Shown to other players in online games.</p>
        <input
          className="kos-settings-input"
          value={name}
          maxLength={24}
          onChange={(e) => {
            setName(e.target.value);
            setDisplayName(e.target.value);
          }}
        />
      </div>

      <div className="kos-settings-group">
        <h3>Terminal opacity</h3>
        <input
          type="range"
          min={0.5}
          max={1}
          step={0.02}
          value={settings.terminalOpacity}
          onChange={(e) => setTerminalOpacity(parseFloat(e.target.value))}
        />
        <span className="kos-settings-val">{Math.round(settings.terminalOpacity * 100)}%</span>
      </div>

      <div className="kos-settings-group">
        <label className="kos-settings-check">
          <input
            type="checkbox"
            checked={settings.reducedMotion}
            onChange={(e) => setReducedMotion(e.target.checked)}
          />
          Reduce motion (better for low-end GPUs)
        </label>
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
  description: 'Appearance & system settings',
  defaultSize: { width: 560, height: 520 },
  minSize: { width: 360, height: 360 },
  launchCommands: ['settings', 'xfce4-settings'],
};

export default SettingsApp;
