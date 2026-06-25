import type { GameDefinition } from '../../../../types';
import { ticTacToeGame } from './tictactoe';
import { connect4Game } from './connect4';
import { rpsGame } from './rps';
import { reactionGame } from './reaction';
import { dotsBoxesGame } from './dotsboxes';
import { checkersGame } from './checkers';
import { battleshipGame } from './battleship';
import { wordRaceGame } from './wordrace';
import { tugOfWarGame } from './tugofwar';

/** Multiplayer (Supabase Realtime) games. */
export const multiGames: GameDefinition[] = [
  ticTacToeGame,
  connect4Game,
  rpsGame,
  reactionGame,
  dotsBoxesGame,
  checkersGame,
  battleshipGame,
  wordRaceGame,
  tugOfWarGame,
];
