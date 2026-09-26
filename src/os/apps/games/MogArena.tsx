'use client';

import type { AppDefinition, AppProps } from '../../types';

/**
 * Mog Arena — scan faces with the webcam, rate their "aura", generate memes
 * and run mog battles. It's a self-contained static app in public/mog-arena
 * (MediaPipe face landmarks + canvas memes + WebAudio sounds), embedded
 * same-origin so the iframe can be granted camera access.
 */
const MOG_ARENA_URL = '/mog-arena/index.html';

function MogArenaApp(_props: AppProps) {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: '#07060b' }}>
      <iframe
        src={MOG_ARENA_URL}
        title="Mog Arena"
        allow="camera; autoplay; fullscreen"
        style={{ display: 'block', width: '100%', height: '100%', border: 0 }}
      />
    </div>
  );
}

export const mogArenaApp: AppDefinition = {
  id: 'mog-arena',
  title: 'Mog Arena',
  icon: '🗿',
  category: 'Games',
  component: MogArenaApp,
  description: 'Face-scan mog battles, live filters, gang wars and the MOG QUEST retro RPG',
  defaultSize: { width: 1100, height: 720 },
  minSize: { width: 420, height: 480 },
  desktop: true,
  launchCommands: ['mog', 'mogarena'],
};
