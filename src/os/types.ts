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
  | 'Accessories'
  | 'Games'
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

/* ───────────────────────── Games ───────────────────────── */

export interface GameProps {
  instanceId: string;
  /** report a final/high score to the arcade leaderboard */
  onScore?: (score: number) => void;
  /** multiplayer room id (set by the arcade lobby for `kind: 'multi'` games) */
  room?: string;
}

export interface GameDefinition {
  id: string;
  name: string;
  icon: string;
  tagline: string;
  kind: 'solo' | 'multi';
  /** e.g. "2", "2-4" */
  players?: string;
  tags?: string[];
  component: ComponentType<GameProps>;
  /** higher = listed earlier */
  weight?: number;
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
  /** launch a desktop app (used by `firefox`, `games`, `thunar`, …) */
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
}
