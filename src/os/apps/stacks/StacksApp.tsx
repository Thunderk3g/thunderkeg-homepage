'use client';

import type { AppDefinition, AppProps } from '../../types';
import { useOS } from '../../store';
import { StacksRecord } from '@/stacks/StacksRecord';

/**
 * The board behind the windows, as a record you can read. Same component as
 * /stacks. Launch args: `subjectId` scrolls to one stack (clicking a stack on
 * the desktop sends it).
 */
function StacksAppView({ args }: AppProps) {
  const launch = useOS((s) => s.launch);
  return (
    <StacksRecord
      embedded
      subjectId={typeof args?.subjectId === 'string' ? args.subjectId : undefined}
      onOpen={(cube) => cube.open && launch(cube.open.app, cube.open.args)}
    />
  );
}

export const stacksApp: AppDefinition = {
  id: 'stacks',
  title: 'Stacks',
  icon: '🧱',
  category: 'Research',
  component: StacksAppView,
  description: 'What I have learnt, as a record: each thing built, measured, studied or written, by subject',
  defaultSize: { width: 900, height: 680 },
  minSize: { width: 420, height: 360 },
  desktop: true,
  launchCommands: ['stacks', 'record', 'learn'],
};

export default StacksAppView;
