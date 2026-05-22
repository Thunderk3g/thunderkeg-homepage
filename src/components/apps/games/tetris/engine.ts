"use client";

// Tetris engine: pure logic, no React, no DOM.
// 7-bag generator, SRS rotation, collision, line-clear, guideline scoring.

export const COLS = 10;
export const ROWS = 20;

export type TetrominoKind = "I" | "O" | "T" | "S" | "Z" | "J" | "L";

export type Cell = TetrominoKind | null;
export type Board = Cell[][]; // [row][col], row 0 is top.

export interface Piece {
  kind: TetrominoKind;
  rotation: 0 | 1 | 2 | 3;
  x: number; // top-left of bounding box
  y: number;
}

export interface GameState {
  board: Board;
  current: Piece;
  next: TetrominoKind;
  bag: TetrominoKind[];
  score: number;
  level: number;
  lines: number;
  gameOver: boolean;
  paused: boolean;
  dropAccumulator: number; // ms accumulated toward next gravity tick
}

// Standard Tetris guideline block colors (game data, not theme).
export const COLORS: Record<TetrominoKind, string> = {
  I: "#22d3ee",
  O: "#fbbf24",
  T: "#a855f7",
  S: "#4ade80",
  Z: "#ef4444",
  J: "#3b82f6",
  L: "#f97316",
};

// SRS shapes: rotations[kind][rotation] = list of [dx, dy] offsets from piece origin.
// Using 4x4 bounding box conventions for I, 3x3 for most.
type Offsets = ReadonlyArray<readonly [number, number]>;

const SHAPES: Record<TetrominoKind, Offsets[]> = {
  I: [
    [
      [0, 1],
      [1, 1],
      [2, 1],
      [3, 1],
    ],
    [
      [2, 0],
      [2, 1],
      [2, 2],
      [2, 3],
    ],
    [
      [0, 2],
      [1, 2],
      [2, 2],
      [3, 2],
    ],
    [
      [1, 0],
      [1, 1],
      [1, 2],
      [1, 3],
    ],
  ],
  O: [
    [
      [1, 0],
      [2, 0],
      [1, 1],
      [2, 1],
    ],
    [
      [1, 0],
      [2, 0],
      [1, 1],
      [2, 1],
    ],
    [
      [1, 0],
      [2, 0],
      [1, 1],
      [2, 1],
    ],
    [
      [1, 0],
      [2, 0],
      [1, 1],
      [2, 1],
    ],
  ],
  T: [
    [
      [1, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ],
    [
      [1, 0],
      [1, 1],
      [2, 1],
      [1, 2],
    ],
    [
      [0, 1],
      [1, 1],
      [2, 1],
      [1, 2],
    ],
    [
      [1, 0],
      [0, 1],
      [1, 1],
      [1, 2],
    ],
  ],
  S: [
    [
      [1, 0],
      [2, 0],
      [0, 1],
      [1, 1],
    ],
    [
      [1, 0],
      [1, 1],
      [2, 1],
      [2, 2],
    ],
    [
      [1, 1],
      [2, 1],
      [0, 2],
      [1, 2],
    ],
    [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 2],
    ],
  ],
  Z: [
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [2, 1],
    ],
    [
      [2, 0],
      [1, 1],
      [2, 1],
      [1, 2],
    ],
    [
      [0, 1],
      [1, 1],
      [1, 2],
      [2, 2],
    ],
    [
      [1, 0],
      [0, 1],
      [1, 1],
      [0, 2],
    ],
  ],
  J: [
    [
      [0, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ],
    [
      [1, 0],
      [2, 0],
      [1, 1],
      [1, 2],
    ],
    [
      [0, 1],
      [1, 1],
      [2, 1],
      [2, 2],
    ],
    [
      [1, 0],
      [1, 1],
      [0, 2],
      [1, 2],
    ],
  ],
  L: [
    [
      [2, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ],
    [
      [1, 0],
      [1, 1],
      [1, 2],
      [2, 2],
    ],
    [
      [0, 1],
      [1, 1],
      [2, 1],
      [0, 2],
    ],
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [1, 2],
    ],
  ],
};

// SRS wall-kick data. JLSTZ share one table, I has its own, O never kicks.
// Each entry: kicks to try in order, as [dx, dy] (dy positive = up in SRS spec;
// our board has y growing downward so we invert at use site).
type KickTable = ReadonlyArray<readonly [number, number]>;

const KICKS_JLSTZ: Record<string, KickTable> = {
  "0->1": [
    [0, 0],
    [-1, 0],
    [-1, 1],
    [0, -2],
    [-1, -2],
  ],
  "1->0": [
    [0, 0],
    [1, 0],
    [1, -1],
    [0, 2],
    [1, 2],
  ],
  "1->2": [
    [0, 0],
    [1, 0],
    [1, -1],
    [0, 2],
    [1, 2],
  ],
  "2->1": [
    [0, 0],
    [-1, 0],
    [-1, 1],
    [0, -2],
    [-1, -2],
  ],
  "2->3": [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, -2],
    [1, -2],
  ],
  "3->2": [
    [0, 0],
    [-1, 0],
    [-1, -1],
    [0, 2],
    [-1, 2],
  ],
  "3->0": [
    [0, 0],
    [-1, 0],
    [-1, -1],
    [0, 2],
    [-1, 2],
  ],
  "0->3": [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, -2],
    [1, -2],
  ],
};

const KICKS_I: Record<string, KickTable> = {
  "0->1": [
    [0, 0],
    [-2, 0],
    [1, 0],
    [-2, -1],
    [1, 2],
  ],
  "1->0": [
    [0, 0],
    [2, 0],
    [-1, 0],
    [2, 1],
    [-1, -2],
  ],
  "1->2": [
    [0, 0],
    [-1, 0],
    [2, 0],
    [-1, 2],
    [2, -1],
  ],
  "2->1": [
    [0, 0],
    [1, 0],
    [-2, 0],
    [1, -2],
    [-2, 1],
  ],
  "2->3": [
    [0, 0],
    [2, 0],
    [-1, 0],
    [2, 1],
    [-1, -2],
  ],
  "3->2": [
    [0, 0],
    [-2, 0],
    [1, 0],
    [-2, -1],
    [1, 2],
  ],
  "3->0": [
    [0, 0],
    [1, 0],
    [-2, 0],
    [1, -2],
    [-2, 1],
  ],
  "0->3": [
    [0, 0],
    [-1, 0],
    [2, 0],
    [-1, 2],
    [2, -1],
  ],
};

export function pieceCells(piece: Piece): Array<readonly [number, number]> {
  const shape = SHAPES[piece.kind][piece.rotation];
  return shape.map(
    ([dx, dy]) => [piece.x + dx, piece.y + dy] as const,
  );
}

export function emptyBoard(): Board {
  const b: Board = [];
  for (let r = 0; r < ROWS; r++) {
    const row: Cell[] = [];
    for (let c = 0; c < COLS; c++) row.push(null);
    b.push(row);
  }
  return b;
}

export function collides(board: Board, piece: Piece): boolean {
  for (const [x, y] of pieceCells(piece)) {
    if (x < 0 || x >= COLS || y >= ROWS) return true;
    if (y < 0) continue; // allow spawning partly above the board
    if (board[y][x] !== null) return true;
  }
  return false;
}

function refillBag(bag: TetrominoKind[]): TetrominoKind[] {
  if (bag.length > 0) return bag;
  const all: TetrominoKind[] = ["I", "O", "T", "S", "Z", "J", "L"];
  // Fisher-Yates shuffle.
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = all[i];
    all[i] = all[j];
    all[j] = tmp;
  }
  return all;
}

function takeFromBag(bag: TetrominoKind[]): {
  kind: TetrominoKind;
  bag: TetrominoKind[];
} {
  const filled = refillBag(bag);
  const kind = filled[0];
  return { kind, bag: filled.slice(1) };
}

function spawnPiece(kind: TetrominoKind): Piece {
  // I and O spawn slightly differently to center on a 10-wide board.
  const x = kind === "O" ? 3 : 3;
  const y = kind === "I" ? -1 : 0;
  return { kind, rotation: 0, x, y };
}

export function createInitialState(): GameState {
  let bag = refillBag([]);
  const first = bag[0];
  bag = bag.slice(1);
  const after = takeFromBag(bag);
  return {
    board: emptyBoard(),
    current: spawnPiece(first),
    next: after.kind,
    bag: after.bag,
    score: 0,
    level: 1,
    lines: 0,
    gameOver: false,
    paused: false,
    dropAccumulator: 0,
  };
}

// Gravity interval in ms based on level (rough guideline curve).
export function gravityIntervalMs(level: number): number {
  const lvl = Math.max(1, Math.min(level, 20));
  // Frames at 60fps for each level, condensed from guideline.
  const framesByLevel: Record<number, number> = {
    1: 48,
    2: 43,
    3: 38,
    4: 33,
    5: 28,
    6: 23,
    7: 18,
    8: 13,
    9: 8,
    10: 6,
    11: 5,
    12: 5,
    13: 5,
    14: 4,
    15: 4,
    16: 4,
    17: 3,
    18: 3,
    19: 3,
    20: 2,
  };
  return (framesByLevel[lvl] ?? 2) * (1000 / 60);
}

function lockPiece(board: Board, piece: Piece): Board {
  const next = board.map((row) => row.slice());
  for (const [x, y] of pieceCells(piece)) {
    if (y >= 0 && y < ROWS && x >= 0 && x < COLS) {
      next[y][x] = piece.kind;
    }
  }
  return next;
}

function clearLines(board: Board): { board: Board; cleared: number } {
  const kept = board.filter((row) => row.some((c) => c === null));
  const cleared = ROWS - kept.length;
  const out: Board = [];
  for (let i = 0; i < cleared; i++) {
    const row: Cell[] = [];
    for (let c = 0; c < COLS; c++) row.push(null);
    out.push(row);
  }
  for (const row of kept) out.push(row);
  return { board: out, cleared };
}

function scoreFor(cleared: number, level: number): number {
  // Guideline scoring (no T-spin detection).
  const base: Record<number, number> = { 1: 100, 2: 300, 3: 500, 4: 800 };
  return (base[cleared] ?? 0) * level;
}

function advanceToNextPiece(state: GameState): GameState {
  const taken = takeFromBag(state.bag);
  const newPiece = spawnPiece(state.next);
  const gameOver = collides(state.board, newPiece);
  return {
    ...state,
    current: newPiece,
    next: taken.kind,
    bag: taken.bag,
    gameOver,
  };
}

function applyLock(state: GameState): GameState {
  const locked = lockPiece(state.board, state.current);
  const { board, cleared } = clearLines(locked);
  const lines = state.lines + cleared;
  const level = 1 + Math.floor(lines / 10);
  const score = state.score + scoreFor(cleared, state.level);
  return advanceToNextPiece({
    ...state,
    board,
    lines,
    level,
    score,
    dropAccumulator: 0,
  });
}

export function tryMove(state: GameState, dx: number, dy: number): GameState {
  if (state.gameOver || state.paused) return state;
  const moved: Piece = {
    ...state.current,
    x: state.current.x + dx,
    y: state.current.y + dy,
  };
  if (!collides(state.board, moved)) {
    return { ...state, current: moved };
  }
  // If we tried to move down and collided, lock.
  if (dy > 0 && dx === 0) {
    return applyLock(state);
  }
  return state;
}

export function softDrop(state: GameState): GameState {
  if (state.gameOver || state.paused) return state;
  const moved = tryMove(state, 0, 1);
  // Award 1 point per cell of soft drop (only if actually moved, not locked).
  if (moved.current !== state.current && !moved.gameOver) {
    return { ...moved, score: moved.score + 1 };
  }
  return moved;
}

export function hardDrop(state: GameState): GameState {
  if (state.gameOver || state.paused) return state;
  let p = state.current;
  let cells = 0;
  while (!collides(state.board, { ...p, y: p.y + 1 })) {
    p = { ...p, y: p.y + 1 };
    cells++;
  }
  const scored: GameState = {
    ...state,
    current: p,
    score: state.score + cells * 2,
  };
  return applyLock(scored);
}

export function rotate(state: GameState, direction: 1 | -1): GameState {
  if (state.gameOver || state.paused) return state;
  if (state.current.kind === "O") return state;
  const from = state.current.rotation;
  const to = (((from + direction) % 4) + 4) % 4 as 0 | 1 | 2 | 3;
  const key = `${from}->${to}`;
  const table = state.current.kind === "I" ? KICKS_I : KICKS_JLSTZ;
  const kicks = table[key] ?? [[0, 0] as const];
  for (const [kx, ky] of kicks) {
    // SRS dy is up-positive; our board y is down-positive, so flip ky.
    const candidate: Piece = {
      ...state.current,
      rotation: to,
      x: state.current.x + kx,
      y: state.current.y - ky,
    };
    if (!collides(state.board, candidate)) {
      return { ...state, current: candidate };
    }
  }
  return state;
}

export function tick(state: GameState, deltaMs: number): GameState {
  if (state.gameOver || state.paused) return state;
  const interval = gravityIntervalMs(state.level);
  let acc = state.dropAccumulator + deltaMs;
  let s: GameState = { ...state, dropAccumulator: acc };
  while (acc >= interval) {
    acc -= interval;
    s = tryMove({ ...s, dropAccumulator: acc }, 0, 1);
    if (s.gameOver) return s;
    acc = s.dropAccumulator;
  }
  return { ...s, dropAccumulator: acc };
}

export function togglePause(state: GameState): GameState {
  if (state.gameOver) return state;
  return { ...state, paused: !state.paused };
}

export function restart(): GameState {
  return createInitialState();
}

// Ghost piece: where would the current piece land if hard-dropped now?
export function ghostPiece(state: GameState): Piece {
  let p = state.current;
  while (!collides(state.board, { ...p, y: p.y + 1 })) {
    p = { ...p, y: p.y + 1 };
  }
  return p;
}
