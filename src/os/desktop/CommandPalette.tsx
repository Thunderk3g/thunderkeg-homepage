'use client';

import { Command } from 'cmdk';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { useOS, isUndercover, WORKSPACE_COUNT } from '../store';
import { apps } from '../registry';
import { THEMES } from '../themes';
import { AppIcon, SysIcon } from '../icons';
import { WALLPAPERS } from './wallpapers';

const APP_KEYS: Record<string, string> = {
  terminal: 'Ctrl+Alt+T',
  files: 'Super+E',
  browser: 'Super+W',
};

function Kbd({ k }: { k?: string }) {
  if (!k) return null;
  return (
    <span className="kos-cmdk-keys">
      {k.split('+').map((p) => (
        <kbd key={p}>{p}</kbd>
      ))}
    </span>
  );
}

/** Global Cmd/Ctrl+K (or Alt+F2) palette — launch apps, switch theme/wallpaper, system actions. */
export function CommandPalette() {
  const open = useOS((s) => s.paletteOpen);
  const setOpen = useOS((s) => s.setPaletteOpen);
  const launch = useOS((s) => s.launch);
  const setTheme = useOS((s) => s.setTheme);
  const setWallpaper = useOS((s) => s.setWallpaper);
  const setReducedMotion = useOS((s) => s.setReducedMotion);
  const toggleUndercover = useOS((s) => s.toggleUndercover);
  const reduced = useOS((s) => s.settings.reducedMotion);
  const undercover = useOS(isUndercover);
  const s = useOS.getState;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        if ((e.target as HTMLElement | null)?.closest?.('.xterm')) return;
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === 'Escape' && useOS.getState().paletteOpen) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setOpen]);

  if (!open) return null;

  const run = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  const system: { id: string; label: string; icon: string; keys?: string; run: () => void }[] = [
    {
      id: 'undercover',
      label: undercover ? 'Leave Kali Undercover mode' : 'Kali Undercover mode',
      icon: 'undercover',
      run: () => {
        toggleUndercover();
        if (undercover) toast('Undercover mode off');
      },
    },
    { id: 'show-desktop', label: 'Show desktop', icon: 'show-desktop', keys: 'Super+D', run: () => s().showDesktop() },
    { id: 'lock', label: 'Lock screen', icon: 'lock', keys: 'Super+L', run: () => s().lock() },
    { id: 'logout', label: 'Log out…', icon: 'logout', keys: 'Ctrl+Alt+Del', run: () => s().setSessionDialog(true) },
    { id: 'restart', label: 'Restart', icon: 'restart', run: () => s().restart() },
    { id: 'shutdown', label: 'Shut down', icon: 'power', run: () => s().shutdown() },
    {
      id: 'motion',
      label: `Turn reduced motion ${reduced ? 'off' : 'on'}`,
      icon: 'a11y',
      run: () => {
        setReducedMotion(!reduced);
        toast(`Reduced motion ${!reduced ? 'on' : 'off'}`);
      },
    },
    { id: 'resume', label: 'Open plain résumé', icon: 'globe', run: () => window.open('/resume', '_blank') },
  ];

  return (
    <div className="kos-cmdk-overlay" onMouseDown={() => setOpen(false)}>
      <div className="kos-cmdk" onMouseDown={(e) => e.stopPropagation()}>
        <Command label="Command palette" loop>
          <div className="kos-cmdk-head">
            <SysIcon name="search" size={16} />
            <Command.Input autoFocus placeholder="Type a command or search…" className="kos-cmdk-input" />
            <kbd className="kos-cmdk-esc">Esc</kbd>
          </div>
          <Command.List className="kos-cmdk-list">
            <Command.Empty className="kos-cmdk-empty">No results found.</Command.Empty>

            <Command.Group heading="Applications" className="kos-cmdk-group">
              {apps
                .filter((a) => !a.hidden)
                .map((a) => (
                  <Command.Item
                    key={a.id}
                    value={`open ${a.title} ${a.category} ${a.description ?? ''}`}
                    onSelect={() => run(() => launch(a.id))}
                    className="kos-cmdk-item"
                  >
                    <AppIcon id={a.id} size={22} fallback={a.icon} className="kos-cmdk-icon" />
                    <span className="kos-cmdk-label">{a.title}</span>
                    <span className="kos-cmdk-meta">{a.category}</span>
                    <Kbd k={APP_KEYS[a.id]} />
                  </Command.Item>
                ))}
            </Command.Group>

            <Command.Group heading="System" className="kos-cmdk-group">
              {system.map((c) => (
                <Command.Item key={c.id} value={`system ${c.label}`} onSelect={() => run(c.run)} className="kos-cmdk-item">
                  <span className="kos-cmdk-icon sys">
                    <SysIcon name={c.icon} size={15} />
                  </span>
                  <span className="kos-cmdk-label">{c.label}</span>
                  <Kbd k={c.keys} />
                </Command.Item>
              ))}
              {Array.from({ length: WORKSPACE_COUNT }, (_, i) => (
                <Command.Item
                  key={'ws' + i}
                  value={`workspace ${i + 1}`}
                  onSelect={() => run(() => s().setWorkspace(i))}
                  className="kos-cmdk-item"
                >
                  <span className="kos-cmdk-icon sys">
                    <SysIcon name="workspace" size={15} />
                  </span>
                  <span className="kos-cmdk-label">Go to workspace {i + 1}</span>
                  <Kbd k={`Ctrl+Alt+${i + 1}`} />
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Group heading="Themes" className="kos-cmdk-group">
              {THEMES.map((t) => (
                <Command.Item
                  key={t.id}
                  value={`theme ${t.label}`}
                  onSelect={() =>
                    run(() => {
                      setTheme(t.id);
                      toast.success(`Theme: ${t.label}`);
                    })
                  }
                  className="kos-cmdk-item"
                >
                  <span className="kos-cmdk-swatch" style={{ background: t.vars['--kos-accent'] }} />
                  <span className="kos-cmdk-label">{t.label}</span>
                  <span className="kos-cmdk-meta">theme</span>
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Group heading="Wallpaper" className="kos-cmdk-group">
              {WALLPAPERS.map((w) => (
                <Command.Item
                  key={w.id}
                  value={`wallpaper ${w.label} ${w.id}`}
                  onSelect={() =>
                    run(() => {
                      setWallpaper(w.id);
                      toast(`Wallpaper: ${w.label}`);
                    })
                  }
                  className="kos-cmdk-item"
                >
                  <span className={'kos-cmdk-wall wall-' + w.id} />
                  <span className="kos-cmdk-label">{w.label}</span>
                  <span className="kos-cmdk-meta">wallpaper</span>
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
