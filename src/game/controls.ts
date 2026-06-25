// Global keyboard state, polled in useFrame loops.
const keys = new Set<string>();
const pressed = new Set<string>(); // edge-triggered, consumed on read

let attached = false;

export function attachControls() {
  if (attached || typeof window === 'undefined') return;
  attached = true;
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    if (!keys.has(k)) pressed.add(k);
    keys.add(k);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());
}

export function isDown(...names: string[]) {
  return names.some((n) => keys.has(n));
}

/** true once per physical key press */
export function wasPressed(name: string) {
  if (pressed.has(name)) {
    pressed.delete(name);
    return true;
  }
  return false;
}

export function clearPressed() {
  pressed.clear();
}
