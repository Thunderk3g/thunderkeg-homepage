'use client';

import { Command } from 'cmdk';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useOS } from '../store';
import { apps } from '../registry';
import { THEMES } from '../themes';

const WALLPAPERS = ['kali-dragon', 'kali-blue', 'kali-mountains', 'kali-matrix', 'kali-void'];

/** Global Cmd/Ctrl+K command palette — launch apps, switch theme/wallpaper, system actions. */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const launch = useOS((s) => s.launch);
  const setTheme = useOS((s) => s.setTheme);
  const setWallpaper = useOS((s) => s.setWallpaper);
  const setReducedMotion = useOS((s) => s.setReducedMotion);
  const reduced = useOS((s) => s.settings.reducedMotion);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!open) return null;

  const run = (fn: () => void) => {
    fn();
    setOpen(false);
  };

  return (
    <div className="kos-cmdk-overlay" onMouseDown={() => setOpen(false)}>
      <div className="kos-cmdk" onMouseDown={(e) => e.stopPropagation()}>
        <Command label="Command palette" loop>
          <Command.Input autoFocus placeholder="Type a command or search…" className="kos-cmdk-input" />
          <Command.List className="kos-cmdk-list">
            <Command.Empty className="kos-cmdk-empty">No results found.</Command.Empty>

            <Command.Group heading="Applications" className="kos-cmdk-group">
              {apps
                .filter((a) => !a.hidden)
                .map((a) => (
                  <Command.Item
                    key={a.id}
                    value={`open ${a.title} ${a.category}`}
                    onSelect={() => run(() => launch(a.id))}
                    className="kos-cmdk-item"
                  >
                    <span className="kos-cmdk-icon">{a.icon}</span>
                    <span>{a.title}</span>
                    <span className="kos-cmdk-meta">{a.category}</span>
                  </Command.Item>
                ))}
            </Command.Group>

            <Command.Group heading="Themes" className="kos-cmdk-group">
              {THEMES.map((t) => (
                <Command.Item
                  key={t.id}
                  value={`theme ${t.label}`}
                  onSelect={() => run(() => { setTheme(t.id); toast.success(`Theme: ${t.label}`); })}
                  className="kos-cmdk-item"
                >
                  <span className="kos-cmdk-icon">🎨</span>
                  <span>{t.label}</span>
                  <span className="kos-cmdk-meta">theme</span>
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Group heading="Wallpaper" className="kos-cmdk-group">
              {WALLPAPERS.map((w) => (
                <Command.Item
                  key={w}
                  value={`wallpaper ${w}`}
                  onSelect={() => run(() => { setWallpaper(w); toast(`Wallpaper: ${w}`); })}
                  className="kos-cmdk-item"
                >
                  <span className="kos-cmdk-icon">🖼</span>
                  <span>{w.replace('kali-', '')}</span>
                  <span className="kos-cmdk-meta">wallpaper</span>
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Group heading="System" className="kos-cmdk-group">
              <Command.Item
                value="toggle reduced motion"
                onSelect={() => run(() => { setReducedMotion(!reduced); toast(`Reduced motion ${!reduced ? 'on' : 'off'}`); })}
                className="kos-cmdk-item"
              >
                <span className="kos-cmdk-icon">⚙</span>
                <span>Toggle reduced motion</span>
              </Command.Item>
              <Command.Item
                value="open plain resume"
                onSelect={() => run(() => window.open('/resume', '_blank'))}
                className="kos-cmdk-item"
              >
                <span className="kos-cmdk-icon">📄</span>
                <span>Open plain résumé</span>
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
