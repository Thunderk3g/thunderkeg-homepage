import type { Command } from '../../../types';
import { coreutilsCommands } from './extra/coreutils';
import { textprocCommands } from './extra/textproc';
import { sysinfoCommands } from './extra/sysinfo';
import { netutilsCommands } from './extra/netutils';
import { funstuffCommands } from './extra/funstuff';

/** Aggregated "extra" terminal commands from the fan-out command groups. */
export const extraCommands: Command[] = [
  ...coreutilsCommands,
  ...textprocCommands,
  ...sysinfoCommands,
  ...netutilsCommands,
  ...funstuffCommands,
];
