import type { Command } from '../../../types';
import { coreCommands } from './core';
import { extraCommands } from './extra';

/** Master list of terminal commands. Fan-out command groups land in ./extra. */
const baseCommands: Command[] = [...coreCommands, ...extraCommands];

const helpCommand: Command = {
  name: 'help',
  summary: 'list available commands',
  usage: 'help [command]',
  category: 'shell',
  run: ({ args }) => {
    if (args[0]) {
      const c = allCommands.find((x) => x.name === args[0]);
      if (!c) return `help: no help topics match '${args[0]}'`;
      return `${c.name} — ${c.summary}${c.usage ? `\n  usage: ${c.usage}` : ''}`;
    }
    const byCat = new Map<string, string[]>();
    for (const c of allCommands) {
      const cat = c.category ?? 'misc';
      if (!byCat.has(cat)) byCat.set(cat, []);
      byCat.get(cat)!.push(c.name);
    }
    const out: string[] = ['Available commands (type `man <cmd>` for detail):', ''];
    for (const [cat, names] of [...byCat.entries()].sort()) {
      out.push(`  ${cat}:`);
      out.push('    ' + names.sort().join('  '));
    }
    out.push('', 'Tip: Tab completes · ↑/↓ history · launch apps: firefox, thunar, games, msfconsole');
    return out.join('\n');
  },
  complete: ({ args }) => allCommands.map((c) => c.name).filter((n) => n.startsWith(args[0] ?? '')),
};

const manCommand: Command = {
  name: 'man',
  summary: 'display the manual for a command',
  usage: 'man <command>',
  category: 'shell',
  run: ({ args }) => {
    const c = allCommands.find((x) => x.name === args[0]);
    if (!args[0]) return 'What manual page do you want?';
    if (!c) return `No manual entry for ${args[0]}`;
    return [
      `NAME`,
      `    ${c.name} — ${c.summary}`,
      ``,
      `SYNOPSIS`,
      `    ${c.usage ?? c.name}`,
      ``,
      `DESCRIPTION`,
      `    ${c.summary}.`,
      c.category ? `\nCATEGORY\n    ${c.category}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  },
  complete: ({ args }) => allCommands.map((c) => c.name).filter((n) => n.startsWith(args[0] ?? '')),
};

export const allCommands: Command[] = [...baseCommands, helpCommand, manCommand];

export const commandMap: Map<string, Command> = new Map(allCommands.map((c) => [c.name, c]));
