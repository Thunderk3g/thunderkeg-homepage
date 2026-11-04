import type { AppDefinition, Command } from './types';
import { terminalApp } from './apps/terminal/Terminal';
import { vmApp } from './apps/vm/VirtualMachine';
import { browserApp } from './apps/browser/Browser';
import { fileManagerApp } from './apps/files/FileManager';
import { settingsApp } from './apps/settings/Settings';
import { assistantApp } from './apps/assistant/Assistant';
import { codeEditorApp } from './apps/codeeditor/CodeEditor';
import { writingApp } from './apps/writing/Writing';
import { researchApp } from './apps/research/Research';
import { learningApp } from './apps/learning/LearningApp';
import { psqlApp } from './apps/psql/Psql';

/**
 * Shell-side overrides for apps whose definition lives in a module owned
 * elsewhere: the menu category and whether it gets a desktop launcher.
 */
const OVERRIDES: Record<string, Partial<Pick<AppDefinition, 'category' | 'desktop'>>> = {
  research: { category: 'Research' },
  learning: { category: 'Research' },
  writing: { category: 'Research' },
  psql: { category: 'Research' },
};

const withOverrides = (a: AppDefinition): AppDefinition => (OVERRIDES[a.id] ? { ...a, ...OVERRIDES[a.id] } : a);

/**
 * Every registered application. The order of the `desktop: true` entries is
 * the order of the desktop launchers.
 */
export const apps: AppDefinition[] = [
  terminalApp,
  browserApp,
  researchApp,
  learningApp,
  writingApp,
  fileManagerApp,
  vmApp,
  psqlApp,
  assistantApp,
  codeEditorApp,
  settingsApp,
].map(withOverrides);

const appMap = new Map(apps.map((a) => [a.id, a]));

export function getApp(id: string): AppDefinition | undefined {
  return appMap.get(id);
}

export function appsByCategory(): Map<string, AppDefinition[]> {
  const map = new Map<string, AppDefinition[]>();
  for (const a of apps) {
    if (a.hidden) continue;
    if (!map.has(a.category)) map.set(a.category, []);
    map.get(a.category)!.push(a);
  }
  return map;
}

export const desktopApps = apps.filter((a) => a.desktop);

/** Terminal commands that launch apps (firefox, thunar, nano, psql…). */
export const appLaunchCommands: Command[] = apps.flatMap((app) =>
  (app.launchCommands ?? []).map((name) => ({
    name,
    summary: `launch ${app.title}`,
    category: 'apps',
    run: ({ shell, args }) => {
      const launchArgs: Record<string, unknown> = {};
      if (args[0]) {
        launchArgs.arg = args[0];
        // file-taking apps (nano notes.md) get an absolute path as well
        if (app.id === 'code-editor') launchArgs.path = shell.fs.resolve(args[0], shell.cwd);
      }
      shell.launch(app.id, launchArgs);
      return `opening ${app.title}…`;
    },
  })),
);
