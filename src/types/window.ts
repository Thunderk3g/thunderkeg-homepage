export type AppKind =
  | "terminal" | "voice" | "resume" | "projects"
  | "about"    | "social" | "doom"   | "tetris" | "mp3" | "vlc"
  | "files"    | "code-editor";

export interface Bounds { x: number; y: number; width: number; height: number; }

export interface WindowState {
  id: string;
  kind: AppKind;
  title: string;
  bounds: Bounds;
  zIndex: number;
  minimised: boolean;
  maximised: boolean;
  prevBounds?: Bounds;
}
