import type { GameDefinition } from '../../../../types';
import { snakeGame } from './snake';
import { g2048Game } from './g2048';
import { minesweeperGame } from './minesweeper';
import { tetrisGame } from './tetris';
import { breakoutGame } from './breakout';
import { memoryGame } from './memory';
import { simonGame } from './simon';
import { flappyGame } from './flappy';
import { sudokuGame } from './sudoku';
import { kalidleGame } from './kalidle';
import { whackamoleGame } from './whackamole';
import { lightsoutGame } from './lightsout';
import { pongCpuGame } from './pongcpu';

/** Single-player arcade games. */
export const soloGames: GameDefinition[] = [
  snakeGame,
  g2048Game,
  minesweeperGame,
  tetrisGame,
  breakoutGame,
  memoryGame,
  simonGame,
  flappyGame,
  sudokuGame,
  kalidleGame,
  whackamoleGame,
  lightsoutGame,
  pongCpuGame,
];
