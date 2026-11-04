'use client';

import { useEffect } from 'react';
import { useOS } from '../store';
import { getApp } from '../registry';
import { isTypingTarget } from './layout';

/**
 * Global desktop shortcuts (Kali's xfce4-keyboard-shortcuts defaults).
 * Exported as data so Settings → Keyboard can list exactly what is wired up.
 *
 * Etiquette: inside an `.xterm` (the VM) nothing is intercepted, so the guest
 * gets every key. Everything else handled here is a chord that never edits
 * text (Super+…, Ctrl+Alt+…, Alt+F…), so it works from text fields too —
 * except Ctrl+Esc, which fields keep.
 */
export const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: 'Super', action: 'Open the Applications (Whisker) menu' },
  { keys: 'Alt+F1 · Ctrl+Esc', action: 'Open the Applications menu' },
  { keys: 'Alt+F2', action: 'Run command (command palette)' },
  { keys: 'Ctrl+K', action: 'Command palette' },
  { keys: 'Ctrl+Alt+T · Super+T', action: 'Terminal' },
  { keys: 'Super+E', action: 'File manager' },
  { keys: 'Super+W', action: 'Web browser' },
  { keys: 'Super+L', action: 'Lock screen' },
  { keys: 'Super+D', action: 'Show desktop' },
  { keys: 'Alt+Tab · Alt+Shift+Tab', action: 'Cycle windows' },
  { keys: 'Alt+F4', action: 'Close window' },
  { keys: 'Alt+F11', action: 'Toggle maximise' },
  { keys: 'Super+Up', action: 'Maximise window' },
  { keys: 'Super+Down', action: 'Restore / hide window' },
  { keys: 'Super+Left / Right', action: 'Tile window to the left / right half' },
  { keys: 'Ctrl+Alt+Left / Right', action: 'Previous / next workspace' },
  { keys: 'Ctrl+Alt+1 … 4', action: 'Go to workspace 1–4' },
  { keys: 'Ctrl+Alt+Delete', action: 'Log out dialog' },
];

export function Shortcuts() {
  useEffect(() => {
    let superDown = false;
    let superUsed = false;

    const onKeyDown = (e: KeyboardEvent) => {
      const s = useOS.getState();
      const where = isTypingTarget(e.target);
      if (where === 'xterm') return;

      if (e.key === 'Meta' || e.key === 'OS' || e.key === 'Super') {
        superDown = true;
        superUsed = false;
        return;
      }
      if (superDown) superUsed = true;

      // the session dialog / lock screen own the keyboard
      if (s.phase !== 'desktop' || s.sessionDialog) return;

      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const sup = e.metaKey;
      const ctrlAlt = e.ctrlKey && e.altKey && !sup;
      const focused = s.focusedId;
      const act = (fn: () => void) => {
        e.preventDefault();
        e.stopPropagation();
        fn();
      };
      const launchIf = (id: string) => getApp(id) && s.launch(id);

      // Ctrl+Alt chords
      if (ctrlAlt) {
        if (k === 't') return act(() => launchIf('terminal'));
        if (k === 'ArrowLeft') return act(() => s.switchWorkspace(-1));
        if (k === 'ArrowRight') return act(() => s.switchWorkspace(1));
        if (k === 'Delete') return act(() => s.setSessionDialog(true));
        if (/^[1-4]$/.test(e.code.replace('Digit', ''))) return act(() => s.setWorkspace(+e.code.replace('Digit', '') - 1));
        return;
      }

      // Super chords
      if (sup && !e.ctrlKey && !e.altKey) {
        if (k === 't') return act(() => launchIf('terminal'));
        if (k === 'e') return act(() => launchIf('files'));
        if (k === 'w') return act(() => launchIf('browser'));
        if (k === 'l') return act(() => s.lock());
        if (k === 'd') return act(() => s.showDesktop());
        if (focused) {
          if (k === 'ArrowUp') return act(() => s.tile(focused, 'up'));
          if (k === 'ArrowDown') return act(() => s.tile(focused, 'down'));
          if (k === 'ArrowLeft') return act(() => s.tile(focused, 'left'));
          if (k === 'ArrowRight') return act(() => s.tile(focused, 'right'));
        }
        return;
      }

      // Alt+F-keys
      if (e.altKey && !e.ctrlKey && !sup) {
        if (k === 'F1') return act(() => s.setMenuOpen((o) => !o));
        if (k === 'F2') return act(() => s.setPaletteOpen(true));
        if (k === 'F4' && focused) return act(() => s.close(focused));
        if (k === 'F11' && focused) return act(() => s.toggleMaximize(focused));
        return;
      }

      if (e.ctrlKey && k === 'Escape' && !where) return act(() => s.setMenuOpen((o) => !o));
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key !== 'Meta' && e.key !== 'OS' && e.key !== 'Super') return;
      const tapped = superDown && !superUsed;
      superDown = false;
      if (!tapped) return;
      const s = useOS.getState();
      if (s.phase !== 'desktop' || s.sessionDialog) return;
      const where = isTypingTarget(e.target);
      // a bare Super tap while typing still opens the menu in Xfce — but not inside the VM
      if (where === 'xterm') return;
      s.setMenuOpen((o) => !o);
    };

    const onBlur = () => {
      superDown = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  return null;
}
