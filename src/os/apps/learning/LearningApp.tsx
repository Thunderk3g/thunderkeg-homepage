'use client';

import type { AppDefinition, AppProps } from '../../types';
import { LearningOS } from '@/learning/LearningOS';

/** Same component as /learning — one implementation, two mount points. */
function LearningAppView(_props: AppProps) {
  return <LearningOS embedded />;
}

export const learningApp: AppDefinition = {
  id: 'learning',
  title: 'Learning OS',
  icon: '🧭',
  category: 'Development',
  component: LearningAppView,
  description: 'Persistent skill-state model: evidence, dependencies and AI-free checks',
  defaultSize: { width: 1080, height: 700 },
  minSize: { width: 460, height: 360 },
  desktop: true,
  launchCommands: ['learn', 'learning'],
};

export default LearningAppView;
