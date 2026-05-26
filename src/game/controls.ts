import type { KeyboardControlsEntry } from "@react-three/drei";

/** Named movement actions bound to keys via drei's <KeyboardControls>. */
export enum Controls {
  forward = "forward",
  back = "back",
  left = "left",
  right = "right",
  interact = "interact",
}

export const keyboardMap: KeyboardControlsEntry<Controls>[] = [
  { name: Controls.forward, keys: ["ArrowUp", "KeyW"] },
  { name: Controls.back, keys: ["ArrowDown", "KeyS"] },
  { name: Controls.left, keys: ["ArrowLeft", "KeyA"] },
  { name: Controls.right, keys: ["ArrowRight", "KeyD"] },
  { name: Controls.interact, keys: ["KeyE", "Enter"] },
];
