import type { AppDefinition, Command } from './types';
import { terminalApp } from './apps/terminal/Terminal';
import { vmApp } from './apps/vm/VirtualMachine';
import { browserApp } from './apps/browser/Browser';
import { fileManagerApp } from './apps/files/FileManager';
import { textEditorApp } from './apps/editor/TextEditor';
import { settingsApp } from './apps/settings/Settings';
import { gamesApp } from './apps/games/GamesApp';
import { assistantApp } from './apps/assistant/Assistant';
import { codeEditorApp } from './apps/codeeditor/CodeEditor';
import { writingApp } from './apps/writing/Writing';
import { researchApp } from './apps/research/Research';
import { learningApp } from './apps/learning/LearningApp';
import { toolApps } from './apps/tools';
import { psqlApp } from './apps/psql/Psql';

/** Every registered application. */
export const apps: AppDefinition[] = [
  terminalApp,
  vmApp,
  browserApp,
  researchApp,
  writingApp,
  learningApp,
  fileManagerApp,
  textEditorApp,
  settingsApp,
  gamesApp,
  assistantApp,
  codeEditorApp,
  psqlApp,
  ...toolApps,
];

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

/** Terminal commands that launch apps (firefox, thunar, games, msfconsole…). */
export const appLaunchCommands: Command[] = apps.flatMap((app) =>
  (app.launchCommands ?? []).map((name) => ({
    name,
    summary: `launch ${app.title}`,
    category: 'apps',
    run: ({ shell, args }) => {
      const launchArgs: Record<string, unknown> = {};
      if (args[0]) launchArgs.arg = args[0];
      shell.launch(app.id, launchArgs);
      return `opening ${app.title}…`;
    },
  })),
);
