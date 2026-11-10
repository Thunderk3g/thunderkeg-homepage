'use client';

/**
 * Kali OS icon set.
 *
 *  - `AppIcon` — original flat-remix / Breeze-inspired application icons: a
 *    rounded squircle plate with a two-stop gradient and a white line glyph.
 *    Every glyph is drawn on a 24-unit grid with 1.75-unit strokes, so the set
 *    reads as one family at 16–64px.
 *  - `SysIcon` — symbolic panel / chrome glyphs (lucide-react, ISC licence).
 *  - `KaliMark` — the shell's own angular "data-dragon" mark. It is an
 *    original drawing, deliberately unlike the Kali Linux dragon (an OffSec
 *    trademark).
 *
 * Apps keep their emoji `icon` field; the shell maps app ids to these plates
 * and falls back to that emoji for ids it has no drawing for.
 */

import { useId, type ReactNode, type SVGProps } from 'react';
import {
  Accessibility, AppWindow, BookOpen, CodeXml, Wrench, ArrowLeft, ArrowRight, ArrowUp, BatteryCharging, BatteryFull, BatteryLow,
  BatteryMedium, Bell, Calendar, ChevronRight, Clipboard, Columns2, Copy, Cpu, EyeOff, FolderOpen, FolderPlus,
  Globe, Grid3x3, History, Image, Info, Keyboard, LayoutGrid, List, Lock, LogOut, Minus, Monitor, MonitorUp,
  Music2, Network, PanelTop, Power, RotateCcw, Search, Settings, Shield, Square, SquareTerminal, Star, Users, Volume2,
  VolumeX, Wifi, X, type LucideIcon,
  Layers,
} from 'lucide-react';

/* ───────────────────────── app plates ───────────────────────── */

interface Plate {
  from: string;
  to: string;
  glyph: ReactNode;
}

const S = { fill: 'none', stroke: '#fff', strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const F = { fill: '#fff', stroke: 'none' } as const;

/** gear outline, generated once */
const GEAR = (() => {
  const pts: string[] = [];
  const teeth = 8;
  for (let i = 0; i < teeth * 2; i++) {
    const r = i % 2 === 0 ? 8.6 : 6.6;
    const a0 = (i / (teeth * 2)) * Math.PI * 2 - 0.2;
    const a1 = a0 + Math.PI / (teeth * 1.15);
    pts.push(`${(12 + r * Math.cos(a0)).toFixed(2)},${(12 + r * Math.sin(a0)).toFixed(2)}`);
    pts.push(`${(12 + r * Math.cos(a1)).toFixed(2)},${(12 + r * Math.sin(a1)).toFixed(2)}`);
  }
  return 'M' + pts.join('L') + 'Z';
})();

/** The shell's mark: a coiled, faceted serpent drawn from straight segments. */
export const KALI_MARK_PATH =
  'M3.5 19.5 L7 15.5 L6 11.5 L9.5 8 L13.5 8.5 L16 5.5 L20.5 4 L18.5 8 L21 9.5 L17 11 L15 14.5 L11.5 13 L10 16.5 L13 19.5 L8.5 18.5 Z';

const GLYPHS: Record<string, Plate> = {
  terminal: {
    from: '#30343f', to: '#14161c',
    glyph: (
      <>
        <path {...S} d="M5.5 8 L10 12 L5.5 16" stroke="#59a0ff" />
        <path {...S} d="M12 16.5 H18.5" />
      </>
    ),
  },
  browser: {
    from: '#ff8a3d', to: '#9b3bd6',
    glyph: (
      <>
        <circle {...S} cx="12" cy="12" r="8" />
        <ellipse {...S} cx="12" cy="12" rx="3.6" ry="8" />
        <path {...S} d="M4.5 9.5 H19.5 M4.5 14.5 H19.5" />
      </>
    ),
  },
  news: {
    from: '#2fd1c5', to: '#2265d8',
    glyph: (
      <>
        <path {...S} d="M12 4 A8 8 0 1 0 20 12" />
        <path {...S} d="M12 8 A4 4 0 1 0 16 12" />
        <path {...S} d="M12 12 L18.5 5.5" />
        <circle {...F} cx="12" cy="12" r="1.6" />
      </>
    ),
  },
  music: {
    from: '#1fd6a0', to: '#0b6b8f',
    glyph: (
      <>
        <path {...S} d="M4.5 13 V12 A7.5 7.5 0 0 1 19.5 12 V13" />
        <rect {...S} x="3.8" y="13" width="3.6" height="6" rx="1.4" />
        <rect {...S} x="16.6" y="13" width="3.6" height="6" rx="1.4" />
      </>
    ),
  },
  hire: {
    from: '#ff9a62', to: '#d8423f',
    glyph: (
      <>
        <path {...S} d="M4 11.2 L20 4.2 L14.6 20 L11.4 13 Z" />
        <path {...S} d="M11.4 13 L20 4.2" />
      </>
    ),
  },
  research: {
    from: '#7c6cff', to: '#3b2fa8',
    glyph: (
      <>
        <path {...S} d="M9.5 4 H14.5 M10.5 4 V10 L5.6 18 A1.6 1.6 0 0 0 7 20.5 H17 A1.6 1.6 0 0 0 18.4 18 L13.5 10 V4" />
        <path {...S} d="M7.6 15 H16.4" />
      </>
    ),
  },
  writing: {
    from: '#f5b84c', to: '#d1621f',
    glyph: (
      <>
        <path {...S} d="M5 19 L6 15 L15.5 5.5 A2.1 2.1 0 0 1 18.5 8.5 L9 18 Z" />
        <path {...S} d="M14 7 L17 10 M12.5 19.5 H19" />
      </>
    ),
  },
  stacks: {
    from: '#5b8cff', to: '#2b3fa8',
    glyph: (
      <>
        <path {...S} d="M12 4.5 L18 7.5 L12 10.5 L6 7.5 Z" />
        <path {...S} d="M6 7.5 V16.5 L12 19.5 L18 16.5 V7.5 M12 10.5 V19.5" />
        <path {...S} d="M6 12 L12 15 L18 12" />
      </>
    ),
  },
  folder: {
    from: '#5aa2ff', to: '#2a5fd6',
    glyph: <path {...S} d="M4 7.5 A1.5 1.5 0 0 1 5.5 6 H10 L12 8 H18.5 A1.5 1.5 0 0 1 20 9.5 V17 A1.5 1.5 0 0 1 18.5 18.5 H5.5 A1.5 1.5 0 0 1 4 17 Z" />,
  },
  dolphin: {
    from: '#4fb6ff', to: '#1f5fd1',
    glyph: (
      <>
        <path
          {...S}
          d="M3.5 15.5 C6 10 11 7 16.5 7.8 L19 6 L18.6 9 C20.6 10.6 20.8 13.4 18.6 14.6 C16.6 15.6 14.2 14.2 11.8 15 L9.2 18 L9 15.4 C7 15.6 5 15.8 3.5 15.5 Z"
        />
        <path {...S} d="M12.5 8 L11.6 5.4 L14.4 7.6" />
        <circle {...F} cx="16.6" cy="10.4" r="0.9" />
      </>
    ),
  },
  file: {
    from: '#e9edf3', to: '#aab3c2',
    glyph: (
      <>
        <path {...S} stroke="#3a4250" d="M7 4 H13.5 L18 8.5 V19 A1 1 0 0 1 17 20 H7 A1 1 0 0 1 6 19 V5 A1 1 0 0 1 7 4 Z" />
        <path {...S} stroke="#3a4250" d="M13.5 4 V8.5 H18" />
      </>
    ),
  },
  'text-editor': {
    from: '#8fc1ff', to: '#3f78d8',
    glyph: (
      <>
        <path {...S} d="M7 4 H13.5 L18 8.5 V19 A1 1 0 0 1 17 20 H7 A1 1 0 0 1 6 19 V5 A1 1 0 0 1 7 4 Z" />
        <path {...S} d="M9 11.5 H15 M9 14.5 H15 M9 17.5 H12.5" />
      </>
    ),
  },
  settings: {
    from: '#8a94a8', to: '#454d5e',
    glyph: (
      <>
        <path {...S} d={GEAR} />
        <circle {...S} cx="12" cy="12" r="2.6" />
      </>
    ),
  },
  games: {
    from: '#ff5c8a', to: '#8e2bd1',
    glyph: (
      <>
        <path {...S} d="M7.5 8 H16.5 A4 4 0 0 1 20.4 12.9 L19.4 16.6 A1.9 1.9 0 0 1 16.2 17.4 L14.4 15.5 H9.6 L7.8 17.4 A1.9 1.9 0 0 1 4.6 16.6 L3.6 12.9 A4 4 0 0 1 7.5 8 Z" />
        <path {...S} d="M8 10.5 V13.5 M6.5 12 H9.5" />
        <circle {...F} cx="15.4" cy="11.2" r="1" />
        <circle {...F} cx="17" cy="13.2" r="1" />
      </>
    ),
  },
  assistant: {
    from: '#8b7bff', to: '#d24bd1',
    glyph: (
      <>
        <path {...S} d="M11 4 L12.8 9.2 L18 11 L12.8 12.8 L11 18 L9.2 12.8 L4 11 L9.2 9.2 Z" />
        <path {...S} d="M17.5 15.5 L18.2 17.3 L20 18 L18.2 18.7 L17.5 20.5 L16.8 18.7 L15 18 L16.8 17.3 Z" />
      </>
    ),
  },
  code: {
    from: '#2f9bff', to: '#1c3fa8',
    glyph: <path {...S} d="M8.5 8 L4.5 12 L8.5 16 M15.5 8 L19.5 12 L15.5 16 M13.4 5.5 L10.6 18.5" />,
  },
  penguin: {
    from: '#4a5568', to: '#171a21',
    glyph: (
      <>
        <path {...S} d="M12 3.8 C9.4 3.8 8.2 6 8.2 8.6 C8.2 10 7 11.4 6.2 13.4 C5 16.4 6.4 19.6 9 20 H15 C17.6 19.6 19 16.4 17.8 13.4 C17 11.4 15.8 10 15.8 8.6 C15.8 6 14.6 3.8 12 3.8 Z" />
        <path {...F} d="M10.6 11.4 L12 10.4 L13.4 11.4 L12 12.6 Z" fill="#ffc94a" />
        <circle {...F} cx="10.6" cy="8" r="0.85" />
        <circle {...F} cx="13.4" cy="8" r="0.85" />
        <path {...S} d="M9.8 14.2 C10.2 16.8 13.8 16.8 14.2 14.2" />
      </>
    ),
  },
  elephant: {
    from: '#4f86c6', to: '#24467a',
    glyph: (
      <>
        <path {...S} d="M8.2 8.4 C5 6.4 3 8.6 3.6 12 C4.1 14.8 6.4 15.4 8.2 14.2" />
        <path {...S} d="M15.8 8.4 C19 6.4 21 8.6 20.4 12 C19.9 14.8 17.6 15.4 15.8 14.2" />
        <path {...S} d="M8.2 14.4 C7.6 9 9.4 6 12 6 C14.6 6 16.4 9 15.8 14.4 C15.5 16.4 13.8 17 13.4 18.6 C13.2 19.6 14 20.4 15 20" />
        <circle {...F} cx="10.4" cy="11" r="0.9" />
        <circle {...F} cx="13.6" cy="11" r="0.9" />
      </>
    ),
  },
  'kali-mark': {
    from: '#3d8bff', to: '#5b2fc9',
    glyph: (
      <>
        <path {...S} d={KALI_MARK_PATH} />
        <circle {...F} cx="17.2" cy="7.1" r="0.9" />
      </>
    ),
  },
  undercover: {
    from: '#2f8cff', to: '#1450b8',
    glyph: (
      <>
        <rect {...F} x="5" y="5" width="6.2" height="6.2" rx="1" />
        <rect {...F} x="12.8" y="5" width="6.2" height="6.2" rx="1" />
        <rect {...F} x="5" y="12.8" width="6.2" height="6.2" rx="1" />
        <rect {...F} x="12.8" y="12.8" width="6.2" height="6.2" rx="1" />
      </>
    ),
  },
  backtrack: {
    from: '#e0322f', to: '#5a0d0d',
    glyph: <path {...S} d="M5.5 8 L10 12 L5.5 16 M12 16.5 H18.5" />,
  },
};

/** registry ids and aliases → plate key */
const ALIAS: Record<string, string> = {
  'code-editor': 'code',
  reconng: 'recon',
  files: 'dolphin',
  vm: 'penguin',
  psql: 'elephant',
  kali: 'kali-mark',
  start: 'undercover',
};

export function hasAppIcon(id: string): boolean {
  return Boolean(GLYPHS[ALIAS[id] ?? id]);
}

export interface AppIconProps {
  id: string;
  size?: number;
  /** shown when the id has no drawing (usually the app's emoji) */
  fallback?: string;
  className?: string;
  title?: string;
}

export function AppIcon({ id, size = 32, fallback, className, title }: AppIconProps) {
  const uid = useId().replace(/:/g, '');
  const plate = GLYPHS[ALIAS[id] ?? id];
  if (!plate) {
    return (
      <span
        className={'kos-appicon-fallback' + (className ? ' ' + className : '')}
        style={{ width: size, height: size, fontSize: Math.round(size * 0.72), lineHeight: `${size}px` }}
        aria-hidden={title ? undefined : true}
        title={title}
      >
        {fallback ?? '▫'}
      </span>
    );
  }
  const g = `kg${uid}`;
  const h = `kh${uid}`;
  return (
    <svg
      className={'kos-appicon' + (className ? ' ' + className : '')}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0" stopColor={plate.from} />
          <stop offset="1" stopColor={plate.to} />
        </linearGradient>
        <linearGradient id={h} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="3" y="3.5" width="42" height="42" rx="10" fill="rgba(0,0,0,0.28)" />
      <rect x="3" y="2.5" width="42" height="42" rx="10" fill={`url(#${g})`} />
      <rect x="3.5" y="3" width="41" height="41" rx="9.5" fill={`url(#${h})`} stroke="rgba(255,255,255,0.14)" />
      <g transform="translate(9.6 9.1) scale(1.2)">{plate.glyph}</g>
    </svg>
  );
}

/** The bare mark, for the panel menu button, splash and greeter. */
export function KaliMark({
  size = 20,
  className,
  ...rest
}: { size?: number; className?: string } & Omit<SVGProps<SVGSVGElement>, 'width' | 'height'>) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...rest}>
      <path d={KALI_MARK_PATH} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="17.2" cy="7.1" r="0.9" fill="currentColor" />
    </svg>
  );
}

/* ───────────────────────── symbolic icons ───────────────────────── */

const SYS: Record<string, LucideIcon> = {
  music: Music2,
  network: Network,
  wifi: Wifi,
  volume: Volume2,
  mute: VolumeX,
  battery: BatteryMedium,
  'battery-full': BatteryFull,
  'battery-low': BatteryLow,
  'battery-charging': BatteryCharging,
  cpu: Cpu,
  keyboard: Keyboard,
  search: Search,
  power: Power,
  lock: Lock,
  logout: LogOut,
  restart: RotateCcw,
  close: X,
  minimize: Minus,
  maximize: Square,
  restore: Copy,
  workspace: LayoutGrid,
  back: ArrowLeft,
  forward: ArrowRight,
  up: ArrowUp,
  grid: Grid3x3,
  list: List,
  split: Columns2,
  info: Info,
  terminal: SquareTerminal,
  bell: Bell,
  star: Star,
  history: History,
  desktop: Monitor,
  'show-desktop': MonitorUp,
  settings: Settings,
  undercover: EyeOff,
  chevron: ChevronRight,
  folder: FolderOpen,
  'folder-new': FolderPlus,
  calendar: Calendar,
  globe: Globe,
  window: AppWindow,
  paste: Clipboard,
  image: Image,
  a11y: Accessibility,
  panel: PanelTop,
  shield: Shield,
  book: BookOpen,
  code: CodeXml,
  tools: Wrench,
  layers: Layers,
};

export type SysIconName = keyof typeof SYS;

export function SysIcon({
  name,
  size = 16,
  className,
  strokeWidth = 1.75,
}: {
  name: string;
  size?: number;
  className?: string;
  strokeWidth?: number;
}) {
  const I = SYS[name] ?? Info;
  return <I size={size} strokeWidth={strokeWidth} className={className} aria-hidden="true" />;
}
