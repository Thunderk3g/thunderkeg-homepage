import type { GameDefinition } from '../../types';
import { soloGames } from './games/solo';
import { multiGames } from './games/multi';

export const allGames: GameDefinition[] = [...soloGames, ...multiGames].sort(
  (a, b) => (b.weight ?? 0) - (a.weight ?? 0) || a.name.localeCompare(b.name),
);

export function getGame(id: string): GameDefinition | undefined {
  return allGames.find((g) => g.id === id);
}
