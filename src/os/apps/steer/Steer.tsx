'use client';

import type { AppDefinition } from '../../types';
import { SteerableCanvas } from '@/steer/SteerableCanvas';

/** The steerable canvas in a window. The same component as /steer. */
function SteerApp() {
  return <SteerableCanvas wsUrl={process.env.NEXT_PUBLIC_STEER_WS_URL || undefined} />;
}

export const steerApp: AppDefinition = {
  id: 'steer',
  title: 'Steerable Canvas',
  icon: '🎛️',
  category: 'Research',
  component: SteerApp,
  description: 'Steer a model while it writes: a focus monitor, attention locks, steering dials and a knob that scrubs through continuations',
  defaultSize: { width: 1040, height: 720 },
  minSize: { width: 560, height: 460 },
  desktop: true,
  launchCommands: ['steer', 'canvas'],
};

export default SteerApp;
