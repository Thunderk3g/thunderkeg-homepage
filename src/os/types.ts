import type { ComponentType } from 'react';
import type { FileSystem } from './fs/filesystem';

/* ───────────────────────── Apps ───────────────────────── */

export type AppCategory =
  | 'Favorites'
  | 'Information Gathering'
  | 'Vulnerability Analysis'
  | 'Web Application Analysis'
  | 'Password Attacks'
  | 'Wireless Attacks'
  | 'Exploitation Tools'
  | 'Sniffing & Spoofing'
  | 'Forensics'
  | 'Reverse Engineering'
  | 'Reporting Tools'
  | 'Internet'
  | 'Development'
  | 'Research'
  | 'Accessories'
  | 'Games'
  | 'Multimedia'
  | 'System';

export interface AppProps {
  windowId: string;
  args?: Record<string, unknown>;
}

export interface AppDefinition {
  id: string;
  title: string;
  /** emoji / short glyph used as the icon everywhere */
  icon: string;
  category: AppCategory;
  component: ComponentType<AppProps>;
  description?: string;
  defaultSize?: { width: number; height: number };
  minSize?: { width: number; height: number };
  /** render a launcher icon on the desktop */
  desktop?: boolean;
  /** allow more than one window of this app at once */
  multi?: boolean;
  /** hide from the application menu */
  hidden?: boolean;
  /** terminal command alias(es) that launch this app */
  launchCommands?: string[];
}

/* ───────────────────────── Terminal ───────────────────────── */

export interface FsNode {
  type: 'dir' | 'file';
  content?: string;
  children?: Record<string, FsNode>;
  mode?: string;
  /** executable bit (affects `ls` colouring and run semantics) */
  exec?: boolean;
}

export interface ShellApi {
  fs: FileSystem;
  cwd: string;
  setCwd: (path: string) => void;
  env: Record<string, string>;
  user: string;
  host: string;
  history: string[];
  /** launch a desktop app (used by `firefox`, `thunar`, `psql`, …) */
  launch: (appId: string, args?: Record<string, unknown>) => void;
  /** clear the terminal screen */
  clear: () => void;
  /** run another command line (aliases, chaining) */
  exec: (line: string) => Promise<void>;
}

export interface CommandContext {
  /** argv after the command name */
  args: string[];
  /** the full raw line as typed */
  raw: string;
  /** print a line (newline appended) */
  print: (text?: string) => void;
  /** print raw text (no newline) */
  write: (text: string) => void;
  shell: ShellApi;
  /** piped input from a previous command, if any */
  stdin?: string;
}

export interface Command {
  name: string;
  summary: string;
  usage?: string;
  category?: string;
  run: (ctx: CommandContext) => void | string | Promise<void | string>;
  complete?: (ctx: { args: string[]; shell: ShellApi }) => string[];
}

/* ───────────────────────── Window manager ───────────────────────── */

export interface WindowState {
  id: string;
  appId: string;
  title: string;
  icon: string;
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
  minimized: boolean;
  maximized: boolean;
  restore?: { x: number; y: number; width: number; height: number };
  args?: Record<string, unknown>;
  /** virtual desktop (0-based) this window lives on; undefined = 0 */
  workspace?: number;
  /** half-screen tile applied by edge-snap / Super+Left/Right */
  snapped?: 'left' | 'right';
  /** true while the close animation plays, just before the window unmounts */
  closing?: boolean;
}

/** Edge-snap / keyboard tiling targets. */
export type SnapZone = 'max' | 'left' | 'right';
