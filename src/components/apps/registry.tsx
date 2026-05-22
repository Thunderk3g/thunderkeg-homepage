import type { AppKind } from "@/types/window";

const KINDS: AppKind[] = [
  "terminal",
  "voice",
  "resume",
  "projects",
  "about",
  "social",
  "tetris",
  "doom",
  "mp3",
  "vlc",
];

function Placeholder({ kind }: { kind: AppKind }) {
  const idx = KINDS.indexOf(kind);
  return (
    <div className="flex h-full items-center justify-center p-6 text-center font-mono text-sm text-muted">
      <code>{kind}</code>&nbsp;— placeholder, replaced in PR #{2 + idx}.
    </div>
  );
}

export const APP_REGISTRY: Record<AppKind, React.ComponentType> = {
  terminal: () => <Placeholder kind="terminal" />,
  voice:    () => <Placeholder kind="voice" />,
  resume:   () => <Placeholder kind="resume" />,
  projects: () => <Placeholder kind="projects" />,
  about:    () => <Placeholder kind="about" />,
  social:   () => <Placeholder kind="social" />,
  doom:     () => <Placeholder kind="doom" />,
  tetris:   () => <Placeholder kind="tetris" />,
  mp3:      () => <Placeholder kind="mp3" />,
  vlc:      () => <Placeholder kind="vlc" />,
};
