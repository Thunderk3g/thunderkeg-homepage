import * as L from "lucide-react";
import type { LucideProps } from "lucide-react";

const map = {
  terminal: L.Terminal,
  voice: L.Mic,
  resume: L.FileText,
  projects: L.Boxes,
  about: L.Info,
  social: L.Share2,
  doom: L.Skull,
  tetris: L.Grid3x3,
  mp3: L.Music,
  vlc: L.Film,
  close: L.X,
  min: L.Minus,
  max: L.Square,
  menu: L.Menu,
  power: L.Power,
} as const;
export type IconName = keyof typeof map;

export function Icon({
  name,
  size = 16,
  ...rest
}: { name: IconName } & LucideProps) {
  const C = map[name];
  return <C size={size} {...rest} />;
}
